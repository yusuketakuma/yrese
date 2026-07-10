# agmsg 二系統相互連絡プロトコル

```yaml
ssot_id: AGT-005
title: agmsg 二系統相互連絡プロトコル
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
  - 構築プロンプト v0.2.0 §0.1.6.7〜§0.1.6.10, §0.0.3.9, §0.6
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/agent_handoff_protocol.md
  - docs/agents/codex_data_handling_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
  - 0.2.0 2026-07-10 AGT-018のAPPROVED化に伴いmetadata-onlyでSUPERSEDED (WP-9001)
open_questions:
  - agmsg 実環境(~/.agents/skills/agmsg)に「ルーム」機能があるか未確認。ない場合は本書 §3 のルームタグ方式で代替する【要確認】
  - Codex側エージェントの agmsg 参加名・delivery mode(monitor/turn/both)の標準値【要確認】
blockers:
  - AGMSG_PROTOCOL_UNVERIFIED(疎通テスト未実施)
```

## 1. 位置づけ

agmsg は Claude側と Codex側の連絡・ハンドオフ・レビュー依頼・ブロッカー共有に使う。**agmsg は正式仕様、ADR、法令根拠、医療安全証跡ではない。** 重要決定は必ずリポジトリ内ドキュメント(ADR / SSOT / Issue / PR / test case / risk register / legal_compliance_matrix / medical_safety_risk_register)へ転記する。

## 2. 実環境(検証済み事実)

- スクリプト: `~/.agents/skills/agmsg/scripts/`(`whoami.sh` / `join.sh` ほか)
- 本プロジェクトで利用可能なチーム: `phos`(既存)
- 参加手順: `join.sh <team> <agent_name> claude-code "$(pwd)"` → `/agmsg send <agent> <message>` / `/agmsg history` 等
- Codex側の参加方式(spawn / 手動)は【要確認】

## 3. ルーム運用

必須ルーム候補(v0.2.0 §0.1.6.7)と用途:

| ルーム | 用途 |
|---|---|
| `lane-control` | Claude側/Codex側の統合進行 |
| `claude-command` | Claude側内部連絡 |
| `codex-ultra-mode` | Codex側内部連絡 |
| `handoff` | WP完了ハンドオフ |
| `cross-review` | 相互レビュー依頼 |
| `blockers` | ブロッカー共有 |
| `ci-investigation` | CI失敗調査 |
| `release-gate` | リリース判定 |
| `incident` | 障害・医療安全・請求事故関連 |

実環境の agmsg にルーム機能がない場合は、メッセージ本文先頭に `[room]: <room名>` タグを付けて代替する(フォールバック方式)。どちらを使うかは疎通テスト後に fable5 が確定する。

## 4. 必須メッセージフィールド

```text
[room]: <ルーム名>
[msg_type]: WP_ASSIGN | WP_ACK | CODEX_PLAN | CODEX_BLOCKED | CLAUDE_REVIEW_REQUEST | CODEX_REVIEW_REQUEST | WP_HANDOFF | BLOCKER | DECISION_REQUIRED | REVIEW_RESULT | MERGE_READY | MERGE_BLOCKED
[from_lane]: claude | codex
[from_agent]: <agent_name>
[to_lane]: claude | codex | both
[to_agent]: <agent_name_or_role>
[work_package_id]: <WP-ID>
[owner_side]: claude | codex
[owner_agent]: <agent>
[execution_mode]: claude_code_ultracode | codex_ultra
[ssot_refs]: <approved_ssot_paths>
[ssot_versions]: <versions>
[risk_class]: R0 | R1 | R2 | R3 | R4
[domain]: <domain>
[scope]: <allowed_scope>
[prohibited_scope]: <do_not_touch>
[context_refs]: <docs/issues/prs/files>
[expected_output]: <output>
[test_required]: <tests>
[review_required]: <reviewers>
[status]: proposed | acknowledged | in_progress | blocked | review_requested | completed
[summary]: <short_summary>
```

共通モジュールに関わるメッセージは以下を追加する(v0.2.0 §0.0.3.9):

```text
[common_module_refs]: <関連する共通モジュール>
[common_module_change]: none | reuse | extend | create | deprecate | breaking_change
[common_module_owner]: claude | codex | fable5_assigned
[dependency_direction]: ok | risk | violation
[generated_code_impact]: none | regenerate_required | manual_edit_forbidden
[frontend_impact]: none | required | blocked
[backend_impact]: none | required | blocked
[shared_tests]: <必要な共通モジュールテスト>
```

共通モジュールの breaking change を agmsg だけで合意してはならない。fable5 がSSOTを更新し、レビュー後にWPを再発行する。

## 5. 主要テンプレート

### 5.1 WP_ASSIGN(Claude側→Codex側)

```text
[room]: lane-control
[msg_type]: WP_ASSIGN
[from_lane]: claude
[from_agent]: fable5
[to_lane]: codex
[to_agent]: Codex(GPT-5.6 sol max)
[work_package_id]: WP-XXXX
[owner_side]: codex
[owner_agent]: Codex(GPT-5.6 sol max)
[execution_mode]: codex_ultra
[ssot_refs]: <APPROVED SSOT docs>
[ssot_versions]: <versions>
[risk_class]: R1/R2/R3/R4
[domain]: <domain>
[objective]: <目的>
[allowed_scope]: <触ってよい範囲>
[prohibited_scope]: <触ってはいけない範囲>
[spec_refs]: <docsへの参照>
[evidence_refs]: <evidence_idまたは未確認ならBLOCKER>
[implementation_constraints]: <制約>
[test_required]: <必須テスト>
[output_required]: CODEX_PLAN, diff, test result, WP_HANDOFF
[review_required]: sonnet5/haiku4.5/opus4.8/fable5/human
[stop_conditions]: <停止条件>
```

### 5.2 CODEX_PLAN(Codex側→Claude側)

```text
[room]: lane-control
[msg_type]: CODEX_PLAN
[from_lane]: codex
[from_agent]: Codex(GPT-5.6 sol max)
[to_lane]: claude
[to_agent]: fable5
[work_package_id]: WP-XXXX
[execution_mode_confirmed]: codex_ultra | unavailable
[ssot_refs_confirmed]: yes/no
[understanding]: <理解した内容>
[target_files]: <変更予定ファイル>
[read_only_files]: <参照のみファイル>
[implementation_steps]: <手順>
[test_plan]: <テスト計画>
[risk_notes]: <リスク>
[questions]: <不明点>
[blockers]: <あればBLOCKER>
[requires_approval_before_edit]: yes/no
```

### 5.3 WP_HANDOFF(Codex側→Claude側)

```text
[room]: handoff
[msg_type]: WP_HANDOFF
[from_lane]: codex
[from_agent]: Codex(GPT-5.6 sol max)
[to_lane]: claude
[to_agent]: fable5
[work_package_id]: WP-XXXX
[execution_mode_used]: codex_ultra
[ssot_refs_used]: <paths and versions>
[summary]: <変更概要>
[files_changed]: <変更ファイル>
[tests_run]: <実行テスト>
[test_results]: <結果>
[open_risks]: <残リスク>
[review_focus]: <重点レビュー箇所>
[blocked_items]: <未完了・ブロッカー>
[follow_up_recommendations]: <追加作業提案>
[ready_for_review]: yes/no
```

### 5.4 BLOCKER

```text
[room]: blockers
[msg_type]: BLOCKER
[to]: fable5
[from]: <agent>
[work_package_id]: <WP-ID>
[status]: BLOCKED
[blocker_type]: <BLOCKED_* / CODEX_* / AGMSG_*種別>
[blocking_question]: <解決すべき問い>
[affected_files]: <影響ファイル>
[risk]: <リスク>
[recommended_next_step]: <推奨次アクション>
```

## 6. agmsg に載せてはならないもの

PHI / PII / 本番データ / 未マスク医療情報 / 秘密鍵 / API key / パスワード / 電子証明書 / 接続先秘密情報 / NSIPS仕様本文 / 公式資料の有償・許諾制限付き本文 / 患者を特定できるログ

違反を検知した場合は即時 `AGMSG_PHI_LEAK` として incident ルームへ報告し、該当WPを停止する(v0.2.0 §0.16 停止条件)。

## 7. 転記ルール

以下は agmsg 上で発生しても、24時間以内(または当該WP完了前のいずれか早い方)に正式ドキュメントへ転記する:

- 仕様に関する決定 → 該当SSOT + 必要時ADR
- 契約変更合意 → `CONTRACT_CHANGE_REQUEST` → API Contract SSOT
- ブロッカーと裁定 → regulatory_blockers / risk_register / ADR
- レビュー結果 → PR本文
