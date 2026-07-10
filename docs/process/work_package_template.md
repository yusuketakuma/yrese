# work_package_template — Work Package テンプレート

```yaml
ssot_id: PRC-002
title: Work Package テンプレート
domain: process
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §0.3, §0.0.3.8, §0.1.3.7
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
  - PRC-003 definition_of_ready
impacts:
  - Plans.md
  - State.md
  - all current Work Packages
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりowner_role/reviewer_rolesとCodex単一レーンへ改定
  - 0.1.0 2026-07-09 初版
open_questions: []
blockers: []
```

## 1. WP 必須フィールド

```text
work_package_id:            # WP-XXXX
phase:
title:
root_role: codex_root
mapper_role: code_mapper | explorer
pre_plan_reviewer_role: implementation_planner | spec_guardian
owner_role: sole_maintainer
reviewer_roles:             # independent_verifier を必須とし、必要なspecialist roleを追加
specialist_roles:
human_approval_roles:
branch_name:
priority:
risk_level: R0-R4
implementation_layer: frontend | backend | shared | ssot | database | infrastructure | test | review
status: DRAFT | READY_FOR_REVIEW | READY | IN_PROGRESS | REVIEW_REQUESTED | CHANGES_REQUESTED | BLOCKED | DONE | CANCELLED

ssot_refs:
ssot_versions:
ssot_status_check:
ssot_update_required: yes | no
evidence_ids:
evidence_not_required_reason:
official_source_refs:
dependencies:

purpose:
background:
target_domain:
acceptance_criteria:
stop_conditions:
allowed_files:
forbidden_files:
unrelated_dirty_changes:
mapper_findings:
pre_plan_review:

implementation_plan:
test_plan:
review_focus:
expected_failures:
rollback_method:
security_impact:
privacy_phi_pii_impact:
medical_safety_impact:
calculation_claim_impact:
data_integrity_impact:
ui_ux_accessibility_impact:
offline_edge_impact:
performance_slo_impact:
migration_deploy_external_action_impact:
human_gates:

handoff_record:
verification_record:
specialist_review_records:
validation_commands:
validation_results:
remaining_risks:
landing_required: none | commit | commit_and_push
landing_record:
```

`owner_role`はactive scopeで唯一のeditorを示す。`reviewer_roles`には、変更作成に関与していない`independent_verifier`を必ず含める。同じrole/contextをownerとcheckerに指定してはならない。

## 2. 共通モジュール追加フィールド

```text
common_module_refs:
common_module_reuse_check:      # 既存で実現可能か
new_common_module_required:
new_common_module_owner_role:
common_module_allowed_files:
dependency_direction_check:     # scripts/check-boundaries.mjs で機械検査
generated_code_impact: none | regenerate_required | manual_edit_forbidden
frontend_backend_contract_impact:
shared_breaking_change_risk:
common_module_tests_required:
```

既存`packages/*`で正本化されたconcept、enum、status、validation、money/date処理を再実装してはならない。

## 3. Role割当メタデータ

```text
risk_level: R0-R4
ambiguity_level: A0-A4
implementation_size: S0-S4
execution_need: E0-E2
repetition_level: P0-P4
ux_safety_level: U0-U4
mapper_role_reason:
pre_plan_reviewer_role_reason:
owner_role_reason:
reviewer_role_reasons:
prohibited_roles:
required_human_review:
```

割当はrole/capabilityで行い、未確認のmodel ID、製品名、reasoning tier、permissionを記録または前提化しない。

ambiguity levelは次のfail-closed規律を持つ。

- `A0-A2`: mapper evidenceとpre-plan reviewで解消可能な範囲。解消内容をWPへ記録する。
- `A3`: behavior、scope、医療・請求・security/privacy、data integrity、human gateに影響し得る重要な曖昧性。Codex rootは`blocking_question`、affected SSOT、required specialist、最終判断を持つhuman authorityをWPへ明記し、当該authorityまたはAPPROVED SSOT改版で解消する。解消後はmapとpre-plan reviewをやり直す。
- `A4`: 要求の重大な矛盾、最終authority不明、または安全に一意化できない曖昧性。WPを`BLOCKED`、blocker typeを`BLOCKED_NOT_READY`とし、実装・stage・landingを禁止する。人間による仕様clarification、必要なSSOT改版・承認、再計画、pre-plan reviewが完了するまで再開しない。

WP自身、`Plans.md`、`State.md`、agent packetはAPPROVED SSOTを上書きできない。A3/A4をWP内の推測で解消した扱いにしてはならない。

## 4. ステータス遷移ルール

- Codex rootだけがmapper evidenceとpre-plan reviewを確認してDRAFTをREADYへ変更できる。
- DoR未充足は`BLOCKED_NOT_READY`とする。
- A3はrequired human/spec authorityによる解消recordと再計画・pre-plan reviewが完了するまでREADYへ変更しない。
- A4は`BLOCKED_NOT_READY`で停止し、human clarificationと必要なAPPROVED SSOT改版後に新しい計画として再開する。
- R3+はrelevant specialistとrequired human gateを定義し、事前review完了前にREADYへ変更しない。
- IN_PROGRESSではsole maintainer以外のeditorを置かない。
- CHANGES_REQUESTEDはsole maintainer修正後にREVIEW_REQUESTEDへ戻し、independent verifierが再確認する。
- DONE判定はrootがDoD、verification、specialist/human gate、landing recordを確認して行う。

## 5. 運用注記

- WPの正本はrepository内のcurrent WP recordであり、会話や一時packetで代替しない。
- mapperとpre-plan reviewerはread-only、sole maintainerだけが編集、independent verifierとspecialistはread-onlyとする。
- subagentはcommit/pushしない。verification後、rootだけがowned exact pathをstageし、staged diffを確認してWP-ID付きでcommitし、要求時だけpushする。
- 省略版WPでも`owner_role`、`reviewer_roles`、allowed/forbidden files、risk、SSOT/evidence、acceptance criteria、validation、human gatesを省略しない。
