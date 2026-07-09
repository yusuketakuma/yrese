# エージェント担当マトリクス

```yaml
ssot_id: AGT-013
title: エージェント担当マトリクス
domain: agents
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: null
source_refs:
  - 構築プロンプト v0.1.7 §0.1.6.18.2, §0.1.3.4
depends_on:
  - docs/agents/agent_routing_policy.md
  - docs/agents/dual_lane_raci_matrix.md
impacts:
  - docs/agents/agent_review_pairing_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - 実環境モデルID(opus4.8/sonnet5/haiku4.5/Codex)確定後、本マトリクスの担当名を actual_model_id と紐づける(llm_capability_registry.md 参照)【要確認】
blockers: []
```

## 1. 担当マトリクス(タスク種類別)

| タスク種類 | implementation_layer | 主担当 | 実行モード | 副担当 | レビュー | 備考 |
|---|---|---|---|---|---|---|
| MVP/非MVP定義 | ssot | fable5 | claude_code_ultracode | opus4.8 | 人間レビュー候補 | Codexは参照のみ |
| 法令適合性SSOT | ssot | fable5 | claude_code_ultracode | opus4.8 | 人間レビュー候補 | Codexに最終判断させない |
| 医療安全SSOT | ssot | fable5 | claude_code_ultracode | opus4.8 | 薬剤師レビュー候補 | UI/UXとbackendに反映 |
| UI/UX方針SSOT | ssot | fable5 | claude_code_ultracode | sonnet5 | opus4.8 | 医療UIとして設計 |
| 画面実装 | frontend | sonnet5 | claude_code_ultracode | haiku4.5 | fable5 | ClaudeCode側が所有 |
| フォーム・入力UI | frontend | sonnet5 | claude_code_ultracode | haiku4.5 | fable5, opus4.8 | 医療安全UIは高リスク |
| オフライン/復旧UI | frontend | sonnet5 | claude_code_ultracode | opus4.8 | fable5 | LOCAL_ONLY誤認防止 |
| 帳票プレビューUI | frontend | sonnet5 | claude_code_ultracode | haiku4.5 | fable5 | 帳票生成backendはCodex |
| フロントエンドE2E | frontend | sonnet5 | claude_code_ultracode | Codex側Sol | fable5 | backend fixtureはCodex |
| フロントエンド性能改善 | frontend | sonnet5 | claude_code_ultracode | haiku4.5 | fable5 | サクサク動作SLOに紐づけ |
| バックエンドAPI実装 | backend | Codex側Sol | codex_ultra | sonnet5 | fable5, opus4.8 | OpenAPI SSOT必須 |
| バックエンドCRUD | backend | Codex側Sol | codex_ultra | haiku4.5 | fable5 | UI側はAPI契約に従う |
| ドメインモデル実装 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | SSOT必須 |
| 算定エンジン設計 | ssot/review | opus4.8 | claude_code_ultracode | fable5 | 人間レビュー候補 | 仕様・期待値を固める |
| 算定エンジン実装 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5, 人間レビュー候補 | Codexが実装、opusがレビュー |
| 算定golden test生成 | backend | Codex側Sol | codex_ultra | haiku4.5 | opus4.8 | 期待値はSSOT由来のみ |
| 電子レセプト設計 | ssot/review | opus4.8 | claude_code_ultracode | fable5 | 人間レビュー候補 | Official Adapter SSOT必須 |
| 電子レセプト実装 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | 記録条件未確認なら停止 |
| Official Adapter実装 | backend | Codex側Sol | codex_ultra | opus4.8 | 人間レビュー候補 | Codexは独自解釈禁止 |
| マスター自動更新 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | 回帰テスト必須 |
| OpenAPI/contract test | shared/backend | Codex側Sol | codex_ultra | sonnet5 | fable5 | contract-first |
| 共通モジュール境界設計 | ssot/shared | fable5 | claude_code_ultracode | opus4.8, Codex側Sol | 人間レビュー候補 | SSOT必須 |
| 共通型・status・error code実装 | shared | Codex側Sol | codex_ultra | haiku4.5 | fable5, opus4.8 | 重複定義禁止 |
| money/date-time共通module | shared/backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | 金額・日付高リスク |
| UI共通component/module | frontend/shared | sonnet5 | claude_code_ultracode | haiku4.5 | fable5 | backend依存禁止 |
| fixtures/test-utils共通module | shared/test | Codex側Sol or sonnet5 | assigned_by_fable5 | haiku4.5 | fable5 | PHI混入禁止 |
| generated client利用 | frontend/shared | sonnet5 | claude_code_ultracode | Codex側Sol | fable5 | 未定義field禁止 |
| Edge Node同期 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | 競合解決は高リスク |
| AWS/IaC実装 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | zero downtime必須 |
| セキュリティ設計 | ssot/review | opus4.8 | claude_code_ultracode | fable5 | 人間レビュー候補 | Codexは実装補助 |
| セキュリティ実装 | backend | Codex側Sol | codex_ultra | opus4.8 | fable5 | 権限・監査ログ高リスク |
| secret/dependency scan | review | haiku4.5 | claude_code_ultracode | Codex側Sol | fable5 | 機械的検査 |
| CI失敗調査 | backend/review | Codex側Sol | codex_ultra | haiku4.5 | sonnet5 or opus4.8 | UI起因ならClaudeCodeへ返す |
| 大規模リファクタリング | backend/shared | Codex側Sol | codex_ultra | sonnet5 | fable5, opus4.8 | fable5承認必須 |
| PR最終判断 | review | fable5 | claude_code_ultracode | opus4.8 | 人間レビュー候補 | Codexは判断不可 |

## 2. 推奨担当パターン(領域別)

### フロントエンドUI・画面CRUD
Owner: sonnet5 / Review: haiku4.5 / Escalation: fable5

### 医療安全に関わるUI
UX Owner: fable5 / Implementation: sonnet5 / Safety Review: opus4.8 / Regression・Accessibility Check: haiku4.5

### 算定エンジン
Scope Owner: fable5 / Core Design・Expected Result Review: opus4.8 / Backend Implementation: Codex側Sol / Golden Test Support: Codex側Sol・haiku4.5 / Frontend Display: sonnet5 / Final Gate: opus4.8 + human review

### 電子レセプト・オンライン請求境界
Scope Owner: fable5 / High-risk Design・Review: opus4.8 / Backend File Generation: Codex側Sol(仕様凍結後のみ)/ Frontend Operation UI: sonnet5 / Validation・Golden Tests: haiku4.5 + Codex側Sol / Final Gate: opus4.8 + 請求実務者レビュー

### Official Adapter
Boundary Owner: fable5 / Spec Review: opus4.8 / Backend Implementation: Codex側Sol / Frontend Status UI: sonnet5 / Contract Test: Codex側Sol / Consistency Scan: haiku4.5

### Cloud Core / Pharmacy Edge Node 同期
Architecture Owner: fable5 / Conflict・Security Design: opus4.8 / Backend・Sync Implementation: Codex側Sol / Sync Status UI: sonnet5 / Failure-mode Tests: Codex側Sol / Log・Runbook Consistency: haiku4.5

### 大規模リファクタリング
Plan Owner: fable5 / Primary Implementation: Codex / Frontend Impact: sonnet5 / Diff Summary・Scan: haiku4.5 / High-risk Review: opus4.8(R3+領域に影響時)

### CI失敗・性能劣化
First Investigator: Codex / Quick Log・Config Check: haiku4.5 / Fix: frontend=sonnet5, backend=Codex側Sol / Review: opus4.8(本番・SLO・セキュリティ影響時)

### ドキュメント・整合性
Owner: haiku4.5 / Design Correction: fable5 / Technical Correction: frontend=sonnet5, backend=Codex側Sol / High-risk Review: opus4.8(規制・セキュリティ影響時)
