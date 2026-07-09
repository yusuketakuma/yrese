# patient_search_contract — 患者検索 API 契約

```yaml
ssot_id: API-001
title: 患者検索 API 契約(GET /patients/search)
domain: api
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
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

- `eligibilityStatus` は PatientHeader(実装済み)の EligibilityDisplayStatus と同一値集合。**検索結果の時点で資格確認状態を可視化**する(v0.1.7 §7: 外部確認未完了状態を隠さない)。
- PHI classification: レスポンスは PHI を含む。ログへの平文出力禁止(OPS-009)。correlation_id はヘッダで伝播。

## 4. エラー

- 400: `q` 不正(エラーコードは error_code_registry へ `PAT-0001` を登録して使用)
- 403: scope不足(AUTH-0003、既存)
- 検索0件は 200 + 空配列(エラーではない)

## 5. 実装規律

- zod schema を @yrese/contracts に置き、frontend は契約外フィールドを仮定しない(v0.1.7 §0.0.2.2)。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由。
- backend 実装(WP-2008)は PatientRepository インターフェース + インメモリ合成データ(MOD-013: PHI混入禁止・fixtures は合成のみ)。DB導入は data_model SSOT 承認後に差し替え。
- frontend 実装(WP-3003)は generated/contracts 型のみを参照。

## 6. 変更履歴

- 0.1.0 (2026-07-09): 初版起案。
