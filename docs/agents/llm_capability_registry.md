# llm_capability_registry — LLM/エージェント能力レジストリ

```yaml
ssot_id: AGT-016
title: LLM/エージェント能力レジストリ
domain: agents
status: SUPERSEDED
owner: fable5
reviewers:
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 2026-07-09
effective_to: 2026-07-10
superseded_by: AGT-018
source_refs: 構築プロンプト v0.2.0 §0.1.3.1
depends_on: []
impacts:
  - AGT-018
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
  - 0.2.0 2026-07-10 AGT-018のAPPROVED化に伴いmetadata-onlyでSUPERSEDED (WP-9001)
open_questions:
  - Codex側 actual_model_id(「GPT-5.6 sol max」はユーザー指定呼称。CLI設定上の実モデルIDが未確認)
  - Codex Cloud(並列実行)利用可否・データ送信範囲
  - codex CLI の sandbox / approval 標準設定
blockers:
  - CODEX_CAPABILITY_UNVERIFIED(actual_model_id のみ。CLI存在・認証・agmsg疎通は検証済み)
```

実行環境で確認できない項目は `UNKNOWN` とする。UNKNOWN が高リスク割当に影響する場合は
`AGENT_CAPABILITY_UNVERIFIED` として停止する(v0.2.0 §0.1.3.1)。

## Claude側

### fable5(統率者・本セッション)

| 項目 | 値 | 確認方法 |
|---|---|---|
| user_label | fable5 | — |
| actual_model_id | claude-fable-5 | 本セッションのモデルID(検証済み) |
| provider | Anthropic | — |
| tool_environment | Claude Code CLI(tmux 内) | 検証済み |
| availability_status | AVAILABLE | 稼働中 |
| code_execution_capability | あり(Bash/Write/Edit) | 検証済み |
| repository_access | read/write(/Users/yusuke/workspace/yrese) | 検証済み |
| network_access | あり(git push / gh 確認済み) | 検証済み |
| test_execution_permission | あり(pnpm vitest 実行済み) | 検証済み |
| parallel_execution_capability | あり(fork / Workflow / バックグラウンドタスク) | fork 15文書生成で検証済み |
| latency_class | 高知能・低速側 | — |
| cost_class | 最高 | — |
| strengths | 計画統合・仕様境界・高リスク判断・レビューゲート | — |
| prohibited_tasks | 大量CRUD実装・機械的整形の抱え込み | v0.2.0 §0 |
| allowed_risk_level | R0-R4(R4は停止判断のみ) | — |
| verified_at / verified_by | 2026-07-09 / fable5(自己検証) | — |

### opus4.8 / sonnet5 / haiku4.5(サブエージェント)

| 項目 | opus4.8 | sonnet5 | haiku4.5 |
|---|---|---|---|
| actual_model_id | claude-opus-4-8 | claude-sonnet-5 | claude-haiku-4-5-20251001 |
| tool_environment | Claude Code Agent/Workflow(model指定) | 同左 | 同左 |
| availability_status | AVAILABLE(Agent tool の model=opus) | AVAILABLE(model=sonnet) | AVAILABLE(model=haiku) |
| code_execution_capability | サブエージェント経由であり | 同左 | 同左 |
| 主担当 | 高リスク設計・レビュー | フロントエンド主力実装 | scan/lint/差分要約/整合性 |
| prohibited_tasks | 通常CRUD大量実装 | 算定・請求の仕様判断 | 法令解釈・高リスク完了判定 |
| allowed_risk_level | R0-R4(レビュー) | R0-R2実装(R3は指示下) | R0-R1検査 |
| 備考 | 個別呼び出しは未実施(初回割当時に検証) | 同左 | 同左 |

## Codex側

### Codex(ユーザー指定呼称: GPT-5.6 sol max)

| 項目 | 値 | 確認方法 |
|---|---|---|
| user_label | Codex(GPT-5.6 sol max) | ユーザー指定 |
| actual_model_id | **UNKNOWN**(要確認) | CLIバージョンのみ確認 |
| provider | OpenAI | — |
| tool_environment | codex-cli 0.143.0(~/.agents/bin/codex) | `codex --version` で検証済み |
| availability_status | AVAILABLE | ChatGPT ログイン済み(`codex login status`) |
| code_execution_capability | あり | WP-2001/1003 実装で検証済み |
| repository_access | read/write(同一worktree) | WP-2001/1003 で検証済み |
| test_execution_permission | あり(pnpm install/test 実行実績) | WP-2001/1003 で検証済み |
| cloud_execution_permission | UNKNOWN | 未検証 |
| parallel_execution_capability | UNKNOWN(Codex Cloud未検証) | — |
| agmsg 連携 | 検証済み(チーム yrese、双方向送受信・WP フロー一巡) | 2026-07-09 実測 |
| strengths | バックエンド実装・コードベース読解・テスト生成・CI調査 | — |
| prohibited_tasks | 法令解釈 / 算定・請求の独自判断 / フロントエンドUI変更 / PHI・PII・秘密情報の取り扱い / git commit・push(claude がレビュー後にコミット) | v0.2.0 + 運用取り決め |
| allowed_risk_level | R0-R2実装。R3はSSOT凍結+opus4.8レビュー前提 | — |
| review_required_for | 全成果物(claudeレビュー必須、高リスクはopus4.8追加) | — |
| verified_at / verified_by | 2026-07-09 / claude(fable5) | — |

## agmsg(連携基盤)

- 実体: `~/.agents/skills/agmsg/scripts/`(whoami/join/send/inbox/team/delivery/watch)
- チーム: `yrese`(claude, codex の2メンバー)— 検証済み
- 配信: claude側は monitor モード(リアルタイム受信)稼働中
- 「ルーム」機能は存在しない → メッセージ本文の `[room]`/`[msg_type]` タグで代替(AGT-005 参照)
- 状態: AGMSG_PROTOCOL_UNVERIFIED は**解除**(2026-07-09 実測: WP_ASSIGN→CODEX_PLAN→WP_HANDOFF→REVIEW_RESULT の往復を2周完走)
