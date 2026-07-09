# 二系統 RACI マトリクス

```yaml
ssot_id: AGT-006
title: 二系統 RACI マトリクス
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
  - 構築プロンプト v0.2.0 §0.1.6.5
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/agent_assignment_matrix.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions: []
blockers: []
```

## RACI(フロントエンド/バックエンド実装所有ベース)

R=Responsible(実行)、A=Accountable(説明責任)、C=Consulted(相談)、I=Informed(通知)

| 領域 | Responsible | Accountable | Consulted | Informed | 備考 |
|---|---|---|---|---|---|
| MVP定義 | fable5 | fable5 | opus4.8, 人間レビュー | Codex側 | Codexは参照のみ |
| 法令適合性 | fable5, opus4.8 | fable5 | 人間レビュー | Codex側 | 最終判断はClaude側 |
| 医療安全 | fable5, opus4.8 | fable5 | 薬剤師レビュー | Codex側 | UI/UXとbackend両方に反映 |
| UI/UX方針 | fable5 | fable5 | opus4.8, sonnet5, 人間レビュー | Codex側 | 医療システムに相応しいUI |
| フロントエンド実装 | sonnet5 | fable5 | opus4.8, haiku4.5 | Codex側 | ClaudeCode `/ultracode` 必須 |
| フロントエンドE2E | sonnet5 | fable5 | Codex側, haiku4.5 | opus4.8 | backend fixtureはCodex側 |
| バックエンドAPI実装 | Codex側Sol | fable5 | opus4.8, sonnet5 | haiku4.5 | Codex `ultraモード` 必須 |
| バックエンドドメイン実装 | Codex側Sol | fable5 | opus4.8 | Claude側 | 高リスクはopus4.8レビュー |
| 算定エンジン実装 | Codex側Sol | fable5 | opus4.8, 人間レビュー | sonnet5 | SSOT・golden test必須 |
| 電子レセプト実装 | Codex側Sol | fable5 | opus4.8, 人間レビュー | sonnet5 | Official Adapter SSOT必須 |
| マスター自動更新実装 | Codex側Sol | fable5 | opus4.8 | sonnet5 | 回帰テスト必須 |
| Official Adapter実装 | Codex側Sol | fable5 | opus4.8, 人間レビュー | sonnet5 | 公式仕様未確認なら停止 |
| OpenAPI / API Contract | Codex側Sol | fable5 | sonnet5, opus4.8 | haiku4.5 | contract-first |
| generated client利用 | sonnet5 | fable5 | Codex側Sol | haiku4.5 | フロント側は契約外フィールド禁止 |
| Edge Node同期実装 | Codex側Sol | fable5 | opus4.8 | sonnet5 | 競合解決は高リスク |
| AWS/IaC実装 | Codex側Sol | fable5 | opus4.8 | haiku4.5 | 無停止更新・DR必須 |
| セキュリティ実装 | Codex側Sol | fable5 | opus4.8 | haiku4.5 | 高リスクレビュー必須 |
| フロントエンドUXレビュー | sonnet5, fable5 | fable5 | opus4.8 | Codex側 | 医療UIとしてレビュー |
| バックエンド技術レビュー | Codex側Sol | fable5 | opus4.8 | Claude側 | Codexセルフレビューだけで完了不可 |
| CI失敗調査 | Codex側Sol | fable5 | haiku4.5 | sonnet5 | UI起因ならClaude側へ戻す |
| 軽量スキャン | haiku4.5 | fable5 | Codex側Sol | sonnet5 | 機械的検査 |
| PR最終承認 | fable5 / opus4.8 | fable5 | Codex側, sonnet5, haiku4.5 | 人間レビュー | Codexは最終判断不可 |

## 運用ルール

1. Accountable は全行で fable5(または fable5/opus4.8 の組)である。これを変更する場合は本SSOTの改版と人間レビューを要する。
2. Responsible の変更は WP単位で fable5 が指定できるが、実行モード制約(frontend=claude_code_ultracode / backend=codex_ultra)は変更できない。
3. Consulted に「人間レビュー」がある行は、`human_review_checklist.md` に論点を登録してから完了判定する。
4. Informed への通知は agmsg の該当ルームへの投稿で足りる(正式証跡は別途転記)。
