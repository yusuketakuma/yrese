# patient_search_contract — 患者検索 API 契約

```yaml
ssot_id: API-001
title: 患者検索 API 契約(GET /patients/search)
domain: api
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: codex実装可能性レビュー(CONTRACT_CHANGE_REQUESTS 4件反映)+ fable5承認
source_refs: [DOM-002(患者集約), UIX-007(SCR患者検索), SEC-004(PIA), MOD-012(validation policy)]
depends_on: [DOM-001..004(PROPOSED — 本契約はR1-R2骨格範囲で先行、Phase 1ゲートで両者同時承認)]
impacts: [packages/contracts, apps/api, apps/web(WP-3003)]
```

## 1. 目的とスコープ

受付ダッシュボード・患者選択画面(SCR患者検索)のための患者検索。**MVPの最初の業務API**。
DBは未導入のため、実装はリポジトリインターフェース+インメモリ実装(合成データ)から始める(WP-2008)。

## 2. エンドポイント

`GET /patients/search?q=<string>&limit=<int>&cursor=<string>`

- 認可: `patient:read` scope 必須(requirePermission — deny-by-default)。tenantContext 必須。
- `q`: 1〜100文字。氏名(漢字)・カナ・患者番号の部分一致(検索アルゴリズムの詳細は実装側の自由。ただしカナ検索を必須サポート — 医療UI原則の取り違え防止)。
- `limit`: 1〜50、default 20。`cursor`: 不透明文字列(pagination)。

## 3. レスポンス(200)

```
{
  results: PatientSearchResult[],
  nextCursor?: string
}

PatientSearchResult = {
  patientId: string,          // branded PatientId
  name: string,               // 漢字氏名
  kana: string,               // カナ氏名(必須 — 取り違え防止)
  birthDate: string,          // YYYY-MM-DD
  sex: 'male' | 'female' | 'unknown',
  patientNumber: string,      // 薬局内患者番号
  eligibilityStatus: 'VERIFIED' | 'PENDING_REVERIFY' | 'LOCAL_ONLY_UNVERIFIED' | 'NOT_CHECKED',
  eligibilityCheckedAt?: string  // ISO datetime(未確認時なし)
}
```

- **契約の正本は @yrese/contracts の zod schema**(PatientSearchQuery / PatientSearchResponse / eligibilityStatus 値集合)。apps/web の PatientHeader は契約由来型へ適合させる(WP-3003)— contracts は apps に依存できないため(MOD-003)。
- `patientId` は wire 上は schema 検証済みの素の string とする。branded PatientId 化は backend/frontend の内部で行う(contracts → shared-kernel 依存は追加しない)。
- **検索結果の時点で資格確認状態を可視化**する(v0.1.7 §7: 外部確認未完了状態を隠さない)。
- PHI classification: レスポンスは PHI を含む。ログへの平文出力禁止(OPS-009)。correlation_id はヘッダで伝播。

## 4. エラー

- 400: **クエリ検証失敗の全ケース**(q 欠落/空白のみ/長さ超過、limit 範囲外、cursor 不正形式・境界不一致)→ `PAT-0001`(invalid patient search query)。`PAT-0001` は実装前に error_code_registry(MOD-006)と shared-kernel シードへ登録する。
- 403: scope不足(AUTH-0003、既存)
- 検索0件は 200 + 空配列(エラーではない)

## 5. 実装規律

- zod schema を @yrese/contracts に置き、frontend は契約外フィールドを仮定しない(v0.1.7 §0.0.2.2)。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由。
- backend 実装(WP-2008)は PatientRepository インターフェース + インメモリ合成データ(MOD-013: PHI混入禁止・fixtures は合成のみ)。DB導入は data_model SSOT 承認後に差し替え。
- **リポジトリ入力は tenantContext 由来の tenantId + pharmacyId を必須**とし、cursor は不透明・非PHI・(tenant, pharmacy, query) に拘束された値とする。境界不一致の cursor は 400 で安全に拒否し、**ページネーションがテナント/薬局境界を越えられない**ことをテストで固定する。
- PHI レスポンスには `Cache-Control: no-store` を付与。Fastify ログに PHI を出さない(OPS-009)。generated client パイプライン導入までは、frontend は @yrese/contracts の schema 由来型を直接 import する。
- frontend 実装(WP-3003)は generated/contracts 型のみを参照。

## 6. 変更履歴

- 0.2.0 (2026-07-09): codex 実装可能性レビューの CONTRACT_CHANGE_REQUESTS 4件+non-blocking 3件を反映して承認(契約正本化 / wire は素のstring / エラー網羅+PAT-0001 事前登録 / cursor のテナント境界拘束 / no-store / PHIログ禁止)。
- 0.1.0 (2026-07-09): 初版起案。
