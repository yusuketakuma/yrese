# reception_queue_contract — 受付キュー API 契約

```yaml
ssot_id: API-006
title: 受付キュー API 契約(GET /reception/queue, POST /reception, POST /reception/{receptionId}/transitions)
domain: api
status: APPROVED
approved_at: 2026-09-17
approved_by: "direct human authority 2026-09-17 (SSOT batch 一括 APPROVE); independent review: Devin in-session primary-source cross-check (Oracle 不使用), findings closed in PROPOSED revisions"
effective_from: 2026-09-17
effective_to: null
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.3.3
created_at: 2026-07-09
updated_at: 2026-09-18
source_refs: [UIX-001 §12(SCR-001), UIX-001 §11(業務導線), API-001 v0.2.2(様式先例), API-003(公開API共通土台), DOM-004 §2(受付副状態機械)]
depends_on: [API-001, API-002, API-003, DOM-004(処方ライフサイクルとの分界), MOD-005(状態台帳 — 改版前提), MOD-006(error_code_registry — 改版前提), MOD-007(permission registry — 改版前提), MOD-008(監査種別 — 改版前提), MOD-011(date-time policy)]
impacts: [packages/contracts, apps/api, apps/web(WP-3009 SCR-001), packages/shared-kernel(RECEPTION_STATUSES / PERMISSION_RESOURCES / RCV エラーコード / ReceptionId factory 追加)]
related_work_packages: [WP-3009, WP-3009-BE, WP-3009-UI, WP-4046, WP-4049, WP-5003, WP-7201, WP-9002-W5A]
related_tests:
  - packages/shared-kernel/src/kernel.test.ts
  - packages/contracts/src/reception-queue.test.ts
  - apps/api/src/server.test.ts
  - apps/api/src/db/postgres-repositories.integration.test.ts
  - apps/web/app/reception-dashboard.test.tsx
  - pnpm check:openapi
related_prs: []
evidence_ids: []
change_log:
  - "0.3.0 2026-09-17 WP-7201 PROPOSED: 受付状態遷移 endpoint `POST /reception/{receptionId}/transitions` を §2.3 として追加(遷移表の正本は DOM-004 §2、CAS は expectedVersion+If-Match 併用、CANCELLED は businessReason 必須)。エラーへ RCV-0004(不許可遷移 409)/ RCV-0005(version conflict 409)を追加し MOD-006 へ登録提案。監査は MOD-008 へ `reception.started` / `reception.completed` を追加提案(`reception.cancelled` は既存)。既存 GET/POST の wire・認可・冪等規則は不変。review と human approval まで実装根拠にしない"
  - "0.3.0 2026-09-17 独立 review(Devin in-session、Oracle 不使用)訂正: migration 000014(version/status_changed_at/cancel_reason 列)への依存と、Idempotency-Key を要求しない If-Match CAS 冪等性の根拠(API-013 update 規則)を明記"
  - "0.3.0 2026-09-17 finalization: 独立 review 反映済み本文のまま direct human approval(SSOT batch 一括 APPROVE)により PROPOSED→APPROVED。承認範囲は SSOT 改版のみで、migration 000014 適用・実装完了・production action を含まない。API_CONTRACT_BLOCKED は昇格により解除"
  - "0.3.1 2026-09-17 WP-7201 実装着手時の契約ギャップ解消(direct human approval による APPROVED 維持改版): (a) transitions の受付不存在 404 へ RCV-0006 を割当(MOD-006 0.1.4 に登録) (b) `businessReason` の形式を MOD-008 構造化理由コード `/^[A-Z][A-Z0-9_]{2,63}$/` に確定(自由記述禁止 — wire・cancel_reason 列・監査 businessReason.code に同値) (c) ReceptionQueueEntry に `version: integer >=1` を追加 — expectedVersion CAS は現在 version の取得経路を必要とし、queue 応答が唯一の監視 read であるため(PHI 非含有の additive 変更)"
  - "0.3.3 2026-09-18 WP-7105 — C-021 queue bound 決定(選択肢 b、direct human approval)を実装反映: GET /reception/queue に `RECEPTION_QUEUE_MAX_ENTRIES = 1000` の防御的 cap を追加(超過は 503 + `RCV-0007` + `nextAction`、監査非記録)。errorResponseSchema に optional `nextAction` を additive 追加。既存の wire・認可・冪等規則は不変"
  - "0.3.2 2026-09-18 WP-7204 実装着手時の additive 改版: ReceptionQueueEntry に `eligibility` を追加(API-019 の受付単位資格状態を queue が公開 — state / snapshotId / allowsProvisionalCalculation / allowsFinalCalculation は全てサーバ導出で、UI は患者要約 eligibilityStatus や独自推測で代替しない。PHI 非含有の additive 変更)"
  - "0.2.3 2026-08-26 WP-5104 reference-only cutover to UIX-001 §§11〜12; API contract semantics unchanged"
  - "body history authority: 本文§8変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - キュー状態と DOM-004 処方ライフサイクル(RECEIVED_PROVISIONAL 等)の対応付け(処方箋取込 WP で確定)
blockers: []
```

## 1. 目的とスコープ

SCR-001 受付ダッシュボード(当日の受付キュー・業務起点)のための最小契約。
**受付は業務管理であり、算定・請求・点数には一切触れない**(算定系は CAL/CLM 系 SSOT の別レーン)。
DB 未導入のため、実装はリポジトリインターフェース+インメモリ合成データから始める(API-001/WP-2008 と同型)。backend 側の初期実装は WP-3009-BE/93aefa1 で完了している。

## 2. エンドポイント

### GET /reception/queue?date=YYYY-MM-DD

- `date` は**必須**(暗黙の「今日」をサーバー側で解決しない — MOD-011 の暗黙現在時刻禁止。既定日付は UI 側の責務)。
- `date` は `YYYY-MM-DD` の**形式だけでなく実在する暦日として検証**する(例: `2026-02-31` は 400 で拒否。@yrese/date-time の CalendarDate 由来 parser を用いる — 独自 date パーサの実装禁止)。
- レスポンス(200):

```
{
  date: string,                  // YYYY-MM-DD(要求と同一)
  entries: ReceptionQueueEntry[]
}

ReceptionQueueEntry = {
  receptionId: string,           // wire は素の string(branded 化は内部 — API-001 と同方針)
  patient: PatientSummary,       // §4(患者検索の結果形状を再利用)
  acceptedAt: string,            // ISO datetime(サーバー採番)
  receptionStatus: ReceptionStatus,       // §5
  prescriptionIntakeType: 'paper',        // 初期は紙のみ。電子処方箋は BLOCKED(ONS=WP-0016)—
                                          // 'electronic' は解除後に後方互換な enum 追加として改版
  version: integer,              // >=1(0.3.1)。遷移 CAS(expectedVersion/If-Match)の現在値取得経路
  eligibility: {                 // 0.3.2 — API-019 の受付単位資格状態(サーバ導出、snapshot 由来)
    state: ReceptionEligibilityState,     // shared-kernel RECEPTION_ELIGIBILITY_STATES(UNVERIFIED 等)
    snapshotId: string | null,            // 紐づく snapshot。UNVERIFIED では null
    allowsProvisionalCalculation: boolean, // shared-kernel 導出関数由来(UI は再推測しない)
    allowsFinalCalculation: boolean        // 同上
  }
}
```

- 1薬局・1日のキューは有界のため初期契約はページネーションなし(全件)。肥大が実測された場合は API-001 と同型の cursor を改版で追加する。
- **防御的 cap(0.3.3 — C-021 選択肢 b、direct human approval 2026-09-18)**: 応答上限は `RECEPTION_QUEUE_MAX_ENTRIES = 1000` 件。repository は cap+1 件まで読み、超過時は `503` + `RCV-0007` + `nextAction` を返す(errorResponseSchema の optional `nextAction`)。超過応答は PHI を含まず、`reception.queue.viewed` 監査は記録しない(結果を返却していないため)。実測根拠: INV-20260730-01(1000件 ≒ 310KiB/40ms)。
- キューの並びは **acceptedAt 昇順 + receptionId 昇順の安定順序**を契約とする(acceptedAt 同値時も決定的な順序 — テストの安定性と表示の再現性のため。並び替えはクライアント責務)。
- `receptionId` は wire 上は素の string を維持する。ただし契約検証は shared-kernel の `receptionId()` factory と同水準に揃え、非空・空白のみ拒否・制御文字拒否・最大128文字を fail-closed に拒否する(WP-4046)。

### POST /reception

- ボディ: `{ patientId: string, idempotencyKey: string }`
- `patientId` は API-001 と同じ wire ID 検証水準(素の string 維持、非空・空白のみ拒否・制御文字拒否・最大128文字)とする。branded 化は内部で行い、contracts は shared-kernel の `patientId()` factory 由来 refine を再利用する(WP-4046)。
- `acceptedAt`・`receptionId` はサーバー採番。`receptionStatus` は `WAITING` で開始。
- **idempotencyKey の制約**: 非空・空白のみ/制御文字を拒否・最大128文字。**キーに患者情報(氏名・患者番号等の PHI)を使わない**(クライアント生成の不透明キー — UUID 等 — とする)。
- **冪等性**: idempotencyKey は必須(受付窓口の二重操作は現実的リスク)。一意性境界は (tenantId, pharmacyId, idempotencyKey)。
  - 同一 key + **同一 patientId** の再送 → 新規作成せず既存エントリを 200 で返す(重複受付の fail-closed 防止)。
  - 同一 key + **異なる patientId** → **409 + `RCV-0003`**(idempotency conflict)。誤患者のエントリを返さない(fail-closed)。実装は payload(patientId)を key と併せて保存し不一致を検出する。
- レスポンス(201 / 冪等再送時 200): 登録された ReceptionQueueEntry。

### POST /reception/{receptionId}/transitions (0.3.x — WP-7201 で実装済み)

受付状態の副状態機械を駆動する唯一の write 経路。許可遷移の**正本は DOM-004 §2**
(本契約で遷移表を再定義しない):

| to | 許可元 | 意味 | 監査種別(MOD-008) |
|---|---|---|---|
| IN_PROGRESS | WAITING | 対応開始 | `reception.started` |
| COMPLETED | IN_PROGRESS | 対応完了(終端) | `reception.completed` |
| CANCELLED | WAITING / IN_PROGRESS | 取消(終端)。`businessReason` 必須 | `reception.cancelled`(既存・businessReason 必須) |

- `receptionId` path パラメータは §2 POST と同一の wire ID 検証水準(非空・空白のみ拒否・制御文字拒否・最大128文字)。
- ボディ: `{ to: ReceptionStatus, expectedVersion: integer, businessReason?: string }`
  - `to` は上表の 3 値のみ。`WAITING` への遷移・その他の値は 400(契約 parse 拒否)。
  - `expectedVersion` は 1 以上の整数。**`If-Match: "<expectedVersion>"` ヘッダも併せて必須**とし、
    両者が一致しない場合・If-Match 欠落・形式不正は 400(`RCV-0001`)。
  - `businessReason` は `to: CANCELLED` のとき**必須**。MOD-008 `reception.cancelled` の
    businessReason 規律に従い **構造化理由コード**(`/^[A-Z][A-Z0-9_]{2,63}$/`、自由記述禁止)
    とする(0.3.1 で形式を確定 — wire・`cancel_reason` 列・監査 `businessReason.code` に同値を保存)。
    `to` が CANCELLED 以外で `businessReason` を送った場合は 400(理由なき変更と取消の混同を防ぐ)。
- 楽観ロック: 現在 version が `expectedVersion` と一致しない場合は **409 + `RCV-0005`**
  (version conflict)。version は遷移ごとに単調増加する。
  冪等性は If-Match + expectedVersion の CAS が担い `Idempotency-Key` は要求しない
  (API-013 の update 規則 — 応答喪失後の再送は 409 で検出可能であり、GET /reception/queue で
  現在状態を確認して収束する)。
- 永続化: `version` / `status_changed_at` / `cancel_reason` 列は migration 000014 で追加する
  (WP-7201 phase 2。`reception_status` CHECK は 000002 で既に4値を包含し、CHECK 変更は不要)。
- 不許可遷移(逆行、終端後の遷移、WAITING→COMPLETED 等の表にない遷移)は **409 + `RCV-0004`**。
- レスポンス(200): `{ receptionId, receptionStatus, version, statusChangedAt }`。
  **patient(PHI)を含めない**ため、要求 scope は `reception:write` のみ(`patient:read` 併須は不要)。
- 副作用の原子性: 状態遷移・監査イベント記録・(将来 partner event 種別が登録された場合の)
  outbox intent は同一 transaction で commit する。部分成功レスポンスを返さない。
- 終端(COMPLETED/CANCELLED)の受付に対する server-saved draft write 拒否は DOM-004 §2 と
  既存 draft guard に委譲し、本 endpoint の応答へは影響しない。

## 3. 認可・テナント境界(API-003 準拠)

- **GET: `reception:read` + `patient:read` 併須 / POST: `reception:write` + `patient:read` 併須 /
  POST transitions: `reception:write` のみ**(応答が PatientSummary を含まないため併須不要 — 0.3.0)
  (requirePermission — deny-by-default)。ReceptionQueueEntry.patient は PHI(氏名・カナ・生年月日・
  患者番号・資格状態)を含むため、reception scope 単独では患者 PHI を読めない設計とする
  (codex 実装可能性レビューの指摘1を採用。POST もレスポンスに PatientSummary を返すため併須)。
- **PERMISSION_RESOURCES への `reception` 追加は実装済み**(WP-3009-BE/93aefa1。現行 15 リソース)。
  shared-kernel の追加+MOD-007 の改版は本契約 APPROVED と同一バッチで完了済み。
- UIX-001 §12 の SCR-001 仮 scope(patient:read)は本契約で reception:read + patient:read 併須へ置換する(台帳更新)。
- テナント境界拘束・PHI レスポンスの `Cache-Control: no-store`・平文ログ禁止は API-003 §2 に従う。

## 4. PatientSummary(患者表示情報 — 再利用)

`PatientSummary` は API-001 の `PatientSearchResult` と**同一形状・同一 zod オブジェクトを再利用**する
(patientId / name / kana / birthDate / sex / patientNumber / eligibilityStatus / eligibilityCheckedAt)。
契約ローカルの類似形状を新設しない(二重実装禁止)。資格確認状態を受付キュー時点でも隠さない(v0.2.0 §7)。

## 5. 受付状態(ReceptionStatus)

調査結果: shared-kernel / MOD-005 / DOM-004 に受付キュー専用の状態は現存しない
(DOM-004 の RECEIVED_PROVISIONAL 等は処方箋ライフサイクルの状態であり、キュー管理とは別概念)。

本契約が要求する最小 enum(**値の正本は shared-kernel — 契約ローカル定義禁止**):

| 値 | 意味 |
|---|---|
| WAITING | 受付済み・未着手 |
| IN_PROGRESS | 調剤・服薬指導等の対応中 |
| COMPLETED | 当日対応完了 |
| CANCELLED | 取消(エントリは削除せず保持 — P-12。取消理由の記録様式は会計・調剤系 SSOT に委譲) |

**実装状態: MOD-005(status_registry)の改版で `RECEPTION_STATUSES` を台帳追加し、
shared-kernel へ同一バッチで実装済み**(WP-3009-BE/93aefa1。CAL-007 が定める「新ステータスは SSOT 承認+MOD-005 改版後まで
実装コードへ追加禁止」の規律と同型 — 台帳と shared-kernel の原子的着地)。
未知状態の扱いは fail-closed(契約 parse で拒否)。キュー状態は請求可否判定(isClaimable)に関与しない。

## 6. エラー

- 400: 検証失敗の全ケース(date 欠落/形式不正/非実在暦日、patientId 不正、idempotencyKey 欠落/形式不正)→ `RCV-0001`(invalid reception request)
- 403: scope 不足(AUTH-0003、既存)
- 404: patientId が当該テナントに存在しない → `RCV-0002`(patient not found for reception)。テナント越え探索を許さない(存在有無の応答もテナント内に限定)。
- 404(0.3.1): transitions の対象 receptionId が当該テナント・薬局内に存在しない → `RCV-0006`(reception not found。非露出規則は RCV-0002 と同型)
- 409: idempotencyKey conflict(同一 key + 異なる patientId)→ `RCV-0003`(idempotency conflict)
- 409(0.3.0): 不許可遷移 → `RCV-0004`、version conflict → `RCV-0005`(MOD-006 への登録提案を含む)
- 503(0.3.3): queue 件数が cap(`RECEPTION_QUEUE_MAX_ENTRIES`)超過 → `RCV-0007`(queue bound exceeded)+ `nextAction`(MOD-006 0.1.6)
- **エラーコードの体系: domain は `RECEPTION`、code prefix は `RCV`**(「domain RCV」ではない — 現行 shared-kernel の ErrorDomain 体系に従い、MOD-006 に「RECEPTION domain は RCV prefix を使用する」旨を明記して登録済み)。`RCV-0001/0002/0003` は MOD-006 + shared-kernel KERNEL_ERROR_CODES へ登録済み(WP-3009-BE/93aefa1)。WP-4036 以降、registry 未登録 errorCode は契約 parse で fail-closed に落ちる。
- キュー0件は 200 + 空配列(エラーではない)。

## 7. 実装規律と着地順(DoR)

実装の着地順は次のとおりとし、各段の前提が揃うまで次へ進まない(原子的着地):

1. 本契約 v0.2.0 の APPROVED(完了)
2. **同一 WP で** MOD-007(PERMISSION_RESOURCES へ `reception` 追加)/ MOD-005(`RECEPTION_STATUSES` 4値の台帳追加)/ MOD-006(`RCV-0001/0002/0003` + RECEPTION domain の RCV prefix 明記)の各改版 **+** shared-kernel 実装(permissions.ts / status.ts / error-codes.ts / branded `ReceptionId` factory)(WP-3009-BE/93aefa1 で完了)
3. @yrese/contracts の schema 追加 + OpenAPI 生成(check:openapi ドリフト再生成)(WP-3009-BE/93aefa1 で完了)
4. apps/api(ReceptionRepository + routes)(WP-3009-BE/93aefa1 で完了)
5. apps/web(SCR-001 受付ダッシュボード)(WP-3009-UI)

- zod schema は @yrese/contracts に置き(単一契約 — API-002)、frontend は契約外フィールドを仮定しない。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由(API-001 §5 と同一)。
- 受付の登録・状態変更・取消は監査イベント対象(MOD-008 の文法に従う種別を実装 WP で台帳追加)。
  0.3.0 の遷移操作は 1 操作 = 1 監査イベント(`reception.started` / `reception.completed` /
  既存 `reception.cancelled`)を response 返却前に永続化する。
- fixtures は完全合成データのみ(MOD-013)。
- **本契約は APPROVED 後に実装する**。backend 側(shared-kernel / contracts / apps/api)は WP-3009-BE/93aefa1 で実装済み。frontend 側は WP-3009-UI の対象。

## 変更履歴

- 0.3.2 (2026-09-18): WP-7204 — `ReceptionQueueEntry.eligibility` を追加(API-019 の
  受付単位資格状態を queue entry が公開。サーバ導出の state / snapshotId /
  allowsProvisionalCalculation / allowsFinalCalculation のみで PHI 非含有の additive 変更)。
- 0.3.0 (2026-09-17): WP-7201 — 受付状態遷移 endpoint(§2 transitions)を追加。
  遷移表の正本は DOM-004 §2、CAS は expectedVersion + `If-Match` 併用、CANCELLED は
  businessReason 必須(MOD-008 `reception.cancelled` 規律)。エラーへ RCV-0004(不許可遷移)/
  RCV-0005(version conflict)、0.3.1 で RCV-0006(受付不存在)を追加。監査は
  `reception.started` / `reception.completed` の MOD-008 追加と対になる。
  既存 GET/POST の wire・認可・冪等規則は不変。
- 0.2.2 (2026-07-09): WP-4046 — `receptionId` / POST `patientId` の wire ID 検証を shared-kernel branded ID factory 由来の共通 refine へ統一。wire 型は string 維持。
- 0.2.1 (2026-07-09): WP-4049 実装状態 drift 整備。WP-3009-BE/93aefa1 による shared-kernel / contracts / OpenAPI / apps/api の backend 実装完了状態を反映。契約の要求・wire 形状は不変更。
- 0.2.0 (2026-07-09): codex 実装可能性レビュー(CONTRACT_REVIEW)の指摘5点+安定順序を反映 — GET/POST とも patient:read 併須、idempotencyKey 制約と 409/RCV-0003 の conflict 定義、domain RECEPTION / prefix RCV への訂正、shared-kernel 原子的着地の DoR 精緻化(リソース数14に訂正・ReceptionId factory 追加)、date の実在暦日検証、acceptedAt+receptionId の安定順序。
- 0.1.0 (2026-07-09): 初版起案(WP-3009 第一段階)。
