# work_package_template — Work Package テンプレート

```yaml
ssot_id: PRC-002
title: Work Package テンプレート
domain: process
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §0.3, §0.0.3.8, §0.1.3.7
depends_on:
  - PRC-003 definition_of_ready
open_questions:
  - agmsg メッセージ長の実用上限(長大なWPは docs/ 参照方式に切替済み — 正式化要否)
```

## 1. WP 必須フィールド(v0.1.7 §0.3)

```text
work_package_id:            # WP-XXXX
phase:
title:
owner_side: claude | codex
owner_agent:
owner_model:
execution_mode: claude_code_ultracode | codex_ultra
reviewer_model:
agmsg_room:                 # 実環境はルーム機能なし → [msg_type]/[room] タグで代替(AGT-005)
branch_name:                # 暫定運用では main 直コミット(PRC-004)
priority:
risk_level: R0-R4
implementation_layer: frontend | backend | shared | ssot | review
status: DRAFT | READY_FOR_REVIEW | READY | IN_PROGRESS | REVIEW_REQUESTED | CHANGES_REQUESTED | BLOCKED | DONE | CANCELLED
ssot_refs:
ssot_versions:
ssot_update_required: yes | no

目的: / 背景: / 対象ドメイン: / 対象ファイル:
変更してよいファイル(allowed_files): / 変更禁止ファイル(forbidden_files):
関連仕様: / 関連SSOT: / SSOT status: / evidence_id: / 依存タスク: / 前提条件:

Definition of Ready:        # PRC-003 の全項目
実装手順: / テスト手順: / 受入条件:
レビュー観点: 法令適合性 / 医療安全 / 算定・請求影響 / PHI・PII影響 / UX影響 / オフライン影響 / Edge Node影響 / 性能影響 / ロールバック可否
想定失敗: / ロールバック方法: / SSOT更新要否: / PR本文に必ず含めるSSOT参照: / 完了時ハンドオフ:
```

## 2. 共通モジュール追加フィールド(v0.1.7 §0.0.3.8)

```text
common_module_refs:
common_module_reuse_check:      # 既存で実現可能か
new_common_module_required:
new_common_module_owner:
common_module_allowed_files:
dependency_direction_check:     # scripts/check-boundaries.mjs で機械検査
generated_code_impact: none | regenerate_required | manual_edit_forbidden
frontend_backend_contract_impact:
shared_breaking_change_risk:
common_module_tests_required:
```

## 3. 割当メタデータ(v0.1.7 §0.1.3.7)

risk_level(R0-R4)/ ambiguity_level(A0-A4)/ implementation_size(S0-S4)/ execution_need(E0-E2)/ repetition_level(P0-P4)/ ux_safety_level(U0-U4)、primary_agent_reason / reviewer_agent_reason / prohibited_agents / required_human_review。

## 4. ステータス遷移ルール

- fable5 以外は DRAFT → READY へ変更してはならない。
- R3+ は opus4.8 事前レビューなしに READY へ変更してはならない。
- DoR 未充足は BLOCKED_NOT_READY とする。
- CHANGES_REQUESTED は owner 修正 → 再ハンドオフで REVIEW_REQUESTED へ戻す。
- DONE 判定は fable5 のみ。

## 5. 運用注記(実績反映)

- 実運用では WP 本文を agmsg WP_ASSIGN メッセージに要約して送り、フィールドの実体は本テンプレートに従って fable5 が管理する。省略時も allowed_files / prohibited_scope / risk_class / output_required は必ず明記する(WP-2001〜2101a 実績)。
- Codex側は git commit / push を行わない(claude がレビュー後にコミット)。
