# 実行モードポリシー

```yaml
ssot_id: AGT-011
title: 実行モードポリシー
domain: agents
status: SUPERSEDED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: 2026-07-10
superseded_by: AGT-018
source_refs:
  - 構築プロンプト v0.2.0 §0.0.1, §0.1.6.4
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
  - 0.2.0 2026-07-10 AGT-018のAPPROVED化に伴いmetadata-onlyでSUPERSEDED (WP-9001)
open_questions:
  - Codex `ultraモード` に対応する実際のCLI設定(model / reasoning effort / sandbox / approval)の標準値【要確認】
blockers: []
```

## 1. 必須 execution_mode

| エージェント | execution_mode |
|---|---|
| Claude側 fable5 | `claude_code_ultracode` |
| Claude側 opus4.8 | `claude_code_ultracode` |
| Claude側 sonnet5 | `claude_code_ultracode` |
| Claude側 haiku4.5 | `claude_code_ultracode` |
| Codex側 Sol | `codex_ultra` |

- フロントエンド作業(implementation_layer=frontend)は `claude_code_ultracode` 以外への割当を禁止する
- バックエンド作業(implementation_layer=backend)は `codex_ultra` 以外への割当を禁止する
- すべてのWPに `execution_mode` を明記する。未記載のWPは READY にできない

## 2. 実行モードの実環境マッピング(2026-07-09 検証)

| 論理モード | 実環境での実体 | 検証状態 |
|---|---|---|
| `claude_code_ultracode` | Claude Code のマルチエージェントオーケストレーション(ultracode)。fable5=メインループ、opus4.8/sonnet5/haiku4.5=サブエージェント(モデル指定 opus/sonnet/haiku) | 利用可能(検証済み) |
| `codex_ultra` | codex-cli 0.143.0(`~/.agents/bin/codex`、ChatGPTログイン済み)による実行。本プロジェクト運用モード名であり公式機能名ではない。CLI設定の標準値は【要確認】 | CLI存在・認証は検証済み。モデルID・権限詳細は未検証 |

## 3. 実行モードが利用できない場合

- Claude側で `/ultracode` が使えない場合は `CLAUDE_ULTRACODE_UNAVAILABLE` として停止する
- Codex側で `ultraモード` が使えない場合は `CODEX_ULTRA_MODE_UNAVAILABLE` として停止する
- 同等モードで代替する場合でも、fable5 が `llm_capability_registry.md` に actual_mode、actual_model_id、権限、制限、代替理由を記録し、**人間レビュー対象**にする

## 4. 実装開始前の必須確認(v0.2.0 §0.0.1)

1. Claude側実装セッションが `/ultracode` を使用している
2. Codex側実装セッションが `ultraモード` を使用している
3. すべてのWPに owner_side / owner_agent / execution_mode / ssot_refs / allowed_files / reviewer / handoff_channel が明記されている
4. 仕様決定内容が該当SSOTに反映されている
5. 実装者が承認済みSSOTとWPを根拠にしている(agmsg・会話ログは根拠にしない)
6. SSOTが未作成・未承認・古い・矛盾している場合は実装を開始しない
7. 仕様差分発見時はコードを先に合わせず、fable5 がSSOT更新要否を判断する
8. 両レーンが同一ファイル・同一ドメイン・同一SSOTを同時更新しないよう、fable5 がロックを管理する

## 5. モード遵守の検査

- WPと実際の実行モードの一致は、WP_ACK / CODEX_PLAN の `execution_mode_confirmed` フィールドで宣言させる
- haiku4.5 が WP・PR・agmsgメッセージ間の execution_mode 整合性を検査する
- 不一致は `IMPLEMENTATION_OWNERSHIP_BLOCKED` として停止する
