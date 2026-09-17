# coverage_contract — 保険・公費(Coverage)登録 API 契約

```yaml
ssot_id: API-020
title: 保険・公費(Coverage)登録 API 契約(GET/POST /patients/{patientId}/coverage)
domain: api
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - claims_evidence_specialist
  - human_review_required
version: 0.1.0
created_at: 2026-09-17
updated_at: 2026-09-17
approved_at: 2026-09-17
approved_by: "direct human authority 2026-09-17 (SSOT batch 一括 APPROVE); independent review: Devin in-session primary-source cross-check (Oracle 不使用), findings closed in PROPOSED revisions"
effective_from: 2026-09-17
effective_to: null
source_refs: [DOM-002 §3(Coverage 集約), DOM-004 §3, ADP-004 §2(EligibilitySnapshot との分界), MOD-007(insurance/public-expense resource), MOD-008(insurance.* 監査種別), MOD-011(日付), API-013(冪等性), UIX-001 §12]
depends_on: [DOM-002, DOM-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-011, API-001, API-003]
impacts: [packages/contracts, apps/api, apps/web(患者コンテキスト rail の保険タブ)]
related_work_packages: [WP-7203]
related_tests:
  - packages/contracts/src/coverage.test.ts(予定)
  - apps/api/src/coverage-routes.test.ts(予定)
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-09-17 WP-7203 初版起案(PROPOSED)。InsuranceCard / PublicExpense の append-only 履歴登録のみ。負担割合の計算・算定入力への接続は CAL-R-024 BLOCKED の範囲外として含めない。review と human approval まで実装根拠にしない"
  - "0.1.0 2026-09-17 独立 review(Devin in-session、Oracle 不使用)訂正: Idempotency-Key を API-013 の `[A-Za-z0-9_-]{16,128}` 規則へ揃え、一意性境界に patientId を含め、冪等記録の永続化(migration 000016)を明記"
  - "0.1.0 2026-09-17 finalization: 独立 review 反映済み本文のまま direct human approval(SSOT batch 一括 APPROVE)により PROPOSED→APPROVED。承認範囲は SSOT 策定のみで、migration 000016 適用・実装完了・production action を含まない。API_CONTRACT_BLOCKED は昇格により解除、CAL-R-024(算定利用は範囲外)は据え置き"
open_questions:
  - 公費の優先順位・併用組合せの決定根拠は evidence_id 必須(DOM-002 §3【要確認】と同期)。本契約は順位の**記録**のみを扱い、順位の正しさの判定規則は算定 SSOT 側に残す
  - InsuranceCard の「本人/家族」区分と被保険者・被扶養者の詳細粒度(続柄等)の必要範囲
blockers:
  - CAL-R-024 BLOCKED: 負担割合・公費の**算定利用**は本契約の範囲外(入力値の記録のみ)
```

## 1. 目的とスコープ

患者ごとの CoverageProfile(DOM-002 §3)を構成する **InsuranceCard 履歴**と
**PublicExpense 履歴**の登録・参照契約。受付・資格確認(API-019)・算定への入力となる
事実の記録であり、**算定・負担割合計算・請求生成は本契約の対象外**である。

不変条件(DOM-002 §3 を正本として wire に写す):

- 履歴は **append-only**。訂正・失効は新規行による supersede であり、UPDATE/DELETE しない。
- 同一患者の InsuranceCard 同士で**有効期間が重ならない**(同時有効な被保険者証は 1 枚)。
  PublicExpense は複数併用し得るが**優先順位の重複を許さない**。
- 負担割合・優先順位は**入力値の記録**であり、本契約は計算も妥当性の制度判定もしない。

## 2. エンドポイント

### GET /patients/{patientId}/coverage?asOf=YYYY-MM-DD

- `asOf` は**必須**(暗黙の「今日」をサーバーで解決しない — MOD-011 / API-006 と同型)。
- レスポンス(200):

```
{
  patientId: string,
  asOf: string,
  insuranceCards: InsuranceCard[],
  publicExpenses: PublicExpense[]
}

InsuranceCard = {
  insuranceCardId: string,
  insurerNumber: string,        // 保険者番号
  insuredSymbol: string,        // 被保険者記号
  insuredNumber: string,        // 被保険者番号
  branchNumber?: string,        // 枝番
  relationship: 'self' | 'family',
  copayRatio: number,           // 負担割合(入力値。0 < r < 1)
  validFrom: string,            // YYYY-MM-DD
  validTo: string | null,       // null = 無期限/現在有効
  supersededBy: string | null,  // 後続行の insuranceCardId
  recordedAt: string
}

PublicExpense = {
  publicExpenseId: string,
  payerNumber: string,          // 負担者番号
  recipientNumber: string,      // 受給者番号
  priority: number,             // 優先順位(1 始まり)
  validFrom: string,
  validTo: string | null,
  supersededBy: string | null,
  recordedAt: string
}
```

- `asOf` 時点で有効(validFrom ≤ asOf かつ validTo が null または asOf < validTo)な行だけを返す。
  **全履歴の閲覧は `asOf` なしでは提供しない**(範囲外閲覧の制限 — PHI 最小化)。
  履歴全体の監査的参照が必要な場合は監査系 route の別契約で扱う。
- unknown/cross-tenant の patientId は 404 `PAT-0002` と同型の非露出規則(存在を漏らさない)。

### POST /patients/{patientId}/coverage

- ヘッダ: **`Idempotency-Key` 必須**。形式・検証は API-013 の規則に従う
  (opaque、`[A-Za-z0-9_-]{16,128}`、非適合は 400。key を log・metric label・raw error に出さない)。
  一意性境界は (tenantId, pharmacyId, patientId, idempotencyKey)。冪等判定の authority は
  永続化された (key → request fingerprint + 行 ID) 記録であり、migration 000016 に
  coverage 冪等記録を含める(reception_entries / patients の方式と同型)。
  同一 key + 同一 payload → 既存行を 200 で返す。同一 key + 異なる payload → 409 `INS-0006`。
- ボディ(discriminated union):

```
{ kind: 'insurance-card', insurerNumber, insuredSymbol, insuredNumber, branchNumber?,
  relationship, copayRatio, validFrom, validTo? }
| { kind: 'public-expense', payerNumber, recipientNumber, priority, validFrom, validTo? }
| { kind: 'supersede', targetKind: 'insurance-card'|'public-expense', targetId, ...新行の項目 }
```

- `validFrom`/`validTo` は実在暦日、`validTo` は `validFrom` 以降または省略(null)。
- **検証(409 で拒否 — fail-closed)**:
  - insurance-card: 既存の非 supersede 済み行と有効期間が重なる → `INS-0003`。
    (重なりを残したまま追加するには、先行行を `supersede` で閉じる — 変更は新版のみ)
  - public-expense: 同一患者で `priority` が重複し、かつ有効期間が重なる → `INS-0004`。
  - supersede 対象が存在しない・既に supersede 済み → `INS-0005`。
- レスポンス(201 / 冪等再送時 200): 登録された行(上記 shape)。
- 監査: MOD-008 既存種別 `insurance.updated`(記録操作)/ `insurance.viewed`(GET)を
  response 返却前に永続化。payload は行 ID と kind のみ — **保険者番号・記号番号・
  受給者番号等の資格内容を監査 payload に入れない**。

## 3. 認可・テナント境界(API-003 準拠)

- **GET: `insurance:read` + `patient:read` 併須**(response に insurance + public-expense の
  双方を含むため `public-expense:read` も併須とする — いずれか欠ける scope では 403)。
- **POST: `patient:read` に加え、kind 別の write scope** — `kind: 'insurance-card'` は
  `insurance:write`、`kind: 'public-expense'` は `public-expense:write`、`kind: 'supersede'` は
  `targetKind` に対応する write scope(MOD-007 の既存 resource、registry 改版不要)。
- tenant/pharmacy 境界・`Cache-Control: no-store`・平文ログ禁止は API-003 §2 に従う。

## 4. エラー

- 400: 検証失敗(asOf 欠落/非実在暦日、必須項目欠落、copayRatio 範囲外、Idempotency-Key 不正)→ `INS-0001`
- 403: scope 不足(AUTH-0003、既存)
- 404: patientId が tenant/pharmacy 内に存在しない → `INS-0002`(PAT-0002 と同一の非露出規則)
- 409: 期間重複(`INS-0003`)/ 優先順位重複(`INS-0004`)/ supersede 対象不存在・二重(`INS-0005`)/ idempotency conflict(`INS-0006`)— いずれも MOD-006 へ登録提案

## 5. 実装規律

- zod schema は @yrese/contracts に置き(単一契約 — API-002)。OpenAPI 生成と check:openapi に従う。
- 永続層は migration(000016 予定)で `insurance_cards` / `public_expense_certificates`
  (append-only、`superseded_by` 参照、UPDATE/DELETE は trigger で拒否 — eligibility_snapshots
  の `block_mutation` trigger と同型)を追加する。
- Web 側は患者コンテキスト rail の保険タブ(UIX-001)から GET/POST を呼ぶ。
  負担割合・公費が算定へ渡る経路は本契約に含めない(CAL-R-024)。
- fixtures は完全合成データのみ(MOD-013)。実在の保険者番号・受給者番号を fixture に使わない。

## 変更履歴

- 0.1.0 (2026-09-17): WP-7203 初版起案(PROPOSED)。
