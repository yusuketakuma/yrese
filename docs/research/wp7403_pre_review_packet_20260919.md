# WP-7403 pre-review packet — 処方訂正(新版) + 疑義照会記録

```yaml
packet_id: WP-7403-PRE-REVIEW-20260919
created_at: 2026-09-19
status: DECIDED
base: 88e40c0(main)
scope: prescription_inquiries(記録・回答・結果)、POST /prescriptions/{id}/amend(新版+
       supersedes+inquiry必須)、prescription_versions 拡張(version>=2 lineage)、
       GET versions/inquiries read 面、audit/outbox event、migration 000022、
       fixture parity、in-memory/PG 両実装
out_of_scope: 調剤記録(WP-7404、疑義未解決 409 は同 WP で結線)、inquiry/amend の
              Web UI(受入に UI 要件なし — 別 WP)、MedicationRequest ownership
              (BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP 継続)、
              production/staging 適用、外部配送 worker 有効化、
              CONFIRMED 状態の draft 差替え(un-confirm は別論点)
```

## 1. 背景

WP-7402 で NULL→PHARMACIST_CONFIRMED→PRESCRIPTION_FINALIZED と v1 immutable
snapshot が着地した。WP-7403 は DOM-002 §4「確定後の変更は訂正版の新規作成+履歴
保持のみ(無履歴変更禁止)」・§5「疑義照会による処方変更は Prescription の訂正版
経由(Dispensing 側で書き換え禁止)」・DOM-004 §1「処方確定 → 調剤記録済みの
ガード: 疑義照会が未解決でないこと(解決記録 or 変更は処方の新版経由)」を
実装する。Plans.md WP-7403 記述・C-062 が実装根拠。

WP-7402 との境界: 訂正は「finalized のみ」を対象とし、既存 lifecycle status は
新設しない(PRESCRIPTION_FINALIZED のまま、version 番号で版を表現する)。

## 2. Inquiry の置き場とライフサイクル(D-1)

- **(a) `prescription_inquiries` 表 + write-once answer【推奨】** — 照会先・
  照会内容・回答・回答者・時刻・結果(UNCHANGED/CHANGED)を1行で保持。
  OPEN(answer IS NULL)/RESOLVED を導出状態とし、回答は UPDATE 1回のみ許可の
  trigger で write-once。DELETE/TRUNCATE 禁止。
- (b) inquiry を version 行に埋め込む — 照会は複数件・版非依存で、version
  snapshot とは寿命が違う。採用しない。

決定: **(a)**。照会先・照会内容は TEXT 上限付き(500/2000 文字)。回答も write-once
(再回答は新 inquiry を起票する運用)。`recorded_seq BIGSERIAL` で deterministic な
発生順を持つ(資格 evidence と同規則)。

## 3. route 形状(D-2)

- `POST /prescriptions/{id}/inquiries` — inquiry 起票。body:
  `{ directedTo, content }` + Idempotency-Key。scope `prescription:write`。
- `POST /prescriptions/{id}/inquiries/{inquiryId}/answer` — 回答記録。
  body: `{ answer, result: "UNCHANGED"|"CHANGED" }` + Idempotency-Key。
  scope `prescription:write`。answered_by は trusted actorId、answered_at は
  server clock(client 時刻を信用しない)。
- `POST /prescriptions/{id}/amend` — 訂正版作成。body:
  `{ inquiryId, content }`(content は draft save と同スキーマ)。
  scope `prescription:confirm` + SEC-010 ACTIVE PHARMACIST_LICENSE。
  Idempotency-Key 必須(同一再送 200、別 payload 409)。
- `GET /prescriptions/{id}/versions` / `GET /prescriptions/{id}/versions/{version}` —
  scope `prescription:read`+`reception:read`+`patient:read`(draft GET と同集合)。
  immutable snapshot をそのまま返す(「旧版が読める」受入)。
- `GET /prescriptions/{id}/inquiries` — 一覧(scope 同上)。

いずれも既存 command route と同じ envelope/`errorCode` 形状、no-store 応答。

## 4. Amend の semantics(D-3)

ガード順(fail-closed、存在非開示を維持):

1. SEC-010 資格判定(非資格 → 403 + `prescription.amend.denied` 監査)
2. scope 内の処方存在(不在 → 404 RX-0006)
3. `status = PRESCRIPTION_FINALIZED` のみ(それ以外 → 409 RX-0002)
4. `inquiryId` が同一 scope・同一処方の RESOLVED かつ `result = CHANGED`
   (未充足・OPEN・UNCHANGED・他処方の inquiry → **422 RX-0007**。
   「amend に inquiry なしは 422」受入)
5. content が contract schema 適合(400 RX-0005)かつ UNRESOLVED_TEXT なし
   (409 RX-0001 — 確定済み版と同じ解決必須 guard を新版にも適用)
6. Idempotency-Key replay(同一 200 / 別 payload 409)

効果(同一 tx):

- `prescription_versions` に `version = 現行+1` を挿入。
  `supersedes_version = 現行 version`、`inquiry_id`、`amended_by`、`amended_at`。
  `confirmed_by/at`・`finalized_by/at` は amend 実行者・時刻を設定(amend は
  新版の confirm+finalize を兼ねる — MVP では訂正も薬剤師責任で即確定とする。
  「訂正にも別途 confirm を要求する」2段階化は後続で検討)。
- audit `prescription.amended`(payload: prescription ID + version + actorId +
  inquiryId — 識別子のみ、本文・患者識別子は載せない)。
- outbox `prescription.amended`(payload `{ version }`、partner projection へ
  `prescription.finalized` と同じ version 転記規則を適用 — 下流が新版を見逃さない)。

**`prescription_drafts` は触らない**。000020/000021 の post-confirm 書込み trigger
は維持し、draft 行は v1 の作業記録として凍結。確定後の現行 content の権威は
`prescription_versions` の MAX(version) 行とする(read 契約をそう定義する)。
これにより「Dispensing 側で書き換え禁止」は構造的に保証される — amend 以外に
v>=2 を作る経路が存在せず、draft/子テーブルは既存 trigger で不変。

受付状態ガードは**付けない**(訂正は会計後・患者離局後にも起こり得るため。
RX-0004 は confirm 固有)。

## 5. DB 設計(D-4)

migration `000022_prescription_amendment.sql`(次番号。Plans.md の WP-7501 記載
「000022」は本 WP が先に消費するため、着地時に Plans 側を 000023+ へ修正する)。

- `prescription_versions` へ列追加: `supersedes_version INT NULL`、
  `inquiry_id TEXT NULL`、`amended_by TEXT NULL`、`amended_at TIMESTAMPTZ NULL`。
- lineage CHECK: `(version = 1 AND supersedes_version IS NULL AND inquiry_id IS NULL)`
  `OR (version > 1 AND supersedes_version = version - 1 AND inquiry_id IS NOT NULL
  AND amended_by IS NOT NULL AND amended_at IS NOT NULL)` — v>=2 は訂正 lineage 必須。
- `prescription_inquiries`:
  `tenant_id/pharmacy_id/inquiry_id/prescription_id`(複合 FK → prescription_drafts)、
  `directed_to TEXT NOT NULL`(<=500)、`content TEXT NOT NULL`(<=2000)、
  `answer TEXT NULL`、`answered_by TEXT NULL`、`answered_at TIMESTAMPTZ NULL`、
  `result TEXT NULL CHECK (result IN ('UNCHANGED','CHANGED'))`、
  `created_by/created_at/recorded_seq BIGSERIAL`。
  CHECK: 回答は answer/answered_by/answered_at/result が同時 NULL または同時 NOT NULL。
- triggers: inquiry の `directed_to/content/created_*` UPDATE 禁止、answer write-once
  (既回答 UPDATE 禁止)、DELETE/TRUNCATE 禁止。`prescription_versions` の既存
  append-only trigger はそのまま v>=2 にも効く。

## 6. 監査・scope・error code(D-5)

- MOD-008 登録追加【SSOT】: `prescription.amended`、`prescription.amend.denied`、
  `inquiry.answered`(`inquiry.recorded` は登録済みを使用)。
- scope 決定(permission_scope_registry §45 の open question「疑義照会専用 scope
  要否」を本 WP で解消): inquiry 記録は `prescription:write`(事務記録)、amend は
  `prescription:confirm` + 免許 evidence(確定済み臨床記録の変更 = 薬剤師行為)。
  専用 action は追加しない(ロール→scope 割当は auth SSOT で確定するまで据置)。
- MOD-006 登録追加【SSOT】: `RX-0007`(amend 前提 inquiry 未充足/不整合 422)、
  `RX-0008`(inquiry command 不正 400)、`RX-0009`(inquiry 不存在 404)、
  `RX-0010`(冪等 conflict 409 — 同一 Idempotency-Key で異なる payload)。
  amend は RX-0001/0002/0005/0006 を再利用。
- 冪等キー保持: `prescription_inquiries.idempotency_key`(起票)、
  `prescription_inquiries.answer_idempotency_key`(回答、回答済み時 NOT NULL)、
  `prescription_versions.amend_idempotency_key`(v>=2 で NOT NULL、lineage
  CHECK に含める)。replay 判定はキー一致+payload 一致で 200、キー一致+
  payload 不一致で RX-0010。

## 7. outbox intent(D-6)

MOD-009 §6 へ `prescription.amended` の intent profile を追加【SSOT bounded
amendment】: finalized と同じ envelope/hash 規則、payload `{ version }`。
partner projection は `prescription.amended` も version 転記対象に追加
(`projectPayloadFields` を 2 event type へ拡張)。

## 8. 実装範囲と検証(D-7)

- contracts: amend/inquiry request・response、inquiry view、version view schema。
- API: in-memory + PG service 両実装、route 5本、fixture parity。
- migration 000022 + `migrations.ts` 登録 + `yrese_dev` 適用。
- テスト: ガード各系(非資格/存在/状態/inquiry 不整合/unresolved/replay)、
  v2 作成の同一 tx 監査/outbox、write-once answer trigger、旧版 read、
  cross-scope 非開示、fixture smoke。
- OpenAPI 再生成。Web は本 WP 範囲外(既存 UI 破壊しないことのみ確認)。

## 9. 決定記録

| ID | 決定 | 根拠 |
|---|---|---|
| D-1 | inquiry = 独立表 + write-once answer | §2(a) |
| D-2 | route 形状 §3 | lifecycle command と同規則 |
| D-3 | amend = FINALIZED のみ・inquiry CHANGED 必須・draft 非接触 | §4 |
| D-4 | migration 000022、lineage CHECK | §5 |
| D-5 | scope: inquiry=write / amend=confirm+免許 | §6 |
| D-6 | outbox `prescription.amended` を含める | partner 整合 |
| D-7 | Web UI 対象外 | WP 受入に UI 要件なし |

承認根拠: direct user instruction(「進めてください」+ 継続する一括許可)。
本 packet は R3 の required human pre-review record として扱う。

## 10. 実装状況

### 実装サマリ(2026-09-19)

- route 6 本: `POST /prescriptions/{id}/inquiries`、`POST /prescriptions/{id}/inquiries/{inquiryId}/answer`、`POST /prescriptions/{id}/amend`、`GET /prescriptions/{id}/versions`、`GET /prescriptions/{id}/versions/{version}`、`GET /prescriptions/{id}/inquiries`(`prescription-amendment-routes.ts`、main.ts 登録)。
- in-memory / PostgreSQL 両 service に `createInquiry`・`answerInquiry`・`amend`・`listVersions`・`getVersion`・`listInquiries` を実装(§4 guard 順序: 資格 → 存在 → FINALIZED → inquiry RESOLVED+CHANGED → content/metadata 妥当性 → replay → 書込)。
- migration `000022_prescription_amendment.sql`:`prescription_inquiries`(write-once answer trigger、UPDATE/DELETE/TRUNCATE 拒否)・`prescription_versions` v≥2 lineage 列(`supersedes_version`/`inquiry_id`/`amended_by`/`amended_at`/`amend_idempotency_key`、append-only trigger、lineage CHECK)・`outbox_events` aggregate_type 'prescription' 済み schema を流用。`yrese_dev` 適用済み。
- error code: RX-0007(inquiry 前提不成立)・RX-0008(inquiry command 不正)・RX-0009(inquiry 不存在)・RX-0010(idempotency conflict)を shared-kernel + registry SSOT へ追加。
- audit registry:`inquiry.recorded`・`inquiry.answered`・`prescription.amended`・`prescription.amend.denied` を MOD-008 registry と runtime `AUDIT_EVENT_TYPES` へ追加。監査 payload は識別子のみ — `inquiry.*` は `targetRef {kind:"prescription_inquiry", id:"<rx>/<inquiry>"}`、`inquiry.answered` は `businessReason.code=INQUIRY_RESULT_{UNCHANGED|CHANGED}`、`prescription.amended` は `targetRef {kind:"prescription_version", id:"<rx>/<version>/<inquiry>"}`。照会本文・回答本文・処方内容は一切含めない。
- partner projection:`prescription.amended` を `prescription.finalized` と同経路で投影(payload = prescriptionId + version のみ、version 欠落/不正は fail-closed)。
- OpenAPI: 6 path を source へ追加し `docs/api/openapi.yaml` 再生成(drift check PASS)。
- fixture parity:`scripts/ui-fixture-api.mjs` の migrationState を 000022 へ更新(UI 実装は D-7 で scope 外)。

### R3 独立 review — round 1(FAIL → 修正済み)

fresh-context read-only reviewer(Oracle Pro 利用不可のため代替 reviewer — ユーザ明示承認)が frozen diff `bc08d20` に対して FAIL(3M/4L)を報告。確定 finding と対応:

| # | severity | finding | 対応 |
|---|---|---|---|
| F-1 | M | amend replay が `inquiryId` を payload 比較に含めず、同 key+別 inquiry+同 content で誤 replay | replay 等価判定を `{inquiryId, contentHash}` 全体一致へ修正(両 service)+ unit/route/PG 回帰 test |
| F-2 | M | v≥2 の `confirmed/finalized_by/at` が v1 実行者・時刻をコピー | §4 要求どおり amend 実行者・時刻を設定(両 service)+ 別 actor 回帰 test |
| F-3 | M | inquiry/amend 監査が MOD-008 必須識別子(inquiryId/result/version)を欠く | 上記 structured targetRef + businessReason で識別子を載せる(本文非含有を維持)+ audit 内容 assert 追加 |
| F-4 | L | replay 判定が business guard より先(§4 は guard 6) | replay を business guard 後へ移動(両 service) |
| F-5 | L | in-memory で outbox append 失敗時に amend 成功監査が残り得る | **不採用(記録)**:WP-7402 と同一順序。`appendFor` は (aggregate,eventType,version) 重複のみで throw し、version 重複は replay/version guard で先行捕捉されるため到達不能 |
| F-6 | L | `amend_idempotency_key` に DB 一意 index なし | **不採用(記録)**:draft 行 lock 下 SELECT で担保済み。000022 は `yrese_dev` 適用済みで checksum 整合のため retroactive 編集不可、防御目的のみの新 migration は不釣り合い |
| F-7 | L | test gap(別 actor amend・別 inquiry 同 key・GET no-store・TRUNCATE・監査識別子) | 全件追加済み(route/unit/PG)。残余 optional gap(並行 amend race)は既存 lock 構造で受理 |

### 検証(実行済み・2026-09-19)

- `pnpm --filter @yrese/api test` + `TEST_DATABASE_URL`(実 PG 18 @5433 `yrese_dev`):**1,313 PASS / skip 0**(WP-7403 PG integration 9 件含む)。
- `pnpm -r test`(workspace):全 package PASS — api 1,313・web 808・contracts 244・audit 206・calculation 121・shared-kernel 87・trace 61・events 46・money 17・date-time 20。
- `pnpm typecheck`:全 workspace PASS。
- `check:openapi`(drift)・`check:boundaries`・`check:secrets`・`check:ssot-index`(190 docs)・`check:deps`(high=0/critical=0)・`check:sbom`(249)・`check:calculation-purity`・`test:scripts`:全 PASS。

### R3 独立 review — round 2(FAIL → N-1 修正済み)

frozen diff `1fcb95d` に対し fresh-context read-only reviewer が検証。F-1〜F-4 の修正、F-5/F-6 の不採用根拠、F-7 の回帰 test をすべて独立に確認した上で **FAIL(新規 L 1件)**:

| # | severity | finding | 対応 |
|---|---|---|---|
| N-1 | L | in-memory `finalize()` が v1 `confirmedBy` に finalize 実行者を記録(`confirmedAt` は正しく confirm 時刻を使うため意図と矛盾)。PG は `row.confirmed_by` で正しい — confirm/finalize が別薬剤師(交代引継ぎ)の場合に in-memory/PG parity 違反(§8) | `confirmedBy: fresh.lifecycle.confirmedBy ?? input.actorId` へ修正 + 別 actor confirm/finalize 回帰 test 追加 |

修正後の影響 validation:typecheck PASS、API test 1,314 PASS(PG integration 込み・skip 0、N-1 回帰 test 含む)。

### R3 独立 review — round 3(PASS)

frozen diff `71c8025` に対し fresh-context read-only reviewer が検証。**PASS — N-1 修正確認・新規確定欠陥 0**:

- N-1: `finalize()` v1 provenance が `fresh.lifecycle.confirmedBy/confirmedAt`(confirm 実行者・時刻)+ finalize 実行者・時刻へ修正され、PG `row.confirmed_by`/`confirmed_at` と意味一致を確認。回帰 test(別 actor confirm/finalize)も実在・正しい assert を確認。
- sweep: 両 service の provenance 代入箇所(confirm/finalize/amend/answer)で stored-vs-command actor の不整合なし、read path parity(13 field 一致・順序同等)、WP-7402 finalize semantics 維持(replay・`prescriptionVersion=1`)、guard 順序 §4 一致、000022 trigger/CHECK・`intent_dedup_key` と service 挙動の整合、route scope/error マッピング完了を確認。

全 finding 閉塞:F-1〜F-4 修正、F-5/F-6 不採用(根拠記録済み)、F-7 回帰追加、N-1 修正。round 3 PASS をもって WP-7403 の独立 review gate を閉じる。
