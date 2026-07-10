# エージェント間ハンドオフプロトコル(WPライフサイクル)

```yaml
ssot_id: AGT-015
title: エージェント間ハンドオフプロトコル(WPライフサイクル)
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
  - 構築プロンプト v0.2.0 §0.1.6.6, §0.3, §0.4, §0.5, §0.11, §0.13, §0.15
depends_on:
  - docs/agents/agmsg_cross_lane_protocol.md
  - docs/agents/agent_review_pairing_policy.md
  - docs/agents/file_ownership_and_lock_policy.md
impacts: []
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
  - 0.2.0 2026-07-10 AGT-018のAPPROVED化に伴いmetadata-onlyでSUPERSEDED (WP-9001)
open_questions: []
blockers: []
```

## 1. WPライフサイクル(14ステップ)

1. fable5 がWPを作成する(work_package_template 準拠)
2. fable5 が risk_class、ambiguity_class、lane、owner、reviewer、blocked条件を明記する
3. fable5 が agmsg で `WP_ASSIGN` を送る
4. 受領側は `WP_ACK` を返す
5. Codex側が担当する場合、Sol は `CODEX_PLAN` を返す(**CODEX_PLANなしの実装着手は禁止**)
6. fable5 または opus4.8 が必要に応じて plan を承認する
7. owner が実装する
8. owner がテストを実行する
9. owner が `WP_HANDOFF` を投稿する
10. reviewer がレビューする
11. 高リスク領域は opus4.8 が追加レビューする
12. fable5 が完了判定する
13. 重要決定は正式ドキュメントへ転記する
14. **agmsgだけで完了扱いにしない**

## 2. WP status(これ以外の状態は使わない)

`DRAFT → READY_FOR_REVIEW → READY → IN_PROGRESS → REVIEW_REQUESTED → (CHANGES_REQUESTED →) DONE`
分岐: `BLOCKED` / `CANCELLED`

- fable5 以外は DRAFT を READY へ変更してはならない
- 高リスクWPは opus4.8 レビューなしに READY へ変更してはならない

## 3. 実装者の標準手順(12ステップ、v0.2.0 §0.11)

1. WPを読む → 2. 変更対象ファイル確認 → 3. 関連仕様・ADR・テスト確認 → 4. 不明点を agmsg で fable5 に質問 → 5. テスト方針を先に確認 → 6. 必要ならテスト先行追加 → 7. 最小差分で実装 → 8. 型・lint・unit test 実行 → 9. (高リスク)golden / contract / e2e test 実行 → 10. ドキュメント更新 → 11. agmsg で完了ハンドオフ → 12. PR本文をWPに沿って作成

**「ついでの改善」禁止。** 改善が必要な場合は新WPとして fable5 に提案する。

## 4. ハンドオフメッセージ(汎用形式)

```text
[to]: fable5, haiku4.5, reviewer_model
[from]: <owner_model>
work_package_id: WP-XXXX
status: REVIEW_REQUESTED
action: handoff
summary: 実装完了。受入条件A/B/Cに対応。
changed_files:
- path/to/file1
- path/to/file2
tests_run:
- pnpm typecheck
- pnpm test -- <target>
blockers: なし
review_request: scanとレビューをお願いします。
next_action: review
```

レーン間の詳細テンプレート(WP_ASSIGN / CODEX_PLAN / WP_HANDOFF / BLOCKER)は [agmsg_cross_lane_protocol](agmsg_cross_lane_protocol.md) §5 を正とする。

## 5. ブロッカーの受け渡し

- ブロッカーは agmsg `blockers` へ所定形式で投稿する(同 §5.4)
- 種別: BLOCKED_NOT_READY / BLOCKED_REGULATORY_REVIEW / BLOCKED_LEGAL_REVIEW / BLOCKED_MEDICAL_SAFETY_REVIEW / BLOCKED_OFFICIAL_ADAPTER_SPEC / BLOCKED_CODE_MAPPING_REVIEW / BLOCKED_UNSUPPORTED_CLAIM / BLOCKED_PMH_REVIEW / BLOCKED_NSIPS_LICENSE / BLOCKED_SECURITY_REVIEW / BLOCKED_PERFORMANCE_SLO / BLOCKED_EDGE_SYNC_DESIGN / BLOCKED_UX_SAFETY / CODEX_CAPABILITY_UNVERIFIED / AGMSG_PROTOCOL_UNVERIFIED
- fable5 の triage 選択肢: 追加調査 / scope変更 / WP分割 / opus4.8レビュー依頼 / 人間レビュー依頼 / future scopeへ移動 / 実装禁止 / 代替案採用

## 6. 完了判定の必須証跡

fable5 が DONE 判定する前に以下が揃っていること:

- [ ] WP_ASSIGN → WP_ACK →(Codex側)CODEX_PLAN → WP_HANDOFF の一連のagmsg記録
- [ ] PR(work_package_id / ssot_refs / ssot_versions / テスト結果 / rollback / evidence_id 記載)
- [ ] レビュー結果(REVIEW_RESULT。高リスクは opus4.8 承認)
- [ ] Definition of Done チェックリスト充足
- [ ] 重要決定の正式ドキュメント転記(ADR / SSOT / risk register)
- [ ] ロック解除([file_ownership_and_lock_policy](file_ownership_and_lock_policy.md) §4)
