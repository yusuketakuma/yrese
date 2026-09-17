# eligibility_snapshot_contract — 受付資格確認スナップショット API 契約

```yaml
ssot_id: API-019
title: 受付資格確認スナップショット API 契約(POST/GET /reception/{receptionId}/eligibility-snapshots)
domain: api
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_review_required
version: 0.1.0
created_at: 2026-09-17
updated_at: 2026-09-17
approved_at: 2026-09-17
approved_by: "direct human authority 2026-09-17 (SSOT batch 一括 APPROVE); independent review: Devin in-session primary-source cross-check (Oracle 不使用), findings closed in PROPOSED revisions"
effective_from: 2026-09-17
effective_to: null
source_refs: [ADP-004 §2/§3/§6(資格確認境界・状態機械), DOM-002 §3(EligibilitySnapshot), DOM-004 §3, MOD-005 §2.2(状態・方式 enum), MOD-008 §1.2(eligibility.* 監査種別), API-006(受付 context 様式), MOD-011(日付・時刻), API-013(冪等性)]
depends_on: [ADP-004, DOM-002, DOM-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-011, API-003, API-006]
impacts: [packages/contracts, apps/api(eligibility-snapshot-repository 既存の route 配線), apps/web(受付行・patient-header の資格表示切替)]
related_work_packages: [WP-6303, WP-6304, WP-7204]
related_tests:
  - apps/api/src/db/eligibility-snapshot-repository.integration.test.ts
  - packages/shared-kernel/src/eligibility.test.ts
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-09-17 WP-7204 初版起案(PROPOSED)。手動記録 route のみ。外部 IF(ONS)接続は RB-002 により本契約の対象外。review と human approval まで実装根拠にしない"
  - "0.1.0 2026-09-17 独立 review(Devin in-session、Oracle 不使用)訂正: (a) repository が要求する遷移導出の業務日付 `asOfDate` を body へ追加(MOD-011 の明示日付権威)、`recorded_by`/`created_at` は認証 context・サーバー時計由来と明記 (b) GET の read 監査を `insurance.viewed` に確定(要確認を解消) (c) ADP-004 §4 の『結果不変の再確認 = 監査 event のみ』経路は WP-7702 側契約へ明示 defer (d) snapshotId の wire 検証水準・終端受付への記録可否を明記 (e) depends_on に API-006/MOD-006 を追加"
  - "0.1.0 2026-09-17 finalization: 独立 review 反映済み本文のまま direct human approval(SSOT batch 一括 APPROVE)により PROPOSED→APPROVED。承認範囲は SSOT 策定のみで、実装完了・外部接続・production action を含まない。API_CONTRACT_BLOCKED は昇格により解除、BLOCKED_REGULATORY_REVIEW(RB-002)は据え置き"
open_questions:
  - OFFLINE_PROVISIONAL(method NONE)を手動 route から記録できるか。現行案は資格確認端末/システム側の記録経路のみとし、手動記録は VERIFIED_CARD / PROVISIONAL_VISUAL に限定
  - 資格確認端末(別 PC)で実施したオンライン確認の記録証跡(端末側受付番号等)を snapshot に持つかは ONS 仕様入手後に決める
blockers:
  - BLOCKED_REGULATORY_REVIEW: RB-002(オン資外部 IF 仕様未入手)により `VERIFIED_MYNA` 記録と外部連携は対象外
```

## 1. 目的とスコープ

受付 1 件に紐づく **EligibilitySnapshot**(DOM-002 §3、ADP-004 §2)を API 越しに記録・参照する
最小契約。永続層(`eligibility_snapshots` + `reception_entries.eligibility_snapshot_id`、
migrations 000009/000011)と状態機械(`@yrese/shared-kernel` eligibility.ts)は既に実装済みであり、
本契約はその **route 配線**だけを定める。

対象外(明示):

- オンライン資格確認の外部 IF 呼出し(RB-002 — 公式仕様未入手)。
- 薬剤情報・特定健診情報の閲覧(ADP-004 §5、BLOCKED_PRIVACY_REVIEW)。
- 患者要約 `patients.eligibility_status`(API-001 §4 の別概念。本契約は受付単位状態だけを扱う)。

## 2. エンドポイント

### POST /reception/{receptionId}/eligibility-snapshots

手動記録可能な確認は **券面系のみ**:

| verifiedMethod | state | 意味 |
|---|---|---|
| CARD_ONLINE | VERIFIED_CARD | 資格確認端末等でオンライン確認を実施済みであることの記録(yrese は確認自体を行わない) |
| CARD_VISUAL | PROVISIONAL_VISUAL | 券面目視のみ(オンライン確認不能・未実施) |

- `VERIFIED_MYNA` / `MYNA_ONLINE` は外部 IF 由来に限定し、本 endpoint では **422** で拒否する
  (RB-002)。`EXPIRED` / `MISMATCH` / `OFFLINE_PROVISIONAL` も手動記録不可(422)—
  これらはシステム遷移・再確認・degraded mode 由来の状態であり、人手で宣言しない。
- ボディ:
  `{ snapshotId: string, verifiedMethod, state, verifiedAt: ISO datetime, asOfDate: 'YYYY-MM-DD', validFrom: 'YYYY-MM-DD', validTo?: 'YYYY-MM-DD' | null }`
  - `snapshotId` はクライアント生成の不透明 ID(UUID 等)であり、**冪等キーを兼ねる**。
    wire 検証は wire-id 水準(非空・空白のみ拒否・制御文字拒否・最大128文字)。
    同一 snapshotId + 同一 payload の再送 → 既存 snapshot を 200 で返す。
    同一 snapshotId + 異なる payload → **409**(snapshot は append-only、上書きしない)。
  - `verifiedMethod` と `state` の整合は `isEligibilityMethodConsistent` の規則どおり
    (不一致は 400)。`validFrom`/`validTo` は実在暦日(`validTo` は `validFrom` 以降または null)。
  - `asOfDate` は遷移元状態の導出に使う**明示の業務日付**(MOD-011 — サーバーは暗黙の
    「今日」を使わない。repository の `deriveEligibilityState` が要求する入力であり、
    通常は当該受付の `business_date` と一致させる)。
  - `recorded_by` は認証済み actor(tenantContext)からサーバー側で導出し、
    `created_at` はサーバー時計。いずれも request body に受け取らない。
- 患者は受付からサーバー側で導出する。request body に patientId を受け取らない
  (DOM-002 §4.1 の受付 context 規律と同型)。受付が tenant/pharmacy 内に存在しない場合は 404。
- 状態遷移は ADP-004 §3 の遷移表(`isEligibilityTransitionAllowed`)に従う。現在の受付状態から
  表にない遷移は **422** で拒否する(例: `EXPIRED` 受付への VERIFIED_CARD 記録)。
  同一 state の再記録(VERIFIED_* → 同じ VERIFIED_*)は遷移表にないため 422 —
  **ADP-004 §4 の「結果不変の再確認は新 snapshot を作らず監査 event のみ」の規律と整合する**
  (監査 event のみの再確認記録 route は請求前点検工程(WP-7702)側の契約で扱い、
  本契約の対象外とする)。
- snapshot の記録可否を受付の業務状態(WAITING/IN_PROGRESS/終端)で制限しない —
  append-only の事実記録であり、取消済み受付への記録も実施済み確認の証跡として残る。
- レスポンス(201 / 冪等再送時 200): `{ snapshotId, receptionId, state, verifiedMethod, verifiedAt, validFrom, validTo, derivedState }`。
  `derivedState` は記録後の受付単位資格状態。保険者番号・記号番号等の資格内容は
  応答に含めない(`raw_response_ref` は不透明参照のみ、wire には出さない)。

### GET /reception/{receptionId}/eligibility-snapshots

- レスポンス(200): `{ receptionId, current: ReceptionEligibility, snapshots: EligibilitySnapshot[] }`
  - `current` = `{ state, snapshotId | null, allowsProvisionalCalculation, allowsFinalCalculation }`。
    snapshot なしの受付は `state: "UNVERIFIED", snapshotId: null`。
  - `snapshots` は `sequence_number` 降順(新しい順)。append-only のため削除・更新は存在しない。
- 受付が存在しない場合は 404(tenant 越え探索を許さない)。

## 3. 認可・テナント境界(API-003 準拠)

- **POST: `insurance:write` + `reception:read` 併須 / GET: `insurance:read` + `reception:read` 併須**
  (requirePermission — deny-by-default)。snapshot は受付集約に属し、資格情報は insurance
  resource に分類する(MOD-007 の既存 resource、registry 改版不要)。
- tenant/pharmacy 境界、PHI 応答の `Cache-Control: no-store`、平文ログ禁止は API-003 §2 に従う。

## 4. 監査(MOD-008 §1.2 の既存種別)

- POST 成功時は `eligibility.verified`(state=VERIFIED_*)または `eligibility.provisional_recorded`
  (PROVISIONAL_VISUAL)を response 返却前に永続化する。targetRef は `eligibility_snapshot`、
  payload は snapshot_id・verified_method・状態のみ(保険者番号等の資格内容は載せない)。
- GET は MOD-008 既存種別 `insurance.viewed` を発火する(snapshot は insurance resource
  配下の資格確認記録であり、資格内容本文を含まなくても資格状態の閲覧自体を追跡可能にする
  — 0.1.0 独立 review で `external_record.viewed` ではなく本種別に確定)。
  payload は reception_id・snapshot 件数のみ(状態値・資格内容は載せない)。

## 5. エラー

- 400: 検証失敗(snapshotId/verifiedMethod/state/日付形式、method-state 不整合)→ 既存 PAT/RCV 系ではなく
  新規 `INS-0007`(invalid eligibility request)を MOD-006 へ登録提案。
- 403: scope 不足(AUTH-0003、既存)。
- 404: reception が tenant/pharmacy 内に存在しない → `INS-0008`(登録提案)。
- 409: 同一 snapshotId + 異なる payload → `INS-0009`(snapshot conflict。登録提案)。
- 422: 手動記録不可の状態/方式(VERIFIED_MYNA 等)、または ADP-004 §3 遷移表にない遷移 → `INS-0010`(登録提案)。

## 6. 実装規律

- zod schema は @yrese/contracts に置き(単一契約 — API-002)。OpenAPI 生成と check:openapi に従う。
- `allowsFinalCalculationForEligibility` / `allowsProvisionalCalculationForEligibility` の判定は
  shared-kernel guard を唯一の実装とし、UI 側で再実装・推測表示しない(ADP-004 §6)。
- 実装は既存 `PostgresEligibilitySnapshotRepository` / in-memory 同型の route 配線に限定し、
  リポジトリの冪等 retry・conflict・遷移表の検証を route 層テストで貫通する。
- fixtures は完全合成データのみ(MOD-013)。資格内容(保険者番号等)の fixture を作らない。

## 変更履歴

- 0.1.0 (2026-09-17): WP-7204 初版起案(PROPOSED)。手動記録 route のみ。
