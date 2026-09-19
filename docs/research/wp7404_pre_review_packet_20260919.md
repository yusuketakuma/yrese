# WP-7404 pre-review packet — 調剤記録(DispensingRecord)

- base: `3081183` (main、WP-7304 着地後)
- 正本: DOM-002 §5(Dispensing 集約)、DOM-004 §1(DISPENSING_RECORDED 遷移 + 前提)、MOD-008(dispensing.confirmed 既存 / dispensing.confirm.denied 登録候補)、API-012 webhook_event_catalog(`dispense.confirmed` 行)、SEC-010(資格ゲート)、API-013(Idempotency-Key)、MOD-006(error code)
- WP 記述: Plans.md WP-7404(phase 1【SSOT】contract 起案 / phase 2 migration 000024 / phase 3 routes / phase 4 Web は §17 gate で**本 packet 対象外**)

## 1. 目的

確定済み処方版(PRESCRIPTION_FINALIZED の `prescription_versions` 行)に対する
調剤実施記録を append-only で作成し、薬剤師確認で DISPENSING_RECORDED へ遷移させる。
確認は同一 tx で audit `dispensing.confirmed` + outbox `dispense.confirmed` を記録する。

## 2. エンドポイント

| route | scope | 備考 |
|---|---|---|
| `POST /dispensings` | `dispensing:write` | Idempotency-Key 必須(API-013 規則)。201 作成 |
| `POST /dispensings/{dispensingId}/confirm` | `dispensing:confirm` + SEC-010 ACTIVE `PHARMACIST_LICENSE` | Idempotency-Key 必須。200、`dispense.confirmed` outbox |

- 両 route で `Cache-Control: no-store`、strict schema、error body は PHI 非含有。
- GET は本 WP の対象外(record read API は WP-7501 算定配線側で検討)。

## 3. Request/response 契約

`POST /dispensings` body(`dispensingRecordCreateRequestSchema`):

```json
{
  "prescriptionId": "…",
  "prescriptionVersion": 1,
  "dispensingDate": "YYYY-MM-DD",
  "items": [
    {
      "rpItemId": "uuid",
      "dispensedMedicationItemId": "uuid|null",
      "dispensedText": "string|null",
      "quantity": "string",
      "remainingStockAdjustment": "string|null",
      "note": "string|null"
    }
  ]
}
```

- `dispensedMedicationItemId` / `dispensedText` は排他どちらか一方必須
  (unresolved 処方行への調剤は free-text 記録で表す。fail-open で itemId 省略を
  許さない)。
- `items` は source version content の全 rpItem を**ちょうど1回**カバーする
  (過不足・重複は 400 DSP-0005)。分割調剤の部分調剤は本 WP 対象外。
- response = record view(`dispensingId`, identity refs, `status: null`,
  items echo、`confirmedBy/At: null`、`copiedFrom` 類の provenance なし)。

`POST /dispensings/{dispensingId}/confirm` body は空 object(署名は header key)。

## 4. 不変条件・ガード

create(`dispensing:write`):

1. reception/qualification 系 guard なし — 資格は confirm 側で要求
   (WP-7402 と同じ「記録は write scope、確定は confirm scope+資格」の分離)。
2. prescription が scope 内に存在しない → 404(`prescription:*` と同じ conceal 規則)。
3. `prescription_versions` に (prescription, version) が存在しない → 404。
   **存在は finalized の証明として使う**(version 行は finalize tx でのみ作られる)。
4. 同一 prescription の inquiry に `status != 'RESOLVED'` が1件でもあれば
   → 409 `DSP-0001`(疑義未解決。DOM-004 §1 前提条件)。
5. 同一 (prescription, version) の dispensing が既にあれば → 409 `DSP-0007`
   (一意 index が backstop)。訂正後の再調剤は amend 新版(v≥2)へ行う。
6. items の rpItemId 集合 = source version content の rpItemId 集合、
   重複なし(400 DSP-0005)。
7. 後発品変更整合: `dispensedMedicationItemId` が処方 item の resolved
   `medicationItemId` と異なる場合、
   - source item の `genericSubstitutionPermitted === true` でない → 409 DSP-0004;
   - 処方品目・調剤品目双方の `genericNameCode` が非 null で一致しない → 409 DSP-0004。
   いずれの lookup も append-only master storage の全版を対象(現行版解決ではない。
   調剤時点の在庫品目が旧版にしか存在し得るため)。
8. item 単位の `dispensedBy` は省略し `actorId` を調剤者として記録
   (MVP は操作者=調剤者。別人記録は後続 WP)。

confirm(`dispensing:confirm` + SEC-010):

- 資格判定を存在判定より先に評価(WP-7403 と同順序): scope 不足 → 403、
  資格 evidence 欠落/REVOKED → 403 + `dispensing.confirm.denied` 監査
  (payload は dispensing ID+actorId のみ)。
- record 不在 → 404、確認済み → 409 `DSP-0002`(status != null)。
- Idempotency-Key replay: 同一 key+同一(payload なし= id のみ)→ stored view 200;
  別 key → 409 `DSP-0008`。

## 5. Migration `000024`

`dispensing_records`:

- PK (tenant_id, pharmacy_id, dispensing_id)
- prescription_id + prescription_version + 複合 FK → `prescription_versions`
  (tenant,pharmacy,prescription,version) — 確定版のみ参照可能を DB で強制
- dispensing_date DATE NOT NULL
- status TEXT NULL | 'DISPENSING_RECORDED'(単方向 trigger で null→値のみ)
- idempotency_key TEXT NOT NULL + UNIQUE(tenant,pharmacy,idempotency_key)
- confirm_idempotency_key TEXT NULL
- confirmed_by/at NULL、created_by/at、updated_*
- UNIQUE(tenant_id, pharmacy_id, prescription_id, prescription_version)
  — 1 版 1 調剤記録(分割調剤は対象外、残薬調整は item 列で表現)

`dispensing_items`(append-only、UPDATE/DELETE/TRUNCATE 拒否 trigger):

- PK (tenant_id, pharmacy_id, dispensing_id, rp_item_id)
- 複合 FK → dispensing_records
- rp_item_id TEXT(uuid 文字列、content 内 ID をそのまま記録)
- prescribed_medication_item_id TEXT NULL(source が unresolved の場合)
- dispensed_medication_item_id TEXT NULL / dispensed_text TEXT NULL
  + CHECK 排他どちらか一方
- quantity TEXT NOT NULL(記録値 — 数値化しない、DOM-002 §4.2b 規則踏襲)
- remaining_stock_adjustment TEXT NULL / note TEXT NULL / dispensed_by TEXT NOT NULL

outbox: `outbox_events_aggregate_type_allowed` CHECK に `'dispensing'` 追加 +
`outbox_events_aggregate_exists()` に dispensing_records 存在検証 branch 追加
(000020 と同じ置き換え規則)。

## 6. Audit / outbox

- create: `dispensing.recorded`(MOD-008 registry へ新規登録 — payload は
  dispensing ID+prescription ID+actorId のみ)。
- confirm 成功: `dispensing.confirmed`(既存)。同一 tx で outbox
  `dispense.confirmed`(aggregate_type='dispensing'、aggregate_id=dispensing_id、
  payload `{version, prescriptionId}` — catalog の最小 payload
  dispense_id/prescription_id/version/confirmed_at は envelope+field で充足)。
- confirm 拒否: `dispensing.confirm.denied`(SEC-010 §4 登録候補を本 WP で登録)。
- `PARTNER_EVENT_TYPES` に `dispense.confirmed` 追加、
  `dispenseConfirmedPartnerEventSchema`(aggregate{type:'dispensing'} +
  prescriptionId + version)。PARTNER_EVENT_FORBIDDEN_KEYS は不変。
- `projectPayloadFields` を dispense.confirmed へ拡張(version + prescriptionId
  必須、欠損は fail-closed)。

## 7. Error codes(MOD-006 へ登録、domain DISPENSING)

| code | 用途 |
|---|---|
| DSP-0001 | 疑義照会未解決の処方への調剤(409) |
| DSP-0002 | dispensing lifecycle transition 不可(既確認等、409) |
| DSP-0003 | dispensing record が scope 内に存在しない(404) |
| DSP-0004 | 後発品変更の整合不一致(一般名コード不一致/変更可否=非許可、409) |
| DSP-0005 | 不正な dispensing 入力(rpItem 過不足・排他違反等、400) |
| DSP-0006 | (予約) |
| DSP-0007 | 同一処方版への重複調剤記録(409) |
| DSP-0008 | idempotency-key 別 payload replay(409) |

## 8. 設計決定

| D | 決定 | 根拠 |
|---|---|---|
| D-1 | route 形 `POST /dispensings` + `/{id}/confirm` | Plans.md phase 3 |
| D-2 | 1 版 1 調剤記録(版単位一意) | DOM-002 §5「対象 prescription version」。分割調剤は対象外 |
| D-3 | items は全 rpItem ちょうど1回 | 記録漏れ fail-closed |
| D-4 | 変更可否=source item の genericSubstitutionPermitted、一般名=genericNameCode 一致 | WP 受入「一般名/変更可否の整合 check」 |
| D-5 | dispensed は resolved id or free text 排他必須 | unresolved 処方行への実施記録を許すが fail-open にしない |
| D-6 | 資格チェックは confirm のみ、存在判定より先 | SEC-010/WP-7403 順序 |
| D-7 | 監査 dispensing.recorded 新規 + confirmed 既存 + confirm.denied 登録 | MOD-008 規則 |
| D-8 | Web UI 対象外(WP-5113/§17 gate) | Plans.md phase 4 |
| D-9 | GET 不設置 | WP scope 外。算定側 read は WP-7501 |

承認根拠: direct user instruction(「残タスクをそのまま実装」+ 継続する一括許可)。

## 9. テスト計画

- contracts: request schema 排他/bounds、partner event schema、error code 登録。
- in-memory service: create guard 全件(not_found/unresolved inquiry/dup/item 集合/
  generic mismatch)、confirm lifecycle、idempotency replay、監査順序。
- route: scope 403、SEC-010 deny、400/404/409 mapping、no-store。
- PG integration: 単一 tx(監査+outbox+status)、append-only trigger、複合 FK、
  UNIQUE 重複、concurrent confirm、poolMax=1。

## 10. 実装状況

- contracts: `packages/contracts/src/dispensing.ts`(strict request/view schema、
  item 排他・200 件上限・quantity は文字列のみで数値解釈しない)、
  `dispense.confirmed` partner event(識別子+version のみ)、DSP-0001〜0008 登録、
  監査 `dispensing.recorded`/`dispensing.confirmed`/`dispensing.confirm.denied` 登録。
- migration: `000024_dispensing_records.sql`(dispensing_records/dispensing_items、
  1 版 1 記録 UNIQUE、append-only trigger、status NULL→DISPENSING_RECORDED のみ、
  outbox aggregate_type に `dispensing` 追加)。`yrese_dev` 適用済み(24/24)。
  ※ dev DB で `lifecycle_append_only_guard()` が未存在の drift があったため、
  migration 内で関数を再定義する自己完結形とした。
- in-memory: `apps/api/src/dispensing-service.ts`(guard 順序 packet §4、
  create 冪等・confirm 冪等 replay、資格→存在判定順序)。
- PG: `apps/api/src/db/dispensing-service.ts`(全 read/write を単一 tx client へ
  束縛 — master read も client 束縛 adapter 経由、status+audit+outbox を 1 tx、
  create replay は JSONB `=` 等値比較)。
- routes: `POST /dispensings` + `POST /dispensings/{id}/confirm`
  (dispensing:write / dispensing:confirm + SEC-010、no-store、Idempotency-Key 必須)。
- outbox projection: `dispense.confirmed` を識別子+version へ投影、
  payload 欠損は fail-closed。
- 検証: API 1,372 PASS(実 PG・skip 0、新規 PG integration 14 件)、
  workspace 全 package PASS、typecheck、OpenAPI drift、SSOT index(191 件)、
  boundaries/secrets/deps/sbom/calculation-purity/scripts 全 PASS。

### 独立 review

fresh-context read-only reviewer で frozen-diff review を 4 ラウンド実施
(Oracle Pro 経路はアカウント側で不可のため WP-7403 と同じ代替経路)。

- R1(diff 初版): **FAIL — 5M/7L**。対応:
  - F-1: confirm 済み+別 key → `invalid_transition`(DSP-0002)へ統一
    (WP-7402/7403 規則)。別 record での key 再利用のみ DSP-0008。
  - F-2: INSERT の 23505 は rollback → retry で committed winner を
    replay/duplicate/conflict として再評価(raw 500 を防ぐ)。
  - F-3: TOCTOU — PG は `prescription_drafts FOR UPDATE` で inquiry 記録と
    直列化、in-memory は draft lock 下で guard+write。
  - F-4: scope 配列 get-or-create + scope 全体で key 一意。
  - F-5: 確定版が参照する処方品目の master 不在は不変条件 breach → 500
    (dispensed 側未存在は 409 DSP-0004 のまま)。
  - F-6/F-7/F-8/F-11: item strict schema、`updated_by` NOT NULL+CHECK、
    `create_request` 不変化を transition guard に追加、confirm key UNIQUE。
  - F-9: view items を rpItemId 順に正規化(両実装)。
  - F-10: resolved 行への free text は品目変更として変更可否必須(DSP-0004)。
  - F-12: UUID 大小文字比較は fail-closed 方向の既知 edge として記録。
- R2(sha256 `30f47ed0`、5,495 行): **FAIL — 2M/3L**。対応:
  - F-1: `dispensedText` trim 後空文字は schema で `null` 正規化
    (id 併記時の DB XOR CHECK 違反 500 / in-memory での不変条件違反受理を解消)。
  - F-2: PG guard 5 で winner 行の key+payload を再比較 — 並行 same-key create
    が `already_recorded` に倒れず replay/conflict を返す。
  - F-3: in-memory lock を scope 全体へ拡大(check-then-set 原子化、
    PG の scope 内 UNIQUE と同規則)。
  - F-4: in-memory replay 比較を canonical JSON(キー順正規化)へ
    (JSONB `=` parity)。
  - F-5: localeCompare → バイト順比較(C collation と一致)。
- R3(sha256 `6e0eb69e`、5,608 行): **FAIL — 2L(実装欠陥なし)**。対応:
  - F-1: DSP-0004 `requiresHumanReview` を registry(MOD-006 正本)の
    `false` に揃えた(code 側の true を修正)。
  - F-2: 空文字→null 正規化を API-021 §2 へ記載(version 0.1.2)。
  - 検証項: 000024 は最終編集後に適用済みで checksum 一致(drift なし)。
- R4(sha256 `9927d62a`、5,612 行): **PASS** — R3 修正確認・新規欠陥 0。
