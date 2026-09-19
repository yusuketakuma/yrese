# dispensing_record_contract — 調剤記録 API 契約

```yaml
ssot_id: API-021
title: 調剤記録(DispensingRecord)API 契約(POST /dispensings, POST /dispensings/{id}/confirm)
domain: api
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - human_review_required
version: 0.1.2
created_at: 2026-09-19
updated_at: 2026-09-19
approved_at: 2026-09-19
approved_by: "direct human authority 2026-09-19 (残タスク一括許可 — 「残タスクをそのまま実装」); WP-7404 pre-review packet D-1〜D-9"
effective_from: 2026-09-19
effective_to: null
source_refs: [DOM-002 §5(Dispensing 集約), DOM-004 §1(DISPENSING_RECORDED 遷移と前提), MOD-008(dispensing.confirmed), API-012(dispense.confirmed), API-013(冪等性), SEC-010(資格ゲート), MOD-006(error code)]
depends_on: [DOM-002, DOM-004, MOD-005, MOD-006, MOD-008, MOD-009, API-012, API-013, SEC-010]
impacts: [packages/contracts, apps/api, migrations/000024]
related_work_packages: [WP-7404]
related_tests:
  - packages/contracts/src/dispensing.test.ts
  - apps/api/src/dispensing-routes.test.ts
  - apps/api/src/dispensing-service.test.ts
  - apps/api/src/db/dispensing-service.integration.test.ts
related_prs: []
evidence_ids: []
change_log:
  - "0.1.2 2026-09-19 WP-7404 R2/R3 review 反映: dispensedText の trim 後空文字は null 正規化(§2、DB XOR CHECK と整合)。規則変更でなく明確化"
  - "0.1.1 2026-09-19 WP-7404 R1 review 反映: §3 参照失敗の分岐(dispensed 側未存在=409 DSP-0004、確定版が参照する処方品目の不在=500 不変条件 breach)・resolved 行への free text は品目変更として変更可否必須、§5 confirm key の別 record 再利用は一意制約で DSP-0008・確認済みへの別 key 再送は DSP-0002 と明確化。規則変更でなく明確化。packet 承認根拠に準拠"
  - "0.1.0 2026-09-19 WP-7404 初版起案・確定。DOM-002 §5 を wire に写す最小構成(1 版 1 記録、全 rpItem カバー、後発品変更整合 check、確認後不変)。packet D-1〜D-9 は direct user instruction(残タスク一括許可)により承認済み"
open_questions:
  - 分割調剤(同一版への複数回調剤)の扱い — MVP では版単位一意。残薬調整は item 列の記録で表現
  - 調剤者と操作者が異なる記録(代行入力)の要否 — MVP は操作者=調剤者
  - 調剤録帳票(M7)との参照関係は帳票 WP で確定
blockers: []
```

## 1. 目的とスコープ

確定済み処方版(PRESCRIPTION_FINALIZED = `prescription_versions` 行の存在)に対する
**調剤実施記録**を append-only で作成し、薬剤師確認で `DISPENSING_RECORDED` へ
遷移させる。DOM-002 §5 の Dispensing 集約を wire に写す。

対象外: Web UI(WP-5113/§17 gate)、算定接続(WP-7501)、分割調剤の複数回記録、
調剤録帳票出力、record read API。

不変条件(DOM-002 §5・DOM-004 §1 を正本として wire に写す):

- 対象は確定処方**版**であり、draft や未確定処方への調剤は存在しない(複合 FK で
  `prescription_versions` 行の存在を強制)。
- 疑義照会が未解決(`status != RESOLVED` が1件でも存在)の処方への調剤記録作成は
  拒否する。訂正は処方側の新版(amend)経由であり、調剤記録の書き換えではない。
- 確認(`dispensing:confirm` + SEC-010 ACTIVE 資格)後の変更は禁止
  (items は常時 append-only、record は status 単方向遷移のみ)。
- 削除は行わない(REG-003【要確認: 保存期間】に従う保存前提の append-only)。

## 2. エンドポイント

### POST /dispensings

- scope: `dispensing:write`。Idempotency-Key header 必須(API-013
  `[A-Za-z0-9_-]{16,128}`)。
- body: `prescriptionId`、`prescriptionVersion`(≥1)、`dispensingDate`、
  `items[]`。item = `{ rpItemId, dispensedMedicationItemId XOR dispensedText,
  quantity, remainingStockAdjustment?, note? }`。
  `dispensedText` は trim 後の空文字を「未指定」として `null` に正規化する
  (item は必ず片方のみ有効 — `dispensedMedicationItemId` 併記時の空文字は
  無視され、単独の空文字は XOR 違反で 400 DSP-0005)。
- 成功 201 = record view(status null、confirmedBy/At null)。同一 key+同一 payload
  の replay は 200 で stored view を返す。同一 key+別 payload は 409 DSP-0008。
- error: 400 DSP-0005(入力不正・rpItem 集合の過不足/重複)、403 scope 不足、
  404 DSP-0003 系(prescription/version 不在 — scope 外も 404 で conceal)、
  409 DSP-0001(疑義未解決)/ DSP-0004(後発品変更整合不一致)/ DSP-0007(同一版の
  記録済み)。

### POST /dispensings/{dispensingId}/confirm

- scope: `dispensing:confirm` + SEC-010 ACTIVE `PHARMACIST_LICENSE`。
  資格判定は存在判定より先(scope 不足・資格欠落 → 403、deny 監査)。
- 成功 200: status=DISPENSING_RECORDED、同一 tx で `dispensing.confirmed` 監査 +
  outbox `dispense.confirmed`。
- Idempotency-Key 必須。同一 key replay → stored view 200、別 key → 409 DSP-0008、
  確認済み → 409 DSP-0002。

両 route とも `Cache-Control: no-store`、error body は固定文言で PHI 非含有。

## 3. 後発品変更の整合

`dispensedMedicationItemId` が処方 item の resolved `medicationItemId` と異なる場合:

1. source item の `genericSubstitutionPermitted === true` を必須とする
   (null/false は拒否 — 可否不明を許可へ倒さない)。
2. 処方品目・調剤品目双方の `genericNameCode` が非 null かつ一致を必須とする。
   参照は append-only master storage 全版(現行版解決ではない — 調剤在庫は
   旧版品目であり得る)。

違反は 409 DSP-0004。参照の置き方:

- `dispensedMedicationItemId`(client 指定の調剤品目)が master に存在しない
  → 比較不能で fail-closed の 409 DSP-0004。
- 確定版が参照する処方品目が append-only master storage から見つからない
  → 不変条件 breach で fail-closed の 500(200 系へ倒さない)。

free text(`dispensedText`)による調剤は unresolved 行では許容するが、
resolved 行への free text は品目変更(代替)とみなし
`genericSubstitutionPermitted === true` を要求する(変更可否不明を許可へ
倒さない — 違反は 409 DSP-0004)。

## 4. 監査・公開 event

- `dispensing.recorded`: create 成功。payload は dispensing ID + prescription ID +
  actorId のみ(品目・患者識別子は載せない)。
- `dispensing.confirmed`: confirm 成功(既存登録)。payload は dispensing ID +
  prescription ID + version + actorId。
- `dispensing.confirm.denied`: 資格/scope/ガード不一致の拒否。payload は
  dispensing ID + actorId のみ(理由内訳・免許情報は載せない)。
- outbox `dispense.confirmed`: aggregate_type='dispensing'、payload
  `{ prescriptionId, version }`。公開 event は API-012 catalog の最小 payload
  (dispense_id, prescription_id, version, confirmed_at — confirmed_at は
  occurredAt で充足)に対応。本文・患者識別子は載せない。

## 5. 一意性・冪等性

- (tenant_id, pharmacy_id, prescription_id, prescription_version) 一意
  — 1 版 1 調剤記録。訂正後の再調剤は amend 新版へ行う。
- create/confirm の Idempotency-Key は scope 内一意、replay 判定は
  完全 payload 一致(WP-7402/7403 と同規則)。confirm の key は別 record への
  再利用も一意制約で拒否(409 DSP-0008)。確認済み record への別 key 再送は
  冪等衝突ではなく lifecycle 遷移不可(409 DSP-0002)。
