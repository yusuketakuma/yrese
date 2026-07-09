# Claude側チャーター

```yaml
ssot_id: AGT-002
title: Claude側チャーター
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
  - 構築プロンプト v0.1.7 §0.1.6.2, §0.0.2.1, §38
  - docs/agents/dual_lane_operating_model.md
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/agent_assignment_matrix.md
  - docs/agents/file_ownership_and_lock_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - opus4.8 / sonnet5 / haiku4.5 の実環境モデルIDと利用可否は llm_capability_registry.md で管理【要確認】
blockers: []
```

## 1. 位置づけ

Claude側は Claude Code `/ultracode` 上で動く従来チームであり、仕様・法令適合性・医療安全・UI/UX方針・全体統率・レビューゲート・フロントエンド実装を担う。

## 2. 内部役割

| エージェント | 役割 | execution_mode |
|---|---|---|
| fable5 | 全体統率、計画、タスク分解、仕様境界、UI/UX方針、SSOT承認、WP発行、最終判断 | claude_code_ultracode |
| opus4.8 | 高リスク設計・レビュー(法令/請求/医療安全/セキュリティ/アーキテクチャ)。直接実装は `FABLE_CROSS_LANE_APPROVAL` 付き限定参考実装のみ | claude_code_ultracode |
| sonnet5 | フロントエンド主力実装(UI、画面CRUD、フロントエンドAPI接続、帳票プレビューUI、E2E、体験品質改善) | claude_code_ultracode |
| haiku4.5 | scan、lint、typecheck、差分要約、整合性確認、軽量検査。判断主体にしない | claude_code_ultracode |

## 3. Claude側の主責務

- フロントエンド実装(所有パスは [file_ownership_and_lock_policy](file_ownership_and_lock_policy.md) 参照): 画面ルーティング、画面状態管理、フォーム、入力バリデーションUI、警告・エラー・BLOCKER表示、LOCAL_ONLY / RECOVERY_SYNC のUI表示、外部システム責務分界表示、帳票プレビューUI、印刷UI、デバイス接続UI、アクセシビリティ、キーボード操作、フロントエンドE2E、フロントエンド性能改善
- プロダクト理解、要件整理、MVP / 非MVP定義
- 公式資料調査計画、法令適合性管理、医療安全管理
- 調剤報酬・請求・公費・PMH・電子処方箋・オンライン資格確認の境界判断
- Official Adapter の責務分界、UI/UX方針決定、体験品質設計
- work package 作成、Codex側への作業依頼、仕様レビュー、高リスクレビュー、Phase gate管理、Go/No-Go判定案

## 4. Claude側が握る最終決定権

MVP対象範囲 / 法令適合性 / 医療安全 / 算定・請求の仕様境界 / Official Adapter境界 / UI/UX基本方針 / LOCAL_ONLY・RECOVERY_SYNC の安全方針 / 高リスクPRのmerge可否 / 人間レビュー必須論点

## 5. Claude側の禁止事項

- バックエンド(`apps/api/**`、domain/calculation/claim/masters、DB schema、migration、IaC)の主実装(例外は fable5 明示承認時のみ)
- UI都合による算定・請求・資格確認・電子処方箋・PMH の意味変更
- API契約(OpenAPI / SSOT)に存在しないレスポンスフィールドを仮定した実装(不足時は `FRONTEND_NEEDS_API` として Codex側へ依頼)
- 承認済みSSOTなしの実装着手、agmsg会話のみを根拠とした実装
- 高リスク仕様を未確定のまま Codex側へ投げること

## 6. 各役割に原則任せないこと

- fable5: 大量CRUD実装、大量テスト作成、機械的リファクタリング、lint/typecheck修正のみの作業、CIログ一次切り分け
- opus4.8: 仕様明確な通常CRUD大量実装、単純UI部品大量作成、機械的スキャン、haiku4.5で足りる差分要約
- sonnet5(単独禁止): 算定・請求・公費・PMHの最終仕様判断、電子レセプト記録条件の独自解釈、外部接続境界判断、バックエンド主実装、高リスクDB migration、医療安全上の重大UI判断
- haiku4.5(禁止): 法令・調剤報酬・請求・公費・PMHの仕様判断、Official Adapter仕様の独自判断、高リスクコードの完了判定、セキュリティ例外承認、UI/UXの最終判断
