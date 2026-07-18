# Plans.md — 調剤用レセプトコンピューター MVP タスク計画

構築プロンプト v0.2.0 / `docs/plan/phase0_plan.md` に基づく実行計画。
運用ルール: AGT-018 APPROVEDによりrepository-wideでCodex-only運用を適用する。活動単位ごとにsole Codex maintainerが実装し、independent verifier後にCodex rootだけがowned exact pathをcommitし、要求時にpushする。活動ログは`State.md`に記録。
高リスク領域(R3+)は根拠(evidence_id)未確認のまま実装しない — 「根拠不足を正しく検知して止まるコード」を優先する。

> [!IMPORTANT]
> **current routing (2026-07-10):** AGT-018 APPROVEDによりCodex root → read-only mapper → read-only pre-plan reviewer → sole maintainer → independent verifier + relevant specialists → root exact-stage landingをrepository全体へ適用する。本台帳のcompleted-historyに残る旧model名、旧role名、旧lane、旧message/approval名は当時のprovenanceであり、新規WPのowner/reviewer/gateとして再利用しない。

## ステータス凡例

- `[ ]` TODO / `[~]` IN_PROGRESS / `[x]` DONE / `[!]` BLOCKED

## Active governance cutover

- [x] WP-9001 Codex single-lane governance cutover(direct user instruction 2026-07-10、LANDED / commit 86be6b1)

```yaml
work_package_id: WP-9001
phase: governance-cutover
title: Codex single-lane governance cutover
root_role: codex_root
mapper_role: code_mapper
pre_plan_reviewer_role: spec_guardian
owner_role: sole_maintainer
reviewer_roles:
  - independent_verifier
  - spec_guardian
specialist_roles:
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - security_critic
  - data_integrity_auditor
human_approval_roles:
  - user_product_and_safety_authority
branch_name: wp-9001-codex-only
priority: P0
risk_level: R3
ambiguity_level: A2
implementation_layer: ssot
status: DONE
landing_state: LANDED

ssot_refs:
  - SPEC-001
  - SPEC-002
  - AGT-001..AGT-018
  - PRC-001..PRC-007
  - OPS-012
  - REG-006
  - PLAN-PHASE0-001
  - PLAN-UIUX-001
  - IDX-001
ssot_versions:
  - AGT-018 v0.1.0 APPROVED
  - AGT-001..AGT-017 v0.2.0 SUPERSEDED
  - PRC-001..PRC-006 v0.2.0 APPROVED
  - PRC-007 v0.3.1 APPROVED (data_integrity_auditor APPROVED)
  - OPS-012 v0.2.0 APPROVED
  - REG-006 v0.2.0 APPROVED
  - SPEC-001/SPEC-002 v0.2.0 APPROVED revision
  - PLAN-PHASE0-001 v0.1.1 APPROVED
  - PLAN-UIUX-001 v0.1.1 PROPOSED (unchanged gate)
  - IDX-001 v0.4.1 APPROVED (data_integrity_auditor APPROVED)
ssot_status_check: all WP-9001 cutover and transition SSOT finalization complete and landed; PLAN-UIUX-001 remains independently PROPOSED
ssot_update_required: yes
evidence_ids: []
evidence_not_required_reason: agent governance and repository workflow only; no calculation, claim, receipt, legal rule value, or production data behavior is implemented
official_source_refs:
  - direct user instruction 2026-07-10 (Codex-only operation)
dependencies:
  - independent_verifier APPROVED
  - spec_guardian APPROVED
  - medical_safety_reviewer / privacy_compliance_reviewer / security_critic APPROVED
  - base-aware same-batch finalization and index synchronization PASS
  - data_integrity_auditor APPROVED (inventory 173/142; legacy semantics/body/status/approval/effective preservation; AGT 17 body/status/23-field; gates PASS)
  - Codex root exact-stage commit_and_push PENDING

purpose: Replace active dual-lane/legacy agent routing with one Codex-native lane while preserving all product, evidence, medical, privacy, security, data-integrity, and human approval gates.
background: Read-only mapping found active routing conflicts across agent, process, spec, operations, regulatory, plan, and ledger documents; a partial cutover would leave contradictory APPROVED instructions.
target_domain: repository governance, SSOT process, agent routing, review and landing controls
acceptance_criteria:
  - AGT-018 defines root -> mapper -> pre-plan reviewer -> sole maintainer -> independent verifier/specialists -> root landing for every layer.
  - A Work Package, Plans.md, State.md, agent packet, code, or test cannot override APPROVED SSOT.
  - AGT-018 routing compatibility never weakens product/domain/evidence/human gates.
  - A3 and A4 ambiguity stop rules are fail-closed and assign final resolution to required human/spec authority.
  - OPS-012 keeps Codex root to an evidence-backed proposal and makes final Go/No-Go and A3-A6 distinct human decisions.
  - REG-006 separates repository-local synthetic-only Codex operation from Cloud, PHI, external, privilege, secret, and production approvals.
  - All unfinished/current Plans routing is audited: WP-2009, WP-3022, WP-4007, WP-4050, WP-4051, invalid WP-4054, WP-4057, WP-5004, WP-0019, WP-0038, and current sequencing/issuance use AGT-018 roles or explicit historical-only provenance without weakening human pharmacist/claims/legal/security authority.
  - PRC-001..PRC-007 include every PRC-007-required frontmatter field.
  - Review diff remains PROPOSED until independent verification; final statuses follow the base-aware matrix atomically after PASS: formerly APPROVED revisions return to APPROVED, new AGT-018 becomes APPROVED only after cutover approval/verification, and formerly PROPOSED PLAN-UIUX-001 remains PROPOSED pending its separate design/human gate.
  - AGT-001..017 remain APPROVED and body-unchanged during review; finalization makes them metadata-only SUPERSEDED only after AGT-018 approval, with all PRC-007 23 fields present. AGT-016/017 missing metadata is completed and all 17 are machine-audited before landing.
  - SSOT index, script harness, secrets, boundaries, and diff checks pass with no code/package/lock changes.
  - PRC-007 v0.3.1 defines a prospective 23-field rule and a non-destructive legacy migration path; existing unmodified legacy SSOT status/approval remains valid until WP-9002 migration or a separate substantive amendment.
  - WP-9001 DONE/COMPLETE required data-integrity review, exact-stage commit_and_push, and this separate post-landing Plans/State ledger update; all conditions are satisfied by commit 86be6b1 and this ledger record.
stop_conditions:
  - any unresolved HIGH/CRITICAL verifier or specialist finding
  - any premature APPROVED/SUPERSEDED claim in the review batch
  - any loss of human authority, evidence requirement, PHI/secret restriction, or production/external approval gate
  - any unrelated main-worktree WIP overlap
allowed_files:
  - AGENTS.md
  - CLAUDE.md
  - Plans.md
  - State.md
  - docs/agents/codex_single_lane_operating_model.md
  - docs/agents/agent_assignment_matrix.md (finalization metadata only)
  - docs/agents/agent_handoff_protocol.md (finalization metadata only)
  - docs/agents/agent_review_pairing_policy.md (finalization metadata only)
  - docs/agents/agent_routing_policy.md (finalization metadata only)
  - docs/agents/agmsg_cross_lane_protocol.md (finalization metadata only)
  - docs/agents/claude_side_charter.md (finalization metadata only)
  - docs/agents/codex_capability_verification.md (finalization metadata only)
  - docs/agents/codex_data_handling_policy.md (finalization metadata only)
  - docs/agents/codex_side_ultra_mode_charter.md (finalization metadata only)
  - docs/agents/cross_lane_review_policy.md (finalization metadata only)
  - docs/agents/dual_lane_operating_model.md (finalization metadata only)
  - docs/agents/dual_lane_raci_matrix.md (finalization metadata only)
  - docs/agents/execution_mode_policy.md (finalization metadata only)
  - docs/agents/file_ownership_and_lock_policy.md (finalization metadata only)
  - docs/agents/lane_conflict_resolution_policy.md (finalization metadata only)
  - docs/agents/llm_capability_registry.md (finalization metadata only)
  - docs/agents/sol_ultra_mode_execution_policy.md (finalization metadata only)
  - docs/spec/construction_prompt_baseline.md
  - docs/spec/construction_prompt_v0.2.0.md
  - docs/process/blocker_triage_policy.md
  - docs/process/branching_and_pr_policy.md
  - docs/process/definition_of_ready.md
  - docs/process/implementation_workflow.md
  - docs/process/review_gate_matrix.md
  - docs/process/ssot_governance.md
  - docs/process/work_package_template.md
  - docs/operations/go_no_go_checklist.md
  - docs/regulatory/human_review_checklist.md
  - docs/plan/phase0_plan.md
  - docs/plan/uiux_development_plan.md
  - docs/ssot_index.md
forbidden_files:
  - apps/**
  - packages/**
  - scripts/**
  - package.json
  - pnpm-lock.yaml
  - database schema and migrations
  - production/external systems
unrelated_dirty_changes: main worktree WP-7001 changes under apps/api/package.json, apps/api/src/dynamodb/**, and pnpm-lock.yaml are excluded by isolated worktree /tmp/yrese-wp9001
mapper_findings: Active AGT, SPEC, PRC, OPS-012, REG-006, plan overlays, Plans.md, State.md, AGENTS.md, and CLAUDE.md formed one atomic routing impact radius.
pre_plan_review: Initial narrow plan was CHANGES_REQUIRED; expanded atomic plan was accepted subject to preservation of human/evidence gates and post-change independent verification.

implementation_plan:
  - completed: review batch stayed PROPOSED and legacy AGTs stayed APPROVED until required reviews passed.
  - completed: governance, safety, privacy, ambiguity, metadata, and Plans routing findings were resolved by the sole maintainer.
  - completed: independent verifier, spec guardian, and medical/privacy/security specialists approved the corrected diff.
  - completed: base-aware matrix restored formerly APPROVED revisions, approved AGT-018, retained PLAN-UIUX-001 as PROPOSED, and superseded legacy AGTs metadata-only.
  - completed: AGT-016/017 missing metadata was added; all legacy AGTs passed 23-field, status, effective date, supersession, body-identity, and index audits.
  - completed: data_integrity_auditor approved PRC-007 v0.3.1 / IDX-001 v0.4.1 based on inventory 173/142, legacy semantic preservation, AGT 17 integrity, and validation gates; WP-9002 records the later post-landing migration.
  - completed: exact-stage landing commit 86be6b1 was pushed to origin/main after the rebase and all post-rebase validation, governance, and data-integrity gates passed.
test_plan:
  - pnpm check:ssot-index
  - pnpm test:scripts
  - pnpm check:secrets
  - pnpm check:boundaries
  - git diff --check
  - targeted rg audit for current unfinished legacy gates and premature status claims
review_focus: agent-routing precedence, WP-vs-SSOT authority, human safety gates, PHI/Cloud/privilege split, atomic status transition, historical provenance, unrelated WIP exclusion
expected_failures: no validation failure is accepted; any landing-time drift or unrelated-path inclusion returns the WP to CHANGES_REQUESTED before commit
rollback_method: git revert the single WP-9001 documentation commit; no migration, data mutation, deployment, or external action
security_impact: governance only; deny-by-default, tenant isolation, secret rules, and security human gates must remain unchanged or stricter
privacy_phi_pii_impact: no PHI/PII used; synthetic/de-identified repository work only; Cloud/production/external data handling remains human-gated
medical_safety_impact: routing change only; Codex medical reviewers supplement but never replace pharmacist/patient-safety human authority
calculation_claim_impact: no rule values or claim behavior changed; human claims practitioner and evidence gates remain mandatory
data_integrity_impact: no data/schema write; DB/migration/append-only rules remain unchanged
ui_ux_accessibility_impact: ownership routing changes to sole Codex maintainer; U4 medical/privacy/accessibility/human gates remain
offline_edge_impact: none
performance_slo_impact: none
migration_deploy_external_action_impact: none performed or authorized; every such action remains separately human-gated
human_gates: direct user instruction authorizes Codex-only repository routing; pharmacist, claims, legal, production security, medical-risk, Cloud/PHI/external/privilege, deployment, migration, DML, and destructive-action approvals remain distinct

handoff_record: historical pre-landing handoff completed from isolated /tmp/yrese-wp9001 after data_integrity approval; Codex root exact-staged the reviewed paths and landed commit 86be6b1 to origin/main (86fa45c..86be6b1)
verification_record: initial independent review CHANGES_REQUIRED -> sole-maintainer fixes -> independent_verifier APPROVED; spec_guardian final APPROVED
specialist_review_records: medical_safety_reviewer, privacy_compliance_reviewer, security_critic, and data_integrity_auditor APPROVED; data-integrity evidence covers inventory 173/142, legacy semantics/body/status/approval/effective preservation, AGT 17 body/status/23-field, and gates PASS
validation_commands:
  - pnpm -r typecheck
  - pnpm -r test
  - pnpm -r build
  - pnpm check:openapi
  - pnpm check:calculation-purity
  - pnpm check:ssot-index
  - pnpm test:scripts
  - pnpm check:secrets
  - pnpm check:deps
  - pnpm check:sbom
  - pnpm check:boundaries
  - git diff --check
validation_results: PASS — all workspace typecheck and build commands passed; workspace tests passed with audit 173, API 161 plus 9 expected integration skips because TEST_DATABASE_URL was absent, web 63, and all other workspace tests passing; OpenAPI, calculation purity, SSOT index 173, script harness, secret scan, boundaries, and diff check passed; dependency audit high=0 / critical=0; SBOM contained 231 components; governance and data-integrity reviews APPROVED; no code/package/lock/DB/external/deploy changes
remaining_risks: []
landing_required: satisfied
landing_record: commit 86be6b1 `WP-9001: switch repository governance to Codex only` pushed successfully to origin/main (86fa45c..86be6b1); post-rebase gates and governance/data-integrity reviews APPROVED
```

- [~] WP-9002 legacy SSOT frontmatter migration(IN_PROGRESS、W1-W31 + WP-9005/9006 LANDED、W32 NO_ELIGIBLE、WP-0020〜0023 ledger reconciled `6dff2a3`、remaining57 classification LANDED `e654938`、P1)

```yaml
work_package_id: WP-9002
wave_id: WP-9002-W1
title: legacy SSOT frontmatter migration wave 1 — QUA-007 canary
status: IN_PROGRESS
execution_state: W1_LANDED
landing_state: satisfied
priority: P1
risk_level: R2
implementation_layer: ssot_metadata
baseline_commit: 619806842135e4a1d08d84488b771c06e12f8778
baseline_inventory:
  total: 173
  incomplete: 142
  complete: 31
target_inventory:
  total: 173
  incomplete: 141
  complete: 32
target_ssot:
  ssot_id: QUA-007
  path: docs/quality/quality_transparency_strategy.md
  baseline_body_bytes_after_first_yaml_closing_fence: 3336
  baseline_body_sha256: 3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851
allowed_files:
  - docs/quality/quality_transparency_strategy.md
  - docs/ssot_index.md
  - Plans.md
  - State.md
forbidden_files:
  - every path not listed in allowed_files
owner_role: sole_maintainer
reviewer_roles:
  - independent_verifier
  - spec_guardian
  - data_integrity_auditor
specialist_roles:
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - security_critic
pre_plan_review: APPROVED canary plan; QUA-007 is the only migrated SSOT in W1
review_records:
  - independent_verifier / spec_guardian / data_integrity_auditor / medical_safety_reviewer / privacy_compliance_reviewer / security_critic combined review APPROVED.
  - Review evidence confirms exact four-path scope, QUA body identity at 3336 bytes and SHA-256 3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851, and status/version/approval unchanged.
  - BLOCKED_LEGAL_REVIEW remains active; claim evidence/evidenceRef behavior remains fail-closed; PHI/PII non-exposure remains unchanged; metadata adds no semantic activation.
purpose: Prove the PRC-007 legacy metadata-only migration workflow on one bounded APPROVED quality SSOT before issuing later waves.
frontmatter_rules:
  - QUA-007 keeps version 0.1.1 and preserves status, approved_at, approved_by, owner, reviewers, created_at, source_refs, depends_on, impacts, blockers, and open_questions exactly.
  - QUA-007 updated_at becomes 2026-07-10; effective_from/effective_to are explicit null; related_work_packages is exactly [WP-0043, WP-9002-W1]; related_tests/related_prs/evidence_ids are empty arrays.
  - QUA-007 change_log points to the body history as authoritative and records a non-versioned 2026-07-10 WP-9002-W1 metadata-only completion with body/status/approval/effective semantics/version unchanged.
  - QUA-007 approved_by does not add data_integrity_auditor or any new approval authority.
  - Bytes after the first yaml closing fence remain exactly 3336 with SHA-256 3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851.
  - IDX-001 review diff remained v0.4.2 PROPOSED with approved_at, approved_by, and effective_from blank until all W1 reviewers approved; finalization now records the approved review evidence and 2026-07-10 approval/effective metadata.
  - IDX-001 preserves historical 173/142 statements, total 173, and the QUA-007 APPROVED/path row while recording the distinct W1 baseline 173/142/31 and target 173/141/32.
  - All 172 non-target SSOT missing-field sets remain byte-for-byte equivalent as exact key sets to baseline HEAD.
  - Metadata completion does not activate external KPI publication, claim behavior, evidence/evidenceRef semantics, PHI/PII handling, or any product/runtime behavior.
stop_conditions:
  - QUA-007 body bytes/hash or any preserved frontmatter value changes.
  - Any non-target SSOT missing-field set changes, any index row/status/path drift, or inventory differs from 173/141/32.
  - Any edit outside the four exact allowed paths, validation failure, or reviewer CHANGES_REQUIRED finding.
  - Any semantic change or attempted activation of policy, legal, medical-safety, claim/evidence, privacy, security, or external-publication behavior; remove it from W1 and require the applicable human approval in a separate WP.
finalization_gates:
  - Combined independent/spec/data-integrity/medical-safety/privacy/security review APPROVED with no unresolved finding.
  - QUA-007 body, status, version, approval, effective semantics, BLOCKED_LEGAL_REVIEW, claim evidence/evidenceRef fail-closed behavior, and PHI/PII non-exposure remain unchanged.
  - Sole maintainer finalized IDX-001 approval metadata only after the approved review evidence was recorded; the complete post-finalization validation bundle must remain PASS.
  - Codex root exact-stages only the four allowed paths after finalization verification; stage, commit, and requested push remain root-only.
rollback_method: Revert only the four WP-9002-W1 paths; no schema/data migration, deployment, external action, or destructive operation exists.
validation_commands:
  - exact 23-field top-level key scanner with baseline non-target set comparison
  - exact QUA-007 preserved-frontmatter audit
  - QUA-007 body byte/SHA-256 audit
  - exact four-path diff audit
  - historical 173/142 retention and QUA index row audit
  - pnpm check:ssot-index
  - pnpm test:scripts
  - pnpm check:secrets
  - pnpm check:boundaries
  - git diff --check
validation_results: FINAL PASS — QUA current file remains exactly 4663 bytes / SHA-256 e7a7e7ec8800288e9865da6c2ed878862e25887373b7617bf5087bd83aa62e7c; QUA body remains HEAD-identical at 3336 bytes / SHA-256 3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851 with all preserved values unchanged; exact 23-field scan confirms 173 total / 141 incomplete / 32 complete, QUA missing 0, and all 172 non-target missing-field sets identical; IDX-001 v0.4.2 APPROVED with six W1 reviewers, WP-9001 provenance, historical 173/142 and final 173/141/32; QUA index APPROVED/path and total 173 unchanged; exact four-path unstaged diff, check:ssot-index, test:scripts, secrets, boundaries, and diff checks PASS
finalization_record: IDX-001 v0.4.2 APPROVED with approved_at/effective_from 2026-07-10 and WP-9001 provenance plus all six WP-9002-W1 approvals; QUA-007 current file remains byte-for-byte unchanged
landing_required: satisfied
landing_record: commit 41c4d9f `WP-9002-W1: normalize QUA-007 frontmatter` pushed successfully to origin/main (6198068..41c4d9f); inventory 173/141/32, QUA current file 4663 bytes / SHA-256 e7a7e7ec8800288e9865da6c2ed878862e25887373b7617bf5087bd83aa62e7c, QUA body 3336 bytes / SHA-256 3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851, six-reviewer and validation gates PASS; no code, DB, migration, external, deployment, or destructive change
overall_state: WP-9002 remains IN_PROGRESS with 141 incomplete SSOT documents; no later wave has started, and the next wave requires a new read-only mapping and pre-plan review before any edit
```

#### WP-9002-W2 MOD-011/MOD-014 legacy frontmatter migration — LANDED

```yaml
work_package_id: WP-9002
wave_id: WP-9002-W2
title: legacy SSOT frontmatter migration wave 2 — module policy pair
status: IN_PROGRESS
execution_state: W2_LANDED
landing_state: satisfied
priority: P1
risk_level: R2
implementation_layer: ssot_metadata
baseline_commit: 73fda4bce9f500fbe9c4dc157c8cc573ca28eee2
baseline_inventory:
  total: 173
  incomplete: 141
  complete: 32
target_inventory:
  total: 173
  incomplete: 139
  complete: 34
target_ssots:
  - ssot_id: MOD-011
    path: docs/modules/date_time_policy.md
    baseline_body_bytes_after_first_yaml_closing_fence: 3041
    baseline_body_sha256: e4a73fad7fc8f47a0485c2d08eab461edd6c5a5a3d024adbcb55775e94b06066
  - ssot_id: MOD-014
    path: docs/modules/generated_code_policy.md
    baseline_body_bytes_after_first_yaml_closing_fence: 2507
    baseline_body_sha256: ed145a48bdda369e64c7d7b4e3d88b6e759d1bb4397c1b637cb1e4781c698d16
allowed_files:
  - docs/modules/date_time_policy.md
  - docs/modules/generated_code_policy.md
  - docs/ssot_index.md
  - Plans.md
  - State.md
forbidden_files:
  - every path not listed in allowed_files
owner_role: sole_maintainer
reviewer_roles:
  - independent_verifier
  - spec_guardian
  - data_integrity_auditor
specialist_roles:
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - api_contract_reviewer
  - test_architect
human_gate: required before any semantic, policy, medical-safety, privacy, API-contract, test-policy, approval, or effective-semantics change; W2 stops and splits such work into a separate WP
pre_plan_review: APPROVED; exact two-target metadata-only wave with traceable impacts/tests and frozen body/approval semantics
review_records:
  - independent_verifier APPROVED
  - test_architect APPROVED
  - spec_guardian APPROVED
  - api_contract_reviewer APPROVED
  - data_integrity_auditor APPROVED
  - medical_safety_reviewer APPROVED
  - privacy_compliance_reviewer APPROVED
  - No W2 human approval is claimed; reviewers confirmed metadata-only scope without semantic, approval-authority, effective-semantics, DB, or external change.
frontmatter_rules:
  - MOD-011 and MOD-014 preserve version 0.1.1, status, approved_at, approved_by, owner, reviewers, created_at, source_refs, depends_on, open_questions, and blockers exactly; no W2 reviewer is added to target approved_by.
  - Both targets set updated_at to 2026-07-10, effective_from/effective_to to null, related_prs/evidence_ids to empty arrays, and add only the approved impacts, work packages, tests, and non-versioned migration change log.
  - MOD-011 impacts are packages/date-time, packages/events wallClock/instant boundary, apps/api reception business-date derivation, and apps/web reception date/time presentation; work packages are WP-0012/WP-4053/WP-9002-W2; tests are the date-time package, API server, PostgreSQL repository integration, and web reception dashboard targets.
  - MOD-014 impacts are packages/contracts, docs/api/openapi.yaml, scripts/check-openapi.mjs, and the future generated-client boundary (unimplemented; no coverage claim); work packages are WP-0012/WP-4019/WP-9002-W2; tests are pnpm check:openapi and pnpm test:scripts.
  - Each target change_log references body history as authoritative and records WP-9002-W2 metadata-only completion with body/status/version/approval/effective semantics unchanged.
  - After all seven W2 reviewers approved, IDX-001 v0.4.3 was finalized APPROVED with approved_at/effective_from 2026-07-10; approved_by preserves all prior WP-9001/W1 provenance and appends only the seven W2 reviewer approvals, with no W2 human approval claim.
  - All existing reviewers including human_review_if_required and W1 roles, historical 173/142, W1 173/141/32, index rows/status/path, and total 173 remain intact.
  - All 171 non-target SSOT missing-field sets remain identical to baseline HEAD.
stop_conditions:
  - Either target body bytes/hash or any preserved frontmatter value changes.
  - Any non-target missing-field set changes, index row/status/path drift, inventory other than 173/139/34, or edit outside the five exact paths.
  - Any semantic/effective/approval change, validation failure, or reviewer CHANGES_REQUIRED; require applicable human authority and a separate WP where relevant.
review_gates:
  - independent_verifier, spec_guardian, and data_integrity_auditor approve the combined diff and inventory proof.
  - medical_safety_reviewer and privacy_compliance_reviewer approve MOD-011 metadata scope and reception date/time boundary non-change.
  - api_contract_reviewer and test_architect approve MOD-014 metadata scope and generated-contract/test policy non-change.
  - After approvals, sole maintainer may finalize IDX-001 approval metadata; Codex root alone exact-stages, commits, and performs the requested push.
validation_commands:
  - exact 23-field scanner and 171 non-target missing-set comparison
  - target preserved-frontmatter and body byte/SHA-256 audits
  - exact five-path and staged-zero audit
  - historical 173/142, W1 173/141/32, W2 173/139/34, index row/status/path, and total-173 audit
  - pnpm --filter @yrese/date-time test
  - pnpm --filter @yrese/api exec vitest run src/server.test.ts
  - pnpm --filter @yrese/api exec vitest run src/db/postgres-repositories.integration.test.ts
  - pnpm --filter @yrese/web exec vitest run app/reception-dashboard.test.tsx
  - pnpm check:openapi
  - pnpm test:scripts
  - pnpm check:ssot-index
  - pnpm check:secrets
  - pnpm check:boundaries
  - git diff --check
validation_results: FINAL PASS — inventory 173/139/34, both targets missing 0, all 171 non-target missing-field sets baseline-identical, MOD-011 current review file 4679 bytes / SHA-256 a929603619981b113bb81c209584900e1f78275806d47388e2d1fd0754675074 and body 3041 bytes / SHA-256 e4a73fad7fc8f47a0485c2d08eab461edd6c5a5a3d024adbcb55775e94b06066, MOD-014 current review file 3786 bytes / SHA-256 0fa815faebec490b3c0704c00271b8e705939cf209679c056208240aeb42e032 and body 2507 bytes / SHA-256 ed145a48bdda369e64c7d7b4e3d88b6e759d1bb4397c1b637cb1e4781c698d16, preserved fields and W1 records byte-identical, exact five paths and staged 0; date-time 8, API server 43, web reception 10 tests PASS; PostgreSQL repository integration 7 expected skips because TEST_DATABASE_URL was absent, with no DB connection, migration, or DML operation; OpenAPI, scripts, SSOT index 173, secrets, boundaries, and diff checks PASS; all seven reviewer gates APPROVED
finalization_record: IDX-001 v0.4.3 APPROVED with approved_at/effective_from 2026-07-10, all prior provenance preserved, seven W2 reviewer approvals appended, and no W2 human approval claimed; MOD-011 and MOD-014 remain byte-for-byte identical to the approved review diff
landing_required: satisfied
landing_record: commit ff7518f `WP-9002-W2: normalize module metadata` pushed successfully to origin/main (73fda4b..ff7518f); inventory 173/139/34; MOD-011 current file 4679 bytes / SHA-256 a929603619981b113bb81c209584900e1f78275806d47388e2d1fd0754675074 and body 3041 bytes / SHA-256 e4a73fad7fc8f47a0485c2d08eab461edd6c5a5a3d024adbcb55775e94b06066; MOD-014 current file 3786 bytes / SHA-256 0fa815faebec490b3c0704c00271b8e705939cf209679c056208240aeb42e032 and body 2507 bytes / SHA-256 ed145a48bdda369e64c7d7b4e3d88b6e759d1bb4397c1b637cb1e4781c698d16; independent_verifier, test_architect, spec_guardian, api_contract_reviewer, data_integrity_auditor, medical_safety_reviewer, and privacy_compliance_reviewer APPROVED; date-time 8, API server 43, web reception 10 PASS, PostgreSQL integration 7 expected skips because TEST_DATABASE_URL was absent with no DB connection/migration/DML, OpenAPI/scripts/SSOT/secrets/boundaries/diff gates PASS; no code, DB, external, deployment, or destructive change
overall_state: WP-9002 remains [~] / IN_PROGRESS with 139 incomplete SSOT documents; W1 and W2 are LANDED, W3 has not started, and a new read-only mapping and pre-plan review are required before any W3 edit
```

#### WP-9002-W3 MOD-006/MOD-007 legacy frontmatter migration — LANDED

```yaml
work_package_id: WP-9002
wave_id: WP-9002-W3
title: legacy SSOT frontmatter migration wave 3 — error and permission registries
status: IN_PROGRESS
execution_state: W3_LANDED
landing_state: satisfied
priority: P1
risk_level: R2
implementation_layer: ssot_metadata
baseline_commit: 3e8dee054f808ad25022b9f731d96a9fe34f59c3
baseline_inventory: { total: 173, incomplete: 139, complete: 34 }
target_inventory: { total: 173, incomplete: 137, complete: 36 }
target_ssots:
  - ssot_id: MOD-006
    path: docs/modules/error_code_registry.md
    baseline_body_bytes_after_first_yaml_closing_fence: 3509
    baseline_body_sha256: 96ebdea1a65b949e77ef4165dd3049cc4f7e7eeda27904dce19a8f67e075e84c
  - ssot_id: MOD-007
    path: docs/modules/permission_scope_registry.md
    baseline_body_bytes_after_first_yaml_closing_fence: 2139
    baseline_body_sha256: 94974900b71ece2bcdf025b876e661e7692e8174e54d4cd4f887a2ce01ea86f0
allowed_files:
  - docs/modules/error_code_registry.md
  - docs/modules/permission_scope_registry.md
  - docs/ssot_index.md
  - Plans.md
  - State.md
  - ops/refactor/STATE.md
forbidden_files:
  - every path not listed in allowed_files
owner_role: sole_maintainer
reviewer_roles:
  - independent_verifier
  - spec_guardian
  - data_integrity_auditor
specialist_roles:
  - security_critic
  - api_contract_reviewer
  - test_architect
  - medical_safety_reviewer
  - privacy_compliance_reviewer
human_gate: none for the exact metadata-only scope; stop and split any semantic, authorization, claimability, approval/effective, medical, privacy, security, evidence, code, DB, external, or deployment change
mapping_record: read-only mapping confirmed clean HEAD/origin at baseline, both targets missing the same seven fields, 171 non-target canonical missing-set baseline 22739 bytes / SHA-256 40b4506bfa956eed0303348fa62945dfe9456d123ba4942395993abfcd49ca42, and no semantic/human-gated change required
pre_plan_review: APPROVED; exact six-path R2 metadata-only wave, with MOD-006 patient-search test removed as non-direct and MOD-007 whoami contract test added as direct scope validation
review_records:
  - independent_verifier APPROVED
  - spec_guardian APPROVED
  - data_integrity_auditor APPROVED
  - security_critic APPROVED
  - api_contract_reviewer APPROVED after direct implementation WP provenance was completed
  - test_architect APPROVED after direct implementation WP provenance was completed
  - medical_safety_reviewer APPROVED
  - privacy_compliance_reviewer APPROVED
  - No W3 human approval is claimed; all reviewers confirmed metadata-only scope and preserved legacy human authority.
frontmatter_rules:
  - MOD-006 preserves version 0.1.2 and MOD-007 preserves version 0.1.1; both preserve status, approved_at, approved_by, owner, reviewers, created_at, source_refs, depends_on, open_questions, blockers, and body exactly.
  - Both targets set updated_at to 2026-07-11, effective_from/effective_to to null, related_prs/evidence_ids to empty arrays, and add only the mapped impacts, work packages, tests, and non-versioned W3 migration change log.
  - MOD-006 traces shared-kernel error registry, contract/OpenAPI error validation, API registered responses and Web registered-code filtering to WP-0012/WP-3009-BE/WP-4015/WP-4036/WP-4062/WP-9002-W3 and their direct tests.
  - MOD-007 traces shared-kernel permission scopes, API tenant authorization/protected routes, Web dev least-privilege headers and contract/OpenAPI scope declarations to WP-0012/WP-2002/WP-3009-BE/WP-4042/WP-4065/WP-9002-W3 and their direct tests.
  - No W3 reviewer is added to either target approved_by. IDX-001 v0.4.4 remains PROPOSED with approval/effective fields null during review and preserves all W1/W2 provenance.
  - All 171 non-target missing-field sets, historical inventories, index rows/status/path and total 173 remain identical to baseline.
stop_conditions:
  - Either target body bytes/hash or any preserved frontmatter value changes.
  - Any non-target missing-set drift, inventory other than 173/137/36, index drift, edit outside six paths, validation failure, or reviewer CHANGES_REQUIRED.
  - Any error/permission/claimability/authorization/tenant/evidence/medical/privacy/security semantic change; split to a separate WP with applicable human authority.
review_gates:
  - independent_verifier, spec_guardian, and data_integrity_auditor approve exact scope, body/preserved-field and inventory proof.
  - security_critic and privacy_compliance_reviewer approve authorization/PHI boundary non-change.
  - api_contract_reviewer and test_architect approve contract/OpenAPI/test provenance without behavior change.
  - medical_safety_reviewer approves error/claimability/human-review semantics non-change.
  - After all eight approvals only, sole maintainer may finalize IDX-001; Codex root alone exact-stages, commits, and pushes.
validation_commands:
  - exact 23-field scanner, target preservation/body hashes, and 171 non-target missing-set comparison
  - exact six-path and staged-zero audit; historical inventory/index ledger audit
  - pnpm --filter @yrese/shared-kernel test
  - pnpm --filter @yrese/contracts exec vitest run src/error.test.ts src/whoami.test.ts
  - pnpm --filter @yrese/api exec vitest run src/server.test.ts
  - pnpm --filter @yrese/web exec vitest run app/components/error-notice.test.tsx app/patients/patient-search.test.tsx app/reception-dashboard.test.tsx
  - pnpm check:openapi
  - pnpm test:scripts
  - pnpm check:ssot-index
  - pnpm check:secrets
  - pnpm check:boundaries
  - git diff --check
validation_results: FINAL PASS before landing — exact six paths/staged 0; inventory 173/137/36; target missing 0; MOD-006 body 3509 bytes / SHA-256 96ebdea1a65b949e77ef4165dd3049cc4f7e7eeda27904dce19a8f67e075e84c and MOD-007 body 2139 bytes / SHA-256 94974900b71ece2bcdf025b876e661e7692e8174e54d4cd4f887a2ce01ea86f0 unchanged; all preserved target fields unchanged; 171 non-target canonical missing-set 22739 bytes / SHA-256 40b4506bfa956eed0303348fa62945dfe9456d123ba4942395993abfcd49ca42; shared-kernel 23, contracts 23, API 43, Web 28 PASS; OpenAPI, scripts, SSOT index 173, secrets, boundaries and diff check PASS; all eight reviewer gates APPROVED
finalization_record: IDX-001 v0.4.4 APPROVED with approved_at/effective_from 2026-07-11, all WP-9001/W1/W2 provenance preserved, eight W3 approvals appended, and no W3 human approval claimed; MOD-006/MOD-007 remain byte-for-byte identical to the approved review candidate
landing_required: commit_and_push after finalization
landing_record: commit 1b07db6 `WP-9002-W3: normalize error and permission metadata` pushed successfully to origin/main (3e8dee0..1b07db6); inventory 173/137/36; exact six paths; MOD-006 body 3509 bytes / SHA-256 96ebdea1a65b949e77ef4165dd3049cc4f7e7eeda27904dce19a8f67e075e84c and MOD-007 body 2139 bytes / SHA-256 94974900b71ece2bcdf025b876e661e7692e8174e54d4cd4f887a2ce01ea86f0; all eight reviewer and validation gates APPROVED; no code, DB, external, deployment, or destructive change
overall_state: W3 LANDED; WP-9002 remains IN_PROGRESS with 137 incomplete SSOT documents and W4 requires fresh read-only mapping and pre-plan review
```

#### WP-9002-W4 remaining MOD/TST legacy frontmatter migration — LANDED

```yaml
work_package_id: WP-9002
wave_id: WP-9002-W4
title: remaining module and test-strategy legacy metadata migration
status: IN_PROGRESS
execution_state: W4_LANDED
landing_state: satisfied
priority: P1
risk_level: R2
implementation_layer: ssot_metadata
baseline_commit: 5d68633
baseline_inventory: { total: 173, incomplete: 137, complete: 36 }
target_inventory: { total: 173, incomplete: 126, complete: 47 }
target_ssots:
  - MOD-001 common_module_inventory
  - MOD-002 common_module_boundary
  - MOD-003 dependency_direction_policy
  - MOD-004 shared_type_registry
  - MOD-005 status_registry
  - MOD-008 audit_event_registry
  - MOD-009 event_envelope_schema
  - MOD-010 money_point_policy
  - MOD-012 validation_schema_policy
  - MOD-013 fixture_policy
  - TST-001 test_strategy
allowed_files: eleven target SSOTs plus docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact total 15
owner_role: sole_maintainer
reviewer_roles: [independent_verifier, spec_guardian, data_integrity_auditor]
specialist_roles: [test_architect, security_critic, api_contract_reviewer, medical_safety_reviewer, privacy_compliance_reviewer]
human_gate: none for exact metadata-only scope; stop/split any semantic, approval/effective, evidence, security/privacy, medical/claim, DB, external, deployment, or production change
mapping_record: clean baseline 5d68633; exact eleven targets; body hashes fixed in mapper evidence; 162 non-target canonical missing-set 21306 bytes / SHA-256 2725393dd4eee5cd7949dc43238edbb4df2a962dd23c15ae23c6b882a51d1a5d
pre_plan_review: APPROVED as one bounded R2 wave; TST-001 blockers=[] means no document-level approval blocker and does not change body BLOCKED/planned test categories
review_records:
  - independent_verifier APPROVED
  - spec_guardian APPROVED
  - data_integrity_auditor APPROVED
  - test_architect APPROVED after direct calculation-purity/secret-test provenance completion
  - api_contract_reviewer APPROVED after direct MOD-012 provenance completion
  - security_critic APPROVED
  - medical_safety_reviewer APPROVED
  - privacy_compliance_reviewer APPROVED
  - No W4 human approval is claimed; all reviewers confirmed exact metadata-only scope and preserved legacy human authority.
frontmatter_rules:
  - Preserve every target body, version, status, owner, reviewers, created_at, approved_at/by, source_refs, depends_on, open_questions, and existing blockers exactly.
  - Set updated_at 2026-07-11, effective_from/to null, related_prs/evidence_ids empty; add only approved conservative impacts/WPs/tests and non-versioned W4 history.
  - Add missing change_log only to MOD-009/MOD-010/MOD-013; add TST-001 blockers=[] only as document-level metadata.
  - Do not add W4 reviewers to target approved_by. Keep target human approval unchanged.
  - IDX-001 v0.4.5 remains PROPOSED with approval/effective fields null until all eight reviews approve; preserve W1-W3 provenance and every index row.
stop_conditions:
  - Any target body/hash or preserved field changes; any non-target missing-set/index/history drift; inventory not 173/126/47; path outside exact 15.
  - Any reviewer CHANGES_REQUIRED or validation failure; any metadata that would alter policy, blocker, approval, effective, medical, privacy, security, evidence, or runtime semantics.
review_gates:
  - independent/spec/data-integrity verify exact paths, all bodies/preserved fields, inventory, non-target identity and index history.
  - test/API/security/privacy/medical specialists verify provenance and semantic non-change across test, contract, audit, fixture, status and money boundaries.
  - After eight approvals only, sole maintainer may finalize IDX-001; root alone exact-stages, commits, and pushes.
validation_commands:
  - exact 23-field, eleven body/preserved-field, 162 non-target and exact-path/staged-zero audits
  - pnpm -r typecheck
  - pnpm -r test
  - pnpm -r build
  - pnpm check:openapi
  - pnpm check:calculation-purity
  - pnpm test:scripts
  - pnpm check:ssot-index
  - pnpm check:secrets
  - pnpm check:boundaries
  - pnpm check:deps
  - pnpm check:sbom
  - git diff --check
validation_results: FINAL PASS before landing — exact 15 paths/staged 0; inventory 173/126/47; eleven target missing 0 and bodies/preserved fields baseline-identical; 162 non-target canonical missing-set 21306 bytes / SHA-256 2725393dd4eee5cd7949dc43238edbb4df2a962dd23c15ae23c6b882a51d1a5d; workspace typecheck/test/build PASS (audit 182, events 45, contracts 86, web 99, API 161 + expected PostgreSQL skips 9); OpenAPI, calculation purity, scripts, SSOT 173, secrets, boundaries, deps high=0/critical=0, SBOM 231 and diff check PASS; all eight reviewers APPROVED
finalization_record: IDX-001 v0.4.5 APPROVED with approved_at/effective_from 2026-07-11, all WP-9001/W1-W4 prior provenance preserved, eight W4 approvals appended, and no W4 human approval claimed; eleven targets remain byte-identical to approved review candidate
landing_required: commit_and_push after finalization
landing_record: commit 09070f3 `WP-9002-W4: normalize remaining module metadata` pushed successfully to origin/main (5d68633..09070f3); inventory 173/126/47; exact 15 paths; eleven target bodies/preserved fields and 162 non-target missing-set unchanged; all eight reviewer and full validation gates APPROVED; no code, DB, external, deployment, or destructive change
overall_state: W4 LANDED; WP-9002 remains IN_PROGRESS with 126 incomplete SSOT documents and W5 requires fresh read-only mapping and pre-plan review
```

#### WP-9002-W5A API legacy frontmatter migration — LANDED

```yaml
work_package_id: WP-9002
wave_id: WP-9002-W5A
title: all eight legacy API SSOT metadata migration
status: IN_PROGRESS
execution_state: W5A_LANDED
landing_state: satisfied
priority: P1
risk_level: R2
baseline_commit: 134864c
baseline_inventory: { total: 173, incomplete: 126, complete: 47 }
target_inventory: { total: 173, incomplete: 118, complete: 55 }
target_ssots: [API-001, API-002, API-003, API-004, API-005, API-006, API-007, API-008]
allowed_files: eight docs/api targets plus docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact total 12
owner_role: sole_maintainer
reviewer_roles: [independent_verifier, spec_guardian, data_integrity_auditor]
specialist_roles: [api_contract_reviewer, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: none for exact metadata-only completion; external publication, legal, FHIR conformance, security/privacy, medical, approval/effective, DB/runtime changes stop and split
mapping_record: clean baseline 134864c; 165 non-target canonical missing-set 20481 bytes / SHA-256 479459faefe5ea55412d508559bd486162eec68955a10b57f9a13ef6303b6ca0; eight target body hashes pinned in mapper evidence
pre_plan_review: APPROVED_WITH_PINS; API-008 stays PROPOSED/null approval, API-004 PENDING_REVISION and API-005/API-008 blockers remain exact, API-004/005/008 related_tests stay empty
review_records:
  - independent_verifier APPROVED
  - spec_guardian APPROVED
  - data_integrity_auditor APPROVED
  - api_contract_reviewer APPROVED
  - test_architect APPROVED
  - security_critic APPROVED
  - privacy_compliance_reviewer APPROVED
  - medical_safety_reviewer APPROVED
  - No W5A human approval is claimed; API-005 legal and API-008 conformance/security/official-adapter gates remain unresolved.
frontmatter_rules:
  - Preserve all target bodies, versions, statuses, owners/reviewers, created/approval values, sources, dependencies, impacts, existing questions/blockers and API-004 amendment fields exactly.
  - Set updated_at 2026-07-11, effective_from/to null, related_prs/evidence_ids empty; add only mapped WPs/tests and W5A metadata history.
  - Add absent questions/blockers as [] only at document level; no body stop condition is released. API-008 approved_at/by are explicit null.
  - Do not add W5A reviewers to target approved_by. IDX v0.4.6 remains PROPOSED/null approval until eight reviews approve.
stop_conditions:
  - Any body/hash/preserved/amendment/blocker drift, non-target fingerprint or index/history drift, inventory other than 173/118/55, path outside exact 12, validation failure or CHANGES_REQUIRED.
  - Any API semantic, external publication, FHIR/legal/security/privacy/medical/evidence/DB/runtime activation or approval/effective change.
review_gates:
  - independent/spec/data-integrity verify exact paths, bodies/preserved fields, inventory, non-target identity and index history.
  - API/test/security/privacy/medical reviewers verify provenance and all non-activation pins.
  - After eight approvals only, root finalizes IDX, revalidates, exact-stages, commits, and pushes.
validation_commands:
  - exact 23-field/body/preserved/non-target/index/exact-path/staged-zero audits
  - pnpm -r typecheck
  - pnpm -r test
  - pnpm -r build
  - pnpm check:openapi
  - pnpm test:scripts
  - pnpm check:ssot-index
  - pnpm check:secrets
  - pnpm check:boundaries
  - pnpm check:deps
  - pnpm check:sbom
  - git diff --check
validation_results: FINAL PASS before landing — exact12/staged0; inventory173/118/55; eight target missing0/bodies/preserved fields and API-004 amendment exact; API-008 PROPOSED/null approval; 165 non-target missing-set 20481 bytes / SHA-256 479459faefe5ea55412d508559bd486162eec68955a10b57f9a13ef6303b6ca0; workspace typecheck/test/build PASS (audit182, contracts86, web99, API161 + expected skips9); OpenAPI/scripts/SSOT173/secrets/boundaries/deps high0 critical0/SBOM231/diff PASS; eight reviewers APPROVED
finalization_record: IDX-001 v0.4.6 APPROVED with approved_at/effective_from 2026-07-11, all prior provenance preserved and eight W5A approvals appended; API targets unchanged from approved review candidate and API-008 remains PROPOSED
landing_required: commit_and_push after finalization
landing_record: commit 74666c9 `WP-9002-W5A: normalize API metadata` pushed successfully to origin/main (134864c..74666c9); inventory 173/118/55; exact 12 paths; eight API bodies/preserved/amendment/blocker states and 165 non-target set unchanged; all eight reviewer/full validation gates APPROVED; no code, DB, external, deployment, or destructive change
overall_state: W7B and WP-9005/9006 LANDED; WP-9002 remains IN_PROGRESS with 83 incomplete SSOT documents and the next wave requires fresh mapping/pre-plan
```

#### WP-9002-W5B architecture legacy metadata — LANDED

```yaml
baseline_commit: ff7fb77
baseline_inventory: { total: 173, incomplete: 118, complete: 55 }
target_inventory: { total: 173, incomplete: 108, complete: 65 }
targets: [ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ARC-006, ARC-007, ARC-008, ARC-010, ARC-011]
allowed_files: ten architecture targets plus index/Plans/State/ops; exact14
pre_plan_review: APPROVED_WITH_PINS
pins: preserve all bodies/approval/amendments/blockers; ARC-003/004/010 named blockers copied from body; ARC-011 document-level empty questions/blockers; no architecture/FHIR/AWS/NSIPS/offline/claim activation
non_target: 163 docs / 19207 bytes / SHA-256 de1e412784e06230c83f258da86d19a61d4689c40dca62a37432f1e226f340b2
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, api_contract_reviewer]
validation: exact invariants plus workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/test/security/privacy/medical/APIの9 roleがAPPROVED。本文byte identity、preserved fields、ARC-005/007 amendment、ARC-008 amends/human approval/4 blocker、NSIPS/FHIR/AWS/PHI/法務/患者安全/API非activationを確認
validation_results: exact14/staged0、inventory173/108/65、target missing0、10本文hashと対象外163 missing-set 19207 bytes / SHA-256 de1e412784e06230c83f258da86d19a61d4689c40dca62a37432f1e226f340b2を確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS
finalization_record: IDX-001 v0.4.7 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and nine W5B approvals appended; architecture targets unchanged from approved review candidate
landing_record: commit 05edac6 `WP-9002-W5B: normalize architecture metadata` pushed successfully to origin/main (ff7fb77..05edac6); inventory 173/108/65; exact14; ten bodies, preserved/amendment/blocker states and 163 non-target fingerprint unchanged; nine reviews and full validation APPROVED; no code, DB, external, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W5C starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W5C adapters legacy metadata — LANDED

```yaml
baseline_commit: 34d0a6e
baseline_inventory: { total: 173, incomplete: 108, complete: 65 }
target_inventory: { total: 173, incomplete: 106, complete: 67 }
targets: [ADP-001, ADP-002]
allowed_files: two adapter targets plus index/Plans/State/ops; exact6
mapping: adapters pair selected over domain/database/masters as the smallest coherent low-interpretation wave
pre_plan_review: APPROVED_WITH_PINS
pins: preserve both bodies/status/version/human approval/source/dependencies/impacts/questions; ADP-001 blocker exact; ADP-002 common official-spec blocker is a document-level umbrella only and does not replace regulatory/MVP/JAHIS/NSIPS/pharmacist/privacy/security/external gates; no adapter/external behavior activation
non_target: 171 docs / 19429 bytes / SHA-256 6d777f91fb4db380dc8c3cd83c76c27e8f779b91946922565224c0e84753b346
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, api_contract_reviewer, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
validation: exact invariants plus workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/API/test/security/privacy/medicalの9 roleがAPPROVED。本文/人間承認/ADP-001 blocker、ADP-002 umbrellaと全個別gate、非activationを確認
validation_results: exact6/staged0、inventory173/106/67、target missing0、2本文/preserved fields、対象外171 missing-set 19429 bytes / SHA-256 6d777f91fb4db380dc8c3cd83c76c27e8f779b91946922565224c0e84753b346を確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS
finalization_record: IDX-001 v0.4.8 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and nine W5C approvals appended; adapter targets unchanged from approved review candidate
landing_record: commit 86319a4 `WP-9002-W5C: normalize adapter metadata` pushed successfully to origin/main (34d0a6e..86319a4); inventory 173/106/67; exact6; two bodies, preserved/blocker states and 171 non-target fingerprint unchanged; nine reviews and full validation APPROVED; no code, DB, external, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W5D starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W5D masters legacy metadata — LANDED

```yaml
baseline_commit: 6ca8fc6
baseline_inventory: { total: 173, incomplete: 106, complete: 67 }
target_inventory: { total: 173, incomplete: 104, complete: 69 }
targets: [MST-001, MST-002]
allowed_files: two masters targets plus index/Plans/State/ops; exact6
mapping: mutual dependency is pre-existing APPROVED meaning and both targets migrate atomically without changing it
pre_plan_review: APPROVED_WITH_PINS
pins: preserve bodies/status/version/human approval/source/mutual dependencies/impacts/questions and MST-001 blocker exact; MST-002 blockers are direct body copies only; document evidence_ids empty does not waive per-master/per-mapping evidence; no JAHIS/master ingestion/DB/production/Edge distribution activation
non_target: 171 docs / 19224 bytes / SHA-256 a70313e77b512d9fab89f0f82fb1fd2568724bdb2e2342a34507d7d7b8007ade
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, claims_evidence_or_master_data_specialist]
validation: exact invariants plus workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/test/security/privacy/medical/claims-evidence-master-dataの9 roleがAPPROVED。本文/人間承認/相互依存/evidence blocker、document evidence非免除、非activationを確認
validation_results: exact6/staged0、inventory173/104/69、target missing0、2本文/preserved fields、対象外171 missing-set 19224 bytes / SHA-256 a70313e77b512d9fab89f0f82fb1fd2568724bdb2e2342a34507d7d7b8007adeを確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS
finalization_record: IDX-001 v0.4.9 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and nine W5D approvals appended; masters targets unchanged from approved review candidate
landing_record: commit ea2ddf2 `WP-9002-W5D: normalize masters metadata` pushed successfully to origin/main (6ca8fc6..ea2ddf2); inventory 173/104/69; exact6; two bodies, preserved/dependency/blocker states and 171 non-target fingerprint unchanged; nine reviews and full validation APPROVED; no code, DB, external, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W5E starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W5E database legacy metadata — LANDED

```yaml
baseline_commit: 96cc1dd
baseline_inventory: { total: 173, incomplete: 104, complete: 69 }
target_inventory: { total: 173, incomplete: 99, complete: 74 }
targets: [DB-001, DB-002, DB-003, DB-004, DB-005]
allowed_files: five database targets plus index/Plans/State/ops; exact9
mapping: database selected over domain because existing amendments/blockers/questions bound semantic risk; all five migrate atomically
pre_plan_review: APPROVED_WITH_PINS
pins: preserve all bodies/status/version/approval/source/dependencies/impacts and DB-001..004 ARC-008 amendment metadata; DB-001/002 empty blockers are document-level only; DB-003/004 questions copy body unresolved items without reverse-injecting DB-005; DB-005 tests cover audit subsets only; document evidence empty does not waive security/legal/FHIR/production evidence; no DB/migration/DDL/DML/AWS/FHIR/production activation
non_target: 168 docs / 18537 bytes / SHA-256 c3a067a4c5f587933645a2dfcd92407412e5795b610cfbabd9d0afaf25a803c1
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, test_architect, api_contract_reviewer]
validation: exact invariants plus workspace typecheck/test/build, focused DB/DynamoDB tests, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/DB/test/API/security/privacy/medicalの10 roleがAPPROVED。本文/承認/ARC-008 amendments/blockers/questions、限定test provenance、非activationを確認
validation_results: exact9/staged0、inventory173/99/74、target missing0、5本文/preserved fields、対象外168 missing-set 18537 bytes / SHA-256 c3a067a4c5f587933645a2dfcd92407412e5795b610cfbabd9d0afaf25a803c1を確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS
finalization_record: IDX-001 v0.4.10 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and ten W5E approvals appended; database targets unchanged from approved review candidate
landing_record: commit a57bacd `WP-9002-W5E: normalize database metadata` pushed successfully to origin/main (96cc1dd..a57bacd); inventory 173/99/74; exact9; five bodies, preserved amendment/blocker/question states and 168 non-target fingerprint unchanged; ten reviews and full validation APPROVED; no DB connection, migration, DDL/DML, AWS, FHIR, production, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W5F starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W5F domain legacy metadata — LANDED

```yaml
baseline_commit: ebb4ca4
baseline_inventory: { total: 173, incomplete: 99, complete: 74 }
target_inventory: { total: 173, incomplete: 93, complete: 80 }
targets: [DOM-001, DOM-002, DOM-003, DOM-004, DOM-005, DOM-006]
allowed_files: six domain targets plus index/Plans/State/ops; exact10
mapping: all six domain SSOTs migrate atomically; broad existing questions remain verbatim and are not expanded
pre_plan_review: APPROVED_WITH_PINS
pins: preserve bodies/status/version/approval/source/dependencies/questions and DOM-005 ARC-008 amendment; WP-1101 is commit-history-only provenance; DOM-001/004/005 blockers are direct body mappings; DOM-002/003 empty blockers are document-level only; DOM-006 existing blocker is not changed and body evidence/conformance gates are not waived; no FHIR/adapter/claim/medical/security/production activation
non_target: 167 docs / 17899 bytes / SHA-256 59f36f3faa9ee985826f4e47613985fd0e113ff5298f4eb64c6893fcf3aeed28
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, api_contract_reviewer, claims_evidence_specialist]
validation: exact invariants plus workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/test/API/claims-evidence/security/privacy/medicalの10 roleがAPPROVED。本文/承認/questions/DOM-005 amendment/DOM-006 blocker、evidence non-waiver、非activationを確認
validation_results: exact10/staged0、inventory173/93/80、target missing0、6本文/preserved fields、対象外167 missing-set 17899 bytes / SHA-256 59f36f3faa9ee985826f4e47613985fd0e113ff5298f4eb64c6893fcf3aeed28を確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS
finalization_record: IDX-001 v0.4.11 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and ten W5F approvals appended; domain targets unchanged from approved review candidate
landing_record: commit 5976a0a `WP-9002-W5F: normalize domain metadata` pushed successfully to origin/main (ebb4ca4..5976a0a); inventory 173/93/80; exact10; six bodies, preserved question/amendment/blocker states and 167 non-target fingerprint unchanged; ten reviews and full validation APPROVED; no FHIR, adapter, claim, medical, security, external, production, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W6 starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W6A PLAN-DB legacy metadata — LANDED

```yaml
baseline_commit: 05a1edc
baseline_inventory: { total: 173, incomplete: 93, complete: 80 }
target_inventory: { total: 173, incomplete: 92, complete: 81 }
targets: [PLAN-DB-001]
allowed_files: PLAN-DB target plus index/Plans/State/ops; exact5
mapping: PLAN-PHASE0-GATE-001 excluded because stale historical blocker semantics require substantive amendment; claim pair excluded for claims/evidence semantics
pre_plan_review: APPROVED_WITH_PINS
pins: preserve PROPOSED/version/body/source/dependencies/impacts/open-question and null approval/effective semantics; blockers are six named body stops only; WP-5001..5008 are plan provenance; DB tests prove only local migration/repository subsets and expected skips, not later phases or production readiness; no DB/migration/infra/claims/medical/security/production activation
non_target: 172 docs / 17939 bytes / SHA-256 467e8abc0be46885d836cd570e1a7a4264c35e914032c46ead8f132820729709
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, claims_evidence_specialist]
validation: exact invariants plus workspace typecheck/test/build, DB focused tests, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: independent/spec/data-integrity/architect/DB/test/claims-evidence/security/privacy/medicalの10 roleがAPPROVED。本文/PROPOSED/null approval/open question/6 blockers、限定test provenance、非activationを確認
validation_results: exact5/staged0、inventory173/92/81、target missing0、本文15082 bytes/hash、対象外172 missing-set 17939 bytes / SHA-256 467e8abc0be46885d836cd570e1a7a4264c35e914032c46ead8f132820729709を確認。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0 critical0、SBOM231、diff PASS。DB integrationはTEST_DATABASE_URLなしでexpected skip
finalization_record: IDX-001 v0.4.12 APPROVED with approved_at/effective_from 2026-07-11; all prior provenance preserved and ten W6A approvals appended; PLAN-DB remains PROPOSED/null approval/effective and target body unchanged
landing_record: commit 07bdc96 `WP-9002-W6A: normalize database plan metadata` pushed successfully to origin/main (05a1edc..07bdc96); inventory 173/92/81; exact5; PLAN-DB body/PROPOSED/null approval/6 blockers and 172 non-target fingerprint unchanged; ten reviews/full validation APPROVED; no DB connection, migration, DDL/DML, infra, production, deploy, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and W6B starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W6B QUA-004 legacy metadata — LANDED

```yaml
baseline_commit: 2d695fa
baseline_inventory: { total: 173, incomplete: 92, complete: 81 }
target_inventory: { total: 173, incomplete: 91, complete: 82 }
targets: [QUA-004]
allowed_files: QUA-004 plus index/Plans/State/ops; exact5
mapping: QUA-001/003 excluded because APPROVED bodies conflict with AGT-018 and require semantic governance reconciliation; QUA-002/005/006/008/009, regulatory and receipt remain excluded for claims/legal/production/external semantics
pre_plan_review: APPROVED_WITH_PINS after shrinking from the rejected quality-core proposal
pins: preserve body/status/version/human approval/source/dependencies; impacts are direct policy consumers; questions copy the two body unresolved items exactly; blockers empty is document-level only and does not waive critical/high release prohibition, human review, regression/golden or SSOT-first rules; no quality gate/incident/legal/production activation
non_target: 172 docs / 17807 bytes / SHA-256 54f8fede62a60732cb37d399cc65981dfa918a21689bfdfda6700bed70f5d45f
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, claims_evidence_specialist]
validation: exact invariants plus workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: nine required roles APPROVED; no actionable findings; empty tests/evidence/blockers are document-level non-claims and do not waive normative defect gates
validation_results: FINAL PASS before landing — exact5/staged0; inventory173/91/82; QUA-004 body 1409 bytes/SHA-256 2016ae0b47a3cb5f2d1d60af25f282b28f7a8c039f267a8b090dd300414b2ae9; non-target172/17807/54f8fede62a60732cb37d399cc65981dfa918a21689bfdfda6700bed70f5d45f; typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS; API 161 plus 9 expected PostgreSQL skips without TEST_DATABASE_URL
finalization_record: IDX-001 v0.4.13 APPROVED with approved_at/effective_from 2026-07-11, all prior provenance preserved and nine W6B approvals appended
landing_required: commit_and_push after finalization
landing_record: commit c9a2641 `WP-9002-W6B: normalize defect metadata` pushed successfully to origin/main (2d695fa..c9a2641); inventory 173/91/82; exact5; QUA-004 body and 172 non-target records unchanged; nine reviews/full gates APPROVED; no code, DB, external, deployment, or destructive change
state: LANDED; WP-9002 remains IN_PROGRESS and the next wave starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W6C CAL-010/011 legacy metadata — LANDED

```yaml
baseline_commit: 76afa17
baseline_inventory: { total: 173, incomplete: 89, complete: 84 }
target_inventory: { total: 173, incomplete: 87, complete: 86 }
targets: [CAL-010, CAL-011]
allowed_files: CAL-010, CAL-011 plus index/Plans/State/ops; exact6
pre_plan_review: APPROVED_WITH_PINS
pins: preserve body/status/version/approval/owner/reviewers/source/dependencies/impacts/questions/blockers; effective null; related PRs/evidence empty; policy-level empty evidence does not waive per-golden EVD references, CAL-003/REG-007 recheck or required human review; no rule/point/condition/claimability change
body_hashes: { CAL-010: 3250 bytes / 0491f54d3b8c27658ec16a0813349d1138a152011d736d200c2850d4f7eb2f64, CAL-011: 3146 bytes / b89da978400689ce262d0c2640f7e3c47665cefe2e781e34925c0b4a2520f4c9 }
non_target: 171 canonical rows / 17326 bytes / SHA-256 58c51344159f8ac41b269577d3386203f3e5266ec02149db93a740d285f1fe7c
test_scope: calculation20, calculation-purity and script regression are direct partial evidence only; they do not prove complete CAL-010 conformance, a complete golden catalog, calculation requirements, copay/claim/regulatory/production readiness
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
validation: body/preserved/inventory/non-target/exact-path invariants plus workspace typecheck/test/build, calculation-purity, OpenAPI, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: all nine required roles APPROVED; no actionable findings; approvals do not replace claims/regulatory/human/risk/production authority
validation_results: FINAL PASS before landing — exact6/staged0; target bodies and preserved fields byte-identical; all23; inventory173/87/86; non-target171/17326/58c51344159f8ac41b269577d3386203f3e5266ec02149db93a740d285f1fe7c; workspace typecheck/test/build PASS; calculation20, audit182, contracts86, web99, API161 plus 9 expected PostgreSQL skips without TEST_DATABASE_URL; calculation-purity, OpenAPI, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231, diff PASS
finalization_record: IDX-001 v0.4.15 APPROVED with approved_at/effective_from 2026-07-11, all prior provenance preserved and nine W6C approvals appended; target legacy approvals unchanged
landing_required: exact6 commit_and_push
landing_record: commit 8eb3e98 `WP-9002-W6C: normalize calculation policy metadata` pushed successfully to origin/main (76afa17..8eb3e98); inventory 173/87/86; exact6; target bodies/legacy approvals and 171 non-target rows unchanged; nine reviews/full gates APPROVED; no calculation/claim/evidence/code/DB/external/production/deployment change
state: LANDED; WP-9002 remains IN_PROGRESS and the next wave starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W7A SEC-003 legacy metadata — LANDED

```yaml
baseline_commit: 7098c2d
baseline_inventory: { total: 173, incomplete: 85, complete: 88 }
target_inventory: { total: 173, incomplete: 84, complete: 89 }
target: SEC-003
allowed_files: SEC-003 plus index/Plans/State/ops; exact5
mapping: SEC-001/004/006/007/008 excluded for stale routing or implementation-state semantics; SEC-005 excluded for APPROVED/status-blocker self-contradiction; all require separate semantic/security/human review
pre_plan_review: APPROVED_WITH_PINS
pins: preserve body/status/version/human approval/owner/reviewers/source/deps/impacts/questions/blockers/existing history; effective null; tests are partial control evidence only; policy evidence empty is non-waiver; no threat/risk/residual/security/privacy/medical/DB/KMS/production/risk-acceptance change
body_hash: 4434 bytes / SHA-256 6b12b651fe05126b6fe781c83536ee65cc0d9fbb535c904b60557dfdddd75635
non_target: 172 canonical rows / 17122 bytes / SHA-256 d7abe6d4d311a3be41bd466dcd9aebdfa36872863b0f59629ec64a19e3515fd7
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, api_contract_reviewer, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
validation: body/preserved/inventory/non-target/exact-path, partial related tests, workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
review_results: all ten required roles APPROVED; no actionable findings; approvals do not replace human security/privacy/medical/DB/KMS/production/risk authority
validation_results: FINAL PASS before landing — exact5/staged0; SEC-003 body/preserved fields byte-identical and all23; inventory173/84/89; non-target172/17122/d7abe6d4d311a3be41bd466dcd9aebdfa36872863b0f59629ec64a19e3515fd7; events45, API server43, Web transport36 and workspace typecheck/test/build PASS; audit182, contracts86, web99, API161 plus 9 expected PostgreSQL skips; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231, diff PASS
finalization_record: IDX-001 v0.4.17 APPROVED with approved_at/effective_from 2026-07-11, all prior provenance preserved and ten W7A approvals appended; SEC-003 legacy approval/status/version unchanged
landing_required: exact5 commit_and_push
landing_record: commit 464f454 `WP-9002-W7A: normalize threat model metadata` pushed successfully to origin/main (7098c2d..464f454); inventory 173/84/89; exact5; SEC-003 body/legacy approval and 172 non-target rows unchanged; ten reviews/full gates APPROVED; no security/privacy/medical/DB/KMS/code/external/production/deployment change
state: LANDED; WP-9002 remains IN_PROGRESS and the next wave starts only after fresh read-only mapping/pre-plan
```

#### WP-9002-W7B ACC-007 legacy metadata — LANDED

```yaml
baseline_commit: 4b99ab7
baseline_inventory: { total: 173, incomplete: 84, complete: 89 }
target_inventory: { total: 173, incomplete: 83, complete: 90 }
target: ACC-007
allowed_files: ACC-007 plus index/Plans/State/ops; exact5
pre_plan_review: APPROVED_WITH_PINS
pins: preserve body/status/version/approval/owner/reviewers/source/deps/three questions; blocker empty means document-validity only; no implementation/scope/ready claim; WP-0037/0038 remain pending; related tests/PRs/evidence empty because no direct DailyCashClosing/CashDrawerSession implementation exists
body_hash: 1383 bytes / SHA-256 3fc2b5680e069c282df8964cf101b50450363afd63cb7c438f51f7181251e6d3
non_target: 172 canonical rows / 16991 bytes / SHA-256 7de30c7d4639763749d4e92475aa05b8ccaa72d8870d38f445869e285ba23a9c
nonactivation: ACC-001 copay blocker, Charge-before-Payment, WP-2201/3101, audit persistence/wiring, LOCAL_ONLY recovery/dedup, ACC-011 taxonomy drift, POS/OTC/journal/HQ/Phase2 and production remain unresolved
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
validation: body/preserved/inventory/non-target/exact-path plus workspace typecheck/test/build and all repo gates as regression-only evidence
review_results: all ten required roles APPROVED; no actionable findings; reviews do not replace human pharmacy/accounting/claims/product/legal/privacy/security/production authority
validation_results: FINAL PASS before landing — exact5/staged0; body/preserved fields/3 questions byte-identical and all23; inventory173/83/90; non-target172/16991/7de30c7d4639763749d4e92475aa05b8ccaa72d8870d38f445869e285ba23a9c; workspace typecheck/test/build PASS; audit182, contracts86, web99, API161 plus 9 expected PostgreSQL skips; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates; no direct ACC runtime test exists
finalization_record: IDX-001 v0.4.18 APPROVED with approved_at/effective_from 2026-07-11, all prior provenance preserved and ten W7B approvals appended; ACC-007 legacy approval/status/version unchanged
landing_required: exact5 commit_and_push
landing_record: commit e8477c9 `WP-9002-W7B: normalize daily closing metadata` pushed successfully to origin/main (4b99ab7..e8477c9); inventory 173/83/90; exact5; ACC-007 body/legacy approval/3 questions and 172 non-target rows unchanged; ten reviews/full regression gates APPROVED; no accounting/claim/API/DB/code/external/production/deployment change
state: LANDED; WP-9002 remains IN_PROGRESS and the next wave starts only after fresh read-only mapping/pre-plan
```

- [x] WP-9003 repository reconciliation state pack(Codex-only、resume-safe、docs-only)
  - Scope: `ops/refactor/{STATE,CODE_MAP,CHANGE_LOG,VERIFICATION,HIGH_RISK_CHANGES,PENDING_DECISIONS,SCAN_LOG}.md`, `Plans.md`, `State.md` only.
  - Acceptance / evidence: AGT-018をactive governanceとし、landed commits、current validation、terminal task split、high-risk rollback/human gate、WP-9002 inventory/next actionを同期。旧dual-lane / agmsg / model gate / SSOT 172 / commit_request文言をactive stateから除去し、`ops/refactor/STATE.md`だけで安全に再開可能にした。
  - Verification: independent verifier、`pnpm check:ssot-index`(173)、scripts/secrets/boundaries/diff check。product code、DB、migration、external、deploy変更なし。rollbackはWP-9003 docs commitのrevert。

- [x] WP-9004a SAF-001 critical aggregate correction(LANDED / commit 0b0b5ba)
  - Scope: `docs/safety/medical_safety_risk_register.md`の集計件数だけを、表のcritical 11行・既存11 IDへ一致させる。severity/risk/mitigation/evidence/status/version/approvalは不変。
  - Acceptance: table critical count=11、ID集合=`MSR-001,005,006,007,016,020,021,022,031,032,033`、summary count/list一致、SAF-001はsummary行以外byte-identical、exact4/staged0。
  - Review/verification: pre-plan APPROVED_WITH_PINS、independent verifier + medical-safety reviewer APPROVED。critical count/set/summary-only assertion、SSOT173、scripts、secrets、boundaries、diff PASS。exact4/staged0。rollbackはsummaryの`11件`を`9件`へ戻す単一行revert。
  - WP-9004b: SAF-001/002のevidence freshness（`WP-1006実装中`、`WP-2002予定`、`WP-2003予定`等）をlive code/testへ照合する別WP。推測更新せず、現時点はread-only mapping/review前。
  - Landing: commit `0b0b5ba`を`origin/main`へpush。critical summary-only correction、exact4、independent/medical approval、全docs gates PASS。コード/DB/runtime/external変更なし。

- [x] WP-9005 quality governance AGT-018 compatibility amendment(LANDED、commit 2b26c06)

```yaml
work_package_id: WP-9005
baseline_commit: bfb806c
baseline_inventory: { total: 173, incomplete: 91, complete: 82 }
target_inventory: { total: 173, incomplete: 89, complete: 84 }
purpose: Remove stale model/dual-lane/agmsg routing and stale not-created claims from QUA-001/003 while preserving all quality, medical, claims, regulatory, security/privacy, incident, rollback and human-authority gates.
targets: [QUA-001 v0.1.2, QUA-003 v0.1.1]
allowed_files: QUA-001, QUA-003, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact6
forbidden: code/packages/lock/other SSOT; risk class or threshold changes; human/domain gate removal; SaMD/medical/claims/privacy/security/legal/production/risk acceptance decisions
pre_plan_review: APPROVED_WITH_PINS
pins: review candidate PROPOSED/null approval; owner/reviewers align to AGT-018 roles; prior Phase0 human approvals remain historical only; C1-C5, C5 72h human review/incident, golden/regression, synthetic-only, rollback/rehearsal, master no-immediate-production and evidence/versioning gates remain normative; human authority is never replaced by Codex reviewers
body_changes: QUA-001 maker-checker and existing QUA-004/005/006 references; QUA-003 C2/C3 maker-checker/specialist/human flow, ad-hoc consensus prohibition and Codex-root/read-only-mapper impact analysis
non_target: 171 docs / canonical `<path>\t<PRC-007-order comma-joined missing fields>\n` rows / 17568 bytes / SHA-256 315025491df9d8862387561bd4f3bc47f64c39199a2cc77601cc5bfc4432f051
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, claims_evidence_specialist]
acceptance: exact6/staged0; both targets have all 23 fields; active owner/reviewer/body routing contains no stale model, Claude, agmsg or dual-lane authority; index/status/version aligned; human/domain gates not weakened; full validation passes
validation: targeted stale-token and governance matrix; inventory/non-target/exact-path; workspace typecheck/test/build; OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
rollback: revert only the exact6 landing commit; because that would restore known governance contradictions, immediately re-open WP-9005 as BLOCKED and do not use stale routing
review_results: independent_verifier, spec_guardian, data_integrity_auditor, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer and claims_evidence_specialist APPROVED after correcting the non-target fingerprint evidence; no actionable findings remain
validation_results: FINAL PASS before landing — exact6/staged0; inventory173/89/84; both targets all23; active body stale-routing scan clean; 171 non-target canonical rows `17568/315025491df9d8862387561bd4f3bc47f64c39199a2cc77601cc5bfc4432f051`; workspace typecheck/test/build PASS; audit182, contracts86, web99, API161 plus 9 expected PostgreSQL skips without TEST_DATABASE_URL; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS
finalization_record: QUA-001 v0.1.2, QUA-003 v0.1.1 and IDX-001 v0.4.14 APPROVED with approved_at/effective_from 2026-07-11; prior human approvals preserved as history only; WP-9001 direct cutover plus eight WP-9005 reviews recorded
landing_required: exact6 commit_and_push
landing_record: commit 2b26c06 `WP-9005: align quality governance with AGT-018` pushed successfully to origin/main (bfb806c..2b26c06); exact6; inventory 173/89/84; eight reviews/full gates APPROVED; no code, DB, external, production, deployment or destructive change
state: LANDED
```

- [x] WP-9006 product scope AGT-018 routing compatibility amendment(LANDED、commit 770590a)

```yaml
work_package_id: WP-9006
baseline_commit: 47154bd
baseline_inventory: { total: 173, incomplete: 87, complete: 86 }
target_inventory: { total: 173, incomplete: 85, complete: 88 }
purpose: Replace stale active model/lane routing in PRD-001/002 while preserving every product-scope, claim-stop, reactivation, market, pharmacist, claims, legal and human decision.
targets: [PRD-001 v0.1.1, PRD-002 v0.1.1]
allowed_files: PRD-001, PRD-002, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact6
forbidden: other product/claim/calculation docs, code/tests/packages/lock; M1-M12 or N1-N14 changes; open question/blocker/claimability/reactivation/product/legal/pharmacist/claims decisions
pre_plan_review: APPROVED_WITH_PINS
body_changes: exactly PRD-001 change-management routing line and PRD-002 no-side-implementation routing line; all other body content must remain byte-equivalent
pins: review candidate PROPOSED/null; old human approvals historical only; owner/reviewers role-based; WP-0019/WP-0038 remain pending substantive amendments and are not completed/adopted; exact routing amendment uses WP-9001 authority, but any scope byte change requires human product/pharmacist/claims/legal approval
metadata: both WPs [WP-0006, WP-0019, WP-0038, WP-9001, WP-9006]; shared-kernel test is only fail-closed status/isClaimable subset evidence; related PRs/evidence empty; no readiness claim
non_target: 171 canonical rows / 17183 bytes / SHA-256 037b3f5b8bf8a7e88a38fc5de03de2dcf9bf07d2988dbef44c34826c95311e98
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, api_contract_reviewer, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
validation: exact body-line/inventory/non-target/path assertions, shared-kernel test, workspace typecheck/test/build, OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff
rollback: revert exact6 landing commit; immediately re-open WP-9006 as BLOCKED because revert restores known routing conflict, and never use old routing as authority
review_results: all ten required roles APPROVED after moving the orphan WP-9004a landing bullet and aligning target reviewer metadata; no actionable findings remain; approvals do not replace product/pharmacist/claims/legal human authority
validation_results: FINAL PASS before landing — exact6/staged0; exactly two intended body lines changed and all M1-M12/N1-N14/open questions/blockers/reactivation conditions preserved; all23; inventory173/85/88; non-target171/17183/037b3f5b8bf8a7e88a38fc5de03de2dcf9bf07d2988dbef44c34826c95311e98; shared-kernel23 and workspace typecheck/test/build PASS; audit182, contracts86, web99, API161 plus 9 expected PostgreSQL skips; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS
finalization_record: PRD-001/002 v0.1.1 and IDX-001 v0.4.16 APPROVED with approved_at/effective_from 2026-07-11; prior human approvals historical only; WP-9001 direct cutover plus ten WP-9006 reviews recorded; no scope decision adopted
landing_required: exact6 commit_and_push
landing_record: commit 770590a `WP-9006: align product scope routing with AGT-018` pushed successfully to origin/main (47154bd..770590a); exact6; inventory 173/85/88; ten reviews/full gates APPROVED; no scope, claim, API, code, DB, external, production, deployment or destructive change
state: LANDED
```

- [x] WP-9007 SEC-008 audit security fact/routing freshness semantic amendment(LANDED、commit 4a2cefd、P1)

```yaml
work_package_id: WP-9007
baseline_commit: e14dd04
baseline_inventory: { total: 173, incomplete: 83, complete: 90 }
target_inventory: { total: 173, incomplete: 82, complete: 91 }
target: SEC-008 v0.1.2
purpose: Synchronize stale WP-2009/WP-2010 future wording with implemented audit pure core while keeping persistence, physical WORM, KMS/RLS, retention, break-glass operations and production wiring explicitly unimplemented/human-gated.
allowed_files: SEC-008, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other SSOT/code/tests/packages/lock; persistence adapter/schema/migration/DML; AWS/WORM/KMS/RLS choice; break-glass feature/auth; retention/legal/risk acceptance; production/deploy/external action
pre_plan_review: APPROVED_WITH_PINS; privacy/medical conservative clarification incorporated before final review
body_changes: exactly five bounded edit areas — WP-5004a/WP-2009 hash/hydrate facts, fake-hash prohibition wording, WP-2010 break-glass registry/businessReason facts with explicit caller-supplied correlation/causation boundary, fail-closed stop rules (pure-core+persistence joint evidence and separate WORM authority/operations condition), plus v0.1.2 history
pins: distinguish implemented create/hash/hydrate/chain pure core from unimplemented append-only persistence/WORM/production; require both pure-core and applicable persistence proof for tamper-evident external claims; preserve physical-candidate table, four adoption prerequisites, both questions and BLOCKED_SECURITY_REVIEW; no cross-event runtime enforcement claim; complete all 23 frontmatter fields
expected_body: 5738 bytes / SHA-256 f9104fa8728da7e65333d1e7af162862830ce2e84afbf79ba3ba71ea9e9def8c
non_target: 172 canonical rows / 16879 bytes / SHA-256 060cf2b2ddf3e60b03c7f8580527d2b36313d8409ad24b349cdf4c5571bb2ccd
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, api_contract_reviewer, test_architect, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: exact live-fact/routing correction needs no new risk acceptance; any physical WORM/KMS/RLS, retention/legal, tenant, break-glass authorization, production wiring/deploy or risk decision stops for applicable human authority
validation: exact5/body-edit/hash/inventory/non-target assertions, audit pure-core symbols/tests, workspace typecheck/test/build and all repo gates
rollback: revert exact5 landing and reopen WP-9007 BLOCKED; never use reverted future wording to disable implemented pure-core validation or imply production WORM readiness
review_findings: privacy/medical found ambiguous either-or WORM readiness wording and potential cross-event enforcement overclaim; narrowed within existing scope without changing human gates. Initial history/hash and missing top-level change_log findings corrected before final review.
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, api_contract_reviewer, test_architect, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED after regenerated pin and conservative clarification; no human risk acceptance added.
validation_results: FINAL PASS before landing — exact5/staged0; SEC-008 all23 and body5738/f9104fa8728da7e65333d1e7af162862830ce2e84afbf79ba3ba71ea9e9def8c; inventory173/82/91; non-target172/16879/060cf2b2ddf3e60b03c7f8580527d2b36313d8409ad24b349cdf4c5571bb2ccd; audit182, workspace typecheck/test/build PASS; API161 plus 9 expected PostgreSQL skips without TEST_DATABASE_URL; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS.
finalization_record: SEC-008 v0.1.2 and IDX-001 v0.4.19 APPROVED with approved_at/effective_from 2026-07-11; prior 0.1.1 approval is historical only; WP-9001 direct cutover plus ten WP-9007 role approvals recorded; no physical WORM/KMS/RLS, retention/legal, break-glass authorization, persistence or production decision adopted.
landing_required: exact5 commit_and_push
landing_record: commit 4a2cefd `WP-9007: synchronize audit security facts` pushed successfully to origin/main (d43a905..4a2cefd); exact5; inventory173/82/91; ten reviews/full gates APPROVED; no physical WORM/KMS/RLS, retention/legal, break-glass authorization, persistence, production, DB, external, deployment or destructive change.
state: LANDED
```

- [x] WP-9002-W7C ACC-008 payment-method registry metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W7C
baseline_commit: 375c1ee
baseline_inventory: { total: 173, incomplete: 82, complete: 91 }
target_inventory: { total: 173, incomplete: 81, complete: 92 }
target: ACC-008 v0.2.0 metadata-only; body/status/version/legacy approval semantics preserved
purpose: Complete PRC-007 23-field metadata for the already-approved payment-method registry without changing payment, POS, charge, receipt, claim, tenant, or production semantics.
allowed_files: ACC-008, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other ACC/PRD/claim docs, code/tests/packages/lock; payment/accounting/POS implementation, schema/migration/DML, external settlement/send, production/deploy, method/scope/business-rule changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain byte-identical
pins: preserve body1256/987fea1d913e41a5a1469c87f84a7b8fba7d9cd060a2a0a053243b0c3752d4bd; APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/deps `[ACC-001, ACC-009]`/single provider-device open_question/body history; legacy model names are historical provenance only under AGT-018
metadata: updated_at 2026-07-11; effective_from/effective_to null; impacts `[ACC-007 daily closing aggregation, future WP-2201 accounting ledger implementation, future WP-3101 accounting UI implementation]`; related_work_packages `[WP-0033, WP-0037, WP-0038, WP-2201, WP-3101, WP-9002-W7C]`; related_tests/related_prs/evidence_ids empty; top-level change_log only; blockers empty only for validity, never implementation/readiness
non_target: 172 canonical rows / 16778 bytes / SHA-256 097329f5e8a578160b0771c01f6ca26212402e6bfa334cdcb3e23f6284fdfe54
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; payment-method addition/removal, CASH/MVP or mixed-payment rule, POS/provider/device settlement, copay/Charge/claim linkage, product scope, production DB/API/external integration, or residual-risk decision stops for applicable accounting/pharmacy operations/claims/product/legal/privacy/security authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; no direct ACC-008 test or evidence; workspace typecheck/test/build and OpenAPI, calculation-purity, scripts, SSOT, secrets, boundaries, deps, SBOM, diff are regression-only gates
rollback: revert exact5 landing only and reopen W7C metadata incompleteness; never alter registry semantics, unlock copay/payment/POS/production, or revive stale routing
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; no semantic/payment/POS/tenant/claim/production activation and no new human approval claim.
validation_results: FINAL PASS before landing — exact5/staged0; ACC-008 body/preserved fields byte-identical and all23; inventory173/81/92; non-target172/16778/097329f5e8a578160b0771c01f6ca26212402e6bfa334cdcb3e23f6284fdfe54; workspace typecheck/test/build PASS; API161 plus 9 expected PostgreSQL skips without TEST_DATABASE_URL; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates.
finalization_record: ACC-008 retains APPROVED/v0.2.0/legacy approval/effective null; IDX-001 v0.4.20 APPROVED with approved_at/effective_from 2026-07-11 and prior approval provenance plus ten W7C roles; empty direct tests/evidence/blockers do not waive payment/POS/claim/production gates.
landing_required: satisfied
landing_record: commit 57172ca `WP-9002-W7C: normalize payment method metadata` is present on origin/main and is an ancestor of current HEAD; exact5; inventory173/81/92; ACC-008 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; no payment/POS/claim/tenant/DB/production/external/deployment activation
state: LANDED; WP-9002 remains IN_PROGRESS with 81 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W8 RCP-005 receipt-template registry metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W8
baseline_commit: 7558084
baseline_inventory: { total: 173, incomplete: 81, complete: 92 }
target_inventory: { total: 173, incomplete: 80, complete: 93 }
target: RCP-005 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 23-field metadata for the already-approved receipt-template registry without changing receipt issuance, template, legal-retention, document-hash, storage, calculation-trace, or production semantics.
allowed_files: RCP-005, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other receipt/regulatory docs, code/tests/packages/lock; receipt generation/reissue/delete, template/hash algorithm, legal interpretation, schema/migration/DML, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1808 bytes / SHA-256 2142925c8a298b450f127459edf77ff55ab63e0ef3afdd0002e7ccaceecf609a
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/blockers; @yrese/events is adjacent lowercase SHA-256-format evidence only, not receipt implementation; reciprocal RCP dependency is out of scope
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-9002-W8]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows must remain unchanged; target review inventory 173/80/93
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; template/legal fields, e-document retention/authenticity, pharmacy customization, receipt contents, hash computation, generation/reissue/delete, DB/production/external behavior, or risk acceptance stops for applicable legal/pharmacy/product/claims/privacy/security authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; broader gates are regression-only and never direct RCP-005 implementation evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock WP-2202 or claim receipt/legal/runtime readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/pharmacy/product/claims human authority remains separate for any semantic decision
validation_results: FINAL PASS before landing — exact5/staged0; RCP-005 all23 and body 1808/2142925c8a298b450f127459edf77ff55ab63e0ef3afdd0002e7ccaceecf609a byte-identical; preserved fields unchanged; inventory173/80/93; 172 non-target missing-set baseline-identical at 16680 bytes / SHA-256 5c19a3002b74e4abd597ad6a308d65c8a717e9b90887e261fb4d568eafd204d5; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-005 retains APPROVED/v0.2.0/legacy approval/effective null and body semantics; IDX-001 v0.4.21 APPROVED with approved_at/effective_from 2026-07-12 and nine W8 role approvals; empty direct tests/PRs/evidence do not waive receipt/legal/hash/storage/runtime/production gates
landing_required: satisfied
landing_record: commit fbef2c2 `WP-9002-W8: normalize receipt template metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/80/93; RCP-005 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; nine reviews/full regression gates APPROVED; no receipt/template/legal/hash/storage/runtime/DB/production/external activation
state: LANDED; WP-9002 remains IN_PROGRESS with 80 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W9 RCP-006 receipt-privacy policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W9
baseline_commit: d6677f9
baseline_inventory: { total: 173, incomplete: 80, complete: 93 }
target_inventory: { total: 173, incomplete: 79, complete: 94 }
target: RCP-006 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing privacy consent, proxy delivery, PHI, legal fields, permissions, audit behavior, receipt generation, or production semantics.
allowed_files: RCP-006, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other receipt/security/regulatory docs, code/tests/packages/lock; privacy/consent/legal/PHI/permission/audit changes, receipt generation, schema/migration/DML, API/UI, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1862 bytes / SHA-256 1bc7aa7db477fcd8858983201a3117aa8866767c987ce427e76d70a5a2b9b3c8
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/blockers; preserve existing RCP-004 cycle without repair or acyclic claim; adjacent audit/report controls are not direct RCP-006 implementation evidence
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-3101, WP-9002-W9]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16584 bytes / SHA-256 c860764d31f25fe7a1ba34e0d659a8c15be790d37837a78d4f040b32a2c71bee must remain unchanged; target review inventory 173/79/94
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; consent/proxy workflow, legal fields, PHI/log/cache/permission/audit behavior, receipt contents or issuance, WP-2202/3101, DB/API/UI/runtime/production/external behavior, or risk acceptance stops for applicable legal/pharmacy/medical/claims/privacy/security/product authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct RCP-006 evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock privacy behavior, WP-2202/3101, or receipt/legal/runtime readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/pharmacy/product/claims human authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; RCP-006 all23 and body 1862/1bc7aa7db477fcd8858983201a3117aa8866767c987ce427e76d70a5a2b9b3c8 byte-identical; preserved fields unchanged; inventory173/79/94; 172 non-target missing-set baseline-identical at 16584 bytes / SHA-256 c860764d31f25fe7a1ba34e0d659a8c15be790d37837a78d4f040b32a2c71bee; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-006 retains APPROVED/v0.2.0/legacy approval/effective null and privacy semantics; IDX-001 v0.4.22 APPROVED with approved_at/effective_from 2026-07-12 and nine W9 role approvals; empty direct tests/PRs/evidence do not waive consent/PHI/legal/permission/audit/receipt/runtime/production gates
landing_required: satisfied
landing_record: commit ee91fad `WP-9002-W9: normalize receipt privacy metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/79/94; RCP-006 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; nine reviews/full regression gates APPROVED; no privacy/consent/PHI/legal/permission/audit/receipt/runtime/DB/API/UI/production/external activation
state: LANDED; WP-9002 remains IN_PROGRESS with 79 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W10 RCP-002 receipt-numbering policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W10
baseline_commit: d3647bb
baseline_inventory: { total: 173, incomplete: 79, complete: 94 }
target_inventory: { total: 173, incomplete: 78, complete: 95 }
target: RCP-002 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing numbering format, uniqueness/reuse, legal/year boundary, LOCAL_ONLY/recovery, transaction, idempotency, conflict, audit, PHI, or production semantics.
allowed_files: RCP-002, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other receipt/accounting/architecture/regulatory docs, code/tests/packages/lock; numbering/offline/transaction/schema changes, migration/DML, API/UI, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2726 bytes / SHA-256 8fa466890938c07e665dbb6c87a493c8b8408bf48ccd714b8a4eaf749f667535
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/blockers; preserve existing RCP-001 reciprocal dependency without repair or acyclic claim; no direct ReceiptDocument/numbering/runtime/test evidence exists
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-9002-W10]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16483 bytes / SHA-256 0dbb5e5151689dab0cf9f3f3b6b5d9d686a4e914afefcb50cc2c665393c42f05 must remain unchanged; target review inventory 173/78/95
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; legal numbering, fiscal boundary, format/uniqueness/reuse/gaps, PHI, local device allocation/offline issuance/recovery, transaction/idempotency/conflicts/audit, ReceiptDocument, WP-2202, DB/API/UI/runtime/production/external behavior, or risk acceptance stops for applicable authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct RCP-002 evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock WP-2202 or numbering/legal/offline/transaction readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/pharmacy/accounting/product/claims human authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; RCP-002 all23 and body 2726/8fa466890938c07e665dbb6c87a493c8b8408bf48ccd714b8a4eaf749f667535 byte-identical; preserved fields unchanged; inventory173/78/95; 172 non-target missing-set baseline-identical at 16483 bytes / SHA-256 0dbb5e5151689dab0cf9f3f3b6b5d9d686a4e914afefcb50cc2c665393c42f05; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-002 retains APPROVED/v0.2.0/legacy approval/effective null and numbering semantics; IDX-001 v0.4.23 APPROVED with approved_at/effective_from 2026-07-12 and ten W10 role approvals; empty direct tests/PRs/evidence do not waive numbering/legal/year/offline/recovery/transaction/PHI/runtime/production gates
landing_required: satisfied
landing_record: commit 8b8f70f `WP-9002-W10: normalize receipt numbering metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/78/95; RCP-002 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; no numbering/legal/year/offline/recovery/transaction/idempotency/conflict/PHI/receipt/runtime/DB/API/UI/production/external activation
state: LANDED; WP-9002 remains IN_PROGRESS with 78 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W11 RCP-003 receipt-reissue/cancel policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W11
baseline_commit: ab04f9e
baseline_inventory: { total: 173, incomplete: 78, complete: 95 }
target_inventory: { total: 173, incomplete: 77, complete: 96 }
target: RCP-003 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing reissue/cancel/void/replace state, legal/tax display, accounting/refund, audit, atomicity, idempotency, concurrency, PHI, or production semantics.
allowed_files: RCP-003, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other receipt/accounting/audit/regulatory docs, code/tests/packages/lock; state/audit/accounting/schema changes, migration/DML, API/UI, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2805 bytes / SHA-256 0429a418bc44e98511cea207d95fbc50b3054eefdc4944e6e93f9ce55b5b225c
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/blockers; preserve RCP-001 cycle; do not repair or claim completeness for omitted RCP-005 dependency, stale source reference, missing receipt.replaced audit event, or businessReason enforcement mismatch
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-3101, WP-9002-W11]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16379 bytes / SHA-256 a039b7b2433306db2c550e02b8b14c813b7f843032a66f024e8a770b555bc0cf must remain unchanged; target review inventory 173/77/96
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; legal/tax display, fees/accounting/refund, audit taxonomy/businessReason/persistence, transition atomicity/idempotency/concurrency/chain integrity, PHI/tenant/authz/logging, WP-2202/3101, DB/API/UI/runtime/production/external behavior, or risk acceptance stops for applicable authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct RCP-003 evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock receipt state/audit/accounting/legal/runtime readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/tax/accounting/product/claims human authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; RCP-003 all23 and body 2805/0429a418bc44e98511cea207d95fbc50b3054eefdc4944e6e93f9ce55b5b225c byte-identical; preserved fields unchanged; inventory173/77/96; 172 non-target missing-set baseline-identical at 16379 bytes / SHA-256 a039b7b2433306db2c550e02b8b14c813b7f843032a66f024e8a770b555bc0cf; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; audit182; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-003 retains APPROVED/v0.2.0/legacy approval/effective null and receipt-state semantics; IDX-001 v0.4.24 APPROVED with approved_at/effective_from 2026-07-12 and ten W11 role approvals; empty direct tests/PRs/evidence and regression gates do not waive known dependency/source/audit gaps or receipt/accounting/legal/runtime/production gates
landing_required: satisfied
landing_record: commit e233197 `WP-9002-W11: normalize receipt lifecycle metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/77/96; RCP-003 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; known dependency/source/audit gaps remain unresolved and no receipt-state/legal/tax/accounting/audit/runtime/DB/API/UI/production/external activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 77 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W12 RCP-001 receipt-issuance policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W12
baseline_commit: 5133f19
baseline_inventory: { total: 173, incomplete: 77, complete: 96 }
target_inventory: { total: 173, incomplete: 76, complete: 97 }
target: RCP-001 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing actual-payment-only issuance, partial-payment balance, LOCAL_ONLY/recovery, audit, legal/tax/accounting, PHI, or production semantics.
allowed_files: RCP-001, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: RCP-004 or other receipt/accounting/audit/regulatory docs, code/tests/packages/lock; payment/receipt/offline/audit/schema changes, migration/DML, API/UI, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS; RCP-004 grouping REJECTED due separate statement/calculation/evidence/legal/privacy authority surface
body_changes: none; body must remain 3254 bytes / SHA-256 8d7336d37c9816741bd2e72bf72c0814857c6851ef60daf9e3fb13fcbd3082ed
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/one blocker; preserve existing RCP cycles/references without repair or acyclic/completeness claim; construction section refs are legacy/unverified; generic SystemMode/audit foundations are not receipt implementation evidence
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-3101, WP-9002-W12]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16286 bytes / SHA-256 9e7a90df0ca30599d791a2a075d0c1aaa17dd40db56d5ee602388726ac6853df must remain unchanged; target review inventory 173/76/97
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; legal receipt fields/deduction/partial-payment display, patient/payment correctness, LOCAL_ONLY/recovery/outbox/dedupe, audit taxonomy/persistence, tenant/PHI/authz, ReceiptDocument/WP-2202/3101, DB/API/UI/runtime/production/external behavior, or risk acceptance stops for applicable authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct RCP-001 evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock receipt/payment/offline/legal/runtime readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/tax/accounting/pharmacy/product/claims human authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; RCP-001 all23 and body 3254/8d7336d37c9816741bd2e72bf72c0814857c6851ef60daf9e3fb13fcbd3082ed byte-identical; preserved fields unchanged; inventory173/76/97; 172 non-target missing-set baseline-identical at 16286 bytes / SHA-256 9e7a90df0ca30599d791a2a075d0c1aaa17dd40db56d5ee602388726ac6853df; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; audit182; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-001 retains APPROVED/v0.2.0/legacy approval/effective null and receipt/payment semantics; IDX-001 v0.4.25 APPROVED with approved_at/effective_from 2026-07-12 and ten W12 role approvals; empty direct tests/PRs/evidence and regression gates do not waive payment/offline/audit/legal/accounting/PHI/runtime/production gates
landing_required: satisfied
landing_record: commit 06719da `WP-9002-W12: normalize receipt issuance metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/76/97; RCP-001 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; cycles/source drift/audit partiality remain unresolved and no receipt/payment/offline/legal/accounting/PHI/runtime/DB/API/UI/production/external activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 76 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W13 RCP-004 statement-issuance policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W13
baseline_commit: 18ec003
baseline_inventory: { total: 173, incomplete: 76, complete: 97 }
target_inventory: { total: 173, incomplete: 75, complete: 98 }
target: RCP-004 v0.2.0 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing statement calculation/evidence, free/decline/zero-yen/legal fields, privacy, audit, retention, or production semantics.
allowed_files: RCP-004, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other receipt/calculation/claim/audit/regulatory docs, code/tests/packages/lock; statement/evidence/legal/privacy/audit/schema changes, migration/DML, API/UI, external action, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2993 bytes / SHA-256 3868a926099a03d83be853e397b89df8380da8df0bc62582d396795635d7aa05
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/three open questions/one blocker; preserve RCP-005/006 cycles; legacy construction source and CAL/CLM are partial/adjacent only; do not repair or claim statement.declined audit taxonomy completeness
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0034, WP-2202, WP-3101, WP-9002-W13]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16185 bytes / SHA-256 d6adb1adc87a58a6948562a979926c6cb306b474a261323ee36edb7fef37c61a must remain unchanged; target review inventory 173/75/98
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; free issuance/exceptions, 0-yen, statutory fields/template, decline legal status, consent/privacy/PHI, calculation/evidence correctness, audit taxonomy/persistence/businessReason, hash/retention, WP-2202/3101, DB/API/UI/runtime/production/external behavior, or risk acceptance stops for applicable legal/regulatory/pharmacy/product/claims/privacy/security authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct RCP-004 evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock statement/legal/evidence/privacy/runtime readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal/regulatory/pharmacy/product/claims human authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; RCP-004 all23 and body 2993/3868a926099a03d83be853e397b89df8380da8df0bc62582d396795635d7aa05 byte-identical; preserved fields unchanged; inventory173/75/98; 172 non-target missing-set baseline-identical at 16185 bytes / SHA-256 d6adb1adc87a58a6948562a979926c6cb306b474a261323ee36edb7fef37c61a; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; audit182/calculation87; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: RCP-004 retains APPROVED/v0.2.0/legacy approval/effective null and statement/evidence/privacy semantics; IDX-001 v0.4.26 APPROVED with approved_at/effective_from 2026-07-12 and ten W13 role approvals; empty direct tests/PRs/evidence and regression gates do not waive legal/evidence/privacy/audit/runtime/production gates
landing_required: satisfied
landing_record: commit fb1928d `WP-9002-W13: normalize statement issuance metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/75/98; RCP-004 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; legal/evidence/cycle/audit gaps remain unresolved and no StatementDocument/privacy/runtime/DB/API/UI/production/external activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 75 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W31 CAL-008 calculation-trace schema metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W31
baseline_commit: aa266fa
baseline_inventory: { total: 173, incomplete: 58, complete: 115 }
target_inventory: { total: 173, incomplete: 57, complete: 116 }
target: CAL-008 v0.2.0 metadata-only; body/status/version/legacy approval/effective/trace semantics preserved
purpose: Complete PRC-007 metadata without claiming all calculation producers migrated, typed intermediate-value semantics, rounding evidence issuance, live trace API/UI, claimability, or medical/legal/production/release completion.
allowed_files: CAL-008, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other CAL/API/MOD/QUA/CLM/REG/SAF/SEC docs, code/tests/packages/lock, DB/API/UI; schema/requiredness/status/PHI/float/evidence/rounding/claim semantics, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS after root adjudication against JHS-003; CAL-008 requires only mechanical missing7 while JHS-003 would require new PROPOSED approval/dependency/impact/question authority mapping
body_changes: none; body must remain 3791 bytes / SHA-256 fefeb253533993f2ad015c1bc1093195c8ee91e15d4c45f1cbeb67c01dad8bd5
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/one question/existing blocker/body; preserve six extension rows, self-contained rounding rule, legacy fields, four migration steps, four status rows and two body-history entries; current trace/contracts implementation and tests are partial regression evidence only
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-4031, WP-3011a, WP-9002-W31]; related_tests/related_prs/evidence_ids empty; existing body history transcribed plus W31 metadata-only change log
non_target: 172 canonical rows / 14192 bytes / SHA-256 cce5e51c3cc0e89f019cbccdd0801146e530332dc253de32cfcddc221cb67ae3 must remain unchanged; target review inventory 173/57/116
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, calculation_domain_reviewer, trace_contract_reviewer, api_contract_reviewer, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing stop only; rounding/copay evidence, suggested/excluded claim semantics, full producer migration, typed intermediate-value trust boundary, live API/tenant/permission/UI, pharmacist/claims/audit UX, PHI/privacy, required-field vNext, legal/medical/claims and production risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/six extensions/self-contained rounding/legacy fields/four migration steps/four statuses/one question/one blocker/inventory/non-target assertions; trace/contracts and full workspace gates are regression-only, not calculation/rounding/claim/release proof
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock typed values, producer migration, rounding evidence, claimability, API/UI, medical/legal, production, or release gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, calculation_domain_reviewer, trace_contract_reviewer, api_contract_reviewer, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED_WITH_PINS; trace/evidence/medical/claims/legal/security/privacy human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; CAL-008 all23 and body 3791/fefeb253533993f2ad015c1bc1093195c8ee91e15d4c45f1cbeb67c01dad8bd5 byte-identical; preserved fields/six extensions/self-contained rounding/legacy fields/four migration steps/four statuses/one question/one blocker unchanged; inventory173/57/116; 172 non-target missing-set baseline-identical at 14192 bytes / SHA-256 cce5e51c3cc0e89f019cbccdd0801146e530332dc253de32cfcddc221cb67ae3; workspace typecheck/test/build PASS with trace37, contracts95, API172 plus13 expected PostgreSQL skips and web188; focused contracts20, OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: CAL-008 retains APPROVED/v0.2.0/legacy approval/effective null and all trace semantics; IDX-001 v0.4.44 APPROVED with approved_at/effective_from 2026-07-12 and twelve W31 role results; empty direct tests/evidence and green regression do not prove typed intermediateValues/value-PHI boundary, all-producer migration, rounding/copay evidence, suggested/excluded non-counting, claimability, live API tenant/permission/UI, legal/medical/claims, production, or release readiness
landing_required: satisfied
landing_record: commit 72474ba `WP-9002-W31: normalize trace schema metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/57/116; CAL-008 body/status/version/legacy approval/effective/trace semantics, six extensions/self-contained rounding/legacy fields/four migration steps/four statuses/one question/one blocker and 172 non-target records unchanged; twelve reviews/full regression gates accepted; no typed value/PHI, producer migration, rounding/copay, claimability, live API/tenant/UI, medical/legal/production/release acceptance activation
state: LANDED; WP-9002 remains IN_PROGRESS with 57 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W30 CAL-009 rule-data architecture metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W30
baseline_commit: 8798b0c
baseline_inventory: { total: 173, incomplete: 59, complete: 114 }
target_inventory: { total: 173, incomplete: 58, complete: 115 }
target: CAL-009 v0.1.1 metadata-only; body/status/version/legacy approval/effective/calculation semantics preserved
purpose: Complete PRC-007 metadata without claiming rule-data distribution/persistence, second-version readiness, golden/regulatory/evidence/calculation/claim/release completion, or resolving existing questions/blocker.
allowed_files: CAL-009, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other CAL/ARC/CLM/MST/REG/SAF/SEC/PRD docs, code/tests/packages/lock, DB/API/UI; rule values, points, dates, evidence, selection/effective semantics, canonical ruleset, claimability, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS after root adjudication against OPS-004; CAL-009 requires only mechanical missing7 while OPS-004 would require new PHI/break-glass/SLA impacts and blocker semantics
body_changes: none; body must remain 3363 bytes / SHA-256 c4c4d9599dc4cd423d63b8faf3bab5157d1a43d4e95127f09264deff9a4646b9
pins: preserve APPROVED/v0.1.1/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two questions/existing blocker/body; preserve three layers, five invariants, five-rule canonical example/166 points, external-distribution non-design and four fail-closed stops; current implementation/tests are partial regression evidence only
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0044, WP-9002-W30]; related_tests/related_prs/evidence_ids empty; existing body history transcribed plus W30 metadata-only change log
non_target: 172 canonical rows / 14281 bytes / SHA-256 10cea7a6399f82eeb3125bf1634420d2638a5dcdcc6b5afbc3ef952145d69116 must remain unchanged; target review inventory 173/58/115
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, calculation_domain_reviewer, claims_evidence_specialist, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing stop only; points/dates/evidence validity, rule/ruleset/version selection, effective_to and prescription/dispensing/claim-month semantics, canonical ruleset, claimability, rounding/copay, legal/pharmacy/claims/patient-safety conclusions and production risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/three layers/five invariants/five-rule/166/four stops/two questions/one blocker/inventory/non-target assertions; focused calculation and full workspace gates are regression-only, not architecture/evidence/claim/release proof
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock rule distribution/persistence, second version, evidence, calculation/claim, medical/legal, production, or release gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, calculation_domain_reviewer, claims_evidence_specialist, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED_WITH_PINS; calculation/evidence/medical/claims/legal/security/privacy human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; CAL-009 all23 and body 3363/c4c4d9599dc4cd423d63b8faf3bab5157d1a43d4e95127f09264deff9a4646b9 byte-identical; preserved fields/three layers/five invariants/five-rule 166-point example/four stops/two questions/one blocker unchanged; inventory173/58/115; 172 non-target missing-set baseline-identical at 14281 bytes / SHA-256 10cea7a6399f82eeb3125bf1634420d2638a5dcdcc6b5afbc3ef952145d69116; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; focused calculation4, OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: CAL-009 retains APPROVED/v0.1.1/legacy approval/effective null and all calculation semantics; IDX-001 v0.4.43 APPROVED with approved_at/effective_from 2026-07-12 and eleven W30 role results; empty direct tests/evidence and green regression do not prove ruleset-version binding, prescription/claim-month selection, persistence, second-version coexistence, canonical immutability enforcement, claimability/copay/rounding, legal/medical/claims, production, or release readiness
landing_required: satisfied
landing_record: commit ea29a28 `WP-9002-W30: normalize rule data metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/58/115; CAL-009 body/status/version/legacy approval/effective/calculation semantics, three layers/five invariants/five-rule 166-point example/four stops/two questions/one blocker and 172 non-target records unchanged; eleven reviews/full regression gates accepted; no second-version/distribution/persistence/evidence/calculation/claim/medical/legal/production/release acceptance activation
state: LANDED; WP-9002 remains IN_PROGRESS with 58 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W29 UIX-006 workflow-map metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W29
baseline_commit: 2ac4c7d
baseline_inventory: { total: 173, incomplete: 60, complete: 113 }
target_inventory: { total: 173, incomplete: 59, complete: 114 }
target: UIX-006 v0.1.0 metadata-only; body/status/version/legacy approval/effective/workflow semantics preserved
purpose: Complete PRC-007 metadata and machine-map regulatory/evidence and end-to-end readiness stops without claiming full NORMAL/LOCAL_ONLY/RECOVERY_SYNC, role-home, navigation, API/DB/UI/Edge/device/accounting/claim implementation.
allowed_files: UIX-006, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other UIX/ARC/PRD/TST/medical/claim/accounting docs, code/tests/packages/lock; workflow/order/status/role/permission/offline/recovery/ONS/claim semantics, API/schema/DB/UI implementation, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS after root adjudication of three navigation principles and two distinct blockers
body_changes: none; body must remain 4122 bytes / SHA-256 cf5ec8fa5e15bbed2974a365ed228ee79638fa2dd0aca2a4bff7e34e9d26c003
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two questions/body; preserve NORMAL stages and four inline stops, UAC-05, LOCAL_ONLY steps/prohibitions, RECOVERY_SYNC five task branches/NORMAL gate, four role homes, three navigation principles, support PHI non-display and human-review requirements; partial components are not end-to-end evidence
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts UIX-001/002/004/005/007 and ARC-001/002; related_work_packages [WP-0016, WP-0032, WP-3001, WP-3007, WP-9002-W29]; related_tests/related_prs/evidence_ids empty; body-history plus W29 metadata-only change log; separate regulatory/evidence and end-to-end readiness blockers
non_target: 172 canonical rows / 14409 bytes / SHA-256 3af708d326e3e6c2699de838a8f267115641d7f526a4f84cb3e3ada5847240f6 must remain unchanged; target review inventory 173/59/114
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, test_architect, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, workflow_architect, claims_workflow_reviewer, accounting_domain_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing stops only;疑義照会/残薬、ONS/e-prescription、患者/保険/公費、薬剤師確認、copay/accounting/receipt、claim finalization/record-spec/return-resubmit、LOCAL_ONLY provisional accounting/receipt、RECOVERY conflict、role homes/permissions/PHI、UAC/accessibility/pharmacist/claim-clerk、medical/claims/legal/privacy/security/production risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/three flows/four roles/three principles/two questions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not end-to-end workflow evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock regulatory evidence, workflow, offline/recovery, claim, accounting, role/permission, PHI, or production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, test_architect, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, workflow_architect, claims_workflow_reviewer, accounting_domain_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED_WITH_PINS; workflow/product/medical/claims/accounting/accessibility/privacy/security human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; UIX-006 all23 and body 4122/cf5ec8fa5e15bbed2974a365ed228ee79638fa2dd0aca2a4bff7e34e9d26c003 byte-identical; preserved fields/NORMAL/LOCAL_ONLY/RECOVERY_SYNC/four role homes/three navigation principles/two questions unchanged; inventory173/59/114; 172 non-target missing-set baseline-identical at 14409 bytes / SHA-256 3af708d326e3e6c2699de838a8f267115641d7f526a4f84cb3e3ada5847240f6; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: UIX-006 retains APPROVED/v0.1.0/legacy approval/effective null and all workflow semantics; IDX-001 v0.4.42 APPROVED with approved_at/effective_from 2026-07-12 and thirteen W29 role results; BLOCKED_REGULATORY_REVIEW is item-specific and BLOCKED_NOT_READY independently retains E2E/human acceptance; empty direct evidence does not waive ONS/record-spec, workflow, accessibility, pharmacist/claim-clerk, medical/claims/accounting, privacy/security, production, or release gates
landing_required: satisfied
landing_record: commit 0634b9d `WP-9002-W29: normalize workflow map metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/59/114; UIX-006 body/status/version/legacy approval/effective/workflow semantics, three flows/four role homes/three navigation principles/two questions and 172 non-target records unchanged; thirteen reviews/full regression gates accepted; no ONS/record-spec, E2E workflow, responsive/accessibility, medical/claims/accounting, privacy/security, production, or release acceptance activation
state: LANDED; WP-9002 remains IN_PROGRESS with 59 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W28 UIX-004 usability-acceptance metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W28
baseline_commit: 363a7a1
baseline_inventory: { total: 173, incomplete: 61, complete: 112 }
target_inventory: { total: 173, incomplete: 60, complete: 113 }
target: UIX-004 v0.1.0 metadata-only; body/status/version/legacy approval/effective/UAC semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing usability/release-acceptance stop without claiming UAC-01..12 execution, workflow completion, accessibility conformance, or human acceptance.
allowed_files: UIX-004, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other UIX/QUA/TST/OPS/medical/security/privacy docs, code/tests/packages/lock; UAC method/value/role/severity, performance/offline/recovery/warning/accessibility behavior, API/schema/DB/UI implementation, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 3817 bytes / SHA-256 b92633441b0b3c06d7027612c092ec91b21e71ca912594749bd469ffd7e85f06
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two questions/body; preserve UAC-01..12 criteria/methods/candidate pass conditions/roles, pharmacist and claim-clerk final review, synthetic/demo-only data, and patient-safety critical/claim high-or-higher defect severity; existing unit/component tests are not UAC execution evidence
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts UIX-002/003/005, TST-001, QUA-001/002; related_work_packages [WP-0032, WP-3007, WP-9002-W28]; related_tests/related_prs/evidence_ids empty; body-history plus W28 metadata-only change log; BLOCKED_NOT_READY until UAC execution and applicable human approval
non_target: 172 canonical rows / 14508 bytes / SHA-256 06bf06543647c7e31d9ffaf647702a4be2c1da4373c7abeef9b8b978ce55debe must remain unchanged; target review inventory 173/60/113
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, test_architect, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, performance_reliability_reviewer, operations_reviewer, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing readiness stop only; participant recruitment/count, WCAG/JIS level, UAC values/thresholds, congestion N/performance, state misrecognition, offline/error/recovery, print/claim path, keyboard/accessibility, warning fatigue, pharmacist/claim-clerk workflow, synthetic-only training mode, defect acceptance, product/medical/claims/privacy/security, production release and risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/UAC-01..12 values/methods/roles/2 questions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not direct UAC evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock usability, accessibility, medical/claims workflow, warning, offline/recovery, production, or release gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, test_architect, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, performance_reliability_reviewer, operations_reviewer, claims_workflow_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED or APPROVED_WITH_PINS; usability/product/medical/claims/accessibility/privacy/security human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; UIX-004 all23 and body 3817/b92633441b0b3c06d7027612c092ec91b21e71ca912594749bd469ffd7e85f06 byte-identical; preserved fields/UAC-01..12 methods/all candidate values/roles/2 questions/3 operations unchanged; inventory173/60/113; 172 non-target missing-set baseline-identical at 14508 bytes / SHA-256 06bf06543647c7e31d9ffaf647702a4be2c1da4373c7abeef9b8b978ce55debe; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: UIX-004 retains APPROVED/v0.1.0/legacy approval/effective null and all UAC semantics; IDX-001 v0.4.41 APPROVED with approved_at/effective_from 2026-07-12 and thirteen W28 role results; BLOCKED_NOT_READY retains UAC execution/human acceptance and empty direct evidence does not waive usability, accessibility, pharmacist/claim-clerk, medical/claims, privacy/security, production, or release gates
landing_required: satisfied
landing_record: commit 5afca6d `WP-9002-W28: normalize usability acceptance metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/60/113; UIX-004 body/status/version/legacy approval/effective/UAC semantics, UAC-01..12 methods/all candidate values/roles/2 questions/3 operations and 172 non-target records unchanged; thirteen reviews/full regression gates accepted; no UAC execution, usability/accessibility, pharmacist/claim-clerk, medical/claims, privacy/security, production, or release acceptance activation
state: LANDED; WP-9002 remains IN_PROGRESS with 60 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W27 UIX-005 stability-SLO metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W27
baseline_commit: 366a031
baseline_inventory: { total: 173, incomplete: 62, complete: 111 }
target_inventory: { total: 173, incomplete: 61, complete: 112 }
target: UIX-005 v0.1.0 metadata-only; body/status/version/legacy approval/effective/candidate-SLO and stability semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing stability-readiness stop without finalizing Phase 0 candidate SLOs or claiming ST-01..15, Edge/offline/recovery/audit, or release readiness.
allowed_files: UIX-005, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other UIX/OPS/ARC/audit/testing/security/privacy docs, code/tests/packages/lock; SLO value/timeout/retry/autosave/idempotency/offline/recovery/print/claim/audit/Edge/version behavior, API/schema/DB/UI implementation, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2955 bytes / SHA-256 093669b03ef45143be0052a7179c876342934cb37d904f4c669494f5c0ed7b5f
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two questions/body; preserve seven candidate SLO rows/all values/methods, ST-01..15, two prohibitions, PHI-free error telemetry, idempotency/partial-failure/offline/recovery/print/audit/Edge/version pins; SystemModeBadge/error boundary existence and unit tests are partial facts only
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts UIX-002/003/004, OPS-005/006/009, TST-001, QUA-006; related_work_packages [WP-0032, WP-3001, WP-3007, WP-4050, WP-9002-W27]; related_tests/related_prs/evidence_ids empty; body-history plus W27 metadata-only change log; BLOCKED_NOT_READY for Phase 1 measurement, ST-01..15 end-to-end evidence, WP-4050 audit sink, and human product/operations acceptance
non_target: 172 canonical rows / 14633 bytes / SHA-256 a402fe26b12eff0d10706d25de6c11d56fc5c99bdf2f4f2311538a958414f988 must remain unchanged; target review inventory 173/61/112
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, performance_reliability_reviewer, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, operations_reviewer, audit_security_reviewer, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing readiness stop only; seven SLO values, autosave interval/generations, measurement/telemetry and PHI retention, timeout/retry/idempotency, LOCAL_ONLY/RECOVERY, print/claim failure, audit write completion, Edge self-test/version mismatch, accessibility/error recovery/pharmacist/claim-clerk workflows, OPS SLO/observability/capacity, production and risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/7 SLO rows and values/ST-01..15/2 prohibitions/2 questions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not direct stability evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock SLO, autosave, offline/recovery, audit, Edge, medical workflow, telemetry, or production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, performance_reliability_reviewer, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, operations_reviewer, audit_security_reviewer, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED or APPROVED_WITH_PINS; stability/product/operations/audit/medical/privacy human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; UIX-005 all23 and body 2955/093669b03ef45143be0052a7179c876342934cb37d904f4c669494f5c0ed7b5f byte-identical; preserved fields/7 SLO rows and all values/ST-01..15/2 prohibitions/2 questions unchanged; inventory173/61/112; 172 non-target missing-set baseline-identical at 14633 bytes / SHA-256 a402fe26b12eff0d10706d25de6c11d56fc5c99bdf2f4f2311538a958414f988; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: UIX-005 retains APPROVED/v0.1.0/legacy approval/effective null and all candidate-SLO/stability semantics; IDX-001 v0.4.40 APPROVED with approved_at/effective_from 2026-07-12 and eleven W27 role results; BLOCKED_NOT_READY retains Phase1/ST-01..15/WP-4050/human acceptance gates and empty direct evidence does not waive stability, audit, offline/recovery, accessibility, medical workflow, telemetry, Edge, production, or release gates
landing_required: satisfied
landing_record: commit f02d3c2 `WP-9002-W27: normalize stability SLO metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/61/112; UIX-005 body/status/version/legacy approval/effective/candidate-SLO/stability semantics, 7 SLO/all values/ST-01..15/2 prohibitions/2 questions and 172 non-target records unchanged; eleven reviews/full regression gates accepted; no stability SLO, autosave, offline/recovery, audit/WP-4050, telemetry, accessibility, medical workflow, Edge, production, or release-readiness activation
state: LANDED; WP-9002 remains IN_PROGRESS with 61 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W26 UIX-003 performance-budget metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W26
baseline_commit: 6703c59
baseline_inventory: { total: 173, incomplete: 63, complete: 110 }
target_inventory: { total: 173, incomplete: 62, complete: 111 }
target: UIX-003 v0.1.0 metadata-only; body/status/version/legacy approval/effective/candidate-budget semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing performance-readiness stop without finalizing any Phase 0 candidate value as a release SLO or claiming Edge/Cloud/async runtime performance.
allowed_files: UIX-003, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other UIX/OPS/ARC/testing/security/privacy docs, code/tests/packages/lock; performance number/metric/measurement/telemetry/Edge/offline/async behavior, API/schema/DB/UI implementation, external/production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2563 bytes / SHA-256 d27a7144725fbea20e8d8375ebea0c9666a3a503656aecaefef8c361dd91ce21
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependency/two questions/body; preserve three design assumptions, 18 candidate rows and all p50/p95 values, three operational rules, PHI-free correlation logging, no validation/audit/external-confirmation omission, and unambiguous async progress/residual/failure states
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts UIX-004/UIX-005/OPS-005/OPS-006/OPS-009/TST-001/QUA-006; related_work_packages [WP-0032, WP-9002-W26]; related_tests/related_prs/evidence_ids empty; body-history plus W26 metadata-only change log; BLOCKED_PERFORMANCE_SLO only prevents candidate-to-release-SLO promotion
non_target: 172 canonical rows / 14751 bytes / SHA-256 70435986006bb7e9369631364b5bd5e27426de7744d84a9e2b6a421eeb24a836 must remain unchanged; target review inventory 173/62/111
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, performance_reliability_reviewer, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, operations_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing performance stop only; 18 values, congestion concurrency, measurement environment/data, Edge feasibility, async UX, PHI-safe telemetry/retention, latency/error budget/release threshold, pharmacist/claim-clerk workflow, accessibility/perceived performance, OPS capacity/SLO/observability, production and risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/18 rows and values/2 questions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not direct performance evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock performance SLO, Edge/offline, telemetry, medical workflow, or production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, performance_reliability_reviewer, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, operations_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED or APPROVED_WITH_PINS after correcting three dead impact paths; performance/product/operations/medical/security/privacy human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; UIX-003 all23 and body 2563/d27a7144725fbea20e8d8375ebea0c9666a3a503656aecaefef8c361dd91ce21 byte-identical; preserved fields/18 rows and values/3 assumptions/3 rules/2 questions unchanged; inventory173/62/111; 172 non-target missing-set baseline-identical at 14751 bytes / SHA-256 70435986006bb7e9369631364b5bd5e27426de7744d84a9e2b6a421eeb24a836; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: UIX-003 retains APPROVED/v0.1.0/legacy approval/effective null and all Phase 0 candidate-budget semantics; IDX-001 v0.4.39 APPROVED with approved_at/effective_from 2026-07-12 and eleven W26 role results; BLOCKED_PERFORMANCE_SLO prevents candidate promotion and empty direct evidence does not waive Phase 1 measurement, capacity, telemetry, accessibility, medical workflow, Edge/Cloud/runtime, production, or human gates
landing_required: satisfied
landing_record: commit c3947e3 `WP-9002-W26: normalize performance budget metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/62/111; UIX-003 body/status/version/legacy approval/effective/candidate-budget semantics, 18 rows/all values/3 assumptions/3 rules/2 questions and 172 non-target records unchanged; eleven reviews/full regression gates accepted after correcting three dead impact paths; no performance SLO, telemetry, Edge/Cloud/async runtime, accessibility, medical workflow, production, or release-readiness activation
state: LANDED; WP-9002 remains IN_PROGRESS with 62 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W25 UIX-002 experience-quality metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W25
baseline_commit: 53f55eb
baseline_inventory: { total: 173, incomplete: 64, complete: 109 }
target_inventory: { total: 173, incomplete: 63, complete: 110 }
target: UIX-002 v0.1.0 metadata-only; body/status/version/legacy approval/effective/experience-quality semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing experience-quality baseline without claiming full UI, Edge/offline, performance, usability, accessibility, pharmacist, or claim-clerk readiness.
allowed_files: UIX-002, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other UIUX/product/architecture/testing/medical/security/privacy docs, code/tests/packages/lock; performance target, UX requirement, status, permission, warning, error, PHI telemetry, API/schema/DB/UI implementation, external/production/deploy, or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS after root adjudication; lower-authority UIX-002 selected over refund/legal/permission-heavy ACC-005
body_changes: none; body must remain 3659 bytes / SHA-256 2a4b5ed191720b378c57eb998ee692ec3cc5b511f5dcdcb1308af65742b15b5e
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependency/impacts/body history; preserve 11 minimum criteria, speed/stability/intuitiveness pillars and prohibitions, 10 UX prohibitions, 14 mandatory tests, and two open questions; BusinessNav/SystemModeBadge/PatientHeader existence is not full implementation or release evidence
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0032, WP-3007, WP-9002-W25]; related_tests/related_prs/evidence_ids empty; body-history authority plus W25 metadata-only change log; open questions copied verbatim from body; blockers empty only for document validity, never release readiness
non_target: 172 canonical rows / 14858 bytes / SHA-256 29885af8b9bc2ab55f895e114ca3a8e39e87524d7de41b455736f4d9e00254ad must remain unchanged; target review inventory 173/63/110
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; WP-0032, quantitative congestion/performance criteria, training mode, Edge/offline behavior, error recovery, accessibility, warning fatigue, pharmacist and claim-clerk workflow, medical/product/security/privacy validation, UI implementation, production and risk acceptance remain with applicable human authorities
validation: exact5/staged0; body/preserved/all23/11 criteria/3 pillars/10 prohibitions/14 tests/2 questions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not UX or release evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock UI/UX, performance, accessibility, medical workflow, or production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, frontend_reviewer, accessibility_ux_reviewer, product_quality_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED or APPROVED_WITH_PINS; UX/product/medical/security/privacy human authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; UIX-002 all23 and body 3659/2a4b5ed191720b378c57eb998ee692ec3cc5b511f5dcdcb1308af65742b15b5e byte-identical; preserved fields/11 criteria/3 pillars/10 prohibitions/14 tests/2 questions unchanged; inventory173/63/110; 172 non-target missing-set baseline-identical at 14858 bytes / SHA-256 29885af8b9bc2ab55f895e114ca3a8e39e87524d7de41b455736f4d9e00254ad; workspace typecheck/build PASS; first workspace test exposed an unrelated random-MAC substring flaky assertion in patient-search-cursor, focused 8/8 and full rerun then PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: UIX-002 retains APPROVED/v0.1.0/legacy approval/effective null and experience-quality semantics; IDX-001 v0.4.38 APPROVED with approved_at/effective_from 2026-07-12 and nine W25 role approvals; component existence and regression tests do not waive 14 mandatory UX tests, WP-0032, accessibility, performance, medical workflow, or production gates
landing_required: satisfied
landing_record: commit 9e0b38e `WP-9002-W25: normalize experience quality metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/63/110; UIX-002 body/status/version/legacy approval/effective/experience-quality semantics, 11 criteria/3 pillars/10 prohibitions/14 tests/2 questions and 172 non-target records unchanged; nine reviews/regression gates accepted with flaky initial API assertion transparently rerun; no UI/UX, Edge/offline, performance, accessibility, medical workflow, PHI telemetry, production, or release-readiness activation
state: LANDED; WP-9002 remains IN_PROGRESS with 63 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W24 ACC-009 POS-integration metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W24
baseline_commit: 60fa14f
baseline_inventory: { total: 173, incomplete: 65, complete: 108 }
target_inventory: { total: 173, incomplete: 64, complete: 109 }
target: ACC-009 v0.2.0 metadata-only; body/status/version/legacy approval/effective/POS-integration semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing direct-integration stop without changing MVP boundary, POSSettlement/payment/status/idempotency, adapter/API/data model, DB/UI/device/external transaction, or runtime readiness.
allowed_files: ACC-009, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/adapter/integration/security/database docs, code/tests/packages/lock; POSSettlement/payment/status/idempotency/adapter/API/schema/migration/DML/UI/device/external transaction/email/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1351 bytes / SHA-256 e93cdd5b84f555c3c585e9c70ef549f5d5b47f93ff83657ec75fbec78b96fd04
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two open questions/body history; preserve direct POS/cashless non-MVP, MVP API/event/data-model/adapter-registration boundary only, direct DB prohibition, POSSettlement external fact to RECEIVED/CAPTURED, Idempotency, FAILED/CANCELLED/REVERSED, failure nonmasking, cash fallback, and payment-vs-dispensing authorization separation
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts ACC-006/008 and future WP-0036 Partner API/POS adapter/WP-3101 only; related_work_packages [WP-0033, WP-0036, WP-0037, WP-2203, WP-3101, WP-9002-W24]; related_tests/related_prs/evidence_ids empty; body-history authority plus W24 metadata-only change log; BLOCKED_NOT_READY for direct integration only
non_target: 172 canonical rows / 14980 bytes / SHA-256 aaa93047480e98a8613193a1f60f249a076f71b4b9a8d39af94415d5039a22d2 must remain unchanged; target review inventory 173/64/109
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, product_quality_reviewer, payment_integration_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing direct-integration stop only; vendor/device selection, OTC boundary, payment provider/contract/cost, Partner API, payment security/privacy, refund/cancel, terminal failure/cash fallback, payment-vs-dispensing workflow, WP-0036/0037/2203/3101, DB/API/UI, external sandbox/transaction, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/boundary/failure-state/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not POS/payment runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock direct POS/payment integration or external/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, product_quality_reviewer, payment_integration_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; product/accounting/payment/security authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-009 all23 and body 1351/e93cdd5b84f555c3c585e9c70ef549f5d5b47f93ff83657ec75fbec78b96fd04 byte-identical; preserved fields/two questions/boundary/failure pins unchanged; inventory173/64/109; 172 non-target missing-set baseline-identical at 14980 bytes / SHA-256 aaa93047480e98a8613193a1f60f249a076f71b4b9a8d39af94415d5039a22d2; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-009 retains APPROVED/v0.2.0/legacy approval/effective null and POS-integration semantics; IDX-001 v0.4.37 APPROVED with approved_at/effective_from 2026-07-12 and thirteen W24 role approvals; BLOCKED_NOT_READY only stops direct integration and empty evidence does not waive vendor/payment-security/DB/API/UI/external/production gates
landing_required: satisfied
landing_record: commit cfaa01b `WP-9002-W24: normalize POS integration metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/64/109; ACC-009 body/status/version/legacy approval/effective/POS-integration semantics, boundary/failure pins and 172 non-target records unchanged; thirteen reviews/full regression gates APPROVED; POS/payment runtime/WP/payment-security/DB/API/UI/external/human gates remain unresolved and no device transaction/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 64 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W23 ACC-004 partial-payment metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W23
baseline_commit: 47c7422
baseline_inventory: { total: 173, incomplete: 66, complete: 107 }
target_inventory: { total: 173, incomplete: 65, complete: 108 }
target: ACC-004 v0.2.0 metadata-only; body/status/version/legacy approval/effective/partial-payment semantics preserved
purpose: Complete PRC-007 metadata and narrowly inherit the existing copay stop without changing amounts/allocation/status/receipt/numbering/sync, DB/API/UI, or implementation readiness.
allowed_files: ACC-004, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/receipt/calculation/module/database docs, code/tests/packages/lock; amount/allocation/status/receipt/numbering/sync/schema/migration/DML/API/UI/payment/refund/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1882 bytes / SHA-256 b2b41d847221ab02ea8fdb871d1fa926ba95eef9f0a8c3679a27e3f7e412fb9d
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two open questions/body history; preserve 10 requirements/4 prohibitions, PARTIALLY_PAID, cash RECEIVED and cashless ACC-006 CAPTURED read-through, receipt actual-received amount only, residual non-concealment, LOCAL_ONLY local number/sync/reverify; MVP scope is not runtime readiness
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts ACC-002/003/005/006/007, RCP-001/002 and future WP-2201/2202/3101; related_work_packages [WP-0033, WP-0034, WP-2201, WP-2202, WP-3101, WP-9002-W23]; related_tests/related_prs/evidence_ids empty; body-history authority plus W23 metadata-only change log; narrow copay blocker
non_target: 172 canonical rows / 15096 bytes / SHA-256 cea9bad606f769f58b80b04079b2512cd5e1cb5847c7c87e87fb61e9f4ca9d03 must remain unchanged; target review inventory 173/65/108
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, receipt_legal_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing copay stop only; copay/patient charge, partial-payment practice, allocation default, receipt/supplement residual display and official notice, receipt legal/tax, LOCAL_ONLY numbering/sync/reverify, refund/cancel, WP-2201/2202/3101, DB/API/UI, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/10 requirements/4 prohibitions/state read-through/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not partial-payment runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock copay/partial-payment/receipt/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, receipt_legal_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; accounting/claims/receipt/legal authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-004 all23 and body 1882/b2b41d847221ab02ea8fdb871d1fa926ba95eef9f0a8c3679a27e3f7e412fb9d byte-identical; preserved fields/two questions/10 requirements/4 prohibitions unchanged; inventory173/65/108; 172 non-target missing-set baseline-identical at 15096 bytes / SHA-256 cea9bad606f769f58b80b04079b2512cd5e1cb5847c7c87e87fb61e9f4ca9d03; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-004 retains APPROVED/v0.2.0/legacy approval/effective null and partial-payment semantics; IDX-001 v0.4.36 APPROVED with approved_at/effective_from 2026-07-12 and thirteen W23 role approvals; narrow copay blocker/empty evidence do not waive receipt/legal/LOCAL_ONLY/accounting/DB/API/UI/runtime/production gates
landing_required: satisfied
landing_record: commit b692f09 `WP-9002-W23: normalize partial payment metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/65/108; ACC-004 body/status/version/legacy approval/effective/partial-payment semantics, 10 requirements/4 prohibitions and 172 non-target records unchanged; thirteen reviews/full regression gates APPROVED; partial-payment runtime/copay/receipt/legal/LOCAL_ONLY/WP/DB/API/UI/human gates remain unresolved and no payment/receipt/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 65 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W22 ACC-006 accounting-status metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W22
baseline_commit: cee9415
baseline_inventory: { total: 173, incomplete: 67, complete: 106 }
target_inventory: { total: 173, incomplete: 66, complete: 107 }
target: ACC-006 v0.2.0 metadata-only; body/status/version/legacy approval/effective/accounting-state semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing implementation sequence stop without changing 26 states, transitions, accounting/payment/receipt/statement semantics, shared-kernel, MOD-005, DB/API/UI, or runtime readiness.
allowed_files: ACC-006, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/receipt/module/shared-kernel/database docs, code/tests/packages/lock; state/transition/enum/payment/receipt/statement/claimability/schema/migration/DML/API/UI/POS/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 3713 bytes / SHA-256 ea1f5bca3fdc8f306f956855a3fb38192286d2a5c2dd4e0d3965af8e9c519c5c
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/single WRITTEN_OFF question; preserve PatientReceivable10/Payment10/ReceiptDocument6, all main/correction/prohibited transitions, BLOCKED_ACCOUNTING_REVIEW human-only release, RECEIVED/CAPTURED origins, StatementDocument no-state and local duplicate prohibition
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0033, WP-2201, WP-2202, WP-3101, WP-9002-W22]; related_tests/related_prs/evidence_ids empty; body-history authority plus W22 metadata-only change log; single BLOCKED_NOT_READY for MOD-005 and approved implementation WP sequence
non_target: 172 canonical rows / 15216 bytes / SHA-256 ec444498bfbe68f6d1e559acd3090421dbc058b808b6eeee27bb195bb20c18b5 must remain unchanged; target review inventory 173/66/107
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing sequence stop only; WRITTEN_OFF, BLOCKED_ACCOUNTING_REVIEW release, post-payment correction, refund/cancel, ReceiptDocument legal, MOD-005/status additions, WP-2201/2202/3101, DB/API/UI, accounting/claims/legal/pharmacist/product/data/security/privacy/production risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/10-10-6 states/transitions/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not state-machine runtime evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock MOD-005/accounting-state/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; accounting/claims/legal/product authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-006 all23 and body 3713/ea1f5bca3fdc8f306f956855a3fb38192286d2a5c2dd4e0d3965af8e9c519c5c byte-identical; preserved fields/question/10-10-6 states/transitions unchanged; inventory173/66/107; 172 non-target missing-set baseline-identical at 15216 bytes / SHA-256 ec444498bfbe68f6d1e559acd3090421dbc058b808b6eeee27bb195bb20c18b5; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-006 retains APPROVED/v0.2.0/legacy approval/effective null and accounting-state semantics; IDX-001 v0.4.35 APPROVED with approved_at/effective_from 2026-07-12 and twelve W22 role approvals; BLOCKED_NOT_READY only stops 26-state implementation pending MOD-005/approved WP and empty evidence does not waive runtime/DB/API/UI/production gates
landing_required: satisfied
landing_record: commit 65c68d9 `WP-9002-W22: normalize accounting status metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/66/107; ACC-006 body/status/version/legacy approval/effective/accounting-state semantics, 10/10/6 states/transitions and 172 non-target records unchanged; twelve reviews/full regression gates APPROVED; state runtime/MOD-005/WP-2201/2202/3101/DB/API/UI/human gates remain unresolved and no shared-kernel/payment/receipt/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 66 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W21 ACC-003 payment-allocation metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W21
baseline_commit: c19d03e
baseline_inventory: { total: 173, incomplete: 68, complete: 105 }
target_inventory: { total: 173, incomplete: 67, complete: 106 }
target: ACC-003 v0.2.0 metadata-only; body/status/version/legacy approval/effective/allocation semantics preserved
purpose: Complete PRC-007 metadata without changing allocation order/window/amount, idempotency/deduplication, status/audit behavior, Payment/Receivable/Refund, DB/API/UI, or implementation readiness.
allowed_files: ACC-003, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/receipt/module/events/database docs, code/tests/packages/lock; allocation order/window/amount/idempotency/dedupe/status/audit/schema/migration/DML/API/UI/payment/refund/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2410 bytes / SHA-256 d29074caf138552fdc5245133862cecf46de19c5cfc7c639bcd5ee47fdf40b4e
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/single open question/body history; preserve many-to-many, sum<=payment, OVERPAID refund, candidate order and applied-rule recording, append-only Reversal+new allocation, audit, Idempotency-Key, candidate 24h duplicate detection, human review and auto-cancel/merge prohibition; candidate values remain non-normative
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts ACC-004/005/007/011 and future WP-2201/3101 only; related_work_packages [WP-0033, WP-2201, WP-3101, WP-9002-W21]; related_tests/related_prs/evidence_ids empty; body-history authority plus W21 metadata-only change log; blockers empty means document validity only, not runtime readiness or operational-value finalization
non_target: 172 canonical rows / 15317 bytes / SHA-256 5708eeda3c644b0bdc3190e732442d42f2847e8ca613d91d7b19d4ea0dda06d2 must remain unchanged; target review inventory 173/67/106
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; allocation default, 24h window, claims practice, overpayment/refund, cross-channel duplicate judgment, false positives, idempotency/dedupe, LOCAL_ONLY/RECOVERY_SYNC, audit persistence, WP-2201/3101, DB/API/UI, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not allocation runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never finalize candidate values or unlock allocation/accounting/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; accounting/claims/product authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-003 all23 and body 2410/d29074caf138552fdc5245133862cecf46de19c5cfc7c639bcd5ee47fdf40b4e byte-identical; preserved fields/question/candidate values/empty blocker unchanged; inventory173/67/106; 172 non-target missing-set baseline-identical at 15317 bytes / SHA-256 5708eeda3c644b0bdc3190e732442d42f2847e8ca613d91d7b19d4ea0dda06d2; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-003 retains APPROVED/v0.2.0/legacy approval/effective null and allocation semantics; IDX-001 v0.4.34 APPROVED with approved_at/effective_from 2026-07-12 and twelve W21 role approvals; empty blockers/direct evidence do not finalize order/24h or waive allocation/accounting/DB/API/UI/runtime/production gates
landing_required: satisfied
landing_record: commit e0c9609 `WP-9002-W21: normalize allocation metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/67/106; ACC-003 body/status/version/legacy approval/effective/allocation semantics, candidate values/empty blocker and 172 non-target records unchanged; twelve reviews/full regression gates APPROVED; allocation runtime/WP-2201/3101/order/24h/DB/API/UI/human gates remain unresolved and no payment/refund/audit/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 67 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W20 ACC-010 facility-billing metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W20
baseline_commit: f21e380
baseline_inventory: { total: 173, incomplete: 69, complete: 104 }
target_inventory: { total: 173, incomplete: 68, complete: 105 }
target: ACC-010 v0.2.0 metadata-only; body/status/version/legacy approval/effective/facility-billing semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing human scope stop without deciding facility billing MVP scope or changing individual/facility accounting separation, patient detail, double-billing exclusion, invoice/payment/allocation, DB/API/UI, or implementation readiness.
allowed_files: ACC-010, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/product/receipt/claim/database docs, code/tests/packages/lock; facility model/scope/invoice/payment/allocation/patient detail/PHI/schema/migration/DML/API/UI/HQ/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1333 bytes / SHA-256 a7fc92b1dad967665c0e2be8b5548401ce9fde4fedbb8b371f7c91709797705d
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/three open questions/body history; preserve individual PatientReceivable vs FacilityInvoice/Payment separation, patient-level details, double-billing exclusion, and MVP boundary of model separation plus route flag only; blocker does not stop those design boundaries and does not decide WP-0037/0038
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts future facility payment allocation/daily view/data model/API/UI only; related_work_packages [WP-0033, WP-0037, WP-0038, WP-9002-W20]; related_tests/related_prs/evidence_ids empty; body-history authority plus W20 metadata-only change log; one existing-scope BLOCKED_NOT_READY
non_target: 172 canonical rows / 15435 bytes / SHA-256 5997b1813544a649ffe59e15e58c97d9207c7f46d216cd804e8741008249b78d must remain unchanged; target review inventory 173/68/105
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, product_quality_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing stop mapping only; WP-0037/0038, facility-billing need and MVP scope, invoice/closing/payment terms, home-care/long-term-care boundary, patient-detail privacy, contract/legal/tax/accounting/claims, double-billing controls, DB/API/UI, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not facility-billing runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock facility invoice/AR/payment/HQ/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, product_quality_reviewer, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; product/accounting/claims/legal/privacy authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-010 all23 and body 1333/a7fc92b1dad967665c0e2be8b5548401ce9fde4fedbb8b371f7c91709797705d byte-identical; preserved fields/three questions/separation/double-billing pins unchanged; inventory173/68/105; 172 non-target missing-set baseline-identical at 15435 bytes / SHA-256 5997b1813544a649ffe59e15e58c97d9207c7f46d216cd804e8741008249b78d; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-010 retains APPROVED/v0.2.0/legacy approval/effective null and facility-billing semantics; IDX-001 v0.4.33 APPROVED with approved_at/effective_from 2026-07-12 and thirteen W20 role approvals; BLOCKED_NOT_READY only stops facility runtime pending WP-0037/0038 human scope decision and empty direct evidence does not waive privacy/legal/accounting/DB/API/UI/production gates
landing_required: satisfied
landing_record: commit a570c51 `WP-9002-W20: normalize facility billing metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/68/105; ACC-010 body/status/version/legacy approval/effective/facility-billing semantics, separation/double-billing pins and 172 non-target records unchanged; thirteen reviews/full regression gates APPROVED; facility runtime/WP-0037/0038/product/privacy/legal/accounting/DB/API/UI/human gates remain unresolved and no payment/document/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 68 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W19 ACC-002 patient-receivable metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W19
baseline_commit: ca38b0f
baseline_inventory: { total: 173, incomplete: 70, complete: 103 }
target_inventory: { total: 173, incomplete: 69, complete: 104 }
target: ACC-002 v0.2.0 metadata-only; body/status/version/legacy approval/effective/receivable semantics preserved
purpose: Complete PRC-007 metadata and narrowly machine-map the existing ACC-001 copay stop without changing receivable generation, statuses/transitions, amounts, allocation, write-off, notification, accounting/claim/receipt, DB/API/UI, or implementation readiness.
allowed_files: ACC-002, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/receipt/calculation/claim/module/database docs, code/tests/packages/lock; receivable/status/copay/money/claimability/schema/migration/DML/API/UI/payment/refund/receipt/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 1724 bytes / SHA-256 702a35e047be61983ba205beaf401bdb826a360eeb52937a6b512aca7883a805
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two open questions/body history; preserve Charge/calculation_trace requirement, provisional receivable prohibition, non-concealment, Adjustment evidence, WRITTEN_OFF human approval, ACC-006 states and append-only traceability; blocker only narrowly inherits ACC-001 copay stop
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts direct ACC-003/004/005/007 and future WP-2201/3101 consumers; related_work_packages [WP-0033, WP-2201, WP-3101, WP-9002-W19]; related_tests/related_prs/evidence_ids empty; body-history authority plus W19 metadata-only change log; one existing-scope blocker
non_target: 172 canonical rows / 15549 bytes / SHA-256 826ab6de304e674a4671e87cf15bd6456ce2b815869b3bd3a63eb68d6a0fd3d5 must remain unchanged; target review inventory 173/69/104
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata/existing blocker mapping only; copay/Charge, collection/limitation/write-off, patient notification, reduction/Adjustment, public-expense/claims/accounting/legal practice, WP-2201/3101, DB/API/UI, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only, not receivable runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock copay/receivable/accounting/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, api_contract_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; accounting/claims/legal/product authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-002 all23 and body 1724/702a35e047be61983ba205beaf401bdb826a360eeb52937a6b512aca7883a805 byte-identical; preserved fields/two questions/narrow copay blocker unchanged; inventory173/69/104; 172 non-target missing-set baseline-identical at 15549 bytes / SHA-256 826ab6de304e674a4671e87cf15bd6456ce2b815869b3bd3a63eb68d6a0fd3d5; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-002 retains APPROVED/v0.2.0/legacy approval/effective null and receivable semantics; IDX-001 v0.4.32 APPROVED with approved_at/effective_from 2026-07-12 and twelve W19 role approvals; blocker only inherits ACC-001 copay stop and empty direct evidence does not waive receivable/accounting/DB/API/UI/runtime/production gates or unblock WP-2201/3101
landing_required: satisfied
landing_record: commit 4e2cc4e `WP-9002-W19: normalize receivable metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/69/104; ACC-002 body/status/version/legacy approval/effective/receivable semantics, narrow copay blocker and 172 non-target records unchanged; twelve reviews/full regression gates APPROVED; receivable runtime/WP-2201/3101/DB/API/UI/human gates remain unresolved and no payment/receipt/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 69 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W18 ACC-001 accounting-domain metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W18
baseline_commit: 81b4d18
baseline_inventory: { total: 173, incomplete: 71, complete: 102 }
target_inventory: { total: 173, incomplete: 70, complete: 103 }
target: ACC-001 v0.2.0 metadata-only; body/status/version/legacy approval/effective/accounting semantics preserved
purpose: Complete PRC-007 metadata without changing accounting concepts/status/transitions, append-only/tenant/audit invariants, Charge-before-Payment, money/copay, receipt/payment, DB/API/UI, or implementation readiness.
allowed_files: ACC-001, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other accounting/receipt/calculation/claim/module/security/database docs, code/tests/packages/lock; accounting/status/money/copay/audit/schema/migration/DML/API/UI/POS/payment/external/production/deploy or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 6250 bytes / SHA-256 db48374c9974a4cb857ef7665fb3a18d21112b858338d61bcfecc6064c8ae633
pins: preserve APPROVED/v0.2.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/three open questions/copay blocker and body history; preserve append-only, Charge-before-Payment, correlation-vs-idempotency, tenant/pharmacy, bigint, fail-closed; APPROVED and empty direct evidence do not unblock WP-2201/3101 or prove runtime/DB enforcement
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0033, WP-2201, WP-3101, WP-9002-W18]; related_tests/related_prs/evidence_ids empty; body-history authority plus W18 metadata-only change log
non_target: 172 canonical rows / 15667 bytes / SHA-256 e4eec54559e2c703665035754f28b418932e7cb25ba5229521fb1a6079c81f49 must remain unchanged; target review inventory 173/70/103
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; copay/patient charge, legal retention, journal format, Deposit, accounting/claims practice, DB append-only privileges, refund/adjustment, receipt/tax/legal, MVP scope, WP-2201/3101 activation, production/risk acceptance stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/inventory/non-target assertions; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only and not accounting runtime correctness evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock copay/accounting/receipt/runtime/production gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, db_steward, test_architect, accounting_domain_reviewer, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; accounting/claims/legal/product authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; ACC-001 all23 and body 6250/db48374c9974a4cb857ef7665fb3a18d21112b858338d61bcfecc6064c8ae633 byte-identical; 21 concepts/preserved fields/copay blocker unchanged; inventory173/70/103; 172 non-target missing-set baseline-identical at 15667 bytes / SHA-256 e4eec54559e2c703665035754f28b418932e7cb25ba5229521fb1a6079c81f49; workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: ACC-001 retains APPROVED/v0.2.0/legacy approval/effective null and accounting semantics; IDX-001 v0.4.31 APPROVED with approved_at/effective_from 2026-07-12 and eleven W18 role approvals; empty direct tests/PRs/evidence do not waive copay/accounting/receipt/DB/API/UI/runtime/production gates or unblock WP-2201/3101
landing_required: satisfied
landing_record: commit f1339a6 `WP-9002-W18: normalize accounting domain metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/70/103; ACC-001 body/status/version/legacy approval/effective/accounting semantics, 21 concepts/copay blocker and 172 non-target records unchanged; eleven reviews/full regression gates APPROVED; accounting runtime/DB enforcement/WP-2201/3101/human gates remain unresolved and no DB/API/UI/payment/receipt/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 70 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W17 CAL-003 evidence-register metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W17
baseline_commit: 973f1fb
baseline_inventory: { total: 173, incomplete: 72, complete: 101 }
target_inventory: { total: 173, incomplete: 71, complete: 102 }
target: CAL-003 v0.1.0 metadata-only; body/status/version/legacy approval/effective/evidence semantics preserved
purpose: Complete PRC-007 metadata without changing any EVD-CAL row, point value, source, caveat, status, hold, effective-date rule, calculation requirement, golden expectation, rule, claimability, or implementation readiness.
allowed_files: CAL-003, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other calculation/regulatory/claim docs, code/tests/packages/lock; EVD/value/source/caveat/status/date changes, golden/rule/claimability changes, API/UI/DB/migration, external evidence retrieval, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 13044 bytes / SHA-256 df10e6f29793745cadfaf862f230845e505881c103e7f9fbe7f958539b88bdc5
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/impacts/two open questions/blockers empty/existing history and all EVD-CAL-0001..0071/P-01..08; document effective null is not the 2026-06-01 rule applicability date; blockers empty is not implementation-ready; CONFIRMED_VISUAL, original-page recheck, 2026-06-19 revision uncertainty, and unverified calculation requirements remain active
metadata: updated_at 2026-07-12; effective_from/effective_to null; related_work_packages [WP-0017, WP-9002-W17]; related_tests [calculation.test.ts, formulas.test.ts] as partial implemented-EVD consumer regression only; related_prs/evidence_ids empty; append one metadata-only change-log entry
non_target: 172 canonical rows / 15771 bytes / SHA-256 7eb06b78c22bff25593de811ec3ce8e22e222d9caad4c9aa5bda0dc71b717d4d must remain unchanged; target review inventory 173/71/102
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, regulatory_adapter_reviewer, calculation_domain_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; official PDF recheck, 2026-06-19 revision, calculation requirements, evidence supersede, points/effective date/golden expectations, CAL-001 release steps, pharmacist/claims/regulatory correctness, claimability and release stop for applicable human authorities
validation: exact5/staged0; body/preserved/all23/EVD inventory/caveat/inventory/non-target assertions; focused calculation tests are partial consumer regression only; SSOT/scripts/secrets/boundaries/diff and full workspace gates are regression-only
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock evidence, calculation, claimability, or release gates
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, regulatory_adapter_reviewer, calculation_domain_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; pharmacist/claims/regulatory correctness authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; CAL-003 all23 and body 13044/df10e6f29793745cadfaf862f230845e505881c103e7f9fbe7f958539b88bdc5 byte-identical; 71 sequential unique EVD IDs and 8 sequential unique holds, preserved fields unchanged; inventory173/71/102; 172 non-target missing-set baseline-identical at 15771 bytes / SHA-256 7eb06b78c22bff25593de811ec3ce8e22e222d9caad4c9aa5bda0dc71b717d4d; calculation87 and workspace typecheck/test/build PASS with API172 plus13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: CAL-003 retains APPROVED/v0.1.0/legacy approval/effective null and evidence semantics; IDX-001 v0.4.30 APPROVED with approved_at/effective_from 2026-07-12 and eleven W17 role approvals; document evidence_ids empty and partial tests do not waive official-original/calculation-requirement/golden/claimability/release gates
landing_required: satisfied
landing_record: commit 9e03142 `WP-9002-W17: normalize evidence register metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/71/102; CAL-003 body/status/version/legacy approval/effective/evidence semantics, 71 EVD, 8 holds and 172 non-target records unchanged; eleven reviews/full regression gates APPROVED; official original/revision/calculation requirement/golden/claimability/release gates remain unresolved and no runtime/DB/API/UI/external/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 71 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W16 QUA-002 validation-plan metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W16
baseline_commit: 27f9325
baseline_inventory: { total: 173, incomplete: 73, complete: 100 }
target_inventory: { total: 173, incomplete: 72, complete: 101 }
target: QUA-002 v0.1.0 metadata-only; body/status/version/legacy approval/effective/validation semantics preserved
purpose: Complete PRC-007 metadata and machine-map the existing REG-004 connection-test stop without changing evidence, golden expectations, validation acceptance, external connection, parallel-run, UAC, Go/No-Go, release, or production semantics.
allowed_files: QUA-002, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other quality/testing/regulatory/operations/UI/calculation/claim docs, code/tests/packages/lock; evidence/golden/acceptance/schema changes, migration/DML, external sandbox, API/UI, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 2594 bytes / SHA-256 61c58e92c4e9a05f4028ff8de65d67d056e9f464863653b2ebed35a6d78a1125
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two open questions; blocker only machine-maps existing REG-004 RB-002/RB-003 ONS and electronic-prescription connection-test stop; L1 CI/trace evidence does not prove L2/L3, complete golden validation, external sandbox, parallel run, UAC, Go/No-Go, or release readiness
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts [TST-001 test strategy, validation and Go/No-Go evidence and release gates]; related_work_packages [WP-0011, WP-9002-W16]; related_tests/related_prs/evidence_ids empty; top-level change_log; one existing-scope blocker
non_target: 172 canonical rows / 15865 bytes / SHA-256 1ba901fa5d3c88d62226f4ee2abd0d15b9bfd363ccd60934f4fdde4c2adf4fc6 must remain unchanged; target review inventory 173/72/101
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, regulatory_adapter_reviewer, product_quality_reviewer, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata and existing blocker mapping only; tolerance values, official evidence/golden expectations, pharmacist/claims correctness, ONS registration/sandbox connection, UAC/parallel run/Go-No-Go/release, patient-safety/legal/claim risk acceptance stop for applicable human authorities
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; focused/full tests are L1 regression evidence only
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock REG-004, external validation, Go/No-Go, or release
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, regulatory_adapter_reviewer, product_quality_reviewer, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; human pharmacist/claims/regulatory/product authority remains separate
validation_results: FINAL PASS before landing — exact5/staged0; QUA-002 all23 and body 2594/61c58e92c4e9a05f4028ff8de65d67d056e9f464863653b2ebed35a6d78a1125 byte-identical; preserved fields unchanged; inventory173/72/101; 172 non-target missing-set baseline-identical at 15865 bytes / SHA-256 1ba901fa5d3c88d62226f4ee2abd0d15b9bfd363ccd60934f4fdde4c2adf4fc6; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; audit182/calculation87; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as L1 regression-only gates
finalization_record: QUA-002 retains APPROVED/v0.1.0/legacy approval/effective null and validation semantics; IDX-001 v0.4.29 APPROVED with approved_at/effective_from 2026-07-12 and eleven W16 role approvals; blocker is limited to existing REG-004 RB-002/RB-003 connection tests and empty tests/PRs/evidence do not waive L2/L3/golden/external/UAC/Go-No-Go/release gates
landing_required: satisfied
landing_record: commit 3cf9257 `WP-9002-W16: normalize validation plan metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/72/101; QUA-002 body/status/version/legacy approval/effective/validation semantics and 172 non-target records unchanged; eleven reviews/full L1 regression gates APPROVED; blocker remains limited to REG-004 RB-002/RB-003 connection tests and no L2/L3/golden/external/UAC/Go-No-Go/release/runtime/DB/API/UI/production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 72 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W15 QUA-008 public-quality KPI policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W15
baseline_commit: 894967a
baseline_inventory: { total: 173, incomplete: 74, complete: 99 }
target_inventory: { total: 173, incomplete: 73, complete: 100 }
target: QUA-008 v0.1.0 metadata-only; body/status/version/legacy approval/effective/legal/privacy/publication semantics preserved
purpose: Complete PRC-007 metadata without changing legal classification, anonymization, consent, contracts, PHI handling, KPI definition, external publication, correction, or production semantics.
allowed_files: QUA-008, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other quality/product/security/privacy/claim docs, code/tests/packages/lock; KPI/publication/schema changes, migration/DML, API/UI, external publish, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 4271 bytes / SHA-256 de14877893ccef8f3ef355443934fe6f6505c16dc33340d6379915fe50711754
pins: preserve APPROVED/v0.1.0/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/BLOCKED_LEGAL_REVIEW/three open questions; QUA-009 is dependency context only and does not prove anonymization, consent, legal, or publication correctness
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts [QUA-009 claim_return_rate_kpi_policy, future public quality KPI aggregation and publication implementation]; related_work_packages [WP-0043, WP-9002-W15]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 15971 bytes / SHA-256 76a074e4fed41f19b60b31d98cdf8cedbe60431f27e372255ae49e69a2ea904c must remain unchanged; target review inventory 173/73/100
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, product_quality_reviewer, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer]
human_gate: no new human approval for byte-preserving metadata only; blocker release, information classification, anonymization/k-threshold, patient consent/third-party provision, pharmacy contract/withdrawal, publication/business decision, correction/deletion, PHI, external publish, production behavior, or risk acceptance stops for applicable legal/privacy/product/business/security authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; check:ssot-index, test:scripts, secrets, boundaries, diff; full workspace gates are regression-only and never direct legal/privacy/anonymization/consent/publication evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock BLOCKED_LEGAL_REVIEW or external publication
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, product_quality_reviewer, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, and medical_safety_reviewer APPROVED; legal authority remains separate and BLOCKED_LEGAL_REVIEW stays active
validation_results: FINAL PASS before landing — exact5/staged0; QUA-008 all23 and body 4271/de14877893ccef8f3ef355443934fe6f6505c16dc33340d6379915fe50711754 byte-identical; preserved fields unchanged; inventory173/73/100; 172 non-target missing-set baseline-identical at 15971 bytes / SHA-256 76a074e4fed41f19b60b31d98cdf8cedbe60431f27e372255ae49e69a2ea904c; workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; audit182/calculation87; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as regression-only gates
finalization_record: QUA-008 retains APPROVED/v0.1.0/legacy approval/effective null and legal/privacy/publication semantics; IDX-001 v0.4.28 APPROVED with approved_at/effective_from 2026-07-12 and ten W15 role approvals; empty direct tests/PRs/evidence and regression gates do not waive legal/privacy/anonymization/consent/publication gates
landing_required: satisfied
landing_record: commit 2fda53a `WP-9002-W15: normalize public KPI metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/73/100; QUA-008 body/status/version/legacy approval/effective/legal/privacy/publication semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; BLOCKED_LEGAL_REVIEW and anonymization/consent/contract/PHI/publication gates remain unresolved and no runtime/DB/API/UI/external production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 73 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

- [x] WP-9002-W14 QUA-009 claim-return KPI policy metadata-only migration(LANDED、P1)

```yaml
work_package_id: WP-9002-W14
baseline_commit: 86a63e1
baseline_inventory: { total: 173, incomplete: 75, complete: 98 }
target_inventory: { total: 173, incomplete: 74, complete: 99 }
target: QUA-009 v0.1.1 metadata-only; body/status/version/legacy approval/effective semantics preserved
purpose: Complete PRC-007 metadata without changing claim-return definition, numerator/denominator, legal/privacy/publication, anonymization, consent, correction history, or production semantics.
allowed_files: QUA-009, docs/ssot_index.md, Plans.md, State.md, ops/refactor/STATE.md; exact5
forbidden: other quality/claim/product/security docs, code/tests/packages/lock; KPI/claim/publication/schema changes, migration/DML, API/UI, external publish, production/deploy, semantic or risk-acceptance changes
pre_plan_review: APPROVED_WITH_PINS
body_changes: none; body must remain 3693 bytes / SHA-256 b163e8a4912109f835ea502b21fecbd2e511f551bfcb834137dba2bccf97264f
pins: preserve APPROVED/v0.1.1/created_at/approved_at/approved_by/owner/reviewers/source/dependencies/two blockers/two open questions; shared-kernel NORMAL-only guard is partial invariant evidence only; no KPI aggregator/publication runtime or direct tests exist
metadata: updated_at 2026-07-12; effective_from/effective_to null; impacts [shared-kernel allowsClaimFinalization NORMAL-only invariant, future claim-return KPI aggregation and publication implementation]; related_work_packages [WP-0043, WP-9002-W14]; related_tests/related_prs/evidence_ids empty; top-level change_log only
non_target: 172 canonical rows / 16075 bytes / SHA-256 eb9ec0ed8876debc5cd970d9833584d135715081fd654066844a1672fed63e28 must remain unchanged; target review inventory 173/74/99
reviewers: [independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, product_quality_reviewer]
human_gate: no new human approval for byte-preserving metadata only; legal/privacy classification, anonymity threshold, consent/contract, returned-vs-assessed and numerator/denominator definitions, publication/business authority, claim/KPI flow, PHI, DB/API/UI/runtime/external publish/production behavior, or risk acceptance stops for applicable authority
validation: exact5/staged0; target body/preserved-field/all23/inventory/non-target assertions; shared-kernel test and full repository gates are partial/regression-only, never direct KPI correctness/publication evidence
rollback: revert exact5 candidate/final landing only and reopen metadata incompleteness; never unlock blockers, KPI computation/publication, claim finalization, or legal/privacy readiness
review_results: independent_verifier, spec_guardian, data_integrity_auditor, architect, test_architect, claims_evidence_specialist, security_critic, privacy_compliance_reviewer, medical_safety_reviewer, and product_quality_reviewer APPROVED; legal/privacy/publication/product authority remains separate for semantic decisions
validation_results: FINAL PASS before landing — exact5/staged0; QUA-009 all23 and body 3693/b163e8a4912109f835ea502b21fecbd2e511f551bfcb834137dba2bccf97264f byte-identical; preserved fields/two blockers/two questions unchanged; inventory173/74/99; 172 non-target missing-set baseline-identical at 16075 bytes / SHA-256 eb9ec0ed8876debc5cd970d9833584d135715081fd654066844a1672fed63e28; shared-kernel36 and workspace typecheck/test/build PASS with API172 plus 13 expected PostgreSQL skips and web188; OpenAPI, calculation-purity, scripts, SSOT173, secrets, boundaries, deps high0/critical0, SBOM231 and diff PASS as partial/regression-only gates
finalization_record: QUA-009 retains APPROVED/v0.1.1/legacy approval/effective null and fail-closed KPI/publication semantics; IDX-001 v0.4.27 APPROVED with approved_at/effective_from 2026-07-12 and ten W14 role approvals; NORMAL-only guard and regression gates do not prove KPI aggregation, provenance filtering, legal/privacy approval, or publication readiness
landing_required: satisfied
landing_record: commit 16eb58f `WP-9002-W14: normalize claim return KPI metadata` pushed to origin/agent/reconcile-wp9002-w7c-20260712; exact5; inventory173/74/99; QUA-009 body/status/version/legacy approval/effective semantics and 172 non-target records unchanged; ten reviews/full regression gates APPROVED; NORMAL-only guard remains partial evidence and no KPI/legal/privacy/publication/runtime/DB/API/UI/external production activation occurred
state: LANDED; WP-9002 remains IN_PROGRESS with 74 incomplete SSOT documents, and the next wave requires fresh read-only mapping and pre-plan review
```

## Phase 0: 調査・計画(ドキュメント)

- [x] WP-0001 Phase 0 計画書作成(docs/plan/phase0_plan.md)— 人間承認済み(「次に進む」)
- [x] WP-0002 実行モード・能力検証(codex CLI / agmsg / ultracode)
- [x] WP-0003 二系統運用・エージェント統率SSOT(docs/agents/ 15文書、status PROPOSED)— 8d47d70
- [x] WP-0004 llm_capability_registry / codex_capability_verification(実測検証反映、AGMSG_PROTOCOL_UNVERIFIED解除)(aa904f9)
- [x] WP-0005 規制・法令SSOT 6文書(GL6.0/7.0・JAHIS1.10/1.11の版差異を人間レビュー論点化)(c1fbad8)
- [x] WP-0006 医療安全+スコープSSOT 7文書(リスク33件、算定25行は全行BLOCKED+行単位解除手順)(ae24ae6)
- [x] WP-0007 外部境界・マスターSSOT 6文書(50f988e)
- [x] WP-0008 UI/UX・体験品質SSOT 7文書(4aa6595)
- [x] WP-0009 セキュリティSSOT 7文書(bcdf89f)
- [x] WP-0010 運用・移行・ガバナンスSSOT 14文書(ff145ae)
- [x] WP-0011 実装統率・品質SSOT 11文書(008baec)
- [x] WP-0012 共通モジュールSSOT 14文書(a257598)
- [x] WP-0013 ssot_index(97文書)+品質3文書補完+Phase 0ゲート報告(79edf9a)— **人間レビュー待ち**

Phase 0 文書は実装と並行して整備する(ユーザー指示により実装開始が承認済み)。
ただし R3+ 実装の根拠となるSSOTは該当実装より先に APPROVED にする。

## Phase 2: 実装(承認済み範囲から着手)

### 基盤(shared / R0-R1)

- [x] WP-1001 monorepo scaffold(pnpm workspaces / strict TS base)— c81d6ca
- [x] WP-1002 packages/shared-kernel: branded ID型(TenantId/PharmacyId/PatientId/PrescriptionId/ClaimId/EventId等)、システムモード(NORMAL〜RECOVERY_SYNC)、PENDING系status、BLOCKER種別、error/warning code registry型、permission scope型 + unit tests
- [x] WP-1003 packages/money: bigint ScaledDecimal / Yen / Points、丸めは明示パラメータのみ(政策値はevidence_id確認まで配線禁止)(codex実装・claudeレビュー、533f89a)
- [x] WP-1004 packages/date-time: CalendarDate/処方日・調剤日・受付日/ClaimMonth、現在時刻への暗黙依存禁止(codex実装・claudeレビュー、ab234fe)
- [x] WP-1005 packages/trace: evidence必須強制・PHI排除設計(codex実装・claudeレビュー、ddc06a1)
- [x] WP-1006 packages/events: EventEnvelope(PHI≠none→encrypted必須)(codex実装・claudeレビュー、85bd3aa)
- [x] WP-1007 packages/contracts: contract-first の器、healthスキーマ移設(codex実装・claudeレビュー、7fa369c)

### バックエンド(Codex sole maintainer所有 / apps/api)

- [x] WP-2001 apps/api scaffold(Fastify 5 + zod healthcheck、codex実装・claudeレビュー、58411c0)
- [x] WP-2002 認証認可・テナント分離の骨格(RBAC scope、tenant_id/pharmacy_id 強制)(codex実装・claudeレビュー、40a2512)
- [x] WP-2003 監査ログ骨格(audit event envelope、PHI非出力)(73ffd90 + WP-2010/4cf702f + WP-4024/f4e506a、opus4.8 APPROVED。hash-chain計算/永続化はWP-2009/WP-5004へ分離)
- [ ] WP-2004 患者・保険・公費ドメインCRUD(SSOT承認後)
- [x] WP-2008 患者検索APIバックエンド(API-001 v0.2.0、errorResponseSchema統合、PAT-0001、tenant/pharmacy/query拘束cursor、no-store)(codex実装・claudeレビュー、bb3d237)
- [!] WP-2101 算定エンジン(公式点数根拠 evidence_id 未確認 → BLOCKED_REGULATORY_REVIEW。純粋関数の骨格・trace配線のみ先行可)
- [!] WP-2102 電子レセプト生成(記録条件仕様未確認 → BLOCKED_REGULATORY_REVIEW)
- [!] WP-2103 Official Adapter 実装(ONS資料未確認 → BLOCKED_REGULATORY_REVIEW)

### フロントエンド(Codex sole maintainer所有 / apps/web)

- [x] WP-3001 apps/web scaffold(Next.js 15 shell + SystemModeBadge、12a5ac2)
- [x] WP-3002 患者ヘッダーコンポーネント(apps/web内に配置。packages/ui化は第二利用者出現時 — shared肥大化防止)(1acfa3f)
- [x] WP-3003 患者検索・受付ダッシュボードUI(API契約確定後、5b7f6ad)
- [x] WP-3004 画面群ルーティングシェル(業務順ナビ+8ルート、解除条件明記)(2b195b5)
- [x] WP-0014 公式資料検証リサーチ(全10項目CONFIRMED、施行日R8.6.1確定、記録条件仕様公開確認)(f166bee)

#### UI/UX 開発計画(正本: docs/plan/uiux_development_plan.md = PLAN-UIUX-001。詳細・依存・品質ゲートは計画書に従う)

- [x] WP-3006 デザイントークン+共通状態コンポーネント基盤(f4c7160): StatusBadge/BlockerBanner/SeverityList/EmptyState/LoadingState。shared-kernel 型再利用・色非依存。component.gallery は 403 のため一般慣行で代替(次回は /browse 経由で照合)— UI-1
- [x] WP-3007 SCR-013 横断警告・エラー・BLOCKER 表示(1b9e753 + 是正 9c5d2e9): ErrorNotice(次アクション対提示)/error boundary(PHI 非表示)。opus4.8 医療安全レビュー APPROVED(MEDIUM 3件即時是正: console PHI 封鎖・ERROR 格下げ・errorCode 検証。UIX-001 §5 に ERROR 行追加 v0.1.1)— UI-1
- [x] WP-3008 SCR-002 患者検索強化(1ffd6ea + 是正): 同姓同名警告(P-09)/ stale response 世代ガード(WP-4037)/ dev ヘッダ本番境界(WP-4038)/ 資格状態文言一本化(WP-4041)。opus4.8 医療安全レビュー APPROVED — F1(続きあり時の同姓同名可能性注記)/ F3(append 競合の回帰テスト)は即時是正済み — UI-2
- [ ] WP-3022 SCR-002 類似候補区別(historical Opus review finding F2): カナ近似(長音・濁点ゆれ等)の差分強調。近似規則の定義が必要なため、AGT-018のread-only mapperとpre-plan reviewerがUIX系SSOT改版、誤選択edge case、test、human gateを先に確定し、APPROVED後にsole Codex maintainerが実装する。makerとは別contextのindependent verifier、`medical_safety_reviewer`、`privacy_compliance_reviewer`、`frontend_reviewer`、`accessibility_ux_reviewer`、`ui_flow_tester`を必須とし、人間薬剤師/患者安全authorityの確認を別gateとして保持する。同姓同名該当時の選択前確認(F6)を受入条件に含める。
- [x] WP-3009 SCR-001 受付ダッシュボード実体化(受付キュー契約 SSOT 起草含む)— UI-2。API-006 契約 APPROVED(30f09a3) → WP-3009-BE(shared-kernel/contracts/apps/api 受付キュー backend、93aefa1) → WP-3009-UI(受付ダッシュボード、8bdee8a) の3段完了。web 32 tests / api 39 tests / contracts 43 tests、全体 test/lint/build/typecheck PASS(型検査は build 後再実行で PASS)。
- [!] WP-3010 SCR-026 LOCAL_ONLY モード UX(parent、BLOCKED_CAPABILITY_CONTRACT / foundationはWP-3010aで完了)— UI-2
  - [x] WP-3010a shared-kernel mode-guard projection foundation: `canConfirmExternal` / `allowsFinalCalculation` / `allowsClaimFinalization`だけを判定源に全5 modeの禁止・未禁止、理由、復旧導線、`PROVISIONAL_STATUSES`凡例をfixture表示。未禁止を実行許可とせず、権限・資格・evidence・`isClaimable`・個別接続/業務条件を追加確認として明示し、CLOUD_DEGRADED/RECOVERY_SYNCを全面許可・接続断と誤表示しない。web 99、typecheck/build、boundaries/secrets/diff check PASS、independent/medical/privacy/frontend/accessibility review APPROVED。rollbackはweb 3ファイルのrevert。
  - [!] WP-3010b ARC-001 full capability/count/live-mode contract(BLOCKED_SSOT_UPDATE_REQUIRED): 28操作・LOCAL_ONLY絶対禁止16項目の機械可読単一正本、各modeの三値状態、実SystemMode供給、仮状態件数data sourceをAPPROVED化する。薬剤師・請求実務human review必須。
  - [!] WP-3010c reachable SCR-026 route / UI-flow(BLOCKED_ON_WP-3010b): route/navigation、live mode/count binding、Testing Library/browser viewport/keyboard/a11y flowを実装・検証する。
- [!] WP-3011 SCR-012 calculation_trace ビューア(parent、BLOCKED_LIVE_CONTRACT / foundationはWP-3011aで完了)— UI-3
  - [x] WP-3011a fixture-first calculation_trace read contract/viewer foundation: APPROVED API-007/CAL-008/QUA-007に従い、`@yrese/trace`を単一正本とするzod写像、canonical `resultPoints` / `resultYen`、step/rounding由来`evidenceIds`集合一致、EvidenceRef URL/PHI-like key拒否、fixture-only viewerを実装。evidence/rounding gap、blocker、未知enumをfail-closed表示し、外部link/log/sendを追加しない。trace 37、contracts 86、web 99、workspace typecheck/test、build/boundaries/secrets/diff checkがPASS。independent/API/medical/privacy/frontend/accessibility review APPROVED。rollbackは本subtaskのcontracts/trace/web/package/lock差分のrevert。
  - [!] WP-3011b CAL-008 intermediateValues typed semantic/trust boundary(BLOCKED_SSOT_UPDATE_REQUIRED): `Record<string,string>`には数量・code・versionも含まれ、金額/点数keyを名前から推測して整数制約を掛けられない。live transport前にtyped key registry、producer責任、value PHI非包含の機械境界をAPPROVED SSOTで確定する。
  - [!] WP-3011c live calculation trace API / route integration(BLOCKED_API_CONTRACT): API-007のopen questionであるendpoint/key、`calculation:read` deny-by-default、tenant/pharmacy binding、response parse、live trace生成、reachable route/browser UI-flowを別契約で確定・実装する。
- [ ] WP-3012 SCR-025 同期状態画面(契約 SSOT 起草含む)— UI-3
- [ ] WP-3013 SCR-024 外部連携状態 — UI-3
- [ ] WP-3014 処方・調剤 API 契約 SSOT パック起草 → WP-3015 SCR-004 処方入力 / WP-3016 SCR-010+014 調剤入力・薬剤師確認 — UI-4(契約 APPROVED が発行条件)
- [ ] WP-3017 SCR-011 算定結果 / WP-3018 SCR-016+017 会計・未収 / WP-3019 SCR-018 帳票出力 — UI-5(WP-2201/2202 契約が発行条件)
- [ ] WP-3020 SCR-019 請求前点検 / WP-3021 SCR-020 月次締め — UI-6(CLM 系実装が発行条件)

### 横断

- [x] WP-4001 CI(GitHub Actions: typecheck/test/build、初回グリーン。依存方向チェック等はSSOT承認後に追加)(2116587)
- [x] WP-4002 codex側委任フロー稼働(agmsg、WP_ASSIGN→CODEX_PLAN→承認→WP_HANDOFF→レビュー→コミットを3周完走)

### データベース構築(正本: docs/plan/database_construction_plan.md = PLAN-DB-001。種別12+マスターM1〜M10+対象外3の台帳・段階計画・停止条件は計画書に従う)

- [x] WP-5001 DB設計 SSOT パック(DB-001〜004、APPROVED)— DB-0。DB-001: スキーマ設計規約(tenant/pharmacy必須・money/date型・enum二重実装禁止、ScaledDecimal scale保持)。DB-002: 前方一方向・3段適用・明示運用操作・起動時照合3分類のマイグレーション規律。DB-003: テナント分離DDL/Repository方針(通常系接続でテナント越え不可を要件化、RLSはBLOCKED_SECURITY_REVIEWまで候補)。DB-004: 保存期間・削除方針(年限未確定は削除しない、BLOCKED_LEGAL_REVIEW維持)。opus4.8 review + fable5 により v0.1.1 APPROVED 昇格。
- [x] WP-5002 開発環境 PostgreSQL + マイグレーション基盤(codex)— DB-1。repo-local forward-only SQL runner + `pg` を採用。dev PostgreSQL は `compose.yaml` の明示起動のみ(PHI投入禁止コメント付き)。初回 migration は `schema_migrations` 履歴テーブルのみ。起動時 check は DB-002 の3分類(前方互換な DB 先行許容 / checksum相違・未適用要求は拒否)の照合だけで自動適用しない。`db:migrate` の明示操作でのみ適用。既存 API は in-memory repository 既定を維持し、Repository interface 注入 seam を保持。`TEST_DATABASE_URL` 不在時の PostgreSQL 統合テストは明示 skip。
- [x] WP-5003 患者・受付リポジトリの DB 実装差し替え(API-001/006 の「DB化時」注記の実行)— DB-2。`patients` / `reception_entries` の forward migration を追加し、tenant_id+pharmacy_id 必須、accepted_at(TIMESTAMPTZ UTC instant)+business_date(DATE/JST導出)、idempotency unique(tenant_id, pharmacy_id, idempotency_key)、安定順序(accepted_at asc + reception_id asc)を実装。`ELIGIBILITY_STATUSES` / `RECEPTION_STATUSES` は shared-kernel 正本から contracts/DB検査へ接続。`DATABASE_URL` 設定時のみ PostgreSQL repository を注入し、in-memory は既定維持。統合テストは `TEST_DATABASE_URL` gate + 明示 skip。
- [ ] WP-5004 監査ログ永続化 + ハッシュチェーン(WP-2009 と統合。SEC-007/008 論理層規律の実装)— DB-3。WP-5004a core は e49ff35 で実装済み: `@yrese/audit` に決定的 canonical serialization、`entryHash = sha256(prevHash || canonicalJson)` 実計算、genesis(64 zero)検証、破断位置付き chain verification、固定 canonical JSON/entryHash golden と payload/prevHash/entryHash 改ざん否定テストを追加。follow-up db2e505 で `node:crypto` 利用に必要な `@types/node` / `types: ["node"]` を audit package に明示し、`packages/audit build` を復旧。永続化(WP-5004b)はAGT-018のmapper/pre-plan review後、sole Codex maintainerが担当し、independent verifier、`db_steward`、`data_integrity_auditor`、`security_critic`、`privacy_compliance_reviewer`がread-onlyで確認する。append-only/WORM/tenant-isolation/PHI非露出を受入条件にし、migration適用・production DML・production security/risk acceptanceは人間の別承認なしに実行しない。
- [ ] WP-5005 イベントストア + 投影再構築(ARC-005/006 の適用集約のみ)— DB-4
- [ ] WP-5006 マスター DB 版管理(MST-001 パイプライン永続化。M1〜M8 は各配布元 evidence 発行が個別前提)— DB-5
- [ ] WP-5007 Edge ローカルストア設計 SSOT(設計先行。実装は同期設計 SSOT 承認後)— DB-5
- [ ] WP-5008 帳票・文書ストア(RCP 系実装と同期)— 従属
- 本番インフラ製品の確定は独立ゲート(SEC-008 §3 の4条件 + BLOCKED_SECURITY_REVIEW 解除 + 人間承認)。どの Phase にも先行させない

## 直近の実行順序

1. WP-1001 scaffold → 2. WP-1002 shared-kernel → 3. WP-1003 money → 4. WP-1004 date-time → 5. WP-1005 trace → 6. WP-0003 フォーク成果コミット → 7. WP-1006/1007 → 8. apps scaffold(WP-2001/3001)→ 9. Phase 0 残ドキュメント並行整備

- [x] WP-4003 依存方向・重複定義チェック CI(違反注入検出を確認)(codex実装・claudeレビュー、0213ac0)
- [x] WP-2002 テナントコンテキスト/権限骨格(deny-by-default、本番無条件起動拒否 — レビュー往復でバイパス除去)(codex実装・claudeレビュー、40a2512)
- [x] WP-0015 一次資料精読(記録仕様レコード体系一式+点数約45項目。人間目視ダブルチェックが evidence_id 発行条件)(0ef7ab3)
- [x] WP-2101a 算定エンジン純粋関数骨格(空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIREDガード)(codex実装・claudeレビュー、d26424d)
- [ ] WP-0016 ONS登録手続き(人間作業依頼: オン資外部IF・電子処方箋記録条件の入手)

## Codex 自律スキャン backlog

Codex rootはcurrent WPとdirty stateを確認し、read-only mapperでコード・CI・契約・SSOT境界をscanして候補をここへ記録する。
候補から完了条件への寄与が最大の1件だけを選び、read-only Codex pre-plan reviewerがscope、SSOT/evidence、risk、test、human gateを確認した後にのみsole maintainerへ割り当てる。`CHANGES_REQUIRED`なら計画を修正し、review完了前に編集しない。untracked/dirtyな他作業のpathは所有権不明として保護する。

- [x] WP-4004 root `lint` スクリプト整合化(5729ea7)
  - 発見根拠: root `package.json` に `lint: pnpm -r --parallel lint` があるが、現時点の `apps/*/package.json` / `packages/*/package.json` に `lint` script がない。
  - 目的: ルート検証コマンドが存在しないpackage scriptで失敗しないよう、lint方針をSSOT化するか、最小のrepo-local lint/check scriptを追加する。
  - 想定スコープ: `package.json`, 各workspace `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm lint`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4005 CI build対象をworkspace実態に合わせる(5729ea7)
  - 発見根拠: root `build` は `pnpm -r build` だが、`.github/workflows/ci.yml` は `@yrese/web` と `@yrese/api` だけをbuildしており、`packages/calculation` などpackages buildがCIで直接検証されない。
  - 目的: 新規packages追加時にCI build漏れが起きないよう、CIを `pnpm -r build` へ寄せるか、packages build stepを明示する。
  - 想定スコープ: `.github/workflows/ci.yml`。
  - 検証: `pnpm -r build`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-1008 packages/events dead-letter invariant hardening(5729ea7)
  - 発見根拠: `SyncStatus` は `dead_letter` を持つが、`createEventEnvelope()` は `syncStatus === 'dead_letter'` と `deadLetterReason` の同時必須をまだ強制していない。
  - 目的: Outbox実装前に、dead letter化したイベントが理由なしで保存・転送されない型/validation基盤にする。
  - 想定スコープ: `packages/events/**`。
  - 検証: `pnpm --filter @yrese/events typecheck`, `pnpm --filter @yrese/events test`。

- [x] WP-1009 concrete error code registry seed(b5e4f22)
  - 発見根拠: `@yrese/shared-kernel` には `ErrorCodeRegistry` 型基盤がある一方、APIは `AUTH-0003` をローカル文字列として返している。
  - 目的: 承認済み最小コード(`AUTH-0003`など)をshared-kernel側で一元管理し、apps側の重複定義を避ける。
  - 想定スコープ: `packages/shared-kernel/**`, `apps/api/**`。
  - 注意: error_code_registry SSOT APPROVED 後に実装する。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [x] WP-2005 API error contract package化(bb3d237、WP-2008に統合)
  - 発見根拠: `/whoami` の403レスポンス `{ errorCode, message }` は `@yrese/contracts` に未定義で、frontend/API間の契約がhealth以外にまだ広がっていない。
  - 目的: PHIを含まない共通error response schemaを `@yrese/contracts` に追加し、API側がschema parseを通して返す。
  - 想定スコープ: `packages/contracts/**`, `apps/api/**`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [x] WP-4006 build artifact hygiene: test files excluded from dist(e51f920)
  - 発見根拠: `pnpm -r build` 後、`apps/api/dist/server.test.js` や `packages/*/dist/*.test.js` が生成され、runtime/package成果物にtest codeが混入している。
  - 目的: `tsconfig.build.json` などでbuild出力から `*.test.ts` を除外し、test/typecheckは既存コマンドで維持する。
  - 想定スコープ: `apps/api/**`, `packages/**` のtsconfig/build script。
  - 検証: `pnpm -r build`, `find apps packages -path '*/dist/*test*'` が空、`pnpm -r test`, `pnpm -r typecheck`。

- [x] WP-1010 PermissionScope runtime parser strictness(e51f920)
  - 発見根拠: `isPermissionScope()` は `value.split(':')` の先頭2要素だけを見るため、`tenant:read:extra` のような余分なsegment付き文字列を許しうる。
  - 目的: runtime validationを `PermissionScope` 型どおり `resource:action` の2segmentだけに厳格化し、dev stub header由来scopeも過剰受理しない。
  - 想定スコープ: `packages/shared-kernel/**`。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [!] WP-4007 package entrypoint/build output alignment(DEFERRED — 外部公開/partner配布決定時に再開)
  - 発見根拠: `packages/*/package.json` は `main` / `types` / `exports` が `./src/index.ts` を指す一方、`pnpm -r build` は `dist/` を生成する。build成果物を使う実行・配布・CI検証の方針がmetadataに反映されていない。
  - 目的: workspace内部はsource参照、build成果物はdist参照など、Phase 0のpackaging方針に合わせてpackage entrypointをSSOT化する。
  - historical provenance(2026-07-09 fable5判断): 当時はworkspace内消費のみで、src exportsはdev/test/transpilePackagesと整合。dist exports切替は`pnpm clean`後の解決不能やweb extensionAlias前提を壊すriskが大きいためDEFERし、外部公開/partner配布開始時にconditional exportsを再検討する判断だった。これは現行assignment/approvalではない。
  - 再開gate: Codex rootがread-only mapperでpackage consumer・build・clean checkout・web bundling・公開契約のimpactを再調査し、pre-plan reviewerがSSOT/API compatibility・rollback・test・公開riskを確認する。sole maintainer実装後はindependent verifierとpackage/build・API contract・security specialistsがreviewする。SDK/partner公開、契約・許諾、公開security/risk acceptanceはproduct/legal/securityのhuman authorityが別途承認する。
  - 想定スコープ: `packages/*/package.json`, 必要なら `tsconfig*.json`。
  - 検証: `pnpm -r build`, `pnpm -r typecheck`, `pnpm check:boundaries`。

- [x] WP-2006 API malformed permission scope regression(b5e4f22)
  - 発見根拠: `@yrese/shared-kernel` では `tenant:read:extra` を拒否する回帰テストを追加済みだが、`apps/api` の `/whoami` テストはdev header由来のmalformed scopeが権限付与されないことを直接固定していない。
  - 目的: authz境界であるAPI preHandler経路でも、malformed scopeがdeny-by-defaultになることをテストで固定する。
  - 想定スコープ: `apps/api/**`。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/shared-kernel test`。

- [x] WP-1011 shared-kernel test fixture control-character hygiene(7a74076)
  - 発見根拠: `packages/shared-kernel/src/kernel.test.ts` に実NUL/制御文字を含むfixture文字列があり、`git diff --numstat -- packages/shared-kernel/src/kernel.test.ts` がbinary扱いになる。
  - 目的: runtimeで同じ不正ID入力を検証しつつ、source file上は `String.fromCharCode(0)` 等で表現してdiff/review/toolingをtext扱いに戻す。
  - 想定スコープ: `packages/shared-kernel/src/kernel.test.ts`。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `git diff --numstat -- packages/shared-kernel/src/kernel.test.ts` が行数差分を表示、`git diff --check`。

- [x] WP-2007 API PORT environment validation(a90df35)
  - 発見根拠: `apps/api/src/main.ts` は `Number.parseInt(process.env.PORT ?? '', 10)` と `Number.isInteger` でportを決めており、`3001abc` のような文字列を3001として受理し、負数・範囲外portもlisten時まで流れる。
  - 目的: 起動設定の入力検証を明示し、未指定は3001、指定時は10進整数文字列かつ1-65535のみ受理する。
  - 想定スコープ: `apps/api/src/main.ts`, 必要なら起動設定helper/test。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`。

- [x] WP-4008 workspace TypeScript/Vitest version alignment(a90df35)
  - 発見根拠: `apps/api/package.json` は `typescript:^5.8.0` / `vitest:^3.2.0`、他workspaceは主に `typescript:^5.7.3` / `vitest:^3.0.0` で、同一repo内のtoolchain指定が揺れている。
  - 目的: Phase 0の品質方針に合わせ、workspace全体のTypeScript/Vitest version policyを一元化し、将来の型/テスト挙動差分を避ける。
  - 想定スコープ: `apps/*/package.json`, `packages/*/package.json`, `pnpm-lock.yaml`。
  - 検証: `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`。

- [x] WP-4009 CI secret/dependency scan expansion(a90df35)
  - 発見根拠: `.github/workflows/ci.yml` にはsecret scan追加TODOが残り、security/test strategy系SSOTでもsecret scan / dependency scan / SBOMがPhase 2拡充項目として記録されている。
  - 目的: 既存のtypecheck/test/build/boundaryに加え、secret混入と依存リスクをCIで機械的に検出する。
  - 想定スコープ: `.github/workflows/ci.yml`, `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm check:boundaries`, 追加scanコマンド、`git diff --check`。

- [x] WP-4010 workspace generated artifact cleanup command(a90df35)
  - 発見根拠: `pnpm -r build` 後に `apps/api/dist`, `apps/web/.next`, `packages/*/dist` が残るが、root `package.json` にclean scriptがなく、generated artifact掃除の標準手順がない。
  - 目的: build/test後のローカル状態を再現可能にするため、ignored生成物を安全に削除するrepo標準コマンドを用意する。
  - 想定スコープ: `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm build`, `pnpm clean`, `git status --short --untracked-files=all` が生成物を表示しないこと、`git diff --check`。

- [x] WP-4011 repository script regression harness(c3db115)
  - 発見根拠: `scripts/check-boundaries.mjs`, `scripts/check-secrets.mjs`, `scripts/clean.mjs` はCI品質ゲートとして重要だが、現時点では手動検証のみで、fixtureベースの自動回帰テストがない。
  - 目的: 一時workspace fixtureで boundary violation / secret finding / allowlist / clean 対象削除を自動検証し、品質ゲート自体の退行を防ぐ。
  - 想定スコープ: `scripts/**`, `package.json`。
  - 検証: 追加するscript testコマンド、`pnpm check:boundaries`, `pnpm check:secrets`, `pnpm clean`, `git diff --check`。

- [x] WP-3005 web shell smoke tests(f46d626、WP-4007と併走レビュー済み)
  - 発見根拠: `apps/web/package.json` の `test` は `vitest run --passWithNoTests` で、現時点のweb shell/navigation/system-mode badgeには自動テストがない。
  - 目的: 主要ナビゲーション項目、システムモード表示、placeholder routeの最低限のrender契約を固定し、routing shellの退行を早期検知する。
  - 想定スコープ: `apps/web/**`。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`。

- [x] WP-4018 web test gate strictness after smoke tests
  - 発見根拠: `apps/web/app/shell-smoke.test.tsx` が導入済みなのに、`apps/web/package.json` の `test` はまだ `vitest run --passWithNoTests` のまま。将来テストファイルが誤って消えても web test が成功しうる。
  - 目的: web shell smoke tests 導入後のCI退行検知力を上げるため、web test script から `--passWithNoTests` を外す。
  - 想定スコープ: `apps/web/package.json`。
  - 実施: `apps/web/package.json` の `test` を `vitest run` に変更し、webテスト不在時に成功しないゲートへ戻した。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm -r test`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4020 ssot_index 整合性 CI ゲート(codex実装・claudeレビュー、c06c913。WP-4027 で台帳反映)
  - 発見根拠: WP-0051 で索引未登録の約50文書を検出(索引の手動更新漏れが再発性の欠陥)。
  - 目的: `scripts/check-ssot-index.mjs` を新設し、docs/**/*.md と ssot_index.md の相互一致(索引にない文書・文書にない索引行・status/ssot_id の不一致・ssot_id 重複・frontmatter 欠落)を CI で機械検査する。`pnpm check:ssot-index` として root script + ci.yml に追加。
  - 想定スコープ: `scripts/check-ssot-index.mjs`, `package.json`, `.github/workflows/ci.yml`, `scripts/check-scripts.mjs`(回帰ハーネス登録)。
  - 検証: 正常系 + 意図的な不一致 fixture での検出、`pnpm test:scripts`, `pnpm check:ssot-index`。

- [x] WP-4019 OpenAPI generation pipeline(codex 実装)
  - 発見根拠: `packages/contracts/src/index.ts` に TODO(Phase 1): OpenAPI YAML generation pipeline。
  - 目的: zod 契約(単一正本)から OpenAPI YAML を生成し、契約と API ドキュメントのドリフトを構造的に防ぐ。
  - 実装: `@yrese/contracts` に OpenAPI document builder を追加し、`zod-openapi` で `docs/api/openapi.yaml` を生成。root script `generate:openapi` / `check:openapi` と CI drift check を追加し、生成物には手編集禁止ヘッダを付与。MOD-014 を v0.1.1 に改版し、OpenAPI生成方式を確定。
  - 検証: `pnpm generate:openapi`, `pnpm check:openapi`, `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/contracts typecheck`, `pnpm test:scripts`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm build`, `pnpm check:deps`, `pnpm check:sbom`, `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4021 患者検索 dev ヘッダと synthetic fixture の整合(codex 提案 SELF-SCAN-20260709-02。本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の DEV_HEADERS(t-dev/ph-dev)と `apps/api/src/patient-repository.ts` の syntheticPatients(tenant-001/pharmacy-001)が不一致で、既定の dev UI 検索が常に0件。
  - 目的: dev テナント文脈と synthetic fixture のテナントを一致させ、dev 動作確認を実態のあるものにする(本番個人情報は使用しない)。
  - 実装: Web側の既定DEV_HEADERS(t-dev/ph-dev/u-dev)は変更せず、API synthetic fixture に同テナントの非PHI合成患者を追加し、route-level APIテストで検索結果を固定。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4022 date-time 日付ラッパーの nominal brand 付与(codex 提案 SELF-SCAN-20260709-03。本WPで実装)
  - 発見根拠: 日付ラッパー3種(処方日・調剤日・請求月系)が構造的同型で異種間 compare がコンパイルを通る(shared_type_registry.md の既知課題、独立WP未登録だった)。
  - 目的: nominal brand を追加し異種日付の比較・代入を型で拒否する。共通モジュール改版のため shared_type_registry.md の改版を伴う。
  - 実装: PrescriptionDate / DispensingDate / ReceptionDate を nominal brand 化し、`compare()` / `equals()` を同種ラッパーのみに制限。実行時挙動は維持。`@ts-expect-error` 型テストで異種 compare / 代入がコンパイル不可であることを固定し、MOD-004 を v0.1.1 へ改版。
  - 検証: `pnpm --filter @yrese/date-time test`, `pnpm --filter @yrese/date-time typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4023 PatientHeader 資格状態型の contracts 一本化(codex 提案 SELF-SCAN-20260709-04)
  - 発見根拠: `apps/web/app/components/patient-header.tsx` が `EligibilityDisplayStatus` union をローカル定義しており、`packages/contracts/src/patient-search.ts` の `ELIGIBILITY_STATUSES` / `EligibilityStatus`(正本)と二重実装(COMMON_MODULE_DUPLICATION_BLOCKED 対象)。
  - 目的: PatientHeader の資格状態型を contracts 正本から参照させ、表示ラベルのみ web 側責務として残す。
  - 実装: `EligibilityDisplayStatus` を `@yrese/contracts` の `EligibilityStatus` alias に変更し、ローカル union を削除。`ELIGIBILITY_LABELS` は web 側の表示責務として維持。
  - 検証: `pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web test` 33 PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4025 API health timestamp clock injection(codex 自律スキャン SELF-SCAN-20260709-05)
  - 発見根拠: `apps/api/src/server.ts` の `/health` が `new Date().toISOString()` を直接呼び、`apps/api/src/server.test.ts` は timestamp をparse可能かだけ確認しており、health契約の決定的な回帰テストができない。
  - 目的: `buildServer()` に低リスクな clock injection を追加し、通常運用の現在時刻生成は維持しつつ、テストでは固定時刻でhealth responseを検証できるようにする。
  - 実施: `BuildServerOptions.now` を追加し、`/health` の timestamp を `now().toISOString()` へ切り出した。既存の本番挙動はデフォルトclockで維持。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4026 API PORT validation fail-fast(codex 自律スキャン SELF-SCAN-20260709-06)
  - 発見根拠: WP-2007 は `PORT` 指定時に10進整数文字列かつ1〜65535のみ受理する方針だが、現実装は `3001abc` / `0` / `65536` などを黙って `3001` へフォールバックしており、設定ミスを隠す。
  - 目的: `PORT` 未指定・空白は従来どおりdefault 3001、明示指定が不正な場合は起動失敗としてfail-fastにする。
  - 実施: `parseApiPort()` を不正指定で `RangeError` を投げる契約へ変更し、`main.ts` のtryブロック内でport解決を行うようにした。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-2009 audit hash-chain canonicalization / hydrate split
  - 発見根拠: WP-2003 は assignment 明記どおり `prevHash` / `entryHash` の sha-256 hex 形式検証のみで、entryHash 計算自体は呼び出し側/永続層責務として残した。SEC-007 は最終的に `entryHash = H(prevHash || 正規化ペイロード)` を要求する。
  - 目的: 監査ログ永続化実装時に、canonical payload から entryHash を生成する作成APIと、保存済みレコードを検証して復元する hydrate/verify API を分離し、任意hexを真正性証跡として扱わない。
  - 想定スコープと現行routing: `packages/audit/**`、将来の監査永続化パッケージ/アプリ配線。SEC-007/MOD-008改版が必要なら、Codex rootがmapper evidenceからSSOT WPを発行し、pre-plan reviewer、sole maintainer、independent verifier、`security_critic`、`privacy_compliance_reviewer`、`db_steward`、`data_integrity_auditor`の順で進める。retention/legal interpretation、production security/risk acceptance、migration適用・production writeはlegal/security/data-governanceのhuman authorityによる別承認を維持する。
  - 検証: payload変更でhash不一致になるテスト、prevHash連鎖テスト、hydrate時の不一致拒否テスト、`pnpm --filter @yrese/audit test`。
  - opus4.8 事後レビュー申し送り(2026-07-09、M3aで解消): 当時はsha256 hex形式検証のみだったが、WP-5004aでentryHash計算/chain検証、M3aでhydrate再計算照合を実装し、pure coreの任意hash真正扱いを閉じた。永続adapter配線は後続reviewまで引き続きHOLD。
  - M3a/WP-2009完了: fable5 `PLAN_APPROVED` に基づき、`hydrateAuditEvent(unknown)` を追加。root/nestedのexact plain own enumerable data shapeをdescriptorで全検証してから内部copyし、optional明示`undefined`、非canonical wallClock、domain/hash形式不正を固定非echo `malformed_event` に収束。`createAuditEvent` だけでdomain検証とentryHash再計算を行い、形状/domain/hash形式が正しい保存行のhash不一致だけを `entry_hash_mismatch` とした。戻り値は入力と独立したroot/nested frozen再生成物。
  - 保存event fingerprint: `computeAuditEventIntentFingerprint` は同じexact event shape validatorを再利用し、trusted contextのtenant/pharmacy/actor完全一致を固定 `AuditEventContextMismatchError` で強制。M1 `intentFields` 単一正本から存在するoptionalだけを射影し、chain位置(`sequenceNumber`/`prevHash`/`entryHash`)を除外して既存v1 canonicalizer/version dispatchへ委譲する。`retryCount` は引き続きlogical intentへ含む。
  - M3a検証: hydration 56 + fingerprint 71 = focused 127、audit全体173、全workspace typecheck/test、audit/full build、OpenAPI、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、diff-checkがPASS。独立 verifier 10/10 と read-only Opus最終reviewはいずれも `APPROVED`、blocker/HIGH findingなし。raw DynamoDB item codecは物理属性envelope未確定のため `SSOT_UPDATE_REQUIRED` として停止し、AWS SDK/table/network/write、DynamoDB Local、DB操作/migration、TIP/genesis/state/TWI/CAS/retry/persistence verifyは未変更。

- [x] WP-4024 audit 実行時ガードの否定テスト補強(opus4.8 レビュー指摘 LOW。本WPで実装)
  - 発見根拠: WP-2003 事後レビューで、assertTargetRef(空/制御文字/非snake_case)、assertOutcome(不正値)、businessReasonCodePattern(小文字/不正コード)、correlationId 欠落の否定テストが未カバーと指摘。ガード自体は実装済みで正しく動作。
  - 目的: 回帰保護のため否定テストを追加する。実装変更は不要。
  - 実装: `targetRef` 空/制御文字/非snake_case、invalid outcome、malformed `businessReason.code`、missing `correlationId` の否定テストを追加。実装コード変更なし。
  - 検証: `pnpm --filter @yrese/audit test`, `pnpm --filter @yrese/audit typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4027 WP-4020 完了の台帳反映(codex 提案 SELF-SCAN-20260709-07。本改版で反映済み)

- [x] WP-4028 算定パッケージ純粋関数規律の静的検査ゲート(codex 提案 SELF-SCAN-20260709-08。本WPで実装)
  - 発見根拠: CAL-010 が `Date.now` / `new Date(` / `Math.random` / `parseFloat` 等の静的検査を独立WP候補として明記する一方、現行 check-boundaries は import 方向・循環・重複定義のみ。
  - 目的: packages/calculation(将来は money/date-time も)に対する禁止パターン静的検査を CI ゲート化する。CAL-010 APPROVED 後に実装。
  - 実装: `scripts/check-calculation-purity.mjs` を独立追加し、`packages/calculation` の非テスト source に限定して CAL-010 列挙の `Date.now()` / `new Date()` / `Math.random()` / `parseFloat()` / `Math.round()` を fail-closed 検出する。コメントは検査前に除外し、test/spec file は対象外。root script `check:calculation-purity` と CI に接続し、script regression fixture で違反注入検出・コメント/テスト除外を固定。
  - 検証: 違反注入 fixture での検出、`pnpm test:scripts`, `pnpm check:calculation-purity`, `pnpm --filter @yrese/calculation test`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4029 患者検索 cursor の contract 層上限(codex 提案 SELF-SCAN-20260709-09。本WPで実装)
  - 発見根拠: `patientSearchQuerySchema` の `cursor: z.string().optional()` に長さ上限がなく、巨大 cursor 文字列を contract 層で拒否できない。
  - 目的: cursor に妥当な max 長を設け、fail-closed に契約層で拒否する(API-001 の改版を伴う場合は SSOT 先行)。
  - 実装: `PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512` を contracts 正本として追加し、query cursor / response nextCursor schema と API-001 文書へ反映。長大 cursor は decode 前に `PAT-0001`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/contracts typecheck`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4030 不正 dev ID ヘッダの API 否定テスト補強(codex 提案 SELF-SCAN-20260709-10。本WPで実装)
  - 発見根拠: dev tenant stub は空白・制御文字入り `x-dev-tenant` 等を branded ID factory で拒否する設計だが、API route 経由の否定テストは「ヘッダ欠落・scope不足・malformed scope」までで不正IDヘッダの deny 検証が未カバー。
  - 目的: 不正IDヘッダ→401/403 の回帰テストを追加する。実装変更は原則不要。
  - 実装: `/whoami` と `/patients/search` で、空白 tenant / 制御文字 pharmacy / 制御文字 actor を 403 `AUTH-0003` として拒否する route-level 回帰テストを追加。実装コード変更なし。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4031 @yrese/trace の CAL-008 拡張フィールド実装(codex 提案 SELF-SCAN-20260709-11。本WPで実装)
  - 発見根拠: CAL-008 calculation_trace_schema は APPROVED 済みだが、@yrese/trace は拡張前の CalculationTraceStep 形状のみを公開している。
  - 目的: CAL-008 定義の後方互換な optional 拡張フィールドと実行時ガードを実装する(affectsClaim=true→evidenceRef 必須の既存不変条件は維持)。
  - 実装: `feeItemCode` / `formula` / `intermediateValues` / `rounding` / `stepStatus` / `resultPoints` / `resultYen` を optional 追加。`rounding.evidenceId` 必須、intermediateValues string-only/PHI-like key拒否、stepStatus enum検証、nested freeze、rounding evidenceId集約を実装。
  - 検証: `pnpm --filter @yrese/trace test`, `pnpm --filter @yrese/calculation test`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4032 EventEnvelope ID/enum runtime guard(codex 提案 SELF-SCAN-20260709-12、fable5 triage 済み。本WPで実装)
  - 発見根拠: `packages/events/src/index.ts` の `createEventEnvelope()` は ID-like fields の非空検査とPHI暗号化不変条件を持つが、ID制御文字拒否は `packages/audit` 側が個別実装している。また read-only probe で `syncStatus='lost'`、`phiClassification='bad'`、`encryptionStatus='plain'` が受理されることを確認。
  - 目的: Outbox/Inbox境界のイベントが制御文字入りIDや未承認 enum 値を保持しないよう、EventEnvelope自体で fail-closed にする。
  - 実装: 既存 union literal を `@yrese/events` の exported const tuple へ昇格し、型を tuple から派生。`createEventEnvelope()` で ID-like fields の空白のみ・制御文字を拒否し、`syncStatus` / `phiClassification` / `encryptionStatus` を MOD-009 値の allow-list で runtime 検証する。PHI≠none→encrypted と dead-letter reason の既存不変条件は維持。
  - 検証: `pnpm --filter @yrese/events test`, `pnpm --filter @yrese/events typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4033 @yrese/money RoundOptions.mode runtime guard(codex 提案 SELF-SCAN-20260709-13。本WPで実装)
  - 発見根拠: `packages/money/src/index.ts` の丸め分岐は `RoundingMode` の実行時検証を持たず、read-only probe で `ScaledDecimal.fromString('12.345').round({ scale: 2, mode: 'invalid_mode' as any })` と `mode: undefined` がどちらも `12.34` を返した。
  - 目的: 金額・点数領域で不正丸めモードを黙って toward_zero 相当に扱わず、設定ミスや外部入力バグを早期に検出する。
  - 実装: MOD-010 の7種と一致する `ROUNDING_MODES` const tuple から `RoundingMode` 型を派生させ、`round()` で `options.mode` を allow-list 検証する。不正/未指定 mode は `RangeError` で fail-closed。既存の丸め結果・政策値/evidence 規律は変更なし。
  - 検証: `pnpm --filter @yrese/money test`, `pnpm --filter @yrese/money typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4034 calculation StepResult runtime shape guard(codex 提案 SELF-SCAN-20260709-14、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: custom rule が `{ status: 'SKIPPED' } as any` を返す read-only probe で、`calculate()` は意図的な fail-closed エラーではなく `TypeError Cannot read properties of undefined (reading 'trim')` を投げた。
  - 目的: 将来の rule DSL / adapter-generated rules 境界で、不正 `StepResult` を曖昧な TypeError ではなく明示的な規律違反として拒否する。
  - 実装: `rule.apply()` 直後に `StepResult` runtime shape guard を追加。`status` 不正、`ITEM_CALCULATED` 必須フィールド欠落、`BLOCKED` の blocker 欠落などは例外ではなく `BLOCKED` 結果として返し、blocker は `SSOT_UPDATE_REQUIRED`、warning は `算定ルール戻り値SSOT不一致(SSOT_UPDATE_REQUIRED)` に統一した。既存の算定ルール・点数値・正常系 trace/golden は変更なし。
  - 検証: `pnpm --filter @yrese/calculation test`, `pnpm --filter @yrese/calculation typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4035 contract enum/status duplication boundary scan expansion(codex 提案 SELF-SCAN-20260709-15、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: `scripts/check-boundaries.mjs` の重複 const 検査は shared-kernel 由来名かつ `packages/**` 中心で、`packages/contracts/src/patient-search.ts` の `ELIGIBILITY_STATUSES` に対応する `apps/web` 側ローカル union 再定義のような contract-owned enum drift を検出できない。
  - 目的: WP-4023 で PatientHeader の資格状態型を contracts 正本へ寄せた後、同種の重複再発を CI で検出できるよう tooling gate を広げる。
  - 実装: `check-boundaries` の重複 const 検査を `apps/**` にも拡大し、contracts 正本 const(`ELIGIBILITY_STATUSES`, `PATIENT_SEARCH_CURSOR_MAX_LENGTH`)の再定義を violation 化。`*.test.*` は現行慣行どおり除外。MOD-003 を v0.1.2 へ改版。
  - 検証: `pnpm test:scripts`(apps側違反注入fixtureで contracts const 2種の検出実証), `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4036 ErrorResponse errorCode contract hardening(codex 提案 SELF-SCAN-20260709-16、fable5指示により実装)
  - 発見根拠: `packages/contracts/src/error.ts` の `errorResponseSchema` は `errorCode: z.string().min(1)` のみで、read-only probe では `not-a-code` と `AUTH-3` が受理された。一方、`packages/shared-kernel/src/error-codes.ts` と `docs/modules/error_code_registry.md` は `AUTH-0003` / `PAT-0001` などの形式・登録台帳を持つ。
  - 目的: API契約が malformed / unregistered errorCode を許す状態を避け、contract-first error handling と frontend/admin diagnostics の信頼性を上げる。
  - 実装: `@yrese/contracts` の `errorResponseSchema` を `@yrese/shared-kernel` の `createKernelErrorCodeRegistry()` へ接続し、登録済み `AUTH-0003` / `PAT-0001` のみを契約層で受理。`AUTH-3` / `not-a-code` / `SYSTEM-9999` は fail-closed。新規ローカル enum/const は作らず、既存の contracts -> shared-kernel 依存方針に従う。
  - 検証: 裁定後に `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4037 PatientSearch stale response/race guard(codex 提案 SELF-SCAN-20260709-17、WP-3008/SCR-002で解消済み)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の `runSearch()` は request id / AbortController / latest query guard を持たず、先に投げた検索の遅延レスポンスが後続検索結果を上書きしうる。患者検索結果は患者取り違え防止UIの入口であり、古い検索結果表示は医療安全上の誤認につながる。
  - 目的: 最新検索だけが state を更新できるようにし、追加読み込み時も対象 query/cursor の整合を保つ。併せて患者検索UIのコンポーネントテストを追加し、stale response を固定する。
  - 解消根拠: 現行 `createSearchRunner()` は generation guard により古い成功・失敗・append を破棄し、`apps/web/app/patients/patient-search.test.tsx` は stale success / stale failure / stale append を回帰テストで固定済み。
  - 検証: `pnpm --filter @yrese/web test` 33 PASS、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4038 PatientSearch dev header production boundary(codex 提案 SELF-SCAN-20260709-18、WP-3008/SCR-002で解消済み)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` は client component 内で常に `x-dev-tenant` / `x-dev-pharmacy` / `x-dev-actor` / `x-dev-scopes` を送信する。バックエンド dev tenant stub は `NODE_ENV=production` で起動拒否されるが、Web 側は production build でも dev header を送る構造のまま。
  - 目的: 本番認証(OIDC等)のSSOT承認前でも、dev-only header が production bundle / production API request の前提にならないよう境界を明確化する。暫定的には dev-only adapter に隔離し、productionでは BLOCKED_SECURITY_REVIEW 表示または認証adapter未実装エラーへ fail-closed にする。
  - 解消根拠: 現行 `devTenantHeaders()` は `NODE_ENV === "development"` の場合だけ dev tenant headers を返し、production/test/undefined では `{}` を返す。production-like 境界は web test で固定済み。
  - 検証: `pnpm --filter @yrese/web test` 33 PASS、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4039 @yrese/trace runtime enum/kind guard(codex 提案 SELF-SCAN-20260709-19、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: `packages/trace/src/index.ts` の `createLegalTrace()` は `targetType` を runtime allow-list で検証していない。また `createCalculationTrace()` の `inputsSummary.ids[].kind` / `dates[].kind` も Object.freeze のみで、型を迂回した不正 kind や空 id/value を保持できる。
  - 目的: calculation_trace / legal_trace が未承認 target/kind や空参照を保持しないよう、TraceIdRef.kind / TraceDateRef.kind / LegalTraceTargetType を正本値から派生した allow-list で fail-closed にする。
  - scope注記: WP-4034 opus4.8 申し送りとして、将来 `calculation` 側で `exclusivityGroup` を使うルールを追加する前に、`validateEvidenceRefShape()` でも `EvidenceSourceType` allow-list 照合を行うこと。現状は `exclusivityGroup` 使用ゼロかつ trace 側で不正 `sourceType` を拒否するため低優先。
  - 実装: `@yrese/trace` に EvidenceSourceType / TraceIdRef.kind / TraceDateRef.kind / CalculationTraceStepStatus / LegalTraceTargetType の const tuple 正本と runtime allow-list を追加し、入力ID/日付/マスター版/ルール版/legal target を fail-closed 検証。`@yrese/calculation` の `validateEvidenceRefShape()` は trace の `isEvidenceSourceType()` を再利用して exclusivityGroup.evidenceRef.sourceType を SSOT_UPDATE_REQUIRED BLOCKED にする。
  - 想定スコープ: `packages/trace/**`。CAL-008/MOD-004 との整合確認後に実装。
  - 検証: `pnpm --filter @yrese/trace test`, `pnpm --filter @yrese/trace typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4040 @yrese/money constructor input type guard(codex 提案 SELF-SCAN-20260709-20、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: `packages/money/src/index.ts` の `parseIntegerInput()` は `bigint` / `number` 以外を string として扱い `value.trim()` へ進むため、型を迂回した object / boolean 等で意図的な `RangeError` ではなく `TypeError` になりうる。`ScaledDecimal.fromString()` も string runtime guard を持たない。
  - 目的: 金額・点数境界で不正入力を曖昧な TypeError にせず、外部入力・fixture・adapter生成値の誤配線を明示的に拒否する。WP-4033(rounding mode guard)とは別に constructor 入力境界を固める。
  - 実装: `parseIntegerInput()` を `unknown` 境界で受け、`bigint` / safe integer `number` / integer `string` 以外を `RangeError` で拒否。`ScaledDecimal.fromString()` に string runtime guard を追加し、型を迂回した decimal / yen / point constructor 入力の否定テストを追加。既存の計算結果・丸め挙動・政策値は不変更。
  - 想定スコープ: `packages/money/**`。
  - 検証: `pnpm --filter @yrese/money test`, `pnpm --filter @yrese/money typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4041 PatientSearch eligibility safety label alignment(codex 提案 SELF-SCAN-20260709-21、WP-3008/SCR-002で解消済み)
  - 発見根拠: `apps/web/app/components/patient-header.tsx` は `PENDING_REVERIFY` を「資格再確認待ち(請求前に再確認必須)」、`LOCAL_ONLY_UNVERIFIED` を「ローカル参照のみ(オンライン未確認)」と表示する一方、`apps/web/app/patients/patient-search.tsx` の検索結果表示は「資格再確認待ち」「ローカル参照のみ(未確認)」に留まり、請求前再確認必須・オンライン未確認の安全含意が弱い。
  - 目的: 患者検索結果段階でも外部確認未了状態を弱く見せず、PatientHeader / UIX-001 / status_registry と同じ安全文脈で表示する。WP-4023(型のcontracts一本化)と整合させ、表示文言はfrontend責務として管理する。
  - 解消根拠: 現行 PatientSearch は `PatientHeader` の `ELIGIBILITY_LABELS` を再利用し、資格状態表示文言の二重実装を持たない。web test は `PENDING_REVERIFY` / `LOCAL_ONLY_UNVERIFIED` が PatientHeader と同一の安全文言で表示されることを固定済み。
  - 検証: `pnpm --filter @yrese/web test` 33 PASS、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4042 /whoami contract and OpenAPI coverage decision(codex 提案 SELF-SCAN-20260709-22、API契約境界。現行実装で解消済み)
  - 発見根拠: `apps/api/src/server.ts` は `/whoami` を実装し、`apps/api/src/server.test.ts` も 200/403 を検証しているが、`@yrese/contracts` に `whoamiResponseSchema` がなく、WP-4019 の `docs/api/openapi.yaml` 生成対象にも含めていない。現状の契約正本は `/health` と API-001 `/patients/search` に限定されている。
  - 目的: `/whoami` を公開API、内部API、dev-only診断エンドポイントのどの契約境界に置くか fable5 が裁定する。公開または内部APIとして維持する場合は個別契約SSOT、contracts schema、OpenAPI生成対象へ追加する。dev-only診断エンドポイントなら production/API-first dogfooding から除外する方針を文書化する。
  - 解消根拠: 現行 `@yrese/contracts` は `whoamiResponseSchema` / `WhoamiResponse` を export 済みで、`apps/api/src/server.ts` の `/whoami` は schema parse を通して返す。OpenAPI 生成対象にも `/whoami` と `WhoamiResponse` が含まれ、`docs/api/openapi.yaml` に反映済み。
  - 検証: `pnpm --filter @yrese/contracts test` 66 PASS、`pnpm check:openapi` PASS、`pnpm --filter @yrese/api exec tsx -e ...server.printRoutes()` で `/whoami` 登録確認、`git diff --check` PASS。

- [x] WP-4043 audit/common-module SSOT implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-23、SSOT整合)
  - 発見根拠: `packages/audit` は WP-2003 以降で実装済みだが、`docs/modules/common_module_inventory.md` は `packages/audit(仮)` を今後候補のまま、`docs/modules/common_module_boundary.md` は audit event type を「未実装」、`docs/modules/audit_event_registry.md` も「実装状態: 未着手」「将来 packages/audit」と記載している。
  - 目的: 承認済みSSOTが実装済み共通モジュールを未実装扱いし続ける drift を解消し、以後の Work Package が古い状態を根拠に重複実装や誤った owner/scope を組まないようにする。
  - 解消根拠: WP-4043/6c5aa61 で MOD-001/002/003/008/012 を version +0.0.1 し、`@yrese/audit` / `@yrese/contracts` / OpenAPI drift check / 依存グラフ / 実装済みパッケージ数を現行 packages/* 実態へ同期。要件・文法・禁止事項は不変更。
  - 想定スコープ: `docs/modules/common_module_inventory.md`, `docs/modules/common_module_boundary.md`, `docs/modules/audit_event_registry.md`, 必要なら `docs/ssot_index.md`。SSOT改版が必要なため fable5 裁定後に実施。
  - 検証: `rg -n \"packages/audit|audit event type|未実装|未着手|WP-2003\" docs/modules`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4044 contracts/OpenAPI common-module SSOT implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-24、SSOT整合)
  - 発見根拠: `@yrese/contracts` は WP-2008 で `/patients/search` 契約、WP-4019 で zod 正本→OpenAPI 3.1 生成と `pnpm check:openapi` drift gate を実装済みだが、`docs/modules/common_module_inventory.md` と `docs/modules/common_module_boundary.md` はまだ「health のみ」と記載し、`docs/modules/validation_schema_policy.md` も contract drift を「将来 CI 検査」と記載している。
  - 目的: API契約・OpenAPI生成の実装状態を共通モジュールSSOTへ反映し、以後の contract-first WP が古い「healthのみ / drift検査未実装」前提で計画されることを防ぐ。
  - 解消根拠: WP-4043/6c5aa61 に統合。MOD-001/002/012 で `@yrese/contracts` を health/error/patients/search/whoami + OpenAPI 3.1生成済みへ更新し、MOD-003 で contracts→shared-kernel 依存も反映。
  - 想定スコープ: `docs/modules/common_module_inventory.md`, `docs/modules/common_module_boundary.md`, `docs/modules/validation_schema_policy.md`, 必要なら `docs/ssot_index.md`。SSOT改版が必要なため fable5 裁定後に実施。
  - 検証: `rg -n \"health のみ|contract drift は将来|OpenAPI 生成\" docs/modules`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4045 API-001 contracts/shared-kernel dependency policy cleanup(codex 提案 SELF-SCAN-20260709-25、fable5正式アサイン範囲)
  - 発見根拠: WP-4042 で `@yrese/contracts` は `whoamiResponseSchema` の PermissionScope 検証のため `@yrese/shared-kernel` へ依存し、MOD-001/003/012 もそれを反映済み。一方 `docs/api/patient_search_contract.md` はまだ「contracts → shared-kernel 依存は追加しない」と記載していた。
  - 目的: API-001 と MOD-003/MOD-012 の依存方針を整合させる。fable5裁定により、contracts は shared-kernel の値源・ガード(`isPermissionScope` 等)を再利用してよく、依存方向は MOD-003 に従う。
  - 実装: API-001 を v0.2.2 へ改版し、古い依存禁止文言を shared-kernel 値源・ガード再利用可の方針へ更新。契約形状・実装コードは不変更(d37963b)。
  - 検証: `rg` による依存文言確認、`pnpm check:ssot-index`, `pnpm check:boundaries`, `git diff --check`, `git diff --cached --check`。

- [x] WP-4046 API ID wire-field validation policy decision(codex 提案 SELF-SCAN-20260709-25 の残論点、fable5裁定済み)
  - 発見根拠: `whoamiResponseSchema` / `patientSearchResultSchema` の ID系 wire field は `z.string().min(1)` に留まり、shared-kernel の branded ID factory が拒否する空白のみ・制御文字を契約層で拒否するか未裁定。
  - 目的: fable5 が「contracts は shared-kernel ID factory/refine を再利用して ID wire field も fail-closed に寄せる」か「wire schema は plain string のまま、ID正規化は apps/api 側責務として明記する」かを裁定し、SSOTと実装を一致させる。
  - 実装: fable5 裁定に従い、wire ID は素の string を維持しつつ、`@yrese/contracts` に shared-kernel branded ID factory 由来の共通 refine を追加。`patientSearchResultSchema.patientId`、`whoamiResponseSchema.tenantId/pharmacyId/actorId`、受付キューの `receptionId` / `patientId` を同一水準(非空・空白のみ拒否・制御文字拒否・最大128文字)へ統一。API-001 / API-006 / MOD-012 / MOD-001 を改版し、OpenAPI へ maxLength 128 を再生成反映。
  - 検証: `pnpm --filter @yrese/contracts test` 66 tests PASS、`pnpm --filter @yrese/contracts typecheck` PASS、`pnpm --filter @yrese/api test` 40 tests PASS、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:openapi` PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`pnpm -r typecheck` PASS、`git diff --check` PASS。

- [x] WP-4047 Quality/Security CI scan implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-26、fable5 APPROVED_AS_WP。本WPで実装)
  - 発見根拠: WP-4009/WP-4012 で `check:secrets` / `check:deps` / `check:sbom` は package.json と CI に実装済みだが、quality/security/testing 系SSOTの一部が「未着手」「Phase 1/2でCI追加予定」のまま残っていた。
  - 目的: 実装状態の記述のみを WP-ID/commit 根拠付きで実態同期し、規律・要件・脅威判断は変更しない。
  - 実装: QUA-001 / TST-001 / SEC-002 / SEC-003 / SEC-004 を version +0.0.1。secret scan は WP-4009/a90df35、dependency scan / SBOM は WP-4012/b0ecf84+702c2f5 に同期。SAST/DAST、fixtures PHI scan、isolation/E2E/golden 等の未実装状態は維持。
  - 検証: `rg` による drift 文言確認、`pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4048 SEC-001 vulnerability/patch scan implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-27、fable5 APPROVED_AS_WP。本WPで実装)
  - 発見根拠: WP-4047 で QUA-001/TST-001/SEC-002/SEC-003/SEC-004 は secret/dependency/SBOM CI 実装状態へ同期したが、SEC-001 `docs/security/security_guideline_mapping.md` の脆弱性・パッチ管理行はまだ「CI一部実装(boundary check)、scan拡充は Phase 2」と記載している。現実には `check:secrets`(WP-4009/a90df35) と `check:deps`/`check:sbom`(WP-4012/b0ecf84+702c2f5) が CI で稼働中。
  - 目的: SEC-001 の実装状態だけを WP-ID/commit 根拠付きで実態同期する。第7.0版本文未精読、管理策番号、追加SAST/DAST、定期スキャン運用などの要件判断は変更しない。
  - 実装: SEC-001 を v0.1.1 へ改版し、脆弱性・パッチ管理行の実装状態を `check:secrets`(WP-4009/a90df35)、`check:deps` + `check:sbom`(WP-4012/b0ecf84+702c2f5) に同期。第7.0版精読待ち、管理策番号、追加SAST/DAST、定期スキャン運用の未着手状態は維持。
  - 想定スコープ: `docs/security/security_guideline_mapping.md`, 必要なら `docs/ssot_index.md`。status 不変、version +0.0.1、変更履歴1行。
  - 検証: `rg` による drift 文言確認、`pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4049 reception contract/common-module implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-28、fable5正式アサイン。本WPで実装)
  - 発見根拠: WP-3009-BE/93aefa1 で `ReceptionId` / `RECEPTION_STATUSES` / `reception` permission resource / RCV-0001〜0003 / `@yrese/contracts` reception queue schema + OpenAPI が実装済みになった。一方、`docs/modules/common_module_inventory.md` は `@yrese/contracts` を health/error/patients/search/whoami のまま、`docs/modules/validation_schema_policy.md` も同じ契約一覧・テスト先例のまま残っている。件数表記も shared-kernel/contracts/audit/calculation などが最新テスト数とずれ始めている。
  - 目的: 受付キュー実装後の共通モジュールSSOTの実装状態だけを同期し、後続の WP-3009-UI / Integration Hub / contract-first 実装が古い契約一覧・件数を根拠にしないようにする。要件・規律・禁止事項は変更しない。
  - 実装: MOD-001/002/012 と API-006 を version +0.0.1 し、WP-3009-BE/93aefa1 の ReceptionId / RECEPTION_STATUSES / reception scope / RCV-0001〜0003 / reception queue contracts+OpenAPI+apps/api 実装状態、WP-4028/12f1bb7 の calculation purity gate、現行テスト数(shared-kernel 23 / money 15 / trace 14 / contracts 43 / audit 32 / calculation 20)を同期。要件・規律・wire形状は不変更。
  - 想定スコープ: `docs/modules/common_module_inventory.md`, `docs/modules/common_module_boundary.md`, `docs/modules/validation_schema_policy.md`。必要なら `docs/ssot_index.md`。各文書は status 不変、version +0.0.1、変更履歴1行、根拠は WP-3009-BE/93aefa1。
  - 検証: `rg -n "health / error / patients/search / whoami|ReceptionId|RECEPTION_STATUSES|reception queue|テスト" docs/modules`, `pnpm check:ssot-index`, `git diff --check`。

- [ ] WP-4050 reception/audit atomic persistence and repair boundary(HIGH data integrity/audit) — PARTIAL / BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - 現行事実: `apps/api/src/server.ts:427-465`の`POST /reception`は新規受付に対して`reception.created`をaudit repositoryへ配線済み。ただし`apps/api/src/db/reception-repository.ts:162-166`のreception DB `COMMIT`が先行し、その後に別audit appendをawaitする。audit append失敗時は受付だけが永続化してHTTP失敗となり、同一key再送は`existing`となる一方、現行codeは`created`だけを監査するため欠落イベントを補修しない。
  - root cause/impact: 業務mutationと監査appendに共通のdurable transaction/outbox/reconciliation境界がない。受付済みだが監査証跡が欠落した状態を恒久化し、blind retry・監査完全性・運用復旧を不整合にする。
  - required decision: transaction/outbox/repairのcanonical設計、`existing`再送時の補修規律、audit sink障害時のAPI outcome、idempotency lifecycle、observability/recovery/rollbackをAPPROVED SSOTへ確定する。AIだけでaudit semantics、DB migration、残存riskを確定しない。
  - review/human gate: 実装前にR3 scope reviewとsecurity/privacy/data-integrity/medical-safety authorityを要求。migration適用、production write、監査制約緩和は別の明示human approvalなしに行わない。
  - acceptance: create commit後audit append失敗、response loss、同key existing retry、process restartをsynthetic/DB integrationで固定し、受付と`reception.created`が各1件へ収束する。PHI-free identifier-only targetRef、tenant/pharmacy/actor、append-only chain、error non-leakageを維持し、`pnpm --filter @yrese/api test`、PostgreSQL integration、audit tests、boundaries/secrets/full regressionをPASSする。

- [x] WP-4051 reception idempotency durability boundary(codex 提案 SELF-SCAN-20260709-30、WP-5003実装済み・PostgreSQL CI実証完了)
  - 実装現状: WP-5003 と `000002_create_patient_and_reception_tables.sql` で `reception_entries`、`(tenant_id, pharmacy_id, idempotency_key)` UNIQUE、transaction内 `INSERT ... ON CONFLICT DO NOTHING` + scoped既存行取得は実装済み。同一scope/key/同一patientは元の受付を返し、別patientだけを conflict とする永続挙動を持つ。
  - 本WP追加: test-only PostgreSQL integration proofを4件追加。同一patientの並行createは `created` + `existing` と同一DB行へ収束、別patientの並行createは `created` + `idempotency_conflict` と1行へ収束、repository再生成後の同一受付返却、同一keyのtenant/pharmacy 3 scope分離を、順序・winner・sleep・retry仮定なしで固定した。fixture/keyは合成・非PHI。
  - 契約境界: API-006のclient payloadはpatientIdのみであり、同一patient再送ではserver採番 `acceptedAt`、導出 `businessDate`、`receptionId` の差を無視して既存受付を返す。fingerprint/hashは追加しない。WP-4054はWP-4076の裁定どおり `PLAN_INVALID_AS_WRITTEN` のまま維持する。
  - 完了検証: implementation commit `6f5bd5b` をpush。GitHub Actions run `29062131540` / job `86266062178` は1m14sでsuccessし、CI disposable PostgreSQL上でrepository integration 7件(既存3 + 新規4、603ms)、migration-runner integration 2件、API 10 files / 170 testsが全件PASS・0 skipped。typecheck/test/build/OpenAPI/secrets/deps/SBOM/boundaries/calculation purity/SSOTの全CI stepもgreen。migration/source/API契約/OpenAPI/package/lock、fingerprint/hashは変更せず、local/prod DBや他環境への適用は行っていない。

- [x] WP-4052 web typecheck prebuild reproducibility(codex 提案 SELF-SCAN-20260709-31、fable5 裁定で tooling 領域として codex 実装可)
  - 発見根拠: clean build 前の全体検証で `pnpm -r typecheck` が `apps/web/.next/types/**/*.ts` の TS6053(file not found)で失敗し、`pnpm build` 後の再実行では PASS した。`apps/web/tsconfig.json` は `.next/types/**/*.ts` を include しているが、`apps/web` の `typecheck` script は `tsc --noEmit` のみで Next 生成型を事前生成しない。
  - 目的: CI/ローカルの型検査を build 実行順序に依存させず、clean checkout でも `pnpm -r typecheck` が再現可能に通るようにする。医療UI実装の品質ゲートで「build 後なら通る」状態を残さない。
  - 実装: `apps/web` の `typecheck` を `next typegen && tsc --noEmit` に変更し、`.next/types` 生成を型検査前に実行する。UIコード・webpack extensionAlias・Next/React の実行時設定は不変更。
  - 検証: clean `.next` state で `pnpm --filter @yrese/web typecheck`, `pnpm -r typecheck`, `pnpm --filter @yrese/web test`, `pnpm build`, `git diff --check`。

- [x] WP-4053 reception business date JST boundary(codex SELF-SCAN-20260709-32、fable5 WP_ASSIGN)
  - 発見根拠: `apps/web/app/reception-dashboard.tsx` と `apps/api/src/reception-repository.ts` が `toISOString().slice(0, 10)` を受付日の導出に使うと、JST 00:00〜08:59 の受付が前日 UTC 日付になる。
  - 実装: UI側は `todayAsIsoDate()` を `Asia/Tokyo` 固定へ修正(49fb867)。API側は `acceptedAt` からの受付業務日付導出を `Asia/Tokyo` 固定へ統一し、MOD-011(date_time_policy)を v0.1.1 へ改版して UTC日付流用禁止を明記。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:ssot-index`, `pnpm check:boundaries`, `git diff --check`。

- [!] WP-4054 reception idempotency payload fingerprint hardening(codex 提案 SELF-SCAN-20260709-33、WP-5003後続)
  - 発見根拠: WP-5003 後の `PostgresReceptionRepository.create()` / `InMemoryReceptionRepository.create()` は `(tenantId, pharmacyId, idempotencyKey)` 再送時に `patientId` だけを比較しており、同じ idempotencyKey で患者は同じだが受付時刻・業務日付・将来追加される受付属性が異なる再送を `existing` として扱いうる。現行 `reception_entries` には request fingerprint / payload hash がなく、WP-4051 の「同一key異payloadの409」検証範囲が DB 実装後も未充足。
  - 目的: 受付作成の冪等性を「同一key + 同一要求内容のみ 200(existing)」へ厳格化し、同一key異payloadは 409 `RCV-0003` に fail-closed する。将来の電子処方箋受付・取消・監査配線前に、二重受付防止の境界を患者IDだけへ依存させない。
  - 想定スコープ: `ReceptionCreateInput` の fingerprint 対象定義、`reception_entries` への immutable request fingerprint/hash 追加 migration、in-memory / PostgreSQL repository の同一key異payload判定、API / DB 統合テスト。hash に PHI を直接含めず、監査・ハッシュチェーン(WP-5004)と混同しない。
  - historical invalid-plan verification proposal(再利用禁止): 同一key同一payload 200(existing)、同一key同一patient別acceptedAt/別業務日付 409、同一key別patient 409等を想定し、当時はfable5 PLAN_APPROVED後のDB migration着手としていた。この検証案と旧approval routingはAPI-006と矛盾するためcurrent acceptance/gateではない。
  - 裁定根拠: `acceptedAt` / 業務日付は server 採番であり fingerprint に含めると正当な再送を409にして key 再発行による二重受付を誘発する。API-006 の payload は `patientId` のみで、その範囲の WP-4051 要件は in-memory / PostgreSQL の両実装で充足済み。
  - historical provenance(2026-07-10 fable5裁定): API-006 v0.2.0矛盾により本記載のまま無効(`PLAN_INVALID_AS_WRITTEN`)とされた。current statusも無効のまま維持し、清算はWP-4076とする。将来client送信field追加後にfingerprintを再検討する場合は新規WPとして、AGT-018のmapper → pre-plan reviewer → sole maintainer → independent verifierに加え、`api_contract_reviewer`、`security_critic`、`privacy_compliance_reviewer`、`medical_safety_reviewer`、`data_integrity_auditor`で再計画する。PHI/患者安全判断、API scope変更、migration適用・production riskはpharmacist/privacy/security/data-governanceのhuman authorityが別途承認する。

- [x] WP-4055 migration filename strictness and skipped-file fail-closed(codex 提案 SELF-SCAN-20260709-34、WP-5002後続。fable5 PLAN_APPROVED、本WPで実装)
  - 発見根拠: `apps/api/src/db/migrations.ts` の `loadMigrationFiles()` は `migrations/` 内のファイルを `parseMigrationFilename(...) !== undefined` で先に filter しており、命名規則に合わない `.sql` / backup / uppercase / typo file を silently skip する。DB-002 の forward-only / immutable migration discipline では、実行対象ディレクトリに置かれた migration-like file の無視は運用事故の入口になりうる。
  - 目的: `migrations/` 配下の不正命名ファイルを fail-closed に検出し、typoed migration が未適用のまま起動・CI を通る状態を防ぐ。README 等の非SQL補助ファイルを許すかは明示 allow-list にする。
  - 実装: `loadMigrationFiles()` で migration directory entry を先に分類し、正規 `NNNNNN_snake_case.sql` は従来どおり読み込み、`README.md` / `.gitkeep` / `.DS_Store` は明示 allowlist で無視、それ以外の不正/typo/大文字/backup系 entry はファイル名付きで throw するように変更。SQL内容・checksum算出・version sort・duplicate version semantics は不変更。
  - 検証: `pnpm --filter @yrese/api exec vitest run src/db/migrations.test.ts` PASS(7)、`pnpm --filter @yrese/api test` PASS(60 + 3 SKIP)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4056 API repository mode explicitness and in-memory startup guard(codex 提案 SELF-SCAN-20260710-01、WP-5003後続。e74b251、fable5 APPROVED)
  - 発見根拠: `apps/api/src/main.ts` の `buildServerForEnvironment()` は `DATABASE_URL` が未設定の場合に常に `buildServer()` を返し、`apps/api/src/server.ts` は既定で `InMemoryPatientRepository` / `InMemoryReceptionRepository` を使う。WP-5003 でDB実装は追加済みだが、起動時の「DBなしでin-memoryへ落ちる」挙動は明示モードではなく、staging/dev-like環境の設定漏れを合成データAPIとして起動させうる。
  - 実装: `YRESE_API_REPOSITORY_MODE` を `postgres` / `in_memory` allow-list にし、`DATABASE_URL` 不在 + mode 未指定、`production + in_memory`、`DATABASE_URL + in_memory`、`postgres + DATABASE_URL 不在`、未知 mode をすべて fail-closed。`DATABASE_URL` 設定時は PostgreSQL repository + migration startup check、明示 `in_memory` のみ既存 `buildServer()` 注入シームを維持。`apps/api` dev script は `YRESE_API_REPOSITORY_MODE=in_memory` を明示。
  - 検証: `pnpm --filter @yrese/api test` 53 PASS + 3 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm -r typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm test` PASS、`git diff --check` PASS、`pnpm --filter @yrese/api dev` 起動開始を確認後停止。

- [ ] WP-4057 patient search DB pagination and search index SLO hardening(codex 提案 SELF-SCAN-20260710-02、WP-5003後続)
  - 発見根拠: `PostgresPatientRepository.search()` は `name ILIKE '%query%' OR kana ILIKE '%query%' OR patient_number ILIKE '%query%'` と `LIMIT/OFFSET` で検索している。一方、現行 migration の index は `(tenant_id, pharmacy_id, patient_number)` のみで、先頭ワイルドカードの氏名・カナ検索や大きな offset page を支えにくい。API-001 の cursor は tenant/pharmacy/query 境界拘束済みだが、内部表現は offset であり、大規模薬局・チェーン薬局の患者検索 p95 を悪化させうる。
  - 目的: 患者検索をSLOに耐えるDB検索へ進める。API wire は不透明 cursor のまま維持しつつ、内部 cursor を keyset 方式または明示承認された検索インデックス方式へ移行し、tenant/pharmacy境界・安定順序・no-store・PHIログ禁止の既存規律を保つ。
  - 想定スコープ: API-001 cursor semantics の互換方針、`PatientSearchCursor` 内部表現、`PostgresPatientRepository.search()`、必要なら検索用 migration(index / generated search column / pg_trgm 採否はDB SSOT裁定後)、in-memory repository parity tests。既存 response schema と OpenAPI wire 形状を変える場合はAPI-001改版が先。
  - 検証と現行gate: 大きなoffsetに依存しないpagination repository test、tenant/pharmacy/query境界cursor reject回帰、同一patient_number/同順位時の安定順序、DB integration test(`TEST_DATABASE_URL` gate)、API/contracts/OpenAPI/boundaries/diff checksを行う。Codex rootがmapperでAPI-001・DB SSOT・SLO・current cursor securityを確認し、pre-plan reviewerがkeyset/index選択・migration・rollback・wire compatibilityを承認してからsole maintainerへ割り当てる。実装後はindependent verifier、`db_steward`、`data_integrity_auditor`、`api_contract_reviewer`、`security_critic`、`privacy_compliance_reviewer`、performance specialistがreviewする。migration適用、production PHI/index、security/privacy/risk acceptanceはdata-governance/security/privacyのhuman authorityが別途承認する。

- [x] WP-4058 migration directory resolution for pnpm-filtered DB commands(codex 提案 SELF-SCAN-20260710-03、WP-5002後続。fable5 PLAN_APPROVED、本WPで実装)
  - 発見根拠: `pnpm --filter @yrese/api exec pwd` は `/Users/yusuke/workspace/yrese/apps/api` を返すが、`defaultMigrationsDirectory()` は `resolve(process.cwd(), 'migrations')` を返す。read-only probe で `pnpm --filter @yrese/api exec tsx -e ...loadMigrationFiles()` を実行すると `/Users/yusuke/workspace/yrese/apps/api/migrations` を見に行き `ENOENT` になった。root package の `db:check` / `db:migrate` は `pnpm --filter @yrese/api ...` 経由のため、`DATABASE_URL` 設定時に root `migrations/` を読めない可能性が高い。
  - 目的: DBマイグレーションの既定ディレクトリをコマンド実行cwdに依存させず、repo root の `migrations/` を安定して参照する。DB-002 の明示運用操作が、pnpm workspace 実行方式で失敗する状態を防ぐ。
  - 実装: `defaultMigrationsDirectory()` を `process.cwd()` ではなく `import.meta.url` 由来の `apps/api/src/db` / `dist/db` 位置から repo root へ解決する方式へ変更。明示 `migrationsDirectory` 引数は従来どおり尊重する。unit test で `process.chdir()` 後も root `migrations/` を読むことを固定。
  - 検証: `pnpm --filter @yrese/api exec vitest run src/db/migrations.test.ts` PASS(7)、`pnpm --filter @yrese/api test` PASS(60 + 3 SKIP)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4059 PostgreSQL reception integration test load-bearing narrowing(codex 提案 SELF-SCAN-20260710-04、WP-5003後続)
  - 発見根拠: `apps/api/src/db/postgres-repositories.integration.test.ts` の受付冪等性テストは `expect(created.kind).toBe('created')` / `expect(resent.kind).toBe('existing')` の直後に `if (created.kind !== 'idempotency_conflict' && resent.kind !== 'idempotency_conflict')` で entry 比較を行っている。実行時 expect が失敗すればテスト全体は落ちるが、型絞りのための条件が本来あり得ない分岐を残しており、今後の編集で idempotency conflict を誤って許すテストに弱化しやすい。
  - 目的: PostgreSQL repository 統合テストの冪等再送ケースを load-bearing にし、`created` / `existing` 以外の結果では即時 fail する型ガードまたは helper を使う。DB-2 の冪等性保証をテスト上も明確化する。
  - 実装: `apps/api/src/db/postgres-repositories.integration.test.ts` に `expectReceptionEntryResult()` helper を追加し、`created` / `existing` 以外は即時 throw する形へ変更。entry 比較から `idempotency_conflict` を許す型上の逃げ道を削除。実装コード・migration・契約は変更なし。
  - 検証: `pnpm --filter @yrese/api typecheck` PASS、`pnpm --filter @yrese/api test` 53 PASS + 3 SKIP、`git diff --check` PASS。`TEST_DATABASE_URL` 不在のため PostgreSQL 統合テスト本体は skip、型検査で helper の union narrowing を確認。

- [x] WP-4060 ReceptionDashboard acceptedAt clock display JST pin(codex 提案 SELF-SCAN-20260710-05、本WPで実装)
  - 発見根拠: `apps/web/app/reception-dashboard.tsx` の `formatAcceptedTime()` は API の `acceptedAt` UTC instant を `new Date(...).toLocaleTimeString("ja-JP", ...)` で表示しており、実行ホスト/ブラウザ timezone に依存していた。受付業務日付は WP-4053 で JST 固定済みのため、受付時刻も薬局ロケール(MVPでは `Asia/Tokyo`)に固定しないと UTC/非JST環境で表示時刻がずれる。
  - 目的: 受付ダッシュボードの時刻表示を `Asia/Tokyo` 明示にし、ローカル実行環境の timezone による患者受付順・時刻誤認を避ける。
  - 実装: `formatAcceptedTime()` を `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour, minute })` へ変更し、UTC 20:15 が JST 05:15 として表示される回帰テストを追加。
  - 検証: `pnpm --filter @yrese/web test` PASS(34)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4061 ReceptionDashboard queue stale response guard(codex 提案 SELF-SCAN-20260710-06、本WPで実装)
  - 発見根拠: `apps/web/app/reception-dashboard.tsx` の受付一覧 `load()` は generation / latest-date guard を持たず、連続して日付表示を実行した場合に古い応答・古い失敗が後続の日付表示を上書きしうる。受付一覧は患者受付業務の入口であり、表示日付と実データの不一致は取り違え・見落としにつながる。
  - 目的: 最新の受付一覧ロードだけが `QueueState` を更新できるようにし、古い成功・失敗を破棄する。PatientSearch の stale response guard と同じ安全規律を受付ダッシュボードにも適用する。
  - 実装: `createReceptionQueueRunner()` を追加し、runner 内の generation guard で stale success / stale failure を破棄。`ReceptionDashboard` は `useRef` で runner を保持して既存 UI/API 契約を維持する。web test で「最後の日付が勝つ」「古い失敗が新しい結果を error に戻さない」を固定。
  - 検証: `pnpm --filter @yrese/web test` PASS(36)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4062 frontend error code registry filtering(codex 提案 SELF-SCAN-20260710-07、本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` と `apps/web/app/reception-dashboard.tsx` は API body の `errorCode` を `isValidErrorCode()` の形式チェックだけで `ErrorNotice` へ渡していた。一方、`packages/contracts/src/error.ts` は同じ `errorCode` を shared-kernel の registry 登録済みコードに限定しており、`SYSTEM-9999` のような形式だけ正しい未登録コードをフロントが表示しうる drift があった。
  - 目的: フロントエンドのエラーコード表示も `error_code_registry` 正本に揃え、未登録コード・異常値の verbatim 表示を防ぐ。登録済みコード(`AUTH-0003` / `RCV-0003` 等)の表示は維持する。
  - 実装: `apps/web/app/components/error-code.ts` に `registeredErrorCodeOrUndefined()` を追加し、shared-kernel registry に存在するコードのみを返すようにした。患者検索と受付ダッシュボードの API error parsing をこの helper に統一し、未登録の形式正しいコードを落とすテストを追加。
  - 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4063 web display label exhaustiveness tightening(codex 提案 SELF-SCAN-20260710-08、本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` / `components/patient-header.tsx` の性別ラベルと `apps/web/app/reception-dashboard.tsx` の処方箋受付区分ラベルは、現行値を満たしているが `as const` 推論に依存しており、契約側の union が増えた際に「表示ラベル未追加」を明示的な Record 網羅性として固定していなかった。
  - 目的: 表示文言や API 契約を変えず、患者検索・患者ヘッダー・受付一覧のラベル定義を契約/props の値集合へ型で結び、将来の値追加時に typecheck で未対応を検出する。
  - 実装: 性別ラベルを `Record<PatientSearchResult["sex"], string>` / `Record<PatientHeaderProps["sex"], string>`、処方箋受付区分ラベルを `Record<ReceptionQueueEntry["prescriptionIntakeType"], string>` に変更。ランタイム表示は不変更。
  - 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4064 PatientSearch runner lazy initialization(codex 提案 SELF-SCAN-20260710-09、本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の `useRef(createSearchRunner(fetchSearch, setState))` は React の render ごとに初期値式を評価するため、最初の runner 以外に未使用の runner closure を毎回生成しうる。動作上は破棄されるが、患者検索の stale guard は runner 内 generation に依存するため、runner lifecycle は明示的に固定した方が読みやすい。
  - 目的: PatientSearch の検索 runner を初回 render でだけ作成し、stale response guard の所有者を明確にする。検索挙動・DOM・API呼び出し・契約shapeは変更しない。
  - 実装: `runnerRef` を `null` 初期化し、初回 render 時だけ `createSearchRunner(fetchSearch, setState)` を代入する lazy ref へ変更。通常到達しない未初期化状態は黙殺せず明示例外にした。
  - 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4065 dev tenant header least-privilege split(codex 提案 SELF-SCAN-20260710-10、fable5 PLAN_APPROVED 後に本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の `devTenantHeaders()` は development 限定ではあるが、全 dev UI request へ `patient:read,reception:read,reception:write` を送る。患者検索は `patient:read` のみ、受付一覧は `reception:read + patient:read`、受付登録は `reception:write + patient:read` が必要最小であり、dev stub でも過剰scopeを常態化させると認可境界の確認が鈍る。
  - 目的: development stub の利便性を維持しつつ、画面/操作ごとの必要最小 `x-dev-scopes` だけを送る。production/test/undefined で `{}` を返す WP-4038 の本番境界は維持する。
  - 実装: `@yrese/shared-kernel` の `permissionScope()` / `PermissionScope` を使い、患者検索の default dev scope を `patient:read` に限定。受付一覧は `reception:read,patient:read`、受付登録は `reception:write,patient:read` を明示指定する。API認可plugin・server semantics・DB・SSOT本文・contract shape は変更なし。
  - 検証: PatientSearch dev header は `patient:read` のみ、Reception queue fetch は `reception:read,patient:read`、Reception create は `reception:write,patient:read` を送ること、production/test/undefined は引き続き `{}` を web tests で固定。`pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4066 dev tenant context explicit opt-in(137315d、codex 提案 SELF-SCAN-20260710-11、HIGH、fable5/Opus 4.8 REVIEW_RESULT: APPROVED)
  - 発見根拠: `apps/api/src/plugins/tenant-context.ts:81-90` は dev header auth stub を `NODE_ENV === "production"` の場合だけ拒否する。一方、`apps/api/src/config.ts:70-75` は `NODE_ENV` と独立して `DATABASE_URL` があれば PostgreSQL を選択し、`apps/api/src/main.ts:25-32` は同じ `buildServer()` に実 repository を注入するため、production 以外の環境名で caller-supplied dev headers が永続化系 API の trusted context になりうる。
  - 再現: `NODE_ENV=staging` で任意の `x-dev-tenant` / `x-dev-pharmacy` / `x-dev-actor` / `x-dev-scopes=tenant:read` を付けて `GET /whoami` を呼ぶと、trusted context として echo され 200 を返す。
  - 重複範囲: WP-4038 は Web client が development 以外で dev headers を送らない境界、WP-4056 は repository mode の明示化であり、任意 client による backend dev header 受理は閉じていない。
  - 実装: tenant context plugin は `process.env` を読まず、常に `tenantContext=undefined` を decorate し、composition root から明示された `dev_headers` mode の場合だけ header hook を登録する。config resolver は parsed `DATABASE_URL` と resolved repository mode を受け、`YRESE_ALLOW_DEV_TENANT_STUB=true` exact、`NODE_ENV=development|test` exact、`in_memory`、DB URL不在の全条件が揃った場合だけ `dev_headers` を返す。flag absent / exact false は disabled、malformed flag・unsafe combination は固定PHI-free startup errorで拒否する。
  - composition root: `buildServer()` は既定 disabled。`dev_headers` は explicit `repositoryMode=in_memory` がない限り Fastify construction 前に拒否し、`main.ts` は repository mode と tenant mode を一度ずつ解決して in-memory / PostgreSQL 両経路へ渡す。API dev script のみ必要な3環境変数を明示する。OIDC・audit event・permission semantics は変更しない。
  - テスト: 既存の header/permission security tests を explicit dev helper へ移し、default server に attacker-selected headers を送っても患者 search/findById・受付 list/create が0 callのまま3 endpointすべて403になる否定テストを追加。config allow-list matrix、focused server/config 53 tests、API全体65 tests + PostgreSQL integration 3 explicit skip、API typecheck、boundaries、secrets、diff check はPASS。
  - レビュー・landing: fable5/Opus 4.8 が commit `137315d` を `REVIEW_RESULT: APPROVED`。API全体65 tests PASS + PostgreSQL integration 3 expected SKIP、GitHub CI green を確認し、commit/push 済み。残る外部 deployment black-box verification は deployment gate であり、コード完了の blocker ではない。

- [x] WP-4067 web API transport fail-closed + same-origin dev routing(codex 提案 SELF-SCAN-20260710-12、fable5 PLAN_APPROVED)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` は `NEXT_PUBLIC_API_BASE` 未設定時に `http://localhost:3001` へ送信し、受付画面も同じ値を流用していた。開発時は 3000→3001 の custom dev header request が CORS preflight を要する一方、API に CORS 設定はなく、本番の設定欠落時は患者検索語を end-user の localhost へ送信しうる。
  - 目的: Web API endpoint 解決を一箇所へ集約し、production で `NEXT_PUBLIC_API_BASE` が欠落・空・不正なら、患者検索語/患者IDを含まない固定エラーで `fetch` 前に停止する。development 既定だけを narrow same-origin Next rewrite に通し、broad CORS や API/auth semantics の変更を避ける。
  - 実装: `apps/web/app/api-transport.ts` に lazy resolver を追加し、明示 HTTP(S) / 安全な root-relative base のみ許可、production/test/staging/undefined の欠落を fail-closed にした。患者検索・受付一覧・受付登録は resolver を共有。Next rewrite `/_yrese-api/:path* -> http://127.0.0.1:3001/:path*` は `NODE_ENV=development` の場合だけ有効で、production/test/staging では route 自体を公開しない。WP-4066 の backend opt-in と WP-4065 の dev-only least-privilege headers は不変更。
  - 検証: resolver environment matrix、production 設定欠落時の全3操作 zero fetch + PHI/query 非露出、3操作の same-origin URL、rewrite の development-only matrix を追加。`pnpm --filter @yrese/web test` PASS(63)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web build` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4080 production plaintext Web API base fail-closed hardening(HIGH security/privacy、WP-4067 follow-up)
  - 発見根拠: WP-4067は明示HTTP(S) baseを全environmentで許可していたため、productionの`NEXT_PUBLIC_API_BASE=http://...`設定ミスで患者検索語・受付患者ID・PHI応答を平文送受信できた。APPROVED SEC-003は薬局LAN内もTLS必須であり、従来acceptanceより上位制約を優先する。
  - 実装: root-relativeとabsolute HTTPSは維持し、absolute HTTPは`NODE_ENV=development`かつcanonical loopback host (`localhost` / `127.0.0.1` / `[::1]`)だけを許可。production/staging/test/preview/undefined/unknown、dev外部/LAN/lookalike hostを固定値非echo errorでfetch前拒否する。raw `?` / `#`とuserinfo `@`もparser前後で拒否し、empty delimiter正規化によるpath→query/fragment化を防止した。CORS/API/auth/Next rewriteは変更なし。
  - 検証: resolver 36、patient search 12、reception 11のfocused 59/59、web 99、web typecheck/build、workspace typecheck/test、boundaries/secrets/diff check PASS。search/queue/createはplaintext production baseでfetch zero、base/query/patientId非echo。independent verifier、security/privacy/medical-safety specialistはAPPROVED。
  - human gate / rollback: active Goal §10のR3事前権限下でcontrol tighteningとして実施。deploy/production origin HTTPS/HSTS検証は別Go/No-Goで、本WPは外部操作なし。rollbackはtransport resolverと3 testファイルのrevert。

- [x] WP-4081 patient-search cursor privacy assertion determinism(LANDED、R1 test reliability、WP-4074 follow-up)
  - 発見根拠: `apps/api/src/patient-search-cursor.test.ts` がrandom HMAC値を含むserialized body全体へ `not.toContain('qh')` を適用し、legacy `qh` property不在ではなくMAC内の偶然の2文字一致を失敗扱いしていた。W25 full testで実際にfalse red後rerun PASS。43文字base64url MACでの概算発生率は約0.996%/run。
  - scope: exact4 `apps/api/src/patient-search-cursor.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。production codec、server/config、contracts/OpenAPI、API-001/SSOT/index、DB/migration、package/lockは変更禁止。
  - implementation: privacy-shape testだけをsynthetic fixed keyへ変更し、合法MACに`qh`が含まれるdeterministic vectorを固定する。exact keys `[v,o,m]`を維持し、legacy `t/p/q/qh/offset`はpropertyとして不在を検証する。random serialized substringと長さ上あり得ない64-char hash substring assertionは削除するが、MAC shape/token cap/golden/binding/tamper/canonicalization/legacy rejection coverageは維持する。
  - acceptance: focused cursor 8 testsを反復してPASS、API test/typecheck/buildとworkspace full gates PASS、production `patient-search-cursor.ts` byte-identical。independent/test/security/privacy/medical reviewでprivacy coverage非弱化を確認後、rootだけがexact4をcommit/pushする。
  - review_results: independent_verifier/test_architect、security_critic、privacy_compliance_reviewer、medical_safety_reviewer、spec reviewerがAPPROVED。production codec SHA-256 `bd8b37227acfda2aeaa9eb10fb17bcc0b5e7e337fef716a8282601e992051808`はbaseline/current byte-identical、privacy/security coverage非弱化。
  - validation_results: focused cursor 8/8 PASS、deterministic repeat20で20 runs/160 tests PASS、API172 + PostgreSQL13 expected skips、API typecheck/build、workspace typecheck/test/build（web188等）、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `82f8b85` `WP-4081: make cursor privacy assertion deterministic` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact4; deterministic false-positive regression locked, production codec byte-identical, review/full gates PASS, no runtime/security/privacy/medical semantic change

- [x] WP-4082 patient-context manual-clear stale refresh invalidation(R2 patient-safety UI race)
  - 発見根拠: `PatientContextBarWithRefresh` は患者IDがある再取得開始時だけgenerationを進め、手動の「選択解除」でpatientがnullになったeffectは無効化せずreturnしていた。解除前の旧200/404/errorが遅延完了すると、旧患者の再選択または解除後表示の上書きが起こり得る。
  - scope: exact5以内 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/SSOT/DB/migration/package/lock/copy/CSSは変更しない。
  - implementation: latest-only refresh runnerを導入し、患者切替・effect cleanup・null遷移に加えて手動解除handlerで同期的に旧generationを無効化する。新しいrefresh開始時はremoved表示だけをclearし、staleはcurrent-generationの200/404まで保持して既存の200/404/error semanticsを維持する。
  - acceptance: 解除後のlate 200/404/errorがcallbackを一切実行しないこと、A→BでBだけがauthoritativeであることをdeferred Promise testsで固定する。focused web tests/typecheck/build、workspace regression、既存gate、independent/frontend/accessibility/medical/privacy reviewがPASSするまで未完了。
  - review_results: 初回reviewのpremature stale clearと配線coverage指摘を修正後、independent verifier、frontend/accessibility、medical-safety/privacyがAPPROVED。DOM click test未追加は、productionとtestが同一coordinatorを共有し順序とlate responseを固定したためnon-blocking。
  - validation_results: focused 14/14、web 193/193、API 172 + PostgreSQL 13 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `ed67009` `WP-4082: invalidate stale patient refreshes on clear` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、患者解除後の旧応答復活を防止し、API/contracts/SSOT/DB/production semanticsは不変。

- [x] WP-4083 patient-search blank-submit stale request invalidation(R2 patient-selection UI race)
  - 発見根拠: `createSearchRunner()`はblank警告をemitしてreturnした後の非blank経路でのみgenerationを進めていたため、先行検索のlate 200/errorがblank警告を古い患者結果/errorで上書きできた。
  - scope: exact5 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/SSOT/DB/migration/package/lock/copy/CSSは変更しない。
  - implementation: runnerの各invocation開始時にgenerationを進め、blank送信自体を最新authoritative actionにする。blankは従来どおりfetch zeroで固定WARNINGを表示し、nonblank/append/error semanticsは不変。
  - acceptance: A→blank後のlate success/failureを破棄、blank fetch zero、既存last-wins/append tests維持。focused web、workspace full gates、independent/frontend/accessibility/medical/privacy review PASSまで未完了。
  - review_results: independent verifier、frontend/accessibility、medical-safety/privacyがAPPROVED。blankが先行initial/appendの全completionをgeneration guardで無効化し、copy/ARIA/API/PHI境界は不変。
  - validation_results: focused20、web196、API172 + PostgreSQL13 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `edd594e` `WP-4083: invalidate stale searches on blank submit` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、blank後の旧患者結果復活を防止し、copy/API/contracts/SSOT/DB/productionは不変。

- [x] WP-4084 reception registration same-flight mutual exclusion(R1 duplicate-operation hardening)
  - 発見根拠: `ReceptionDashboard.register()`は`setSubmitting(true)`とrender後のdisabledだけに依存し、同一render内の同期再入をhandler自身では拒否しない。各`createReception()`は別UUIDを生成するため、2 POSTがAPI-006のsame-key冪等境界を迂回し得る。通常double-clickはdisabledで軽減されるためR1とする。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/SSOT/DB/migration/package/lock/copy/CSSは変更しない。
  - implementation: ref保持の同期single-flight coordinatorをcorrectness境界とし、accepted operationだけがstate更新・UUID生成・POST・queue reloadを行う。lockはreloadを含むflightの`finally`まで保持し、success/failure後の明示的な次操作は許可する。blank idleは従来warning/fetch-zero。
  - acceptance: 同期2呼出し=operation 1回、pending中の重複はstate/key無変更、success/failure後に再実行可、既存409/404/error copy・least-privilege headers・queue reload・button disabled semantics不変。曖昧network retryのkey再利用は別API/UI semantic gateとして除外する。
  - review_results: independent verifier、frontend/accessibility、medical-safety/privacy/API-contract/data-integrityがAPPROVED。R1評価を維持し、通常physical double-clickの実害や曖昧network retry解決は主張しない。
  - validation_results: focused reception19、web200、API172 + PostgreSQL13 expected skips、server43、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `0d3eafa` `WP-4084: prevent same-flight reception duplicates` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、同一flightのstate/UUID/POST/reloadを単一化し、API-006/retry-key semantics/DB/SSOTは不変。

- [x] WP-4085 protected sensitive routes early no-store enforcement(R1 privacy/cache hardening)
  - 発見根拠: 患者検索/取得、受付一覧/登録、監査イベントはhandler内で`Cache-Control: no-store`を設定するため、tenant/auth `preHandler`が先に403を返す経路ではheaderが欠落する。特に患者検索URLは氏名・カナ・患者番号を含み得る。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。対象routeは`GET /patients/search`, `GET /patients/:patientId`, `GET /reception/queue`, `POST /reception`, `GET /audit/events`のみ。health/whoami、contracts/OpenAPI/SSOT/DB/package/lock/logging/CORSは変更しない。
  - implementation: 単一route-local `onRequest` hookで認可前にexact `no-store`を設定し、handler内の5重複setterを除去する。global hook/path推論は使わず、status/body/auth/repository semanticsを維持する。
  - acceptance: 5 routeのmissing/malformed context・insufficient scope 403と代表400/404/409/500/成功がno-store、auth denialはrepository zero-call。既存error bodyは不変でquery/patient identifiers/PHIを非echoとし、固定internal error copyのhardeningは対象外。health/whoamiには強制付与しない。403本文PHI leakやbrowser history/log解決は主張しない。
  - review_results: 初回reviewの404/409 assertion不足と500 non-echo記録過剰を修正後、independent verifier、API-contract/test、security/privacy/medicalがAPPROVED。live audit path `/audit/events`を含むexact5 routeだけを確認。
  - validation_results: focused server58、API187 + PostgreSQL13 expected skips、web200、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `591e27a` `WP-4085: enforce no-store before sensitive route auth` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、5 sensitive routeの認可前non-cacheabilityを固定し、body/status/auth/contracts/DBは不変。

- [x] WP-4086 audit log latest-only and lifecycle invalidation(R2 integrity-status UI race)
  - 発見根拠: `AuditLogPanel.load()`は世代管理/cleanupなしで各Promise completionを無条件commitするため、古い正常応答が新しいhash-chain破断CRITICALを「正常」で上書きできる。backend chain検証ではなくclient result arbitrationの欠陥。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/SSOT/audit event/backend/repository/DB/package/lock/copy/CSSは変更しない。
  - implementation: ref保持latest-only runnerが各runのgenerationを同期更新し、current success/failureだけをcommit。effect cleanup/unmountはinvalidateする。Abort/single-flight/dedupは使わず、各GETとbackend `audit.viewed`記録は従来どおり維持する。
  - acceptance: old healthy→new broken、old failure→new success、old success→new errorでnew stateを維持、invalidate後callback zero、run回数分fetchを維持。current chain breakはCRITICAL、403/error mapping、endpoint、audit-log:read、no-store、不登録error code非echoを保持する。
  - review_results: independent verifier、frontend/accessibility、security/privacy/audit-data-integrity/medicalがAPPROVED。DOM click/unmount testなしはtested runnerへの直接配線とcleanupの単純性からnon-blocking。
  - validation_results: focused audit view11、web206、focused API audit/server65、API187 + PostgreSQL13 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。初回Web buildとworkspace typecheckの並列実行は`.next/types`生成競合でTS6053となり、順次再実行でPASS。
  - landing_record: commit `e7c86b3` `WP-4086: keep latest audit verification authoritative` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、最新chain verificationだけを表示authorityとし、各GET/audit.viewed/API/backendは不変。

- [x] WP-4087 preserve next-patient reception input on prior success(R1 workflow input loss)
  - 発見根拠: 受付AのPOST/reload中もpatient ID inputは編集可能だが、A成功時に無条件`setRegisterPatientId("")`するため、operatorが準備した次患者Bを消去する。accepted requestはcaptured Aのためwrong registrationではなく通常操作の入力損失。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/SSOT/DB/package/lock/copy/CSS/focusは変更しない。
  - implementation: 送信時raw inputをsnapshotし、成功時のfunctional setterでcurrent raw値がsnapshotとexact一致する場合だけclearする。trim済み値では比較しない。inputはenabledのまま、WP-4084 same-flight lockは維持。
  - acceptance: unchanged raw/whitespace padded inputは成功時clear、pending中にBへ編集済みならB保持、failureは入力保持。registered notice/queue reload/409/404/error/UUID/API/headers/blank semantics不変。自動next registration、focus移動、retry-key lifecycleは対象外。
  - review_results: independent verifier、frontend/accessibility、medical-safety/privacy/API workflowがAPPROVED。DOM async integrationなしはproduction functional setterがtested helperへ直接委譲するためnon-blocking。
  - validation_results: focused reception23、web210、server58、API187 + PostgreSQL13 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `ac032df` `WP-4087: preserve prepared reception input` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、success clearをraw unchanged時に限定し、API-006/same-flight/focus/copyは不変。

- [x] WP-4088 wire live BusinessNav current-location semantics(R1 accessibility navigation state)
  - 発見根拠: production `RootLayout`は`<BusinessNav />`へ`current`を渡さず、任意propとの一致時だけ`aria-current="page"`を出す実装のため全routeでcurrent markerが0件。既存testは手動propだけを検証して欠落を隠していた。
  - scope: exact5 `apps/web/app/nav.tsx`, `apps/web/app/shell-smoke.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。`layout.tsx`、route構造、CSS、label/order、auth/role、focus/animation、API/contracts/SSOT/DBは変更しない。
  - implementation: `nav.tsx`を小さなclient boundaryとし、production `BusinessNav()`が`usePathname()`をpure viewへ渡す。現行top-level routeだけをexact matchし、unknown/nested pathから親routeを推測しない。test-only optional current propは廃止する。
  - acceptance: `/`、`/patients`、`/admin`は対応hrefにexactly one current、unknownと`/patients/example`はzero。9 href/label/orderとnav aria-labelは不変。focused web、workspace full gates、independent/frontend/accessibility review PASSまで未完了。
  - review_results: independent verifierがfrontend/accessibility/medical/privacy影響を含めAPPROVED。production signature/hook経路、exact-only marker、unknown/nested zero、exact5と非対象不変を確認し、findingsなし。
  - validation_results: focused shell15、web215、API187 + PostgreSQL13 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `77e91f7` `WP-4088: wire live navigation current state` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、production current markerをexact routeへ配線し、layout/CSS/labels/order/nested policyは不変。

- [x] WP-4089 fail-visible malformed stored audit payload verification(R2 integrity status)
  - 発見根拠: PostgreSQL adapterはhydrate不能な保存行をraw eventとして返してchain break表示へ委ねるが、`verifyAuditHashChain()`はhash文字列検証だけをcatchし、canonical payload検証例外を外へthrowする。valid-format hash + unsafe `schemaVersion`で`RangeError`を再現し、`/audit/events`がstructured CRITICALではなく500となる。
  - scope: exact6 `packages/audit/src/index.ts`, `packages/audit/src/audit.test.ts`, `apps/api/src/audit-log.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。DB adapter/schema/migration/DML、contracts/OpenAPI/SSOT、UI、raw payload loggingは変更しない。
  - implementation: current eventのcanonicalization/hash再計算だけをnarrow catchし、保存payloadを安全にhash検証できない場合は既存`hash_format_invalid`を返す。invalid hash、prev-link、valid payload hash mismatchのreason precedenceは維持する。
  - acceptance: malformed canonical fieldはthrowせずbreakIndex/checkedCount/eventId付きfailure。APIは200/no-store/contract-valid chain breakを返し、raw malformed値を投影せず`audit.viewed`を1回記録。focused/full gatesとindependent/audit-data/security/privacy/API/medical review PASSまで未完了。
  - review_results: independent verifierがaudit-data-integrity/security/privacy/API-contract/medical-safetyを含めAPPROVED。narrow catch、reason precedence、count/index/eventId、API non-echoと`audit.viewed`を確認しfindingsなし。
  - validation_results: focused audit47/API audit8、audit full183、API188 + PostgreSQL13 expected skips、web215、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `8b7b162` `WP-4089: keep malformed audit payloads fail-visible` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact6、review/full gates PASS、保存payload不正を既存reasonでfail-visible化し、DB/contracts/UIは不変。

- [x] WP-4090 audit advisory-lock source literal-NUL hygiene(R1 tooling visibility)
  - 発見根拠: `apps/api/src/db/audit-repository.ts`のtenant/pharmacy advisory-lock key separatorが物理`0x00`としてsourceへ混入し、`file`/`rg`/Git diffがTypeScriptをbinary扱いする。WP-1011と同じreview/search可視性の欠陥。
  - scope: exact4 `apps/api/src/db/audit-repository.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。SQL、lock algorithm/key bytes、tenant/pharmacy順、DB/schema/migration/DML、API/contracts/SSOTは変更しない。
  - implementation: 単一physical NULをECMAScript source escape `\u0000`へ置換する。runtimeは同じsingle U+0000 separatorであり、printable delimiterやvisible six-character sequenceへ変更しない。
  - acceptance: source NUL byte zero、textual escape exactly one、runtime char code/UTF-8 bytes同一、新blobはtext判定かつ通常`rg`成功。cleanup diff自体はNULを含むpreimageによりbinary表示となるため、post-commit blobと次回差分のtext可視性を証拠にする。API/workspace full gatesとindependent DB/data-integrity review PASSまで未完了。
  - review_results: independent verifierがDB/data-integrity/security/privacyを含めAPPROVED。HEADのphysical NUL 1→working 0、escape 1、変換以外byte-identical、runtime/UTF-8同値、SQL/transaction/lock semantics不変を確認しfindingsなし。
  - validation_results: source byte/escape/runtime equivalence、通常`rg`/new blob text判定、API188 + PostgreSQL13 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `9238a54` `WP-4090: restore audit repository text visibility` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact4、review/full gates PASS、committed blob NUL0/text判定/通常rgを確認し、runtime lock key bytesは不変。

- [x] WP-4091 deterministic in-memory patient search field ordering(R1 adapter alignment)
  - 発見根拠: PostgreSQL patient searchはfilter後に`patient_number, patient_id`順でOFFSET/LIMITするが、InMemoryはfixture投入順のままsliceする。同一synthetic datasetの投入順だけでpage membershipが変わることを再現。
  - scope: exact5 `apps/api/src/patient-repository.ts`, `apps/api/src/patient-repository.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。SQL/collation/DB/migration、cursor codec、API/contracts/OpenAPI/SSOT、query normalizationは変更しない。
  - implementation: scope/query filter後のowned arrayを明示的なJS文字列比較で`patientNumber`、defensiveに`patientId`の順へsortしてからpaginationする。constructor inputは非破壊。現行synthetic ASCII fixtureのfield-order alignmentに限定し、public orderingやarbitrary Unicode/PostgreSQL collation parityは主張しない。
  - acceptance: 異なる投入順で同一page、scope外recordがboundaryへ影響せず、2page間の重複/欠落なし、input非破壊。duplicate patientNumber tieはDOM-002違反のdefensive testに限定。API/workspace full gatesとindependent API/data/privacy/medical review PASSまで未完了。
  - review_results: independent verifierがAPI/data-integrity/test/DB/privacy/medicalを含めAPPROVED。filter→sort→slice、input非破壊、scope boundary、page completeness、defensive tie、限定claimを確認しfindingsなし。
  - validation_results: focused repository3/server58、API191 + PostgreSQL13 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。初回testはPASSしたがexact optional cursor型errorを検出し、明示guard後typecheck再実行PASS。
  - landing_record: commit `c7a4b56` `WP-4091: stabilize in-memory patient pagination` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、synthetic ASCII field-order/paginationを決定化し、public ordering/SQL/DB/APIは不変。

- [x] WP-4092 PostgreSQL audit append observed-concurrency proof(R2 integrity evidence) — FINALIZED / REMOTE_CI_PASS
  - 発見根拠: productionはtenant/pharmacy単位のtransaction advisory lockでchain追記を直列化するが、既存integration helperはpool `max:1`で、並行呼出しもclient checkout前に直列化されlock保証を検証できない。production defectは未確認。
  - scope: test-only exact4 `apps/api/src/db/audit-repository.integration.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。production repository/SQL/lock/migration/pool default、API/contracts/SSOTは変更しない。
  - implementation: test transactionが同scope lockを保持し、別2接続のrecordが同じadvisory lockを実際に待機中であることを`pg_locks`でbounded観測してから解放する。winner順序を仮定せず、両append、sequence 1/2、genesis/link、unique event/hash、full chainを検証する。
  - acceptance: disposable PostgreSQLでwaiter2を観測し、deadlock/lost write/duplicateなし、resource cleanup完了、既存4 integration維持。local skipは完了証拠にせず、GitHub Actions PostgreSQL serviceのzero-skip PASSまでVERIFY_REQUIRED。
  - review_results: independent DB/data/security/privacy/medical/test reviewはcode APPROVED、runtime VERIFY_REQUIRED。max3/blocker/waiter2/pg_locks bounded observation、release/drain、order-independent assertions、exact4を確認しactionable findingなし。
  - validation_results: local focused audit integration5は`TEST_DATABASE_URL`不在でexpected skip、API191 + PostgreSQL14 skips、web215、audit183、workspace typecheck/test/buildと全標準gate PASS。WP-4164 follow-upで`application_name`間接観測をblocker自身の`pg_locks` exact identity(`database/classid/objid/objsubid=1`)へ置換し、draft PR #1 run `29499861743`でaudit integration 5/5（observed waiter2を含む）、migration integration 2/2、PostgreSQL repository integration 7/7、API 286/286をzero-skip PASSした。
  - landing_record: original candidate `193024b`、WP-4164 implementation `01e8260`、deterministic waiter proof `1d2a2da`をsafe feature branchへpush済み。CI run `29499861743` job `87625797181`は2m16sで全step green。production repository/SQL/transaction/schema/APIはWP-4164 canonical lock-key修正以外不変で、WP-4050 atomicityは別human gateのまま。

- [x] WP-4093 fail-visible display projection for malformed stored audit rows(R2 integrity visibility)
  - 発見根拠: WP-4089でmalformed canonical payloadはstructured `hash_format_invalid`となったが、routeがraw `targetRef.kind/id`等を無条件dereferenceし、invalid wallClock等もresponse parseでthrowするため、破損状態が再びHTTP 500となりCRITICAL表示を失う。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/UI/audit core/repository/DB/migrationは変更しない。
  - implementation: 全eventを先にchain検証・countし、`audit.viewed`記録後、latest raw windowを確定してから既存`auditLogEntrySchema`でdisplay-safe projectionする。invalid rowは表示だけ省略しbackfill/placeholderを作らない。verificationがokなのにprojection不能なら固定non-echo invariant errorで停止する。
  - acceptance: malformed target/wallClockでも200/no-store + false chain、totalCount保持、raw値非echo、valid neighbor保持、limit後filterでno backfill、view audit1回。healthy/contract/UI copy不変。focused/full gatesとindependent audit/security/privacy/API/medical review PASSまで未完了。
  - review_results: independent audit/data/security/privacy/API/frontend/medical review APPROVED、findingsなし。full verify/count→view audit→raw window→safe projection、false時のみomit、healthy invariant、no backfill/non-echoを確認。
  - validation_results: focused API audit10、API193 + PostgreSQL14 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `888c449` `WP-4093: keep malformed audit rows fail-visible` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、保存破損をcount/verifyしたままdisplay-safeにCRITICAL表示へ戻し、contracts/UI/DBは不変。

- [x] WP-4094 align verified audit display ordering with wallClock-desc contract(R1 contract correctness)
  - 発見根拠: contracts/OpenAPIは`entries`を`wallClock desc`と公開するが、routeはappend順をreverseしてlimitする。03:00→01:00→02:00のappendでlimit2が02:00/01:00となり、03:00を誤って除外する再現を得た。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/UI/audit core/repository/DBは変更しない。
  - implementation: full chainは元append順で検証後、healthy chainだけwallClock降順、同時刻はlater append優先でdisplay windowを選びlimitする。broken chainはuntrusted wallClockをsort keyにせずWP-4093 raw-window/no-backfill quarantineを維持する。
  - acceptance: nonmonotonic時刻のmembership/order、equal-time tie、full checkedCount、view audit snapshot除外を固定。broken-chain/malformed/no-backfill/non-echo semantics不変。focused/full gatesとindependent API/audit/security/privacy review PASSまで未完了。
  - review_results: independent API/audit/data/security/privacy/frontend/medical review APPROVED、findingsなし。append-order full verification、healthy wallClock sort-before-limit、tie、broken quarantine、view snapshotを確認。
  - validation_results: focused API audit12、API195 + PostgreSQL14 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。初回新規test helper未定義2件を検出・修正後再実行PASS。
  - landing_record: commit `b5fa648` `WP-4094: align audit display chronology` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、healthy displayをwallClock descへ整合し、chain/broken quarantine/contracts/DBは不変。

- [x] WP-4095 quarantine audit DB client after rollback failure(R1 connection integrity)
  - 発見根拠: audit append失敗時のROLLBACK rejectionを捨て、transaction state不明clientを通常`release()`でpoolへ戻す。pg 8.22/@types 8.20のpublic `release(true)`はclientをdestroyできる。
  - scope: exact5 `apps/api/src/db/audit-repository.ts`, `apps/api/src/db/audit-repository.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。reception repository、SQL/transaction順、lock/hash/sequence、pool config、DB/migration/API/contractsは変更しない。
  - implementation: rollback失敗時だけdestroy flagを立てfinallyで`release(true)`。commit成功/rollback成功はzero-arg releaseを維持し、rollback errorでoriginal operation errorを置換・logしない。
  - acceptance: success、operation failure+rollback success、operation failure+rollback failureの3経路でquery/release exactness、original error identity、release onceをDB非依存fake clientで固定。full gatesとindependent DB/data/security/privacy/audit review PASSまで未完了。
  - review_results: independent DB/data/audit/security/privacy/medical review APPROVED、findingsなし。public pg release contract、original error、destroy-only-on-rollback-failure、once-only release、SQL/semantic non-changeを確認。
  - validation_results: focused lifecycle3、API198 + PostgreSQL14 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `cd500ed` `WP-4095: quarantine failed audit transactions` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、rollback失敗clientだけをdestroyし、SQL/lock/hash/DB/APIは不変。

- [x] WP-4096 quarantine reception DB client after rollback failure(R2 reception integrity)
  - 発見根拠: reception createもrollback rejectionを捨て、transaction state不明clientを通常releaseでpoolへ戻す。created/existing/idempotency_conflictの正常3分岐は正しいが、例外cleanupだけがWP-4095と同じ欠陥。
  - scope: exact5 `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API-006、SQL/idempotency/patient identity、migration/DB/pool/API/contracts/UIは変更しない。
  - implementation: rollback失敗時のみ`release(true)`、commit/rollback成功時はzero-arg release、original operation errorを維持。retry/repair/shared transaction abstractionは導入しない。
  - acceptance: created/existing/different-patient conflictのCOMMIT/result/reuseと、operation failure時のrollback成功/失敗をDB非依存5 testsで固定。wrong-patient entry非返却、stored replay値維持、release once。full gatesとindependent DB/data/API/privacy/medical review PASSまで未完了。
  - review_results: independent DB/data/API/security/privacy/medical review APPROVED、findingsなし。5 branch choreography、stored replay、wrong-patient no-entry、original error、release once、semantic non-changeを確認。
  - validation_results: focused reception lifecycle5、API203 + PostgreSQL14 expected skips、web215、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `80b6bd7` `WP-4096: quarantine failed reception transactions` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、review/full gates PASS、rollback失敗clientだけをdestroyし、API-006/idempotency/patient identity/SQL/DBは不変。

- [x] WP-4097 preserve patient results across append failure(R1 workflow recovery)
  - 発見根拠: continuation fetch失敗時にloaded state全体をerrorへ置換し、既存患者rows/query/cursor/未読込警告とretry controlを失う。通常のnetwork/parse失敗で患者比較を最初からやり直す。
  - scope: exact5 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/cursor/server/DB/CSS/packageは変更しない。
  - implementation: loaded stateがidle/loading/errorのappend substateを所有。append failureはmatching query/cursorのrows/query/cursorを保持してsanitized ErrorNoticeを表示し、明示retryは同じcursorを使う。successで一度だけmergeしてnoticeをclearする。
  - acceptance: retained rows/cursor/incomplete warning、visible alert、explicit retry、loading時continuation-only disabled、retry merge/duplicate warning、initial/blank/stale semantics不変。animation/focus移動/auto-retry/raw error/PHI persistenceなし。full gatesとindependent frontend/accessibility/medical/privacy/API review PASSまで未完了。
  - review_results: independent verifier APPROVED、findingなし。generation + query/cursor tuple guard、same-cursor retry、single merge、raw error非echo、role=alert、continuation-only disabled、medical workflow/privacy/security/API不変を確認。
  - validation_results: focused patient-search23、web218、workspace typecheck/test（API203 + PostgreSQL14 expected skipsを含む）/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `9f41c07` `WP-4097: preserve patient results on append failure` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent review/full gates PASS、API/DB/cursor/CSS/focus/animation/PHI handling不変。

- [x] WP-4098 quarantine migration DB client after rollback failure(R2 migration connection integrity) — FINALIZED
  - 発見根拠: migration SQLまたはhistory INSERT/COMMIT失敗後のROLLBACK自体が失敗しても、transaction state不明clientを通常`release()`でpoolへ戻し、後続利用へ混入させる。
  - scope: exact5 `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。SQL/order/migration/history/checksum/API/SSOT/DB実行/retry/logは変更しない。
  - implementation: post-BEGIN operation失敗後のrollback失敗時だけ外側ownerへunusableを通知し`release(true)`。original operation error identityを維持し、rollback成功、success、BEGIN失敗、check clientはzero-arg releaseを維持する。
  - acceptance: DB非依存fake Pool/PoolClientでsuccess、operation failure + rollback success/failure、BEGIN failureのquery/release順、release once、original identity、failure後のnext migration/final check停止、check client非destroyを固定。focused/API typecheckとindependent DB/data/security/privacy review PASSまで未完了。
  - review_results: independent verifier + DB/data/security/privacy/operations review APPROVED、findingsなし。original operation error identity、rollback-failure-only destroy、zero-arg reusable paths、failure後停止、SQL/semantic non-changeを確認。
  - validation_results: focused migration18（runner4）、API207 + PostgreSQL14 expected skips、web218、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: commit `27b6391` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent review/full gates PASS、rollback失敗clientだけをdestroyし、SQL/order/migration/history/checksum/API/SSOT/DB execution/retry/log semantics不変。

- [x] WP-4099 coalesce identical active patient-search append requests(R1 request integrity) — FINALIZED
  - 発見根拠: runnerはappend開始ごとにgeneration更新・fetchを発行するため、React stateがloadingへ反映される前の同期連打や同一callback再入で同じquery/cursorのrequestが重複し、先行responseをstale化して不要な通信と比較待ちを生む。
  - scope: exact5 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。UI DOM/copy/CSS/focus/animation/state/API/cursorは変更しない。
  - implementation: trim後の非blank appendだけをclosure-local nested `Map<query, Map<cursor | undefined, ownerToken>>`でstructural single-flight化。同一active tupleはgeneration/emit/fetch前にreturnし、unique owner一致時だけfinally cleanup/pruneする。full/blank/different tupleと既存generation semanticsは維持。
  - acceptance: trim-equivalent duplicate fetch once + owner merge、failure retry、success cleanup、full-search supersession late success/failure、collision-adversarial structural tuple並行、blank invalidation、sync emit/fetch throw cleanupを固定。serialization/hash/log/persistenceなし。focused/full gatesとindependent frontend/accessibility/medical/privacy/API review PASSまで未完了。
  - review_results: initial verifier MEDIUMはfull/blank authority change後もobsolete owner lockが残りreplacement appendを抑止する点。full/blankがauthority更新前にownershipをclearし、old finallyはexact token一致時だけreplacementを削除できない修正後、verifier + frontend/accessibility/privacy/API/medical review APPROVED、remaining findingsなし。
  - validation_results: focused patient-search31、web226、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `9689a83` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、initial MEDIUM修正後のindependent re-review/full gates PASS、同一active appendだけをcoalesceしUI/state/API/cursor semantics不変。

- [x] WP-4100 preserve last verified audit view across refresh(R2 audit workflow integrity) — FINALIZED
  - 発見根拠: refresh開始でloaded audit dataをtop-level loadingへ置換し、失敗時はerrorだけを残すため、直前に検証済みのchain状態、件数、監査tableを通常の取得失敗で消去する。broken-chain CRITICALも一時的に不可視になる。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。CSS/focus/animation/API/contracts/server/audit core/DB/SSOTは変更しない。
  - implementation: runner emitをReact-setter-compatible functional updateへ変更し、loaded stateにidle/loading/error noticeのrefreshStateを追加。loaded refresh中/失敗はexact dataを保持し、successだけcurrent dataへ置換。initial loading/error、generation/invalidate、every-run GETは維持。
  - acceptance: healthy/broken dataをrefresh loading/failure中も保持、raw error非echo、retry successで置換/clear、initial error/retry、stale/lifecycle/every run fetchを固定。broken CRITICAL/count/tableとrefresh error/retryを同時表示し、loading時はrefresh buttonだけdisabled。full gatesとindependent audit/frontend/accessibility/privacy/API/medical review PASSまで未完了。
  - review_results: initial audit/UI MEDIUMは保持表示が直前取得・検証内容であるfreshness ambiguity。exact `role=status` qualifierをview前へ置き、broken CRITICAL + refresh errorのtwo alertsとErrorNotice/retry隣接を固定後、verifier + audit/security/frontend/accessibility/privacy/API/medical re-review APPROVED、remaining findingsなし。
  - validation_results: focused audit-log-view16、web231、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `6221ead` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、initial audit/UI MEDIUM修正後のindependent re-review/full gates PASS、last verified audit dataとfreshness/critical visibilityを保持。

- [x] WP-4101 reload reception registration against latest requested queue target(R2 workflow integrity) — FINALIZED
  - 発見根拠: registration POST完了後のqueue reloadがsubmit開始renderのcaptured `date`を使うため、POST待機中にoperatorが別日付を明示表示しても古い日付へ巻き戻す。date input draftと実際に要求したqueue targetの区別もない。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。URL policy、generation、POST/idempotency/single-flight/input clearing/copy/CSS/focus/animation/API/DB/SSOTは変更しない。
  - implementation: component-instance closure trackerをinitial dateから一度だけ生成。every `load(target)`の先頭でmarkし、registration successはcompletion時の`current()`をreloadする。input onChange/renderはmarkせず、trackerからdate/queueへwriteしない。
  - acceptance: tracker closure、deferred POST中A→explicit B→completion B、draft C no mark、multiple B/C latest、failed invoked B authoritative、URL restoration via load mark、POST failure no reload/alterを固定。existing later-generation semanticsを維持。focused/full gatesとindependent reception/frontend/accessibility/privacy/API/medical review PASSまで未完了。
  - review_results: verifier + reception/frontend/accessibility/medical/privacy/API/data review APPROVED、findingsなし。load-first mark、completion-time read、draft非追跡、failed target維持、generation/POST/idempotency semantic不変を確認。
  - validation_results: focused reception-dashboard29、web237、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `dc8f088` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent review/full gates PASS、registration completionはlatest requested queue targetをreloadしdraft/URL/generation/POST semantics不変。

- [x] WP-4102 preserve reception queue source across refresh(R2 queue integrity) — FINALIZED
  - 発見根拠: queue refresh開始でloaded response/loadedAtをtop-level loadingへ置換し、失敗時はerrorだけになるため、直前の受付一覧とsource date/timeが消える。さらにresponse.dateとrequested targetの一致を検証せず、別日付responseを要求日付の結果として受理できる。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。WP-4101 tracker、URL、POST/idempotency/generation/every GET、API/DB/SSOT/CSS/focus/animationは変更しない。
  - implementation: loaded stateにrequired refresh idle/loading/error(requestTarget)を追加。refresh中/失敗/mismatchはexact response+loadedAtを保持し、current matching responseだけを新loadedAt一回で置換。current mismatchはactual date非echoの固定notice、stale completionはzero emit。
  - acceptance: initial、nonempty/empty A→B loading/failure、identity/T保持、raw非echo、current mismatch retained/initial、matching success/new timestamp、A-B-C stale success/failure/mismatch、retryを固定。qualifierはcount/table/empty前にrequest target、retained response.date、original loadedAtを表示し、errorは既存ErrorNoticeを併設、idle markup不変。full gatesとindependent reception/frontend/accessibility/medical/privacy/API/data review PASSまで未完了。
  - review_results: candidate arbitrationはLOW same-flight候補よりR2 last-verified queue/source preservationを優先。initial accessibility MEDIUMはrefresh qualifierとretained count/emptyのduplicate queue-level live region。refresh count/emptyを非live、qualifierをsole queue-level status、errorをone alertに固定後、verifier + reception/data/frontend/accessibility/medical/privacy/API re-review APPROVED、remaining findingsなし。
  - validation_results: focused reception-dashboard35、web243、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `9fda4dc` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、initial accessibility MEDIUM修正後のindependent re-review/full gates PASS、retained queue source/date/Tとrequest-target integrityを維持。

- [x] WP-4103 share identical latest active reception queue flight(R1 request integrity) — FINALIZED
  - 発見根拠: 同一targetのqueue loadがactiveでも再呼出しごとにgeneration/emit/fetchを発行し、表示連打やregistration completionとの同時loadで同じGETを重複させ、先行responseを不要にstale化する。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。UI/WP-4101 tracker/URL/POST/API/DB/SSOTは変更しない。
  - implementation: runner closureにlatest flight 1件だけを`targetDate/ownerToken/sharedPromise`で保持。同一latest active targetはgeneration/emit/clock/fetch前に同じPromiseへjoin。different targetはunique owner/deferredをsynchronous emit/fetch前に公開して既存WP-4102処理を実行し、exact-owner cleanup後だけsettleする。
  - acceptance: identical one fetch/loading/commit/shared pending、success/handled failure/mismatch cleanup+retry、A-B/A-B-A、obsolete owner protection+new duplicate join、re-entrant emit、sync emit reject cleanup、sync fetch handled cleanup、registration lock through shared reloadを固定。critical A-B-A第三flightはadmitし、Map/global/cache/log/serialization/coalesce以外のsemanticsなし。full gatesとindependent reception/data/frontend/accessibility/medical/privacy/API review PASSまで未完了。
  - review_results: verifier + reception/data/frontend/accessibility/medical/privacy/API review APPROVED、findingsなし。同一flight identity、re-entrant publication、A-B-A admission、exact-owner cleanup-before-settle、WP-4102/registration semantics維持を確認。
  - validation_results: focused reception-dashboard43、web251、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `ea67f13` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent review/full gates PASS、identical latest active queue flightをsharedしA-B-A/WP-4102 semanticsを維持。

- [x] WP-4104 bind patient refresh response to requested identity(R2 wrong-patient prevention) — FINALIZED
  - 発見根拠: `fetchPatientById(id)`はschema-valid 200 responseならreturned `patientId`がrequested IDと異なってもprojectionし、選択中患者文脈を別患者へ置換できる。404/non-ok/schema validationとrunner stale guardだけではcurrent response identityを拘束しない。
  - scope: exact5 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。copy/DOM/ARIA/focus/animation/API/contracts/server/DB/SSOTは変更しない。
  - implementation: 200 bodyをschema parse一回後、parsed.patientIdとrequested idをstrict比較し、一致後だけprojection。不一致は固定`Patient refresh response identity mismatch`をthrowし、requested/returned ID、name/kana/patientNumber/body/status/Zod/rawをechoしない。normalize/rewriteなし。
  - acceptance: same-ID projection、different-ID fixed/non-echo、bound fetch current mismatchはonFailureのみ、404 removal、transport/schema failure、clear/switch後stale mismatch zero callbacks、新er matching authorityを固定。mismatchはselection保持/stale経路でnull/onRemovedなし。full gatesとindependent patient/frontend/medical/privacy/security/API/data review PASSまで未完了。
  - review_results: independent verifier APPROVED、findingsなし。patient-safety/domain reviewもAPPROVED、findingsなしで、frontend/medical/privacy/security/API/data implicationsを確認。strict identity-before-projection、fixed non-echo mismatch、onFailure retention、404/stale semantics維持を確認。
  - validation_results: focused patient-context19/19、web full256/256、web typecheck/build PASS。full workspace gate exit0: `pnpm -r typecheck/test/build`、check:openapi、check:calculation-purity、boundaries、SSOT index173、secrets、deps high=0 critical=0、SBOM231、test:scripts、git diff --check全PASS。
  - landing_record: implementation commit `9cc9f56` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、reviews/full gates PASS、strict response identity bindingを追加し404/stale semanticsを維持。

- [x] WP-4105 bind reception repository result to requested patient identity(R2 wrong-patient prevention) — FINALIZED
  - 発見根拠: reception create routeはscoped patient lookupをrequest IDへ拘束する一方、repositoryが返すschema-valid `created` / `existing` entryのpatientIdを再拘束せず、別患者結果でもsuccess audit/responseへ進めた。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contract/OpenAPI/repository/DB/migration/SSOT/idempotency/audit schemaは変更しない。
  - implementation: `idempotency_conflict`判定後、created/existing共通で`result.entry.patient.patientId === parsedPatientId`をstrict要求。mismatchは固定`Reception repository returned a mismatched patient identity`でaudit/response前にfail-closedし、ID/氏名/カナ/患者番号/受付IDをechoしない。
  - acceptance: created/existing mismatchの500/no-store/fixed non-echo/audit zeroを固定し、created201/existing200/conflict409の既存semanticsを維持。repository side-effect rollbackやrepairは主張せず、現行adapterの到達不能 invariantにroute defense-in-depthを追加する。
  - review_results: independent verifierとmedical-safety/privacy/security/API/data-integrity review APPROVED、findingsなし。contract/OpenAPI/DB/SSOT/R3+ human gate変更なし。
  - validation_results: focused server60、API209 + PostgreSQL14 expected skips、web256、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `cc7b42c` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、created/existing result identityをaudit/response前にfail-closed拘束。

- [x] WP-4106 bind audit list results to requested tenant/pharmacy scope(R2 tenant isolation) — FINALIZED
  - 発見根拠: `/audit/events`はauthenticated scopeをrepositoryへ渡すが、返却AuditEventのtenantId/pharmacyIdを再拘束せず、healthyな別scope chainやmixed結果をchain status/totalCount/displayへ投影できた。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contract/OpenAPI/audit core/repository/DB/migration/web/SSOTは変更しない。
  - implementation: scoped list直後、chain verify/audit.viewed/sort/window/projection/response前に全eventのtenantId/pharmacyIdをstrict比較。一件でもmismatchなら固定`Audit repository returned events outside the requested scope`で全体をfail-closedし、filter/backfill/repair/partial response/audit.viewed success/identifier echoを行わない。
  - acceptance: foreign tenant、foreign pharmacy、local+foreign mixed(limit=1)を500/no-store/non-echo/audit zeroで固定。healthy/broken/malformed local chainの既存full-chain/no-backfill/view audit semanticsを維持。
  - review_results: independent verifierとsecurity/privacy/audit/data-integrity/API/medical review APPROVED、findingsなし。SEC-006/008の既存logical isolation強化であり、physical WORM/RLS/human gateは不変。
  - validation_results: focused audit-log15、API212 + PostgreSQL14 expected skips、web256、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `0b4e7ae` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、foreign/mixed audit resultsをchain/view/projection前にfail-closed拒否。

- [x] WP-4107 bind reception client response to submitted patient identity(R2 wrong-patient prevention) — FINALIZED
  - 発見根拠: browser `createReception`はPOSTしたpatientIdに対し、schema-valid 200/201 responseのnested patientIdを再拘束せず、別患者entryでも成功表示・入力clear・queue reloadへ進めた。WP-4105 server adapter境界とは独立したclient trust boundary。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。UI/copy/ARIA/CSS/API/contracts/server/DB/SSOT/idempotencyは変更しない。
  - implementation: 2xx bodyをschema parse一回後、`parsed.patient.patientId === patientIdValue`をstrict要求。一致後だけreturnし、不一致は固定`Reception response patient identity mismatch`をthrow。normalize/repair/raw echoなし。
  - acceptance: matching/mismatching x HTTP200(existing)/201(created)を固定。不一致errorに要求/返却ID、氏名、カナ、患者番号、受付IDを含めず、registerの成功表示/input clear/queue reloadへ到達しない。409/404/403/400/idempotency/no-store semantics維持。
  - review_results: independent verifierとfrontend/medical/privacy/security/API/data/accessibility review APPROVED、findingsなし。contract/OpenAPI/DB/SSOT/human gates不変。
  - validation_results: focused reception-dashboard47、web260、API212 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `85c17a2` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、browser reception response identityをsuccess side effects前にfail-closed拘束。

- [x] WP-4108 bind patient-search repository results to validated request limit(R2 PHI minimization) — FINALIZED
  - 発見根拠: `/patients/search`はvalidated limitをrepositoryへ渡すが、unbounded `page.results`をそのままresponseへ渡し、faulty adapterが要求数を超える患者PHIを200で返せた。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contract/OpenAPI/repository/SQL/DB/cursor/SSOTは変更しない。
  - implementation: repository search直後、cursor encode/response parse前に`page.results.length <= query.data.limit`を要求。超過は固定`Patient repository returned more results than requested`で全体fail-closedし、slice/filter/repair/requery/partial response/cursor発行/raw echoなし。
  - acceptance: limit1/result2とlimit50/result51を500/no-store、cursor encode zero、exact authenticated scope/query/limit input、全患者ID/氏名/カナ/番号/生年月日/資格状態non-echoで固定。正常default/exact-limit/second-page/opaque cursor semantics維持。
  - review_results: independent verifierとAPI/privacy/security/data-integrity/medical review APPROVED、findingsなし。API-001の既存limit/PHI規律強化でcontract/OpenAPI/DB/SSOT/human gates不変。
  - validation_results: focused server62、API214 + PostgreSQL14 expected skips、web260、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `efedddc` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、over-limit patient PHI pageをcursor/response前にfail-closed拒否。

- [x] WP-4109 reject duplicate PatientId across patient-search page and append workflow(R2 identity integrity) — FINALIZED
  - 発見根拠: serverはschema-valid page内の同一PatientId重複を許し、web appendもoffset pagination中の挿入/順序変更で既存rowsと同じPatientIdが再出現すると無検査mergeした。同一IDの矛盾summaryが独立選択可能になる。
  - scope: exact7 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contract/OpenAPI/repository/SQL/DB/cursor/SSOT/UI copy/CSSは変更しない。
  - implementation: serverはWP-4108 limit guard後に全resultを既存schemaでvalidateし、exact PatientId page内一意性をcursor/response前に要求。webはstale check後にnew page内一意性、append functional update内でauthoritative existing rowsとの非交差を要求。重複はdedupe/merge/partial commitせずgeneric error、verified rows/query/cursorを保持。
  - acceptance: same-page identical/conflicting duplicate、cross-page identical/conflicting overlap、新page内部duplicateをfail-closed。untrusted row/nextCursor/PHI非commit・non-echo、same retained cursor retry成功、distinct PatientIdの同姓同名/同一カナ許可。over-limit/malformed/stale/single-flight precedence維持。cross-page snapshot/keysetや患者統合は対象外。
  - review_results: initial domain MEDIUMはserver page-localのみでは実browser append ambiguity未解消。client cross-page/nonpartial guard追加後、independent verifierとAPI/data/privacy/security/medical review APPROVED、remaining findingsなし。
  - validation_results: focused server65、patient-search34、API217 + PostgreSQL14 expected skips、web263、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `4c94b91` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、initial MEDIUM修正後のindependent/domain re-reviewとfull gates PASS、page/append跨ぎのduplicate PatientIdをnonpartial fail-closed拒否。

- [x] WP-4110 reject duplicate ReceptionId at queue API and browser boundaries(R2 queue identity integrity) — FINALIZED
  - 発見根拠: queue response schemaは各entryをvalidateするがarray内ReceptionId一意性を強制せず、同一IDの別患者/status行をAPI/UIが受理しReact keyとoperator workflowを曖昧化できた。
  - scope: exact7 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contract/OpenAPI/repository/SQL/DB/SSOT/date/order/UI copy/CSSは変更しない。
  - implementation: server/browser双方でqueue全体を既存schema parse一回後、exact ReceptionId一意性をSetで検証。一件でもduplicateなら固定non-echo errorで全体拒否し、dedupe/merge/first-last/filter/repair/sort/partial response/commitなし。
  - acceptance: identical/conflicting(patient/status/acceptedAt) duplicateを両境界で拒否。API 500/no-store/exact scope-date、PHI/ID/status/time non-echo。browser refreshはlast verified response/date/loaded metadataを保持しuntrusted row zero、retry replacement成功。同患者の別ReceptionId、同acceptedAtの別ReceptionId、既存order/date/generation semanticsは維持。
  - review_results: independent verifierとreception/frontend/accessibility/API/data/privacy/security/medical review APPROVED、findingsなし。MOD-011業務日付やordering policyへ拡張せず、contract/DB/SSOT/human gates不変。
  - validation_results: focused server67/reception-dashboard50、API219 + PostgreSQL14 expected skips、web266、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `172b98e` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、independent/domain reviewとfull gates PASS、duplicate ReceptionIdをAPI/browser両境界でnonpartial fail-closed拒否。

- [x] WP-4111 share one active audit-log refresh flight(R1 request/audit integrity) — FINALIZED
  - 発見根拠: parameterless audit runnerはactive中の再呼出しごとにgeneration/loading/GETを重ね、render前の同期連打・emit再入で重複通信と重複`audit.viewed`を発生させた。WP-4086のlatest-wins/two-GET保持を、同一active flight共有へ意図的に更新する。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。UI/copy/DOM/ARIA/CSS/focus/animation/API/contracts/server/audit core/DB/SSOTは変更しない。
  - implementation: closure-local `ownerToken/sharedPromise`をgeneration/emit/fetch前にpublishし、active run/re-entrant runはexact同一Promiseをreturn。invalidateはowner detach+generation更新しGETをcancelしない。exact-owner cleanupをsettle前に行い、obsolete cleanupからreplacementを保護する。
  - acceptance: sync duplicate/re-entrant one Promise/loading/fetch/terminal、invalidate A→B+duplicate B、old success/failure zero emit、sync loading emit rejection shared+cleanup、sync fetch throw handled+retry、cleanup-before-settlement continuation new GETを固定。completed cache/abort/global Map/log/audit suppressionなし。WP-4100 retained healthy/broken CRITICAL/error/retry semantics維持。
  - review_results: independent verifierとaudit/frontend/accessibility/security/privacy/API/data/medical review APPROVED、findingsなし。WP-4086 concurrent latest-winsはexplicit invalidate supersessionへ置換、API/audit.viewed/SSOT/human gates不変。
  - validation_results: focused audit-log-view19、web269、API219 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `0ebe4f9` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、active audit refreshをsingle shared flight化し重複GET/audit.viewedを抑制。

- [x] WP-4112 reject duplicate EventId in verified audit views(R2 audit identity integrity) — FINALIZED
  - 発見根拠: `verifyAuditHashChain`はhash/prevHash/entryHashを検証するがEventId一意性を見ず、同一EventIdをsequence2で再hash連結した2件chainが`ok:true`となることを実証。API/UIは両rowをhealthyとして投影しReact keyも衝突した。
  - scope: exact7 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`, `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。audit core/contracts/OpenAPI/reason enum/repository/DB/migration/SSOT/UI copy/ARIAは変更しない。
  - implementation: APIはWP-4106 scope guard→core full-chain verify一回後、`verification.ok`時のみunwindowed全eventsのexact EventId一意性を`audit.viewed`/sort/limit/projection/response前に要求。browserもparse後healthy responseのみdisplay entriesを検査。duplicate healthyはfixed non-echo全体拒否、dedupe/repair/partial表示なし。
  - acceptance: same-logical/conflicting payloadを同一EventIdでvalid rehashしたchainを`limit=1`でもAPI 500/no-store/audit zero。browser healthy duplicate拒否、refreshはlast verified view保持+generic error+retry成功。broken/malformed+duplicateは既存reason/checkedCount/raw window/no-backfill/audit.viewed/CRITICALを優先。foreign scope precedence、unique healthy semantics維持。
  - review_results: independent verifierとaudit/data/security/privacy/API/frontend/accessibility/medical/DB-boundary review APPROVED、findingsなし。DB-005 EventId uniquenessをread boundaryで補強するだけでcore reason/DB/SSOT/human gates不変。
  - validation_results: focused audit API18/web22、API222 + PostgreSQL14 expected skips、web272、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `2eafa3b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、independent/domain reviewとfull gates PASS、healthy verified audit viewsのduplicate EventIdをAPI/browserで全体拒否し、broken/malformed fail-visible semanticsを維持。

- [x] WP-4113 reject non-contiguous sequenceNumber in verified audit reads(R2 audit completeness integrity) — FINALIZED
  - 発見根拠: `verifyAuditHashChain`はhash/prevHash/entryHashを検証するがsequence連続性を見ず、異なるEventIdを正しく再hash連結した`[1,3]` chainが`ok:true`となることを実証。APPROVED DB-005はcloud chainの初回永続eventを1、以後をTIP採番の厳密な`1..N`とする。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。audit core/contracts/OpenAPI/reason enum/repository/SQL/DB/migration/SSOT/web/UIは変更しない。
  - implementation: scope guard→core full-chain verify一回→WP-4112 full EventId一意性の後、`verification.ok`時のみunwindowed append-order全eventsの`sequenceNumber === BigInt(index + 1)`を別passで要求。anomalyはfixed non-echo全体拒否し、`audit.viewed`/sort/limit/projection/response前に停止。filter/reindex/sort/repair/backfillなし。
  - acceptance: valid rehashしたstart-at-2、gap`[1,3]`、reuse`[1,1]`、valid prefix後backward`[1,2,1]`を`limit=1`でも500/no-store/audit zero。`[2,3]`+duplicate EventIdはWP-4112 identity errorを優先。empty/contiguous healthyは維持し、broken/malformed+sequence anomalyは既存reason/checkedCount/raw window/no-backfill/audit.viewedを優先。
  - review_results: initial domain MEDIUM(full EventId precedenceがsingle loopで配置依存)とverifier MEDIUM(backward fixtureがstart anomalyと同一branch)を、EventId/sequence別full passと`[1,2,1]` fixtureで修正。independent verifierとaudit/data/security/privacy/API/medical/DB-boundary re-review APPROVED、findingsなし。DB-005 decision B/app-local boundary、virtual genesis、no-delete、future segmentation stopを維持。
  - validation_results: focused audit API23、API227 + PostgreSQL14 expected skips、web272、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `4077779` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、initial MEDIUM 2件修正後のindependent/domain re-reviewとfull gates PASS、healthy verified audit sequenceを厳密な`1..N`へfail-closed。

- [x] WP-4114 validate audit response count relationships at the browser trust boundary(R2 audit evidence integrity) — FINALIZED
  - 発見根拠: audit response schemaは各fieldを個別検証するが、`entries.length > totalCount`、healthy `checkedCount != totalCount`、broken `checkedCount != breakIndex`または`breakIndex >= totalCount`を受理する。contractは全保存event検証/総数を規定し、core verifierはhealthyで全件count、brokenで成功済み件数=zero-based break indexを返す。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/API/server/audit core/reason/repository/DB/migration/SSOT/UI copy/DOM/ARIA/CSSは変更しない。
  - implementation: schema parse→WP-4112 healthy duplicate EventId全件検査後、全responseで`entries.length <= totalCount`、healthyで`checkedCount === totalCount`、brokenで`checkedCount === breakIndex < totalCount`を要求。矛盾はfixed non-echo全体拒否し、clamp/rewrite/filter/reclassification/partial state commitなし。
  - acceptance: entries overflow、partial healthy、broken count/index mismatch、index==total、empty brokenを拒否。empty/limited/full healthy、first/last breakをexact objectのまま受理。duplicate+invalid countsはWP-4112 identity error優先、consistent broken duplicateはfail-visible維持。refresh invalidはlast verified viewを保持しgeneric error+retry成功。
  - review_results: independent verifierとaudit/data/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。existing contract/core semanticsのbrowser defense-in-depthでhuman gate不変。
  - validation_results: focused audit web32、web282、API227 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `b7cf057` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、browser audit responseのrelational countsをfail-closed検証。

- [x] WP-4115 reject exact append-cursor self-loops before patient result commit(R1 workflow/request integrity) — FINALIZED
  - 発見根拠: patient appendがcursor Cにdistinct rowsまたはempty pageと`nextCursor:C`を返すと、現状はrowsをcommitしてCを維持し、次回同じpageを再取得してoverlap errorまたはempty loopになる。current v1 cursorはbinding+offsetの決定論的HMACで、exact token equalityは同一continuation位置を示す。
  - scope: exact5 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。fetch/API/contracts/OpenAPI/cursor codec/key/repository/SQL/DB/migration/WP-4057/UI copy/DOM/ARIA/CSS/orderは変更しない。
  - implementation: stale generation→page-local PatientId uniqueness→authoritative query/cursor tuple→cross-page overlapの後、merge前にdefined requested cursorとreturned nextCursorのexact equalityだけを拒否。decode/offset/order推測なし。prior rows/query/cursorを保持しgeneric append error、partial mergeなし。
  - acceptance: distinct nonempty/empty self-loopを拒否しuntrusted row/token zero commit。同じretained cursorでretryを許し、different/undefined nextCursorは既存どおり一度だけmerge/terminal化。page/cross-page duplicate precedence、stale/coalescing/replacement/owner cleanup維持。PHI/raw cursor/error非echo。
  - review_results: independent verifierとpatient/data/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。current deterministic v1限定のcontrol tighteningでWP-4057/future stateful cursor/human gate不変。
  - validation_results: focused patient-search36、web284、API227 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `066ca00` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、patient appendのexact cursor self-loopをpartial commit前にfail-closed拒否。

- [x] WP-4116 bind repository patient-search cursor to exact consumed offset(R2 pagination/data integrity) — FINALIZED
  - 発見根拠: patient search APIはrequest cursorを内部offsetへdecodeする一方、repositoryの`nextCursor`をrequest位置・返却件数へ再拘束せず署名できた。faulty adapterがsame/backward/forward-skip/empty continuationをauthenticated tokenへ昇格でき、loop・重複・患者候補欠落を生じうる。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/cursor codec/repository/SQL/DB/migration/SSOT/web/UI/package/lockは変更しない。
  - implementation: over-limit→全result schema→page PatientId一意性の既存precedence後、encode前にdefined next cursorへnonempty page、safeな`(requested offset ?? 0) + validatedResults.length`、returned offsetとのexact一致を要求。違反は固定non-echo errorで全体拒否し、補正/clamp/filter/requery/partial response/cursor発行なし。
  - acceptance: initial empty+offset0、continued same/backward/forward-skip、safe-integer overflowを500/no-store/encode zeroで拒否。exact consumed offset、正常first/second/terminal、incoming cursor binding、over-limit/duplicate precedenceを維持し、PHI/raw cursorをerrorへ出さない。
  - review_results: read-only mapper/pre-plan後、independent verifierとAPI/data-integrity/security/privacy/medical/DB-boundary review APPROVED、findingsなし。APPROVED API-001のopaque wire contractを変えず、current internal offset adapter invariantをfail-closed補強しhuman gate不要。
  - validation_results: focused server73、API233 + PostgreSQL14 expected skips、web284、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `8c5880b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、repository cursorをexact consumed offsetへ署名前にfail-closed拘束。

- [x] WP-4117 validate healthy audit response chronological order at browser boundary(R2 audit evidence integrity) — FINALIZED
  - 発見根拠: contract/OpenAPI/APIはhealthy audit entriesを`wallClock desc`の最新順とするが、browserはschema、EventId一意性、count関係だけを検査し、older-firstや途中再上昇をverifiedな「最新」証跡として表示できた。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/API/server/audit core/repository/DB/migration/SSOT/UI copy/DOM/ARIA/CSS/package/lockは変更しない。
  - implementation: schema→healthy duplicate EventId→count関係の既存precedence後、healthyのみadjacent wallClockをexact UTC instantのnon-increasing順で検査。sub-millisecond precisionを保持しequal instantを許可。違反はfixed non-echo全体拒否しsort/repair/filter/partial commitなし。broken chainはwallClock非信頼のraw-window/CRITICALを維持。
  - acceptance: reversed、descending prefix後のsub-millisecond再上昇を拒否。descending/equal/single/empty/limited healthyをexact objectのまま受理。duplicate/count precedence、broken out-of-order fail-visible、refresh last verified保持+generic error+retryを維持しaudit fieldsをerrorへechoしない。
  - review_results: read-only mapper/pre-plan後、independent verifierとaudit/data-integrity/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。arbitrary fractional秒/no-fraction/equal instant、broken raw-window、precedence、non-echoを独立確認しhuman gate不要。
  - validation_results: focused audit web38、web290、API233 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `cebd9de` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、healthy audit chronologyをbrowser state commit前にfail-closed拘束。

- [x] WP-4118 canonicalize reception queue order at browser boundary(R2 workflow integrity) — FINALIZED
  - 発見根拠: APPROVED API-006は`acceptedAt ASC + receptionId ASC`を要求しsortをclient責務とするが、browserはschema/duplicate検査後にtransport順をそのままPHI-rich受付queueへ表示していた。default adaptersの偶然の順序へ依存し、alternate/drifted repositoryで待ち順を誤表示できた。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/API/server/repository/SQL/DB/migration/SSOT/UI copy/DOM/ARIA/CSS/date-time/package/lockは変更しない。
  - implementation: HTTP/schema→full ReceptionId一意性の既存precedence後、entries copyをexact UTC acceptedAt昇順、equal instantはcode-unit ReceptionId昇順へsortして新responseを返す。arbitrary fractional秒を保持し、元array/entry/dateを変更せずreject/dedupe/merge/filterなし。
  - acceptance: reversed/mixed acceptedAt、sub-millisecond、equal acceptedAtのID tieをcanonical化。sorted/single/emptyはvalue-equivalent、source非mutation、render earliest-firstを固定。duplicate non-echo拒否、date mismatch/stale/single-flight/last verified/retry/loadedAt/JST/UI semanticsを維持。
  - review_results: mapper/pre-plan/explorer後、independent verifierとreception/data-integrity/API/frontend/accessibility/medical/privacy/security review APPROVED、findingsなし。exact fractional precision、code-unit tie、source非mutation、PHI/UI/runner不変を独立確認しhuman gate不要。
  - validation_results: focused reception web54、web294、API233 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `7eb4038` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、API-006 client stable orderをPHI-rich reception queueへ適用。

- [x] WP-4119 bind audit projection to the browser requested window(R2 audit evidence/data-minimization integrity) — FINALIZED
  - 発見根拠: browserは固定`limit=50`でaudit entriesを要求するが、schema/identity/count/chronology後もrequested windowとの件数関係を検査せず、healthy underfillやhealthy/broken overflowをverified/latestまたはraw evidenceとしてcommitできた。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/API/server/audit core/repository/DB/migration/SSOT/UI copy/DOM/ARIA/CSS/package/lockは変更しない。
  - implementation: `AUDIT_LOG_DEFAULT_LIMIT`をrequest URLとresponse invariantの単一authorityにし、schema→healthy duplicate→count→healthy chronology後、全responseでentries<=limit、healthyはexact`min(totalCount, limit)`を要求。broken underfill/projection omissionは許可し、違反はfixed non-echo全体拒否、slice/backfill/refetch/filter/repair/partial commitなし。
  - acceptance: healthy underfill、healthy/broken 51 overflowを拒否。healthy total51/entries50、0/1/49/50 complete window、bounded broken raw/projection-shortを維持。既存precedence、refresh last verified+generic error+retry、audit fields/counts/raw non-echo、URL limit50を固定。
  - review_results: mapper/pre-plan後、rootがhealthy exact completeness + all-response upper boundへ統合。independent verifier APPROVED、findingsなし。audit/data-integrity/security/privacy/API/frontend/accessibility/medical観点をexact scopeで確認し、bounded broken raw evidence/non-echo/UI不変/human gate不要を確認。追加domain-agent turnはthread ceilingのため不可だったが、独立verifierが同観点を証拠付きで網羅。
  - validation_results: focused audit web43、web299、API233 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `46b00a3` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent reviewとfull gates PASS、healthy completenessとall-response requested upper boundをbrowser commit前にfail-closed拘束。

- [x] WP-4120 validate reception result schema and created WAITING state at trust boundaries(R2 workflow/audit integrity) — FINALIZED
  - 発見根拠: serverはtyped repository resultをruntime full-schema検証せず、matching patientIdだけでsuccess audit/responseへ進み、server/browser双方がschema-valid HTTP201 created non-WAITINGを成功扱いできた。APPROVED API-006は新規受付がWAITING開始、200 replayはexisting entryと規定。
  - scope: exact7 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/repositories/SQL/DB/migrations/audit core/SSOT/shared-kernel/UI copy/DOM/ARIA/CSS/package/lockは変更しない。
  - implementation: serverはconflict後にfull ReceptionQueueEntry schema→result patient identity→created exact WAITING→audit/response。parsed entryだけをaudit target/responseへ使用。browserはsuccess HTTP 200/201 allowlist→schema→submitted patient identity→201 exact WAITING→return。200 existingの全registered statusは維持。unsupported 2xxも固定non-echo拒否し、status rewrite/default/repairなし。
  - acceptance: malformed created/existingを500/no-store、created audit zero。created IN_PROGRESS/COMPLETED/CANCELLEDをserver/browserで拒否し、WAITING 201/audit onceを維持。existing advanced statusは200/no duplicate audit。202 WAITING/COMPLETED、identity mismatch precedence、409/400/403/404、success side effects前throw、PHI/status/schema details non-echoを固定。
  - review_results: mapper/pre-plan後、rootがschema+created-state exact7へ統合。domain initial MEDIUM(任意2xx bypass)を200/201 allowlist+202 testsで修正しfinal APPROVED。independent verifier runtime APPROVED後、LOW ledger count/precedence指摘を本finalizationで修正。remaining findingsなし、human gate不要。
  - validation_results: focused API server79、web reception62、API239 + PostgreSQL14 expected skips、web307、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `96f3597` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、MEDIUM/LOW修正後のindependent/domain re-reviewとfull gates PASS、invalid/advanced created receptionをsuccess audit/UI前にfail-closed拒否。

- [x] WP-4121 validate patient snapshot before persistence and bind created acceptedAt(R2 patient/queue/audit integrity) — FINALIZED
  - 発見根拠: reception POSTはlookup patientId一致だけで未検証PHI snapshotをrepository mutationへ渡し、後段projection失敗前にin-memory/idempotencyまたはDB writeへ混入しえた。またAPI-006のserver-assigned acceptedAtに対しcreated resultの別canonical instantをsuccess audit/201へ受理できた。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/patient/reception repositories/interfaces/SQL/DB/migrations/audit core/SSOT/browser/UI/package/lockは変更しない。
  - implementation: lookup not-found→patient identity→full PatientSearchResult schema→capture server acceptedAt Date+immutable ISO→repository mutation→WP-4120 result schema/identity/WAITING→created exact acceptedAt→audit/response。parsed patientだけをcreateへ渡す。existing replayはhistorical acceptedAtを許可し、audit wallClockは別now sampleを維持。固定non-echo拒否、normalize/tolerance/rewriteなし。
  - acceptance: matching-ID malformed patientは500/no-store、create/audit zero。wrong-ID/404 precedence維持。created earlier/later acceptedAtはaudit zero、exact acceptedAtは201/audit once、repositoryへ同一Dateを一度渡しaudit clockを別sample。existing historical acceptedAt、WP-4120 schema/identity/status、JST/idempotency semanticsを維持しPHI/time/raw details非echo。
  - review_results: mapperがupstream patient snapshot gap、pre-planがcreated acceptedAt gapを独立確認し、rootが同じexact5 trust boundaryへ統合。independent verifierとpatient/data/reception/audit/security/privacy/medical/DB-boundary domain review APPROVED、findingsなし。Date mutationにもimmutable ISOが耐えることを確認しhuman gate不要。
  - validation_results: focused API server83、API243 + PostgreSQL14 expected skips、web307、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `5e8203f` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、malformed patient snapshotとcreated acceptedAt driftをpersistence/audit前にfail-closed拒否。

- [x] WP-4122 reject applied migration name drift(R1 migration-history integrity) — FINALIZED
  - 発見根拠: APPROVED DB-002はcommitted migrationとapplied historyのimmutable reconciliationを要求し、historyはversion/name/checksumを保存するが、pure reconciliationはversion+checksumだけを比較して同一SQL renameをup_to_date/db_aheadとして受理した。
  - scope: exact7 `apps/api/src/db/migration-state.ts`, `apps/api/src/db/migration-state.test.ts`, `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。migration SQL/files/loader、DB/schema/history rows、production/staging DB、package/lock、CI、SSOTは変更しない。
  - implementation: version/checksum既存precedence後にexact name比較を追加し、distinct `name_mismatch` resultへexpected/actual metadataを保持。formatterは両nameをJSON quote/escapeしSQL/secret/control文字をraw出力しない。apply runnerは`unapplied_required`だけをoperation loopへ許可し、name driftはinitial SELECT/release後にMigrationStateError、operation connection/BEGIN/DDL/INSERT/COMMIT/ROLLBACK/final check zero。
  - acceptance: same version/checksum/different name、db-ahead comparable prefix driftを拒否。checksum+name mismatchはchecksum優先。exact/up-to-date、prefix-compatible db-ahead、true unapplied apply、client release/error preservationを維持しhistory repair/rename/DMLなし。
  - review_results: mapper/pre-plan後、independent verifier runtime APPROVED。domain LOW(DB-sourced nameのcontrol文字log injection)をJSON escaping+regression testで修正しdomain final APPROVED。verifier LOW ledger count/trail指摘を本finalizationで修正。remaining findingsなし、DB write/human gate不要。
  - validation_results: focused migration-state8 + runner5 = 13、API248 + PostgreSQL14 expected skips、web307、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `f7e9475` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、independent/domain reviewとfull gates PASS、applied migration name driftをDB mutation前にfail-closed拒否。

- [x] WP-4123 reject unhealthy post-apply migration reconciliation(R2 migration-operation integrity) — FINALIZED
  - 発見根拠: `applyPendingMigrations()` はpending migration commit後のfinal `checkMigrationState()` がchecksum/name mismatchまたはunapplied_requiredでもfailure-shaped resultを返し、`db:migrate` CLIはresolved resultを表示してexit 0にできた。APPROVED DB-002のimmutable history / unapplied fail-closed規律に反する。
  - scope: exact5 `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。migration state semantics/formatter、CLI、migration SQL/files/loader、DB/schema/history repair、package/lock、CI、SSOTは変更しない。
  - implementation: operation client release後に既存final reconciliationをexact once実行し、non-okならexact resultを保持する`MigrationStateError`をthrow。final up_to_date / DB-002 prefix-compatible db_aheadのみsuccess resultを返す。commit済みmigrationのrollback/retry/history repair/additional DDL/DMLは行わない。
  - acceptance: final checksum_mismatch/name_mismatch/unapplied_requiredはrejectし、BEGIN/DDL/history INSERT/COMMIT、operation/final-check client release、original operation/rollback error identityは維持。final up_to_date/db_aheadは成功し、initial WP-4122 semanticsは不変。fake client testsのみでDB write/applyなし。
  - review_results: mapper findingをplannerが比較再裁定しAPPROVED_WITH_PINS。DB/data-integrity/security/operations/API domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused migration-runner9、API252 + PostgreSQL14 expected skips、web307、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `8b81c0b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、unhealthy post-apply reconciliationをCLI successとして返さずfail-closed拒否。

- [x] WP-4124 require exact HTTP 200 for patient-context refresh(R2 selected-patient context integrity) — FINALIZED
  - 発見根拠: OpenAPI/API-001は`GET /patients/{patientId}`のsuccessを200だけとするが、browser `fetchPatientById()`は404以外の任意`res.ok`をschema/identity parseし、schema-valid 201/202/206をglobal selected patient contextのauthoritative refreshとして`onFresh`へ渡せた。WP-4104はidentity、WP-4082はgeneration、WP-4120はPOST reception statusのみをhardening済みで非重複。
  - scope: exact5 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/repositories/DB/migrations/SSOT、patient search/audit transport、UI copy/DOM/ARIA/CSS、package/lockは変更しない。
  - implementation: 404→nullを最優先で維持し、その後exact status 200だけをsuccessとしてbody schema→requested patient identity→projectionへ進める。201/202/204/206を含む他statusはbodyを読まず既存status-only errorへrejectし、current runnerはonFailureのみ、stale failureはgeneration guardでcallback zero。
  - acceptance: 200 matching/schema/identity semantics、404 removal、400/403/500 failure、clear/switch/unmount generationを維持。unsupported 2xxはPHI/body/IDをerrorへechoせずonFresh/onRemoved zero、selectionをclear/replaceしない。UI/accessibility markupは不変。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。patient/data/API/privacy/security/medical/frontend/accessibility domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused patient-context26、web314、API252 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `ab71df7` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、non-contract 2xxによるglobal selected-patient context置換をbody parse前にfail-closed拒否。

- [x] WP-4125 require exact HTTP 200 for patient-search pages(R2 patient-selection integrity) — FINALIZED
  - 発見根拠: API-001/OpenAPIは`GET /patients/search`のsuccessを200だけとするが、browser `fetchSearch()`は任意`res.ok`をpageとしてparseし、schema-valid 201/202/206をselectable patient candidatesまたはverified pageへのappendとしてcommitできた。WP-4109/4115/4116はidentity/cursor、WP-4124はget-by-id transportで非重複。
  - scope: exact5 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/repositories/cursor codec/DB/migrations/SSOT、patient-context/audit/reception transport、UI copy/DOM/ARIA/CSS、package/lockは変更しない。
  - implementation: 既存non-ok branch(400/403 error-code mapping含む)を先に維持し、その後exact status 200だけをbody schema/duplicate/cursor/mergeへ進める。201/202/204/206はbody未読のstatus-only SearchError。current fullはcandidate zero、appendはverified results/query/cursor保持とsame-tuple retry、stale responseはgeneration suppress。
  - acceptance: exact200 schema→generation→page duplicate→append tuple→cross-page overlap→cursor self-loop→commit precedenceと400/403 guidanceを維持。unsupported 2xxはquery/PHI/ID/cursor/bodyをerror/stateへechoせず、row/tokenをcommitしない。append owner cleanup、retry、newer search authority、UI/accessibility markupは不変。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。patient/data/API/privacy/security/medical/frontend/accessibility domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused patient-search43、web321、API252 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `3721c51` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、non-contract 2xx patient pagesのselectable/append commitをbody parse前にfail-closed拒否。

- [x] WP-4126 require exact HTTP 200 for audit-log evidence(R2 audit-evidence integrity) — FINALIZED
  - 発見根拠: OpenAPIの`GET /audit/events` successは200だけだが、browser `fetchAuditLog()`は任意`res.ok`をschema/identity/count/order/window検証へ通し、schema-valid 201/202/206をauthoritative audit evidenceとしてinitial/refresh commitできた。WP-4100/4111/4112/4114/4117/4119はstate/identity/count/order/window、WP-4124/4125はpatient transportで非重複。
  - scope: exact5 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/generated artifacts、audit core/repository/DB/migrations/SSOT、UI copy/DOM/ARIA/CSS/focus/animation、package/lockは変更しない。
  - implementation: 既存non-ok branch(403/registered errorCode mapping含む)を先に維持し、その後exact status 200だけをschema→healthy identity→count/break relation→healthy chronology→windowへ進める。201/202/204/206はbody未読のstatus-only notice。initialはdata zero、refreshはlast verified/broken view保持、staleはgeneration suppress、retry/owner cleanup維持。
  - acceptance: unsupported 2xx body/audit IDs/actor/target/raw internalをerror/stateへechoせず証跡commit zero。exact200 healthy/broken、既存invariant precedence、403 guidance、no-store/scope、active-flight sharing/invalidation、UI/accessibility markupを維持。補正/partial commit/abortなし。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。audit/data/API/privacy/security/medical/frontend/accessibility domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused audit-log-view50、web328、API252 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `603973b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、non-contract 2xx audit evidenceのinitial/refresh commitをbody parse前にfail-closed拒否。

- [x] WP-4127 bind reception queue entries to requested JST business date(R2 workflow/PHI integrity) — FINALIZED
  - 発見根拠: APPROVED API-006はexplicit one-day queueを定義するが、API serverはrequested dateをrepositoryへ渡してtop-level responseへ再設定するだけで、各schema-valid entryの`acceptedAt`が同じJST業務日に属するか未検証だった。faulty/custom adapterは別日のPHI-rich rowをexact-200 requested queueへ混入でき、browser top-level date bindingでは検出不能。
  - scope: exact5 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。contracts/OpenAPI/API-006 SSOT、repository interface/implementations、SQL/DB/migrations、web/UI、date-time package、audit、package/lockは変更しない。
  - implementation: full response schema parse→full ReceptionId duplicate pass後、既存canonical `businessDateFromAcceptedAt(new Date(entry.acceptedAt))`で全entryをrequested dateへ拘束。1件でも不一致ならfixed non-PHI 500/no-storeでall-or-nothing拒否し、filter/re-date/sort/repair/partial responseなし。
  - acceptance: JST early-morning(UTC previous date)は受理、previous/next JST dateとmixed queueは拒否。malformed→duplicate→business-date precedence、empty/all-local、repository tenant/pharmacy/date input、client ordering責務、400/403/no-storeを維持。date/ReceptionId/acceptedAt/status/patient PHIはerror非echo。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。reception/data/API/privacy/security/medical/DB-boundary domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused API server87、API256 + PostgreSQL14 expected skips、web328、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `47836ba` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、foreign/mixed JST business-date reception rowsをPHI response前にfail-closed拒否。

- [x] WP-4128 require exact HTTP 200 for reception queue(R2 workflow/PHI integrity) — FINALIZED
  - 発見根拠: APPROVED API-006/OpenAPIは`GET /reception/queue`のsuccessを200だけとするが、browser `fetchReceptionQueue()`は任意`res.ok`をPHI-rich queueとしてparseし、schema-valid 201/202/206をauthoritative stateへcommitできた。WP-4102/4110/4118/4127の日付・identity・order・server business-date hardeningとは非重複。
  - scope: exact5 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/repositories/DB/migrations/SSOT、POST reception path、UI copy/DOM/ARIA/CSS/focus/animation、package/lockは変更しない。
  - implementation: 既存non-ok branch(400/403/registered errorCode mapping含む)を先に維持し、その後exact status 200だけをbody schemaへ進める。201/202/204/206はbody未読のstatus-only `ReceptionError`。exact200はschema後にtop-level requested dateを直接拘束し、その後full duplicate pass→copied canonical sort。runnerのcustom fetcher用date defense、generation/owner/state semanticsは維持。
  - acceptance: unsupported 2xxはdate/ReceptionId/acceptedAt/status/patient PHI/bodyをerror/stateへechoせずcommit zero。initial error、same/date-switch refreshのlast verified response/loadedAt保持、stale suppress、retry admissionを固定。exact200 date→duplicate→order、400/403、no-store/scope、source nonmutation、UI/accessibilityを維持。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。reception/data/API/privacy/security/medical/frontend/accessibility/DB-boundary domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。
  - validation_results: focused reception-dashboard69、web335、API256 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `237000e` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、unsupported queue 2xxをbody parse/state commit前にfail-closed拒否し、exact200 date/identity/orderとrunner state semanticsを維持。

- [x] WP-4129 distinguish migration version drift from checksum drift(R1 operations/data integrity) — FINALIZED
  - 発見根拠: APPROVED DB-002はprefix-compatible DB aheadと同一version checksum driftを区別するが、pure reconciliationはcomparable indexのversion不一致をchecksum不一致とOR結合し、同一checksumでも`checksum_mismatch`として誤診した。startup/applyは既にnon-okをfail-closed拒否するためpermission/data bypassではなく運用診断整合性gap。
  - scope: exact6 `apps/api/src/db/migration-state.ts`, `apps/api/src/db/migration-state.test.ts`, `apps/api/src/db/migration-runner.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runner production logic、CLI、migration loader/files/SQL、schema/history repair、DB操作、contracts/OpenAPI/web/SSOT、package/lockは変更しない。
  - implementation: closed result unionへdistinct `version_mismatch(expectedVersion, actualVersion)`を追加。comparable prefixをversion→checksum→nameのfull precedenceで照合後にdb_ahead/unapplied/up_to_dateを判定。formatterは両versionをJSON quote/escapeし、checksum/name/SQL/appliedBy/connection情報を含めない。runner production codeは既存non-ok拒否を維持。
  - acceptance: version-only/all-field driftはversion優先、same-version checksum+name driftはchecksum、name-onlyはname。comparable-prefix version driftはdb_ahead前に拒否。initial runnerはSELECT/release後operation client/SQL zero、final driftはcommit済みoperationをundo/retryせずexact error。history repair/apply/DMLなし。
  - review_results: mapper APPROVED、planner APPROVED_WITH_PINS。Domain initial LOW(U+0085/U+2028/U+2029がliteralのままで一行診断を破れる)をshared diagnostic quote+version/name regression testsで修正し、DB/data-integrity/operations/security/privacy/test/medical domain re-reviewとindependent verifierはAPPROVED、findingsなし、human apply gate不要。
  - validation_results: focused migration state14 + runner11 = 25、API264 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - landing_record: implementation commit `17a94f8` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact6、independent/domain reviewとfull gates PASS、version driftをfail-closedのままdistinct one-line escaped diagnosticへ分離し、runner/DB behaviorは不変。

- [x] WP-4130 make calculation-purity scan scope fail closed(MEDIUM calculation safety/tooling) — FINALIZED
  - 発見根拠: APPROVED CAL-010の非緩和pure-function gate `scripts/check-calculation-purity.mjs`はprotected targetへの全`stat` failure/missingを空配列へ変換し、production source 0件でもPASSした。missing supplied rootでexit0/PASSをlive再現し、package削除・rename・unreadable/empty scopeでCI control自体がsilent失効する実在gap。
  - scope: exact5 `scripts/check-calculation-purity.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。calculation source、CAL-010/docs/SSOT、package/lock、CI、API/web/DB/migrationsは変更しない。
  - implementation: exact targetをreal directoryかつnon-symlinkとして検証し、traversal/read error、nested symlink/special entry、eligible production source 0件を固定non-sensitive errorでexit1。valid nonempty scopeだけを既存5 forbidden patternsへ通し、comment/test/spec/ignored-dir除外と全件violation収集を維持。
  - acceptance: missing root/target、target file/symlink、empty/test-only/ignored-only、nested symlinkはFAIL/no PASS、absolute path/OS error/source marker非echo。clean sourceはPASS、既存forbidden matrixはexact evidence付きFAIL。target validation→traversal/read→nonempty→scan/reportのprecedenceを維持。
  - review_results: mapper APPROVED、planner再裁定APPROVED_WITH_PINS。calculation/CAL-010/test/tooling/security/operations/medical/claims/privacy domain reviewとindependent verifierはAPPROVED、findingsなし、human gate不要。静的5-pattern gateは完全な意味論的純粋性証明とは主張しない。
  - validation_results: node syntax checks、script harness、live calculation-purity、API264 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/diff全PASS。
  - landing_record: implementation commit `00e072b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、independent/domain reviewとfull gates PASS、protected calculation scope欠落/不正/空をsilent PASSさせず既存CAL-010 detector semanticsを維持。

- [x] WP-4131 scan common credential and shell file extensions(HIGH security/tooling) — FINALIZED
  - 発見根拠: `scripts/check-secrets.mjs` はprivate-key blockとgeneric secret assignmentを検出できる一方、明示的なtext extension allow-listに`.pem`, `.key`, `.sh`, `.bash`, `.zsh`がなく、synthetic shell credential assignmentをexit0/PASSする実在のCI secret-prevention gapを再現した。
  - scope: exact5 `scripts/check-secrets.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。regex/heuristic、basename `.env*`、探索/symlink、ignored scope、output schema、package/lock/CI、runtime/API/web/DB/SSOTは変更しない。
  - implementation: 5 extensionだけを既存text allow-listへ追加。synthetic fixtureでshell generic assignmentとprivate-key headerの検出、relative path/line/type、raw value/body非echo、same-line allow marker、clean shell/certificate/public-key境界を固定し、既存`.env`/`.sql`挙動を維持。
  - acceptance: 新5 extensionの既存pattern対象はFAILし、raw synthetic secretを出力しない。allow markerと現行false-positive境界はPASS。実credential/private keyはfixture、ログ、成果物へ含めない。focused/full gates、security/privacy/tooling/operations/medical reviewとindependent verification後にFINALIZEDとする。
  - review_results: mapper HIGH/HIGH、planner再裁定APPROVED_WITH_PINS。security/privacy/tooling/operations/medical integrated domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: node syntax、script harness、live secret gate、API264 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff全PASS。
  - rollback: exact5 commitをrevertし、extension allow-listとsynthetic regressionだけを元へ戻す。credential rotationやruntime/data rollbackは不要。
  - landing_record: implementation commit `6d730e8` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、domain/independent reviewとfull gates PASS、既存detector semanticsを変えずcommon credential/shell text filesのCI blind spotを解消。

- [x] WP-4132 make boundary protected scope fail closed(MEDIUM architecture/tooling) — FINALIZED
  - 発見根拠: `scripts/check-boundaries.mjs` はstat failure/missing `apps`・`packages`を空inventoryへ変換し、存在しないsupplied rootでexit0/`Boundary check passed.`をlive再現。import方向、cross-app、cycle、pure-core、duplicate registry ruleが全て未実行でもgreenになりうる。
  - scope: exact5 `scripts/check-boundaries.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。boundary rule/regex/message、workspace config、package/lock/CI、APPROVED SSOT、apps/packages source、API/web/DB/migrationは変更しない。
  - implementation: root/apps/packagesをreal non-symlink directoryとして先行検証し、各scopeのimmediate workspace directory・real readable/parseable package.json・source coverageを要求。nested symlink/special entry、traversal/read/JSON failureは固定非機密scope errorでfail closed。valid scopeだけを既存ruleへ進める。
  - acceptance: missing/file/empty/source-empty/symlink/missing-or-malformed manifestはFAIL/no PASS/path/content echo。clean fixtureとlive repoはPASS、既存violation evidence/rule semanticsは維持。focused/full gates、domain review、independent verification後にFINALIZED。
  - review_results: mapper CONCUR、planner APPROVED_WITH_PINS、integrated domain review APPROVED。independent verifier initial MEDIUM ignored-name regular-file depth gapをrecursive validation+2 fixturesで修正後、re-verification APPROVED、remaining findingsなし、human gate不要。
  - validation_results: node syntax、script harness、live boundaries、API264 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/SSOT173/secrets/deps high0 critical0/SBOM231/diff全PASS。
  - rollback: exact5 commit revert。runtime/data migrationやexternal rollbackは不要。
  - landing_record: implementation commit `b4de089` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、post-fix full gates、domain review、independent re-verification PASS。既存boundary policyを変えず無検査PASSをfail closed化。

- [x] WP-4133 make migration loader protected scope fail closed(MEDIUM data integrity/operations) — FINALIZED
  - 発見根拠: empty migration directoryが`[]`となりreconciliationで`0/0 up_to_date`へ到達でき、valid-name symlinkは保護directory外SQLをread/checksum対象にできた。現tracked 4 migrationsはregular filesでlive悪性artifactなし。
  - scope: exact5 `apps/api/src/db/migrations.ts`, `apps/api/src/db/migrations.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runner/state/CLI、migration SQL/history/schema、DB操作、SSOT、package/lock/CI、API/web/contractsは不変。
  - implementation: migrations directoryをreal non-symlink directoryとして検証し、既存filename分類後にvalid/ignored entryをreal regular fileへ限定、valid inventory >=1を要求。scope/readdir/read failureは固定非機密error。既存UTF-8/checksum/sort/duplicate/default-directory semanticsは維持。
  - acceptance: missing/file/symlink/empty/ignored-only、valid-name/ignored-name symlink、valid-name directoryはFAILし、path/SQL marker非echo。regular filesとdefault live fourは不変。focused/full/domain/independent verification後にFINALIZED。
  - review_results: mapper推奨、planner再裁定APPROVED_WITH_PINS、integrated domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: focused migration loader 10、API267 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - rollback: exact5 revert。DB/data/artifact migration不要。
  - landing_record: implementation commit `89a2d03` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。DB操作なしでempty inventoryとscope外symlink SQL ingestionをfail closed化。

- [x] WP-4134 hide raw migration state from default Error enumeration(MEDIUM operations/security) — FINALIZED
  - 発見根拠: `MigrationStateError`のconstructor parameter property `result`がenumerableで、escaped one-line message後にdefault Node Error inspectionがDB由来version/nameをraw再表示し、WP-4129のdiagnostic escape境界を迂回できた。
  - scope: exact5 `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。logger/formatter/result union/reconciliation、SQL/schema/history/DB、SSOT/package/lock/CIは不変。
  - implementation: public typed `.result`とinput identityを維持し、non-enumerable/non-writable/non-configurable own propertyとして定義。name/message/stack/throw/client lifecycleは不変。
  - acceptance: descriptor exact、Object.keys/spread/JSON/default inspectにraw result fieldなし、escaped one-line message維持、既存initial/final rejection不変。focused/full/domain/independent後FINALIZED。
  - review_results: mapper推奨、planner再裁定APPROVED_WITH_PINS、integrated domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: initial test expectation 1件をmessageとraw fieldの境界に修正後、focused runner12、API268 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - rollback: exact5 revert。DB/data rollback不要。
  - landing_record: implementation commit `59908d7` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。programmatic result accessを保ちdefault Error surfaceのraw再表示を解消。

- [x] WP-4135 quote DB-ahead extra versions in diagnostics(LOW operations/security) — FINALIZED
  - 発見根拠: prefix-compatible DB-aheadは許可されたsuccess stateだが、DB由来extra versionsだけが既存one-line quote helperを迂回してraw joinされ、LF/U+2028を含む成功診断を複数行化できた。
  - scope: exact5 `apps/api/src/db/migration-state.ts`, `apps/api/src/db/migration-state.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runner/logger/CLI/loader/SQL/schema/history/DB/SSOT/package/lock/CIは不変。
  - implementation: db_ahead branchのみ各extra versionを既存quote helperへ通して固定`, `結合。raw result/order/count、reconcile precedence、db_ahead acceptanceは維持。
  - acceptance: normal/multiple/control/quote/backslash/U+0085/U+2028/U+2029をexact escaped outputで固定し、raw array/order不変。focused/full/domain/independent後FINALIZED。
  - review_results: mapper推奨、planner APPROVED_WITH_PINS、integrated domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: focused state15、API269 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - rollback: exact5 revert。DB/data rollback不要。
  - landing_record: implementation commit `5709f3b` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。DB-ahead success semantics不変で診断一行境界を維持。

- [x] WP-4136 escape Unicode separators in invalid migration filenames(LOW operations/security) — FINALIZED
  - 発見根拠: invalid migration entry errorの`JSON.stringify(filename)`はC0/quoteをescapeするがU+0085/U+2028/U+2029をliteral保持し、fail-closed errorのline-oriented診断境界を破れた。live tracked fourはvalidで悪性artifactなし。
  - scope: exact5 `apps/api/src/db/migrations.ts`, `apps/api/src/db/migrations.test.ts`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。grammar/ignored set/classification、runner/state/logger/CLI、SQL/schema/history/DB/SSOT/package/lock/CIは不変。
  - implementation: local filename formatterでJSON quote後に3 separatorだけをlowercase `\\uXXXX`へ置換。actionable filename evidenceと既存precedenceを維持。
  - acceptance: synthetic invalid filenameのexact一行escape、physical control/separator/path/content非露出、既存loader/scope/checksum/sort/default-four不変。focused/full/domain/independent後FINALIZED。
  - review_results: mapper推奨、planner APPROVED_WITH_PINS。domain initial LOW physical Unicode separator test-source findingをruntime-equivalent ASCII sourceへ修正し、re-reviewとindependent verifier APPROVED、remaining findingsなし、human gate不要。
  - validation_results: post-fix migrations11、physical separator 0/ASCII source、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
  - rollback: exact5 revert。DB/data rollback不要。
  - landing_record: implementation commit `66c6eb2` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、post-fix full gates、domain re-review/independent verification PASS。loader semantics不変でinvalid filename診断を一行化。

- [x] WP-4137 make secret scan protected scope fail closed(MEDIUM security/tooling) — FINALIZED
  - 発見根拠: existing empty cwdでsecret scannerがeligible file 0件のままexit0/`Secret scan passed.`をlive再現。root/symlink/special/nonempty scope validationがなく、credential prevention未実行でもgreenになり得た。current secret incidentは未検出。
  - scope: exact5 `scripts/check-secrets.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。patterns/extensions/allow/ignored sets/finding schema、package/lock/CI、apps/packages/docs/SSOT/DBは不変。
  - implementation: real non-symlink root、visited entry kind、ignored-name correct kind、eligible text >=1、traversal/read failureを固定非機密errorでfail closed。symlink target未読、既存finding semantics維持。
  - acceptance: empty/noneligible-only/eligible symlink/ignored-name wrong-kindはFAIL/no PASS/path/content echo。既存allow/leak/SQL/shell/key/clean fixturesとlive scan維持。focused/full/domain/independent後FINALIZED。
  - review_results: mapper direct repro、planner re-adjudication APPROVED_WITH_PINS、integrated domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: self-scan fixture literal修正後、script harness/live secrets/node syntax、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff全PASS。
  - rollback: exact5 revert。実secret発見時のremoval/rotationは別human gate。
  - landing_record: implementation commit `8c9509e` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。secret detection semantics不変でzero-input false greenを解消。

- [x] WP-4138 make SSOT index protected scope fail closed(MEDIUM ssot/tooling) — FINALIZED
  - 発見根拠: 旧checkerはroot/docs/indexの実体種別を検証せず、docs配下のsymlink/special entryを無視または追跡でき、in-scope SSOT文書0件・index row 0件でもsemantic violation 0としてPASSし得た。live正規scopeは173文書で整合済み。
  - scope: exact5 `scripts/check-ssot-index.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。`docs/**`本文/index/OpenAPI、既存frontmatter/index semantic rules、package/lock/CI、apps/packages/DBは不変。
  - implementation: real non-symlink root/docs/index、docs全treeのentry kind、in-scope non-index markdown >=1、traversal/read failureを既存semantic検査前に固定非機密errorでfail closed。parsed index row >=1はwould-be PASS直前に強制し、zero/malformed rowの既存semantic診断を維持。regular non-markdownは許可し未読、content exclusionは維持するがexcluded subtreeもkind検査する。
  - acceptance: missing/file/symlink root/docs/index、index-only/excluded-only、nested file/directory symlinkをFAIL/no PASS/path/target/content echoで固定。regular non-markdown、既存semantic fixtures、live 173件は維持。focused/full/domain/independent後FINALIZED。
  - review_results: mapperとplanner APPROVED_WITH_PINS。domain initial LOW semantic diagnostic precedence findingとre-review LOW ledger wording findingを修正し、final re-review APPROVED。independent verifier APPROVED、remaining findingsなし、human gate不要。
  - validation_results: post-fix node syntax、script harness、live SSOT index173、live secrets、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/deps high0 critical0/SBOM231/diff全PASS。
  - rollback: exact5 revert。SSOT本文/index/data rollback不要。
  - landing_record: implementation commit `98e51e0` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、post-fix full gates、domain final re-review/independent verification PASS。SSOT本文/index/authority不変でinvalid/empty protected scopeのfalse greenを解消。

- [x] WP-4139 make OpenAPI generation publication atomic(MEDIUM file-integrity/tooling) — FINALIZED
  - 発見根拠: `generate-openapi --output <symlink>`がfinal symlinkを追跡し、synthetic external target sentinelを生成YAMLで上書きすることをtemp fixtureで再現。tracked artifactや実外部fileの被害は確認していない。
  - scope: exact5 `scripts/generate-openapi.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。checker/renderer、`docs/**`/OpenAPI artifact、contracts/apps/packages、package/lock/CI/DBは不変。
  - implementation: renderer完了後、output parentを既存通り作成し、random sibling tempへexclusive `wx`/non-executable modeで全量write後atomic rename。final outputを直接openせず、failureはowned tempをbest-effort cleanupして固定非機密error。
  - acceptance: absent nested/regular existing outputはexact generated bytesのregular file、drift checker PASS。direct output symlinkはregular fileへ置換しtarget bytes不変。directory publication failureはtarget内容保持、固定error/no success/path/content echo/temp residue。live artifact未書換。focused/full/domain/independent後FINALIZED。
  - review_results: mapperとplanner final re-adjudication APPROVED_WITH_PINS。integrated security/API-contract/operations/tooling/privacy/medical domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: generator/harness syntax、script harness、live OpenAPI、SSOT173、secrets、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、calculation-purity/boundaries/deps high0 critical0/SBOM231/diff全PASS。renderer/checker/tracked artifact差分なし。
  - rollback: exact5 revert。artifact/contract/data rollback不要。
  - landing_record: implementation commit `6871010` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。generated bytes/contract不変でfinal symlink target上書きをatomic directory-entry replacementへ置換。

- [x] WP-4140 make OpenAPI drift artifact target fail closed(MEDIUM api-contract/tooling) — FINALIZED
  - 発見根拠: `check-openapi`がfinal artifact pathを直接`readFile`し、byte-identicalな外部targetへのsymlinkをexit0/PASSとしてtemp fixtureで再現。現tracked artifactはregular fileでdriftなし。
  - scope: exact5 `scripts/check-openapi.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。generator/renderer、artifact/docs/contracts/apps/packages/package/lock/CI/DBは不変。
  - implementation: lstat分類後、`O_RDONLY|O_NOFOLLOW|O_NONBLOCK`で一度だけopenし、同一handleをstat→regular確認→UTF-8 read→close。flags unavailableとscope/I/O failureは固定非機密blocker、unsafe fallbackなし。protected read後にrenderer/byte compareする。
  - acceptance: coherent regular custom/live defaultは既存PASS、stale regularは既存drift/regeneration guidance。missing/directory/coherent・marker・dangling symlink/FIFOはfixed/no PASS/no hang/path/target/content echo、target未読。focused/full/domain/independent後FINALIZED。
  - review_results: mapperとplanner APPROVED_WITH_PINS。integrated API-contract/security/operations/tooling/privacy/medical domain reviewとindependent verifier APPROVED、findingsなし、human gate不要。
  - validation_results: checker/harness syntax、script harness(FIFO nonhang)、live OpenAPI、SSOT173、secrets、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、calculation-purity/boundaries/deps high0 critical0/SBOM231/diff全PASS。generator/renderer/tracked artifact/docs差分なし。
  - rollback: exact5 revert。artifact/contract/data rollback不要。
  - landing_record: implementation commit `0030774` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。regular artifact bytes/semantics不変でsymlink/special targetのcontract-gate false greenを解消。

- [x] WP-4141 scan npm registry credentials in `.npmrc`(MEDIUM security/tooling) — FINALIZED
  - 発見根拠: HEADのsecret scannerはextension allow-list依存でexact basename `.npmrc`を読まず、generic assignmentもnpm固有の`_authToken` / `_auth` / `_password`を検出しない。npm公式仕様はこれらをregistry-scoped auth設定として定義し、`#` / `;` commentも認める。tracked/worktree `.npmrc`とcurrent incidentは未検出。
  - scope: exact5 `scripts/check-secrets.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/CI/SSOT、apps/packages、API/DB/runtime、user/global npm config、credential rotationは変更しない。
  - implementation: `.npmrc`をexact text basenameとしてscan対象化し、file-specific likely-secret patternsでscoped/unscoped active行と`#` / `;` commented行を検査する。findingは既存どおりrelative path/line/typeのみでraw valueを出さない。environment interpolation、placeholder/example/short値、near-miss、same-line allowは維持する。
  - acceptance: root/nested active/commented npm auth materialをsynthetic fixtureでFAILし、raw value/absolute path/target content非echo。clean standalone、environment placeholder、allow markerはPASS。symlinkは既存fixed scope errorでtarget未読。既存patterns/extensions/ignored scope/finding schema/zero-input fail-closed不変。full/domain/independent後にFINALIZED。
  - review_results: root read-only mappingとfull-stack alignment scanを完了。planner `APPROVED_WITH_PINS`を受け、commented credential gapを実装へ追加。dedicated scoutは範囲過大のため中断し成果未採用。integrated security/privacy/test domain reviewのinitial LOW newline-crossing findingをhorizontal-only whitespaceと先頭空行/standalone comment fixtureで修正し、final domain reviewとindependent verifierはいずれもAPPROVED、remaining findingsなし、human gate不要。
  - validation_results: post-fix checker/harness syntax、script harness、live secret gate、diff check、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/deps high0 critical0/SBOM231を含むfull regressionが全PASS。
  - rollback: exact5 revert。実credential発見時のrevoke/rotationは別human gateであり、code rollbackで代替しない。
  - landing_record: implementation commit `130aa26` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、domain/independent review PASS。`.npmrc`のactive/commented registry credential materialをmetadata-only findingで検出し、placeholder/allow/non-echo/symlink fail-closed境界を維持。

- [x] WP-4142 converge dev tenant helper ownership(LOW frontend/security-maintenance) — FINALIZED
  - 発見根拠: `devTenantHeaders`の正本は`apps/web/app/dev-tenant.ts`へ分離済みだが、reception/audit/testの3 consumerがpatient-searchのcompatibility re-exportを経由し、helper ownershipを逆転させている。正本commentもAPIの現行deny-by-default 4条件ではなく旧production-only説明を残す。既存WP重複なし。
  - scope: exact8 `apps/web/app/dev-tenant.ts`, `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `apps/web/app/reception-dashboard.tsx`, `apps/web/app/admin/audit-log-view.tsx`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/config/contracts/SSOT/DB/package/lock、DOM/copy/CSS/ARIA/network semanticsは不変。
  - implementation: 3 consumerを正本へdirect importし、patient-searchの内部compatibility export surfaceを意図的に縮小する。commentはWebのdevelopment-only送信と、APIのexplicit opt-in + development/test + in-memory + no DATABASE_URL受理境界を分離して記録する。helper/header/scope/config/authorization実装は変更しない。
  - acceptance: `devTenantHeaders` / `PATIENT_SEARCH_DEV_SCOPES`定義は正本のみ、patient-search経由consumer 0件、既存header値/environment gate/scope順序/fetch/UI不変。focused web tests/typecheck/build、boundaries/SSOT/secrets/diff、full workspace regression、domain/independent review後にFINALIZED。
  - review_results: ALIGN-01発見後、MAP-02とPLAN-02はいずれも`APPROVED_WITH_PINS`。integrated frontend/security/privacy domain reviewのinitial LOW exact-`true` wording findingを修正し、final domain reviewとindependent verifierはいずれもAPPROVED、remaining findingsなし。内部module export縮小を明記し、Web送信条件とAPI受理条件を混同せず、exact8外へ拡張していない。human gate不要。
  - validation_results: final exact8でAPI config19、post-fix focused Web162、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/script harness/diff全PASS。patient-search経由helper consumer 0件。DOM/copy/fetch/header/scope挙動不変、bundle topologyは不要edge削除へ収束。
  - rollback: exact8 revert。migration/data/config rollback不要。
  - landing_record: implementation commit `4b2c013` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact8、full gates、final domain/independent review PASS。helper ownershipを正本へ収束し、private compatibility exportと不要module edgeを除去。runtime/UI/API semantics不変。

- [x] WP-4143 connect repository script regression harness to CI(MEDIUM CI-control integrity) — FINALIZED / REMOTE_CI_PASS
  - 発見根拠: root `test:scripts`はboundary/secret/deps/SBOM/SSOT/OpenAPI等のsynthetic edge-case回帰を固定するが、CIはworkspace testsとlive gatesだけを実行し、harnessを0回しか呼ばない。live treeがcleanならcheckerのfixture-only退行を見逃すfalse-green gapがある。WP-4011はharness作成のみでCI接続は未追跡、既存WP重複なし。
  - scope: exact4 `.github/workflows/ci.yml`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/scripts/SSOT/apps/packages、trigger/job/service/timeout/action pin/Node/pnpm/PostgreSQL/env/既存stepは変更しない。
  - implementation: existing `Test`直後・`Build`直前に`Test repository scripts` / `pnpm test:scripts`をexact 1件追加する。DB env、permissions、conditionは付けない。
  - acceptance: step name/run exact 1件、`Test → Test repository scripts → Build`順序、YAML parse/actionlint、local harness/full gates/diff PASS、exact4のみ。draft PR #1 run `29499861743` job `87625797181`で`Test repository scripts`がPASSし、前後のTest/Buildを含む全CI stepがgreenとなった。
  - review_results: MAP-03 / PLAN-03 `APPROVED_WITH_PINS`。final CI/security/tooling domain reviewとindependent verifierはいずれもAPPROVED、remaining findingsなし。実装risk LOW、human gate不要。
  - validation_results: YAML structure/count/order assertion、Ruby YAML parse、actionlint 1.7.12、test:scripts、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/diff全PASS。remote run `29499861743`でもscript harness、workspace test/build、全live gateをPASS。
  - rollback: exact4 revert。DB/data/config/external rollback不要。
  - landing_record: implementation commit `10b92c5`はsafe feature branchへpush済み。remote CI proofはdraft PR #1 run `29499861743`で取得しFINALIZED。

- [x] WP-4144 make calculation purity scan syntax-aware(MEDIUM calculation-safety/tooling) — FINALIZED
  - 発見根拠: `scripts/check-calculation-purity.mjs`の手書きcomment stripper + regexはlexical contextを識別しない。`const endpoint = "https://example.invalid"; Date.now();`を見逃し、文字列`"Date.now()"`を違反扱いするfalse negative / false positiveをlive関数で再現。現production違反はなく、CAL-010 gate integrityの将来退行risk。
  - scope: exact7 `scripts/check-calculation-purity.mjs`, `scripts/check-scripts.mjs`, `package.json`, `pnpm-lock.yaml`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。calculation source/CAL-010 SSOT/CI/apps/API/DB/runtimeは変更しない。
  - implementation: root direct devDependencyのTypeScript syntax-only ASTを使い、8拡張子へexplicit ScriptKindを割当。既存5 familyだけ(Date.now call/new Date/Math.random call/bare parseFloat call/Math.round call)を検出し、optional/static-computed/parenthesized同等形は含める。symbol resolutionは行わずshadowed identifierもsyntacticに検出し、dynamic computed/alias/dataflow/Number.parseFloat/他Math familyは拡張しない。parse diagnosticsは既存固定非echo scope errorへfail-closed。
  - acceptance: comments/string/template raw/regex/JSX text/test-specはclean、template/JSX expressionとURL/`/*`文字列後の同一行call、全8拡張子、複数違反/line、optional/static-computed/shadowedを検出。relative path/1-based line/name/reason/order、non-test protected scope、symlink/empty/unreadable/malformed fail-closedを維持。focused/full/domain/independent review後にFINALIZED。
  - review_results: MAP-04とPLAN-04 / PLAN-04Bはいずれも`APPROVED_WITH_PINS`。domain initial LOWのblock-comment/alias/finding-order fixture不足とindependent initial MEDIUMのqualified global receiver見逃しを修正。final calculation/medical/privacy/security/tooling domain reviewとindependent verifierはいずれもAPPROVED、remaining findingsなし、human gate不要。
  - validation_results: frozen install、checker/harness syntax、expanded script harness、live purity、calculation87、API270 + PostgreSQL14 expected skips、web335、audit183、workspace typecheck/test/build、OpenAPI/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/diff/clean全PASS。root lock importer以外のresolution churnなし。
  - rollback: exact7 revert。calculation/data/SSOT rollback不要。
  - landing_record: implementation commit `014b3e6` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact7、full gates、final domain/independent review PASS。TypeScript ASTでlexical false positive/negativeとqualified receiver gapを解消し、既存5 familyと意図的なsyntax-only境界をfixtureで固定。

- [x] WP-4145 make workspace boundary scan syntax-aware(MEDIUM architecture/security-control integrity) — FINALIZED
  - 発見根拠: `scripts/check-boundaries.mjs`のregex extractorはcomment/string内の`import` / `require('@yrese/api')`を依存として誤検知し、no-substitution templateのdynamic importを見逃す。duplicate const regexもcomment/stringを違反扱いし、`const SYSTEM_MODES = <const>[...]`を見逃すfalse positive / false negativeをin-memory再現。live source違反はなく、WP-6002/6003はquoted AWS import familyのenforcement/fixtureで本lexical gapとは非重複。
  - scope: exact5 `scripts/check-boundaries.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。WP-4144のroot TypeScript direct dependencyを再利用しpackage/lock/CI/SSOT/apps/packages/API/DB/runtimeは変更しない。
  - implementation: 8拡張子へexplicit ScriptKindを割当てsyntax-only ASTを一度parse/cache。static/type/side-effect import、export-from、dynamic/import-type、TS import-equals、bare/module.requireのstatic StringLiteral/NoSubstitutionTemplateLiteralだけを既存category順で抽出する。interpolated/dynamic/alias/dataflow/任意object methodは除外。duplicate constはactual const identifier + initializerを要求し、registry ruleはinitializer subtreeの`as const` / `<const>`、cursor length ruleは任意initializerを検出する。既存graph/rule/message/owner/test除外/dedupe/orderは不変、parse diagnosticsは固定非echo scope errorへfail-closed。
  - acceptance: comment/string/template raw/regex/JSX textの疑似import/constはclean。static/side-effect/export/dynamic options/no-sub template/import-type/import-equals/bare+module requireと全8拡張子を検出し、interpolated import/alias/任意object methodは除外。`<const>`/type annotation/parentheses/satisfiesは検出し、let/var/property/destructure/declare-only/const-assertionなしを除外。既存WP-6002/6003、lineなしmessage/count/order、malformed fixed non-echo、live boundaryを固定。full/domain/independent review後にFINALIZED。
  - review_results: MAP-05とPLAN-05はいずれも`APPROVED_WITH_PINS`、risk R2/MEDIUM、human gate不要。final architecture/security/tooling domain reviewとindependent verifierはいずれもAPPROVED、remaining findingsなし。exact5、既存rule/message/category/order/dedupe、owner/test除外、package/lock不変を確認。
  - validation_results: frozen install、checker/harness syntax、expanded script harness、live boundary、API270 + PostgreSQL14 expected skips、web335、audit183、calculation87、workspace typecheck/test/build、OpenAPI/calculation purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/diff/clean全PASS。
  - rollback: exact5 revert。dependency/SSOT/data rollback不要。
  - landing_record: implementation commit `a5137f1` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact5、full gates、final domain/independent review PASS。TypeScript ASTでboundary importとduplicate constのlexical false positive/negativeを解消し、既存graph/rules/line-free messages/order/dedupeと意図的なsyntax-only境界をfixtureで固定。

- [x] WP-4146 validate workspace manifest semantics(MEDIUM architecture/tooling-control integrity) — FINALIZED / INDEPENDENT_PASS
  - 発見根拠: boundary checkerはworkspace manifestをJSON parseするだけで、missing/blank/duplicate `name`をskip/overwriteし、null/array dependency sectionやblank/non-string specifierをgraph外として扱い得た。現行10 manifestはvalidでlive違反なし。
  - scope: exact5 `scripts/check-boundaries.mjs`, `scripts/check-scripts.mjs`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package manifests/lock/CI/SSOT/apps/packages/API/DB/runtimeは変更しない。
  - implementation: manifest root/name/dependency section/key/specifierを固定非echo scope errorでfail-closed検証し、workspace名重複を拒否する。validated manifest snapshotをapp identity mapとcycle graphへ再利用し、manifest再readを除去。workspace aliasの正当形を誤拒否しないためdependency target existenceはscope外。
  - acceptance: missing/array/blank/padded/duplicate name、null/array section、blank/padded key/specifier、non-string specifierをfixed error only/no PASS/path/content echoで拒否。live boundary、既存graph/import/duplicate-const rule/message/orderを維持する。
  - verification: rootのcold-path再点検で単純workspace target一致案をalias false-positive riskとして撤回。focused boundary/script harness、workspace typecheck/test/build、API270 + PostgreSQL14 expected skips、web336、audit183、calculation87、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diffはPASS。tracked snapshot secret scanはPASS。ignored user-owned `.codegraph` symlinkを含むlive worktree secret scanは既存scope failureであり未変更。独立初回reviewで不足を指摘されたpadded dependency key、primitive dependency section、合法workspace aliasのpermanent fixtureを`f1b3ffa`で追加し、checker/runtime/package/lock/CI/SSOTを変更せず再検証した。
  - review_status: read-only independent verifierはinitial `PASS_WITH_FINDINGS`、fixture follow-up後はexact1 diff、固定非echo failure、合法alias positive、既存regressionを`PASS`。human/domain/DB/medical/privacy semantic gateは不要。
  - rollback: implementation commit `8dec253` と後続ledger commitをrevertする。manifest/data/SSOT rollback不要。
  - landing_record: implementation commit `8dec253` とfixture follow-up `f1b3ffa`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。full local regressionとindependent verification PASS。

- [x] WP-4147 restore dependency audit with pnpm 11(MEDIUM supply-chain/tooling) — FINALIZED / INDEPENDENT_PASS
  - 発見根拠: full gate中にrepo pin pnpm 10.33.2とlatest-10 10.34.5がnpm registryのretired audit endpointsからHTTP 410を受け、`check:deps`がmetadata欠落を正しくfail-closedにした。pnpm 11.13.1は現行audit reportを取得した。
  - scope: exact5 `package.json`, `pnpm-workspace.yaml`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。`pnpm-lock.yaml`、dependency version/resolution、apps/packages/scripts/CI/SSOT/API/DB/runtimeは変更しない。
  - implementation: packageManager pinを11.13.1へ更新し、既存lockにあるbuild-script dependencyの`esbuild`と`sharp`だけを`allowBuilds: true`で明示する。任意build script許可やaudit skip/fallback-successは導入しない。
  - verification: isolated worktreeのfrozen installはlockfile無変更、esbuild/sharp build完了。workspace typecheck/test/build、API270 + PostgreSQL14 expected skips、web335、audit183、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/script harness/diffをPASS。tracked snapshot secret scanはPASS。root再点検でlatest-10も410、11.13.1だけ現行metadata取得を再現。
  - review_status: read-only independent verifierはexact2 diff、frozen install lock差分0、allowBuildsが既存`esbuild`/`sharp`だけ、audit high0/critical0、SBOM231、任意script許可/audit弱化なしを`PASS`。remote CI実行はWP-4161の別gateとして未証明を維持する。
  - rollback: implementation commit `3d731e3` と後続ledger commitをrevertし、pnpm 10 audit endpoint復旧または別のfail-closed audit経路を用意する。lock/data rollback不要。
  - landing_record: implementation commit `3d731e3` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact2 implementation、frozen-install/full-gate、independent verification PASS。

- [x] WP-4148 refresh full-stack alignment and final-demo evidence(LOW documentation/resume integrity) — FINALIZED / INDEPENDENT_PASS
  - 発見根拠: objective-required `FULLSTACK_ALIGNMENT.md` / `FINAL_DEMO.md`が存在せず、`CODE_MAP.md` / `VERIFICATION.md`は2026-07-11のpnpm 10・API161/Web99証跡のままcurrent treeとdriftしていた。
  - scope: original exact7に`ops/refactor/EVIDENCE.md`を追加したreconciliation exact8 `ops/refactor/CODE_MAP.md`, `ops/refactor/EVIDENCE.md`, `ops/refactor/FULLSTACK_ALIGNMENT.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。code/contracts/OpenAPI/SSOT/package/lock/CI/DB/runtimeは変更しない。
  - implementation: API 7 surfaceとreachable screenをlive sourceから分類。患者search/get、受付queue、audit eventsはALIGNED、受付createはWeb/API wiring済みだがWP-4050 atomicityとWP-4151c ambiguous retry未承認のため`PARTIAL / HUMAN_GATED`へ補正。healthはoperational one-sided、whoamiはreal-auth bootstrap判断待ち、他画面はunlock gate付きintentional placeholderとして記録。final demoは`DEMO_REQUIRED`を維持し、local expected skips、remote PostgreSQL zero-skip CI、production未証明を分離した。
  - verification: live GitHub Actions run `29499861743` / job `87625797181` / head `1d2a2da`を再取得し、repository7、audit5、migration2、API286、Web337、全step greenを確認。local APIはcurrent HEADで272 pass + PostgreSQL14 expected skipsを再実測。SSOT index173、boundaries、diff check PASS。
  - review_status: CI/branch/runtime mapper、medical/security/data-integrity reviewer、UI/browser evidence reviewerの3系統がexact-five diffを独立再読して最終PASS。初回指摘のlocal API count 270→272と暗黙in-memory default表現を修正後に再検証し、WP-4050/WP-4151c、production/auth/tenant、browser/accessibility、`DEMO_REQUIRED`を維持した。
  - rollback: original implementation `2bea7a4`とreconciliation `bed34ba`、後続ledger commitをrevertする。code/data rollback不要。
  - landing_record: original `2bea7a4`は`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。reconciliation `bed34ba`はlocal commitのみで、明示的なuser instructionなしにpushしない。

- [x] WP-4149 bind reception registration to selected Patient Context(HIGH patient safety) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE
  - 発見根拠: 受付登録フォームが患者検索で確立したglobal Patient Contextとは別にfreeform Patient ID入力を受け付け、表示中患者と登録対象の不一致・転記誤りを起こせるwrong-patient surfaceになっていた。
  - scope: exact9 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `apps/web/app/globals.css`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`, `ops/refactor/FULLSTACK_ALIGNMENT.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`。API/contracts/DB/SSOT/package/lock/CIは変更しない。
  - implementation: freeform Patient ID入力を廃止し、`PatientContextProvider`で選択済みの患者だけを受付登録対象にする。未選択時は登録をfail-closedで無効化し患者検索への導線を表示。選択変更時は旧結果を消去し、POST進行中の患者変更は成功・失敗ともsubmitted IDを露出しない固定警告へ分離してblind retryを防ぐ。
  - verification: reception focused 70、Web 336、API270 + PostgreSQL14 expected skips、audit183、calculation87、workspace typecheck/test/build、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/script harness/diffをPASS。tracked snapshot secret scan PASS、live scanは既知のuser-owned ignored `.codegraph` symlinkでfail-closed。synthetic dev browserで患者検索→選択→受付登録→queue反映→患者clear、375/768/1280のpage overflowなし、console/errorなしを確認。
  - review_status: read-only independent agent-browserはsynthetic 2件検索、pointer選択、global context/受付対象identity一致、freeform patient ID/inputなし、native double-clickでPOST 1回/authoritative queue GET 1回、WAITING反映、context clear後disabled/result clear、375/768/1280 overflow 0、console/page errors 0を`PASS_WITH_NOTE`。local APIが速く瞬間pending表示とin-flight患者切替raceはbrowser未証明、static helper testsだけの証拠とする。ambiguous retryはWP-4151c human gateを維持する。
  - rollback: implementation commitと後続ledger commitをrevertする。API/DB/data migration rollback不要。
  - landing_record: implementation commit `7ba1003` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact9 implementation/docs、validation、independent browser verification `PASS_WITH_NOTE`。

- [x] WP-4150 keep patient selection action reachable on narrow tables(P2 responsive/patient safety) — FINALIZED / INDEPENDENT_PASS
  - 発見根拠: WP-4149 browser verificationの375px viewportで、患者検索結果の「この患者を選択」が初期表示範囲外となり、各行で横スクロールしなければ業務対象を確定できない既知R-RESPONSIVE gapを再現した。
  - scope: exact9 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`, `apps/web/app/globals.css`, `docs/ui-ux-refresh/06-ui-ux-audit.md`, `docs/ui-ux-refresh/11-remaining-risks.md`, `docs/ui-ux-refresh/PROGRESS.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/DB/SSOT/package/lock/CIは変更しない。
  - implementation: 患者識別列を縮小・非表示にせず既存横スクロールを維持し、`onSelect`がある場合だけ操作header/cellへ専用classを付けて右端へsticky固定。背景・境界・z-index・最小幅を明示し、共通tableやread-only結果は変更しない。
  - verification: patient-search focused 43、Web336、Web typecheck/build、diff PASS。read-only independent agent-browser verifierは375pxでpage overflow 0、table client width 343/content width 535/max scroll 192、scrollLeft=0/192双方で2つの選択button完全可視、3px focus ring、pointer選択後のカナ・氏名・生年月日一致、768/1280 page overflow 0、console/page errors 0を確認した。
  - review_status: independent browser verdict `PASS`。Enterはautomation CLIの既知input制約で状態変化を証明できず、native button markupにkeyboard抑止はないがkeyboard activation claimには含めない。table全体の列優先/カード化と広域accessibilityは既存P2/demo gateとして残す。
  - rollback: implementation commitと後続ledger commitをrevertする。API/DB/data rollback不要。
  - landing_record: implementation commit `87b5c41` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact9 implementation/docs、validation、independent browser verification PASS。

- [x] WP-4151 establish durable evidence index and extend audit demo proof(LOW evidence/resume integrity) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE
  - 発見根拠: objective-required `ops/refactor/EVIDENCE.md`が存在せず、automated validation・alignment・browser demo・landing proofの所在が複数文書へ分散していた。監査success browser journeyも`FINAL_DEMO.md`へ未記録だった。
  - scope: exact6 `ops/refactor/EVIDENCE.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runtime/code/contracts/DB/SSOT/package/lock/CIは変更しない。
  - implementation: `EVIDENCE.md`を重複logではなくauthoritative artifactへの索引として追加し、landed commit、synthetic browser success、未取得証拠、tool failure、evidence rulesを分離。synthetic reception後のaudit view/hash-chain正常表示をdemo記録へ追加する。
  - verification: live browserでpatient→reception→adminを実行し`reception.created`/`audit.viewed`/normal chainを確認。2026-07-16 follow-upではdev Webの正式proxy先へsynthetic exact HTTP 500を1回だけ返し、検証済み2行/normal chainの保持、stale qualifier、fixed error、retry、raw sentinel非表示をDOM captureし、次の200で1行へ置換・error clear・idle復帰・request count 2→3を確認。agent-browser native ref/semantic click/Enterはrequestを発火せず、retryはpage-context DOM clickで検証したためkeyboard/native input証拠には数えない。focused component 50/50 PASS。
  - review_status: root cold-path evidence review済み。read-only independent verifierも別sessionでexact 500時のverified row/chain保持、fixed error/stale/retry、raw非表示、retry request増加、error clear、console/page error空、focused 50/50をPASS。独立runはshared mockが既に1行replacement状態だったため2行→1行の値だけはroot capture依存。native input/production/DB/auth等の未証明を分離し、DEMO_REQUIRED/human gateを解除しない。
  - rollback: docs-only implementation commitと後続ledger commitをrevertする。runtime/data rollback不要。
  - landing_record: implementation commit `8cd8d18` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact6 evidence index/demo records landed。initial independent-pending stateは下記follow-upで解消済み。
  - followup_landing: audit refresh exact-500 retention/recovery evidenceとindependent PASS_WITH_NOTEは`31a60f7`で同branchへpush済み。runtime/code/contracts/DB/SSOT変更なし。2行→1行値はroot capture、独立runは1行保持/recovery、native inputは未証明という境界を維持。

- [x] WP-4151a demonstrate reception queue refresh failure retention and retry(LOW demo integrity) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE
  - scope: exact6 `ops/refactor/EVIDENCE.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runtime/code/contracts/API/DB/SSOT/package/lock/CIは変更しない。
  - evidence: synthetic dev Webの正式proxy先でqueue 200(retained row)→native「表示」click→exact HTTP 500(raw sentinel body)→同じnative「表示」click→200(replacement row)を実行。失敗時はretained row/date/last-updatedを保持し、fixed error/stale qualifier/next actionを表示、raw sentinelとreplacement false-successを非表示。復旧時はold rowをreplacementへ置換しerror/staleをclear。request count 1→2→3、console/page errors空、focused `reception-dashboard.test.tsx` 70/70 PASS。
  - stop/review: read-only independent verifierもfresh sessionでsame row/date/timestamp保持、exact 500固定copy、raw/errorCode非表示、native retry request増加、error clear、console/page error空、70/70をPASS。shared mockがreplacement状態だったためSYN-001→SYN-002とabsolute 1→2→3はroot capture依存。queue refreshだけの証拠で、受付登録POST failure/retry、production API/auth/DB、audit retry native inputを証明しない。docs exact6 landingまで完了扱いにしない。
  - landing_record: exact6 evidence docsは`e95328c`でsafe feature branchへpush済み。runtime/code/contracts/API/DB/SSOT変更なし。queue refresh sliceはLANDEDだがrepository-wide demoは`DEMO_REQUIRED`を維持。

- [x] WP-4151b demonstrate reception registration known-non-commit failure and retry(LOW demo integrity) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE
  - scope: exact6 `ops/refactor/EVIDENCE.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runtime/code/contracts/API/DB/SSOT/package/lock/CIは変更しない。
  - evidence: synthetic patientを検索・選択し、同じ患者contextからnative submitを2回実行。初回POSTは**サーバ非commitが既知のsynthetic exact HTTP 500**で、送信中は`登録中…`/disabled、失敗後はsuccessなし、queue再取得なし、患者context/受付対象保持、fixed error/next action、button再有効化を確認。raw sentinel/errorCode/stackは表示しない。2回目POSTは201/WAITINGとなり、success表示、authoritative queue再取得1回、対象行表示、error clear、console/page errors空を確認。POST count=2、queue GET count=2(initial+success)、両bodyのpatient一致、opaque idempotency keyは各36文字/nonblank/control-characterなし。focused Web 139/139 PASS。
  - evidence_boundary: PatientHeaderは既存契約どおり`data-patient-id`をDOM属性へ持つため、patient identifierのDOM不在は主張しない。これはfailure payload/raw error漏えいではないが、公開DOM属性の必要性は別privacy review対象とする。production API/auth/DB/audit、400/403/404/409、keyboard/focus、通信切断後のcommit有無不明ケースは未証明。
  - stop/review: 2回のidempotency keyは一致せず、現行`createReception()`は呼出しごとにfresh UUIDを生成する。したがって本証拠をambiguous network retryの安全性やduplicate preventionへ拡張してはならない。read-only independent verifierはbounded claim/code/contract/WP-4084/139 tests/diff/SSOT173/boundaryを`PASS_WITH_FINDINGS`。mock終了後のためbrowser absolute count/pending/raw抑止はroot capture依存。exact6 landingまで完了扱いにしない。
  - landing_record: exact6 evidence docsは`ff0e99e`でsafe feature branchへpush済み。runtime/code/contracts/API/DB/SSOT変更なし。known-non-commit retry sliceはLANDEDだが、WP-4151cとrepository-wide demoはblockedのまま。

- [ ] WP-4151c define reception-create idempotency-key lifecycle for ambiguous outcomes(HIGH patient/data integrity) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: `apps/web/app/reception-dashboard.tsx`はretryごとにfresh UUIDを生成し、受付contractはsame key + same patientだけをdedupeする。初回createがcommit済みだがresponseを失った場合、現行retryは別受付を生成しうる。WP-4084はambiguous-network retry key reuseを明示的にscope外としていた。
  - required_decision: attempt/session境界、同一key再利用期間、patient/date/prescription payload drift時の409/OperationOutcome相当、成功確認/失敗確定/取消後のkey rotation、Edge/offline復旧、監査・retention・UX copyをpatient-safety/data-integrity authorityが承認する。
  - acceptance: APPROVED contract/SSOTとrisk review後に、commit-before-response-loss、timeout、5xx、double-click、reload、patient change、stale retry、cross-tenant拒否をcontract/API/Web/browser testで固定する。human gate前はruntime変更を禁止し、WP-4151bのknown-non-commit synthetic proofを根拠に解除しない。

- [x] WP-4152 verify production Web build/start/static-route boundary(LOW demo/stability evidence) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL
  - 発見根拠: final demoはproduction-like API/Web startupを全体未検証としていたが、Web単体のbuild/start/static route/shutdownはDB/auth承認なしに実測可能だった。
  - scope: exact6 `ops/refactor/EVIDENCE.md`, `ops/refactor/FINAL_DEMO.md`, `ops/refactor/VERIFICATION.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。runtime/code/contracts/DB/SSOT/package/lock/CIは変更しない。
  - implementation/evidence: dev-format `.next`に対する`next start`拒否を確認後、`next build`で12 static pages生成、`next start` ready 237ms、production `/sync-status`の未接続≠同期済み表示、normal shutdownを確認。clinical rootはproduction API/auth未設定かつbrowser session停止のため成功証拠に含めない。
  - verification/review: independent verifierがfresh `next build` 12 static pages/6.10s、production server 127.0.0.1:31852 ready 270ms、`/sync-status` HTTP200/31.983ms/22,809 bytes、browser reload responseStart 37.3ms/DCL 133.8ms/load 202.2ms、console/page error 0、normal shutdown/port release、tracked diff 0をPASS_WITH_NOTE。current runtime target `87aa747`でもfresh Next15.5.20 buildは12 static pages、real19.98s、`/sync-status` 141B/First Load102kB。BUILD_ID `GMvkAu8EW7gWyinpQPEln`と3 route-artifact SHA-256をbuild直後/run1後/run2後に再照合し、再buildなしの同一artifactを同じ127.0.0.1:31852で2回起動した。run1はlistener PID35732、ready1796ms・HTTP200/80.717ms/23,036 bytes、run2はlistener PID40972、ready2.9s・HTTP200/297.738ms/23,036 bytes。各回でlistener ownershipをport/`ps`で確認し、accessibility-tree snapshot、backend未接続と未接続≠同期済みcopy、reload、console/page error 0を取得。captured PIDだけをTERMしてbounded wait内のexitとport 31852解放を確認し、production Web same-artifact restartを直接PASS。exact6は`git diff --check`、`pnpm check:ssot-index`（173 documents）、`pnpm test:scripts`、tracked HEAD+exact6 overlay secret scanがPASS。live `pnpm check:secrets`は既存user-owned `.codegraph` symlinkを含むprotected scopeでfail-closedし、port 31852 listener不在とexact6以外のtracked差分なしを再確認。dev-format `.next`拒否はhistorical root evidence依存で今回未反復。`通常稼働`はNORMAL固定の暫定表示でhealth detection成功証拠へ拡張しない。timingは観測値でSLOではない。production API startup/restart、auth/tenant、clinical/DB/deploy/release readiness、広範なaccessibility conformanceはDEMO_REQUIRED。PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT_GATEはP2 remediation後各5/5。docs evidence `38ef35b`とresume-safe closure target `09e058e`をpushし、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI run `29611193923` / job `87986014157`全step SUCCESS、first PUSH_GATE5/5を確認した。本exact4 finalization ledgerを含む最初のtracked-clean local HEADをfinalization targetとする。このcheckbox `[x]`とFINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS宣言は、finalization targetのexact4 stage確認、independent review PASS、remote/PR ancestry確認、conditional fast-forward push、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI terminal success、final PUSH_GATE5/5がすべて成立した場合だけ有効とする。成立前はFINALIZATION_PENDING、違反時は完了宣言を無効として修正gateへ戻る。最終PUSH_GATE成功後は追加ledger commitを要求せずfresh mappingへ進む。
  - rollback: WP-4152 current-head closureのdocs-only commit `38ef35b`、この条件文を含むclosure ledger commit、作成済みならfinite finalization ledger commitを新しい順にrevertする。既存`ac83520`/`1d67fb6`、runtime/data/package/lock/schemaのrollback不要。generated `.next`はcommit対象外。
  - landing_record: original evidence `ac83520`とindependent `PASS_WITH_NOTE` update `1d67fb6`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。

- [x] WP-4153 collect JP Core 1.2.0 package pre-lock evidence(LOW read-only supply-chain research) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL
  - 発見根拠: WP-0053bのlock前提であるofficial artifact fingerprint/license/dependency metadataがrepositoryに未記録で、公開ガイダンスとarchive package metadataのterminology package IDが一致しなかった。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/runtime/code/SSOT/CI/toolchainは変更しない。
  - evidence: official `package.tgz`をtemp取得しSHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`、2,391,515 bytes、ETag/Last-Modified、`jpfhir.jp.core#1.2.0`/FHIR4.0.1/dependencies/license metadataを確認。archiveは`jpfhir-terminology.r4`、rendered tableは`jpfhir-terminology`、archive `url`はpublisherの`file://` path、standalone license fileなし、QAにsuppressed/unpublished/history警告あり。
  - acceptance/review: 2026-07-18 independent retrievalでeffective URLは全てexact `https://jpfhir.jp`、redirectなし。artifactはSHA-256/2,391,515 bytes/ETag/Last-Modified、403 entries/17,549,408 uncompressed regular bytes、unsafe member 0、license-like standalone file 0、package identity/FHIR/canonical/dependency/license fieldを再現。rendered `jpfhir-terminology#1.4.0`とのhistorical discrepancy、QA errors0/warn0＋13 suppressed/unpublished/history gapも再現した。WP-4154をterminology artifact identity、WP-4158をrights provenanceのfollow-up authorityとして変更せず、legal clearanceは未成立のまま、lock/APPROVED/JP Core準拠/license grant/WP-0053b unblockを主張しない。PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION_GATEはP2 remediation後各5/5。exact4は`git diff --check`、SSOT index173、script regression harness、tracked HEAD+exact4 overlay secret scanがPASSし、repo内archive残存0。live secret scanは既存user-owned `.codegraph` symlinkを含むprotected scopeでfail-closed。COMMIT_GATE5/5を満たした場合だけexact-stage/commitし、本exact4条件文を含む最初のtracked-clean local HEADをfinalization targetとする。このcheckboxと完了宣言はpost-commit independent review、remote/PR ancestry確認、conditional fast-forward push、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI terminal success、PUSH_GATE5/5の全成立時だけ有効で、成立前はFINALIZATION_PENDING、違反時は無効として修正gateへ戻る。成功後は追加ledger commit不要。
  - rollback: safe rollbackは今回のexact4 finalization target commitだけをrevertする。historical WP-4153 evidence全体の撤去は`7cbd119`/`553dbdb`だけを直接revertせず、WP-4154〜4160、WP-0053bと関連EVIDENCE/State参照のreverse-dependency impact、conflict、downstream invalidation、再validationをfresh mappingする別reconciliationまでSTOPする。artifactはtemp削除済みで、runtime/data/package/lock/schema rollbackは不要。
  - landing_record: original implementation `553dbdb`とlanding ledger `7cbd119`はsafe feature branchに含まれ、当該checkpoint時点ではindependent verification pendingだった。current fresh closureの成否は上記EXTERNAL_STATE_CONDITIONALに従う。

- [x] WP-4154 resolve JP Core terminology artifact identity(LOW read-only supply-chain research) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL
  - 発見根拠: WP-4153でJP Core archiveのdependency key `jpfhir-terminology.r4`とrendered dependency tableの`jpfhir-terminology`が不一致で、artifact identity/fingerprint/licenseが未確定だった。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/runtime/code/SSOT/CI/toolchainは変更しない。
  - evidence: official `jpfhir-terminology.r4-1.4.0.tgz`をtemp取得し、SHA-256 `cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f`、7,444,937 bytes、ETag/Last-Modifiedを確認。archive package identityは`jpfhir-terminology#1.4.0`/FHIR4.0.1で、`.r4`は配布filenameとJP Core archive dependency keyに存在するがactual package name/IG packageIdには存在しない。JP Core archive dependency keyは実package identityと不一致のupstream metadataとして維持する。
  - acceptance/review: 2026-07-18 independent retrievalはexact HTTPS origin・redirect 0・bounded transportで実施し、raw SHA-256/7,444,937 bytes/ETag/Last-Modifiedを再現。no-extraction inspectionは206 entries、76,637,163 regular bytes、largest 23,756,698 bytes、unsafe/duplicate/nonregular member 0、license-like standalone file 0だった。duplicate-key拒否と型検査を通したexact `package/package.json`はidentity `jpfhir-terminology#1.4.0`、FHIR4.0.1、canonical `http://jpfhir.jp/fhir/jpfhir-terminology`、sole core4.0.1 dependency、license fieldなしを再現。exact IG resourceは`resourceType=ImplementationGuide`、`id/packageId=jpfhir-terminology`、version1.4.0、FHIR4.0.1、distinct URL `http://jpfhir.jp/fhir/jpfhir-terminology/ImplementationGuide/jpfhir-terminology`、active、2025-06-15、JP Core 1.2.x compatible title、dependsOnなしを再現した。JP Core archive key `jpfhir-terminology.r4`、rendered identity `jpfhir-terminology`、actual package identityをsilent normalizeせず分離した。当該WP-4154 review checkpoint時点ではWP-4155〜4160がlanded・independent pendingだったという履歴であり、current statusは各WP headingとWP-4157 terminal recordをauthorityとする。WP-4158 rights-provenance authorityを維持しlegal clearanceは未成立、WP-0053a/bのFHIR/legal/human gateを維持する。lock/APPROVED/conformance/license grant/runtime/toolchain adoption/WP-0053b unblockは非主張。PLAN_GATE5/5後、exact4は`git diff --check`、SSOT index173、script regression harness、exact4 path/index、repo内archive残存0がPASS。最初のoverlay attemptはrepo cwdを走査しfailure後も継続してfalse `PASS`を表示したためINVALID/non-evidenceとし、`set -e`とoverlay cwdを固定したtracked HEAD+exact4 scanのexit0だけをauthoritative PASSとする。live `pnpm check:secrets`は既存user-owned `.codegraph` symlinkのprotected-scope exit1でfail-closedしgreen扱いしない。COMMIT_GATE5/5を満たした場合だけexact-stage/commitし、本条件文を含む最初のtracked-clean local HEADをfinalization targetとする。このcheckboxと完了宣言はpost-commit independent review、remote/PR ancestry確認、conditional fast-forward push、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI terminal success、PUSH_GATE5/5の全成立時だけ有効で、成立前はFINALIZATION_PENDING、違反時は無効として修正gateへ戻る。成功後は追加ledger commit不要。
  - rollback: safe rollbackは今回のexact4 finalization target commitだけをrevertする。historical WP-4154 evidenceの撤去は`a3aaeee`/`921c3a4`だけを直接revertせず、WP-4155〜4160、WP-0053bと関連EVIDENCE/State参照のreverse-dependency impact、conflict、downstream invalidation、再validationをfresh mappingする別reconciliationまでSTOPする。artifactはrepo外tempからTrashへ移動済みで、runtime/data/package/lock/schema rollbackは不要。
  - landing_record: original implementation `921c3a4`とlanding ledger `a3aaeee`はsafe feature branchに含まれ、当該checkpoint時点ではindependent verification pendingだった。current fresh closureの成否は上記EXTERNAL_STATE_CONDITIONALに従う。

- [x] WP-4155 fingerprint declared HL7 FHIR package dependencies(LOW read-only supply-chain research) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL
  - 発見根拠: WP-4154後もJP Core archiveが宣言する`hl7.fhir.r4.core#4.0.1`、`hl7.terminology.r4#7.0.0`、`hl7.fhir.uv.extensions.r4#5.2.0`のartifact fingerprint/license evidenceが未記録だった。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/runtime/code/SSOT/CI/toolchainは変更しない。
  - evidence: HL7公式文書が案内するsecondary FHIR package registryから3 artifactをtemp取得。SHA-256はcore `b090bf92…fb091`、terminology `7f931890…cef63`、extensions `b406e755…7720a`。全package identity/FHIR4.0.1/canonical/dependency/license `CC0-1.0`、size、ETag/Last-Modifiedを記録した。
  - acceptance/review: 2026-07-18 independent retrievalはHL7 official `https://hl7.org/fhir/packages.html`が案内するsecondary registryをHTTPSへ限定し、3 requestがexact same-origin 302でpinned `/web/*.tgz`へ移ること、direct artifactはredirect 0であることを再現。raw SHA-256/size/ETag/full Last-Modified、no-extraction archive count/regular bytes/largest member、unsafe/duplicate/nonregular/license-like member 0、exactly one package metadataを全3件で再現した。duplicate-key拒否と型検査でcore `hl7.fhir.r4.core#4.0.1`（dependencies fieldなし）、terminology `hl7.terminology.r4#7.0.0`（core4.0.1＋extensions5.2.0）、extensions `hl7.fhir.uv.extensions.r4#5.2.0`（core4.0.1）のidentity/FHIR/canonical/versioned URL/type/license `CC0-1.0`をcross-checkし、versioned URLをcontent-addressedと誤認しない。package-level license metadataはlegal clearanceへ昇格しない。当該WP-4155 review checkpoint時点ではWP-4156〜4160がlanded・independent pendingだったという履歴であり、current statusは各WP headingとWP-4157 terminal recordをauthorityとする。WP-0053a/bのFHIR/legal/human gate、lock/APPROVED/conformance/license grant/runtime/toolchain adoption/WP-0053b unblock非主張を維持する。exact4の`git diff --check`、SSOT index173、script regression harness、path/index、repo内archive残存0はPASS。tracked HEAD+exact4 overlay cwdで`set -e`を適用したsecret scan exit0だけをauthoritative PASSとし、live `pnpm check:secrets`は既存user-owned `.codegraph` symlinkのprotected-scope exit1でfail-closed/non-greenとして分離する。COMMIT_GATE5/5を満たした場合だけexact-stage/commitし、本条件文を含む最初のtracked-clean local HEADをfinalization targetとする。このcheckboxと完了宣言はpost-commit independent review、remote/PR ancestry確認、conditional fast-forward push、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI terminal success、PUSH_GATE5/5の全成立時だけ有効で、成立前はFINALIZATION_PENDING、違反時は無効として修正gateへ戻る。成功後は追加ledger commit不要。
  - rollback: safe rollbackは今回のexact4 finalization target commitだけをrevertする。historical WP-4155 evidenceの撤去は`170ca38`/`4248d00`だけを直接revertせず、WP-4156〜4160、WP-0053bと関連EVIDENCE/State参照のreverse-dependency impact、conflict、downstream invalidation、再validationをfresh mappingする別reconciliationまでSTOPする。artifactsはrepo外tempからTrashへ移動済みで、runtime/data/package/lock/schema rollbackは不要。
  - landing_record: original implementation `4248d00`とdirect-child landing ledger `170ca38`はsafe feature branchに含まれ、当該checkpoint時点ではindependent verification pendingだった。current fresh closureの成否は上記EXTERNAL_STATE_CONDITIONALに従う。

- [x] WP-4156 classify FHIR tooling internal dependency(LOW read-only conformance research) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL
  - 発見根拠: JP Core rendered/QA metadataだけに見えた`hl7.fhir.uv.tools.r4#0.8.0`がbuild-onlyかlock対象か未分類で、WP-0053bの再現可能なvalidator dependency closureが未確定だった。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。package/lock/runtime/code/SSOT/CI/toolchainは変更しない。
  - evidence: artifact SHA-256 `95c0a27f…ae322`、148,918 bytes、FHIR4.0.1/canonical/license `CC0-1.0`を取得。JP Core IG resourceは`ig-internal-dependency = hl7.fhir.uv.tools.r4#0.8.0`を明示し、同extension定義は「IG resource validationには必要だがimplementerには不要」とする。JP Core package 112 files / 6 unique tools canonical referencesのうち5定義はartifact内に存在し、`resource-information`は不在だった。
  - acceptance/review: 2026-07-18 independent retrievalはHL7 official registry authorityをHTTPSで確認し、request `https://packages2.fhir.org/packages/hl7.fhir.uv.tools.r4/0.8.0`のsame-origin 302からpinned direct artifactへ移ること、direct artifact redirect 0 / HTTP 200 / `application/octet-stream`を再現。raw SHA-256 `95c0a27f2eb9181c32661b23accaccb4e6db3c504cc4579b6cc7e055161ae322`、148,918 bytes、ETag `"6990ade7-245b6"`、Last-Modified `Sat, 14 Feb 2026 17:16:23 GMT`、no-extraction 175 entries / 1,514,386 regular bytes / largest 196,902 bytes / unsafe・duplicate・nonregular・license-like member 0 / singleton package metadataを再現した。duplicate-key拒否と型検査でtools `hl7.fhir.uv.tools.r4#0.8.0`のFHIR4.0.1/canonical/package URL/type `IG`/license `CC0-1.0`、core4.0.1＋terminology6.5.0＋extensions5.3.0-ballot-tc1 dependenciesを確認した。JP Core 1.2.0をfresh再照合し、`ig-internal-dependency=hl7.fhir.uv.tools.r4#0.8.0`のvalidation-only定義、112 file references、six unique tools canonicals、five artifact解決と`resource-information`不在を機械的に再現した。tools packageをclinical runtime dependencyと誤分類せずconformance/build lock候補に限定し、transitive terminology/extensionsとJP Core declared 7.0.0/5.2.0の衝突、missing canonical definition、clean validator/IG Publisher resolution、FHIR specialist review前にlockしない。WP-4157 compatibility、WP-4158 rights、WP-4159 reachability、WP-4160 obligations、WP-0053a/b FHIR/legal/human gateを維持し、lock/APPROVED/conformance/runtime/toolchain adoption/license grant/WP-0053b unblockを非主張。exact4の`git diff --check`、SSOT index173、script regression、path/index、archive residue0とtracked HEAD+exact4 overlay cwd fail-fast secret scanだけをPASSとし、live `pnpm check:secrets`は既存user-owned `.codegraph` symlinkのprotected-scope exit1でfail-closed/non-greenとして分離する。COMMIT_GATE5/5を満たした場合だけexact-stage/commitし、本条件文を含む最初のtracked-clean local HEADをfinalization targetとする。このcheckboxと完了宣言はpost-commit independent review、remote/PR ancestry確認、conditional fast-forward push、local/origin/PR parity、origin/main `27d6144`不変、deployments0、exact-head CI terminal success、PUSH_GATE5/5の全成立時だけ有効で、成立前はFINALIZATION_PENDING、違反時は無効として修正gateへ戻る。成功後は追加ledger commit不要。
  - rollback: safe rollbackは今回のexact4 finalization target commitだけをrevertする。historical WP-4156 evidence `0c9747f`/`9691972`を直接revertせず、WP-4157〜4160、WP-0053bと関連EVIDENCE/State参照のreverse-dependency impact、conflict、downstream invalidation、再validationをfresh mappingする別reconciliationまでSTOPする。artifactはtempからTrashへ移動済み、runtime/data/package/lock/schema rollback不要。
  - landing_record: implementation `0c9747f`とlanding ledger `9691972`はsafe feature branchに含まれ、当該checkpoint時点ではindependent verification pendingだった。current fresh closureの成否は上記EXTERNAL_STATE_CONDITIONALに従う。

- [x] WP-4157 map FHIR validator / IG Publisher / SUSHI compatibility candidates(LOW read-only toolchain research) — FINALIZED / REMOTE_CI_PASS
  - run/priority/risk/outcome: `goal-20260718` / P1 / R2。既存toolchain-candidate metadataを独立再検証し、採用・互換性・適合性へ昇格させず、再現可能なclean-spike境界を固定する。
  - root_cause/hypothesis/falsifier: current candidate metadata、SUSHIのofficial Node support境界、local Node24と失敗するJava invocationを同じcompatibility proofとして扱うと未検証toolchain adoptionへ誤昇格する。confidence HIGH。historical workflowのfloating Node/SUSHIとsource POM/container Java targetはprior non-authoritative observationsであり本WP acceptanceから除外し、later clean spikeで再現する。falsifierはrecorded tag/asset/digest/supportと一次channelの不一致、SUSHI v3.20.0のNode24 official support発見、usable Java invocation、またはAPPROVED lock/adoption authorityの発見であり、成立時はPLAN_GATEへ戻って別clean-spikeをre-planする。binary未実行はfalsifierでなく本groupのstop/non-claim条件である。
  - allowed/forbidden/dirty: allowed exact4=`ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。forbidden=artifact download/execute/install/cache reuse、dependency/package/lock、runtime/code/API/DB/UI、SSOT/CI/toolchain adoption、production/PHI。`.omo/`/`.codegraph`はunstaged/unread。custom sandbox/worktree/landing-state implementationは本WP外。
  - authority/dependencies: metadata reproduction、trust boundary、AC-to-command、candidate-tree、future retrieval minimum guardrailの唯一のauthorityは`ops/refactor/EVIDENCE.md`の「WP-4157 canonical metadata reproduction and trust boundary」。APPROVED process refsはPRC-002/003/005。FHIR domainの非昇格境界はARC-008を暫定優先authorityとし、DOM-005は`amendment_status: PENDING_REVISION`のためPHI/fail-closed等の非競合不変条件だけを保存参照し、旧facade/正本方向を本WP根拠にしない。算定/請求evidence_idは非該当。dependencyはWP-4156、downstream blockerはWP-4158〜4160/WP-0053a/b/WP-6004。これらのstatus/unblock条件を変更しない。
  - proximity: L0=metadata reproduction、trust/support limitation、non-promotion。L1=temporary-index exact4 candidate、current/historical State heading一意化、finite tracked residue。L2=downstream blocks byte不変と通常のfeature branch/PR/CI evidence。generic orchestration、tool trust framework、runtime/FHIR executionは別root cause/scopeでexcluded。
  - strategy: S1はfocused Python metadata verifier/evidence、S2はS1 landing record。private state machine、binary trust framework、comment transaction、future rollback schemaを削除し、通常のexact-stage commit/feature-branch push/exact-head PR CIだけを使う。
  - reviewer/human_gate: maker=root sole maintainer。PLAN_GATE reviewersは(1) goal/proximity、(2) correctness/test、(3) security/privacy/medical safety兼supply-chain/FHIR、(4) architecture/reliability、(5) integration/operations。R2 specialist requirementはindependent verifier + FHIR/conformance + supply-chain/securityで満たす。unsigned provenanceのhuman supply-chain risk acceptance、legal/license、FHIR baseline/lock、patient safety、architecture/productのhuman authorityはWP-4158/WP-0053a/bで未解除のまま維持し、technical 5/5で代替・解除しない。
  - acceptance/test: AC1 no-auth/no-artifact bounded Python metadata verifier + negative fixtures; AC2 provenance/nonclaims/human gates; AC3 exact4/non-exact4/index isolation + recursive commit path oracle; AC4 normative downstream order/hash and newly-added tracked artifact-path residue; AC5 same S1/S2 matrix; AC6 historical heading; AC7 user-required six review gates; AC8 ordinary non-force push + exact-head attempt1 CI; AC9 tracked S1 landing record; AC10 final parity/main/deployments/clean + bounded future revert note。fresh20 EVIDENCEがauthority。
  - impact/browser/performance: runtime、DB、tenant、PHI、patient data、UI変更なし。browser/demo/accessibility/performance runtimeはN/A。主要riskはFHIR/supply-chain/legal claimの誤昇格、signed URL漏えい、wrong-tree false greenで、canonical procedureをfail-closedで適用する。
  - closure/git/push: S1 remote base=`e81d7ec…` with local parent `1e63e85…` ancestry、S2 base=terminal S1。each ordinary non-force push、workflow309812329 attempt1 exact-head success、local/origin/PR parity、main/deployments。S2はtracked S1 landing recordのみで、S2自身のpush/CI/parityはroot final report。force/main/deploy/merge/comment write禁止。
  - rollback/landing: 明示要求時だけfresh dependency mapping後、今回のWP-4157 S1/S2 exact4 commitsだけを新しいreviewed revert commitsで新しい順に戻し、then-current validation/CIを再実行。historical `1e63e85`/`42fa277`/`ffa1fd0`は対象外。
  - adversarial_fresh7_to_fresh19: fresh19 ledger `13c15874…`は0/5だが、全員同じstale Plans 2行のみをblockerとし他はPASS。fresh20で通常evidenceへ統一。
  - s1_landing_record: commit `7180b9cb63370f4d93ca4be6f3e0f8b22d74eeeb` / tree `8f56b8c0aa2172daddfcd8ebef007e2c33eadbe6`。PLAN `ebfa4536…`、IMPLEMENTATION `480dc314…`、BUG_REFACTOR `6d769bcb…`、VALIDATION `9753bd71…`、COMMIT `9f12eadf…`、PUSH `a70527ab…`はいずれも5/5 PASS。validation bundle `adfba579…`、CI run `29641365969`はworkflow `309812329` / PR / attempt1 / exact head / completed-success。local/origin/PR parity、main `27d6144…`不変、deployments0、tracked clean。Node action runtime deprecation warning、local PostgreSQL integrationの14件のskip、aggregate deadlineの静的確認、unsigned provenance/FHIR/legal/patient-safety human gatesは残risk/nonclaimとして維持。
  - s2_terminal_record: commit `9a3e715f49532ea2b57bda8ec715b0f6c06435c0` / tree `e16d91a26a0f346a0537a2588364283b05b5b19d` / parent `7180b9cb63370f4d93ca4be6f3e0f8b22d74eeeb`。VALIDATION `590e498b64ae46ebda39060feae98c1f9188024f`、COMMIT `9dd2dcd8a4a5ce103f0188814462352745d05200`、PUSH `90af6d4fcb5467f329ff730b91860394a3149d81`は各5/5 PASS。PR #1 exact-head run `29643783105` / workflow `309812329` / attempt1 はcompleted-successで全step成功、local/origin/PR parity、origin/main `27d61445350e40f2741583a07eb20936d9916992`不変、deployments0、tracked/index cleanを確認した。Node20 action runtime deprecation warningはnonblocking maintenance。unsigned provenance、FHIR/conformance、legal/license、patient safety、architecture/product、WP-0053a/bのhuman gateは未解除。
  - exact_next_action: WP-4158 S0 PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gatesは各fresh5/5 PASS済み。current exact4はAC9C用にstaged済みで、次はそのstaged treeに対するfresh COMMIT_GATE Reviewer1〜5だけ。5/5後のみrootがcommitする。

- [~] WP-4158 map JP Core terminology rights provenance(MEDIUM read-only legal evidence) — S0_COMMIT_REVIEW / PLAN_GATE_5_OF_5 / IMPLEMENTATION_GATE_5_OF_5 / BUG_REFACTOR_GATE_5_OF_5 / VALIDATION_GATE_5_OF_5
  - 発見根拠: fingerprint済みterminology 1.4.0 artifactにpackage licenseがないだけでなく、JP Core 1.2.0自身が用語許諾を利用者の解決事項としているため、package存在を利用・再配布許可と誤認できない。
  - root_cause_hypothesis_falsifier: root causeはhistorical `f8edc1c`がversion-bound rights evidenceを記録した一方、immutable source/artifact membership、candidate-direct subset、legal handoffを同一reviewed reproductionで独立検証しておらず、package公開/metadata不在が許諾へ誤昇格し得ること。Hypothesisはpinned JP Core1.2.0 + terminology1.4.0 bytesからexact manifests/digests/countsと全UNRESOLVED handoffを、runtime/package/SSOT変更なしに再現できること。Falsifierはsource/artifact/notice identity drift、unsafe/ambiguous archive/transport、manifest/count/digest/known-duplicate drift、test false-green、temp residue、またはhuman/APPROVED SSOT conflictのいずれかで、その場合はS1実装/landingをSTOPし推測補完しない。
  - proximity_map: L0=`ops/refactor/EVIDENCE.md` WP-4158 authorityとS1 inline verifier/source-derived evidence。L1=`Plans.md`,`State.md`,`ops/refactor/STATE.md`のstatus/acceptance/next-action projection、WP-4157 terminal facts、WP-4159 candidate-direct digestとのbytewise cross-check。L2=WP-0053bのFHIR/legal/package-lock human gateとWP-4159/4160 downstream nonclaimだけをderived impactとして保持し、本文/approval/statusは変更しない。Included=exact4 docs、ephemeral read-only retrieval、synthetic/offline fixtures、direct validation/CI evidence。Excluded=runtime/code/API/DB/UI、package/lock/SSOT/CI config、Profile/terminology adoption、legal/FHIR/clinical/claim decision、production/external publication。First-principles decision=新trust frameworkやgeneric runnerを作らず、version-bound evidence reproduction + unresolved decision handoffへ最小化する。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。用語採用/置換、license判断、artifactのrepository内またはpersistent retention、package/lock/runtime/code/SSOT/CI/toolchainは変更しない。S1のno-extraction inspectionに限りrepo外private tempへのephemeral downloadを許可し、normal/error/catchable INT/TERM/HUPでは必ずcleanupする。SIGKILL/kernel loss cleanupは非主張。
  - evidence: pinned JP Core 1.2.0 tree内にcase-insensitive conventional basename `LICENSE|LICENCE|NOTICE|COPYING`がないこととofficial usage noticeを確認した。mutable GitHub detected-license metadataはS1 immutable proofへ含めず、file不在をrepository-wide grant/prohibition判断へ昇格しない。1.4.0 artifactの203 terminology resourcesはcopyrightあり146/なし57で、排他的text分類はAll Rights Reserved 17、CC BY-ND 4、CC0 2、LOINC license 3、その他明示120、記載なし57。current IP reviewは別versionのため1.4.0 clearanceへ流用しない。
  - outcome/nonclaim: fingerprint済みversionに結合したimmutable provenance、deterministic resource-rights taxonomy、WP-4159の**candidate direct binding resolution** handoff、およびuse-lane legal decision schemaを再現する。decision defaultは全件`UNRESOLVED`。実運用到達性、選定済みProfile、transitive CodeSystem/content closure、許諾・禁止判断、JP Core/FHIR適合、clinical/claim採用を主張しない。
  - slice/ownership: root sole maintainer。S0 HEAD/base=`9a3e715f49532ea2b57bda8ec715b0f6c06435c0`でWP-4157 terminal projection + closure planのみ。S1 HEAD/base=remote/CI-terminal landed S0 commitでread-only reproduction + rights/handoff evidence。S2 HEAD/base=remote/CI-terminal landed S1 commitでS1 parent/commit/tree/gates/CIだけを記録するlanding-only slice。各sliceはexternal gate artifactの`EXPECTED_BASE_COMMIT` / non-self-referential `EXPECTED_CANDIDATE_TREE`を持つ別candidate/commit/ordinary push。S1 commit parent=S0 commit、S2 parent=S1 commitをassertし、S1 rollbackはS0を保持、S2 rollbackはS2だけを先に戻す。package/lock/runtime/code/API/DB/UI/SSOT/CI/toolchain、persistent/repository artifact retention・展開、採用・公開・外部送信は禁止。
  - immutable_source_acceptance: exact repo=`https://github.com/jami-fhir-jp-wg/jp-core-v1x`、ref API=`https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/ref/tags/1.2.0`。tag-ref MUST be `type=tag` / SHA `8b9780cbdb9086e6f41b35aa8935038bd884243e`; tag object MUST target `type=commit` / SHA `c06f02059c2a8aed6a33d624c9eee6fe0669ef06`; any lightweight response is `TAG_TYPE_DRIFT`。commit MUST have root tree `1b2b378b78b6741e59b326d5232de82ff02caedc`。tree API=`https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/trees/1b2b378b78b6741e59b326d5232de82ff02caedc?recursive=1`、`truncated=false`、662 entries、duplicate path 0、case-insensitive basename `LICENSE|LICENCE|NOTICE|COPYING`（nested/mixed-case含む）0。notice=`https://jpfhir.jp/fhir/core/1.2.0/guide-precautions.html`、SHA-256=`5c1830cf7733493f96042ceb8ec10cfc28ad66626c25849a510a24cb51d6ffbf`、12,931 bytes、anchors=`jpfhir.jp.core#1.2.0` / `用語ライセンス` / `利用する側で用語に関するライセンス問題を解決を行なう必要がある` / `SHALL` / `用語の利用を保証するものではない`。wrong/moved/type/version/digest/size/anchor、truncated responseはSTOP。
  - artifact_acceptance: terminology artifact=`https://jpfhir.jp/fhir/core/terminology/jpfhir-terminology.r4-1.4.0.tgz`、SHA-256 `cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f`、7,444,937 bytes、206 entries。exact singleton members=`package/package.json` and `package/ImplementationGuide-jpfhir-terminology.json`; duplicates/casefold collisions fail。package=`jpfhir-terminology#1.4.0`, FHIR4.0.1, canonical `http://jpfhir.jp/fhir/jpfhir-terminology`, dependency exact core4.0.1, license missing。IG resourceType/id/packageId/version/fhirVersion/url MUST be `ImplementationGuide` / `jpfhir-terminology` / `jpfhir-terminology` / `1.4.0` / `4.0.1` / `http://jpfhir.jp/fhir/jpfhir-terminology/ImplementationGuide/jpfhir-terminology`。rights集計前に再照合し、展開しない。203 terminology resources=106 CodeSystem+97 ValueSet、copyright present146/absent57。
  - manifest_byte_grammar: fields are exact UTF-8 bytes、NUL (`0x00`) field separator、embedded NUL/LF invalid。records are bytewise sorted、LF joined、final LF required; empty manifest=zero bytes。Six provenance manifests: (1) rights identity **set** fields `(resourceType,url,version-or-empty,id)`; (2) rights classification **set** adds `category`; (3) profile universe **set** `(url,version,status,type)`; (4) raw direct occurrence **multiset** `(profile url,version,status,type,element.path,binding.strength,binding.valueSet)` retaining duplicate records; (5) unique direct-row **set** same 7 fields; (6) direct canonical **set** single URL field。Handoff is a separate seventh **set** with its 14 ordered fields。All recorded digests and any single-record key manifest use this framing。
  - deterministic_taxonomy: resource identity key=`(resourceType,url,version-or-empty,id)`。resourceType/url/idはnonempty string、versionはstringまたはmissing exactly1、keyは203 unique。identity digest=`4aa81de1eed952fc129702b7eb372c2202296217a5815b9ca749b9e197c1d9e9`。category enum exact tokens=`all-rights-reserved|cc-by-nd|cc0|loinc|other-explicit|absent`。copyright missingまたはexact empty stringだけ`absent`、nonemptyはraw Unicodeをnormalize/trim/whitespace-foldせず`casefold()`し、exact ASCII substrings `all rights reserved` / `cc by-nd` / `cc0` / `loinc`を照合。0 hit=`other-explicit`、1 hit=family、2+ hit=`RIGHTS_OVERLAP`、優先順位なし。expected counts=17/4/2/3/120/57、overlap0、`identity NUL category` digest=`2de1ce4600213c7f5f8d41d87735980243dcdf10e8d1177a45b2c0776736aaab`。case-only mutationはpositive metamorphic PASS（same category/digest）。Unicode confusable/whitespace/punctuation/near-missはnegative `RIGHTS_MANIFEST_MISMATCH`; non-string/duplicate key/multiple-familyは専用failure。
  - candidate_direct_handoff: JP Core input=`https://jpfhir.jp/fhir/core/1.2.0/package.tgz` / SHA `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3` / 2,391,515 bytes / 403 entries / singleton `package/package.json`=`jpfhir.jp.core#1.2.0`。fixed type set=`Patient,Coverage,Medication,Practitioner,PractitionerRole,Organization,Location,AllergyIntolerance,Consent,DocumentReference,MedicationRequest,MedicationDispense,Condition,Observation,Provenance,AuditEvent,DetectedIssue,Task,Communication`。selected predicateはresourceType=`StructureDefinition`, kind=`resource`, derivation=`constraint`, type exact membership。各profileはurl/version/status/type nonempty string、snapshot object、snapshot.element list。各elementはobject + path nonempty string; bindingが存在すればobject、valueSetが存在すればnonempty raw stringかつstrength nonempty string。32 profiles digest=`104d16109bcc858cd71aadeb03be9b59c649860004ea4fa2aaf9c0ae86415413`。terminology ValueSetはresourceType/url exactで97 unique、alias/prefix/`|version` splittingなし。raw membership occurrenceは51、multiset digest=`966164ba9c5fd1b40fd066941466170e7426e9170e1424618dae4a0685e3624a`。唯一のduplicate 7-field rowはJP_Practitioner/1.2.0/active/Practitioner/`Practitioner.qualification.code`/required/medical-license ValueSet; single-record manifest SHA (NUL fields + final LF)=`c2364f4bca5646ef17dc8e8ad634bacfdf6bfadd3ca748e5966a4de68be7b2da`、multiplicity2。unique setは50 digest=`c04fe6844af7b0cb8c2a7ba017a482cc0c6a96aacdfa9df2e086fcf974fdb858`、canonical set25 digest=`464b0a941bbf7940bc41664f7f87ee9cf0d1e195e3dbf841f6013fca7fb96395`。既知duplicateだけ許し、multiplicity/key/member drift、ValueSet resource URL duplicate、missing/extra/swap/alias/wrong packageはfail。selected Profile、transitive/workflow/semantic/adoption/clearanceは非主張。
  - transport/security: exact GitHub endpoints are ref URL above, `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/tags/8b9780cbdb9086e6f41b35aa8935038bd884243e`, `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/commits/c06f02059c2a8aed6a33d624c9eee6fe0669ef06`, and exact tree URL above; plus exact notice/core/terminology URLs。allowed origins=`https://api.github.com:443`,`https://jpfhir.jp:443`; approved redirect set empty。userinfo、unexpected query/fragment、downgrade/redirect/other origin拒否。explicit empty ProxyHandler、auth/cookie/custom credential headerなし、ambient proxy/credential/netrc/cookie/SSL override無効。monotonic deadline checked before/during every read plus per-request signal wall alarm15s、aggregate signal wall alarm120s、download total16MiB。API/notice max4MiB、core4MiB、terminology8MiB; Content-Length必須、artifact/notice size exact、API上限内。repo外temp mode0700/file0600、normal/error/catchable INT/TERM/HUP cleanup + path nonexistence。SIGKILL/kernel loss cleanupは非主張。core archive caps512 entries/32MiB regular/8MiB largest、terminology256/96MiB/32MiB。absolute/traversal/backslash/NUL、duplicate/casefold collision、link/device/nonregular拒否、repo artifact residue0。
  - verifier_contract: S1だけがhost exact `ops/refactor/EVIDENCE.md`へexact marker lines `<!-- WP4158_VERIFIER_BEGIN -->` / `<!-- WP4158_VERIFIER_END -->` と単一Python sourceを追加する。PrecheckはそのhostのUTF-8 `splitlines()`に対して各exact line count=1、begin<end、strict interiorのfirst line exact ` ```python `、last exact ` ``` `、内部に` ``` ` prefixなしをassertし、interior[1:-1]をLF join + final LFでemitする。他file/substringはcountしない。Invalidはsource実行前に`VERIFIER_MARKER_INVALID`。Emitted sourceをrepo外temp fileへ0600保存し、sanitized envの`python3 -I <temp> --self-test|--live`へ渡し、source SHA + candidate treeをgate packetへ固定、tempをfinally削除する。S0はmarkers/sourceを持たずfuture verifierを実行しない。
  - handoff_schema: candidate-direct 25 canonicals × exact lane enum `private-ci-validation-cache|runtime-terminology-service|ui-display|export|public-ig-test-bundle|partner-sandbox|sdk|bulk-data` = 200 unique rows。exact fields=`canonical,lane,terminologyVersion,rightsholder,authoritativeTermsUrl,evidenceDate,permittedUse,attributionObligation,redistributionObligation,derivativeObligation,updateObligation,decision,humanAuthority,decisionDate`。terminologyVersion=`1.4.0`; rightsholderからdecisionまでの9 decision fieldsはexact `UNRESOLVED`; humanAuthority/decisionDateはnull（manifestではempty field）。全14 fieldをmanifest grammar順に連結した200-row digest=`1999669b561192d12e3567a096588a7a69dbb8a6c84e85ad3701acb21e2ae02d`。missing/extra/duplicate row、lane drift、field欠落、premature non-UNRESOLVED decisionをfailし、これはpermission decisionでなくhuman legal input schema。
  - self_test_matrix: offline/no-network tests call the same live functions。metamorphic positive exact2=`rights_case_only,direct_known_duplicate_order`。negative exact95 with globally unique names and exact family mapping: `SOURCE_IDENTITY_MISMATCH`=`tag_ref_sha,tag_target,root_tree`; `TAG_TYPE_DRIFT`=`tag_type`; `TREE_TRUNCATED`=`tree_truncated`; `TREE_PATH_INVALID`=`tree_count,tree_duplicate_path,tree_license_basename`; `NOTICE_MISMATCH`=`notice_digest,notice_anchor` (source10)。`ARTIFACT_MISMATCH`=`core_digest,core_size,terminology_digest,terminology_size,package_singleton,package_identity,ig_singleton,ig_identity`; `ARCHIVE_UNSAFE`=`core_entry_bound,core_total_bound,core_largest_bound,terminology_entry_bound,terminology_total_bound,terminology_largest_bound,absolute_path,traversal_path,backslash_path,nul_path,archive_duplicate_member,casefold_collision,nonregular_member`; `JSON_DUPLICATE_KEY`=`duplicate_json_key`; `RESOURCE_SHAPE`=`resource_count,resource_object_type,resource_type,resource_url_type,resource_id_type,resource_version_type` (archive28)。`RIGHTS_TYPE_INVALID`=`copyright_nonstring`; `RIGHTS_OVERLAP`=`category_overlap`; `RIGHTS_MANIFEST_MISMATCH`=`unicode_confusable,whitespace_drift,punctuation_drift,near_miss,member_swap,duplicate_identity` (rights8)。`PROFILE_UNIVERSE_MISMATCH`=`profile_manifest`; `PROFILE_SHAPE_INVALID`=`profile_object_type,profile_url_type,profile_version_type,profile_status_type,profile_type_type,snapshot_type,element_type,element_path_type,binding_type,valueset_type,strength_type`; `DIRECT_ROW_MISMATCH`=`row_manifest,duplicate_multiplicity,duplicate_key,direct_duplicate_member`; `DIRECT_URL_MISMATCH`=`url_manifest`; `DIRECT_RESOLUTION_ERROR`=`missing_valueset,duplicate_valueset,version_alias,wrong_package` (direct21)。`HANDOFF_SCHEMA_MISMATCH`=`missing_row,duplicate_row,lane_drift,field_missing`; `HANDOFF_NOT_UNRESOLVED`=`premature_decision` (handoff5)。`TRANSPORT_POLICY`=`redirect,downgrade,other_origin,wrong_path,unexpected_query,unexpected_fragment,userinfo,ambient_proxy,ambient_credential,ambient_netrc,ambient_cookie,ambient_ssl_override,temp_inside_worktree,temp_inside_gitdir,temp_inside_commondir,temp_dir_mode,temp_file_mode`; `TRANSPORT_LIMIT`=`content_length_missing,content_length_mismatch,body_bound,request_timeout,aggregate_timeout,aggregate_bytes` (transport23)。Every negative mutates exactly one named boundary, proves before/after inequality and must return only its mapped token。
  - cleanup_self_test: exact10=`cleanup_pending_normal,cleanup_pending_operation_error,cleanup_pending_sigint,cleanup_pending_sigterm,cleanup_pending_sighup,cleanup_final_normal,cleanup_final_operation_error,cleanup_final_sigint,cleanup_final_sigterm,cleanup_final_sighup` run as subprocess-level probes against both actual verifier temp-owner lifecycle phases, not a pure model。Parent creates one private repo-external parent plus a fixed-byte sibling canary and starts each child with `start_new_session=True`; before readiness it requires `child_pgid=os.getpgid(child.pid) == child.pid` and `child_pgid != os.getpgrp()`。Parent passes exact pending/final child paths and an inherited readiness-pipe write FD via `pass_fds`; filesystem control files are forbidden。Child installs INT/TERM/HUP handlers first, creates only the owned pending directory0700、nested `partial/`0700 and non-empty `partial/download.part`0600 with fixed synthetic bytes, fsyncs/closes it, then either writes exact byte `P` and closes the pipe while pending remains authoritative, or atomically renames pending→final before writing exact byte `F` and closing the pipe。Parent uses `select` plus bounded reads every at most10ms with monotonic startup deadline2s and total deadline10s; readiness is exactly the expected phase byte followed by EOF。Before triggering completion it verifies the selected target path、other lifecycle path absence、exact modes/owner、sentinel bytes and sibling canary。For each phase, `normal` child proceeds through the actual verifier success return without a signal; `operation_error` child raises the actual synthetic operation exception through the verifier error/finally path without a signal; only INT/TERM/HUP probes receive the named signal once。Each probe emits exactly `WP4158_CLEANUP_EXIT probe=<exact_probe> phase=<pending|final> reason=<NORMAL_RETURN|OPERATION_EXCEPTION|SIGINT|SIGTERM|SIGHUP>\n`, empty stderr, and respectively exits0/70/130/143/129; phase/probe/reason/code swapping or sharing fails。Every probe requires bounded child exit、recursive pending/final nonexistence including nested sentinel、sibling-canary byte identity、parent-context cleanup and repository residue0。On startup/total failure parent sends TERM only to the verified isolated `child_pgid`, waits2s, then KILLs only that group if needed, reaps it in `finally`, removes only the exact pending/final pair under its private parent, asserts sibling canary unchanged and no other path touched, and fails the self-test; no unverified/current parent group is signalled。Normal/error/catchable INT/TERM/HUP cleanupだけを保証し、uncatchable external SIGKILL/kernel loss cleanup is excluded/nonclaimed。Exact aggregate token is emitted only after all ten exact terminal oracles pass: `WP4158_SELFTEST_PASS positives=2 negatives=95 cleanup=10 residue=0`。
  - cleanup_pipe_fd_lifecycle: parentはanonymous readiness pipeとrelease pipeを作り、childへreadiness write FD + release read FDだけを`pass_fds`する。successful `Popen`直後にparentはreadiness write copyとrelease read copy、childはreadiness read copyとrelease write copyを持たない。childはphase byte送信後にreadiness write FDをcloseし、release read FDのEOFまで待つ。parentは`expected byte + EOF`後にpath/mode/owner/sentinel/canaryを検証し、normal/operation-error probeだけrelease write FDをcloseしてchildをactual return/exceptionへ進め、signal probeはrelease writeを保持したままnamed signalを送る。spawn/startup/total failureと`finally`では各processがown FDだけをcloseする。
  - live_output_oracle: successful `--live` stdout is exactly these six ordered LF-terminated lines and nothing else: (1) `WP4158_SOURCE_PASS tag=8b9780cbdb9086e6f41b35aa8935038bd884243e commit=c06f02059c2a8aed6a33d624c9eee6fe0669ef06 tree=1b2b378b78b6741e59b326d5232de82ff02caedc entries=662 notice=5c1830cf7733493f96042ceb8ec10cfc28ad66626c25849a510a24cb51d6ffbf`; (2) `WP4158_ARTIFACT_PASS core=6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3 terminology=cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f resources=203`; (3) `WP4158_RIGHTS_PASS codesystems=106 valuesets=97 present=146 absent=57 identity=4aa81de1eed952fc129702b7eb372c2202296217a5815b9ca749b9e197c1d9e9 classification=2de1ce4600213c7f5f8d41d87735980243dcdf10e8d1177a45b2c0776736aaab`; (4) `WP4158_DIRECT_PASS profiles=32 raw=51 unique=50 canonicals=25 duplicate=2 profile_sha=104d16109bcc858cd71aadeb03be9b59c649860004ea4fa2aaf9c0ae86415413`; (5) `WP4158_HANDOFF_PASS rows=200 unresolved=200 digest=1999669b561192d12e3567a096588a7a69dbb8a6c84e85ad3701acb21e2ae02d`; (6) `WP4158_LIVE_PASS responses=7 redirects=0 residue=0`。
  - direct_gate_commands: S0 direct validation=`git diff --check`, disposable-index exact4 candidate tree/path assertion, real-index clean with ambient `GIT_INDEX_FILE` absent, `pnpm check:ssot-index`, `pnpm test:scripts`, tracked-candidate overlay `node scripts/check-secrets.mjs` and residue0。S1/S2 add verifier marker/source SHA、extraction-process `ast.parse(source, filename=host)` syntax check（no bytecode/pycache）、exact `--self-test` token and exact six `--live` lines。Extracted source execution uses one owned repo-external `TemporaryDirectory` containing source0600 and asserts post-context nonexistence。VALIDATION adds workspace typecheck/test/build、OpenAPI、calculation-purity、boundaries、deps、SBOM。Every command transcript/exit is preserved in the gate packet; failed commands still receive post-state path/index/residue reconciliation before retry。
  - commit_push_oracles: AC9C external packetは40-hex `EXPECTED_BASE_COMMIT`, `EXPECTED_CANDIDATE_TREE`とexact `EXPECTED_MESSAGE`だけを入力とし、AC9L/AC9P external packetはcommit後にそれらへ40-hex `EXPECTED_COMMIT`を追加する。各phaseで必要な入力の欠落・型不正・command nonzero・schema/token不一致はfail-closed。exact path setは再帰的にexact4=`Plans.md,State.md,ops/refactor/EVIDENCE.md,ops/refactor/STATE.md`のみ（rename/copy/delete/submoduleを含むname-status driftもfail）。AC9C COMMIT readyは`HEAD=$EXPECTED_BASE_COMMIT`、tracked worktree diff name set=exact4、rootがreal indexへexact4だけを明示stage、cached name set=exact4、`git write-tree=$EXPECTED_CANDIDATE_TREE`、`git diff --cached --check` exit0、unstaged tracked diff empty、messageがsliceごとのexact値（S0 `WP-4158: reconcile terminology rights closure plan`; S1 `WP-4158: verify terminology rights provenance`; S2 `WP-4158: record terminology rights landing`）をassertし、exact token=`WP4158_COMMIT_READY base=$EXPECTED_BASE_COMMIT tree=$EXPECTED_CANDIDATE_TREE paths=4 message=$EXPECTED_MESSAGE`。fresh exactly5 COMMIT reviewersが同じartifactを5/5 PASS後にrootだけがcommitする。
  - ac9c_precommit_input_boundary: AC9C pre-commit packetではcommit objectがまだ存在しないため`EXPECTED_COMMIT`は入力禁止・不使用とし、required inputsは`EXPECTED_BASE_COMMIT`,`EXPECTED_CANDIDATE_TREE`,`EXPECTED_MESSAGE`だけ。上記general missing-input clauseの`EXPECTED_COMMIT`要件はAC9L/AC9Pだけに適用する。root exact-stage→AC9C token固定→fresh exactly5 COMMIT review→commitの順を唯一とし、review前commitやreview後stageを禁止する。commit成功後にactual 40-hexを`EXPECTED_COMMIT`としてAC9L/Pへ固定する。
  - ac9_local_push_terminal: AC9L local prepushはcommit後に`HEAD=$EXPECTED_COMMIT`、exactly one parent=`EXPECTED_BASE_COMMIT`、`git show -s --format=%T=$EXPECTED_CANDIDATE_TREE`、subject=`EXPECTED_MESSAGE`、parent→commit recursive name-status path set=exact4、tracked worktree empty、real index emptyをassertしtoken=`WP4158_LOCAL_COMMIT_PASS commit=$EXPECTED_COMMIT parent=$EXPECTED_BASE_COMMIT tree=$EXPECTED_CANDIDATE_TREE paths=4`。PUSH_GATEはone material gate / exactly five unique fresh reviewer contextsで、same fiveがAC9Lを全員PASS後にremote refをread-only分類する。remote=`EXPECTED_BASE_COMMIT`ならrootはexactly one ordinary non-force `git push origin "$EXPECTED_COMMIT:refs/heads/fix/wp4092-postgres-ci"`を一度だけ実行（retry/force/lease/delete/main禁止、exit/stdout/stderr記録）。push nonzero/応答欠落は直ちにretryせずread-only再照合し、remote=baseならmutation不成立としてgeneration無効・fresh fiveで再試行可、remote=commitならmutation成立済みとして`ALREADY_PUSHED_RECOVERY`、other/zero/multipleなら`REMOTE_DIVERGED` STOP。remoteが既にcommitで、内容findingがなくcontext/API/poll artifactだけ失われた場合はfresh exactly-fiveがAC9Lとremote=commitを再確認し、**pushせず**AC9Pだけをreviewするresume-safe generationを許可する。post-push content/security/privacy/data findingまたはattempt1 CI実failureは同commitを再利用せず、`EXPECTED_COMMIT`をnew baseとするnew reviewed repair slice/commitへ戻り全six gatesを再実行する。same generationでcontext保持時はsame fiveがAC9Pをreviewし新しいfiveを足さない。context lossはold generation無効だがremote mutationを繰返さず上記already-pushed pathへ移る。cardinalityは各generation5であり10ではない。
  - repair_generation: repair対象slice `Sx`のlanded-but-failed commitをbaseとし、ordinal=`1 + first-parent history上の同Sx repair message数`、exact message=`WP-4158: repair terminology rights Sx rNNNN`（zero-pad4）をexternal packetに固定する。Diffはexact4のうちfinding修正とそのledger projectionだけ、package/runtime/code/SSOT等の禁止境界は同じ。PLANからPUSHまでfresh six gatesと当該sliceのdirect gate commandsを再実行し、terminal PASS後は`LANDED_Sx_COMMIT`をrepair commitへ置換して次sliceのbaseとする。Further findingはordinalを増やすnew repair generation。RollbackはS2 repairs newest-first→S2→S1 repairs newest-first→S1→S0 repairs newest-first→S0の順でfresh dependency review後のみ行う。CI failureがrepository-correctable findingを伴わないinfra-only/outageならempty/docs repair commitを作らず`EXTERNAL_CI_BLOCKED`で停止し、attempt1要件の変更はhuman gateとする。
  - ac9p_remote_ci: AC9Pはpush後のread-only terminal oracle。deadline=`start monotonic + 1200s`、poll interval=15s、最大80 polls、各request timeout15sでofficial `gh api`を用い、PR #1 head OID、branch ref、main ref、deployments、Actions runs/jobsを取得する。各poll result schemaは`poll,elapsed,status,matchingRunCount,runId,runAttempt,headSha,conclusion`、request/JSON/schema/error/deadlineはnonzero STOP。local HEAD、origin branch SHA、PR #1 head OIDは全て`EXPECTED_COMMIT`、origin/mainは`27d61445350e40f2741583a07eb20936d9916992`、`deployments?sha=$EXPECTED_COMMIT` result count=0。workflow id=`309812329` / event=`pull_request` / PR number=1 / head_sha=`EXPECTED_COMMIT`に一致するrunはexactly1、run_attempt=1、status=`completed`、conclusion=`success`; its jobs paginationを完走しjob count>0、全job conclusion=`success`、各jobの全step conclusion=`success`をassertする（null/skipped/cancelled/neutralを許可しない）。tracked worktree empty、real index empty、local branch exactも再assertし、exact token=`WP4158_PUSH_PASS commit=$EXPECTED_COMMIT run=$EXACT_HEAD_RUN_ID workflow=309812329 attempt=1 deployments=0`。timeout後のpush retryは禁止。No tracked record claims its own future AC9 facts。
  - plan_gate_oracles: PLAN never executes a not-yet-materialized verifier。S0 PLAN packet binds base `9a3e715f...`, candidate tree, exact4 paths, this complete authority and token=`WP4158_S0_PLAN_READY base=$EXPECTED_BASE_COMMIT tree=$EXPECTED_CANDIDATE_TREE paths=4`。S1 PLAN begins only after S0 AC9P: require HEAD/local/origin/PR=`LANDED_S0_COMMIT`, exact-head attempt1 CI success、origin/main guard/deployments0、tracked/index clean; reviewers inspect the S0-committed WP-4158 authority and intended S1 exact4 diff/no-extraction/nonclaims; token=`WP4158_S1_PLAN_READY base=$LANDED_S0_COMMIT scope=exact4 verifier=planned`。No future-verifier execution。S2 PLAN begins only after S1 AC9P: require terminal `LANDED_S1_COMMIT`, recorded extracted verifier SHA, clean/parity/main/deployments/CI; intended diff is S1 landing record only and verifier/source pins/handoff byte-identical; token=`WP4158_S2_PLAN_READY base=$LANDED_S1_COMMIT scope=landing-only verifier=$S1_VERIFIER_SHA`。
  - slice_validation_matrix: S0 PLAN=PLAN_READY; IMPLEMENTATION/BUG_REFACTOR=direct S0 commands + diff/proximity review; VALIDATION=direct S0 commands + full workspace gates; COMMIT=AC9C; PUSH=AC9L→one ordinary push→AC9P。S1 PLAN=S1_PLAN_READY then IMPLEMENTATION onward adds verifier syntax/self-test/live exact oracles; S2 PLAN=S2_PLAN_READY then repeats byte-identical S1 verifier plus landing-only diff checks。COMMIT/PUSH use the same AC9 split。Any repair uses its own PLAN_READY, finding-focused exact4 diff, repaired-slice direct commands and AC9; terminal repair substitutes the landed head before downstream continuation。Every material gate fresh exactly5。UI/browser/accessibility N/A。
  - review/landing: S0/S1/S2それぞれPLAN→IMPLEMENTATION→BUG_REFACTOR→VALIDATION→COMMIT→PUSHの各material gateにfresh exactly5 read-only reviewers、全員PASSのみ進行。push後はlocal/origin/PR parity、origin/main guard、deployments0、exact-head attempt1 CI successを確認する。S2 tracked recordはS1の事実だけを記録し、S2自身のfuture commit/push/CI/parityを先取りしない。
  - human_gates: legal/license最終判断、FHIR/conformance、clinical/claim、patient safety、product/architecture、unsigned supply-chain risk acceptanceはtechnical reviewで解除しない。rights matrixはrightsholder、authoritative terms URL/date/version、validation cache/runtime terminology service/UI display/export/public IG/test bundle/Partner Sandbox/SDK/Bulk Dataごとのpermitted/attribution/redistribution/derivative/update obligations、decision、human authority、decision dateを持ち、未決は`UNRESOLVED`。human authorityの記録前はpackage lock/runtime/adoption/publication/SSOT変更をSTOP。
  - plan_review_history: prior generationは2/3 PASSでcleanup5のprobe別terminal reason/exit oracle不足をblock。exact stdout reason、exit0/70/130/143/129、stderr empty、swapped/shared reason拒否へ修正後、fresh reviewers `wp4158_plan_oracle_r1..r5`がcandidate tree `dfe2742acceec22b95c37459c2164735ecbb8cd6`を5/5 PASS。exact4、real index clean、diff/SSOT173/scripts/tracked-overlay secret/residue0、proximity/slices/test/live/cleanup/AC9/nonclaims/human gatesを独立確認し、S0はREADY。
  - implementation_review_history: first generation `wp4158_impl_r1..r3`はtree `0dbd18fa30d13d1cf2e2fdc57927adaae637c8d9`を0/3 PASS。State headingとWP-4157 handoffのstale PLAN projectionを同期後、fresh `wp4158_impl2_r1..r5`がtree `d9cef2a9b2f2be1b78984dbbd283cf5961abfc03`を5/5 PASS。exact4/index/diff/SSOT173/scripts/overlay secret、approved PLAN一致、no verifier/future evidence、nonclaims/human gatesを独立確認。当該implementation checkpointでS0 implementation completed・BUG_REFACTOR review pendingとなり、そのnext actionは後続fifth-generation 5/5でsuperseded済み。
  - bug_refactor_review_history: first generation `wp4158_bug_r1..r3`はtree `0a781c08150b0cf7ca1924f3d27e30305f356a67`を2/3 PASS。stale PLAN/implementation historical wording2件と、empty-directory cleanupだけでも通るfalse-greenをblock。second generation `wp4158_bug2_r1..r3`はtree `de640c446dc7eac1ad190b99f03170f4a1b6cc38`を0/3 PASSとし、pending→final後だけのsignalではpending-phase cleanupを証明しないこと、WP-4154/4155 checkpointのpresent-tense status drift、全exit cleanup claimがSIGKILL/kernel-loss nonclaimと矛盾することをblock。当該second-generation candidateは歴史文を時点限定化し、pending/final各5のexact10 probe、readiness pipe、nested partial-download sentinel、recursive cleanup、sibling canary non-interference、normal/error/catchable signal限定claimを必須化して当時fresh exactly5を再要求し、そのactionは後続fifth-generation 5/5でsuperseded済み。
  - bug_refactor_review_history_3: third generation `wp4158_bug3_r1..r3`はtree `952cb8932a11cb55c2b121da1b1674da20226d81`を0/3 PASS。EVIDENCEの旧five-probe current projection、parent readiness write-FD未close、StateのWP-4154/4155 present-tense checkpoint driftをblock。当該third-generation candidateはexact10 projection、両端FD lifecycle、historical時点限定を同期して当時fresh exactly5を再要求し、そのactionは後続fifth-generation 5/5でsuperseded済み。
  - bug_refactor_review_history_4: fourth generation `wp4158_bug4_r1..r3`はtree `75be9c7066ad7c9a02f64d2eb0d937199bb91ea0`を1/3 PASS。USR1/USR2模擬ではactual normal return/operation exception cleanupを証明しないfalse-green、query/fragmentを単一negativeに束ねるsingle-boundary矛盾、EVIDENCE側WP-4154/4155 checkpoint status driftをblock。当該fourth-generation candidateはactual return/exception、negative exact95、historical時点限定へ修正し当時fresh exactly5を再要求し、そのactionは後続fifth-generation 5/5でsuperseded済み。
  - bug_refactor_gate: fifth generationはcandidate tree `93be844836a59d295a5f0f7e7fb03a8b9a844e09`をfresh `wp4158_bug5_r1,r2,r3c,r4,r5`が5/5 PASS。unresponsive `r3`とそのreplacement途中`r3b`はcountせず、fresh `r3c`だけをslot3 authorityとした。exact4/index/direct gates、negative95、cleanup exact10、status-time boundary、scope/nonclaims/human gatesにblockerなし。S0はVALIDATIONへ進む。
  - validation_bundle: `pnpm install --frozen-lockfile`、workspace typecheck、1,829 tests PASS + local PostgreSQL integration 14 expected skips、script harness、workspace build、OpenAPI drift、deps high0/critical0、SBOM231、boundaries、calculation purity、SSOT173、diff checkをPASS。Next15.5.20 buildは12/12 static pages。`pnpm lint`はexit0だがworkspace packageにlint taskがなくcoverageなし。live secretsはuser-owned `.codegraph`を未読維持するため実行せず、tracked candidate overlay direct `node scripts/check-secrets.mjs`だけをauthorityとして再固定した。real DB zero-skip、browser、runtime、production、legal/FHIR/clinical/claim approvalは非主張。当該validation review actionはfifth-generation 5/5で完了済み。
  - validation_review_history: first generation `wp4158_val_r1..r3`はcandidate tree `08e3d38ccf627e0903b71f836e4dfb0df3fb6c96`を2/3 PASS。検証内容・件数・gate coverageは全員PASSしたが、Plans/Stateのfull-bundle再実行next actionとops/refactor/STATEのhistorical BUG retry 2行がcurrent VALIDATION reviewと矛盾したためblock。当該candidateはnext actionをVALIDATION review-onlyへ同期して当時fresh exactly5を再要求し、そのactionはfifth-generation 5/5でsuperseded済み。
  - validation_review_history_2: second generation `wp4158_val2_r1..r5`はcandidate tree `ef554473070fe5012388e9175e2d8b2a6a9281a2`を4/5 PASS。validation facts/boundariesは全員PASS、EVIDENCEの過去IMPLEMENTATION/BUG段落4箇所にthen-required reviewが未時点限定で残るprojectionだけをblock。全てcheckpoint-qualifiedして当時fresh exactly5を再要求し、そのactionはfifth-generation 5/5でsuperseded済み。
  - validation_review_history_3: third generation `wp4158_val3_r1..r3`はcandidate tree `716bbfab2ba83a67f45be34a7d69053c4078d1c1`を2/3 PASS。validation facts/boundariesは全員PASS、Plansのimplementation/BUG history 4行にpast next-actionが未時点限定で残るprojectionだけをblock。全てcheckpoint-qualifiedして当時fresh exactly5を再要求し、そのactionはfifth-generation 5/5でsuperseded済み。
  - validation_review_history_4: fourth generation `wp4158_val4_r1..r3`はcandidate tree `d6cd4cfe38b86e32fdbf3395c2f6f6ee5c7fb810`を1/3 PASS。validation facts/boundariesは全員PASS、State historical WP-4158 3行とops/refactor/STATE旧resume next-action 1行の未時点限定projectionだけをblock。全てcheckpoint-qualifiedして当時fresh exactly5を再要求し、そのactionはfifth-generation 5/5でsuperseded済み。
  - validation_gate: fifth generation `wp4158_val5_r1..r5`はcandidate tree `bec05c8cdb8292e55f66747f45a7b9c7111917de`を5/5 PASS。exact4/tree/index、full transcript、1829/14、lint/secrets/DB/browser/runtime gaps、chronological/current projection、scope/nonclaims/human gatesを独立確認。S0はCOMMIT reviewへ進む。
  - commit_review_history: first generation `wp4158_commit_r1,r2`はcandidate tree `74142ce8b71c8e3940d2d1ff951f46854af70648`を0/2 PASSで停止し、slot3〜5は未起動。candidate integrity/validationは両者PASS、stale VALIDATION pending projectionと、review-before-stage対AC9C staged requirementの循環、pre-commitで未知の`EXPECTED_COMMIT`必須化をblock。validation historyをsuperseded化し、AC9C input/orderをbase/tree/message + root exact-stage→fresh5 review→commitへ修正した。
  - commit_review_history_2: second generation `wp4158_commit2_r1,r2`はstaged tree `f362d2676c5300813d119e16820e7f8911cba8cf`を1/2 PASSで停止し、slot3〜5は未起動。AC9C integrityは両者PASS、EVIDENCE要約だけが旧pre-commit commit/parent/subject必須を残したためblock。AC9C base/tree/messageとpostcommit AC9L/P commit/parent/subjectへ分離し、restage後fresh exactly5を再要求。
  - commit_review_history_3: third generation `wp4158_commit3_r1,r2`はstaged tree `dc3b1142b3f53ac04a1795277a7349dc35a03531`を1/2 PASSで停止し、slot3〜5は未起動。AC9C integrityは両者PASS、stage完了後もcurrent projectionがstage/restageを再指示する点だけをblock。current next actionをstaged treeへのfresh exactly5 review-onlyへ修正し、この台帳変更の一度きりのrestage後はindex mutation禁止。
  - commit_review_history_4: fourth generationはstaged tree `70e8edb7e895c803cd568534d498e8067135efd9`でreviewer1/2b/3がPASS、reviewer4がFAILし、reviewer5は未起動。応答しなかったoriginal reviewer2は中断してcountしない。Reviewer4はgeneral `commit_push_oracles`がAC9Cにも`EXPECTED_COMMIT`を要求する読みに残り、直後のprecommit boundaryと衝突する点をblockした。general clauseをAC9C base/tree/messageとpostcommit AC9L/P commitへ明示分離し、この修正の一度きりのrestageは完了済み。current actionは新staged treeへのfresh exactly5 review-only。
  - rollback: 明示要求とfresh dependency mapping後だけ、S2 repairs newest-first→S2→S1 repairs newest-first→S1→S0 repairs newest-first→S0をreviewed revert commitで逆順に戻す。S0 originalはWP-4157 projection+plan、S1 originalはrights reproduction、S2 originalはlanding record。runtime/data/artifact rollback不要。historical `f8edc1c`は別承認なしに直接revertしない。
  - landing_record: implementation commit `f8edc1c` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact4 terminology-rights evidence landed、independent verification pending。

- [~] WP-4159 map Phase 1 JP Core profile and terminology reachability(LOW read-only conformance evidence) — LOCAL_LANDED / INDEPENDENT_VERIFY_REQUIRED
  - 発見根拠: WP-0053eの最初のgap inventoryに必要なPhase 1 Resource候補とJP Core 1.2.0 Profileの対応、および選択候補Profileから直接参照されるValueSetのpackage解決先が未記録だった。Profile名だけから採用Profileや許諾対象を決めると、複数候補・Profile不在・継承bindingを見落とす。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。Profile/terminology採用、`meta.profile`、package/lock、artifact保存、SSOT/IG/CI/runtime/codeは変更しない。
  - evidence: fingerprint済みJP Core 1.2.0 packageをtemp再取得し、19対象Resource typeに32 constraint Profileを確認。14 typeは候補あり、`Provenance` / `AuditEvent` / `DetectedIssue` / `Task` / `Communication`は候補なし。`MedicationRequest` 2、`MedicationDispense` 3、`Condition` 2、`Observation` 15で選択曖昧性があり、Observationの1件はdraft。candidate snapshot binding 417 profile-path行 / 128 unique ValueSet URLは、JP Core local 22/15、JP terminology 1.4.0 50/25、FHIR core 329/80、FHIR coreとHL7 terminologyの双方に収録16/8へ全件解決した。
  - acceptance/review: 対象typeの候補数、Profile不在、複数候補、status/baseDefinition境界、直接ValueSet bindingの解決先を再現可能に記録する。snapshotの全候補合算を採用済みProfile、実運用で到達済みterminology、transitive CodeSystem closure、法的clearanceまたはJP Core適合主張へ昇格しない。FHIR/terminology/clinical/legal reviewとWP-0053b-dのhuman gate前に選定・lock・実装しない。別agent verifier未実施。
  - validation: 4 artifact SHA-256再照合とprofile/binding count再計算PASS、`pnpm check:ssot-index` PASS(173)、tracked snapshot + exact4 overlay secret scan PASS、`git diff --check` PASS。live `pnpm check:secrets`は既知のuntracked `.codegraph` symlinkでprotected scopeを検証できずfail-closed。
  - rollback: docs-only evidence commitと後続ledger commitをrevertする。temp artifactは削除し、runtime/data/package rollback不要。
  - landing_record: implementation commit `7375cbf` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact4 profile/reachability evidence landed、independent verification pending。

- [~] WP-4160 map priority Profile cardinality / Must Support decisions(LOW read-only conformance evidence) — LOCAL_LANDED / INDEPENDENT_VERIFY_REQUIRED
  - 発見根拠: WP-4159でPatient/Coverage/MedicationRequest/MedicationDispenseの候補Profileは特定したが、候補間の構造差とJP Coreが派生IGへ委ねるMust Support責務が未分離だった。snapshotの`mustSupport=true`が0件であることを「対応不要」と誤解すると、producer/consumer・欠損・保存再応答契約が未定義のままになる。
  - scope: exact4 `ops/refactor/EVIDENCE.md`, `Plans.md`, `State.md`, `ops/refactor/STATE.md`。Profile選定、Must Support付与、identifier mapping、clinical/claim判断、`meta.profile`、package/lock、SSOT/IG/CI/runtime/codeは変更しない。
  - evidence: official JP Core 1.2.0 guidanceはMust Support付与を原則派生projectへ委ねる。priority 7 candidate Profileは全てsnapshot/differential Must Support 0。differential element/cardinality/direct-binding/reference-target/invariant rowsはPatient `53/5/0/5/0`、Coverage `40/9/0/6/0`、MedicationRequest general `65/16/4/10/1`、injection `62/13/3/11/1`、MedicationDispense base `38/11/0/8/0`、general `8/4/1/1/0`、injection `4/0/0/2/0`。sliceの反復pathを含む機械行数であり、必須業務項目数ではない。
  - acceptance/review: JP Core guidance、candidate hierarchy、cardinality、direct binding、targetProfile、invariantとMust Support不在を別軸で記録し、general/injection/base、identifier、cross-server Reference、preferred/example terminology、producer/consumer/missing-dataの決定質問をhuman reviewへ明示する。0件をMust Support不要、cardinalityだけをsemantic completeness、narrative guidanceを機械制約、候補差分を採用済みcontractへ昇格しない。別agent verifier未実施。
  - validation: JP Core artifact SHA-256と7 Profile集計fixture再計算PASS、`pnpm check:ssot-index` PASS(173)、tracked snapshot + exact4 overlay secret scan PASS、`git diff --check` PASS。live `pnpm check:secrets`は既知のuntracked `.codegraph` symlinkでprotected scopeを検証できずfail-closed。
  - rollback: docs-only evidence commitと後続ledger commitをrevertする。temp artifactは削除し、runtime/data/package rollback不要。
  - landing_record: implementation commit `b96d0ec` pushed to `origin/agent/reconcile-wp9002-w7c-20260712`; exact4 priority-profile obligation evidence landed、independent verification pending。

- [x] WP-4161 align CI pnpm toolchain with repository pin(MEDIUM CI/supply-chain control) — FINALIZED / REMOTE_CI_PASS
  - 発見根拠: repositoryの`packageManager`はWP-4147でpnpm 11.13.1へ更新済みだが、GitHub Actionsはpnpm 10.33.2を固定していた。pnpm 10系のdependency audit endpointはHTTP 410でfail-closedとなるため、localとremoteでtoolchain/gate結果が分岐していた。
  - scope: source exact1 `.github/workflows/ci.yml`。`pnpm/action-setup`のversion scalarだけを11.13.1へ更新し、trigger、PostgreSQL service、Node 24、step名・順序・command、env、package/lock/workspace manifest、deploy behaviorは不変。
  - verification/review: `actionlint`、frozen install(lock差分0)、script harness、workspace typecheck/test/build、OpenAPI/purity/boundaries/SSOT173、tracked-snapshot secrets、deps high0/critical0、SBOM231、diffをPASS。live secret scanは既知のignored user-owned `.codegraph` symlinkでfail-closed。read-only independent verifierはexact1 diffと全workflow invariantをPASS。
  - remote_verification: draft PR #1 run `29499861743` job `87625797181`はrepository pinと同じpnpm 11.13.1でinstall、typecheck、workspace test、script harness、build、OpenAPI、secrets、dependency audit、SBOM、boundaries、calculation purity、SSOT indexを全件PASS。PostgreSQL integrationは14/14をzero-skip PASSし、WP-4092/WP-4143のremote proofも同runで完了した。
  - rollback: implementation commit `c688d4b` と後続ledger commitをrevertする。dependency/data/DB rollback不要。
  - landing_record: implementation commit `c688d4b`はsafe feature branchへpush済み。remote CI proofはdraft PR #1 run `29499861743`で取得しFINALIZED。

- [ ] WP-4162 wire mandatory patient-view audit across PHI read surfaces(HIGH privacy/security/audit) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: APPROVED MOD-008/SEC-007は要配慮情報閲覧を`patient.viewed`で必須記録し、outcome必須・targetRefはPHIを含まないID参照のみと定める。一方、`apps/api/src/server.ts:223-299`の`GET /patients/search`、`:302-333`の`GET /patients/:patientId`、`:336-385`の患者投影を含む`GET /reception/queue`はtenant/scope/no-storeを実装済みだがaudit appendへ未接続。
  - impact: 誰がどの患者情報へアクセスしたかを追跡できず、不正閲覧調査、privacy accountability、監査完全性が未達。既決の「閲覧監査必須」「PHI-free identifier-only targetRef」「outcome必須」はhuman reviewで緩和しない。
  - required decision: search/bulk/listのevent粒度、0件/denied/failedの記録境界、ordering、audit sink障害時のread可否、retry/reconciliation、identifier集合のdata minimization、retention/observabilityをprivacy/security/data-integrity/medical-safety authorityが承認する。
  - stop conditions: human-approved SSOT/plan前にruntime/API/DB/migrationを変更しない。患者氏名・カナ・生年月日・検索語をaudit payload/targetRef/logへ含めない。audit失敗を成功として隠さず、既存tenant/permission/no-store境界を弱めない。
  - acceptance: approved policyに従いsearch/get/queueのsuccess/denied/failedとbulk cardinalityをsynthetic testsで固定し、targetRefはidentifier-only、tenant/pharmacy/actor/outcome/chainを検証。audit append/recoveryのDB integration、privacy/security/medical-safety review、full gates、local browser journey後にのみ完了扱いとする。

- [x] WP-4163 prevent patient-query URL fallback when hydration is unavailable(HIGH privacy / R2 implementation) — FINALIZED / INDEPENDENT_PASS_WITH_NOTE
  - finding: WP-4149独立browserのstale `.next` hydration failure時、PatientSearchのReact `preventDefault()`が接続されず、named `q` inputがnative default GETでsynthetic検索語を`/patients?q=...`へserializeした。患者氏名・カナ・患者番号がaddress bar/history/bookmark/referrer/request-target logへ残り得て、R-URLSTATEのPHI query非永続方針に反する。
  - scope/implementation: source exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。formを`method="post" action="/patients"`へ固定しinputの`name`を除去。hydrated `preventDefault()`/`runSearch(q)`、label/id、Enter submit、focus、maxLength、loading guard、API/contracts/SSOTは不変。no-hydration fallbackはqueryをURL/bodyへ送らずPOST失敗へfail-closedする。
  - verification/review: static markup regression、focused44、Web337、Web typecheck/build、boundaries、SSOT173、diff PASS。independent privacy/security reviewerはexact2、native successful-control非serialize、通常hydrated semantics/accessibility不変を`PASS`。fresh hydrated pointer searchは結果表示とURL `/patients`/query空をPASS。automationにJS-disableがなくCLI Enterが状態変化を証明しないため、完全なno-JS native browser submissionはnoteとして未証明。通常API GET `/patients/search?q=...`のrequest-target exposureは既存contractの別scope。
  - rollback/landing: implementation commit `71fee96`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。revert時はhydration failureでPHI query URL persistenceが再発するためprivacy review必須。

- [x] WP-4164 repair PostgreSQL audit advisory-lock key and migration CI drift(HIGH audit availability / R2) — FINALIZED / REMOTE_CI_PASS
  - finding: main CI run `29498358296`でPostgreSQL統合実行時、`PostgresAuditRepository`がadvisory lock用text parameterへruntime NULを含むkeyを渡しSQLSTATE `22021`でaudit append 5件が失敗した。加えてmigration-runner integrationのfull-history期待が`000003`で止まり、現行`000004_create_audit_events.sql`の正常適用を失敗扱いした。mock-only local gateはquery parameterを検証せず前者を見逃していた。
  - scope/implementation: source exact4 `apps/api/src/db/audit-repository.ts`, `apps/api/src/db/audit-repository.test.ts`, `apps/api/src/db/audit-repository.integration.test.ts`, `apps/api/src/db/migration-runner.integration.test.ts`。domain-separated JSON tuple `['yrese.audit.scope.v1', tenantId, pharmacyId]`を単一helperで生成し、production lockとobserved-concurrency blockerで共有する。unit testはNUL非生成、UTF-8 roundtrip、quote/backslash/Unicode、ambiguous concatenation、scope swapを固定。migration full-history期待だけを`000004`へ同期し、legacy rollback期待は不変。
  - boundaries: tuple preimageの一意性だけを保証し、PostgreSQL `hashtextextended` 64-bit hash自体の無衝突は主張しない。migration SQL/checksum/history semantics、lock transaction/seed、audit event/schema、API/contracts、tenant/pharmacy branded ID、logging/PHI、production DBは変更しない。WP-4050のreception/audit atomicity、WP-4151c、WP-4162は未解決のhuman gateとして維持する。
  - local verification: focused unit 28 PASS、API 272 PASS + PostgreSQL 14 expected skips、API typecheck/build、boundaries、diff check PASS。live secret scanは既知のuntracked `.codegraph` symlinkでprotected scopeをfail-closedとし、tracked snapshot gateはPASS。security/medical/privacy/data-integrity read-only reviewは実装方針をAPPROVED。draft PR #1の初回run `29499482385`ではNUL起因4件とmigration2件がzero-skip PASSし、observed-concurrency 1件だけが`application_name`によるwaiter間接観測のtimeoutを検出した。follow-upはblockerが保持する`pg_locks`の`database/classid/objid/objsubid=1`を取得し、同一resourceのungranted row 2件を直接観測するtest-only修正とした。
  - final verification: independent diff verifierとsecurity/privacy/medical/data-integrity reviewはAPPROVED。draft PR #1 run `29499861743` job `87625797181`でaudit integration 5/5、migration integration 2/2、PostgreSQL repository integration 7/7、API 286/286をzero-skip PASS。workspace typecheck/test/build、script harness、OpenAPI、secrets、dependency audit high=0/critical=0、SBOM231、boundaries、calculation purity、SSOT173を含む全stepがgreen。WP-4092/WP-4143/WP-4161のremote proofも同runで完了。
  - rollback: WP-4164 exact7 commitをrevertする。migration/data rollbackは不要。migration適用、production write、lock transaction範囲変更が必要になった場合は停止してhuman approvalへ戻す。

- [x] WP-4165 minimize GitHub Actions trust surface(MEDIUM CI/supply-chain / R2) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS
  - finding: `.github/workflows/ci.yml`の`actions/checkout`、`pnpm/action-setup`、`actions/setup-node`はmutable major tag `@v4`を参照し、workflow-level token permissionも未定義。checkoutは既定でcredentialをpersistするが、本CIはrepository writeを行わない。PostgreSQL service imageは既にdigest pin済み。
  - official evidence: 2026-07-16にofficial upstream refsをread-only取得し、checkout v4.3.1=`34e114876b0b11c390a56381ad16ebd13914f8d5`、setup-node v4.4.0=`49933ea5288caeca8642d1e84afbd3f7d6820020`、pnpm/action-setup annotated v4.4.0 peeled commit=`fc06bc1257f339d1d5d8b3a19a8cae5388b55320`を確認。GitHub official secure-use guidanceはfull-length commit SHAだけをimmutable action releaseとして扱う。
  - scope: exact2 `.github/workflows/ci.yml`, `scripts/check-scripts.mjs`。3 actionを上記40桁SHAへpinしてversion commentを残し、workflow-level `permissions: contents: read`とcheckout `persist-credentials: false`を追加する。trigger、job/service digest、timeout、Node 24、pnpm 11.13.1、cache、step/env/command/order、package/lock、DB/runtime/deploy behaviorは不変。
  - acceptance: 全external `uses:`がreview済みexact SHA、token permissionがcontents read-only、checkout credential非永続となる。script harnessが3 action identity、mutable ref不在、exact permission、credential非永続をfail-closed固定する。`actionlint`、`pnpm test:scripts`、workspace typecheck/test/build、OpenAPI、tracked-snapshot secrets、deps high0/critical0、SBOM、boundaries、calculation purity、SSOT index、diff checkをPASSする。
  - stop/remote gate: action owner/version/commit provenanceがofficial refsと一致しない場合、write/id-token/packages permissionが必要になった場合、または既存CI invariantを保持できない場合は実装停止。local completion時点ではpush authority不在のためremote proofを分離したが、後続goal instructionがsafe feature branchへのcommit/pushを明示した。
  - rollback: 今回のremote evidence reconciliationはledger-only commitだけをrevertする。security implementationを戻す場合は`1febf57`単独revertでmutable tagへ戻してはならず、review済みの別immutable SHAへ更新するか該当workflowを停止して再gateする。DB/data rollback不要。
  - local verification: `actionlint`、semantic YAML harness、workspace typecheck/test/build、OpenAPI、calculation purity、boundaries、SSOT173、deps high0/critical0、SBOM231、tracked-snapshot secret scan、diff checkをPASS。Web337、API272 + PostgreSQL14 expected skips、audit183、calculation87。regex案は改行空白、flow-style YAML、detached version commentのfalse-negativeを独立reviewで反証され、既存direct devDependency `yaml`のsemantic parseとnegative fixturesへreframeした。
  - review/landing: independent verifierとsupply-chain/security reviewerは3 SHA provenance、annotated pnpm tagのpeeled commit、exact-once action set、step/job/flow uses、block/scalar/flow permission拒否、inline version provenance、checkout credential非永続、既存workflow invariantを最終PASS。implementation `1febf57`とledger `e02859e`はdescendant remote-evidence head `020965f`に含まれる。draft PR #1 CI run `29601464612` / job `87954323760`はexact head `020965f`で3 pinned actionを解決し、install/cache、PostgreSQL zero-skip、全workflow stepをSUCCESS。local/remote/PR headは同headで一致し、deployments 0、origin/main `27d6144`不変を確認した。これは当該headのGitHub-hosted CI proofであり、future upstream provenance、production、deploy、広範なrelease readinessは非主張。remote reconciliation PLAN_GATEはP2 remediation後5/5 PASS。

- [x] WP-4166 remove unused arbitrary in-memory reception seed seam(LOW dev-runtime integrity / R1) — FINALIZED / INDEPENDENT_PASS
  - finding: `InMemoryReceptionRepository`のpublic constructorは任意の`ReceptionRecord[]`を受け取れるが、repository内の唯一のconsumerは引数なし生成である。任意seedを渡した場合だけ、scoped idempotency map未復元、sparse ID採番、patient snapshot不一致などの擬似永続化invariantが未定義になる一方、そのfixture hydration contractを要求するapproved SSOT/test/runtime consumerは存在しない。
  - scope: implementation exact1 `apps/api/src/reception-repository.ts`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。`apps/api/src/server.ts`と`apps/api/src/server.test.ts`は既存behaviorのno-edit verification evidenceとする。Web、contracts/OpenAPI、PostgreSQL repository/migration、SSOT、package/lock、CIは変更しない。
  - acceptance: arbitrary seed constructor parameterを削除し、emitted/public constructor signatureをzero-argumentに制限する。非exportの`ReceptionRecord`と固定synthetic recordsは維持し、各instanceがrecords arrayをcloneする。default serverのstable list order、最初のcreated ID `reception-000004`、JST business date、created/existing/conflict、scoped idempotency、audit/API response semanticsを不変にする。fixture hydration、reload/Edge recovery、ambiguous retry lifecycleを新たに主張せず、WP-4151c human gateを変更しない。
  - verification: 既存`server.test.ts`のstable list order、first created ID/JST date、same-key replay、different-patient conflictをfocused 4/4 PASS。API272 + PostgreSQL14 expected skips、Web337、audit183、calculation87、workspace typecheck/test/build、lint、script harness、OpenAPI、purity、boundaries、SSOT173、deps high0 critical0、SBOM231、tracked-snapshot secret scan、diffをPASSした。live secret scanだけは既存user-owned ignored `.codegraph` symlinkでprotected scopeをfail-closedとし、対象外symlinkへは触れていない。
  - stop: arbitrary fixture hydrationを維持する実consumer/approved requirement、constructorへ引数を渡すtracked TS/JS/d.ts call site、default `reception-000004`の変化、またはserver/test/contract/DB変更の必要性が見つかった場合はscopeを広げず実装停止し、scoped duplicate/key/patient/sparse-ID invariantを含む別WPへ再計画する。production data/write/migration/deployは行わない。
  - rollback: WP-4166 implementation/ledger commitをrevertする。DB/data rollback不要。
  - review/landing: read-only plan reviewerはR1/READY、independent diff verifierとsecurity/privacy/medical/data-integrity/API/DB reviewerはPASS/APPROVED。tracked class consumerはserverの1件、argument-passing consumerは0件で、private API package外の未追跡consumerだけをLOW residual compatibility riskとして分離した。implementation exact1 commit `7c366ea`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4167 enforce exact pnpm toolchain authority(MEDIUM tooling/supply-chain / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: repository/CIの実行pinはpnpm 11.13.1だが、root `engines.pnpm`は既知にdependency audit gateを通せないpnpm 10を含む`>=10`のままで、`pnpm-workspace.yaml`にもversion mismatch policyがない。script harnessはCI action SHAを検証するが、manifest/workspace/CIのpnpm authority一致を検証しない。
  - official evidence: pnpm 11.x official `package.json` docsはroot `engines.pnpm`不一致をlocal developmentで拒否するとし、official settings docsは`pmOnFail`の既定`download`と`error`のfail behavior、project設定先`pnpm-workspace.yaml`を定義する。https://pnpm.io/package_json#engines / https://pnpm.io/settings#pmonfail
  - scope: implementation exact3 `package.json`, `pnpm-workspace.yaml`, `scripts/check-scripts.mjs`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。`.github/workflows/ci.yml`は11.13.1のno-edit evidence、`docs/ui-ux-refresh/00-repository-baseline.md`は2026-07-11 historical snapshotとしてno-edit。`pnpm-lock.yaml`, `.npmrc`, dependencies/devDependencies, `allowBuilds`, apps/packages/runtime/DB/contracts/OpenAPI/SSOTは変更しない。
  - acceptance: `engines.pnpm`と`packageManager`とCI setupをexact 11.13.1へ一致させ、`pmOnFail: error`で宣言版不一致時のimplicit downloadを拒否する。semantic harnessがmanifest/workspace/CIをparseし、permissive/mismatched engine、mismatched packageManager、missing/non-error mismatch policy、CI version mismatchをfail-closed検出する。current 11.13.1のfrozen installはlock差分0、build allowは既存`esbuild`/`sharp`だけ、標準full gatesをPASSする。
  - stop: official/current pnpmが`pmOnFail: error`をhonorしない、tracked automationが別pnpm版を意図的にsupportする、CI/action/lock/dependency/allowBuild変更が必要、frozen installがlockfileを変える、またはimplicit pnpm downloadが明示要件と判明した場合はscopeを広げず再計画する。pnpm 10を実行/downloadしてnegative testにしない。
  - rollback: WP-4167 implementation/ledger commitをrevertする。dependency/data rollback不要。
  - verification: semantic harnessはpermissive/mismatched/coordinated version、missing/warn `pmOnFail`、malformed/duplicate config、missing/duplicate CI setup、allow-list拡大、`dangerouslyAllowAllBuilds: true`、`strictDepBuilds: false`をnegative fixtureで拒否してPASS。pnpm 11.13.1 frozen installはAlready up to date/lock差分0。Web337、API272 + PostgreSQL14 expected skips、audit183、calculation87、workspace typecheck/test/build、lint、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231、tracked-snapshot secret scan、diffをPASS。live secret scanは既存user-owned ignored `.codegraph` symlinkでprotected scopeをfail-closedとし、対象外symlinkは変更していない。
  - review/landing: read-only mapper/plan reviewerはR2/READY。初回independent reviewのnegative-matrix不足とsupply-chain reviewのbuild-policy bypass指摘をfixture/guardへ反映後、independent verifier PASS、supply-chain/tooling reviewer APPROVED。CI action SHA/version、lock、historical baseline、dependencies/build allow/runtime/DB/SSOTは不変。implementation exact3 commit `b27af80`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4168 surface API startup cleanup failure without raw error leakage(LOW operational/privacy integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: API startup catchは`server.close()` rejectionを捨て、`process.exitCode=1`と唯一のobservable `console.error`をcleanup完了後まで遅延する。server loggerは`logger:false`でno-opのためcleanup failureは見えず、現行raw error console出力はDB/config/URL/identifier detailを含み得る。
  - scope: implementation exact3 `apps/api/src/main.ts`, new `apps/api/src/startup-failure.ts`, new `apps/api/src/startup-failure.test.ts`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。server/config/DB/pool/migration/repository/contracts/OpenAPI/packages/Web/CI/package/lock/SSOTは変更しない。
  - acceptance: injected helperがoriginal error identityをprimaryとして保持し、exit code 1をreport/cleanup前に設定する。server未生成時はclose 0、生成時はclose最大1回。close成功はstartup fixed stderr signalだけ、close rejection/synchronous throwはstartup→cleanup fixed stderr signalを出し、originalを上書き/rethrowしない。reporter failureでもexit設定とcleanup attemptを維持する。production reporterへError/message/stack/cause/code/env/URL/IDを渡さず、raw identityはhelper result/testだけで検証する。これはOPS-009 structured operational log/error-code complianceを主張せず、既存observability gapを別scopeとして維持する。success/listen semanticsは不変。
  - stop: logger transport/schema、signal/graceful shutdown、timeout/forced exit、listen/retry、server construction、DB pool/onClose lifecycle、別の`pool.end()` masking、`process.exit()`へscopeが広がる場合は実装停止して再計画する。production raw exception detailが必要ならprivacy/operations契約へ戻す。
  - verification: focused helper tests、API typecheck/test/build、workspace standard gates、diff、independent operational/privacy/security reviewをPASSする。
  - rollback: WP-4168 implementation/ledger commitをrevertする。DB/data rollback不要。
  - verification: focused helper 7/7、API279 + PostgreSQL14 expected skips、API/workspace typecheck/test/build、lint、script harness、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231、tracked-snapshot secret scan、diffをPASS。初回independent reviewで合法な`throw/reject undefined`がsuccess sentinelと衝突するbugを検出し、明示`cleanupFailed`と同期throw/rejection fixtureで修正後に再PASSした。
  - review/landing: read-only mapper/plan reviewerはexact3 R2/READY。sentinel bug修正後のindependent verifierはPASS、privacy/security/operational reviewerはAPPROVED。fixed stderr reporterはOPS-009 structured log complianceを主張せず、reporter failure、close hang/timeout、別`pool.end()` maskingを既存residual/別scopeとして維持する。implementation exact3 commit `2ced725`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4169 preserve API startup initialization failure across PostgreSQL pool cleanup failure(LOW operational/privacy integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: PostgreSQL modeのserver構築前catchはprimary migration/config/server-construction error後に`await pool.end()`を実行し、cleanupがreject/synchronous throwするとprimaryをcleanup errorで上書きする。WP-4168のouter handlerは`server === undefined`で上書き後のidentityしか受け取れず、原因優先順位を失う。
  - pre-plan: read-only mapper/plan reviewerはR2/READY。WP-4050/WP-4151c/WP-4162はhuman/SSOT gate、WP-4077/WP-7001はre-plan、WP-4165 remote proofはpush authority待ちであるため、本件を最上位の即時実装可能code sliceとした。
  - scope: implementation exact3 `apps/api/src/main.ts`, `apps/api/src/startup-failure.ts`, `apps/api/src/startup-failure.test.ts`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。server/config/DB pool/migration/repository/contracts/OpenAPI/packages/Web/CI/package/lock/SSOTは変更しない。
  - acceptance: pool取得後かつserver return前のfailureでpool cleanupをexactly once試行し、成功時はexact original identityをouter handlerへ渡す。cleanup rejection/synchronous throwはopaque envelopeでoriginalをprimary、cleanupをsecondaryとして分離し、`throw/reject undefined`も明示discriminatorでfailure扱いする。outer handlerはexit code 1をreport前に設定し、startup→database-pool-cleanupの固定signal順だけを出す。raw Error/message/stack/cause/code/env/URL/IDはreporterへ渡さず、reporter failureもidentityを置換しない。listen failure、server close、successful server/onClose pool lifecycleは不変。OPS-009 structured observability complianceは主張しない。
  - stop: pool timeout/forced termination、retry、signal/graceful shutdown、logger transport/schema、pool config、migration behavior、multiple-resource orchestration、`process.exit()`、successful serverのonClose順序へ広がる場合は実装停止して再計画する。DB接続、migration適用、DML、production write/deployは実行しない。
  - rollback: WP-4169 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused helper18、API290 + PostgreSQL14 expected skips、API/workspace typecheck/test、API build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diffをPASS。live secret scanは既存ignored symlinkでprotected scopeをfail-closedとし、current exact差分を重ねたtracked snapshot scanはPASS。
  - review/landing: 初回independent diff reviewでarbitrary caught Proxyへの`instanceof`がprototype trapでouter catchを再throwし得るMEDIUM bugと、cleanup resultのimpossible stateを許すLOW型不変条件を検出。module-private WeakMap ownership、hostile Proxy/forged envelope fixture、discriminated result unionへ修正後、independent verifier PASS、privacy/security/operations reviewer APPROVED。implementation exact3 commit `5a6a680`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4170 abort superseded patient-search transport work(LOW patient-PHI resource/privacy hygiene / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient searchはgeneration/query/cursor guardでstale success/failureのUI commitを拒否するが、superseded/blank/unmount後のfetchとresponse body処理は継続する。wrong-patient state authorityは解消済みであり、本件はbest-effort transport/resource minimizationに限定する。
  - pre-plan: read-only mapperはWP-4169後のtop code候補、plan reviewerはR2 `READY_WITH_PINS`。`emil-design-eng`のunseen interaction detailとして、見た目・animationを増やさず次のauthority確定時に古いworkを停止する。generation guardを唯一のcommit authorityとして維持し、AbortControllerへserver処理/request log/audit/privacy erasureを主張しない。
  - scope: implementation exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/OpenAPI/server/repository/DB/cursor/dev headers/transport base/PatientContext/PatientHeader/CSS/DOM/copy/ARIA/package/lock/SSOTは変更しない。
  - acceptance: admitted nonblank requestはfresh AbortSignalをfetch transportへ渡す。新full/異なるappend/blank/unmountはgenerationを先に進めてolder controllerをabortし、signal無視/race時も既存guardがstale commitを拒否する。同一active trim-equivalent append tupleはgeneration/abort/emit/fetch前にcoalesceしownerを中断しない。settlement/failure後retryはfresh non-aborted signal、exact-owner cleanupを維持する。unmount cleanupはemitせず反復安全で、runnerを永久disposeせずStrictMode再利用可能。AbortErrorをErrorNoticeへ表示せず、loading/retained rows/cursor/selection/focus/DOM/copyは不変。
  - stop: API/server cancellation、timeout/retry/debounce/auto-search、same-flight owner abort、concurrent authoritative append merge、loading/error/copy/DOM/ARIA変更、query URL変更、server-side cancellation/audit/privacy erasure主張が必要なら停止して再計画する。
  - rollback: WP-4170 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused patient-search53、Web346、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。browser QA skillはone-time build未setupのため実ブラウザ証拠なし。DOM/copy/ARIA/visual不変はstatic render、Web build/test、independent frontend/accessibility reviewで確認した。
  - review/landing: 初回independent reviewでabort/emit同期re-entry後にobsolete fetch/warningを開始できるMEDIUM bug、再reviewでunmount cancelのabort listenerから新fetchが生存できるMEDIUM bugを検出。abort/emit後とstate updater内のgeneration guard、exact-token owner release helper、cancel中だけのtemporary barrierへroot-cause refactorし、4 adversarial re-entry fixture追加後にindependent verifier PASS、frontend/accessibility/privacy/security/medical/API reviewer APPROVED。implementation exact2 commit `5ef6cf7`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4171 abort superseded patient-context refresh transport(LOW selected-patient PHI resource/privacy hygiene / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: selected patient get-by-id refreshはgeneration guardでclear/switch/path change/unmount後のlate callbackを拒否するが、旧fetch/response body処理は継続する。patient identity UI authorityは既に保護済みで、本件はbest-effort client transport/resource minimizationに限定する。
  - pre-plan: read-only mapper/plan reviewerはR2 `READY_WITH_PINS`かつWP-4170後の最上位実行可能code follow-up。patient-searchのmultiple controller/append/emit semanticsとpatient-contextのsingle owner/terminal callback semanticsは異なるため、shared cancellation utilityを抽出せずlocal exact2とする。generationを唯一のcontext authorityとして維持し、server処理/log/audit/privacy erasureを主張しない。
  - scope: implementation exact2 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。patient-search/API/contracts/OpenAPI/server/repository/DB/PatientContext provider/value/PatientHeader/DOM/copy/ARIA/CSS/route trigger/dev headers/base/package/lock/SSOTは変更しない。
  - acceptance: admitted refreshはfresh signalをfetch transportへ渡し、new refreshはnew owner公開後にold ownerをabortしてgenerationを再確認する。invalidateはgeneration advance→owner detach→abort、cancel中re-entryをtemporary barrierで副作用なくdropし、後続refreshで同runnerを再利用可能。abort rejection/signal-ignore late settleはcallback zero。exact-owner finallyはreplacement ownerを消さず、settled ownerはterminal callback前にreleaseする。current 200/404/failure、stale badge、clear-before-selection解除、pathname refresh頻度、identity checkは不変。
  - stop: shared abstraction/patient-search再編集、server cancellation、timeout/retry/debounce/coalescing/cache、refresh頻度、404 removal/stale/selection/copy/DOM/ARIA変更、audit/privacy-erasure主張、永久disposeが必要なら停止して再計画する。
  - rollback: WP-4171 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused patient-context34、Web354、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。browser QAはWP-4170記録どおりtool one-time build未setupで実ブラウザ証拠なし。DOM/copy/ARIA/visual不変はstatic render、Web build/test、independent frontend/accessibility reviewで確認した。
  - review/landing: 初回independent reviewでfailure callbackだけexact-owner release前に実行され、callback-started refreshがsettled signal abort listener経由でreplacement authorityを失い得るMEDIUM bugを検出。success/failure discriminated outcomeをfinally release後にdispatchし、failure callback re-entry fixtureで旧signal非abortと意図した新patient authorityを固定後、independent verifier PASS、frontend/accessibility/privacy/security/medical/API reviewer APPROVED。implementation exact2 commit `8424c3a`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4172 abort superseded reception-queue GET transport(LOW multi-patient PHI resource/privacy hygiene / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: reception queueはgenerationでstale success/failureのstate commitを拒否する一方、別業務日付・unmount後も旧GETとbody処理を継続する。また受付登録POSTがtrue unmount後に完了すると、client continuationがqueue GETとURL replaceを再開し得る。POSTはcommit outcomeを曖昧化しないよう中断せず、obsolete client continuationだけを停止する。
  - pre-plan: read-only mapper/plan reviewerはR2 `READY_WITH_PINS`。ユーザーはPOST/idempotency/audit semanticsへの変更を許可したが、GET cancellationとmounted lifecycleのroot causeには不要であり、WP-4151c/WP-4050/WP-4162の未承認normative decisionを補完しないため変更しない。
  - scope: implementation exact2 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/contracts/OpenAPI/server/repository/DB/POST body/idempotency key/audit event/DOM/copy/ARIA/CSS/package/lock/SSOTは変更しない。
  - acceptance: queue GETはfresh signalを受け、same-target active callはexact Promiseへjoinしてownerをabortしない。different targetはnew owner/generation公開後にold GETをabortし、A-B-A、abort-aware/ignoring settle、delayed functional updaterでもlatest generationだけをcommitする。cancelはgeneration advance→owner detach→abort、同期re-entryを一時barrierでdropし、StrictMode再setup後にrunnerを再利用できる。true unmount後のPOST completionはserver-side settleとregistration lock releaseを維持しつつ、UI state/queue target/URL/GET continuationを開始しない。
  - stop: POST cancellation、ambiguous outcome/idempotency key lifecycle、audit append/granularity/failure/atomicity、server cancellation、timeout/retry/polling、URL/target authority、same-flight owner abort、shared cross-feature abstraction、UI state/copy/DOM/ARIA変更が必要ならR3/human/SSOT reviewへ再計画する。AbortControllerにserver処理/log/audit/privacy erasureを主張しない。
  - rollback: WP-4172 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused reception-dashboard78、Web362、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。browser tool未setupのため実ブラウザ未検証。DOM/copy/ARIA/focus不変はstatic render/full Web test/buildとindependent reviewで確認した。
  - review/landing: buffered updater、A-B-A abort-ignore settle、replacement publish-before-abort、settled controller detach、cancel abort-listener re-entry、late POST lifecycleをfixture化。independent verifier、frontend/accessibility/medical/API、privacy/security reviewerはblocking finding 0でPASS/APPROVED。実component mount/unmount harness不在はLOW/non-blocking residualとして維持する。implementation exact2 commit `3772dc9`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4173 keep audit-log evidence authoritative during deferred updater evaluation(MEDIUM audit evidence integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: audit-log runnerはemit呼出前にgenerationを確認するが、Reactが後で評価し得るloading/success/failure functional updater内部では再確認しない。obsolete healthy evidenceがnew broken-chain CRITICALを正常へ戻す、またはstale failure/loadingがreplacement evidenceを覆う可能性がある。
  - pre-plan: fresh read-only mapper/plan reviewerはR2 `READY_WITH_PINS`かつWP-4172後の最上位実行可能code slice。`GET /audit/events`は`audit.viewed`をappendするためadmitted GETは中断・抑制せず、generationを唯一のstate authorityとしてupdater evaluationだけをhardeningする。
  - scope: implementation exact2 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。fetch transport/AbortController/API/server/audit event/repository/DB/contracts/OpenAPI/active-flight policy/DOM/copy/ARIA/CSS/package/lock/SSOTは変更しない。
  - acceptance: loading/success/failure updaterはcaptured generationをevaluation時に再確認し、obsoleteならexact `prev` identityを返す。buffered old healthy→new broken、old broken→new healthy、old failure→new evidence、invalidate後updaterはlatest stateを変更せずraw evidence/errorを露出しない。same-active exact Promise、loading emit 1、admitted GET 1、invalidate A→B GET 2、exact-owner cleanup、retry、retained evidence/chain displayは不変。
  - stop: AbortSignal/cancellation/timeout/response short-circuit、audit.viewedの抑制・集約・取消、API/server/audit/repository/DB/contracts/OpenAPI、sharing policy、shared runner abstraction、UI copy/DOM/ARIA変更が必要ならR3/human/SSOT reviewへ再計画する。
  - rollback: WP-4173 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused audit-log54、Web366、API audit-log23、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。browser/actual React concurrent schedulerは未検証だが、functional updater buffer/replayをrunner契約として直接固定した。
  - review/landing: buffered old healthy→new broken、old broken→new healthy、old failure→new broken、invalidate後loading/successをexact identity no-opでfixture化。independent verifier、audit/frontend/accessibility、security/privacy/audit-integrity reviewerはblocking finding 0でPASS/APPROVED。`audit.viewed`、admitted GET回数、broken-chain CRITICAL、retained evidence、DOM/copy/ARIA/focusは不変。implementation exact2 commit `368f9c5`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4174 bind browser reception entries to requested JST business date(MEDIUM queue PHI/workflow integrity defense-in-depth / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: APIはqueue response全entryの`acceptedAt`をrequested JST業務日へ拘束するが、browser consumerはtop-level dateとduplicate ReceptionIdだけを検証し、schema-valid別日rowをauthoritative queueへcommitできる。標準server経路では遮断済みだが、drifted/alternate backend・proxy/mock等への最終consumer trust boundaryが不足する。
  - pre-plan: fresh mapper、plan guardian、security/privacy reviewはR2 `READY_WITH_PINS`。APPROVED MOD-011のapps層instant→JST暦日規律に従い、既存`todayAsIsoDate(explicit Date)`を再利用する。共通helper/date-time package/古代year policyへ拡張しない。
  - scope: implementation exact2 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/repository/DB/migration/SSOT/package/POST/idempotency/audit/cancellation/DOM/copy/ARIA/CSSは変更しない。
  - acceptance: exact200 schema→top-level requested date→full duplicate pass→全entry JST business-date pass→copied sortの順を維持する。previous/next JST dateとmixed queueはfixed non-PHI errorでall-or-nothing拒否し、filter/re-date/partial acceptanceを行わない。JST midnight/end-of-day、empty/all-localを受理し、duplicate/date/schema error precedence、sensitive field非echo、refresh時last verified response/loadedAt保持、retry replacement、source nonmutation/order、GET cancellation/registration semanticsを不変にする。
  - stop: server/API/contracts/DB/SSOT/date-time package、shared date abstraction/timezone/year-range policy、filter/repair/partial response、precedence/ordering/UI copy/DOM/ARIA、POST/idempotency/audit/AbortController変更が必要なら停止して再計画する。
  - rollback: WP-4174 implementation/ledger commitだけをrevertする。DB/data rollback不要。
  - verification: focused reception-dashboard83、Web371、API reception-queue6、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。
  - review/landing: JST midnight/end-of-day 9桁fraction、previous/next、duplicate precedence、PHI-rich non-echo、mixed all-or-nothing retained response/loadedAt、retry replacementをfixture化。independent verifier、frontend/medical/API、privacy/security reviewerはblocking finding 0でPASS/APPROVED。server invariantと通常経路を置換せずfinal consumer defense-in-depthに限定し、POST/idempotency/audit/cancellation/DOM/copy/ARIA/focusは不変。implementation exact2 commit `45eabe6`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4175 bind selected-patient removal to contract-valid PAT-0002(MEDIUM patient/workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: browserの`GET /patients/:patientId` consumerはbodyを検証せず任意HTTP 404を`null`へ変換し、proxy/gateway/drifted backendのbodyless・別error 404でも全画面共通のactive patientをauthoritativeに解除できた。standard APIは`ErrorResponse`のexact `PAT-0002`を返すが、最終consumer trust boundaryがstatusだけだった。
  - pre-plan: fresh mapperとplan guardianはpatient-search page-limit defense-in-depthより直接的なR2 patient/workflow integrity bugとして`READY_WITH_PINS`。OpenAPI/API実装の404 authority、contracts `errorResponseSchema`、shared-kernel `PATIENT_NOT_FOUND_ERROR_CODE`を再利用し、SSOT/contract/server変更なしのexact2とした。
  - scope: implementation exact2 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/contracts/OpenAPI/shared-kernel/repository/DB/patient-search/UI copy/DOM/ARIA/CSS/refresh frequency/cancellation/package/lock/SSOT、reception POST/idempotency/auditは変更しない。
  - acceptance: 404 bodyをexactly once JSON read→`errorResponseSchema` parse→exact `PAT-0002`かつnonempty messageの場合だけ`null`/onRemovedへ進める。bodyless/invalid JSON/read failure、missing/blank/non-string message、missing/malformed/unregistered/wrong registered codeは固定non-echo errorでall-or-nothing拒否し、current responseはonFailure/staleへ、clear後のlate responseはcallback zeroとする。400/403/500/unsupported2xxはbody未読、exact200 schema/identity、Abort/generation/owner semanticsを維持する。
  - discovered_bug_fix: 初回independent reviewで、`res.json().catch(...)`はmethod callの同期throwを捕捉せずraw response detailをescapeし得るMEDIUM非echo gapを検出。`try/await/catch`へroot-cause修正し、同期throw・非同期rejectを同じfile-local固定errorへ統一。sync raw sentinel、body read once、current onFailure、late callback zeroを追加固定後に再review PASS。
  - stop: server/contracts/OpenAPI/error registry/SSOT、message文言一致、任意404/任意registered codeのremoval、raw JSON/Zod/code/message/PHI露出、UI removal/stale copy、retry/cache/timeout、patient-search count binding、reception POST/idempotency/audit変更が必要なら停止して再計画する。
  - verification: focused patient-context45、Web382、contracts95、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot+exact2 overlay secret scanをPASS。live secret scanは既存ignored symlinkでfail-closed。
  - review/landing: plan guardianの同期throw finding修正後、independent verifier、security/privacy/medical/API reviewerはblocking finding 0でPASS/APPROVED。actual mounted Providerのidentity保持+stale badge一体fixtureなしは、onFailure/onRemovedの直接分離と既存component配線からLOW/non-blocking。implementation exact2 commit `22067fd`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4176 bind browser patient-search pages to the contract default limit(MEDIUM patient PHI/result integrity defense-in-depth / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: APIはvalidated requested limit超過のrepository pageを拒否済みだが、browserはlimitを明示せず、schema-validな任意件数をselectable/append stateへcommitできた。standard serverでは遮断済みだが、drifted/alternate backend・proxy/mockへのfinal consumer trust boundaryとPHI page minimizationが不足していた。
  - pre-plan: fresh mapper、plan guardian、security/privacy reviewはR2 `READY_WITH_PINS`。contractsに`PATIENT_SEARCH_DEFAULT_LIMIT=20`を単一authorityとしてexportし、query schema default、Web request、response page guardで共用する。response schemaへfixed maxを追加せず、APIのrequest limit 1..50とOpenAPI semanticsを維持する。
  - scope: implementation exact4 `packages/contracts/src/patient-search.ts`, `packages/contracts/src/patient-search.test.ts`, `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。API/server/repository/DB/cursor codec/SSOT/OpenAPI artifact/UI copy/DOM/ARIA/CSS/cancellation/package/lock、reception POST/idempotency/auditは変更しない。
  - acceptance: initial/append GETを`q→limit=20→optional cursor`で送る。exact200 full schema parse後かつrunner duplicate/cursor/state処理前にpage `results.length>20`をfixed non-echo errorでall-or-nothing拒否し、slice/filter/truncate/partial commitを行わない。exact20/underfillを受理し、initial over-limitはselectable PHI zero、append over-limitはverified results/query/cursorを保持してsame cursor retry可能。page-local limitであり、20+20の累積40件は順序どおり受理する。
  - review_fix: 初回post-implementation plan reviewで累積結果20超を許可するdirect fixture不足をblockingとして検出。real `fetchSearch`+runnerでinitial20/append20→ordered40、cursor消費、final append idleを追加し、将来の誤ったcumulative capを防止後に再review PASS。
  - stop: API/server/repository/DB/cursor/SSOT/OpenAPI artifact、response schema max20、user-configurable limit、empty+nextCursor同時実装、ordering/dedupe/merge/cancellation、truncate/filter/repair/partial response、UI copy/DOM/ARIA、reception POST/idempotency/audit変更が必要なら停止して再計画する。
  - verification: focused contracts21/patient-search58、contracts96、Web387、API290 + PostgreSQL14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI byte-identical/calculation purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot+exact4 overlay secret scanをPASS。live secret scanは既知ignored symlinkでfail-closed。
  - review/landing: cumulative fixture追加後、independent verifier、plan guardian、security/privacy/medical/API reviewerはblocking finding 0でPASS/APPROVED。network/server-side PHI minimizationは非主張で、final consumer state/display拒否に限定。implementation exact4 commit `e0eccd8`はlocal-onlyで、明示的user instructionなしにpushしない。

- [x] WP-4177 stop replaying captured dependency-audit stderr(MEDIUM confidentiality/CI log integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `check-deps --from-audit-error`がcaptured stderr全体をrecognized warning/unrecognized Errorへ補間し、credential-like registry URL、internal path、token様値、CR/LF、ANSI controlをterminal/CI logへ再出力できた。live transient経路は既にfixed copyで、captured diagnostic分岐だけが不整合だった。
  - scope/implementation: exact2 `scripts/check-deps.mjs`, `scripts/check-scripts.mjs`。captured contentはallowlisted transient分類だけに使い、recognizedはfixed stderr1行/status0、unrecognized・missing/unreadable fileはstackを出さずfixed stderr1行/status1。live transientも同じwarning constantを再利用。allowlist、pnpm audit、JSON/count/advisory/high-critical gate、CI/package/lock/secret scannerは不変。
  - verification/review: synthetic URL/token sentinel、path、CRLF、ANSIをrecognized/unrecognized fixtureへ入れ、stdout empty、exact stderr、raw/path/control zero、missing path非echoを固定。script harness、live deps high0 critical0、workspace typecheck/test、lint/OpenAPI/purity/boundaries/SSOT173/SBOM231/diff、tracked-snapshot+exact2 overlay secret scanをPASS。independent/plan/security/supply-chain reviewはPASS/APPROVED。implementation `7dbe31d`はlocal-only、pushなし。
  - stop/rollback: allowlist/network retry/warn policy、audit threshold/advisory disclosure、pnpm/CI/package/lock、全input出力契約へ拡張が必要なら別WPへ再計画。rollbackはimplementation/ledger commitのみでDB/data rollback不要。

- [x] WP-4178 reject empty browser patient-search continuation pages(LOW-MEDIUM pagination/workflow integrity defense-in-depth / R1-R2) — FINALIZED / INDEPENDENT_PASS
  - finding: current APIはdefined nextCursorにnonempty resultsを必須化しているが、browserはschema-valid `results:[] + nextCursor`を受理した。initialでは0件に「続きあり」を表示し、appendではverified rowsを保ちながらtrusted cursorだけを別untrusted cursorへ置換でき、drifted backend/proxy/mockで無意味なsearch GET chainを作れた。
  - scope/implementation: exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。exact200 full schema→WP-4176 page limit後にempty+defined cursorだけをfixed non-echo errorで全体拒否。filter、terminal化、cursor repair/drop、partial commitなし。contracts/OpenAPI/API/server/repository/DB/cursor codec/UI copy/DOM/ARIA/cancellation、reception POST/idempotency/auditは不変。
  - acceptance/tests: direct query/cursor非echo、initial generic error+retry、append empty+distinct cursorでverified rows/query/original cursor保持+same-cursor retry、empty terminal initial受理、empty terminal appendでrows保持/cursor消費をreal fetchで固定。nonempty continuation、20+20累積、page limit、duplicate/cross-page/self-loop/stale/cancel/URLを維持。
  - verification/review: focused patient-search63、Web392、API cursor-progress6、API290 + PostgreSQL14 expected skips、contracts96、workspace typecheck/test、Web build、lint/script/OpenAPI byte-identical/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked-snapshot+exact2 overlay secret scanをPASS。independent/plan/security/privacy/medical/API review APPROVED。公開contract変更ではなくcurrent server invariantのconsumer defenseに限定。implementation `8976d2e`はlocal-only、pushなし。
  - stop/rollback: approved sparse/filtered paginationがempty intermediary cursorを正当化する、またはcontract/OpenAPI/server/cursor protocol変更が必要ならSSOT_UPDATE_REQUIREDで再計画。rollbackはimplementation/ledger commitのみ。

- [x] WP-4179 bind patient refresh callbacks to synchronous selection authority(MEDIUM wrong-patient/workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `PatientContextProvider`はpublic `selectPatient`へraw React setterを公開し、refresh runnerはBar effect cleanupまで外部選択を認識しなかった。A refresh中にBを直接選択した直後、ReactがBをcommitする前にAがsettleすると、A successでAを復元、contract-valid PAT-0002でBを解除、failureでBをstale表示できた。同一IDの新snapshot選択もeffect cleanupがなく旧refreshよりauthoritativeになれなかった。
  - pre-plan/scope: mapper、plan guardian、security/privacy/medical/reception reviewはR2 `READY_WITH_PINS`。implementation exact2 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`。landing ledger exact3 `Plans.md`, `State.md`, `ops/refactor/STATE.md`。PatientSearch/ReceptionDashboard/PrescriptionWorkspace、API/contracts/OpenAPI/server/repository/DB、DOM/copy/ARIA/CSS/package/lock/SSOTは変更しない。
  - implementation/refactor: refresh runnerとmonotonic selection authorityをProviderへ集約。public select/clearは`runner invalidate → authority advance → state commit`を同期実行し、same-ID再選択も旧refreshを失効する。refresh callbackは開始時authority claimをcurrent authority+PatientIdへ照合するinternal commitだけを使い、fresh successはauthorityを進めずself-invalidationしない。functional updaterもevaluation時にauthority/PatientIdを再確認し、stale表示はauthority+PatientIdへ帰属。旧Bar専用clear helperは削除して権限経路を一本化した。
  - acceptance/tests: A→B direct selection後のlate success/removal/failureをreal deferred runnerでcallback zeroに固定。select/clear invalidate-before-commit、same-ID invalidation、wrong-ID fresh拒否、current fresh no-self-invalidate、current removal exactly once、old stale authority rejectionをpure controllerで固定。WP-4104 identity、WP-4171 Abort/generation/owner/re-entry、WP-4175 exact PAT-0002 removal、pathname/PatientId refresh頻度を維持する。
  - verification/review: focused52、Web399、workspace typecheck/test、API290 + PostgreSQL14 expected skips、contracts96、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diffをPASS。live secret scanは既知ignored symlinkでfail-closed、tracked HEAD+exact2 overlay scanはauthority `token` namingのfalse-positiveを`authorityClaim`へrefactor後PASS。independent/plan/security/privacy/medical/reception reviewはPASS/APPROVED。actual mounted concurrent React fixtureなしはLOW/non-blocking。
  - invariants/landing: public `PatientContextValue`、patient-search selection、reception registration POST/body/idempotency key/server settle/patient-change warning/queue reload/audit semanticsは不変。implementation exact2 commit `4c7cd44`はlocal-only、明示的user instructionなしにpushしない。rollbackはimplementation/ledger commitのみでDB/data rollback不要。

- [x] WP-4180 bind reception repository results to persisted idempotency provenance(MEDIUM reception/data/audit integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: API-006は`(tenantId, pharmacyId, idempotencyKey)`を冪等authorityとするが、internal `ReceptionCreateResult`はkind+entryだけで、serverはrepository結果が要求key/scopeの保存rowから解決されたか検証できなかった。drifted/custom adapterが同一患者の別key受付をexistingとして返すfalse 200、別scope由来のfalse 201/409をfail-closedにできなかった。
  - pre-plan/scope: security、mapper、plan guardianはR2 `READY_WITH_PINS`。implementation exact6 `apps/api/src/reception-repository.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`, `apps/api/src/db/postgres-repositories.integration.test.ts`, `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。landing ledger exact3。contracts/OpenAPI/Web/API-006/DB schema/migration/package/lockは変更しない。
  - implementation/refactor: 全created/existing/conflict resultへ保存済みtenant/pharmacy/raw key/ReceptionId/PatientId provenanceを必須化。InMemoryはentryと同じ`ReceptionRecord`から生成し、index→record欠落・reverse index欠落・scope/key driftを重複作成せず固定errorへ収束。PostgreSQLはparameter echoでなく実columnを`INSERT RETURNING`/scoped `SELECT`し、全5 fieldをbranded validation後、entry変換/COMMIT前に確定する。serverは分岐/entry schema/audit/response前にscope/key/IDを検証し、successはentry identityへ結合、conflictは保存PatientIdが要求患者と異なる場合だけ409へ進める。
  - review fixes: 初回security reviewでscope/keyだけでは正しいK2 provenanceと別key R1 entryの混成、same-patient false conflictを防げないMEDIUM gapを検出し、ReceptionId/PatientId bindingへ拡張。最終plan reviewのnoteでsuccess `entry=null/undefined`が固定invariant前にgeneric TypeErrorとなるgapを検出し、unknown non-null object guardとcreated/existing fixtureを追加。双方修正後に再review PASS。
  - acceptance/tests: all arm × scope/key/missing、success entry ReceptionId/PatientId/missing、conflict same-patient/invalid IDを固定500/no-store/audit zero/non-echoで検証。DBはall arm × stored5 field欠落をrollbackし、SQL parameter alias禁止、InMemory created/existing/conflictが同一保存identityへ収束。integration fixtureはcreated/replay/conflict/concurrent/reinstantiation/3-scopeで保存provenance一致を固定した。
  - verification/review: focused130、API326 + PostgreSQL/migration/audit integration14 expected skips、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact6 overlay secret scanをPASS。independent/plan/security/privacy/medical/data-integrity reviewは最終PASS/APPROVED。`TEST_DATABASE_URL`不在のためPostgreSQL integration7件は未実行。
  - boundaries/landing: HTTP request/response、provenance非公開、created audit once、existing/conflict/mismatch audit zeroを維持。repository COMMIT後のserver guardは誤応答/誤監査を防ぐがcommit済みmutationをrollback/repairせず、WP-4050 audit atomicityとWP-4151c ambiguous key lifecycleはhuman-gated未解決のまま。implementation exact6 commit `78e86ec`はlocal-only、pushなし。rollbackはimplementation/ledger commitのみでmigration/data rollback不要。

- [x] WP-4181 trust only nominal audit-log error notices(MEDIUM audit confidentiality/UI trust boundary / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: audit refresh runnerは任意rejectionの構造的`notice`を信頼し、raw/forged message・nextAction・severity・errorCodeを表示stateへcommitできた。non-ok transportも`res.json().catch(...)`では同期throwを捕捉できず、解決bodyのaccessor/Proxy評価が固定HTTP/403案内をgenericへ退行させ得た。
  - scope/implementation: exact2 `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`。固定generic/trusted noticeをfreezeし、module-private WeakMap identityへ登録したrequest errorだけをstatus/errorCode付きnoticeのauthorityとした。non-ok JSON readとerrorCode抽出を同一guardへ集約し、own data descriptorだけを既存registry allowlistへ渡す。getter、継承値、malformed/unregistered codeは無視し、descriptor trapは固定status noticeへfail-closed化した。
  - review fixes: 初回independent/security reviewで、JSON解決後の`in`/property readがguard外に残り、Proxy/getter throw時に固定403を失うLOW gapを検出。own descriptor helperへrefactorし、sync/async resolved Proxyの`errorCode` has/get zero、getter zero、throwing descriptor trap、sync throw/async rejection、read once/non-echoを追加後に再review PASS。
  - invariants: verified healthy/broken audit evidenceはrefresh failure中もexact identityで保持し、broken-chain CRITICAL、retry、latest-only generation/lifecycle、`audit.viewed`、HTTP/API/contracts/OpenAPI、copy/DOM/ARIA/CSSは不変。raw body/error/notice/action/code/sentinelをstate・表示・logへ移さない。
  - verification/landing: focused62、Web407、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。plan guardian、independent verifier、security/privacy/audit-integrity reviewは最終PASS/APPROVED。implementation `a0a3ed4`はlocal-only、明示的user instructionなしにpushしない。

- [x] WP-4182 stop replaying dependency-audit JSON diagnostics(MEDIUM supply-chain confidentiality/CI terminal integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `--from-audit-json`とlive audit failureはadvisory module/GHSA、malformed JSON fragment、input path、child output、stack/causeをuncaught stderrへ再出力でき、CRLF/ANSI/U+2028/U+2029とunbounded textでCI terminal injectionが可能だった。validated individual countsのthreshold合計もsafe integerを保証していなかった。
  - scope/implementation: exact2 `scripts/check-deps.mjs`, `scripts/check-scripts.mjs`。advisory列挙を廃止し、threshold failureはvalidated safe aggregate countとallowlisted levelだけの固定1行へ限定。aggregate overflow、invalid report/args、captured read/parse、spawn/signal/nonzero/live malformedは固定generic1行/status1/stdout emptyへ収束し、stack/cause/raw path/contentを出さない。clean pass、severity/default/threshold、pnpm flags、transient allowlist、WP-4177 `--from-audit-error`固定挙動は維持した。
  - review fixes: security reviewで、JSON+recognized transient errorのdual source指定がerror mode先行でvulnerable JSONを未読status0にするLOW bypassと、harness失敗文言がraw path/U+2028/U+2029を再露出するLOW gapを検出。明示plan amendment後、cross-modeをfile read前に順序非依存で固定拒否し、両順序fixtureとASCII固定assertion labelへ修正して再review PASS。
  - acceptance/tests: malicious advisory URL/token/CRLF/ANSI/U+2028/U+2029/long text、全5 level、safe aggregate境界/overflow、invalid shape/count、malformed/missing/directory JSON、missing/invalid args、dual source両順序、live clean-nonzero/transient/malformed/vulnerable、既存WP-4177 single-modeをexact stdout/stderr/statusで固定。advisories内容はgate判定にも出力にも使わない。
  - verification/landing: 両script node check、script harness、live deps high0 critical0、workspace typecheck/test(Web407/API328 + integration14 expected skips)、lint/OpenAPI/purity/boundaries/SSOT173/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/security/supply-chain reviewは最終PASS/APPROVED。implementation `d4c41d5`はlocal-only、pushなし。

- [x] WP-4183 harden reception non-ok error-code extraction(MEDIUM reception workflow/error-integrity defense-in-depth / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: queue GETと受付登録POSTが共用する`extractErrorCode`は`res.json().catch(...)`のため同期throwを捕捉せず、解決bodyの`in`/直接property readが継承getter/Proxy trapを実行し得た。body inspection失敗時に既知403/409等の固定案内を失い、特にAPI-006 idempotency conflictがgeneric retryへ退行した。
  - scope/implementation: exact2 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`。non-ok bodyを`try/await/catch`でexactly once読み、own data descriptorのvalueだけを既存registry allowlistへ渡す。sync throw/async reject、inherited/accessor、resolved Proxy、throwing descriptor trapはcodeなしの既存status guidanceへfail-closed化した。
  - acceptance/tests: queue 403 sync throw、POST 409 async reject、Proxy sync/async resolutionのerrorCode has/get zero、getter zero、inherited code無視、descriptor trap once/fixed guidance、valid own `RCV-0003`保持、unregistered code非表示を固定。raw body/code/trap/PHI sentinelをnoticeへ反射しない。
  - invariants: queue URL/scope/date、POST URL/body/idempotency key、400/403/404/409/other copy、200/201 schema/identity/WAITING、unsupported success body-unread、same-flight、selected-patient binding、key reuse、patient-change warning、authoritative queue reload、created audit semantics、API/contracts/OpenAPI/server/repository/DB/DOM/ARIA/CSSは不変。
  - verification/landing: focused89、Web413、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/security/privacy/reception reviewはPASS/APPROVED。implementation `e0485cf`はlocal-only、pushなし。

- [x] WP-4184 harden patient-search non-ok error-code extraction(MEDIUM patient privacy/recovery-guidance defense-in-depth / R1-R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient search non-ok pathは`res.json().catch(...)`で同期throwを捕捉せず、解決bodyの`in`/直接property readが継承getter/Proxy trapを実行し得た。body inspection失敗時にAPI-001の固定400/403 guidanceがgeneric処理errorへ退行し、injected adapterではraw exception escapeの余地があった。
  - scope/implementation: exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。bodyをexactly onceの`try/await/catch`で読み、own data descriptor valueだけを既存registry allowlistへ渡す。sync throw/async reject、inherited/accessor、resolved Proxy、throwing descriptor trapはcodeなしの既存status guidanceへfail-closed化した。
  - acceptance/tests: 400 sync/async failure、403 permission、500 other、Proxy sync/async resolutionのerrorCode has/get zero、getter zero、inherited code無視、descriptor trap once、valid own `AUTH-0003`/`PAT-0001`保持、unregistered/non-string非表示、raw body/message/query/PHI non-echoを固定。
  - invariants: URL/query/default limit/header/signal、exact200 schema/page limit/empty continuation、unsupported2xx body-unread、duplicate/cursor/append/stale/cancel/ownership/retry、selection/PatientContext、SearchError nominal trust、API/contracts/OpenAPI/server/repository/DB/DOM/ARIA/CSS/audit/receptionは不変。nominal client-error authorityは再現証拠付き別候補として分離した。
  - verification/landing: focused73、Web423、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/security/privacy/medical reviewはPASS/APPROVED。implementation `7b3c72d`はlocal-only、pushなし。

- [x] WP-4185 bind reception error notices to creation provenance(MEDIUM reception UI confidentiality/availability/workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: queue/registration catchが任意rejectionへ`instanceof ReceptionError`と`toNotice()`を実行し、hostile Proxyの`getPrototypeOf` trapがraw rejectionとしてescapeした。`Object.create(ReceptionError.prototype)`やexternal constructorはraw message/action/registered codeをstateへ注入でき、trusted errorのpublic field mutationもdirect projectionを変更できた。
  - scope/implementation: exact2 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`。module-private trusted factoryが全queue/POST/date-mismatch `ReceptionError`を生成し、factory argsからfrozen notice snapshotをWeakMap登録。queue/registration catchとexported `toNotice()`はidentity lookupだけを使い、未登録receiverはcontext別frozen genericへfail-closed化した。class export/constructor/fields/`instanceof` throw typeは維持。
  - review fix: 初回independent reviewでcatchは安全でもexported `toNotice()`が`this.*`を読むdirect bypassを検出。明示plan amendmentでdirect external value互換を撤回し、external/prototype/Proxy/getter receiverはgeneric、trusted mutation後はcreation snapshotへ拘束するtestを追加後に再review PASS。
  - acceptance/invariants: hostile Proxy get/has/getPrototype zero+retry、prototype forge/external constructor raw/code zero、forged getters zero、trusted snapshot mutation耐性/freezeを固定。HTTP copy/code、WP-4183 body extraction、queue latest/refresh retention、registration patient-change precedence/same-flight/idempotency key/authoritative reload、created audit、API/contracts/server/DB/DOM/ARIA/CSSは不変。
  - verification/landing: focused95、Web429、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/security/privacy/reception reviewは最終PASS/APPROVED。implementation `af39b3e`はlocal-only、pushなし。

- [x] WP-4186 bind patient-search error notices to creation provenance(LOW-MEDIUM patient UI confidentiality/availability defense-in-depth / R1-R2) — FINALIZED / INDEPENDENT_PASS
  - finding: search runner catchが任意rejectionへ`instanceof SearchError`と`toNotice()`を実行し、hostile Proxyの`getPrototypeOf` trapがraw rejectionとしてescapeした。private classでも正規errorからprototype/constructorを取得でき、forge/external constructionやtrusted public field mutationでraw notice authorityを得られた。
  - scope/implementation: exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。module-private factoryだけが4つのHTTP error系統を生成し、factory argsからfrozen WeakMap snapshotを登録。runner catchとprivate `toNotice()`はidentity lookupだけを使い、未登録receiverはfrozen genericへfail-closed化。constructor登録は禁止し、class/factory/map/helperのexportも追加していない。
  - acceptance/tests: hostile initial Proxy trap zero/generic/retry、hostile appendでverified rows/query/cursor保持+same tuple retry、captured prototype forge/constructor instanceのdirect+runner generic、trusted error mutation後のdirect+runner original frozen 403/AUTH snapshotを固定。raw message/action/code/query/PHIをstateへ反射しない。
  - invariants: API-001 400/403/other copy/code、WP-4184 JSON extraction、URL/query/limit/header/signal、exact200/page/empty continuation、duplicate/cursor/stale/cancel/coalescing/append ownership/state、selection/PatientContext、contracts/OpenAPI/API/server/DB/DOM/ARIA/CSS/audit/receptionは不変。
  - verification/landing: focused77、Web433、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/security/privacy/medical reviewはPASS/APPROVED。implementation `3d87e72`はlocal-only、pushなし。

- [x] WP-4187 harden App Router error-boundary property trust(MEDIUM UI privacy/recovery availability / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: route/global error boundaryが未信頼`error.name`/`error.digest`を直接読み、任意digestをDOMの参照コードとconsole payloadへ投影していた。PHI/raw detailの平文露出に加え、throwing accessor/hostile Proxyで最終recovery boundary自体が再throwし得た。
  - scope/implementation: exact4 `apps/web/app/error.tsx`, `apps/web/app/global-error.tsx`, `apps/web/app/components/error-notice.test.tsx`, `apps/web/app/cross-cutting-state.test.tsx`。error objectのproperty/descriptor/key/prototype/serializationを一切参照せず、effectは固定`route error`/`global error` signalだけをexactly once出力する。provenance/形式が未確定のdigest参照コード表示を削除し、retry buttonへ明示top spacingを与えた。
  - review fixes/acceptance: 初回security reviewでSSR-only testがeffect経路を固定しないgap、frontend reviewでdigest段落削除によるalert→retry余白消失を検出。test-only React effect harnessでconsole exact literal/onceとProxy/accessor read zeroを固定し、routeは`var(--space-3)`、self-contained globalは`1rem`の余白を追加後に再review PASS。固定copy、ERROR severity、alert、reset、global `html/body`、motionは不変。
  - verification/landing: focused9、Web433、API328 + integration14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact4 overlay secret scanをPASS。independent/plan/frontend/accessibility/security/privacy reviewは最終PASS/APPROVED。reception POST/idempotency/audit、API/contracts/server/DBは不変。implementation `e0547af`はlocal-only、pushなし。

- [x] WP-4188 bind reception 201 to returned audit evidence(MEDIUM reception/audit/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `POST /reception`は`auditRepository.record()`をawaitするが返却`AuditEvent`を捨て、foreign scope/actor、`audit.viewed`、wrong target、failed outcome等のhash-valid contradictory evidenceでも201を返した。append rejectionもraw error messageをFastify既定500へ投影し得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。created時のscope/intent/nested targetをfreezeし、audit wallClockをsecond `now()`から一度だけsnapshot。fulfilled returnは`unknown`から`hydrateAuditEvent()`でexact shape/canonical time/entryHashを検証し、frozen snapshotのtenant/pharmacy/actor/type/target/outcome/wallClock/aggregate aliasとreason/business absenceをcaptured intentへ完全一致させる。append rejection・hydrate/semantic failureは同一固定non-echo invariant 500へ収束する。
  - acceptance/tests: hash-valid contradiction12種、null/corrupt hash、accessor getter zero、throwing prototype/ownKeys/descriptor Proxy、Promise thenable判定とraw get/hasを分離したvalid data-descriptor Proxy、raw rejection、scope/intent/target freezeを固定。正常createdはaudit once/201/`now()` twice、existingはaudit zero/200、conflict/provenance/status/acceptedAt precedenceは不変。sequence/prevHash/chain-tip/persistenceをserverで推測しない。
  - verification/landing: focused127、API348 + integration14 expected skips、Web433、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent/plan/API/data-integrity/security/privacy reviewはPASS/APPROVED。rollback/repair/retry/outbox/atomicity/ambiguous key lifecycleはWP-4050/WP-4151cのhuman gateに残す。implementation `b412538`はlocal-only、pushなし。

- [x] WP-4189 bind reception error codes to API operation/status semantics(LOW-MEDIUM reception workflow/diagnostic integrity / R1-R2) — FINALIZED / INDEPENDENT_PASS
  - finding: Webの共通`extractErrorCode()`はregistry登録だけをauthorityとし、queue 403へ`RCV-0003`、POST 409へ`AUTH-0003`、5xxへ任意の登録済みcodeなど、API-006と矛盾するoperation/status/codeを固定案内へ付与できた。
  - scope/implementation: exact2 `apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`。shared-kernel canonical constantsからqueue `400/RCV-0001`, `403/AUTH-0003`、POST `400/RCV-0001`, `403/AUTH-0003`, `404/RCV-0002`, `409/RCV-0003`を単一helperへ集約し、own data descriptorかつregisteredかつexact tuple一致時だけcodeを保持する。契約外status・wrong registered codeは固定status guidanceを維持してcodeだけ省略する。
  - acceptance/tests: 6許可tupleのpositive/wrong-code対、queue 404/409/500、POST 500、raw body非echoを追加。既存body exactly-once、sync/async failure、inherited/accessor/Proxy/descriptor trap防御、trusted frozen notice、URL/header/signal、POST body/idempotency key、200/201 patient/WAITING、runner/retry/queue retention/reloadは維持した。
  - verification/landing: focused105、Web443、API348 + integration14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy reviewはPASS/APPROVED。API/contracts/OpenAPI/server/repository/DB/audit/SSOT/human gateは変更なし。implementation `c8dd2b7`はlocal-only、pushなし。

- [x] WP-4190 normalize hostile patient not-found response inspection(MEDIUM selected-patient/privacy/workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient-contextの404 body readだけが固定error normalization内で、`errorResponseSchema.safeParse(body)`は外側にあった。hostile Proxy/accessorのproperty read throwがraw detailをescapeし、selected-patient removal/stale判定のconsumer boundaryを不安定化できた。
  - scope/implementation: exact2 `apps/web/app/components/patient-context.tsx`, `apps/web/app/components/patient-context.test.tsx`。404 bodyをnon-null non-array objectへ限定し、`errorCode`/`message`のown enumerable data descriptorからplain snapshotを作成して、そのsnapshotだけをschema parseする。inspection/descriptor/parse failureは既存固定non-echo errorへ収束し、exact `PAT-0002`だけを`null`/removal authorityとして維持する。
  - review fixes/tests: valid data Proxyのget/has zero、accessor getter zero、descriptor trap fixed error、inherited field zero-read、valid fields付きarray拒否、runner hostile 404のonFailure only/onRemoved zeroを固定。初回fixtureが`JSON.stringify`やscope外helperの`ReferenceError`で目的経路を通らないfalse-positiveを検出してraw body stubへ修正。independent reviewでarray root authority拡張とinherited fixture false-positiveを検出し再修正後PASS。
  - verification/landing: focused58、Web449、API348 + integration14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical reviewはPASS/APPROVED。200 identity、他status body-unread、Abort/generation/owner、UI copy/DOM、API/contracts/server/DB、reception/idempotency/auditは不変。implementation `cb04497`はlocal-only、pushなし。

- [x] WP-4191 bind patient-search error codes to API status semantics(LOW-MEDIUM patient-search diagnostic/workflow integrity / R1-R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient-searchのnon-ok bodyはown data descriptorとregistryを検証するが、operation/statusとの結合がなく、400へ`AUTH-0003`、403へ`PAT-0001`、404/409/5xxへ他endpoint用の登録済みcodeを固定案内と併記できた。
  - scope/implementation: exact2 `apps/web/app/patients/patient-search.tsx`, `apps/web/app/patients/patient-search.test.tsx`。shared-kernel canonical constantsからAPI-001の`400/PAT-0001`, `403/AUTH-0003`を単一helperへ集約し、own data descriptorかつregisteredかつexact status tuple一致時だけcodeを保持する。その他status/mismatchは固定guidanceを維持してcodeだけ省略する。
  - acceptance/tests: positive2 tuple、相互mismatch、404/PAT-0002、409/RCV-0003、500/AUTH-0003、unregistered/non-string、raw message非echoを固定。body exactly-once、Proxy/accessor/descriptor防御、trusted frozen notice、URL/query/default limit/cursor/header/signal、schema/page/append/stale/cancel/retry、selection/PatientContextは不変。
  - verification/landing: focused82、Web454、API348 + integration14 expected skips、workspace typecheck/test、Web build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical reviewはPASS/APPROVED。contracts/OpenAPI/server/DB/DOM/copy/receptionは変更なし。implementation `0e1bf05`はlocal-only、pushなし。

- [x] WP-4192 bind audit-log 200 to returned audit.viewed evidence(MEDIUM audit/privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /audit/events`はview appendをawaitするが返却`AuditEvent`を捨て、foreign scope/actor、wrong type/target/outcome/time等のhash-valid contradictionでも200を返した。record rejectionのraw messageもFastify 500 bodyへ露出した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`。WP-4188 helperを固定invariant message引数へ一般化し、audit scope/intent/nested targetとsingle wallClockをfreeze。fulfilled returnを`hydrateAuditEvent`で検証後、tenant/pharmacy/actor/`audit.viewed`/`audit_log:view:N`/success/time/aggregate aliasとreason/business absenceへ完全一致させる。rejection/hydrate/semantic failureはaudit-view専用固定non-echo 500へ収束する。
  - tests/review fixes: hash-valid contradiction12種、null/corrupt hash、accessor getter zero、prototype/ownKeys/descriptor Proxy、valid data Proxy get/has zero、scope/intent/target freeze、now onceを固定。既存broken-chain testが無関係eventをack返却するfixture bugを検出し、正しいview event backingへ修正してbroken-chain 200/reason/count/record onceを維持した。
  - verification/landing: focused audit-log43+server127=170、API368 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/audit/API/security/privacy/data-integrity reviewはPASS/APPROVED。list/projection/order/limit/chain、DB/transaction/retry/repair/contracts/SSOT、reception/idempotencyは不変。implementation `299356b`はlocal-only、pushなし。

- [x] WP-4193 normalize patient lookup repository failures(MEDIUM patient privacy/workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /patients/:patientId`と`POST /reception` preflightの`patientRepository.findById()` rejectionがFastify既定500へraw messageを反射し、患者ID・adapter/DB detail・idempotency contextを漏えいし得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。2つのfindByIdだけをmodule-private共通helperのsingle try/invoke/await/catchで包み、Error/non-Error/hostile rejectionをinspectせず固定`Patient repository lookup failed` 500/no-storeへ収束する。search/list、reception create、audit append、retry/classification/loggingは変更しない。
  - acceptance/tests: GETのsync Error/non-Error/hostile Proxy rejection、scoped input exact once、property read zero、raw/object/requested ID非echoを固定。POST async rejectionはpatient/idempotency/raw detail非echo、reception create zero、audit zeroを固定。undefined→GET PAT-0002/POST RCV-0002、found/schema/identity、正常create/idempotency/auditは既存suiteで維持した。
  - verification/landing: focused server131+patient-get4=135、API372 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical/data reviewはPASS/APPROVED。WP-4050/WP-4151c/WP-4162/Gate0、contracts/DB/SSOTは不変。implementation `28cd3f1`はlocal-only、pushなし。

- [x] WP-4194 normalize patient-search repository failures(MEDIUM patient privacy/search availability / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /patients/search`の`patientRepository.search()` rejectionがFastify既定500へraw messageを反射し、氏名・カナ・患者番号になり得るfree-text queryやadapter/DB detailを漏えいし得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。WP-4193 lookup helperをgenericなmodule-private operation wrapperへrefactorし、searchだけを追加して固定`Patient repository search failed` 500/no-storeへbindingless normalizationする。2つのfindByIdは既存lookup message/input/return semanticsを維持する。
  - acceptance/tests: sync Error、async non-Error、async hostile Proxyを固定し、tenant/pharmacy/q/default limit exact once、cursor encode zero、property read zero、raw query/sentinel/patient number非echoを検証。query/cursor decodeはcatch前、page limit/schema/duplicate/cursor progress/encodeはcatch後に維持し、既存PAT-0001/pagination/invariant authorityを変更しない。
  - verification/landing: focused server134+patient-get4=138、API375 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical/data reviewはPASS/APPROVED。queue/audit/mutation/idempotency/atomicity/DB/contracts/SSOT/human gatesは不変。implementation `585eb45`はlocal-only、pushなし。

- [x] WP-4195 normalize reception-queue repository failures(MEDIUM reception workflow/patient privacy / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /reception/queue`の`receptionRepository.list()` rejectionがFastify既定500へraw messageを反射し、患者summary/driver detailを含むadapter errorを漏えいし得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。既存generic fixed wrapperでqueue listだけを固定`Reception repository queue lookup failed` 500/no-storeへ正規化する。auth/query/実在日検証はcatch前、response schema/duplicate ReceptionId/JST business-date検証はcatch後に維持する。
  - acceptance/tests: sync Error、async non-Error、async hostile Proxy、exact tenant/pharmacy/date list once、property read zero、raw/date/patient number非echo、GETからPOST create zeroを固定。初回reviewでaudit record zero assertionがWP-4162のfailure policyを固定するscope越境と判明し、audit spy/injection/assertionを完全削除して再review PASS。
  - verification/landing: focused server137、API378 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical/data reviewは最終PASS/APPROVED。POST/idempotency/audit/atomicity/WP-4162/contracts/DB/SSOTは不変。implementation `d5a1e1d`はlocal-only、pushなし。

- [x] WP-4196 normalize audit-log repository failures(MEDIUM audit privacy/availability / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /audit/events`の`auditRepository.list()` rejectionがFastify既定500へraw messageを反射し、audit event/target識別子やadapter detailを漏えいし得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`。既存generic fixed wrapperでlistだけを固定`Audit repository list failed` 500/no-storeへ正規化した。scope freezeはlist前、scope/hash/duplicate/sequence guardと`audit.viewed` append/ack、projectionはcatch後の既存順序を維持する。
  - acceptance/tests: sync Error、async non-Error、async hostile Proxy、frozen exact scope/list once、property read zero、raw event/target detail非echoを固定。recordは非spy backingだけを使用し、failure-time `audit.viewed`の回数・保存結果をassertせずWP-4162 policyを未規定のまま維持した。
  - verification/landing: focused audit-log46+server137=183、API381 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/audit/API/security/privacy/data reviewはPASS/APPROVED。record semantics、reception/idempotency/atomicity/WP-4162/contracts/DB/SSOTは不変。implementation `75b8526`はlocal-only、pushなし。

- [x] WP-4197 normalize reception-create repository failures(MEDIUM reception privacy/ambiguous-outcome confidentiality / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `POST /reception`の`receptionRepository.create()` rejectionがFastify既定500へraw messageを反射し、患者情報・idempotency key・SQL/driver detailを漏えいし得た。createだけがrepository operationの固定rejection normalizationから漏れていた。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。既存generic fixed wrapperでcreate invoke/awaitだけを固定`Reception repository create failed` 500/no-storeへ正規化した。acceptedAt/inputはcatch前、fulfilled resultのprovenance/kind/entry/schema/patient/status/acceptedAt guard、created audit append/ack、201/200/409判定はcatch後の既存順序を維持する。
  - acceptance/tests: sync Error、async non-Error、async hostile Proxy、exact scoped create input once、property read zero、raw患者/idempotency/SQL detail非echoを固定。audit spy/count、queue readback、commit/rollback、retry/key再利用、failure-time audit assertionを置かず、rejectionの永続化結果は不明のまま維持した。
  - verification/landing: focused server140、API384 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical/audit/data reviewはPASS/APPROVED。WP-4050/WP-4151c/WP-4162/Gate0、DB/contracts/SSOTは不変。implementation `6b420ec`はlocal-only、pushなし。

- [x] WP-4198 bind reception-create result kind to the closed runtime union(MEDIUM-HIGH reception/audit/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: repositoryが型外`kind`とvalid-looking provenance/entryを返すと、serverはconflict/created以外をすべてexistingへfallthroughし、COMPLETED entryでもHTTP 200・created auditなしのfalse-successを返した。direct `result.kind` getter/trapのraw detail反射余地もあった。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。create return直後、provenance/entry参照前にown enumerable data descriptorの`created|existing|idempotency_conflict`だけをsingle snapshot化し、全branch/audit/statusで`resultKind`だけを使用する。entry schema parseも既取得`rawEntryValue`を再利用して二重readを除いた。
  - acceptance/tests: formerly-200 unknown kind、missing/non-string/inherited/non-enumerable/accessor/array/function/null、throwing descriptor Proxy、getter/provenance/entry read zero、fixed non-echo 500/no-store、descriptor-created/raw-get-existingのsnapshot authorityを固定。invalid kind時のaudit回数・永続状態はassertせず、既存valid 3分岐の意味論を維持した。
  - verification/landing: focused server151、API395 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/medical/audit/data reviewはPASS/APPROVED。rollback/repair/retry/new kind/idempotency lifecycle/failure audit、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `98226c3`はlocal-only、pushなし。

- [x] WP-4199 snapshot fulfilled reception-create result authority(MEDIUM-HIGH reception privacy/data/audit integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: recognized kind後のraw `result.provenance` / `result.entry` / nested patient direct readとraw Zod parseがaccessor/Proxy trapを実行し、患者/idempotency/adapter detailを500へ反射し得た。複数readではrepository backing mutationによるTOCTOUも成立した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。共通own enumerable data descriptor readerへWP-4198 kindを統合し、provenance5 field→alias entry/patient identity→remaining entry/patient schema fieldを段階的なfrozen plain snapshotへ一度だけ取得。conflictはprovenance後にentry未読で返し、Zod/audit/responseはraw graphでなくsnapshot派生値だけを使う。
  - acceptance/tests: 全20 known field accessor getter zero、result/provenance/entry/patient descriptor trap固定non-echo、valid four-layer Proxy graph descriptor21回/direct semantic read zero、optional eligibility時刻保持、conflict hostile entry unread、acceptedAt descriptor取得直後backing mutationでもoriginal 201/sentinel非echoを固定。alias-before-schema error precedenceを維持し、failure audit/persistence assertionは追加していない。
  - verification/landing: focused server178、API422 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。initial security reviewの明示TOCTOU証跡gapを修正後、independent mapper/plan/API/security/privacy/medical/audit/data reviewは最終PASS/APPROVED。DB/rollback/repair/retry/idempotency lifecycle/audit atomicity、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `377415b`はlocal-only、pushなし。

- [x] WP-4200 reject implicit coercion in date-time string factories(MEDIUM shared clinical/claim date integrity / R1) — FINALIZED / INDEPENDENT_PASS
  - finding: `CalendarDate.fromString`と`ClaimMonth.fromString`がruntime型guardなしに`RegExp.exec(value)`へ渡し、型消去されたboxed String/objectの`Symbol.toPrimitive`/`toString`を実行してclinical date/claim monthとして受理し得た。3 clinical wrapperもCalendarDate経由で同じ影響を受けた。
  - scope/implementation: exact2 `packages/date-time/src/index.ts`, `packages/date-time/src/date-time.test.ts`。regex前のprimitive string assertionと既存format message定数を共通化し、公開`string` signature、lexical regex、year/month/day/leap、timezone/current-time規律を維持した。
  - acceptance/tests: 全5 factoryでnull/undefined/number/boolean/bigint/symbol/array/boxed String/coercible object/hostile Proxy/revoked Proxyを既存RangeErrorへ固定し、coercion hookと全Proxy trap zeroを検証。primitive valid/boundary/leap、fromParts/fromCalendarDate、compare/next/prevは既存suiteで維持した。
  - verification/landing: date-time13/typecheck/build、calculation87/typecheck、API422 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/data/medical reviewはPASS/APPROVED。fromParts object authority、API/reception/audit/DB/contracts/SSOT/human gatesは不変。implementation `e14a7cb`はlocal-only、pushなし。

- [x] WP-4201 snapshot fulfilled patient lookup authority for GET and reception POST(MEDIUM-HIGH patient privacy/wrong-patient/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: GET patient-by-idとPOST reception preflightがfulfilled `findById` objectの`patientId`をdirect readし、raw objectをZodへ渡していたため、accessor/Proxyのraw PHI sentinelを500へ反射し、identity/schema/consumer間のTOCTOUも成立した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。WP-4199 descriptor readerをparameterized patient snapshotへrefactorし、route固有404後にpatientIdをsingle snapshot・strict照合、その後だけ6 required + optional eligibility fieldをfrozen plain snapshot化。Zod/GET response/POST createにはparsed cloneだけを渡し、WP-4199 nested patientも同helperへ統合した。
  - acceptance/tests: POST全8 field accessor、GET identity/schema代表、valid GET/POST descriptor Proxy各8 reads/direct semantic zero、POST createのequal non-Proxy clone、patientId descriptor後backing mutationでもcaptured identity 200、mismatch時other PHI unread/create zeroを固定。GET PAT-0002/POST RCV-0002、lookup rejection、created/existing/conflict/result/audit順序を維持し、新規audit assertionは追加していない。
  - verification/landing: focused server192+patient-get4=196、API436 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/data/medical/audit reviewはPASS/APPROVED。patient search/queue graph、patient-view audit、DB/retry/rollback/idempotency/atomicity、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `5dde553`はlocal-only、pushなし。

- [x] WP-4202 snapshot fulfilled reception queue graph(MEDIUM-HIGH reception privacy/data integrity/availability / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /reception/queue`がfulfilled root arrayとentry/patient graphをraw Zodへ渡し、accessor/Proxy trapのraw PHI反射、複数read TOCTOU、Proxy偽装巨大lengthによる同期loopを許し得た。generic async repository wrapperはfulfilled後にrevokedされたProxyをreturn時に再度thenable同化し、固定error外へraw TypeErrorを漏らし得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。rootはnon-Proxy dense own-data arrayだけをdescriptor snapshot化し、entry/patientはWP-4199/4201 shared helperでidentity→remaining fieldをplain frozen snapshot化してからZodへ渡す。queue listはroute内direct invoke/await/catchへ戻し、repository rejectionとfulfilled graph schema errorを別の固定messageで維持した。root Proxyはtrap前にfail-closedとし、新しい件数上限・sort/filter/dedupe/paginationは追加していない。
  - acceptance/tests: non-array/sparse/index accessor、ordinary/revoked root Proxy、entry accessor/descriptor trap、valid nested Proxy13 descriptor/direct semantic zero、optional eligibility保持、schema→duplicate→JST date precedenceを固定。fake huge-length Proxyはloop前拒否し、POST shared helper refactorは既存21 descriptor/provenance→schema/idempotency/audit semanticsを維持した。
  - verification/landing: focused server201、API445 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。初回reviewのgetter証跡、root Proxy/revoked、precedence、fake-length availability findingsを修正後、independent mapper/plan/API/security/privacy/data/medical/audit reviewは最終PASS/READY。contracts/DB/SSOT/audit policy/POST idempotency/atomicity、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `674d33c`はlocal-only、pushなし。

- [x] WP-4203 snapshot fulfilled patient search page graph(HIGH patient privacy/result-limit/cursor integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `GET /patients/search`がfulfilled `page.results`をlength判定とmapで二重readし、accessorが1件→2件を返すと`limit=1`でも患者2件をHTTP 200で返した。raw page/results/patient/nextCursor/offsetのaccessor/Proxy反射とTOCTOU、generic async wrapperのrevoked page二次thenable assimilation raw漏えいも成立した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。searchをroute-local direct invoke/await/catchへ変更し、page.results own data descriptor→real dense array lengthをsingle snapshot。既存query limitをindex/PHI読取前に適用し、WP-4201 patient helperでplain parsed resultへ固定後、duplicateを全件検証。成功後だけoptional nextCursor/offsetをsingle snapshotし、exact expected offset由来のfrozen plain cursorだけをencoderへ渡す。queueのuncapped dense-array semantics、cursor codec/HMAC/bindingは不変。
  - acceptance/tests: formerly-200 changing results accessor、non-array/sparse/in-limit index accessor、over-limit element/nextCursor unread、results array/revoked page Proxy、patient accessor、results backing mutation、valid graph11 descriptor、schema→duplicate→cursor、duplicate時cursor unread、cursor accessor/offset backing mutation/plain cloneを固定。sort/filter/dedupe/clamp/repair/partial responseは追加していない。
  - verification/landing: focused server218、API462 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。初回reviewのsearch固有array/precedence/cursor TOCTOU証跡gapを修正後、independent mapper/plan/API/security/privacy/data/medical/audit reviewは最終PASS/READY。contracts/OpenAPI/Web/DB/audit/POST/idempotency、WP-4050/WP-4057/WP-4151c/WP-4162/Gate0は不変。implementation `163c1d9`はlocal-only、pushなし。

- [x] WP-4204 prevent fulfilled reception-create result reassimilation(MEDIUM-HIGH reception privacy/ambiguous-outcome confidentiality / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: generic async repository wrapperがcreate Promiseで一度fulfilledしたresultを`return await`後の外側Promise解決で再度thenable同化し、stateful/revoked Proxyの2回目`then`例外をcatch外へraw反射した。createは既にcommit済みの可能性があり、rollback可否とは独立に応答confidentialityを損ねた。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。POST createだけをroute-local direct invoke/await/catchへ変更し、sync/async repository rejectionは既存`Reception repository create failed`、fulfilled valueはcatch外のkind→provenance→conflict/entry/schema/patient/status/acceptedAt→created auditへ渡す既存順序を維持した。
  - acceptance/tests: stateful thenable resultはthen read1/direct semantic read0でvalid foreign-patient conflict409、fulfilled revoked resultはraw TypeErrorでなくfixed kind invariant/non-echoへ固定。両経路でexisting created-only audit順序としてrecord zeroを確認し、rollback/readback/persistence/commit outcome/retryはassertしていない。
  - verification/landing: focused server220、API464 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。audit-order pin追加後、independent mapper/plan/API/security/privacy/data/medical/audit reviewは最終PASS/READY。201/200/409、idempotency/provenance、contracts/DB/atomicity、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `cb0b762`はlocal-only、pushなし。

- [x] WP-4205 prevent fulfilled patient lookup reassimilation(MEDIUM-HIGH patient privacy/wrong-patient workflow integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: GET patient-by-idと受付POST preflightのfindByIdもgeneric async wrapperからfulfilled patientを再度thenable同化し、2回目`then` sentinelやrevoked Proxy TypeErrorをWP-4201 snapshot前にraw反射した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。両findByIdをroute-local direct invoke/await/catchへ変更し、repository rejection=fixed lookup error、fulfilled undefined=route固有404、patientId identity→remaining schema snapshot→GET responseまたはPOST createの既存順序を維持した。
  - acceptance/tests: 既存valid GET/POST descriptor fixtureをstateful thenableへ強化し、then1回/descriptor8/direct semantic0、GET200/POST201、POST createへequal non-Proxy cloneを固定。fulfilled revoked patientは両routeでfixed identity invariant/non-echo、POST create/audit zero。404、tenant concealment、rejection、identity-before-PHI/schemaは既存testで維持した。
  - verification/landing: focused server222+patient-get4=226、API466 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/API/security/privacy/data/medical/audit reviewはPASS/READY。POST idempotency/create/result/audit、contracts/DB、WP-4050/WP-4151c/WP-4162/Gate0は不変。implementation `7224580`はlocal-only、pushなし。

- [x] WP-4206 snapshot fulfilled audit event list root(MEDIUM-HIGH audit privacy/availability / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: audit listだけに残っていたgeneric async wrapperがfulfilled root arrayを再度thenable同化し、stateful/revoked Proxyのraw sentinelまたはNode TypeErrorを固定repository error外へ反射した。受け渡し後もrootをraw `.some` / `.map` / `.length`へ渡し、non-array、sparse、index accessorを許し得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`。listをroute-local direct invoke/await/catchへ変更し、fulfilled rootを既存`snapshotDenseArray`でuncapped dense own-data arrayへ固定。generic wrapperは全callsite消滅後に削除した。auth/query→rejection→root schema→scope→full-chain verify→verified-only duplicate/sequence→audit.viewed→sort/window/projection→limit/response順を維持した。
  - acceptance/tests: non-array、sparse、index accessor getter zero、stateful root Proxy then1/direct trap0、fulfilled revoked Proxyをfixed non-echo 500/no-storeへ固定し、全root invalidでaudit.viewed record zero。既存のhealthy/broken/malformed chain、broken時200/view append/raw append-order/no-backfillを維持した。
  - verification/landing: focused audit-log51+server222=273、API471 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy reviewはPASS/READY。event element graph、targetRef/businessReason、hash reason、contracts/DB/SSOT/受付POST idempotency/audit semanticsは不変。security probeで残るevent getter raw反射とhash後targetRef TOCTOUを再現したため、fail-visible意味論を保つR3+ human-review候補として別扱い。implementation `ce67e23`はlocal-only、pushなし。

- [x] WP-4207 bind created reception PatientSummary to the validated preflight snapshot(MEDIUM-HIGH patient privacy/data/audit integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: POST receptionのcreated resultはpatientIdだけをpreflight患者へ拘束していたため、repositoryが同じIDのまま氏名・カナ・生年月日・性別・患者番号・資格情報を差し替えても、変更PHIを201返却して`reception.created`成功監査を記録した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。validated patientからexpected authorityとrepository inputを別々のfrozen plain snapshotへ複製し、entry schema→patientId後、createdだけ全8 fieldをown-property presenceを含めexact比較してからWAITING→acceptedAt→success auditへ進む。existingのhistorical snapshotとconflict entry-unreadは対象外。
  - acceptance/tests: name/kana/birthDate/sex/patientNumber/eligibilityStatusのrequired 6 field、eligibilityCheckedAtの追加/明示undefined/削除/変更、repository input mutation、patient drift→status/acceptedAt precedenceを固定。全driftはfixed non-echo 500/no-store、create once/audit zero。valid created201/audit1、existing200/audit0、conflict409/idempotency semanticsを維持した。
  - verification/landing: server234、API483 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。初回reviewのTS predicateとoptional own-property parity、fixture WP-ID traceabilityを修正後、independent mapper/plan/security/privacy/data/audit reviewはPASS/READY。create後のDB commit/key消費、rollback/readback/repair/retry/failure auditは未解決のWP-4050/WP-4151c human gateとして維持。contracts/OpenAPI/DB/SSOT/WP-4162/Gate0は不変。implementation `52d1acc`はlocal-only、pushなし。

- [x] WP-4208 snapshot decoded patient-search cursor authority(MEDIUM-HIGH patient pagination/privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: injected/drifted cursor codecのdecode例外をraw 500へ反射し、non-undefined戻り値をraw repository inputと後続progress計算で再読していた。changing offset accessorによりrepositoryはoffset2のpageを返す一方、serverはoffset100をauthorityとしてnext cursor101を200発行できた。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。tokenあり時だけfrozen tenant/pharmacy/query bindingでdecode once。例外はfixed internal500、undefinedは既存400/PAT-0001。non-undefinedはown enumerable data offsetをsingle snapshotし、non-negative safe integerのdetached frozen plain cursorだけをrepositoryへ渡し、captured scalarだけでnext offsetを計算する。
  - acceptance/tests: Error/non-Error/hostile throw、undefined区分、null/array/function/missing/inherited/non-enumerable/accessor/string/NaN/infinite/negative/fraction/unsafe、throwing/revoked Proxy、no-token decode0を固定。valid descriptor Proxyはdescriptor1/direct semantic0、backing2→100 mutation後もrepository2/encode3/200。invalid時search/encode zero、raw token/query/sentinel/native Proxy detail非echo。
  - verification/landing: server255、cursor codec8、API504 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy reviewはPASS/READY。encoder failure、token/HMAC/key/TTL、contracts/OpenAPI/repository/DB/WP-4057/Gate0は不変。implementation `5b2c66d`はlocal-only、pushなし。

- [x] WP-4209 validate patient-search cursor encoder output authority(MEDIUM-HIGH patient pagination/privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: encode例外がquery/current token/患者情報をraw 500へ反射し、runtime `undefined`はcontinuationを省略した200、空文字は次回decode不能なnextCursorとして200発行された。object/oversizeはZod detailを反射し、hostile output trapも実行し得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。既存page/schema/duplicate/next-offset検証後だけ、fresh frozen bindingとfrozen expected-offset cursorでencode once。throwは専用fixed500、戻り値はunknownからnonempty primitive stringかつapproved max512だけをacceptし、invalidは別のfixed internal500。coercion/await/roundtrip/base64/HMAC再検証は行わない。
  - acceptance/tests: Error/non-Error string/object/hostile throw、undefined/null/number/boolean/bigint/symbol/function/array/object/boxed String/Promise/empty/513、hostile/revoked Proxyを固定。invalidでraw query/token/sentinel/患者PHI/native detail非echo、coercion/trap0、encode once。primitive length1/max512はexact保持200、binding/cursor frozenを固定。先行invariantとnextCursor absentは既存encode0を維持した。
  - verification/landing: server277、API526 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy reviewはPASS/READY。codec/token/HMAC/key/TTL、contracts/OpenAPI/repository/DB/WP-4057/Gate0は不変。implementation `c7e338c`はlocal-only、pushなし。

- [x] WP-4210 snapshot audit.viewed wall-clock authority(MEDIUM-HIGH audit privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: audit listの`audit.viewed`記録直前に注入clockをraw呼出しし、throw/raw sentinelを500へ反射した。戻り値もraw `.toISOString()`へ渡すため、Date偽装・invalid Date・hostile/revoked Proxy・own accessorが未固定で、監査timestamp authorityと非echo境界を破り得た。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`。full-chain検証とhealthy-only duplicate/sequence判定後、record前にclockを一度だけsnapshot。呼出しthrowは専用fixed500、戻り値はNode intrinsic `isDate`でgenuine Date internal slotを要求し、`Date.prototype.toISOString.call`でcanonical primitive ISOへ固定。不正instantは別fixed500とし、own method/accessor/coercion/Proxy semantic trapを参照しない。
  - acceptance/tests: Error/non-Error/hostile throw、primitive/object/Promise/invalid Date/prototype spoof/hostile-revoked Date Proxyをfixed non-echo 500/no-store・now once・record zeroへ固定。valid Dateのown throwing `toISOString` getterは未読で、canonical ISOがfrozen scope/input/targetへexactに渡る。root/scope/healthy duplicate/sequence失敗はnow0/record0、broken/malformed chainは従来どおりview append・CRITICAL evidence・raw append window/no-backfill・200を維持した。
  - verification/landing: focused audit-log71+server277=348、API546 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy reviewはPASS/READY。audit event graph、hash/target TOCTOU、reception clock、audit core/repository/DB/contracts/OpenAPI/SSOTは不変。implementation `81f8d97`はlocal-only、pushなし。

- [x] WP-4211 snapshot reception acceptedAt clock authority before create(MEDIUM-HIGH reception privacy/workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: 受付POSTのcreate前clockをraw `now()`→own `.toISOString()`で処理し同じDate objectをrepositoryへ渡していた。throw/invalid Date/Proxyはraw detailを500反射し、非Date fake methodで201+audit成功、own methodがISO返却後にDate internal slotを変えるとresponse時刻とrepository入力時刻が分裂しても201となった。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。WP-4210 helperをcaller別fixed error対応へrefactorし、patient検証後/create前にnow once、genuine Date internal slot + intrinsic ISOを要求。captured primitive ISOをserver比較authorityとし、repositoryにはそのISOから作るdetached plain Dateだけを渡す。throwとinvalid authorityは別fixed500、own method/accessor/coercion/Proxy semantic trapは不使用。
  - acceptance/tests: Error/non-Error/hostile throw、primitive/object/Promise/fake method/invalid Date/prototype spoof/hostile-revoked Date Proxyをfixed non-echo 500/no-store・create0・audit0へ固定。valid own-hostile Dateはgetter0、detached Date exact instant、repository clone mutation後もcaptured ISOで201。invalid body now0、direct existing now1/audit0、created→same-key resendとdifferent-patient conflictはtotal now3で201→200/409を維持した。
  - verification/landing: focused server285+audit-log71=356、API554 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。LOW call-count note是正後、independent mapper/plan/security/privacy reviewはPASS/READY。post-create `reception.created` audit clock raw gapはcreate済み500→retry existing200/audit欠落に接続するためWP-4050/WP-4151c human gateへ残し、repository/DB/contracts/OpenAPI/SSOT/idempotency lifecycleは不変。implementation `42d55f6`はlocal-only、pushなし。

- [x] WP-4212 validate public health wall-clock authority(LOW-MEDIUM operational confidentiality/integrity / R1) — FINALIZED / INDEPENDENT_PASS
  - finding: unauthenticated `/health`がraw `now().toISOString()`を呼び、throw/invalid Date/Date Proxyのraw/native detailを500反射し、fake non-Date methodでも`status: ok`の200を返した。
  - scope/implementation: exact2 `apps/api/src/server.ts`, `apps/api/src/server.test.ts`。既存shared clock snapshotへhealth専用fixed read/invariant errorを渡し、now once、genuine Date internal slot、intrinsic canonical ISOだけを許可。health schema/200 shape/version、認証なし、Cache-Control未設定を維持し、DB/repository/readiness意味論は追加していない。
  - acceptance/tests: Error/non-Error/hostile throw、primitive/object/Promise/fake method/invalid Date/prototype spoof/hostile-revoked Date Proxyを固定500へ閉じ、raw/native non-echo、fake method/accessor/trap0。valid own-hostile Dateはgetter0でexact canonical200。初回fixtureの`vi.fn` Proxy観察バグをplain function/manual countへ修正し、実際のtrap0境界を検証した。
  - verification/landing: focused server293+audit-log71=364、API562 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy reviewはPASS/READY。shared helperのreception/audit.viewed caller、post-create audit clock、contracts/OpenAPI/SSOT/ops/deployは不変。implementation `d23f374`はlocal-only、pushなし。

- [!] WP-4213 harden migration missing-table SQLSTATE authority(MEDIUM-HIGH migration/data integrity / R2) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: `isUndefinedTableError`がprototype継承`code='42P01'`をmissing history tableと誤認し、明示`db:migrate`のfake-client proofでinitial SELECT failure後にoperation client→BEGIN→DDL→history INSERT→COMMITへ進んだ。hostile Proxyは`has` trapで元DB error identityを置換したが、それ自体はDDL到達原因ではない。
  - reviewed candidate: exact2 `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`で`isProxy`先行拒否＋own data descriptor exact primitive `42P01`限定を実装し、focused14/API typecheck/full workspace gatesで技術PASS。negativeはoriginal identity、connect/query/release各1、operation/SQL zero、accessor/proxy trap0、pg-protocol own data code互換を確認した。
  - stop/gate: 最終SSOT reviewでAPPROVED QUA-003がmigration semanticsをC3としてSSOT delta＋required human authorityを要求すると判定。SQL/実DB/migration適用は行わずcandidate exact2をrevertし、worktree cleanへ復帰した。DB-002/QUA-003準拠のhuman authorityとWP/SSOT delta後に再実装する。reception timestamp adapterは次の非gated sliceへ繰り下げる。

- [x] WP-4214 harden PostgreSQL reception timestamp adapter authority(MEDIUM-HIGH reception privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: DB `accepted_at` adapterが`instanceof Date`＋own `.toISOString()`または`new Date(object)` coercionを使い、Date内部値とown method返却値を分裂させてもqueue PHI rowをfalse200返却した。create入力でもown method ISOとinternal Date由来JST business dateが分裂したままCOMMITできた。
  - scope/implementation: exact2 `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`。create入力はDate-only intrinsic snapshotを最初のawait/pool.connect前に取得し、captured ISOからdetached Dateを作ってbusiness dateを導出。DB rowは別helperでgenuine Dateまたはprimitive stringだけをintrinsic/canonical ISO化し、invalid/fake/coercible/Proxyはfixed errorへ閉じた。
  - acceptance/tests: deferred connect中に元DateをJST境界越しでmutationしてもINSERT instant/dateはcaptured 14:59:59.999Z/July-09、own method0。invalid createはconnect/query/release0。valid Date/string row、mixed invalid list全体reject、created/existing invalid rowのROLLBACK/COMMIT0、different-patient conflictのhostile timestamp未読・provenance-only COMMITを固定。fixture helper未定義と数字を含むinvalid stringのJS寛容parseを修正した。
  - verification/landing: focused repository30、API569 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent mapper/plan/security/privacy/data reviewはPASS/READY。SQL/schema/migration/contracts/SSOT/idempotency/post-create auditは不変、実DB操作なし。implementation `58b931d`はlocal-only、pushなし。

- [x] WP-4215 harden PostgreSQL patient eligibility timestamp authority(MEDIUM-HIGH patient privacy/workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: `eligibility_checked_at` adapterがDate own methodまたは非Date coercionを実行し、内部値と異なる資格確認時刻をpatient GET/search/reception projectionへfalse200で返した。同列をnull判定と変換で二重readし、stateful getterが別時刻を供給できた。
  - scope/refactor: exact4 new `apps/api/src/db/database-instant.ts`, `patient-repository.ts`, new `patient-repository.test.ts`, `reception-repository.ts`。WP-4214のDate-only/DB Date|string検証をDB内部helperへ一元化し、caller別fixed errorを維持。patient rowはroot Proxyをtrap0拒否後、eligibility列のown data descriptorを一度だけsnapshotし、null omitまたはshared canonical化へ渡す。receptionはhelper抽出/importのみ。
  - acceptance/tests: null、Date own method0、offset string、invalid/coercible/boxed/Promise/invalid Date/spoof/Date Proxy、missing/inherited/accessor/row Proxyを固定。find absence/invalid、search invalid page全体reject、limit+1 lookahead未読+nextCursor、reception created/existing nested invalidのROLLBACK、different-patient conflict未読COMMITを検証した。
  - verification/landing: focused patient9+reception30=39、API578 + integration14 expected skips、Web454、workspace typecheck/test、API build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact4 overlay secret scanをPASS。independent mapper/plan/security/privacy/data reviewはPASS/READY。SQL/schema/migration/contracts/OpenAPI/SSOT/eligibility semantics/auditは不変、実DB操作なし。implementation `8d8b078`はlocal-only、pushなし。

- [x] WP-4216 harden in-memory reception timestamp authority(MEDIUM reception workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: in-memory受付createがcaller Dateのown `toISOString()`を実行後、同じmutable valueをIntlへ再入力していたため、response `acceptedAt`はJST 7/9でも内部業務日は7/10という分裂recordを`created`にできた。fake coercible objectも受付成功できた。HTTP pathはWP-4211のdetached Dateで防御済みだが、repository contractとdev/test adapterがfalse successを許していた。
  - scope/refactor: API internal Date helperをDB限定pathから中立な`apps/api/src/instant.ts`へbehavior-identical移設し、DB patient/receptionはimport pathだけ変更。in-memoryのnew-create分岐だけDate-only intrinsic snapshotし、captured ISOからdetached Dateを作ってJST業務日を導出。既存/競合/破損index判定は時刻validationより先のまま維持した。
  - acceptance/tests: own-hostile genuine Dateのmethod0とcaptured ISO/JST date一致、invalid/coercible/Promise/invalid/spoof/hostile-revoked Proxyのfixed non-echo reject、coercion/trap0、records/index/sequence不変と後続valid同一IDを固定。existing/conflictとindex→record破損/unindexed duplicateはhostile acceptedAt未読で従来結果またはidempotency invariantを維持した。
  - verification/landing: focused patient9+reception32=41、API580 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact6 overlay secret scanをPASS。independent verifierはPASS/READY、findingなし。SQL/schema/migration/contracts/OpenAPI/SSOT/idempotency fingerprint/lifecycle/post-create auditは不変、実DB操作なし。implementation `001e97a`はlocal-only、pushなし。

- [x] WP-4217 harden PostgreSQL reception accepted_at row authority(MEDIUM-HIGH reception privacy/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: PostgreSQL受付rowの`accepted_at`を通常property readしてからvalue validationしていたため、own accessorを実行してraw errorをrepository consumerへ露出し、prototype継承値はschema-valid timestampとしてlist/create/existing projectionへ成功させた。WP-4214はDate/value authorityだけを閉じ、row/column authorityは未固定だった。
  - scope/refactor: exact4 new `apps/api/src/db/database-row.ts`, `patient-repository.ts`, `reception-repository.ts`, `reception-repository.test.ts`。Proxy先行拒否＋own data descriptor一回取得のDB internal helperを抽出し、patient eligibilityの既存処理を機械的移設。受付entry projectionはpatient後/acceptedAt前の既存評価順で`accepted_at` descriptor valueだけを既存instant helperへ渡した。
  - acceptance/tests: own Date/string正規化を維持し、mixed listのaccessor/inherited/missingはgetter0・全体reject。created/same-patient existingの3種column authorityはBEGIN→INSERT[→SELECT]→ROLLBACK、different-patient conflictはaccessor未読でprovenance-only COMMITを固定。whole-row Proxy完全性や他column authorityはscope外として主張していない。
  - verification/landing: focused patient9+reception42=51、API590 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact4 overlay secret scanをPASS。independent plan/security/privacy/data verifierはPASS/APPROVED、findingなし。SQL/params/query/transaction/API-006/contracts/OpenAPI/SSOT/migration/audit/idempotency不変、実DB操作なし。implementation `84019ce`はlocal-only、pushなし。

- [x] WP-4218 harden PostgreSQL reception idempotency provenance authority(MEDIUM-HIGH reception security/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: reception create rowの5 provenance列を通常propertyから各2回、existingの`stored_patient_id`は分岐を含め3回読んでいた。throwing accessorはraw error、inherited値はfalse success、stateful accessorは検査値と返却値またはexisting/conflict分岐を分裂させ、insert COMMIT後にserver側矛盾500となるambiguous retryを作れた。
  - scope/implementation: exact2 `apps/api/src/db/reception-repository.ts`, `reception-repository.test.ts`。WP-4217 shared own-data readerでtenant→pharmacy→key→reception→patientの順に各列を一度だけcaptureし、直後にstring検証、captured scalarだけをbrand化。existing/conflictはprovenance snapshotを一度生成してpatientId分岐と返却へ再利用した。
  - acceptance/tests: 5列のmissing/inherited/accessorはfixed non-echo・getter0、hostile/revoked row Proxy trap0、stateful branch steering拒否、先行invalidで後続provenance/entry projection未読を固定。non-default own-data flagsはcreated/existing/conflictで許容し、invalidはCOMMIT前rollback、rollback failureはoriginal fixed errorを保持してclient破棄。valid conflictはentry未読COMMITを維持した。
  - verification/landing: focused patient9+reception50=59、API598 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent plan/security/privacy/data verifierはPASS/APPROVED、findingなし。SQL/aliases/params/query/transaction/API-006/contracts/OpenAPI/SSOT/migration/audit/idempotency scope/lifecycle不変、実DB操作なし。implementation `10cf5c6`はlocal-only、pushなし。

- [x] WP-4219 harden PostgreSQL patient core row authority(MEDIUM-HIGH patient identity/PHI/workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient DB adapterはeligibility timestampだけown-data snapshot済みで、patient_id/name/kana/birth_date/sex/patient_number/eligibility_statusをraw property readしていた。accessor raw/PHI error、inherited false success、stateful getterによるmixed patient projectionが検索/GET/受付患者解決/queueへ到達できた。
  - scope/implementation: exact2 `apps/api/src/db/patient-repository.ts`, `patient-repository.test.ts`。timestamp-first error precedenceを維持し、core7列をprojection順にshared own-data helperから各1回capture・即時string検証。detached scalarだけをschemaへ渡し、core authority/type/schema failureを固定PHI-safe patient-row errorへ収束した。
  - acceptance/tests: 7列全てのmissing/inherited/accessorはgetter0、invalid semantic stringもZod/raw非echo、non-default own-data flags許容。timestamp失敗時core未読、find invalid全体reject、selected search invalid全体reject、lookahead-only core未読+cursor維持。reception created/existingはcore getter0でrollback、different-patient conflictはcore未読COMMITを固定した。
  - verification/landing: focused patient18+reception50=68、API607 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent plan/security/privacy/data verifierはPASS/APPROVED、findingなし。SQL/pagination/API-001/API-006/contracts/OpenAPI/SSOT/migration/audit/idempotency/transaction不変、実DB操作なし。implementation `d712d30`はlocal-only、pushなし。

- [x] WP-4220 harden PostgreSQL reception entry core row authority(MEDIUM-HIGH reception workflow/data integrity/security / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: reception DB entry projectionで最後に残った`reception_id`/`reception_status`をraw property readしていた。accessor raw error、inherited/schema-valid false success、whole-row Proxy trapを許し、stateful status accessorはcreated resultをIN_PROGRESSへ偽装してCOMMIT後server failure/ambiguous retryを作れた。
  - scope/implementation: exact2 `apps/api/src/db/reception-repository.ts`, `reception-repository.test.ts`。ID→patient→accepted_at→status→schemaの既存順で両core列をshared own-data helperから各1回capture・string検証し、detached schema failureだけを固定reception-row errorへ収束。patient/timestamp/provenance error precedenceは維持した。
  - acceptance/tests: 両列のmissing/inherited/accessorはgetter0、invalid schema fixed non-echo、descriptor flags許容、hostile/revoked list row Proxy trap0、mixed list全体reject。created/existingのinvalid statusはrollback、different-patient conflictはstatus/patient/accepted_at未読COMMIT。invalid IDはcreated/existingでprovenance error先行を維持した。
  - verification/landing: focused patient18+reception63=81、API620 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent plan/security/privacy/data verifierはPASS/APPROVED、findingなし。SQL/aliases/params/API-006/contracts/OpenAPI/SSOT/migration/audit/idempotency/transaction不変、実DB操作なし。plain own-dataのschema-valid status/acceptedAt semantic mismatchは別pre-COMMIT binding候補として残し、implementation `ad40f47`はlocal-only、pushなし。

- [x] WP-4221 bind PostgreSQL created reception facts before COMMIT(MEDIUM-HIGH reception workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: INSERT RETURNING rowがschema-validでも`reception_status!=WAITING`またはinput captured instantと異なる`accepted_at`ならrepositoryはcreatedをCOMMITし、その後server defenseが500/audit0で拒否していた。DB成功とHTTP失敗が分裂し、retry結果が不明確になるambiguous completionだった。
  - scope/implementation: exact2 `apps/api/src/db/reception-repository.ts`, `reception-repository.test.ts`。created分岐だけprovenance/entry projection後・COMMIT前にstatus WAITING→captured canonical acceptedAtの順で完全一致を検証し、別々の固定non-echo invariantへ閉じた。caller Dateは再読せずcreate冒頭のprimitive ISOを再利用した。
  - acceptance/tests: IN_PROGRESS/COMPLETED/CANCELLEDと±1ms acceptedAt mismatchはBEGIN→INSERT→ROLLBACK、両方不一致はstatus優先、rollback failureは原fixed error保持+client破棄。canonical同一+09:00はcreated COMMIT。existingはhistorical acceptedAtと進行statusを許容し、conflictはentry未読COMMITを維持した。
  - verification/landing: focused patient18+reception74=92、API631 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent plan/security/data verifierはPASS/APPROVED、findingなし。SQL/params/contracts/OpenAPI/SSOT/migration/audit/idempotency lifecycle不変、実DB操作なし。patient snapshot/identity bindingとpost-create audit atomicityは別scope、implementation `8d518a7`はlocal-only、pushなし。

- [x] WP-4222 bind PostgreSQL reception command results before COMMIT(MEDIUM-HIGH reception workflow/data integrity/security / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: created RETURNING rowのscope/key/patient/generated reception ID、entry identity、patient snapshotがschema-validでもcommandと異なる場合、repositoryはCOMMIT後にserver guardで500/audit0となり得た。existing/conflictもSELECT provenanceのscope/keyをcommandへ再結合せず、same-patient existingのentry/provenance identity mismatchを成功投影できた。
  - scope/refactor: production exact2とfixture-only exact1。tenant/pharmacy/keyとpatient全8fieldをDB接続前にown-data/schema snapshotし、SQL parameterと比較へ同じdetached値を再利用。createdはcommand provenance→entry identity→patient snapshot→WP-4221 status→acceptedAtの順、existingはscope/key→entry identity、conflictはscope/keyだけをCOMMIT前にbindした。patient repository本体、SQL text/alias/position、audit/idempotency lifecycle/contracts/schema/migration/SSOTは不変。
  - acceptance/tests: created provenance 5次元、generated ID、entry patient ID、patient 6 core fieldとoptional eligibility timestampのpresence/value、canonical timestamp、await前mutation、hostile accessor/Proxy、precedence、rollback failure quarantineを固定。existingはhistorical patient snapshot/time/advanced statusを許容しつつscope/key/identityをbindし、conflictはentry未読を維持。fixtureはcreated INSERTだけgenerated IDを反映し、existing historical rowを保持した。
  - verification/landing: focused patient18+reception98=116、API655 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact3 overlay secret scanをPASS。independent plan/security verifierはPASS/APPROVED、findingなし。post-create `reception.created` audit atomicityはWP-4050/WP-4151c human gateへ維持し、実DB操作なし。implementation `b32b01b`はlocal-only、pushなし。

- [x] WP-4223 detach in-memory reception patient ownership(MEDIUM-HIGH patient identity/privacy/reception workflow/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: in-memory受付new-createがcaller-owned `input.patient`参照をrecordへ保存していた。create後の通常object mutationだけでlist/existingの患者投影が変わり、保存済みprimitive patientId/provenanceとentry patientIdが分裂するwrong-patient false stateを再現した。invalid patient schemaもstate更新後のreturn projectionで初めて失敗し得た。
  - scope/refactor: exact2 `apps/api/src/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`。patientIdをown data descriptorから一度だけcapture/brand化し、existing/conflict/idempotency integrityはこのIDだけで従来順に判定。new-createだけacceptedAt検証後、残り全fieldとoptional eligibility timestampのexact presenceをown-dataからdetached schema snapshot/freezeし、records/index/sequence更新前に保存した。
  - acceptance/tests: callerが全fieldを変更してもcreated/list/original-ID existingは作成時snapshot、changed-ID replayはentryなしconflict、provenanceもoriginal。created/list返却object mutationは保存stateへ逆流しない。optional absent/explicit undefined/valueを固定。required/optional schema invalid、inherited/accessor/stateful/Proxyは固定non-echo、getter/trap0、records/index/sequence不変、次valid ID非消費。existing/conflictはhostile non-ID fieldとacceptedAtを未読のまま維持した。
  - verification/landing: focused reception110、API667 + integration14 expected skips、Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact2 overlay secret scanをPASS。independent plan/security/privacy/data/medical verifierはPASS/APPROVED、findingなし。API-006 result kinds、audit、idempotency lifecycle、PostgreSQL/DB/contracts/OpenAPI/SSOT/migration不変、実DB操作なし。implementation `512e087`はlocal-only、pushなし。

- [x] WP-4224 harden PostgreSQL patient query row-set authority(MEDIUM-HIGH patient identity/privacy/API trust boundary/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: patient DB adapterは個別rowをharden済みでも、外側のquery resultをraw `rows[0]`/`rows.slice()`/`rows.map()`/`rows.length`で信頼していた。findはindex accessor実行や複数rowの先頭採用、searchは物理0行でもoverride `slice()`からDBにない患者をHTTP 200投影できた。
  - scope/refactor: non-overlap exact3 `apps/api/src/db/database-row.ts`, `patient-repository.ts`, `patient-repository.test.ts`。query resultのown-data `rows`を一度取得し、non-Proxy Arrayのown lengthと0..N-1全indexをdescriptorで検証、上限内dense valueだけをfresh frozen snapshotへコピーするgeneric DB helperを追加。find max1、search max `limit+1`で直後にsnapshotし、以後はtrusted arrayだけを投影/pagination判定へ使用した。
  - acceptance/tests: rows missing/inherited/accessor/non-array、root/rows Proxy・nested revoked rows、sparse/inherited/accessor index、find2行、search over-capをfixed PHI-safe errorでgetter/trap0・patient field未読reject。物理empty+hostile slice/map/iterator/coercionはmethod0でempty。non-default descriptor許容、0/1行find、selected invalid全体reject、exact lookahead未読+cursorを維持。revoked root resultはPromise thenable assimilationでrepositoryへfulfilled到達不能のため非主張とし、到達可能なroot Proxy/nested revoked rowsを固定した。
  - verification/landing: focused patient23、tracked HEAD API672 + integration14 expected skips、shared worktree Web454、workspace typecheck/test/build、lint/script harness/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/diff、tracked HEAD+exact3 overlay secret scanをPASS。independent plan/API/security/privacy/data/medical verifierはPASS/APPROVED、findingなし。SQL/params/ILIKE/order/cursor/contracts/server/audit/idempotency/SSOT/migration不変、実DB操作なし。implementation `6c7bda1`はlocal-only、pushなし。out-of-scope concurrent reception exact2と`.omo/`は未編集・未stage。

- [x] WP-4225 harden reception create command authority parity(MEDIUM-HIGH reception security/privacy/data integrity/API contract / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: in-memoryとPostgreSQLのcreate command root/scope/key/patient authorityが別実装で、inherited/accessor/Proxy、blank/control scope、oversize keyの拒否と、existing/conflictで未使用fieldを読まないerror precedenceを同じ境界で証明できなかった。
  - plan/proximity: L0はprovider-neutral staged own-data readerと`ReceptionCreateInput` root guard、L1は両repository createと回帰test、L2はcanonical `receptionIdempotencyKeySchema`再利用・scope validation共通化・DB row reader委譲。exact7=`apps/api/src/own-data-property.ts`, `apps/api/src/db/database-row.ts`, `apps/api/src/db/reception-repository.test.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/reception-repository.ts`, `packages/contracts/src/reception-queue.test.ts`, `packages/contracts/src/reception-queue.ts`。list/patient operation、SQL/schema/migration、route/audit/Web、WP-4050 audit atomicity、WP-4151c ambiguous retry lifecycleは除外した。
  - implementation/tests: own data descriptorをgetter/trap0で段階取得し、null/non-object/Proxy/revoked Proxy、missing/inherited/accessorを固定non-echo errorへ閉じた。tenant/pharmacyはshared-kernel factory、keyはcontractsのcanonical schemaを再利用。InMemoryはroot→patientId→scope/key→idempotency→new-only acceptedAt/残patient、PostgreSQLはroot→scope/key→full patient→acceptedAt→connectの順を固定し、existing/conflictのlazy readとstate/connect zeroを維持。初回reviewで見つかったinvalid scope/key受理、helper重複、不要union/per-read closure、provider precedence test不足は修正済み。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gateは各5/5 PASS。reception155、patient23、server293、API717 + local PostgreSQL14 expected skips、Web454、contracts97、audit183、workspace typecheck/test/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diffをPASS。local DBはzero-skip証拠ではない。live secret scanは既存`.codegraph` symlinkでfail-closedだが、tracked HEAD+exact7 overlay scanはPASS。UI変更なしのためbrowser N/A。WP-4050/WP-4151c human gateは不変。implementation `32ea898`はexact11(code exact7 + ledger exact4)でlocal commit済み、post-commit independent re-review 5/5 PASS、push未承認。`.omo/`は除外。

- [x] WP-4226 harden PostgreSQL reception create query row-set authority(MEDIUM-HIGH reception privacy/data integrity/API trust boundary / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: PostgreSQL reception createは個別rowをharden済みでも、`INSERT ... RETURNING`とscoped idempotency `SELECT`のquery resultをraw `rows[0]`へ委ね、missing/inherited/accessor/Proxy、sparse index、複数rowをprojection前に拒否するrow-set authorityがなかった。reviewではdense `[undefined]`がgeneric snapshotを通過し、固定row-set errorではなく後段projection errorへ落ちるP1も検出した。
  - plan/proximity: exact2 `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`。INSERT RETURNINGとscoped idempotency SELECTをprovider-neutral own-data snapshot + max1へ閉じ、existing/conflict/createdの既存provenance・command bindingとtransaction precedenceを維持する。listはauthoritativeな有限上限がなく、安全なcapを推測できないため除外。SQL text/params/schema/migration/contracts/route/audit/idempotency lifecycle、WP-4050/WP-4151cは変更しない。
  - implementation/tests: query result root/rows/length/dense indexをown data descriptorから単一snapshotし、missing/inherited/accessor/non-array、root/rows Proxy・revoked Proxy、sparse/inherited/accessor index、2-row resultとdense `undefined`をrow field未読・getter/trap0の固定PHI-safe errorへ閉じた。transaction中の異常はROLLBACKし、rollback failure時も原fixed errorを保持してclientを`release(true)`で破棄する。正常0/1 rowとcreated/existing/conflict semanticsは維持した。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gateは各5/5 PASS。focused reception166、patient23、server293、API728 + local PostgreSQL14 expected skips、Web454、contracts97、audit183、workspace test/typecheck/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diffをPASS。live secretsは既存`.codegraph` symlinkでfail-closed、tracked HEAD+exact2 overlay scanはPASS。UI変更なしでbrowser N/A、実DB・remote/prod・pushなし。WP-4050/WP-4151c human gate不変、`.omo/`除外。implementation `3fc3c4e`をexact6(code exact2 + ledger exact4)でlocal commit済み、post-commit independent re-review 5/5 PASS。full remote DB evidenceは非主張。

- [x] WP-4227 harden patient lookup/search command authority parity(MEDIUM-HIGH patient identity/privacy/pagination/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: InMemory patient lookup/searchはraw input fieldをscan中まで再読取でき、PostgreSQL patient lookup/searchもscope/query/limit/cursorをquery準備・await後に再読取できたため、stateful getter等がauthorityとpaginationを混在させ得た。さらに初回実装reviewで、lookahead時に同じsnapshotterへ再投入不能な上限next cursorを返し得るP2を検出した。
  - plan/proximity: exact7=`apps/api/src/repository-command.ts`, `apps/api/src/reception-repository.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/patient-repository.ts`, `apps/api/src/patient-repository.test.ts`, `apps/api/src/db/patient-repository.ts`, `apps/api/src/db/patient-repository.test.ts`。root→tenant→pharmacy→patientIdまたはq→limit→cursor→offsetのone-shot command snapshotをscan/query/await前に固定し、既存reception scope helperはneutral moduleへ挙動同等抽出する。contracts/OpenAPI/server/audit/reception semantics/SQL schema/migration/WP-4050/WP-4151cは変更しない。
  - implementation/tests: own-data primitive guard、canonical shared-kernel IDsとpatient search q/limit schema、安全整数cursor/limit arithmeticを両providerで共有。invalid commandは固定non-echo errorかつscan/query 0、SQL/LIKE escape/order/limit+1 projectionを維持。next cursorは同一snapshotterへ再投入可能な範囲だけ返し、lookaheadで上限を超える場合は固定pagination invariantへfail-closed化した。missing/inherited/accessor/Proxy/revoked/boxed/stateful/unsafe boundaryとprovider parity/round-tripを固定した。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gateは各5/5 PASS、post-commit independent reviewもrollback記録P2修正後5/5 PASS。focused patient56 + reception166 = 222、API758 + local PostgreSQL14 expected skips、Web454、workspace test/typecheck/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diff PASS。live secretsは既存workspace scopeでfail-closed、tracked HEAD+exact7 clean overlayはPASS。UI/browser N/A、実DB・remote/prod・pushなし、`.omo/`除外。implementation `fa9ef5e`をexact11(code exact7 + ledger exact4)でlocal commit済み、FINALIZED / INDEPENDENT_PASS。rollbackは`fa9ef5e`と後続ledger-only finalization commitをrevertし、patient/reception focused testと標準gateを再実行する。DB/schema/data rollbackは不要だが、raw command authorityと上限cursor riskが再開する。

- [x] WP-4228 harden reception list command authority parity(MEDIUM-HIGH reception privacy/context/data integrity / R2) — FINALIZED / INDEPENDENT_PASS
  - finding: InMemory reception listはfilter中にraw `tenantId`/`pharmacyId`/`date`を各recordで再読取し、stateful authorityでscope/dateが混在し得た。PostgreSQL listもraw command fieldを直接SQL parameterへ渡し、repository境界で両provider共通のown-data/canonical authorityを証明できなかった。
  - plan/proximity: exact3=`apps/api/src/reception-repository.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`。root→tenant→pharmacy→dateをscan/query前に一度snapshotし、scopeはshared-kernel factory、dateは`CalendarDate.fromString().toString()`へ統一。contracts/server/SQL/schema/migration/POST/create/idempotency/audit、承認済み有限上限のないPostgreSQL list row-set、WP-4050/WP-4151cは除外した。
  - implementation/tests: provider-neutral frozen list command snapshotを両providerが再利用し、invalid root/missing/inherited/accessor/Proxy/revoked/boxed/undefined/null/control/impossible dateを固定non-echo・getter/trap/scan/query 0で拒否。non-default descriptor、mixed tenant/pharmacy/date collection、post-snapshot mutation、SQL parameter tuple/order、empty semanticsをsynthetic fixtureで固定した。reviewでcontract schema直参照・isolation証拠不足・invalid matrix不足のP2を修正し、存在しないscope ID最大長は独自導入しなかった。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gateは各5/5 PASS。COMMIT gateとpost-commit independent reviewもそれぞれ5つのfresh contextで5/5 PASS。reception175、API767 + local PostgreSQL14 expected skips、Web454、workspace test/typecheck/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diff PASS。live secretsは既存workspace scopeでfail-closed、tracked HEAD+exact3 clean overlay PASS。UI/browser N/A、実DB・remote/prod・pushなし、`.omo/`除外。implementation `8d784d6`をexact7(code exact3 + ledger exact4)でlocal commit済み、FINALIZED / INDEPENDENT_PASS。rollbackは`8d784d6`と後続ledger-only commitをrevertしfocused/standard gatesを再実行する。DB/schema/data rollback不要だがraw list command/mixed-scope riskが再開する。

- [x] WP-4230 reject non-primitive branded ID inputs(shared runtime ID authority/data integrity / R1) — FINALIZED / INDEPENDENT_PASS
  - finding: shared-kernelの12 branded ID factoryはcompile-timeでは`string`でも、runtimeでprimitive判定せず`length`/`trim()`を参照していた。boxed Stringや任意coercible objectをobject参照のままbranded stringとして返し、hostile/revoked Proxyのraw errorやnull等の偶発TypeErrorも露出した。
  - plan/proximity: exact2=`packages/shared-kernel/src/branded-ids.ts`, `packages/shared-kernel/src/kernel.test.ts`。共通`assertValidId`の全property access/coercion前にprimitive string guardを置き、既存label-only non-echo `RangeError`へ収束する。公開signature/export/brand、empty/blank/control拒否、whitespace/Unicode/任意長のexact-preserve、contracts固有max128は不変。contracts/API/Web/DB/migration/audit/events/SSOT/package/lock/production/pushは除外した。
  - implementation/tests: production差分は先頭`typeof` guard 1条件のみ。全12 factoryを表形式で検証し、null/undefined/number/boolean/bigint/symbol/function/array/object/boxed String/Promise、coercion hooks、hostile/revoked Proxyを固定RangeError・trap/coercion0で拒否。既存invalid grammarと長いUnicode/前後空白を含むvalid primitiveの完全保持を固定した。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gateは各5 fresh contextで5/5 PASS、post-commit independent reviewも5/5 PASS、finding 0。shared-kernel60、workspace1758 + local PostgreSQL14 expected skips(API767/Web454)、workspace test/typecheck/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diff PASS。live secretsは既存workspace scopeでfail-closed、tracked HEAD+exact2 clean overlay PASS。実DB/remote/prod/UI/browser/push非主張、`.omo/`除外。implementation `dde98cd`をexact6(code exact2 + ledger exact4)でlocal commit済み、FINALIZED / INDEPENDENT_PASS。rollbackは`dde98cd`＋ledger-only commit revertとfocused/standard revalidation、DB/schema/data rollback不要だがnon-primitive branded ID受理riskが再開する。

- [x] WP-4231 bind reception URL business dates to CalendarDate authority(Web workflow/date authority / R1) — FINALIZED / INDEPENDENT_PASS
  - finding: reception dashboardの`?date=`復元は独自regex＋`Date.UTC`往復検証を持ち、ECMAScriptのyear 0..99→1900..1999補正によりAPPROVED `CalendarDate`が許可する`0001-01-01`〜`0099-12-31`を誤拒否した。API-006は業務暦日検証を`@yrese/date-time`へ委譲し独自parserを禁止している。
  - plan/proximity: exact5=`apps/web/app/reception-dashboard.tsx`, `apps/web/app/reception-dashboard.test.tsx`, `apps/web/package.json`, `apps/web/next.config.ts`, `pnpm-lock.yaml`。`CalendarDate.fromString(value).toString()`を唯一のauthorityとし、RangeErrorだけを既存`undefined`へ収束。Web direct workspace dependency、lock importer、Next transpile targetを同時追加する。URL first-value、DOM/copy/ARIA/CSS/animation/focus、state/lifecycle/fetch、API/contracts/DB/SSOT/date-time本体は不変。
  - implementation/tests: `0001/0004 leap/0099/0100/2000 leap/9999`をtimezone変換なしでexact preserveし、`0000`、non-leap、empty、malformed、impossible、PHI-likeをnon-echo拒否。duplicateは先頭値だけをauthorityとしてinvalid-firstから後続validへfallbackしない。予期しないnon-RangeErrorは再throwする。frozen lockは220 entriesでPASS、Next 15.5 production buildは12/12 static pages、`/` First Load JS 137kB/shared102kB。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gateは各5 fresh contextで5/5 PASS、post-commit independent reviewも5/5 PASS、finding 0。dashboard112、date-time13、Web461、workspace1765 + local PostgreSQL14 expected skips(API767)、workspace test/typecheck/build、lint/OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diff PASS。live secretsは既存workspace scopeでfail-closed、tracked HEAD+exact5 clean overlay PASS。browser/real DB/remote/prod/push非主張、`.omo/`除外。implementation `369f9c8`をexact9(code exact5 + ledger exact4)でlocal commit済み、FINALIZED / INDEPENDENT_PASS。rollbackは`369f9c8`＋ledger-only commit revertとfocused/standard revalidation、DB/schema/data rollback不要だが低年URL誤拒否と独自parser driftが再開する。

- [x] WP-4232 bind reception acceptedAt date/time to fixed JST CalendarDate authority(API/Web date authority / R1) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS
  - finding: InMemory/PostgreSQL/API/Webで`acceptedAt`から業務日付を得る経路がhost-local Date getterまたはIANA timezone formattingに依存し得た。特にhistorical `Asia/Tokyo`はlocal mean timeを返し、MOD-011の固定JST(+09:00、DSTなし)と境界時刻がずれる。
  - plan/proximity: exact7=`apps/api/src/reception-repository.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/server.ts`, `apps/web/app/reception-dashboard.tsx`, `apps/api/src/db/reception-repository.test.ts`, `apps/api/src/server.test.ts`, `apps/web/app/reception-dashboard.test.tsx`。genuine Dateをintrinsicで一度snapshotし、epochへ+09:00を加えたUTC部品を`CalendarDate.fromParts()`へ渡す。repository scan/query/connect、server projection、Web default today/queue membership/受付時刻表示を同じfixed-JST authorityへ統一し、固定non-echoで拒否する。SQL/contracts/schema/migration/DB data、lifecycle/idempotency/audit、DOM/copy/ARIA/CSS/animationは除外した。
  - implementation/tests: year 0001/0004 leap/0099→0100/9999境界、local BCE/10000、invalid/non-Date/boxed/coercible/hostile/revoked Proxy、own Date method無視、InMemory mutation zero、PostgreSQL connect/query zeroとcanonical SQL date、server 500 no-store/non-PHI、Web queue success/error non-echoを固定。BUG_REFACTOR reviewでhistorical IANA表示がfixed-JST membershipと分裂するP2を検出し、Web apps層のsingle fixed-JST snapshotへ`todayAsIsoDate`と`formatAcceptedTime`を統合、0001 09:00・0099 midnight前後・9999 23:59とinvalid/out-of-range non-echoを固定した。astronomical year 0000のinstantでもfixed-JST local dateが0001なら受理し、local year 0000は拒否する。
  - verification/landing: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT/PUSH gateは各5 fresh contextで5/5 PASS。BUG_REFACTORのarchitecture/integration/plan P2とVALIDATION count P2を全てFIXED後に再review PASS。focused API497 + Web136、workspace1818 + local PostgreSQL14 expected skips、workspace typecheck/test/build、全標準gate、tracked HEAD+exact11 overlay secrets PASS。implementation `3ffdb14`＋ledger `151c059`をfeature branchへfast-forward push。local/remote `151c059` parity、main不変、deployments 0、draft PR #1 CI run `29587027626`はPostgreSQL-backed test/secrets/buildを含む全step SUCCESS。browser artifact/production/deploy非主張、`.omo/`除外。rollbackは`151c059`→`3ffdb14`をrevertしてfocused/standard revalidation、DB/schema/data rollback不要だがhistorical IANA/host date authority riskが再開する。

- [x] WP-4233 harden PostgreSQL reception-list query row-set authority(MEDIUM reception PHI/data integrity/availability / R2) — FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS
  - finding: PostgreSQL reception listはcommand authorityを固定済みだが、fulfilled query resultをraw `result.rows.map(rowToEntry)`へ渡す。同repository create/patient queryのown-data dense snapshotと不整合で、later malformed indexより先にearlier PHI-bearing row fieldを読み得る。
  - plan/proximity: code exact3=`apps/api/src/db/database-row.ts`, `apps/api/src/db/reception-repository.ts`, `apps/api/src/db/reception-repository.test.ts`。既存bounded `snapshotDatabaseQueryRows`のsignature、invalid maximum precedence、over-cap behavior、全consumerを不変にし、別名unbounded structural snapshotをprivate coreから追加。listは全row-setをfresh frozen containerへsnapshot後、全件のundefined prepassを完了してからrow projectionする。row object deep freezeは主張しない。
  - acceptance/tests: root/rows own-data、Proxy/revoked nested rows、sparse/inherited/accessor index、dense undefined first/middle/last、先行hostile row＋後続malformed authorityでfield read 0、raw map/slice/iterator/coercion 0、non-default descriptor、direct helper freeze/detach、empty/1/multi/order/cardinality、SQL tenant/pharmacy/date tupleとORDER BY/no LIMIT、row/timestamp error precedence、bounded reception/patient regressionsを固定する。revoked query-result rootはPromise assimilation境界のためrepository testで無理に主張しない。
  - verification/residual: PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT/PUSH gateとpost-commit independent reviewは各5 fresh contextで5/5 PASS。bounded runtime `undefined` precedence回帰、後方undefined prepass証拠不足、validation/ledger過剰表現をreviewで検出して修正。focused reception209＋patient39=248、API807＋local PostgreSQL14 expected skips、Web485、workspace1829＋同14 skips、workspace typecheck/test/build、OpenAPI/purity/boundaries/SSOT173/deps high0 critical0/SBOM231/scripts/diff PASS。`pnpm lint`はworkspace lint task不在のためexit0だがlint coverageなし。live secretsは既存workspace protected scopeでfail-closed、tracked HEAD+exact7 overlay PASS。implementation `1f181c5`とledger `020965f`をsafe feature branchへpushし、local/remote/PR head `020965f`一致、deployments 0、origin/main `27d6144`不変を確認。draft PR #1 CI run `29601464612` / job `87954323760`はexact head `020965f`でPostgreSQL-backed testをzero-skip実行し全workflow step SUCCESS。これはGitHub-hosted integration proofであり、実providerがmalformed rowを生成した証拠、production DB/runtime、browser、deploy、cap/pagination、DoS/resource hardeningは非主張。SQL/paramsとvalid dense-rowのorder/cardinality、unbounded list contract、contracts/schema/migration/DB data/server/Web/UIは不変。追加O(n) snapshot＋prepassとunbounded DB/network/heap riskは残存。`.omo/`除外。remote evidence記録だけを取り消す場合は当該exact4 docs commitだけをrevertする。WP-4233 implementation自体を戻す場合は当該exact4 docs commit、`020965f`、`1f181c5`を順にrevertしてfocused/API/Web/workspace/standard revalidationする。DB/schema/data rollback不要だがraw row-set/TOCTOU riskが再開する。

- [x] WP-4068 event/audit ISO instant calendar validation(codex 提案 SELF-SCAN-20260710-13、MEDIUM、fable5 PLAN_APPROVED、実装完了)
  - 発見根拠: `packages/events/src/index.ts` の `isoInstantPattern` は月ごとの実在日を検証せず、`2026-02-30T00:00:00Z` のような存在しない ISO 暦日を `wallClock` として受理する。`packages/audit/src/index.ts` は同じ形式確認後に `new Date(value).toISOString()` を使うため、存在しない日付を別の実在日時へ正規化してから audit hash を生成する。
  - 影響: 同一の不正 timestamp が sync event では原文のまま、audit event では正規化後の値として扱われ、監査証跡・同期順序・hash canonicalization の再現性と入力同一性を損なう可能性がある。
  - 実装: `@yrese/events` に `assertIsoInstant` を追加し、primitive string / non-empty を明示検証したうえで、既存の timezone 必須・year/offset/fraction lexical semantics を維持し、捕捉した年月日が proleptic Gregorian calendar 上で実在することを検証する。任意長 year は全体を数値化せず、400年周期に必要な末尾4桁だけで閏年判定する。event envelope は原文を保持し、`@yrese/audit` は共有検証後に既存の offset→UTC 正規化を行う。
  - テスト・検証: 非閏年2026/2023/1900年の2月29日、2月30/31日、4月31日を Z/offset 入力で拒否し、2028/2024/2000年の2月29日、任意長 year、原文保持、valid leap offset の UTC 正規化を固定。null / undefined / boxed String / `toString` object の暗黙文字列化も拒否。events 45 tests PASS、audit 46 tests PASS、両 package の typecheck/build PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。既存 audit golden hash は不変更。

- [x] WP-4069 dependency audit report fail-closed validation(codex 提案 SELF-SCAN-20260710-14、HIGH、fable5 PLAN_APPROVED、実装完了)
  - 発見根拠: 旧 `scripts/check-deps.mjs` は `metadata.vulnerabilities` と欠落 severity を空/0へ既定化し、count を `Number()` へ強制変換していたため、`{}`・error-only・欠落/不正 count を脆弱性0件として通した。live path も stdout が parse できれば pnpm の nonzero status を無視できた。
  - 実装: audit report root、`metadata.vulnerabilities`、全5 severity count を検証し、plain object 以外、error field、欠落、文字列、負数、小数、unsafe integer を fail-closed にした。live command は spawn error・signal・status を評価し、妥当な0件 report + status=0 だけを pass とする。warn-only は `ERR_PNPM_META_FETCH_FAIL` / `ERR_PNPM_FETCH*` と具体的な system network code に限定し、generic な registry/network/socket/timeout 文言では例外化しない。
  - 回帰テスト: clean pass、`{}`、error-only、metadata/vulnerabilities 欠落、array、文字列/負数/欠落/小数/unsafe count、HIGH/CRITICAL、明示 registry outage、generic network-like near miss、偽 `pnpm` の parseable clean JSON + exit 23 を固定した。
  - 検証: `pnpm test:scripts` PASS、元の3 false-pass reproduction は全て exit 1、`pnpm check:deps` PASS(high=0, critical=0)、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

- [x] WP-4070 SBOM component version/link validation fail-closed(codex 提案 SELF-SCAN-20260710-15、fable5 PLAN_APPROVED、HIGH、本WPで実装)
  - 発見根拠: `scripts/check-sbom.mjs` の `normalizeVersion()` は component の version 欠落・空文字を `0.0.0` に合成し、workspace `link:` の解決失敗も未解決文字列のまま通す。`collectComponents()` は不正な name/node を黙って skip するため、malformed dependency が欠落した SBOM でも `validateSbom()` を通過できる。`scripts/check-scripts.mjs` は正常 fixture/link 解決だけを検証し、`.github/workflows/ci.yml` の `pnpm check:sbom` もこの false-pass をそのまま green にする。
  - 影響: dependency の実 version が欠落・偽装・未解決でも `0.0.0` 等の component/purl を生成するか component 自体を落として CI が成功し、脆弱性照合・供給網 inventory・監査追跡の完全性を損なう。
  - 実装: pnpm list の workspace root / dependency node / dependency container を plain object と primitive nonblank name/version/path で fail-closed 検証。明示 `0.0.0` と nonblank version 原文は semver/trim 正規化せず保持し、`unsavedDependencies` は明示的に対象外として無視、既知 pnpm 追加fieldは許容する。workspace `link:` は nonblank suffix + absolute node path + 登録済み workspace path + dependency key/name 一致 + non-link concrete target version を全て要求する。workspace path 重複と同名 workspace の path/version conflict は拒否し、同一 dependency name/version component の再出現は従来どおり dedupe する。
  - fail-closed: missing/blank version の `0.0.0` 合成と malformed node の silent skip を廃止。package name は unscoped `^[^/@\s]+$` または scoped `^@[^/@\s]+/[^/@\s]+$` の構造だけを許可し、semver/lowercase正規化は行わない。component Map は `JSON.stringify([name, version])` の非曖昧pair keyで管理し、emitted bom-ref重複は最終validationへ到達させる。workspace rootはdependency traversal前に全件applicationとしてcanonical emitし、root順序によるlibrary降格を防止。同名同versionのnon-link dependencyはworkspace/external identity conflictとして拒否する。`link:` suffixはnonblank確認だけに用い、pnpmのabsolute `node.path`→unique workspace registryだけをidentity authorityとする(cwd/link text解決なし)。validation error は raw node/name/version/link/path/resolved URL を含まない固定contextに限定する。
  - atomic publish: 全validation後にserializeし、target同一directoryの exclusive unique 0600 temp fileへ書いてから atomic renameする。temp write/rename失敗時はbest-effort cleanupして既存targetを保持する。CycloneDX 1.5 shape と live pnpm list の正常生成は維持し、package/lock/CI は変更していない。
  - テスト・検証: valid/live-like shape、root順序正逆でworkspace application維持、非権威link suffix + canonical node.path解決、workspace impersonation拒否、root/dependency/link target の explicit `0.0.0`、version原文保持、component dedupe、`unsavedDependencies` ignore、missing/blank、malformed root/container/node/nested node、whitespace/extra `@`/slashを含むinvalid name、bom-ref境界攻撃、empty/unresolved/pathless/relative/name-mismatch/target-link、workspace path/name conflict、raw値非露出、malformed時のoutput no-create/no-overwrite、rename失敗時の既存target保持/temp artifact cleanupをfixtureで固定。`node --check scripts/check-sbom.mjs` / `scripts/check-scripts.mjs`、`pnpm test:scripts`、`pnpm check:sbom`(231 components)、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check` は PASS。

- [x] WP-4071 patientNumber tenant/pharmacy uniqueness enforcement(codex 提案 SELF-SCAN-20260710-16、fable5 PLAN_APPROVED、HIGH、本WPで実装)
  - 発見根拠: APPROVED DOM-002 は Patient の `patientNumber` を `(tenant_id, pharmacy_id)` 内で一意とするが、PostgreSQL migration `000002_create_patient_and_reception_tables.sql` は `patient_number NOT NULL` / non-empty CHECK と非一意の検索 index だけを定義し、同一 tenant・pharmacy・patientNumber の重複を許す。
  - 医療安全影響: 同じ薬局内に同一患者番号の別 Patient が永続化されると、患者検索・受付紐付け・後続の処方/調剤操作で表示上の識別が曖昧になり、別患者を選択して受付・調剤情報を関連付ける wrong-patient risk を生む。
  - 実装: 適用済み `000002` は checksum `2910b460...b599` のまま不変とし、forward-only `000003_add_patient_number_scope_unique.sql` で exact `(tenant_id, pharmacy_id, patient_number)` named UNIQUE constraint を追加。大文字小文字変換・trim・正規化、既存重複の UPDATE/DELETE/自動統合、既存 `patients_search_idx` の削除は行わない。legacy 重複があれば SQLSTATE 23505 で migration transaction 全体が rollback され、別途承認された運用 remediation を要求する。
  - テスト・検証: 静的 migration tests は `000003` の forward order、既存 `000002` checksum 不変、exact 3-column uniqueness、DML/normalization/index drop 不在を固定。disposable schema 用 PostgreSQL integration tests は同一 tenant+pharmacy+exact patientNumber の2件目が constraint 名付き SQLSTATE 23505、tenant/pharmacy 越えの同値許可、case/whitespace variant の exact-value 区別、scoped search 維持、legacy 重複時の migration rollback/history/rows不変を固定した。`TEST_DATABASE_URL` 不在のため実DB統合5件は明示 skip、migration の実適用は未実行。focused static 10 PASS + integration 5 SKIP、API全体67 PASS + integration 5 SKIP、API typecheck、`pnpm check:boundaries`、`pnpm check:secrets`、`git diff --check` は PASS。

- [x] WP-4072 SQL secret scan coverage(codex 提案 SELF-SCAN-20260710-17、fable5 PLAN_APPROVED、HIGH、本WPで実装)
  - 発見根拠: `scripts/check-secrets.mjs` は明示 `textExtensions` allow-list だけを走査するが `.sql` を含まないため、`migrations/*.sql` に synthetic API key/private key/generic credential を置いても検査対象にならない。`.github/workflows/ci.yml` は同 script を `pnpm check:secrets` として実行するため、SQL 内 secret を見落としたまま CI が green になりうる。
  - 影響: migration、seed、DDL/DML に誤って埋め込まれた credential が repository history と build artifact に残り、DB適用や配布を通じて漏洩・不正アクセスへつながる。現在の migration 群が clean でも、拡張子単位の恒久的な検査欠落は将来変更を防げない。
  - 実装: `scripts/check-secrets.mjs` の既存 text extension allow-list に `.sql` だけを追加。secret pattern、ignored dirs/files、same-line `secret-scan: allow`、findingにpath/line/pattern nameだけを出して値を出さないredacted output contractは変更していない。binary/生成物や未関係拡張子へ対象を広げない最小修正とした。
  - テスト・検証: `scripts/check-scripts.mjs` に clean SQL pass、synthetic API-key assignment exit 1、SQL same-line allow pass、findingのrelative path/line/`Generic secret assignment`表示、raw synthetic value非露出を固定。`node --check`両script、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check` はPASS。live scanで現行migration `000001` / `000002` / `000003` もclean。独立reviewer 2名の `APPROVED` を受領済み。

- [x] WP-4073 CI PostgreSQL integration fail-open closure(codex 提案 SELF-SCAN-20260710-18、fable5 PLAN_APPROVED、HIGH、本WPで実装)
  - 発見根拠: `.github/workflows/ci.yml` は PostgreSQL service と `TEST_DATABASE_URL` を設定せず、`migration-runner.integration.test.ts` 2件と `postgres-repositories.integration.test.ts` 3件は環境変数不在時に常時 `describe.skip` となる。WP-4071 の uniqueness/legacy rollback を含むDB統合保証がCIで一度も実行されないまま green になり得る。
  - 影響: migration transaction、checksum/history、PostgreSQL制約、tenant/pharmacy境界、repository SQLの回帰が静的テスト・typecheckだけでは検出されず、DB固有の不整合を本番適用時まで持ち越す。
  - 実装: CI `check` job に official `postgres:16@sha256:be01cf82fc7dbba824acf0a82e150b4b360f3ff93c6631d7844af431e841a95c` serviceを追加し、合成専用user/password/database、port 5432、`pg_isready` health gateを設定。`TEST_DATABASE_URL` は Test stepだけへ注入する。production Aurora の target major は別途 SSOT_UPDATE 対象であり、interim CI PostgreSQL 16 から推測・流用しない。
  - fail-closed: test-only shared `resolveTestDatabaseUrl()` を両PostgreSQL integration fileが再利用する。missing/blank URLかつ `CI` exact `true` は値を含まない固定errorをmodule load時にthrowし、local missing/blankは従来どおり明示skip、nonblank URLは原文維持。guardは一箇所のみでSQL/test semantics、migration、package/lock、prod configは変更していない。
  - 検証: localでは resolver focused 3 tests、API全体70 PASS + PostgreSQL integration 5 expected SKIP、API typecheck、workflow YAML parse/pin/Test-step-only env assertion、`actionlint .github/workflows/ci.yml`、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check` がPASSし、docker/`TEST_DATABASE_URL`不在のためDB接続・migration適用なし。commit `b725545` の GitHub Actions run `29052682750` は success。pinned PostgreSQL container初期化後、migration integration 2 PASS、repository integration 3 PASS、resolver 3 PASS、API 8 files / 75 tests PASS・0 skippedを確認し、後続のOpenAPI/secrets/deps/SBOM/boundaries/calculation/SSOT gatesも全てgreen。staging/prod DBへのapplyは行っていない。

- [x] WP-4074 patient search cursor authenticity/privacy hardening(codex 提案 SELF-SCAN-20260710-19、HIGH、完了)
  - 発見根拠: APPROVED API-001 は cursor を不透明・非PHI・tenant/pharmacy/query拘束とするが、`apps/api/src/server.ts` の現行codecは clear tenant/pharmacy、unsalted SHA-256(query)、offset を JSON→base64url 化し、decode時は構造と一致だけを検証する。cursor をdecodeすると low-entropy query候補をoffline辞書照合でき、offsetを書き換えて再encodeしたcursorも200で受理される。既存cross-tenant/pharmacy/query一致checkは有効であり、auth bypassとは主張しない。
  - 影響: cursor がログ・telemetry・ブラウザ履歴等から取得された場合に患者名/番号候補の照合oracleとなり、offset改変で候補を黙ってskipできる。WP-4029は長さ上限、WP-4057はDB pagination/SLOであり、cursorのauthenticity/query privacyは未追跡。
  - 実装: `apps/api` server-only の injected `PatientSearchCursorCodec` を追加。token body は exact canonical `{v,o,m}` だけとし、`m` は domain tag / v1 / trusted tenant / pharmacy / trim済みquery / decimal offset を各4-byte big-endian length prefix付きUTF-8で入力した HMAC-SHA256。outer token と inner MAC の canonical unpadded base64url、strict UTF-8/JSON、exact key順、safe nonnegative offset、constant-time比較、generic invalid resultを強制し、legacy unsigned cursorはdowngrade decodeせず `400 PAT-0001` とした。contract/OpenAPI/DB migration/package/lockは変更していない。
  - key境界: pure config resolverは `YRESE_PATIENT_SEARCH_CURSOR_HMAC_KEY` の exact unpadded base64url 32 bytesだけをconfigured keyとして返す。blank/malformed/noncanonicalは値を含まない固定error、PostgreSQL/production/staging/unknown modeは欠落時startup fail-closed。exact development/test + explicit in-memoryだけ explicit ephemeral decisionを返すが、乱数生成はmain composition rootだけに限定し、`buildServer` はrepository modeを問わず明示注入codecがなければ構築前に同じ固定configuration errorで拒否する。`BuildServerOptions` はraw keyでなくcodecを注入する。v1はsingle active keyでrotation時の旧cursor失効を許容し、TTL + key id/keyring overlapは別SSOT/WPのまま。同一binding/offsetの決定論的token相関可能性とunlinkabilityはAPI-001の現要件外であり、nonceは将来のSSOT/threat-model拡張へ分離する。現v1はquery/query hashをtokenへ格納せず、keyed HMACでqueryを隠す。
  - テスト・検証: hard-coded synthetic v1 golden vector(key `000102...1f`、offset 42)でexact MAC `i5Em-uMH7nIgBLdC-t2wAlF7H0WG8wGuvy2lQREANk8` とouter token bytesを固定し、canonical base64urlだがinvalid UTF-8の `wyg`、goldenと同一decoded bytesを持つouter noncanonical alias末尾 `...gifR` も拒否する。same-key codec/別server間の正常page、different key/query/tenant/pharmacy、length-prefix境界、tokenにquery/queryHash/tenant/pharmacy/unsalted SHA-256候補がないこと、offset/MAC/version/extra-key/key順/whitespace/inner tail bits/outer padding/UTF-8/oversize/legacy、raw JSON `-0`/exponent/string offset、safe-int境界を固定。route forged/legacy 400、全buildServer modeのcodec必須、config mode matrix、raw key非露出を検証。API 86 PASS + PostgreSQL integration 5 expected SKIP、API typecheck/build、OpenAPI drift、boundaries、secrets、diff-checkはPASS。historical provenanceはfable5 `PLAN_APPROVED`とread-only Opus final review `APPROVED`であり、superseded routing下の記録としてのみ保持する。AGT-018でのcurrent completion evidenceはindependent Codex verifierとsecurity/privacy reviewerの`APPROVED`、blockerなし、validation evidence再確認である。

- [x] WP-4075 reception patient identity single-source enforcement(codex 提案 SELF-SCAN-20260710-20、HIGH medical/data-integrity、完了)
  - 発見根拠: APPROVED API-006 の受付登録bodyは単一 `patientId` を持つが、`ReceptionCreateInput` は独立した `patientId` と `patient.patientId` を同時に受ける。in-memory repositoryは前者を保存keyに使いながら後者をresponse snapshotへ返し、PostgreSQL repositoryも前者をINSERT `$4`、後者をname/kana/birthDate/patientNumber/statusへ使う。serverは scoped `findById` の結果IDとrequest IDの一致を検証せず両方を渡す。
  - 再現・影響: requested `patient-requested-001` と snapshot `patient-other-999` をdirect createすると `created` で後者のpatientId/属性を返す。faulty/future PatientRepository・adapterが別患者snapshotを返した場合、保存IDと表示属性が混在し、後続GETでDB-authoritative患者へ表示が変わる wrong-patient risk。WP-4054は同一idempotency keyのpayload/acceptedAt conflictで、本二重identity不変条件は未追跡。
  - 実装: scoped `findById` 後に `patient.patientId === requested patientId` をstrict equalityでfail-closed検証し、不一致時はreception repositoryを呼ばず入力ID/患者属性を含まない固定errorをthrowして500へ収束。`ReceptionCreateInput` から冗長 `patientId` を削除し、in-memoryはbranded factoryで検証した `patient.patientId`、PostgreSQLは同じsnapshot IDだけから永続ID/idempotency比較/responseを導出する。SQL text、contract/OpenAPI、DB migration/schema、package/lockは変更していない。
  - テスト・検証: malicious scoped lookupが別ID snapshotを返すrouteでreception create 0 call、500固定error、request/returned ID・name/kana/patientNumber非露出を固定。PostgreSQL integrationはcreated response IDがlookup snapshot IDと一致するassertを追加し、既存valid/idempotency/tenant-pharmacy/JST semanticsを維持。API 87 PASS + PostgreSQL integration 5 expected SKIP、全workspace typecheck/test/build、OpenAPI drift、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、diff-checkはPASS。historical provenanceはfable5 `PLAN_APPROVED`とread-only Opus final review `APPROVED`であり、superseded routing下の記録としてのみ保持する。AGT-018でのcurrent completion evidenceはindependent Codex verifier、medical safety/data-integrity reviewer、privacy reviewerの`APPROVED`、blocker/HIGH findingなしである。`TEST_DATABASE_URL` 不在のためPostgreSQL assertはlocal expected skip、DB操作なし。

- [x] WP-4076 reception idempotency SSOT-plan contradiction cleanup(codex self-scan、fable5 CHANGES_REQUIRED、ledger-only、a5eb9a8)
  - 発見根拠: WP-4054 は server 採番の `acceptedAt` / 導出業務日付を request fingerprint 対象に含める計画だが、APPROVED API-006 v0.2.0 は同一 `(tenantId, pharmacyId, idempotencyKey)` + 同一 `patientId` の再送を200で既存受付返却と定義しており、計画とSSOTが矛盾する。
  - 必須pin: 同一 key + 同一 `patientId` は200を維持する。fingerprint は将来 API-006 で client field を追加した場合に限り、その client 送信内容だけを対象とし、`acceptedAt` / `receptionId` / 導出 `businessDate` は恒久的に除外する。PHI 生値を hash input / storage / log に含めない。
  - 実装gate: 当時のfable5 plan裁定はhistorical provenanceとして保持する。今後のfingerprint導入はAPI-006のAPPROVED改版、AGT-018のread-only pre-plan reviewer再承認、independent verifier、security/privacy specialistsを必須とし、PHI/請求安全の判断が発生する場合はhuman gateを追加する。
  - 完了: sole deliverable として code / migration / API契約 / OpenAPI / package / lock を変更せず、WP-4054 の無効化と後続清算だけを台帳へ記録して commit `a5eb9a8` をpush。GitHub Actions run `29058471602` / job `86254995220` はsuccessし、typecheck / test / build / OpenAPI / secrets / deps / SBOM / boundaries / calculation purity / SSOTを含む全stepがgreen。DB操作は行っていない。

- [ ] WP-4077 raw audit DynamoDB physical item envelope SSOT pin(owner: Codex sole maintainer、WP-7001 M3b / WP-5004b共通DoR、SSOT-only)
  - 発見根拠: APPROVED DB-005 は監査chainのkey/sequence、event/dedupe/TIP minimum属性までを定めるが、raw eventの完全属性表、各属性のDynamoDB `AttributeValue`型(`S`/`N`/`M`)とnestedのflat/`M`表現、optionalのomit/`NULL`、`entityType` / item schema version、共通timestamp、item別PHI/encryption、golden bytes/map、decoder互換性をpinしていない。実装で補完すると永続契約を推測するため `SSOT_UPDATE_REQUIRED`。
  - 必須pin: low-level physical mapの完全表と、logical fingerprint versionから分離した正の `itemSchemaVersion`、event/dedupe/TIPだけのexact 3 discriminator allow-listを確定する。bigintはcanonical decimal `S`、optionalはomitのみ(`NULL`禁止)、unknown属性は拒否。nestedのflat/`M`、共通timestampのapp-supplied sourceとambiguous retry時の保持/再生成 semanticsを属性単位で固定する。
  - security/compatibility pin: item種別ごとの `phiClassification` / `encryptionStatus`を定義し、生PHIをkey/GSI/logへ置かず、event/dedupe/TIPへTTL/GSIを付けない。synthetic-onlyのfull/min event、dedupe、TIP exact goldenを固定し、version dispatchは未知versionをdistinct fail-closed、implicit v0を禁止。append-only event/dedupeのin-place rewriteを禁止し、TIP schema migrationは別の明示手順とする。
  - M3b DoR: DB-005のAPPROVED改版 + `ssot_index`反映後、Codex root → read-only mapper → read-only pre-plan reviewer → sole maintainer → independent verifierに加え、`security_critic` / `data_integrity_auditor` / `privacy_compliance_reviewer` / DB specialistと必要なhuman infrastructure authorityのreviewを必須とする。旧fable5/opus4.8/Codex実装可能性レビュー要件はhistorical provenanceであり、current gateには再利用しない。最初の実装sliceは `apps/api` server-onlyのpure raw item codecだけとし、M2 key/sequence codecとM3a hydrate/fingerprintを再利用する。AWS SDK、TWI/CAS、network、DynamoDB Local/writeは後続laneへ分離する。

- [x] WP-4078 direct audit intent fingerprint single-snapshot/Proxy TOCTOU hardening(HIGH audit integrity、Codex-native review APPROVED、landing)
  - 発見根拠: `packages/audit/src/intent-fingerprint.ts` の `copyExactRecord` / `assertExactRecordKeys` はdescriptorを検証・copyするが、direct M1 canonicalize pathはcopyを破棄して元のouter / context / intent / `targetRef` / `businessReason`を再dereferenceする。さらに `packages/audit/src/index.ts` はcanonicalize後に元inputを再dereferenceして`createAuditEvent`でdomain validationする。保存済みeventのM3a pathは既にcopy/freeze済みであり変更対象外。
  - 影響: hostile Proxyまたは検証中に変化するmutable inputで、intent/context Aをhashしながらdomain validationはBへすり替わるTOCTOUが成立し得る。persistence write前でも将来のdedupe/idempotency conflict判定の監査完全性を壊すためHIGH。独立explorerのconfidenceはHIGH。
  - historical fable5承認scope: `packages/audit/src/intent-fingerprint.ts`, `packages/audit/src/index.ts`, `packages/audit/src/intent-fingerprint.test.ts`, `Plans.md`, `State.md`のみ。outer exact key → version検証 → v1 deep copy → canonicalize → `createAuditEvent`の順で、単一descriptor-copy/freeze snapshotをschema dispatch/domain validation/hashへ共用する。`wallClock`はsnapshotへcanonical stringとしてexactly once正規化し、`targetRef` / `businessReason`はstored/direct共用nested copy helperを使う。stored behavior/test、public API/signature、v1 canonical JSON/golden bytes、既存label/message/error class、unknown/symbol/non-enumerable/accessor/non-echo規律は不変。internal export `canonicalizeAuditAppendIntentFingerprintInput` はsnapshot-firstのまま維持し、新error classは追加しない。このscope/pinはprovenanceとして保持し、着手前にAGT-018のread-only mapper/pre-plan reviewerがcurrent diffとSSOTへ再照合する。
  - 実装証拠: outer exact descriptor snapshot後にversionを先行検証し、v1だけcontext / intent / `targetRef` / `businessReason`をdeep-copy/freeze、`wallClock`をcanonical stringへ1回だけ正規化。同一snapshotをcanonical JSONと`createAuditEvent` validationへ渡し、hash-A/validate-BのTOCTOUを除去した。stored/direct共用nested copy helperを使い、stored M3a behavior、public API、v1 canonical bytes/golden、error class/messageを維持した。
  - 検証: direct 5層Proxy descriptor exactly-once/property-get zero、getter attacker値無視、invalid descriptor非echo、HostileDate `getTime` / `toISOString`各1回、optional 5項目の明示`undefined`拒否、unsupported v2のdeep-read前拒否を固定。audit 182/182、focused 80/80、audit typecheck/build、workspace typecheck/test/build、OpenAPI/secrets/deps/SBOM/boundaries/calculation-purity/SSOT index/script harness/diff checkをPASS。PostgreSQL 9件は`TEST_DATABASE_URL`不在のexpected skip。
  - review / human gate: AGT-018のmapper・spec guardian、independent verifier、security/data-integrity、medical-safety、privacy reviewは全てAPPROVED。active Goal §10の事前HR権限下で、pure in-memory fail-closed hardeningとして実施し、監査event意味・PHI・storage/log/network/DB/migrationを変更せず、残存risk受容を伴わない。
  - rollback: 本WPのaudit 3ファイルだけをrevertする。migration、data remediation、deployは不要。

- [!] WP-4079 stored audit intent fingerprint version-before-deep-read hardening(HIGH audit integrity、BLOCKED_HUMAN_SCOPE_APPROVAL)
  - 発見根拠: `computeAuditEventIntentFingerprint` はstored outerのschema versionをdispatchする前に`context` / `event`をdeep-copyするため、unsupported v2でもhostile stored Proxy trapを先に実行し得る。JSON persistence上の実運用exploitabilityはadapter境界次第だが、versioned trust boundaryとして非対称である。
  - Blocker / Unlock Condition: WP-4078のstored M3a不変scopeと分離する。human authorityがR3 scopeを明示承認後、outer descriptor snapshot→version検証→v1だけdeep copyを実装し、v2 hostile context/event deep-read zero、stored v1 golden/error/public API不変をindependent/security/data/medical/privacy reviewで証明する。

- [ ] WP-7001 Phase 1 DynamoDB persistence foundation + first aggregate synthetic proof(HIGH、M1完了・AGT-018再planまで後続HOLD)
  - 目的: APPROVED 済み DB-005 §11 step 2 に従い、DynamoDB 永続化アダプタ基盤と最初の集約スライスを synthetic-only(PHI禁止)で実証する。
  - 歴史的に承認済みの技術計画: persistence adapter は `apps/api` server-only に置き、AWS SDK import を adapter 層へ限定する。最初の集約は、FHIR REST/CapabilityStatement を推測実装せず、DB-005 §6.1/§10 と `@yrese/audit` core が確定済みの synthetic-only `AuditAppendStore` とする。DynamoDB Local harness は CI では接続必須、local では明示 skip 可とし、IAM/STS/KMS/PITR/throughput の証明には使わない。これはtechnical provenanceであり、後続着手のcurrent approvalではない。
  - 確定済みtechnical pin: A=`SEQ#` は zero-pad width 20、uint64 `[1, 18446744073709551615]`、overflow は書込前拒否。B=app-local `AuditPersistenceVerification` が連番・dedupe pointer/hash・TIP整合を検証し、hash continuity は `@yrese/audit` へ委譲。C=同一 eventId + 同一 logical intent は既存 event、異なる intent は hard conflict。trusted `AuditWriteContext` からのみ authority を再構成し、event/dedupe/TIP は同一 tenant-scoped PK・別SK、stable eventId は retry loop 外で一度だけ生成する。
  - 準拠範囲: DB-005 §§3-6/10-12 のキー設計、ConditionExpression/楽観ロック、監査 dedupe ガード + tip 採番 sequence、TTL/物理削除禁止、per-request tenant scope、PHI のキー/GSI/ログ非露出、AWS import の adapter 層限定、PostgreSQL 正本の段階移行を計画へ列挙する。
  - M1完了: `@yrese/audit` に trusted context + `AuditAppendIntent` 全フィールド(`retryCount`含む)だけを対象とする strict v1 canonicalizer と SHA-256 fingerprint を実装。`fingerprintSchemaVersion=1` は hash 入力に含めず dispatch metadata として別返却し、未知versionは専用errorで拒否する。exact outer/context/intent/nested key、domain validation再利用、undefined/null/array/cycle/非対応値、authority/chain field混入、PHIを fail-closed に固定。全optional fieldを含む synthetic-only golden hashは `2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745`。既存 audit canonical JSON/entryHash bytesは不変。independent Codex verifier/security reviewerの`APPROVED`をcurrent M1 completion evidenceとし、旧追加reviewはhistorical provenanceとしてのみ保持する。
  - M1検証: audit 105/105 (intent fingerprint 59 + legacy audit 46)、全workspace typecheck/test、audit build、boundaries、secrets、deps、SBOM、script harness、full build、diff-checkがPASS。local PostgreSQL integration 5件は `TEST_DATABASE_URL` 不在でexpected skip、DB操作なし。AWS SDK/package/lock、DynamoDB Local harness、adapter/persistence writeは未変更。後続workはCodex rootがDB-005 pinのAPPROVED反映を確認し、read-only pre-plan reviewer、independent verifier、DB/security/privacy specialists、必要なhuman infrastructure gateをcurrent WPへ定義するまでHOLDする。
  - M2完了: historical fable5 `PLAN_APPROVED` の単一sliceとして、`apps/api` server-only に pure audit persistence key/sequence codecを追加。trusted `AuditWriteContext` の tenant/pharmacyだけから exact chain PKを構築し、event/dedupe/TIPの同一PK・相異SK、uint64 `[1, 18446744073709551615]` のunpadded decimal attribute / 20桁 sort segment、strict event SK parse + byte round-tripを固定した。全補間IDの `#` / blank / control / runtime type、非ASCII・非canonical decimal、20桁overflowを入力値非echoの固定errorで拒否する。
  - M2検証・境界: focused codec 74/74、API 161 PASS + PostgreSQL integration 5 expected SKIP、audit 105/105、全workspace typecheck/test、API/full build、OpenAPI、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、frozen lock、diff-checkをPASSさせた。独立 verifier 10/10 とread-only Opus最終reviewの承認はcompleted-historyのprovenanceとして保持する。blocker/HIGH findingなし。追加依存は `@yrese/audit` workspace linkだけ。AWS SDK/table/network/write、DynamoDB Local、PostgreSQL操作、migration、genesis/state判断、raw item hydrate、TWI/CAS/retry/verifyは変更せず、M3以降はAGT-018のcurrent re-plan完了までHOLDする。
  - M3a完了: WP-2009と統合し、保存済み`AuditEvent`のstrict hydrate/hash照合と保存event→M1 logical intent fingerprint再計算を `@yrese/audit` pure coreへ追加。authority/chain位置を保存値から再信頼せず、context一致・hash真正性・versioned fingerprintを永続adapter着手前にfail-closed固定した。検証はWP-2009記載の全gateをPASSし、独立 verifier 10/10 / read-only Opus承認はcompleted-historyのprovenanceとして保持する。raw item/AWS/DB persistence laneは物理属性SSOTをpinするまで `SSOT_UPDATE_REQUIRED`、かつ後続M3b以降はAGT-018のcurrent re-plan完了までHOLDする。

- [x] WP-6001 DynamoDB single-table + FHIR store design proposal(d5d06e0、fable5/opus4.8 REVIEW_RESULT: CHANGES_REQUIRED but formalize by fable5)
  - 内容: `docs/research/dynamodb_fhir_store_design_proposal.md` を DRAFT(codex 設計提案・fable5 レビュー用・SSOT ではない)として追加。ARC-008 に基づく DynamoDB single-table / FHIR store / append-only audit / adapter 境界 / PostgreSQL 段階移行の素材を提示。
  - レビュー結果: 設計骨格は健全と評価。DynamoDB transaction 同一 item 制約、監査 append 冪等性、HMAC prefix 検索不可、Provenance 投影化、per-request STS tenant scope 等の必須修正は fable5 が DB/FHIR store SSOT formalize 時に織り込む。proposal は入力記録として残置。
  - 検証: `pnpm check:secrets`、`pnpm check:boundaries`、`git diff --cached --check`。

- [x] WP-6002 pure core AWS/DynamoDB import boundary guard(c18d50d)
  - 発見根拠: ARC-008 §6 と WP-6001 proposal §8 は、純粋コア(`packages/calculation`, `money`, `date-time`, `trace`, `audit`, `shared-kernel`, `events`, `contracts`)を persistence-agnostic に保ち、AWS/DynamoDB 結合を adapter 層へ限定する。
  - 実装: `scripts/check-boundaries.mjs` に純粋コア package からの `aws-sdk` / `@aws-sdk/*` / DynamoDB module import 拒否を追加し、`scripts/check-scripts.mjs` に違反検出と app 層 AWS import 許容の fixture を追加。
  - 検証: `pnpm test:scripts`、`pnpm check:boundaries`、`pnpm check:secrets`、`git diff --check`。

- [x] WP-6003 pure core AWS boundary non-static import regression coverage(codex 自律スキャン、WP-6002追補)
  - 発見根拠: WP-6002 の checker 本体は `require()` / dynamic `import()` / `export ... from` も抽出するが、回帰 fixture は static import 中心だった。将来の extractor 変更で CJS/dynamic/re-export 経路だけ抜けると、純粋コアの AWS/DynamoDB 混入を見逃す。
  - 実装: `scripts/check-scripts.mjs` に pure core `trace` fixture を追加し、`require('aws-sdk')`、`import('@aws-sdk/client-dynamodb')`、`export * from 'dynamodb-toolbox'` が `check-boundaries` で拒否されることを固定。
  - 検証: `pnpm test:scripts`、`pnpm check:boundaries`、`pnpm check:secrets`、`git diff --check`。

- [x] WP-4012 dependency scan / SBOM CI gate(b0ecf84、addendum 702c2f5)
  - 発見根拠: `.github/workflows/ci.yml` には dependency scan / SBOM 追加TODOが残り、`package.json` にも依存脆弱性・SBOM生成を検査するroot scriptが未定義。
  - 目的: secret scan に加えて、依存脆弱性検知とSBOM生成/検証をCIの機械ゲートにし、security SSOTの「dependency scan / SBOM」予定項目を実装へ進める。
  - 想定スコープ: `package.json`, `.github/workflows/ci.yml`, 必要なら `scripts/**`。
  - 検証: 追加する依存scan/SBOMコマンド、`pnpm install --frozen-lockfile`, `pnpm check:secrets`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4013 boundary duplicate registry scan expansion(b210984)
  - 発見根拠: `docs/modules/dependency_direction_policy.md` は `PERMISSION_RESOURCES` / `ERROR_DOMAINS` などの検査対象追加を想定しているが、`scripts/check-boundaries.mjs` の重複const検査は現状 `SYSTEM_MODES` / `PROVISIONAL_STATUSES` / `BLOCKER_TYPES` の3種だけ。
  - 目的: shared-kernelの権限・エラー系レジストリ(`PERMISSION_ACTIONS`, `PERMISSION_RESOURCES`, `ROLE_NAMES`, `ERROR_SEVERITIES`, `ERROR_DOMAINS`, `KERNEL_ERROR_CODES` など)もローカル再定義検出対象に広げ、COMMON_MODULE_DUPLICATION_BLOCKEDを機械的に強化する。
  - 想定スコープ: `scripts/check-boundaries.mjs`, 必要なら `scripts/**` のfixture test、`Plans.md`。
  - 検証: `pnpm check:boundaries`, 意図的な一時fixtureで追加const名の重複検出確認、`git diff --check`。

- [x] WP-4014 API-001 patient search contract readiness follow-up(bb3d237、WP-2008で解消)
  - 発見根拠: `docs/api/patient_search_contract.md` は患者検索APIをPROPOSED化したが、現状の `@yrese/contracts` はhealthのみで、eligibility statusの値集合は `apps/web` 側 `PatientHeader` が先に持っている。また、query validationは `q` 不正だけが明記され、`limit` / `cursor` 不正、tenant/pharmacy境界、PHIレスポンスのcache/logging制約が実装前に曖昧になりうる。
  - 目的: API-001承認後、患者検索のquery/response/error zod schemaを `@yrese/contracts` に置き、backend repository interfaceがtenantId/pharmacyIdを必ず受ける形にし、cursorを非PHI・tenant/pharmacy/query境界内で扱う契約を固定する。
  - 解消根拠: API-001 v0.2.0 APPROVED 後、WP-2008 で contracts schema / PAT-0001 / repository tenant-pharmacy boundary / no-store を実装。
  - 想定スコープ: `docs/api/patient_search_contract.md`(契約修正が承認された場合のみ), `packages/contracts/**`, `apps/api/**`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`, `pnpm check:secrets`。

- [x] WP-4015 error_code_registry SSOT/code drift cleanup(5edb140)
  - 発見根拠: `packages/shared-kernel/src/error-codes.ts` は `KERNEL_ERROR_CODES` に `AUTH-0003` と `PAT-0001` をseed済みだが、`docs/modules/error_code_registry.md` はまだ `AUTH-0003` を「ErrorCodeRegistry 未登録」と記載し、API-001で実装済みの `PAT-0001` 行もない。
  - 目的: error_code_registry SSOTを実装済みseedと同期し、以後のAPI実装が古い台帳を根拠に誤ったCODEX_PLANを出さないようにする。
  - 想定スコープ: `docs/modules/error_code_registry.md`, 必要なら `docs/modules/common_module_inventory.md` / `State.md` の状態記述のみ。
  - 検証: `rg -n "AUTH-0003|PAT-0001|未登録|要整備" docs/modules/error_code_registry.md packages/shared-kernel/src/error-codes.ts`, `git diff --check`。

- [x] WP-1012 shared-kernel isClaimable fail-closed conversion(41d5113)
  - 発見根拠: opus4.8 レビューで deny-list 方式の `isClaimable()` が未知ステータスを請求可として扱う fail-open を検出。
  - 目的: `CLAIMABLE_SAFE_STATUSES` allow-list 方式へ転換し、未知ステータス・未承認ステータスは請求不可にする。
  - 解消根拠: `packages/shared-kernel/src/status.ts` / `kernel.test.ts` で実装・回帰テスト固定。全112 tests + boundaries verified。

## v0.2.0 レセコンベンチマーク反映(ユーザー提供調査 2026-07-09)

ユーザー提供の主要レセコン調査(MEDIXS / EMシステムズ MAPs・Recepty NEXT / PHC Pharnes / Pharmy Connect / P-CUBE n / GENNAI just / 調剤くんV8)に基づく計画拡張。
方針決定(fable5): ①各社実装の模倣ではなく公式仕様準拠の**根拠追跡型・決定論的ルールエンジン**として設計する ②**LLM/AIに算定判断をさせない**(補助・候補提示・説明生成のみ可) ③ベンダー公開情報は Priority C(要件抽出の補助のみ、実装根拠禁止) ④MVPは「正確な算定・請求」に加えて入力速度・請求前点検・連携口・オフライン・二重UXまでを競争力条件とする。

### ベンチマーク・スコープSSOT

- [ ] WP-0018 レセコン機能ベンチマークSSOT: docs/product/rececon_feature_benchmark.md(ベンダー別特徴・出典URL付き・Priority C明記)+ docs/product/major_rececon_feature_matrix.md(14分類×ベンダー×MVP反映方針)。ユーザー提供調査を一次入力とし、source_registry へベンダーURL(Priority C)とSSK電子レセプト作成手引きページ(Priority A)を追記
- [ ] WP-0019 mvp_scope(PRD-001)改版: ベンチマーク由来の必須機能を反映 — 前回Do入力 / OCR受け口 / 電子薬歴連携API(薬歴未記載チェック=薬学管理料整合の請求前点検) / 処方監査システム双方向API / 在庫連携口+現在庫表示 / 請求前点検の拡充(入力漏れ・算定根拠・薬歴未記載・資格確認・公費・レセプト形式) / 二重UX(初心者ガイド+熟練者ショートカット) / リモート診断。後続フェーズ表(AI薬歴・服薬フォロー・本部入力・在庫高度化・経営分析・オンライン服薬指導・多店舗薬歴共有)も正式化。AGT-018のmapper/pre-plan/sole-maintainer/independent-verifierに加え、medical safety、privacy、claim、accessibility specialistsがreviewし、人間薬剤師、請求実務者、法務、product authorityがscope・法令・請求安全を最終確認する。

### 算定エンジンSSOT(CAL-004 の後継拡張群)

- [x] WP-0020 calculation_engine_architecture.md SSOT作成・APPROVED済み(CAL-005 v0.2.0、commit `c6867e3`)。9段パイプラインの全runtime実装完了は未主張で、本文のimplementation-state driftは別semantic revision対象。
- [x] WP-0021 calculation_rule_dsl.md SSOT作成・APPROVED済み(CAL-006 v0.2.0、commit `c6867e3`)。full DSL/rule-evaluator完成は未主張で、effectiveTo等の本文driftは別semantic revision対象。
- [x] WP-0022 claimability_status_policy.md SSOT作成・APPROVED済み(CAL-007 v0.2.0、commit `c6867e3`)。historical草案の`BLOCKED_MISSING_EVIDENCE`追加案は採用せず、APPROVED本文の既存`BLOCKER_TYPES`再利用方針が正本。WP-2105/status・記録フロー実装は未完了。
- [x] WP-0023 calculation_trace_schema.md SSOT作成・APPROVED済み(CAL-008 v0.2.0、commit `c6867e3`、metadata landing `72474ba`)。optional trace拡張はWP-4031で部分実装済みだが、typed value境界・全producer移行・rounding evidence・live APIは未完了。
- [ ] WP-0024 fee_item_registry.md: 算定項目台帳(候補抽出対象の全項目体系: 調剤基本料〜調剤ベースアップ評価料。CAL-001/CAL-003 と行対応)
- [ ] WP-0025 drug_fee_policy.md: 薬剤料計算(15円以下1点・10円ごと1点の evidence 化 — EVD-CAL 済み分参照、材料料=価格/10円)+ 計算単位(剤・調剤単位)定義。丸め根拠 evidence_id 必須
- [ ] WP-0026 prescription_grouping_policy.md: 「剤」判定(内服/内滴/屯服/外用、用法・服用時点・剤形・同一有効成分・日数合算)— PrescriptionGroupResolver の仕様。留意事項通知(P-06)精読が前提の行は BLOCKED 明記
- [ ] WP-0027 facility_basis_policy.md: 施設基準スナップショット(FacilityBasisSnapshot を請求月単位で固定)・届出情報管理
- [ ] WP-0028 selected_medical_care_policy.md: 長期収載品選定療養の別建て計算(保険請求分/患者一部負担/選定療養額/消費税/帳票表示/レセプト影響/患者説明履歴の分離)
- [ ] WP-0029 offline_calculation_policy.md: LOCAL_ONLY 時の仮算定境界(PROVISIONAL_CALCULATION 系、外部確認必要項目の成功扱い禁止)— ARC-001/ARC-002 との整合
- [ ] WP-0030 calculation_golden_test_plan.md: golden test 体系(evidence 連動・剤パターン・公費組合せ・境界日・逓減)

### 請求・UXSSOT

- [ ] WP-0031 receipt_intermediate_model.md + pre_claim_check_policy.md(docs/claim/): レセプト中間モデル(CLM-002 記録仕様ノート準拠)+ 請求前点検ポリシー(薬歴未記載チェック含む — 電子薬歴連携APIとの責務分界)
- [ ] WP-0032 rececon_workflow_benchmark.md + fast_input_interaction_policy.md(docs/uiux/): 入力速度ベンチマーク(1画面設計・ファンクションキー/ショートカット・1way入力・処方入力時の現在庫+患者情報+警告同一画面表示)+ 二重UX(ガイド付き/高速入力)設計。UIX-001〜007 との整合

### 実装WP(SSOT承認後に発行)

- [ ] WP-2103 PrescriptionGroupResolver 骨格(packages/calculation/grouping — WP-0026 承認後)
- [ ] WP-2104 薬剤料計算モジュール(drug-fee — WP-0025 承認後。使用薬剤料 evidence は EVD-CAL 採番済み分から)
- [ ] WP-2105 候補抽出/確定分離ステータスの shared-kernel 追加(WP-0022 承認後)
- [ ] WP-2106 選定療養計算モジュール(WP-0028 承認後・選定療養 evidence 発行後)
- [ ] WP-2107 電子薬歴/監査/在庫連携APIの契約設計(Pharmacy Integration API v0 — API-001 パターン踏襲)

### 実行順序(2026-07-09判断の内容をAGT-018 routingで継続)

1. WP-0018(ベンチマークSSOT・フォーク)+ WP-0020〜0023(エンジン中核SSOT・フォーク)を並列
2. WP-0019(mvp_scope改版)は0018完了後、Codex rootがmapper evidenceを基にWPを発行し、pre-plan review → sole maintainer起案 → independent/domain review → 人間薬剤師・請求実務・法務・product reviewの順で進める
3. WP-0024〜0030 を第2波フォーク、WP-0031/0032 を第3波
4. 実装WP(2103〜)は各SSOT承認+evidence充足を確認して逐次発行

## v0.2.0 統合ベースライン計画(2026-07-09 受理)

0.2.0正本へ集約した会計・領収証・Integration Hub・JAHIS・開かれたレセコン・算定エンジン深化の実行計画。既存承認済みSSOT・実装は維持し、0.2.0正本を根拠に不足範囲を追加する。
ディレクトリは既存規約 docs/<domain>/ を維持し、構築プロンプト上の表記差分は本規約へ読み替える(PRC-007 に既録)。

### 充足状況マッピング

- ベンチマーク: **一部充足**(PRD-004/005 済み)→ 不足分: ORCA会計思想・POS/セルフレジ製品・API公開性/標準規格対応の観点追加 + derivative_feature_inventory + mvp_feature_prioritization
- 算定エンジン深化: **一部充足**(CAL-005〜008のstatusは各frontmatter/indexで確認し、未完了改版はAGT-018のindependent/domain review対象。WP-0024〜0030計画済み)→ 不足分: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy(fee_item_registry・drug_fee 等は既計画)
- 会計・収納・領収証・日計・POS・施設請求: **全面新規**(Calculation/Claim/Accounting/Receipt/POS の5領域分離、append-only ledger、一部入金MVP必須)
- Integration Hub モジュール化: **新規**(API-001/contracts の実績を基盤に拡張)
- JAHISフル対応: **新規**(Applicability Matrix 方式。全標準の無差別実装ではない)
- 開かれたレセコン: **一部充足**(OPS-011 portability / MOD 公開SSOT)→ 不足分: sandbox・SDK・開発者ポータル方針

### v0.2.0 統合停止条件(即時有効)

- 会計SSOT(17文書)未承認のまま会計・未収・領収証・入金APIを実装しない
- JAHIS Applicability Matrix / full support definition / conformance test 未整備で「JAHIS対応」を名乗らない(BLOCKED_JAHIS_CONFORMANCE_REVIEW)
- 未入金額を領収済み表示する設計を禁止 / LOCAL_ONLY会計の同期・重複防止未設計での実装禁止
- 外部ベンダー直接DBアクセス禁止 / undocumented API 本番利用禁止

### 新規SSOT WP

- [x] WP-0033 会計SSOT 11文書(docs/accounting/: domain_model / patient_receivable / payment_allocation / partial_payment / refund_adjustment / ar_status_registry / daily_cash_closing / payment_method_registry / pos_integration / facility_billing / accounting_audit_log)— append-only ledger・状態機械(PatientReceivable 10状態 / Payment 10状態)・一部入金・割当順序(4780ded、status PROPOSED・opus4.8レビュー待ち)
- [x] WP-0034 領収証SSOT 6文書(docs/receipt/: issuance / numbering / reissue_cancel / statement_issuance / template_registry / privacy)— 領収証=入金事実対応・明細書=算定基礎項目の分離、再発行表示・交付履歴・0円時明細書【要確認】(06c8a35、status PROPOSED)
- [x] WP-0035 JAHIS SSOT 8文書(docs/jahis/: applicability_matrix / full_support_definition / adapter_inventory / version_watchlist / conformance_test_plan / character_encoding_policy / code_mapping_policy / roundtrip_test_policy)(5d73a20、status PROPOSED)
- [ ] WP-0036 Integration Hub SSOT 11文書(docs/integration/: hub_architecture / partner_registry / data_sharing_module_inventory / data_sharing_policy / api_scope_registry / webhook_event_catalog / idempotency_policy / partner_sandbox / contract_test_policy / data_portability / adapter_registry)
- [ ] WP-0037 派生機能調査+ベンチマーク拡張(docs/product/: derivative_feature_inventory / mvp_feature_prioritization + PRD-004/005 への ORCA・POS・API公開性観点追記)
- [ ] WP-0038 mvp_scope(PRD-001)0.2.0統合改版: WP-0019 を統合し、一部入金・会計台帳・領収証発行・日計をMVP必須へ、POS/セルフレジ/施設請求は境界設計のみ等を確定。AGT-018のmapper/pre-plan/sole-maintainer/independent-verifierと、medical safety、privacy、claim、accounting/data-integrity specialistsがreviewし、人間薬剤師、請求実務者、法務、product authorityがMVP範囲と残riskを最終確認する。
- [ ] WP-0039 算定エンジン深化 残SSOT(docs/calculation/: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy)— WP-0024〜0030 と統合実行

### 新規実装WP(SSOT承認後に発行、0.2.0実装レーン準拠)

- [!] WP-2201 会計台帳バックエンド(Codex sole maintainer — WP-0033 APPROVED まで BLOCKED)
- [!] WP-2202 領収証ドキュメントバックエンド(Codex sole maintainer — WP-0034 APPROVED まで BLOCKED)
- [!] WP-2203 Integration Hub 骨格(Codex sole maintainer — WP-0036 APPROVED まで BLOCKED)
- [!] WP-2204 JAHIS 2Dシンボル Adapter(Codex sole maintainer — WP-0035 承認 + JAHIS仕様本文入手(Ver.1.11、入手経路【要確認: 人間手続きの可能性】)まで BLOCKED)
- [!] WP-3101 会計・未収・一部入金・領収証画面(Codex sole maintainer — WP-0033/0034 + API契約承認まで BLOCKED)
- [ ] 共通モジュール追加(shared-kernel: accounting/payment/receipt status enum — WP-0033/0034 承認後、MOD-005 改版経由)

### 実行順序

1. フォーク第1波: WP-0033(会計)+ WP-0034(領収証)+ WP-0035(JAHIS)並列
2. フォーク第2波: WP-0036(Integration)+ WP-0037(派生機能)+ WP-0039(算定残)
3. WP-0038 mvp_scope改版は第1波完了後、Codex rootがmapper/pre-plan review済みWPとしてsole maintainerへ発行し、independent/domain reviewと必要な人間reviewへ進める
4. 進行中作業はAGT-018へre-routeし、owner/reviewer/human gateをcurrent WPへ明記してから継続する。旧lane/model名をcurrent assignmentに使用しない

## v0.2.0 yrese ベースライン受理(ユーザー提供 2026-07-09)

ユーザー提供の「調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0」を受理し、正本として `docs/spec/construction_prompt_v0.2.0.md` に保存した。
`docs/spec/construction_prompt_baseline.md` は0.2.0正本への入口に縮約し、過去版本文・版一覧・版間優先順位規定は削除済み。

v0.2.0の最上位方針:

- プロダクト名を **yrese** とする。
- 一文定義: NSIPSを境界に追放し、イベントログを心臓に据え、品質を公開数字で証明し、APIで生態系を作る、止まらないレセコン。
- 戦う対象は NSIPS支配、低品質シェア、不安定な24時間稼働、弱い連携基盤の4つ。
- NSIPSはAnti-Corruption Layer / Legacy Adapterへ隔離し、FHIRネイティブCanonical Coreを中心に据える。
- 算定エンジンは versioned rule data + effective-dated master data + deterministic pure functions + calculation trace + golden tests + receipt validation + event-sourced facts + projections とする。
- 夜間バッチ停止を廃止し、イベントログとprojectionを中核にして24/365稼働品質を目指す。
- yrese UIも公開APIをdogfoodingし、PH-OSを最初のリファレンス接続クライアントにする。

### v0.2.0 新停止条件(即時有効)

- NSIPSの概念がCanonical Modelへ浸食している場合は停止。
- NSIPSファイル連携をコアロジックとして扱う場合は停止。
- NSIPS許諾未確認のまま互換実装を進める場合は停止。
- FHIRネイティブ方針とOfficial Adapter境界が未定義の場合は停止。
- 公式仕様をFHIR内部モデルで勝手に置き換える場合は停止。
- 算定ルールをversioned rule dataではなくコード直書きする場合は停止。
- calculation golden testの根拠が未定義の場合は停止。
- イベント再投影で確定済み請求を人間承認なしに変更する場合は停止。
- 夜間バッチのためにシステム停止を前提とする場合は停止。
- Cloud Core停止時のLOCAL_ONLY業務継続が未定義の場合は停止。
- yrese UIが公開APIをdogfoodingしていない場合は停止。
- PH-OS連携が専用裏口APIに依存する場合は停止。
- 公開KPIにPHI、薬局秘密情報、契約上非公開情報が含まれる場合は停止。
- OSS SDKに許諾上公開できない仕様情報が含まれる場合は停止。
- 監査ログの改ざん検知方針がない場合は停止。
- tenant isolationがアプリケーション層だけに依存している場合は停止。

### v0.2.0 新規SSOT WP

- [x] WP-0040 v0.2.0構築プロンプト保存: `docs/spec/construction_prompt_v0.2.0.md` を追加。
- [x] WP-0049 構築プロンプト版統一: `docs/spec/construction_prompt_baseline.md` を0.2.0正本入口へ縮約し、旧版本文・旧版優先順位・旧版見出しを削除。`docs/spec/construction_prompt_v0.2.0.md` に統合方針を集約。
- [x] WP-0041 yrese doctrine SSOT pack(6cd714e): PRD-008 製品ドクトリン / PRD-009 4つの戦い / ARC-003 NSIPS境界隔離ACL / ARC-004 Legacy Adapter S3/Lambda候補構成。全て PROPOSED(承認は PRC-007 フロー)。
- [x] WP-0042 FHIR canonical SSOT pack(4482e1e): DOM-005 canonical model ≠ FHIR 方針 / DOM-006 マッピング台帳枠組み(MAP-FHIR-####、APPROVED エントリのみ実装可)。Official Adapter の FHIR 置換は BLOCKED_OFFICIAL_ADAPTER_BOUNDARY。PROPOSED(PRD-007 と合わせて承認)。
- [x] WP-0048 JP Core/FHIR Ready 薬局データ連携基盤戦略: `docs/product/jp_core_fhir_platform_strategy.md` を追加し、電子処方箋対応とJP Core/FHIR準拠を分離。公式ソース台帳 `SRC-FHIR-001..006` を `docs/regulatory/source_registry.md` に追加。WP-0042/WP-0046の上流方針とする。
- [x] WP-0043 Quality transparency SSOT pack(cc47d59): QUA-007 証明可能性戦略 / QUA-008 公開KPI一般方針(匿名化・同意・悪用リスク5類型)/ QUA-009 返戻率KPI定義(fail-closed 集計)。外部公開の実施は BLOCKED_LEGAL_REVIEW 解除まで BLOCKED。PROPOSED。
- [x] WP-0051 ssot_index 整合性修復: 索引未登録の約50文書(accounting/calculation/domain/jahis/receipt/api/spec ほか)を検出し、frontmatter からの機械再生成で全148文書を索引化(IDX-001 v0.3.0)。索引は以後手編集しない。恒久ゲートは WP-4020。
- [x] WP-0044 Calculation event-sourcing SSOT pack: CAL-009 versioned rule data / CAL-010 純粋関数規律 / CAL-011 golden test 根拠規律 / ARC-005 ES適用境界(既定は非適用)/ ARC-006 再投影・再算定境界 / ARC-007 確定請求 immutability(append-only、訂正は返戻再請求レーン)。全て PROPOSED。
- [x] WP-0045 Always-on architecture SSOT pack: ARC-010 24/365アーキテクチャ(Cloud Core / Edge Node、SystemMode対応、zero planned downtime)/ ARC-011 夜間バッチ廃止(月次締めは NORMAL のみの明示業務操作)。SLA/SLO 数値は OPS-009 へ委譲。PROPOSED。
- [x] WP-0046 API-first platform SSOT pack(docs/api/): API-002 dogfooding 原則(抜け道 API 禁止)/ API-003 公開 API 共通土台(deny-by-default・バージョニング3段階廃止手順、PRD-007 前方参照解消)/ API-004 PH-OS リファレンス連携(特別扱い禁止)/ API-005 OSS 公開 allow-list(PHI/NSIPS/ONS/JAHIS 本文公開禁止、実公開は BLOCKED_LEGAL_REVIEW)。PROPOSED。
- [x] WP-0047 Audit/WORM tenant isolation SSOT(docs/security/): SEC-008 — 論理層規律(append-only・SEC-007 ハッシュチェーン正本・偽ハッシュ供給禁止)と物理層候補構成(S3 Object Lock/KMS/RLS は追加防御、確定は BLOCKED_SECURITY_REVIEW 解除後)を分離。break-glass は監査必須・fail-closed。PROPOSED。

### v0.2.0 既存WPへの影響

- WP-0036 Integration Hub SSOTは、0.2.0正本のOpen Rececon Platform、Partner Sandbox、Contract Test Kit、API-first dogfooding、PH-OSリファレンス連携を統合する。
- WP-0039 算定エンジン深化は、v0.2.0のversioned rule data / pure function / event re-projection / finalized claim immutabilityを追加前提にする。
- WP-2203 Integration Hub骨格、WP-2204 JAHIS Adapter、会計/領収証系実装は、上記SSOTがAPPROVEDになるまで該当範囲を拡張実装しない。
- WP-2009 audit hash-chain canonicalization / hydrate split は、APPROVED済みSEC-007/008・MOD-008とDB-005の下でWP-7001 M3aに統合して完了。永続adapter/AWS/DB配線はWP-5004/WP-7001後続laneに残す。

### 実行順序(v0.2.0)

1. WP-0041 / WP-0042 / WP-0043 を第1波として起案し、Open Rececon/FHIR/品質公開のプロダクト・境界方針を固める。WP-0042はWP-0048(PRD-007)の「電子処方箋対応 ≠ JP Core/FHIR準拠」「JP Core/FHIR Readyな薬局データ連携基盤」方針を前提にする。
2. WP-0044 / WP-0045 を第2波として、算定・イベント・24/365アーキテクチャの高リスク設計を固める。
3. WP-0046 / WP-0047 を第3波として、API-first platformと監査・テナント分離の実装前ゲートを固める。
4. 実装WPは、該当SSOTがAPPROVEDになり、AGT-018のmapper/pre-plan review、required independent/domain review、該当する人間薬剤師・請求実務・法務・security/product authorityのreviewが完了してからCodex rootが発行する。

## v0.5 FHIR / JP Core Native 相互運用計画(ユーザー提供 Draft 2026-07-15、受理 2026-07-16)

- [~] WP-0053 v0.5 FHIR / JP Core Native program(IN_PROGRESS、R4 architecture/data/security/medical)
  - scope: yrese / PH-OS のClinical CoreをFHIR Resource正本とし、FHIR Clinical Data Plane / Technical Control Plane / Legacy・Official Adapter Planeへ分離する。yreseは処方・調剤、PH-OSは訪問・服薬実態のauthoritative serverとし、同一Resourceのmulti-master更新を禁止する。日本固有の算定・会計・請求Domainは非FHIR正本を維持し、FHIR Referenceで接続する。
  - root_cause/evidence: APPROVED ARC-008は臨床FHIR格納正本を既に上位決定している一方、PRD-007/DOM-005本文、API-001/006、現行PostgreSQL Patient/Reception、API-008の一部は旧facade/独自clinical API前提を残す。v0.5はこの移行を3プレーン、ownership、IG/terminology/conformance、open ecosystemまで拡張するため、Plansだけで既存APPROVED SSOTを上書きせずPRC-007改版が必要。
  - verified_baseline: 2026-07-16公式履歴でJP Core current release=`1.2.0`(2025-07-30)、base FHIR=`R4 4.0.1`、latest development=`1.3.0-dev`。Phase 0開始時に再確認し、開発版をproduction baselineにしない。FHIR R4 Subscriptionはmaturity level 3 / Trial Useのため、通知を正本にせずhistory/delta recoveryを必須化する。
  - systemic_impact: clinical persistence/API/auth/tenant/terminology/audit/history/UI dogfooding/PH-OS sync/adapter/CI/partner contractを横断する。既存Patient/Receptionを即時撤去・二重writeせず、resource単位のsingle-authority cutoverを必須とする。
  - dependencies: ARC-008、PRC-007、PRD-007、DOM-005/006、API-002/003/004/008、DB-001..005、SEC-006/007/008、MOD-009/013、WP-0035/0036、WP-5004/7001。
  - acceptance: WP-0053a〜jのSSOTがAPPROVED、実装WPのDoR/stop condition/rollbackが確定、clinical/control/adapterの境界と全Resource ownerが一意、現行独自clinical APIの移行期限とconsumerが列挙、FHIR/JP Core package lock・validator・IG QA・CapabilityStatement consistency gateが定義されるまでimplementationを開始しない。
  - owner: Codex root(sole editor/landing owner)。mapper/planner/verifier/domain reviewerはread-only、同時editorは1名。
  - verification: `pnpm check:ssot-index`、SSOT 23-field/PRC-007 review、source/version fingerprint、dependency DAG、全resource/API/DB/consumer inventory、security/privacy/medical/data-integrity review。
  - demo_coverage: Phase 0はsynthetic conformance fixturesのみ。production data、real patient、external sendなし。Phase 1以降はPartner Sandboxとsynthetic test patientでFHIR REST/history/transaction/deny/cross-tenantを実証する。
  - rollback: Phase 0は文書revertのみ。実装以降はresource単位のexpand/verify/cutoverで旧authoritative pathを維持し、切替前は新storeを非正本、切替後rollback条件はWP-0053jで明文化する。
  - commit_push: 本変更はtask分割だけを独立docs commitとしてlandingする。各childは独立commit、safe feature branchへpushし、SSOTとruntimeを同一commitに混ぜない。
  - human_review: R4のため、architecture/product authority、薬剤師・patient safety、privacy/security、DB/data integrity、FHIR/JP Core specialist、必要に応じ法務・請求authorityの明示承認が実装開始gate。
  - exact_next_action: WP-0053aでユーザー提供v0.5原文をDraft artifactとして保存し、ARC-008および現行APPROVED SSOTとの差分表を作る。

### Phase 0A — 仕様受理・版固定・権威境界

- [ ] WP-0053a v0.5 Draft保存とnormative delta matrix(READY、R3 SSOT)
  - scope: `docs/spec/fhir_jp_core_native_interoperability_v0.5.md`へ原文をDraft保存し、ARC-008/PRD-007/DOM-005/006/API-004/008/DB-005/SEC-008との差分、矛盾、維持事項を1行1decisionで記録する。
  - root_cause/evidence: 現在の正式製品仕様は`construction_prompt_v0.2.0.md`のみで、チャット本文はrepository SSOTではない。特にDOM-005の旧「canonical model ≠ FHIR」本文とv0.5が衝突する。
  - dependencies: WP-0053。acceptance: 原文byte-preserving Draft、source/date/status、差分全件、未解決事項、PRC-007改版対象が揃い、DraftをAPPROVED扱いしない。
  - owner/verification: Codex root / exact diff、`check:ssot-index`対象外Draft確認、secret/PHI scan、architecture/spec review。
  - demo/rollback/commit: demo N/A、文書revert可、独立docs commit/push。human_review: product/architecture authority。exact_next_action: 保存先IDとindex扱いをPRC-007に照合する。

- [ ] WP-0053b FHIR/JP Core/terminology package baseline lock(READY、R3 external-standard)
  - scope: `fhir_version_baseline.md`、`jp_core_version_baseline.md`、`fhir_package_lock.md`、`terminology_package_lock.md`。FHIR R4 4.0.1 / JP Core 1.2.0を候補lockし、1.3.0-devはwatch-onlyとする。SMART/Bulk Data/CDS Hooks等は採用時に個別version/statusをlockする。
  - root_cause/evidence: 版未固定ではmeta.profile、validator、SearchParameter、terminology、IG buildが再現不能。公式JP Core historyは1.2.0 current / 1.3.0-dev developmentを示す。
  - dependencies: WP-0053a。acceptance: canonical package id/version/hash/source/retrieved_at/license/FHIR dependency/update policy/rollbackを固定し、floating/latest/dev dependencyをCIが拒否する。
  - owner/verification: Codex root / official package metadata、clean install、checksum、FHIR Validator/IG Publisher/SUSHI互換性spike。
  - prelock_evidence(2026-07-16): WP-4153〜4156でJP Core/terminology/HL7 dependency/tools artifactsをfingerprintし、metadata drift、license gap、transitive conflict、missing tools canonicalを記録。WP-4157でhistorical/current toolchain candidatesとJava17/Node22 clean matrixを分離。WP-4158でJP Coreの利用者責任notice、repo/package license不在、terminology 1.4.0 resource-level rights分布を確認し、current IP reviewをversion-specific clearanceへ流用しない方針を固定した。
  - demo/rollback/commit: synthetic validationだけ、lockfile revert可、SSOT commit/push。human_review: FHIR/JP Core specialist + legal/license。exact_next_action: WP-4153〜4158 evidenceとreachable terminology×use-lane rights matrixを専門reviewへ提出し、tools resolution、historical/current toolchain selection、legal clearance後にJava17/Node22隔離3-lane spikeを承認する。

- [!] WP-0053c FHIR Native 3-plane architecture + PRC-007 cascade(BLOCKED_HUMAN_APPROVAL、R4)
  - scope: `fhir_native_architecture_principles.md`、`fhir_clinical_data_plane.md`、`technical_control_plane.md`、`adapter_plane_policy.md`を起草し、ARC-008/PRD-007/DOM-005/API-002/004を改版する。独自APIをTechnical Control Planeへ限定し、clinical payloadのcontrol-plane二重保存を禁止する。
  - root_cause/evidence: ARC-008はFHIR格納正本をAPPROVED済みだが、旧本文/現行APIにはfacade・BFF・独自Patient APIが残る。v0.5は正式な3プレーンとUI dogfoodingを要求する。
  - dependencies: WP-0053a/b、PRC-007 10段フロー。acceptance: plane ownership/import direction/allowed API/forbidden duplication/failure boundary/PHI policyが一意で、既存SSOTのamendment noteが解除される。
  - owner/verification: Codex root / dependency graph、API/DB inventory、architecture/security/privacy/medical/data review。
  - demo/rollback/commit: architecture fixtureのみ、APPROVED前はruntime変更なし、exact SSOT batch commit/push。human_review: architecture/product/security/privacy/medical authority。exact_next_action: human scope approval後にPRC-007 review packetを発行する。

- [!] WP-0053d Resource ownership/reference/sync policy(BLOCKED_WP-0053c、R4 data-integrity)
  - scope: `yrese_fhir_resource_ownership.md`、`phos_fhir_resource_ownership.md`、`fhir_reference_policy.md`、`yrese_phos_fhir_sync_policy.md`。Resource typeだけでなくinstance creation authority、replica immutability、identifier namespace、logical ID、canonical reference、merge/partition ruleを定義する。
  - root_cause/evidence: Consent/Provenance/AuditEventは両serverの候補に含まれ、type単位ownerだけではmulti-master禁止を証明できない。ReceptionのFHIR写像先も未決定。
  - dependencies: WP-0053c。acceptance: 全対象Resourceにcreate/update/delete/history authorityが1つ、read-only replica制約、cross-server reference、Patient merge/unmerge、Consent/AuditEvent/Provenanceのinstance ownership、Reception mapping decisionが確定する。
  - owner/verification: Codex root / exhaustive resource matrix、conflict/red-team scenarios、medical/privacy/audit/data-integrity review。
  - demo/rollback/commit: synthetic ownership conflicts、文書revert可、SSOT commit/push。human_review: yrese/PH-OS product owners + clinical/privacy authority。exact_next_action: resource×operation×server matrixを作る。

### Phase 0B — Conformance・persistence・security SSOT

- [!] WP-0053e Profile/Extension/Terminology governance(BLOCKED_WP-0053b/c/d、R3)
  - scope: `jp_core_profile_registry.md`、`yrese_phos_profile_registry.md`、`extension_governance_policy.md`、`terminology_governance_policy.md`。DOM-006をFHIR Resource正本前提へ改版し、CodeSystem/ValueSet/ConceptMap/SearchParameter/canonical namespaceを登録制にする。
  - root_cause/evidence: 現DOM-006はcanonical↔FHIR mapping前提であり、v0.5のFHIR正本ではprofile/extension/terminology registryが直接write contractとなる。
  - dependencies: WP-0053b-d。acceptance: 全Phase1 Resourceのprofile/meta.profile/Must Support producer-consumer/missing-data/terminology binding/extension justification/conformance fixtureが登録され、台帳外実装をCIが拒否する。
  - owner/verification: Codex root / official StructureDefinition・ValueSet validation、terminology license、no duplicate model review。
  - prelock_evidence(2026-07-16): WP-4159でPhase 1候補19 Resource typeをJP Core 1.2.0 packageへ照合し、14 type / 32 constraint Profile、5 typeのProfile不在、MedicationRequest/MedicationDispense/Condition/Observationの複数候補を記録。candidate snapshotの直接ValueSet binding 417行 / 128 unique URLはfingerprint済み4 packageへ解決した。WP-4160でpriority 7 candidateのcardinality/binding/reference/invariant差分とMust Support 0件を分離し、公式guidanceどおり派生IGのproducer/consumer責務を未決定に維持した。いずれもProfile採用・実運用到達性・CodeSystem closure・法的clearanceではない。
  - demo/rollback/commit: synthetic examplesのみ、registry entry単位revert、SSOT commit/push。human_review: FHIR/terminology/clinical/legal。exact_next_action: Patient/Coverage/MedicationRequest/MedicationDispenseのuse-case×element producer/consumer/missing-data matrixとgeneral/injection/base・identifier・cross-server Referenceのdecision packetをhuman authorityへ提出する。

- [!] WP-0053f FHIR persistence/search/history/identity policies(BLOCKED_WP-0053d/e、R4 DB)
  - scope: `fhir_persistence_policy.md`、`fhir_search_projection_policy.md`、`fhir_history_policy.md`、`fhir_resource_identity_policy.md`。DB-001..005/WP-6001 proposalを再評価し、engine-neutral invariantsを先に固定する。
  - root_cause/evidence: 現PostgreSQL Patient/ReceptionとDynamoDB候補設計はFHIR Resource/history/meta.profileを正本としてまだ実証していない。projectionを正本化しない再構築可能性も未定義。
  - dependencies: WP-0053c-e、WP-4077/5004/7001との非重複整理。acceptance: resource JSON/version/history/hash/tenant/pharmacy/deletion state、atomic transaction、search projection rebuild、ETag/If-Match、migration/capacity/backup/restore/rollbackを固定し、製品選定はaccess-patternとsecurity evidence後に行う。
  - owner/verification: Codex root / disposable DB spike、concurrency/tenant/history/restore tests、DB/security/privacy/data-integrity review。
  - demo/rollback/commit: synthetic disposable store、本番migrationなし、design/spike分離commit。human_review: infrastructure/security/data authority。exact_next_action: required access patternsとRPO/RTO未確定値を列挙する。

- [!] WP-0053g FHIR REST/CapabilityStatement/Subscription policy(BLOCKED_WP-0053c-f、R4 API)
  - scope: `capability_statement_policy.md`、`fhir_rest_interaction_policy.md`、`fhir_subscription_policy.md`を起草しAPI-008を改版。read/vread/search/history/create/update/transaction/batch/conditional interaction、OperationOutcome、content type、strict search、pagination、ETagをresource別に宣言し、R4 SubscriptionはTrial Useとしてhistory/delta recoveryと分離する。
  - root_cause/evidence: API-008はPROPOSEDかつMVPでtransaction/batch/history-type等を未対応とし、API-001専用patient searchを残すためv0.5 targetと不一致。
  - dependencies: WP-0053b-f。acceptance: `/fhir/r4/metadata`宣言とrouting/contract/testの単一生成元、unsupported fail-closed、SearchParameter allow-list、clinical custom API禁止/deprecation planが確定する。
  - owner/verification: Codex root / FHIR R4 REST/TestScript、CapabilityStatement implementation diff、contract/security/medical review。
  - demo/rollback/commit: synthetic FHIR requests、旧APIはcutoverまで維持、SSOT commit/push。human_review: external API/FHIR/security authority。exact_next_action:現API surfaceをclinical/control/adapterに分類する。

- [!] WP-0053h Provenance/AuditEvent/Consent/security authority(BLOCKED_WP-0053c/d/f、R4 security/privacy)
  - scope: `provenance_policy.md`、`audit_event_policy.md`、`fhir_security_policy.md`。SEC-006/007/008と整合し、FHIR Provenance/AuditEventのauthoritative範囲と内部tamper-evident ledgerの関係、Consent enforcement、SMART/OIDC/mTLS/purpose_of_useを確定する。
  - root_cause/evidence: v0.5はProvenance/AuditEventを両serverの正本候補とする一方、ARC-008は内部監査hash chainを非FHIR正本、Provenanceを投影としている。概念を混同すると二重正本または監査弱体化になる。
  - dependencies: WP-0053c/d/f、WP-5004/SEC-008。acceptance: event class別authoritative store、1:1 correlation、append-only/hash/retention、FHIR read/search監査、token audience/scope/tenant/pharmacy/patient/purpose、PHI非露出が一意で、制約緩和なし。
  - owner/verification: Codex root / threat model、IDOR/cross-tenant/replay/consent/immutability tests、security/privacy/audit/medical review。
  - demo/rollback/commit: synthetic auth/audit only、security relaxation rollback不可なら実装禁止、SSOT commit/push。human_review: security/privacy/legal/medical authority。exact_next_action: audit event taxonomyとdual-store禁止境界を作る。

- [!] WP-0053i IG/conformance/version-migration/partner policy(BLOCKED_WP-0053b/e/g/h、R3)
  - scope: `fhir_conformance_pipeline.md`、`fhir_version_migration_policy.md`、`partner_fhir_onboarding_policy.md`、`smart_on_fhir_policy.md`、`fhir_bulk_data_policy.md`、`cds_hooks_policy.md`と`yrese-phos.fhir.ig`構造。SUSHI/IG Publisher採否、validator、QA report、TestScript/TestPlan、sandbox、SDK、deprecation、および将来capabilityのversion/status/非MVP境界を定義する。
  - root_cause/evidence: profile validation/CapabilityStatement consistency/terminology/transaction/subscription/roundtrip/SMART scope gatesが現在のCIに存在しない。
  - dependencies: WP-0053b/e/g/h。acceptance: clean reproducible IG build、zero error QA policy、locked packages、synthetic examples、CI stop gate、partner kit、JP Core upgrade diff/revalidation/rollback手順が確定する。
  - owner/verification: Codex root / clean toolchain build、validator negative fixtures、CI dry run、FHIR/test/legal review。
  - demo/rollback/commit: public-safe synthetic artifactだけ、toolchain pin revert可、SSOT/tooling別commit。human_review: FHIR/OSS/legal/security。exact_next_action: toolchain license/runtime/version matrixを作る。

- [!] WP-0053j Current-state migration/cutover plan(BLOCKED_WP-0053c-i、R4 data/medical)
  - scope: 現`Patient`/`Reception`/独自API/PostgreSQL repository/Web consumerからFHIR正本へresource単位で移行するexpand→validate→shadow-read(non-authoritative)→consumer switch→authority cutover→legacy retire手順を定義する。
  - root_cause/evidence: 現行`GET /patients/search`、`GET /patients/:id`、`POST/GET /reception`はtarget architectureでclinical custom APIとなる。即削除は主要journeyを破壊し、dual-writeはmulti-master禁止に反する。
  - dependencies: WP-0053c-i、現行FULLSTACK_ALIGNMENT、WP-5002/5003。acceptance: field/resource mapping、loss report、ID/reference preservation、history bootstrap、audit/provenance、read comparison、zero-downtime cutover、rollback point、legacy API sunset date/consumer listが全て確定する。
  - owner/verification: Codex root / anonymized migration rehearsal、record counts/hash/reference/tenant checks、browser/API/full regression、medical/privacy/data-integrity review。
  - demo/rollback/commit: disposable DB + synthetic Bundle、production migrationは別human gate、migration codeとcutover docs分離commit。human_review: pharmacist/product/DB/security/privacy. exact_next_action:現Patient/Reception field-to-FHIR gap mapを作る。

### Phase 1 — yrese FHIR Native Foundation(Phase 0 APPROVED後のみ)

- [!] WP-6004 FHIR/JP Core toolchain and package-lock foundation(BLOCKED_PHASE0、R2 tooling)
  - scope: locked validator/SUSHI/IG Publisher/package cache、synthetic examples、CI scripts。dependencies: WP-0053b/e/i APPROVED。
  - acceptance/verification: clean install/build、negative profile/terminology fixture fail、no network-floating version、SBOM/license/secrets/boundaries PASS。
  - owner/demo/rollback/commit/human: Codex root、synthetic CI demo、tooling commit単位revert、independent verifier + supply-chain/FHIR review。exact_next_action: Phase0 approval後にpackage manager/tool versionsをpinする。

- [!] WP-5009 FHIR Resource Store + history/search projection foundation(BLOCKED_PHASE0、R4 DB)
  - scope: encrypted tenant/pharmacy-scoped resource/version/history store、rebuildable search projection、transaction boundary、optimistic concurrency。dependencies: WP-0053f/h/j + DB/security human approval。
  - acceptance/verification: synthetic Patientでcreate/read/vread/history/update conflict/search/rebuild/restore/cross-tenant deny、no dual authority、zero skipped disposable-DB tests。
  - owner/demo/rollback/commit/human: Codex root、disposable store demo、cutover前はnon-authoritativeでdrop可、DB/security/privacy/data/medical review、production apply別承認。exact_next_action: engine selection spikeを実行する。

- [!] WP-2210 FHIR REST + CapabilityStatement server foundation(BLOCKED_WP-5009、R3 API/security)
  - scope: `/fhir/r4/metadata`、OperationOutcome、FHIR media type、ETag/If-Match、resource interaction/search allow-list、transaction Bundle。dependencies: WP-0053g/h、WP-5009。
  - acceptance/verification: CapabilityStatementとrouteのmachine diff、unsupported interaction deny、auth/tenant/PHI/no-store/rate-limit tests、FHIR validator/TestScript PASS。
  - owner/demo/rollback/commit/human: Codex root、synthetic API demo、feature-gated non-authoritative rollout、API/security/FHIR review。exact_next_action: Patient read/searchの最小vertical sliceをplan reviewする。

- [!] WP-2211 yrese authoritative Resource rollout(BLOCKED_WP-2210、R4 clinical)
  - scope: Patient→Coverage/Organization/Practitioner(Role)/Location→Medication→MedicationRequest→MedicationDispense→AllergyIntolerance/Condition/Consent→Provenance/AuditEventのrisk-ordered slices。各sliceはprofile/terminology/history/audit/ownershipを同時に満たす。
  - dependencies: WP-0053d/e/h/j、WP-2210。acceptance/verification: resource別DoD、FHIR/JP Core validation、transaction/reference/tenant/concurrency/medical-safety tests、legacy authority cutover evidence。
  - owner/demo/rollback/commit/human: Codex root、synthetic clinical journeys、resource単位rollback、slice別commit/push、pharmacist/FHIR/privacy/security review。exact_next_action: Patient sliceだけを独立WPへ再発行する。

- [!] WP-3023 yrese Web FHIR API dogfooding migration(BLOCKED_WP-2211_PATIENT、R3 UI/medical)
  - scope: patient search/context/reception等のWeb consumerを公開FHIR Data Planeへ移行し、内部専用clinical APIを廃止する。Technical Control Plane UIは独自APIを維持できる。
  - dependencies: WP-0053g/j、該当Resource slice。acceptance/verification: selected-patient safety、loading/empty/error/stale/permission、mobile/keyboard、request/contract/browser evidence、旧consumerゼロ。
  - owner/demo/rollback/commit/human: Codex root、synthetic browser journeys、consumer単位feature rollback、UI/API別commit、medical/accessibility/privacy review。exact_next_action: API-001 consumer inventoryを作る。

### Phase 2+ — PH-OS sync / Adapter / Open ecosystem

- [!] WP-2212 yrese↔PH-OS FHIR native synchronization(BLOCKED_PHASE1、R4 distributed-data)
  - scope: REST/transaction Bundle/history deltaをrecovery正本、R4 Subscription/rest-hookを通知、control planeをretry/cursor/dead-letter/leaseに限定する。相手Resourceはread-only replica。
  - dependencies: WP-0053d/g/h、両serverのauthoritative Resource実装。acceptance/verification: lost/duplicate/out-of-order notification、version conflict、offline rebase、idempotency、dead-letter recovery、no multi-master、cross-tenant deny。
  - owner/demo/rollback/commit/human: cross-repo ownersを明示して各repo sole editor、synthetic two-server demo、subscription停止→history pull fallback、repo別commit、clinical/privacy/security/data review。exact_next_action: PH-OS側repo/SSOT/versionをlive確認する。

- [!] WP-2213 Legacy / Official Adapter Plane FHIR ACL(BLOCKED_PHASE1、R4 regulatory)
  - scope: JAHIS/NSIPS/電子処方箋/資格確認/PMHをACLでFHIR Resource/Bundleへ変換し、外部形式をClinical Coreへ漏らさない。レセ電・請求は日本固有Domain/official outputを維持する。
  - dependencies: WP-0035、ARC-003/004、adapter source/license/evidence、該当FHIR profiles。acceptance/verification: approved mapping、roundtrip loss report、encoding/invalid input/PHI/audit、official-format conformance、FHIR validator PASS。
  - owner/demo/rollback/commit/human: Codex root、synthetic fixtures only、adapter単位disable/rollback、adapter別commit、legal/regulatory/pharmacist/privacy review。exact_next_action: adapter×FHIR Resource applicability matrixを作る。

- [!] WP-2214 Open ecosystem: SMART/Bulk Data/CDS Hooks/Partner Sandbox(BLOCKED_PHASE1、R4 external/security)
  - scope: `smart_on_fhir_policy.md`、`fhir_bulk_data_policy.md`、`cds_hooks_policy.md`、sandbox/conformance kit/SDK。FHIR R4向けpublished versionsを個別lockし、STU/Trial Use statusを明示する。
  - dependencies: WP-0053b/g/h/i、stable FHIR server。acceptance/verification: SMART discovery/PKCE/audience/scope、backend service auth、Bulk NDJSON async export/purpose/audit/expiry、CDS suggestion-only/pharmacist confirmation、partner contract tests。
  - owner/demo/rollback/commit/human: Codex root、synthetic sandbox、capability別feature disable、capability別commit、security/privacy/legal/medical review。exact_next_action: MVP/non-MVP capability prioritizationをproduct authorityへ提示する。

- [!] WP-2215 FHIR Native final conformance and cutover gate(BLOCKED_ALL_PREDECESSORS、R4 release)
  - scope: IG QA、validator、terminology、CapabilityStatement、REST/transaction/history/Subscription、SMART/Bulk/CDS applicable gates、migration reconciliation、local demo、clean restart、legacy clinical API removalを統合判定する。
  - dependencies: WP-0053a-j、WP-6004/5009/2210-2214/3023。acceptance/verification: v0.5 Definition of Done全項目、0 unmanaged P0/P1、0 clinical custom API consumer、0 multi-master/dual authority、zero-skip applicable tests、independent/human approval。
  - owner/demo/rollback/commit/human: Codex root integration owner、synthetic end-to-end + partner sandbox、resource cutover rollback runbook実証、landing-record commit/push、architecture/product/FHIR/pharmacist/security/privacy/data/legal release gate。exact_next_action: predecessor completion後にrequirement-by-requirement auditを作る。

### v0.5 実行順序と即時停止条件

1. WP-0053a/bをread-only evidence優先で進める。
2. WP-0053cはR4 human scope approval後、PRC-007の10段フローで実施する。
3. WP-0053d/e/hをownership・clinical semantics・securityの同一decision batchとしてreviewし、その後f/g/i/jを確定する。
4. Phase 0全SSOT APPROVED前にWP-6004以外のruntime実装を開始しない。toolchainもlock/ライセンス/CI plan承認前は追加しない。
5. Phase 1はPatientの最小vertical sliceから始め、resource単位でverify/cutoverする。同一Resourceのdual-write/multi-masterを導入しない。
6. PH-OS sync、Adapter、SMART/Bulk/CDSはPhase 1の安定したFHIR serverとownership evidence後に進める。
7. 現行独自clinical APIはconsumer移行とrollback実証前に削除しないが、新規clinical capabilityを独自APIへ追加しない。
8. JP Core 1.3.0-dev、R5、未lock package、未定義canonical URL、未登録Extension/Terminology、validatorなしの`JP Core準拠`訴求、control planeへのclinical payload複製、FHIRによる請求/会計正本置換はfail-closedで停止する。

## v0.7 調剤レセコン総合機能計画(ユーザー提供 Draft 2026-07-16、受理 2026-07-16)

> Normative status: 本節はユーザー提供v0.7を実行可能な計画へ変換した作業台帳であり、APPROVED SSOTではない。法令・公式仕様・`docs/spec/construction_prompt_v0.2.0.md`・APPROVED SSOTと競合する項目はPRC-007で改版・人間承認されるまで実装しない。v0.7 §31の旧team/model routingはAGT-018と競合するため、Codex root sole maintainer、変更を行わないindependent verifier、必要なdomain reviewer、人間authorityへ正規化する。

- [~] WP-0054 v0.7 Comprehensive Pharmacy Platform program(PHASE0_PLANNING、R4)
  - outcome: FHIR/JP Core Clinical Data Platform、日本固有Transaction Core、Pharmacy Operations、Open Integration、Reliability/UX/AIの5層を、既存実装・SSOT・公式根拠に接続したRelease Gate 0〜5へ変換する。
  - invariants: FHIR clinical authority、日本固有算定/請求/会計分離、public API dogfooding、local-first、medical-grade UX、AI draft + human decisionを維持する。独自clinical DTO正本、直接DB連携、multi-master、外部形式のCore流入、AI/Cloud障害による業務停止を禁止する。
  - acceptance: §1〜38、22 domain、全機能列挙、P0〜P3、Gate 0〜5、依存関係、共通module、22新規SSOT候補、KPI、停止条件の各要件が少なくとも1つのWP/既存SSOT/human gateへ追跡可能で、unmapped=0、duplicate-authority=0、unsupported compliance claim=0。
  - current_coverage_status(2026-07-16): `STRUCTURAL_SECTION_PASS / ITEMIZED_SEMANTIC_UNPROVEN`。§1〜38、22 domain、88 sliceの構造mappingは検証済みだが、90件はrepresentative requirementであり、全bullet/functionの一意ID付きsource inventoryは存在しない。従ってacceptanceのitemized `unmapped=0`は未達成で、WP-0054q閉塞まで完了宣言しない。
  - execution: Release Gate 0はdocs/evidenceのみ。R3+ runtime、DB、医療安全、請求、会計、外部接続、production変更は対応SSOTのAPPROVEDと明示human gate後に再発行する。

### WP-0054 Evidence baseline と計画上の補正

| evidence/source (retrieved 2026-07-16) | confirmed fact | plan consequence |
|---|---|---|
| MHLW 安全管理ガイドライン第7.0版・令和8年度チェックリスト | 第7.0版は令和8年6月、医療機関/薬局チェックリストは令和8年度に統合 | 版、公開日、hash、要求、owner、evidence、gap、remediation、期限をSEC mappingへ持つ。「準拠」宣言だけではGateを通さない |
| MHLW オンライン資格確認 | IC/資格確認書、スマホ対応端末、災害時/障害時運用があり端末世代・運用条件が変化する | official adapter capability、device generation、consent、snapshot、pending/fallback、recheckを別taskにする |
| Digital Agency PMH | API/XML/test/masterが個別改版され、参加制度・自治体差がある | municipality participation +制度master version +紙併用を正本化し、全国一律利用を仮定しない |
| MHLW 電子処方箋 | 受付/取消/回復、リフィル、重複確認、調剤結果/署名/再送等をofficial flowとして扱う | unofficial cloud direct connection禁止。接続試験/self-check/署名方式/結果状態をofficial adapter WPへ分離 |
| 支払基金 電子レセプト/返戻再請求 | 記録条件仕様、返戻、再請求関連artifactは版更新される | claim format、return、resubmission、remittanceを別version lock、license/redistribution review付きで管理 |
| 薬剤師法/療担規則・薬局内文書電子化資料 | 現行保存義務と真正性・見読性・保存性があり、保存期間改正動向もある | 保存年数をcodeへ固定せずeffective-date law registry + legal approval + migration/holdを設ける |
| PMDA回収情報 / GS1 Japan | 回収にはGTIN/lot、class、終了状態があり、転載制約がある。調剤包装単位の識別規則がある | recall ingestion rights review、GTIN/lot trace、manual verification、source snapshot/hashを必須化 |
| AWS Bedrock model lifecycle/data retention/region/guardrails | modelはActive/Legacy/EOL、retention modeとcross-region destinationがmodel/profileで異なる | model/region/mode registry、PHI eligibility、ZDR/retention、SCP/IAM、fallback、migration rehearsalが承認されるまでclinical PHIを送らない |
| vendor public pages(MEDIXS/MAPs/Pharnes/P-CUBE n/Pharmy/GENNAI/調剤くんV8) | 受付、在庫、在宅、遠隔、AI、監査等の公開価値は確認できるがedition/option差がある | benchmark signalとしてのみ使用し、retrieval date/edition/option/claimを記録。内部実装や同等性を推測しない |

Primary-source URLs to fingerprint in WP-0054c (not a substitute for source files or human approval):

- MHLW security v7.0/checklist: `https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html`
- Online eligibility: `https://www.mhlw.go.jp/stf/newpage_08280.html`
- PMH: `https://www.digital.go.jp/policies/health/public-medical-hub`
- Electronic prescription: `https://www.mhlw.go.jp/stf/denshishohousen.html`
- Electronic claims / return-resubmit: `https://www.ssk.or.jp/seikyushiharai/iryokikan/iryokikan_02.html`, `https://www.ssk.or.jp/seikyushiharai/iryokikan/iryokikan_h281214/index.html`
- Electronic pharmacy documents / current law: `https://www.mhlw.go.jp/content/001279081.pdf`, `https://www.mhlw.go.jp/web/t_doc?dataId=81001000`
- PMDA recalls / GS1 healthcare: `https://www.pmda.go.jp/safety/info-services/drugs/calling-attention/recall-info/0002.html`, `https://www.gs1jp.org/standard/healthcare/`
- Bedrock lifecycle/retention/region/guardrails: `https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle.html`, `https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html`, `https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html`, `https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-how.html`
- Vendor benchmark entrypoints: `https://medixs.jp/product/function/`, `https://service.emsystems.co.jp/maps_series/for_pharmacy/`, `https://www.phchd.com/jp/medicom/pharmacies/pharnesx-mx`, `https://www.unike.co.jp/product/pharmacy/p-cuben/`, `https://www.moinetsystem.com/system/pharmy-feature/`, `https://dx.emedical.ne.jp/products/rececom/`, `https://chouzai-sys.nextit.co.jp/`

### Release Gate 0 — 仕様・根拠・境界の確定(コード実装禁止)

- [~] WP-0054a Draft intake / normative delta registry(PARTIAL_SOURCE_BLOCKED)
  - scope: v0.5/v0.6/v0.6.1/v0.3/v0.2.1とAPPROVED SSOTのrequirement-by-requirement差分、矛盾、廃止、未決、PRC-007対象を登録する。
  - acceptance: source/version/section/requirement/authority/status/decision/owner/review/target WPを持ち、v0.7全38節のunclassified=0。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_normative_delta_registry_20260716.md`でV07-01..38をcurrent APPROVED SSOTへ分類し、immediate amendment queue、preserved invariants、human decisionsを記録。38/38、unclassified=0。v0.7/v0.5原文とv0.6/v0.6.1/v0.3/v0.2.1のversioned raw artifactがrepositoryにないため前提仕様間exact deltaは`BLOCKED_SOURCE`であり、DONEにしない。
  - commit_push: `7c790fd`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。source completion、human review、independent verificationは未完了。
  - exact_next_action: WP-0054bのpath-level current-state coverageを進め、並行してmissing source artifactを安全に取得・hash化した後、本matrixを再計算する。
- [~] WP-0054b Current-state coverage matrix(LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED)
  - scope: 22 domainごとにAPPROVED SSOT、Draft、code、contract、test、fixture、runtime、external dependencyを`IMPLEMENTED/PARTIAL/DOC_ONLY/MISSING/DUPLICATE/BLOCKED/OUT_OF_SCOPE`でfresh scanする。
  - acceptance: evidence path/lineまたはcommand、gap、risk、dependency、next WPを持ち、推測でimplemented判定しない。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_current_state_coverage_20260716.md`で22/22 domainを8 evidence dimensionへ分類。`IMPLEMENTED=0`、`PARTIAL=8`、`DOC_ONLY=5`、`BLOCKED=3`、`OUT_OF_SCOPE=5`、`MISSING=1`、unclassified=0。40 existing path referenceと11 expected-absent packageを機械検査し、unexpected missing=0。runtimeはPatient/Reception/Auditと限定的Calculation foundationが中心で、文書・enum・fixture・placeholderをimplementedへ昇格していない。
  - commit_push: `77f548f`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verificationは未完了。
  - exact_next_action: 本artifactをlanding後、WP-0054cでofficial/vendor primary sourceをretrieval date/version/hash/license/applicability付きでfingerprintし、vendor claimを法令・請求・医療安全の根拠へ昇格しない。
- [~] WP-0054c External evidence and benchmark registry(LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED)
  - scope: 法令、通知、公式仕様、package、vendor public claimを一次情報URL、取得日、版、hash、利用/転載条件、適用範囲、expiry/watch owner付きで登録する。
  - acceptance: competitor claimはedition/option不明を明示し、法令/請求/患者安全をvendor資料だけで確定しない。PMDA/JAHIS/NSIPS/official artifactのlicenseをfail-closed判定する。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_external_source_fingerprints_20260716.md`へofficial/public 10、HL7 6、JAHIS/NSIPS 4、AWS Bedrock 4、vendor 14の計38 sourceを登録。全件live web確認、HTTP 200、decoded-body SHA-256取得済み。authority/right/watch/applicabilityを分類し、linked PDF/package/terminology/restricted specificationへlanding hashを流用していない。vendorはPriority C、NSIPSはrestricted、AWSはdynamic service docsとしてfail-closed。evidence_id昇格は0。
  - commit_push: `70c3813`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、exact-artifact license review、human evidence promotionは未完了。
  - exact_next_action: artifact landing後、WP-0054dでPriority Aのみをeffective date/jurisdiction/applicability/control/test/human sign-offへ写像する。linked PDF/packageの個別取得/hash/license reviewは別evidence WPで継続する。
- [~] WP-0054d Legal / regulatory / clinical compliance matrix(R4 human authority) — LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED、HUMAN_SIGN_OFF_BLOCKED
  - scope: 調剤、保存、電子記録、請求、資格、PMH、電子処方箋、オンライン服薬指導/配送、医療安全、privacy/securityをrequirement→control→evidence→testへ写像する。
  - acceptance: effective date、jurisdiction、applicability、official source、human legal/pharmacist/claim/security sign-off、change watchを必須とし、未確定はBLOCKED。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_compliance_matrix_20260716.md`へ18 controlを作成し、要求12領域を12/12 coverage。各行にeffective date/jurisdiction/applicability、proposed control、evidence/test contract、human sign-off、watchを設定した。2026-07-16時点の薬剤師法API本文は処方箋・調剤録3年保存、将来改正は5年であるため`TIME_SPLIT_REQUIRED`とし、具体的施行日・経過措置の人間確認なしに上書きしない。個人情報ガイダンス令和8年4月版、安全管理GL 7.0、令和8年度checklist、事業者GL 2.0、SaMD 2023-03-31改正版を公式sourceで再確認。実装許可0、evidence_id発行0、18/18がexact-artifactまたはhuman review blocker。
  - commit_push: `08cf334`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、exact-artifact promotion、human sign-off、APPROVED SSOT改版は未完了。
  - exact_next_action: artifact landing後、WP-0054eで本matrixのblocker/dependencyだけをP0〜P3/Gate 0〜5 DAGへ入力する。REG-003改版、REG-004 blocker解除、実装開始はexact artifact取得・evidence promotion・human sign-offまで禁止する。
- [~] WP-0054e Priority / Release Gate / dependency DAG — LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED、HUMAN_GATE0_BLOCKED
  - scope: P0〜P3とGate 0〜5をpatient safety、legal/claim、data authority、migration reversibility、commercial value、dependencyで再採点する。
  - acceptance: 各WPにpriority/risk/dependencies/entry/exit/rollback/demo/owner/verifier/human gateがあり、循環依存とGate bypassが0。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_priority_release_dag_20260716.md`へGate 0〜5の40 WPを分解し、patient safety/legal-claim/data authority/migration reversibility/commercial/dependency centralityで再採点。全WPにscore/priority/risk/dependencies/entry/exit/rollback/synthetic demo/owner-verifier/human gateを設定した。machine-auditable edge 83件をtopological検査しcycle=0、unknown endpoint=0、Gate 1〜5 ancestry bypass=0。Dispensing Workflowはproduction patient journeyの安全完結に必須なためP1→P0へ再評価。電子処方箋2.04/セルフチェック4.2、PMH公開spec/test/checklist/master、JAHIS 1.11をlive再確認し、public artifact/test設計とauthorized connectionを別WPに分離した。実装権限は0。
  - commit_push: `9975a81`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、product/human Gate 0 approval、Gate 1 WP reissueは未完了。
  - exact_next_action: artifact landing後、WP-0054fで40 WP/83 edgeを5層・3 plane・22 domain・public/partner/control API・event/package/tenant/store/authority境界へ写像する。Gate 1 codeはG0-08 human approval/reissueまで禁止する。
- [~] WP-0054f Domain boundary / API / module architecture — LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED、SSOT_AMENDMENT_BLOCKED
  - scope: 5層、FHIR/Technical/Adapter 3-plane、日本固有domain、22 domain、event、public/partner/control APIs、authority、tenant/store境界を確定する。
  - acceptance: clinical public API=FHIR、business API=承認済みcontract、control API=OpenAPI、DB direct=0、duplicate enum/status/ID/money/date/audit/retry=0。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_domain_api_module_architecture_20260716.md`へ5 product layerと3 planeを直交分離し、22/22 domainをauthority/write owner/API/event/package/tenant-storeへ写像。APIをClinical FHIR/Public business/Partner/Technical Control/Official-Legacy Adapterの5 classへ限定し、40/40 release WPを境界へ割当。ARC-008と旧DOM-005本文のFHIR格納正本 vs Facade競合を明示し、ARC-008暫定優先→同一PRC-007 batchでDOM/API/MOD/DB/event/security改版の順序を定義した。`shared-types`はreject、direct DB/hidden UI clinical API/duplicate authorityは禁止。AuditEvent/ProvenanceはFHIR payloadとtamper metadataを別write authorityにせずsingle append path候補。実装権限0。
  - commit_push: `20779f7`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、FHIR/data/security/product human decision、PRC-007 amendment batchは未完了。
  - exact_next_action: artifact landing後、WP-0054gでClinical FHIR/Public business/Controlの境界を用いて受付→会計、月次請求、在宅のshared state、Guided/Expert、keyboard/accessibility、SLO/KPI measurement contractを作る。ARC-008/DOM-005等のAPPROVED改版はG0-08 human approvalまで禁止する。
- [~] WP-0054g UX workflow / performance / KPI evidence — LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED、HUMAN_UX_SLO_KPI_BLOCKED
  - scope: Guided/Expert共通state、受付→会計、月次請求、在宅、offline/recovery、keyboard/accessibility、SLO候補、KPI定義をprototype/test planへする。
  - acceptance: patient/store/claim-month固定表示、仮/確定/未確認/pending識別、色以外の表現、分母/除外/clock/source、実機baselineが定義される。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_ux_performance_kpi_evidence_20260716.md`へGuided/Expertを同一command/state/audit contract上のpresentationとして定義し、tenant/pharmacy/mode/patient/claim-month/facility/versionの固定文脈、7つの直交状態軸、受付→会計A01〜A16、月次請求B01〜B12、在宅/PH-OS C01〜C12を分解した。WCAG 2.2/WAI-ARIA APG/INP/OpenTelemetryの9一次pageをlive取得・hash化し、keyboard/focus/color/error-prevention/target/statusとinteraction/business latencyを分離。v0.7値と既存UIX-003候補の不一致を上書きせずPRC-007/human gateへ戻し、実機baseline fieldを定義。業務・請求・会計・在庫・platform/AIの34 KPI候補へnumerator/denominator/event-time/authority/exclusionを設定した。実装・適合・SLO・KPI公開権限は0。
  - commit_push: final artifact contentを`f3bc288`まで`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、human workflow/accessibility/performance/privacy/statistics approval、real-device baseline、PRC-007改版は未完了。
  - exact_next_action: artifact landing後、WP-0054hでA/B/C journeyと34 KPIのfailure/mode境界をoperation×LOCAL_ONLY、PHI/data class、Edge bundle、RTO/RPO/restore、cutover/support/external fallback matrixへ接続する。UIX/OPS改版、prototype実装、SLO確定、KPI公開はhuman approvalまで禁止する。
- [~] WP-0054h Offline / security / migration / operations matrices(R4) — LOCAL_READY、INDEPENDENT_VERIFY_REQUIRED、R4_HUMAN_GATE_BLOCKED
  - scope: operation×LOCAL_ONLY可否、PHI/data class、Edge bundle、RTO/RPO/SLO、restore、cutover/rollback、support access、external dependency fallbackを統合する。
  - acceptance: cloud/AI/external unavailableで可能/禁止/pending/recovery後作業が一意。production rehearsalは別human approval。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_offline_security_migration_operations_matrix_20260716.md`へ既存ARC/SEC/OPS/ADPをfresh scanし、authority/LOCAL_ONLY会計/migration/RTO-retentionの7 conflictを抽出。MHLW 7.0/FY2026 checklist/manualとAWS DR/restore公式8 sourceをlive取得・hash化し、operation 36件をFINAL/PENDING/FORBIDDEN/RECOVERY/BLOCKEDへ写像、PHI runtime axisと7 control classを分離した。Edge manifest/resource/expiry/encryption、capability別RTO/RPO、restore RST-01〜10、migration M01〜10、support S01〜10、external fallback X01〜16、drill D01〜10を定義。v0.6/v0.6.1 raw不在はPARTIAL_SOURCE_BLOCKED、R4実装/production authorityは0。
  - commit_push: `387cabd`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。independent verification、R4 human authority、exact predecessor source、DR/restore/cutover/support rehearsalは未完了。
  - exact_next_action: artifact landing後、WP-0054iでWP-0054a-hのcoverage/delta/source/compliance/DAG/boundary/UX/BCP evidenceを1 decision packetへ統合し、human Gate 0のapprove/reject/amend/reissue入力を作る。CF-01〜07改版、DR/cutover/support/production rehearsalはhuman approvalまで禁止する。
- [~] WP-0054i Gate 0 approval packet(DRAFT_NO_GO、HUMAN_DECISION_REQUIRED、INDEPENDENT_VERIFY_REQUIRED)
  - scope: coverage、追加機能、重複統合、priorities、gates、SSOT順、Codex WPs、人間review、BLOCKER、go/no-goを1つのdecision packetへまとめる。
  - acceptance: pharmacist、claim practitioner、legal、FHIR、security/privacy、data-integrity、operations/product authorityがscope/evidence/riskを承認し、Gate 1 WPsを再発行する。
  - evidence/result(2026-07-16): `docs/research/rececon_v0_7_gate0_decision_packet_20260716.md`へWP-0054a〜hの8 artifact/hash/landing commit、22-domain coverage、追加機能、DI-01〜12統合判断、P0〜P3、Gate 0〜5、SSOT Batch A〜D、Codex-only WP、11 human review role、HD-01〜18 decision、14 BLOCKER、Go/No-Go algorithmを統合。independent verificationは`docs/research/rececon_v0_7_independent_verification_20260716.md`の`PASS_WITH_FINDINGS`。構造count/hash/DAG/NO_GOはPASS、VF-01 itemized semantic coverageはOPEN、VF-02 G5-03 dependencyは`dcdf64e`で修正しindependent re-verification PASS。人間判断complete=0/18、Gate 1 reissue=0のためcurrent decisionは引き続き`NO_GO`。
  - commit_push: decision packet本体とWP-0054i〜nのplan evidenceは`4fc5658`、G5-03 dependency整合は`dcdf64e`、独立検証・VF-01/VF-02反映は`046a4c3`で`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。APPROVED SSOT/runtime/UI/DB/external/production変更なし。
  - exact_next_action: predecessor raw artifactとPriority A exact official artifactをrights/hash付きで回復・昇格し、HD-01〜18をnamed human authorityへ回付、PRC-007 atomic amendment batchを未発効で準備し、独立検証後にG0-01〜08を再評価する。それまでGate 1〜5 runtime WPを再発行しない。

Initial fresh-scan coverage snapshot (2026-07-16; not a readiness claim):

| area | current evidence | initial classification / next decision |
|---|---|---|
| runtime-neutral foundations | `packages/shared-kernel`, `money`, `date-time`, `trace`, `events`, `contracts`, `audit` | IMPLEMENTED/PARTIAL; preserve as concept authorities and measure gaps in WP-0054b |
| calculation | `packages/calculation` and calculation SSOT/tests | PARTIAL; official coverage, copayment/public/PMH/claim integration remains evidence-gated |
| patient/reception/API/UI | API repositories/contracts and Web reception/patient/prescription shells exist | PARTIAL/LEGACY-TARGET; current custom clinical API cannot be called FHIR Native and must follow WP-0053j/3023 cutover |
| FHIR/JP Core native server | WP-0053 and WP-6004/5009/2210-2215 plans; no `packages/fhir` runtime package | DOC_ONLY/BLOCKED_PHASE0 |
| accounting/claim/operations/security/UIUX/migration | substantial indexed APPROVED/Draft docs; selected audit/API foundations | DOC_ONLY/PARTIAL by slice; no domain-wide implementation claim |
| dispensing/inventory/device/home/patient engagement/multistore/AI/analytics | feature-level runtime authority not established by this scan | MISSING/PARTIAL-UNKNOWN; WP-0054b must produce path-level evidence before reprioritization |

Scope delta summary:

- reuse/amend: v0.5 FHIR foundation、existing calculation/audit/contracts、accounting SSOT群、claim matrices、Edge/offline、migration、security、UIUX、go/no-go。
- add/expand: D01〜D22 end-to-end lifecycle、dispensing/inventory/device、official external operations、home/patient/multistore、partner ecosystem、analytics、Bedrock governance。
- merge/delete candidates: duplicate benchmark/queue/accounting/migration/support/KPI/UX/release documents and future `shared-types`; authority diffなしに削除・renameしない。
- human-only decisions: law/claim/pharmacy practice、patient safety、retention/e-signature、production/DB/external connection、security/privacy relaxation、Bedrock PHI eligibility、Release Gate approval。

Dependency DAG (all edges are prerequisites, not authorization):

| prerequisite | dependent domains/gates |
|---|---|
| WP-0053 FHIR/JP Core foundation + D17 terminology | D01, D03, D04, D06, D13, D14, D18; Gate 1+ |
| D01 identity/consent + D21 security | D02, D03, D08–D10, D13–D16, D18–D20 |
| D03 ingress + D04 prescription + D17 master | D05 dispensing, D06 safety, D07 calculation, D11 inventory, D13 e-prescription result, D14 visit |
| D07 calculation | D08 claim, D09 accounting, D10 patient documents, D19 metrics/explanation |
| D05 dispensing | D08 claim completion, D10 legal records, D11 stock posting, D12 devices, D13 result registration, D14/15 handover |
| D12/D21 Edge/offline/recovery | LOCAL_ONLY accounting/printing, official adapters, PH-OS visit, device operation, Gate 2+ reliability |
| D20 migration/portability | authority-specific cutover before Gate 2; every later gate must retain export/rollback evidence |
| WP-0054a-i human-approved Gate 0 packet | all runtime WPs and Gate 1–5 |

### 22 domain coverage と細分化Work Package

以下の各domainは、`A=authority/model`, `B=workflow/rules`, `C=integration/UX`, `D=verification/migration/operations`の4 sliceを最小単位とする。全runtime sliceは対応SSOT APPROVED後まで`BLOCKED_GATE0`である。

- [!] WP-0054-D01 Patient Identity / Consent(BLOCKED_GATE0、P0、R4)
  - D01-A: Patient/RelatedPerson/Coverage/Organization/Location identifier、氏名(漢字/カナ/旧姓/通称)、生年月日、性別、住所/連絡先、家族/代理人/緊急連絡先、施設/医療機関ID、死亡/転居/終了model。
  - D01-B: duplicate candidate、決定論的match、human merge/split、旧Resource ID/redirect/history、訂正/開示、Provenance/AuditEvent。氏名+生年月日だけの自動統合禁止。
  - D01-C: Consent目的/共有先/撤回、代理受付/受取/支払、固定patient banner、取違え防止、tenant/store-crossing authorization。
  - D01-D: synthetic false-positive/false-negative、merge rollback、split/relink、consent revoke、cross-tenant/IDOR、FHIR validation、migration reconciliation。
- [!] WP-0054-D02 Reception / Queue / Appointment(BLOCKED_GATE0、P1、R3)
  - D02-A: 来局/net/e-prescription/JAHIS QR/FAX-image/Web問診入口、受付番号/check-in、重複/期限/cancel、appointment、priority、緊急/在宅/施設/online区分。
  - D02-B: `PRE_RECEIVED/CHECKED_IN/IDENTITY_PENDING/PRESCRIPTION_PENDING/QUALIFICATION_PENDING/READY_FOR_INPUT/DISPENSING/AUDIT_PENDING/COUNSELING_PENDING/PAYMENT_PENDING/READY_FOR_PICKUP/DELIVERY_PENDING/COMPLETED/CANCELLED/EXPIRED` state registry、allowed transition、actor/precondition/side effect/idempotency、内部状態と患者通知状態の分離。
  - D02-C: 店頭/配送/locker/家族/online受取、wait/ready notification、Kanban/list、遅延理由、guided/expert keyboard journey。
  - D02-D: concurrency/stale/duplicate/expiry/timezone/offline/notification failure、queue load/SLO、recovery and audit tests。
- [!] WP-0054-D03 Prescription Ingress(BLOCKED_GATE0、P0、R4)
  - D03-A: official e-prescription、JAHIS院外QR、お薬手帳QR、verified manual、external FHIR/PHR、OCR/image、migrationのsource/trust registry。
  - D03-B: source hash/retention、split QR reconstruction、OCR confidence、paper diff、original scan、duplicate/e-prescription duplicate、drug code resolution、validation、pharmacist confirmation/correction history。
  - D03-C: Adapter ACLでMedicationRequest/Dispense/Statementを意味別に生成し、患者提示/原本/official dataを混同しない。お薬手帳/OCRの自動正式昇格禁止。
  - D03-D: malformed/encoding/partial/duplicate/loss report、roundtrip、FHIR/terminology/profile、PHI log、license and synthetic fixture tests。
- [!] WP-0054-D04 Prescription Lifecycle(BLOCKED_GATE0、P0、R4)
  - D04-A: RP、内服/外用/頓服/注射/材料、用法用量/日数/数量、一包化、不均等/漸増減/隔日/曜日、処方元/医師/診療科model。
  - D04-B: refill、split/partial、long-term、generic、substitution、selected medical care、疑義照会、残薬/減数、変更/中止/再発行/期限/調剤済・未調剤/取消/訂正state and invariants。
  - D04-C: 前回差分(追加/中止/増減)、理由、照会前後diff、original MedicationRequestとMedicationDispense分離、DetectedIssue/Task/Communication。
  - D04-D: version/history/no destructive overwrite、complex dosage golden cases、concurrency、FHIR profile/terminology/medical review。
- [!] WP-0054-D05 Dispensing Workflow(BLOCKED_GATE0、P1、R4)
  - D05-A: instruction/picking/counting/powder/liquid/ointment/one-dose/preparation、controlled-drug caution、dispenser/auditor/counselor、completion/handover authority。
  - D05-B: `NOT_STARTED/PICKING/COMPOUNDING/PACKAGING/DISPENSING_COMPLETE/AUDIT_PENDING/AUDIT_REJECTED/AUDIT_COMPLETE/COUNSELING_PENDING/HANDOVER_COMPLETE/CANCELLED` transition、barcode/GS1/weight/image/tablet/powder audit、reject/rework/redispense/waste/incident/near-miss。
  - D05-C: packaging/inspection/scale/scanner/printer/POS device adapter events、capability/health/local retry/simulator。
  - D05-D: wrong patient/drug/lot, double scan, device offline, duplicate event, segregation-of-duty, traceability and medical-safety tests。
- [!] WP-0054-D06 Clinical Safety / Prescription Audit(BLOCKED_GATE0、P0、R4)
  - D06-A: duplicate/class/component、contraindication/interaction/allergy/adverse reaction/disease、age/weight/renal/hepatic/pregnancy/lactation、dose/duration/route、high-risk/controlled drugs、OTC/supplement/other-provider data registry。
  - D06-B: deterministic approved knowledge base、severity、unknown/not-checked/no-issue分離、override reason、warning vs claim blocker、external/e-prescription check provenance。
  - D06-C: DetectedIssue/Task/Communication UX、progressive disclosure、alert fatigue measurement、rule/version/effective-date explainability。AI final judgment禁止。
  - D06-D: sensitivity/specificity reference set、boundary/renal/dose tests、override audit、stale knowledge fail-closed、pharmacist/medical authority review。
- [!] WP-0054-D07 Calculation Engine(BLOCKED_GATE0、P0、R4)
  - D07-A: `Canonical Input → Master Resolution → Prescription Grouping → Candidate Fee Extraction → Rule Evaluation → Exclusion / Limit Resolution → Point Calculation → Copayment / Public Expense / PMH → Claimability → Calculation Trace` pipeline。
  - D07-B: candidate/final、required record、薬歴整合、facility snapshot、monthly/patient limits、cross-reception aggregation、selected care/tax/public priority/PMH/provisional/recalculation/refund candidate。
  - D07-C: reform simulation、event reprojection、result comparison、patient explanation。FHIR Referenceを持つがFHIRをbilling authorityにしない。
  - D07-D: pure/deterministic integer-decimal、evidence/rule/master/claim-month/effective-date、golden/property/official examples、backward replay。
- [!] WP-0054-D08 Claim Lifecycle(BLOCKED_GATE0、P0/P1、R4)
  - D08-A: target extraction/precheck/monthly snapshot/finalize/lock/e-claim generation、record-condition/format/ASP、handoff/send/receipt result authority。
  - D08-B: reduction/return/resubmit/review/withdraw/cancel、return CSV/reason structure、before-after diff、cross-month correction、immutable original and no auto-overwrite。
  - D08-C: remittance import/reconciliation、normal vs resubmission、audit and action center。
  - D08-D: calculation/record/facility/eligibility/public/PMH/patient/prescription/master/FHIR/external/MVP-scope checks、official format/version golden tests。
- [!] WP-0054-D09 Accounting / Receivables / POS / Facility Billing(BLOCKED_GATE0、P0/P1、R4)
  - D09-A: append-only `Charge/Payment/PaymentAllocation/Refund/Adjustment/WriteOff/Invoice/Receipt/Closing`、calculation separation、cash/card/e-money/QR/transfer。
  - D09-B: partial/unpaid/overpayment/refund/difference/cancel/correction、invoice/receipt/detail/reissue、facility receivable/monthly/patient breakdown/bulk allocation。
  - D09-C: POS/OTC/general goods/self-medication tax/consumption tax、daily close/cash variance/journal/accounting export、fee separation。
  - D09-D: LOCAL_ONLY number uniqueness、partial receipt、original/reissue/cancel、double-ledger prevention、concurrency/reconciliation/restore tests。
- [!] WP-0054-D10 Documents / Legal Records(BLOCKED_GATE0、P0、R4)
  - D10-A: receipt/detail/dispensing record/bag/drug info/notebook/medication info/inquiry/home plan/report/facility invoice/unpaid/return/claim/daily cash/master/audit/disclosure/migration/BCP catalog。
  - D10-B: DocumentReference/Composition/Binary、template/master/rule version、hash/signature candidate、issued-to/print/e-delivery/reissue/disposal provenance。
  - D10-C: authenticity/readability/preservability、legal hold、retention effective-date registry、access/export/redaction、paper coexistence。
  - D10-D: pixel/content/hash reproducibility、old-template rendering、migration readability、restore、print failure/idempotency、legal/privacy review。
- [!] WP-0054-D11 Inventory / Procurement / Traceability(BLOCKED_GATE0、P1、R4)
  - D11-A: adopted/current/bulk/package/unit-dose、receipt/dispense/adjust/count/order/delivery/shortage/reserve/preparation、lot/expiry/cold/controlled/return/waste/recall authority ledger。
  - D11-B: reserve before dispense、confirm event posting、cancel/rework reverse entry、inter-store transfer/share/facility allocation、stockout/alternative no auto-reject。
  - D11-C: dead stock/ABC/turnover/expiry/recall/action center、automatic order/demand forecast suggestion-only。
  - D11-D: GTIN/lot/expiry trace、PMDA source rights/hash、negative/concurrent inventory policy、count/reconcile/recall drill/event idempotency tests。
  - event catalog: `inventory.received`, `inventory.reserved`, `inventory.dispensed`, `inventory.adjusted`, `inventory.transferred`, `inventory.expiry_warning`, `inventory.recall_detected`, `inventory.wasted`, `inventory.stockout`。event名、payload、authority、idempotency key、reversal、FHIR ReferenceをD11-A/Bで確定する。
- [!] WP-0054-D12 Device / Edge Integration(BLOCKED_GATE0、P1、R4)
  - D12-A: qualification/card, QR/OCR/barcode, audit/packaging/scale, printers, POS/payment, reception/display/locker/delivery/signature capability registry。
  - D12-B: device adapter→normalized technical/clinical-reference event、NSIPS Legacy/JAHIS Official isolation、vendor logic Core leakage=0。
  - D12-C: simulator, health, local queue/retry/dedup, signed driver/config/version, remote diagnostics and support approval。
  - D12-D: unplug/reconnect/partial print/duplicate scan/clock drift/update rollback/unsafe device response/security/supply-chain test matrix。
- [!] WP-0054-D13 Eligibility / PMH / e-Prescription(BLOCKED_GATE0、P0、R4)
  - D13-A: eligibility/card/smartphone/credential、coverage/share/limit、medication/medical/checkup consent、一括/claim-precheck/disaster/manual/final snapshot/insurance diff。
  - D13-B: PMH municipality/system/income/eligibility/effective/public priority、paper coexistence、non-participant、import/update history。
  - D13-C: e-prescription exchange number/receive/fetch/copy/check/refill/paper/HPKI/result/sign/send/retry/connect/self-check/error reason official adapter。
  - D13-D: external unavailable=pending、no fabricated success、device generation/capability/version matrix、official sandbox/conformance/fallback/audit tests。
- [!] WP-0054-D14 Home Care / Facility Operations / PH-OS(BLOCKED_GATE0、P2、R4)
  - D14-A: home/facility patient, visit/round/actual, delivery/set/residual/adherence/vitals/observation/emergency/night/route/task/photo/document authority。
  - D14-B: plan/report、doctor/care-manager/nurse/facility Communication、follow-up、facility billing/patient breakdown、offline visit workflow。
  - D14-C: yrese authoritative Patient/Coverage/MedicationRequest/Dispense/Medication/Allergy/Condition replicas and PH-OS authoritative Encounter/Statement/Observation/Issue/CarePlan/Task/Communication/Document sync。
  - D14-D: AI brief/report draft, pharmacist review, offline rebase/conflict, no multi-master, route/privacy/medical/facility reconciliation tests。
- [!] WP-0054-D15 Patient Engagement / Online / Delivery(BLOCKED_GATE0、P2、R4)
  - D15-A: pre-send/questionnaire/check-in/wait/ready/follow-up/online guidance/message/e-notebook/PHR/e-doc/payment link/patient portal/disclosure/consent/multilingual。
  - D15-B: same-day/carrier/locker delivery, tracking/handover, patient/representative verification, misdelivery/non-return handling。
  - D15-C: patient frontend API separation、FHIR Communication、LINE/partner adapter、app-independent fallback、minimum-PHI carrier contract。
  - D15-D: notification failure != counseling complete、identity/consent/accessibility/localization/delivery exception/audit/privacy/legal tests。
- [!] WP-0054-D16 Multi-store / Headquarters / Remote Input(BLOCKED_GATE0、P2/P3、R4)
  - D16-A: corporation/brand/store/setting/delegation、cross-store search/history with consent/purpose、HQ/remote/help、inventory/share/master/feature flag/rollout/merger model。
  - D16-B: HQ KPI(add-on/return/sales/generic/inventory/wait/unfinished/follow-up)、heterogeneous migration/aggregation、shift/time adapter。
  - D16-C: active store/patient fixed banner、input/checker separation、pharmacist confirm、device/IP/session/least-PHI、operation audit not screen recording。
  - D16-D: cross-tenant/store/role/consent/remote stale context、M&A merge/split、feature rollout/rollback、privacy/security/medical tests。
- [!] WP-0054-D17 Master / Terminology / Regulatory Change(BLOCKED_GATE0、P0、R4)
  - D17-A: drug/price/fee/comment/material/insurer/public/PMH/provider/pharmacy/practitioner/usage/JAHIS/FHIR terminology/facility/rule/template/claim/e-prescription/JP Core registry。
  - D17-B: download→signature/hash→format/schema/effective/ref-integrity→terminology/calculation/claim/FHIR/UI regression→stage/approve/prod/edge/audit/rollback pipeline。
  - D17-C: law/fee/Q&A/claim/JP Core/JAHIS/e-prescription/eligibility/PMH/recall/label/security watch, owner/SLA/impact notification。
  - D17-D: atomic activation, future/backdated effective date, edge skew, rollback/replay, source/license/SBOM and regression evidence。
- [!] WP-0054-D18 FHIR / API / Partner Ecosystem(BLOCKED_GATE0、P0/P3、R4)
  - D18-A: FHIR REST/CapabilityStatement/IG/JP Core/profile/extension/terminology/transaction/subscription and ownership from WP-0053/2210-2215 reuse。
  - D18-B: SMART/Bulk/CDS candidate、Control OpenAPI/webhook/event/partner registry、OAuth/OIDC/mTLS/scope/rate/deprecation/usage/audit/consent/purpose。
  - D18-C: public/partner/internal-control contract分類、clinical internal API禁止、UI dogfooding、sandbox/test patient/contract kit/SDK/export。
  - D18-D: FHIR validation/capability diff/backward compatibility/webhook retry/subscription recovery/tenant-purpose authorization/partner offboarding tests。
- [!] WP-0054-D19 Analytics / Quality / Management(BLOCKED_GATE0、P2/P3、R3)
  - D19-A: prescription/patient/new/wait/input/dispense/audit reject/handover/unfinished/follow-up/home/return/precheck/unpaid/refund/cash/inventory/generic/add-on/API/offline/conflict/AI KPI registry。
  - D19-B: numerator/denominator/exclusion/window/clock/source/owner/refresh/quality/tenant aggregation/suppression and reproducible projection。
  - D19-C: dashboard/action center/export、public availability/API SLO/sync/incident/change/anonymous claim-quality candidates。
  - D19-D: re-identification/legal/statistical review、gaming/unsafe ranking guardrails、AI non-evaluation、golden metric and late-event correction tests。
- [!] WP-0054-D20 Migration / Portability / Cutover(BLOCKED_GATE0、P0/P3、R4)
  - D20-A: patient/coverage/public/provider/practitioner/drug/usage/history/dispense/record/unpaid/inventory/PDF/audit/NSIPS/CSV/TXT/claim/FHIR inventory and mapping rights。
  - D20-B: code map/name match/dry-run/delta/parallel/cutover/rollback/legacy read-only/export and immutable migration certificate。
  - D20-C: counts/amounts/FHIR/code/unmigrated/missing/sample/claim rehearsal/accounting balance/inventory reconciliation。
  - D20-D: pharmacist/admin approval、no hidden loss/no PDF-as-complete、exit portability、repeatable synthetic rehearsal and production human gate。
- [!] WP-0054-D21 Security / Operations / Support / Reliability(BLOCKED_GATE0、P0/P1、R4)
  - D21-A: MFA/RBAC/ABAC/least privilege/break-glass、device/network/remote/MDS-SDS inventory、AuditEvent/CloudTrail/masking/KMS/secrets/cert/vulnerability/SBOM/scans/pentest/supply chain/retention/disposal/incident/reporting。
  - D21-B: in-app/context help/runbooks/self-diagnostic/Edge-device-adapter test/approved remote support/case/SLA/status/maintenance/release/known issue/flag/rollback。
  - D21-C: Multi-AZ/Edge/offline/outbox-inbox/blue-green/canary/expand-contract/PITR/DR/RTO-RPO/SLO/error budget/chaos/restore/external isolation。
  - D21-D: MHLW v7.0 + FY2026 unified checklist control/evidence mapping、backup restore/DR/local-only/incident drill、zero hidden skip、human security/privacy/ops approval。
- [!] WP-0054-D22 Amazon Bedrock AI Assist(BLOCKED_GATE0、P2、R4)
  - D22-A: mandatory visit brief/in-visit aid/report/patient/prescription/interprofessional summaries; high-value residual/adherence/follow-up/share/inquiry/FHIR explanation/SSOT RAG/support/accounting explanation/quality/task candidates。
  - D22-B: input minimization/de-identification eligibility、model/region/inference profile/retention/guardrail registry、prompt/output version、Provenance Draft、human reviewer/expiry。
  - D22-C: AI cannot calculate/claim/change prescription/finalize audit/send externally; timeout/denial/EOL/quota/region outage falls back without workflow block。
  - D22-D: PHI/data-residency/legal/security model approval、prompt injection/exfiltration/hallucination/unsafe suggestion/red-team、accept/reject/correction metrics、model migration rehearsal。

### 横断計画(§27〜35)

- [~] WP-0054j Medical UX system and three critical journeys(PLAN_READY、HUMAN_UX_REVIEW_BLOCKED)
  - evidence/result(2026-07-16): WP-0054g artifactでshared command/state/audit、7 context header、7 orthogonal state axis、journey A01〜A16/B01〜B12/C01〜C12、keyboard/accessibility/error prevention、synthetic usability protocolまで計画済み。prototype実装と適合宣言はGate 1再発行とhuman UX/accessibility/pharmacist reviewまで禁止。
  - Guided/Expertを別state machineにせず、受付→会計、月次請求、yrese→PH-OS訪問の同一domain state上のpresentationとする。shortcut/command palette/continuous input、manual-free novice path、固定patient/store/month、pending/final labels、offline affordanceをprototype + usability protocol化する。
- [~] WP-0054k Performance budget / SLO calibration(PLAN_READY、REAL_DEVICE_BASELINE_BLOCKED)
  - evidence/result(2026-07-16): WP-0054g artifactで34 KPIのnumerator/denominator/clock/authority/exclusionとinteraction/business latencyの分離、candidate SLOのconflictを登録済み。WP-0054h artifactでcapability別RTO/RPO・external fallbackと接続。SLO確定、error budget運用、品質公開はreal-device/Edge/load baselineとhuman operations/product/statistics approval後のみ。
  - candidate: interaction p95 300ms、patient search 500ms、prescription/calculation/accounting 1s、QR mapping 1.5s。実機/Edge/network/data-volume/tenant別baseline、測定点、cold/warm、error budgetを決めるまでSLOと宣言しない。
- [~] WP-0054l Common module convergence(BOUNDARY_PLAN_READY、SSOT_AMENDMENT_BLOCKED)
  - evidence/result(2026-07-16): WP-0054f artifactで5 layer/3 plane/22 domain/5 API class/40 WPのauthority・package・tenant/store境界とno-direct-DB/no-hidden-clinical-API/no-duplicate-authorityを定義。candidate packageは新設決定ではなく、Gate 1再発行時にexisting authorityとdependency directionを検証する。
  - existing authorities: `shared-kernel`, `money`, `date-time`, `trace`, `events`, `contracts`, `calculation`, `audit`を先に再利用する。candidate `fhir/terminology/patient-identity/prescription/dispensing/claim/accounting/documents/inventory/integration/edge-sync/security/ai/analytics/test-fixtures`はdependency/boundary review後のみ追加し、`shared-types`で既存authorityを複製しない。
- [~] WP-0054m SSOT creation/amendment order(ORDER_READY、PRC-007_HUMAN_APPROVAL_BLOCKED)
  - order 1: `rececon_comprehensive_feature_map`, coverage/priority/release gate/API boundary。
  - order 2: identity/reception/prescription/dispensing/safety/calculation/claim/accounting/document/inventory authority。
  - order 3: device/official adapter/home/patient engagement/multistore/master/FHIR/migration/security/AI。
  - order 4: UX/SLO/KPI/support/go-no-go。既存`go_no_go_checklist.md`等がある場合は新規重複を作らずAPPROVED docのcontrolled amendmentとする。

  Requested SSOT disposition (final path/status is decided by WP-0054a/b and PRC-007):

  | v0.7 requested name | disposition / existing authority candidate |
  |---|---|
  | `rececon_comprehensive_feature_map.md` | NEW index over D01–D22; it must not become a second product specification |
  | `competitor_feature_benchmark.md` | AMEND/RENAME decision against `docs/product/rececon_feature_benchmark.md` |
  | `feature_priority_matrix.md` | NEW derivative of WP-0054e; no normative rule content |
  | `patient_identity_policy.md` | NEW after D01 authority review |
  | `reception_workflow.md` | AMEND/derive from `docs/api/reception_queue_contract.md` without duplicate state authority |
  | `prescription_lifecycle.md` | NEW after D03/D04 mapping |
  | `dispensing_workflow.md` | NEW after D05 device/actor boundary review |
  | `clinical_safety_policy.md` | NEW index; individual rule evidence stays in approved registries |
  | `claim_lifecycle.md` | AMEND/compose `docs/claim/claim_scope_matrix.md` and `docs/architecture/claim_finalization_immutability_policy.md` |
  | `accounting_ledger_policy.md` | AMEND/compose existing `docs/accounting/*`; do not replace their approved authorities silently |
  | `document_and_record_policy.md` | NEW with law-version and retention registry dependencies |
  | `inventory_ledger_policy.md` | NEW after D11 event/accounting boundary approval |
  | `device_adapter_registry.md` | AMEND/derive from `docs/operations/device_compatibility_matrix.md` and adapter inventories |
  | `patient_engagement_policy.md` | NEW after consent/delivery/online-guidance legal review |
  | `headquarters_multistore_policy.md` | NEW after tenant/store/privacy authority review |
  | `regulatory_change_watchlist.md` | AMEND/RENAME decision against `docs/regulatory/version_watchlist.md` |
  | `migration_cutover_policy.md` | AMEND/compose `implementation_migration_plan`, `legacy_rececon_migration_matrix`, and `parallel_run_and_cutover_plan` |
  | `support_operations_policy.md` | AMEND/RENAME decision against `docs/operations/support_operations_model.md` |
  | `quality_kpi_registry.md` | AMEND/compose existing public/claim KPI policies; definition authority must remain singular |
  | `medical_ux_acceptance_criteria.md` | AMEND/compose `docs/uiux/usability_acceptance_criteria.md`, principles, workflow, and performance budget |
  | `release_gate_policy.md` | CREATE only if no indexed authority exists after WP-0054b; align review gate matrix and construction spec |
  | `go_no_go_checklist.md` | AMEND existing `docs/operations/go_no_go_checklist.md` through PRC-007 |

  - evidence/result(2026-07-16): WP-0054i packetでBatch A〜Dの依存順、existing-authority-first、new/index/amend/composeの処分、PRC-007 atomic activationを明示。APPROVED SSOTは未改変で、packet承認とindependent verificationなしに個別発効しない。
- [~] WP-0054n Human review matrix(R4)(ROUTING_READY、HUMAN_DECISION_REQUIRED)
  - pharmacist: identity/prescription/dispensing/safety/home/UX。claim practitioner: calculation/claim/public/PMH/accounting。legal/privacy: consent/retention/e-delivery/remote/AI/portability。FHIR: profile/terminology/API/sync。security/ops/data: auth/Edge/device/restore/migration/multistore/Bedrock。各reviewはdecision, dissent, evidence, approver role, date, expiryを残す。
  - evidence/result(2026-07-16): WP-0054i packetで11 authority/review routeとHD-01〜18をscope/evidence/decision/dissent/approver/date/expiry付きで定義。current completionは0/18であり、Codexは代理承認しない。
- [!] WP-0054o Release Gate 1〜5 execution train(BLOCKED_WP-0054i、R4)
  - evidence/result(2026-07-16): WP-0054eで40 bounded WP/83 edge、cycle=0、unknown endpoint=0、Gate ancestry bypass=0、WP-0054fで40/40 boundary mapping、WP-0054iでGate 0〜5 exitとGate 1 reissue templateを定義済み。execution trainは未計画ではなく、G0-01〜07がPASSでなくG0-08 reissue=0のためfail-closedで停止中。
  - Gate 1 Foundation: WP-0053/6004/5009/2210、Patient/Prescription/Master/Audit/Auth/Edge skeleton/Calculation skeleton/UI shell。
  - Gate 2 Single-store Regulatory MVP: D01/03/04/07/08/09/10/13/17/20/21のP0 slices、LOCAL_ONLY、migration、golden tests。
  - Gate 3 Production-ready Commercial MVP: D02/05/08-return/09-receivable-POS/11/12/21 support-SLO-restore、parallel/go-no-go。
  - Gate 4 Home Care/Patient: D14/15/facility + D22 mandatory use cases。
  - Gate 5 Chain/Open: D16/D18 SMART-sandbox-SDK-Bulk + D19 advanced + D11 advanced transfer/forecast + M&A。
  - exact_next_action: HD-01〜18、exact official artifact promotion、PRC-007 atomic amendment、independent verificationを完了してG0-01〜07を全てPASSへ再評価した後だけ、G0-08でGate 1のexact scope/owner/verifier/rollback/demoを再発行する。
  - exit: each gate has 0 critical safety/claim defect、applicable golden/conformance 100%、rollback/restore evidence、independent verification、required human approval。candidate availability/SLO/KPI数値はbaseline後に承認する。
- [!] WP-0054q Itemized v0.7 semantic requirement inventory(BLOCKED_SOURCE_RAW、R3)
  - scope: v0.7の全bullet・列挙機能・明示原則を1行1 requirement IDに分解し、source locator、domain、priority、target WP/SSOT/human gate、duplicate/unsupported statusへ追跡する。
  - evidence/root_cause: `docs/research/rececon_v0_7_independent_verification_20260716.md` VF-01。現在は§1〜38構造mappingと90 representative requirementのみで、itemized `unmapped=0`を証明できない。tracked repo、git history、text attachmentにv0.7 byte-preserving rawがない。
  - acceptance: versioned rawまたは明示human-accepted normalized transcriptionがsourceとしてhash固定され、unique requirement ID、source coverage、target existence、unmapped=0、duplicate-authority=0を機械検査し、independent verifierがPASSする。
  - stop/next: 会話表示からraw byte/hashを捏造しない。ユーザーからversioned fileを受領するか、normalized transcriptionのsource gapをproduct/spec authorityが明示受容するまでBLOCKED。
- [~] WP-0054p G0-02a MHLW Security GL 7.0 exact-artifact manifest(LOCAL_LANDED、INDEPENDENT_PASS、HUMAN_PROMOTION_BLOCKED、R4)
  - scope: MHLW Security Guideline 7.0の5編、FY2026医療機関/薬局checklist PDF/manual/2 workbook、策定noticeの計10 artifactをofficial landingから一時取得し、resolved URL、HTTP/MIME/bytes、SHA-256、title/version/date、rights/applicability/watchをnon-SSOT manifestへ固定する。
  - evidence/result(2026-07-16): `docs/research/mhlw_security_gl7_exact_artifact_manifest_20260716.md`。10/10 HTTP 200、PDF/OOXML signature、nonzero bytes、unique URL/hash、title/version/dateを確認。binaryはtempのみで削除済み。Q&Aはofficial pageが改版中と明記するため`NOT_INCLUDED`。rights=`LICENSE_HUMAN_REVIEW_REQUIRED`、applicability=`CANDIDATE_NOT_PROMOTED`、evidence promotion=0。
  - commit/verification: artifactとplan entryは`9840ed5`でpush済み。read-only independent verifierが公式10 URLを再取得し、final URL、exact MIME、bytes、SHA-256を10/10一致、ID/URL/hash一意、repo binary 0、promotion/APPROVED/compliance過大主張なしとしてPASS。G0-02/CPL-015は10/10、G0-07は9 guideline/checklist artifact、策定noticeはG0-03へmapping。
  - acceptance/stop: 10 rowのID/URL/hash一意性、MIME/signature、landing label、watch、CPL-015/G0-02/G0-07 mapping、no binary/no APPROVED/evidence_id発行を機械検査。license/applicability/control mappingの人間承認とindependent re-retrievalまでREG/SEC昇格・runtime実装・準拠宣言を禁止。

### v0.7 Requirement Coverage Audit

| v0.7 sections | mapped plan |
|---|---|
| §1–2 conclusion/principles | WP-0054 invariants, WP-0054f/h/j/l |
| §3 vendor signals | WP-0054c and Evidence baseline |
| §4–26 22 domains | WP-0054-D01 through WP-0054-D22 |
| §27 UX/SLO/journeys | WP-0054g/j/k |
| §28 priority | WP-0054e, each domain P0–P3, WP-0054o |
| §29 release stages | WP-0054i/o |
| §30 dependencies | WP-0054e/f and domain A–D ordering |
| §31 team allocation | AGT-018 normalization note, WP-0054n; obsolete model routing is not carried forward |
| §32 common modules | WP-0054l |
| §33 new SSOT | WP-0054m; existing documents are amended rather than duplicated |
| §34 KPI | WP-0054g/k and D19 |
| §35 stop conditions | WP-0054 stop gates below |
| §36 initial output | WP-0054a-i and this coverage audit |
| §37 references | WP-0054c evidence registry |
| §38 product message | WP-0054 outcome and Gate 5 exit |

### v0.7 Stop gates

1. FHIR/JP Core Clinical authorityを崩す、clinical DTO/DB/adapter formatを正本化する、処方/調剤/服用を混同する変更は停止する。
2. 算定/請求/e-prescription/eligibility/PMH/保存/配送のofficial evidenceまたはhuman authorityがない場合は実装しない。
3. Calculationとaccounting ledger、unpaidとreceipted、provisional/pendingとsuccessを混同する変更は停止する。
4. Cloud/AI/external outageで全業務停止、LOCAL_ONLY/recovery/restore/security mapping/migration scopeなし、未検証backupはGateを通さない。
5. vendor closed behaviorの模倣、direct DB integration、CoreへのJAHIS/NSIPS/device leakage、同一concept/module/SSOTの重複を禁止する。
6. 高risk機能は現行AGT-018のindependent verifierとdomain reviewerに加え、該当human authority承認がなければ進めない。旧Claude/Opus/model名をapproval evidenceとして扱わない。
7. AIはDraft/assistに限定し、PHI eligibility、retention、Region、model lifecycle、human review、non-blocking fallbackが未確定ならclinical dataを送信しない。
8. 各Release Gateでrequirement→WP→SSOT→code→test→evidenceのmachine-auditable coverageを再計算し、unmapped、orphan implementation、duplicate authority、failing applicable gateが1件でもあれば停止する。

## v0.8 Detailed Specification Review (2026-07-16)

### Review decision and authority boundary

- [~] WP-0055 v0.8 detailed specification review(CHANGES_REQUIRED、DRAFT_NO_GO、BLOCKED_GATE0、R4)
  - review input: user-provided `yrese・PH-OS 詳細システム仕様書 v0.8`。本review時点の観測値は22 domain、234 unique MUST、66 acceptance ID、141 test ID、132 UI label。原要件IDの重複は0だが、既存APPROVED SSOT IDとの衝突、意味的重複、evidence、applicability、実装targetの完全性は未証明。
  - authority: v0.8は有用なDraft入力であり、`docs/spec/construction_prompt_v0.2.0.md`、APPROVED SSOT、WP-0054 Gate 0 packetを置換しない。runtime、DB、API、UI、package、SSOT activation、productionの権限は0。Gate 0は`NO_GO`、Gate 1 reissueは0、human decisionは0/18、VF-01はopenのままとする。
  - program boundary: 新しい並行programを作らず、既存WP-0054-D01〜D22、40 release WP、83 dependency edge、HD-01〜18、WP-0054a〜qへ接続する詳細traceability layerとして扱う。v0.8の追加価値は、機能scopeの再宣言ではなくMUST/API/event/UI/failure/error/acceptance/test/SSOT候補のitemizationである。
  - source limitation: 会話入力はreview sourceとして利用できるが、byte-preserving tracked artifactとhashではない。`234`はcurrent observed countであり、固定の法的・製品的要件数ではない。source capture後に再計算し、差異があれば台帳と本entryを更新する。
  - reviewer routing: fable5、Claude lane、Opus review、model固有execution modeはactive routingに採用しない。ユーザー指定のGPT-5.6はtechnical review要求として記録するが、実行環境でmodel identityを検証できない場合は`independent technical reviewer`という役割名を正本とする。root/sole maintainer、変更を行わないindependent verifier、該当domain reviewerでmaker/checkerを分離する。
  - human boundary: pharmacist、claims practitioner、legal/regulatory、FHIR/JP Core、privacy、security、data-integrity/DB、UX/accessibility、operations/product、statistics/qualityの人間authorityをtechnical reviewで代替しない。

### GPT-5.6 technical review findings

| Priority | Finding | Required correction | Existing authority / target |
|---|---|---|---|
| P0 | Draft本文のMUST、DoR、DoD、Release Gateがそのまま実装権限に見える | 全項目をresearch-only inventoryへ隔離し、authority=`0`、promotion status、human gateを明示する | WP-0054i/o/n、WP-0055a/g |
| P0 | 234 MUSTにofficial artifact、exact version/effective date、applicability、license、evidence ID、human decisionがない | 1要件1行でofficial sourceと現行SSOTへ接続し、unsupported claimを0にする | WP-0054c/d/p、WP-0055a |
| P0 | `CLM-*`、`ACC-*`、`MST-*`、`OPS-*`等のDraft IDが既存SSOT IDと衝突する | 原IDを`source_requirement_id`として保存し、台帳主キーを`V08-<domain>-<number>`へ名前空間分離する。既存SSOT IDは変更しない | `docs/ssot_index.md`、WP-0055a |
| P0 | CommonMetadata、status、error、EventEnvelope、`shared-types`候補が既存authorityと競合する | 各項目を`REUSE / MAP / AMEND_PRC007 / REJECT_DUPLICATE / HUMAN_DECISION`へ分類する | `shared-kernel`、`events`、`contracts`、WP-0054l、WP-0055b |
| P0 | `BLOCKED_MISSING_EVIDENCE`、`AI_DEGRADED`等が現行registryと一致しない | claimability、system mode、sync、verification、error/blockerをregistry単位で比較し、未知statusはfail-closedにする | WP-0054f/l、WP-0055b |
| P0 | FHIR/JP CoreとDomain/Edge/PH-OSのsingle-writer、Profile/MustSupport、canonical/package/version/historyが未固定 | producer/consumer/write owner、profile、missing-data、validation、versioning、CapabilityStatement declared-vs-runtime contractを固定する | WP-0054-D18、WP-0055c |
| P0 | DB更新、FHIR更新、AuditEvent、Outboxの原子性とambiguous outcome回復が未規定 | transaction boundary、transactional outbox、idempotency lifecycle、Inbox/dedupe/order/replay/reconciliation/quarantine/repairを定義する | WP-4050、WP-4151c、WP-4162、WP-0055d |
| P0 | role表とOAuth/mTLS記述だけではoperation×tenant×pharmacy×purpose×consent×data classを証明できない | deny-by-default authorization matrix、SMART/OAuth BCP、session/revocation/support/break-glass/export/webhook/log/key controlsを作る | WP-0054-D21、WP-0055e |
| P0 | AI必須機能とAI非依存継続の関係、PHI入力条件、provider/region/retention/training/guardrail/model lifecycleが未決定 | use-case別allow-list、non-AI fallback、grounding/schema、human approve/reject/undo、prompt-injection/evalを固定する。human gate前のclinical PHI invocationは0 | WP-0054-D22、HD-14、WP-0055e |
| P1 | 66 acceptanceと141 testは名称のみでexecutable oracle、fixture、command、environment、artifactがない | negative/concurrency/replay/recovery/tenant/privacyを含むtest manifestへ変換し、missing commandはFAILまたは根拠付きN/Aにする | WP-0055f |
| P1 | 132 UI labelにview ID、command、role/context/state/error/offline/keyboard contractがない | routeを132個作らず、`MERGED_REGION / DISTINCT_VIEW / DEFERRED / REJECTED`へ分類し、Guided/Expertのstate/API/audit差分を0にする | WP-0054j、WP-0055f |
| P1 | candidate SLOが既存候補と衝突し、RUM/business-latency/実機baselineがない | operation registry、測定境界、cold/warm、data volume、Edge/LAN、real-device baseline後だけPRC-007でSLO化する | WP-0054k、WP-0055f |
| P1 | DoDはlint/E2Eを要求するが、現行web script/CIでは実行可能Gateとして固定されていない | exact command、working directory、environment、artifact、timeout、ownerをGate manifestへ登録する | WP-0055f/g |
| P1 | 113 SSOT候補行（110 unique、重複3）が既存authorityと重複し得る | 新規作成せずWP-0054mのNEW/AMEND/RENAME/COMPOSE/REJECT dispositionへ吸収する | WP-0054m、WP-0055b |

### Official best-practice research baseline

以下は2026-07-16にofficial primary sourceで確認したcandidate external evidenceである。URLだけをSSOT/evidence IDにせず、WP-0054c/pのfingerprint、exact artifact、license/applicability、human promotionを経て利用する。

| Official source | Confirmed best practice | v0.8 correction / target |
|---|---|---|
| [MHLW 医療情報システムの安全管理に関するガイドライン 第7.0版](https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html) | 5編、checklist、BCPを分離して公開し、Q&Aは改定中であることを明示 | security/privacy/BCPを単一の宣言で済ませずartifact/control/evidence単位へ分解。既存WP-0054pを再利用 |
| [JP Core Implementation Guide 1.2.0](https://jpfhir.jp/fhir/core/1.2.0/guide-general.html) | FHIR R4を基盤とするJP Core 1.2.0 release IGとpackage/version/dependencyを明示 | `JP Core準拠`だけで完了にせず、exact package、derived profile、MustSupport、producer/consumer、validationをWP-0055cで固定 |
| [FHIR R4 CapabilityStatement](https://hl7.org/fhir/R4/capabilitystatement.html) | resource、interaction、profile、versioning、search、security capabilityを機械可読に宣言 | declared-vs-runtime contract testとnegative conformanceを追加 |
| [FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html) | transaction Bundle、conditional reference、If-Match/ETag、OperationOutcomeを定義 | atomic transaction、optimistic concurrency、partial/ambiguous failure recoveryをWP-0055c/dへ追加 |
| [FHIR R4 AuditEvent](https://hl7.org/fhir/R4/auditevent.html) | read/query/update等のsecurity auditを表現し、Provenanceと責務を分離 | AuditEventを通常業務resourceのように破壊更新せず、audit/provenance/eventの役割と原子性を固定 |
| [SMART App Launch 2.2](https://hl7.org/fhir/smart-app-launch/STU2.2/app-launch.html) | PKCE、state、audience、least-privilege scopeを要求 | Partner/portal/remote accessのauthorization flowとscope testをWP-0055c/eへ追加 |
| [OAuth 2.0 Security Best Current Practice RFC 9700](https://www.rfc-editor.org/info/rfc9700/) | authorization code/token replay対策と権限制限をcurrent BCPとして整理 | OAuth2/OIDCという名称だけで完了せず、flow、PKCE、sender constraint、rotation/revocation、negative testsを固定 |
| [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) | security scheme、webhook、callbackを含むmachine-readable contract | current generated OpenAPI 3.1.0との互換性reviewなしにpatch versionを上げず、contract-first/generator/conformanceを固定 |
| [AWS Transactional Outbox Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | DB更新とeventを同じtransactionに保存し、consumerをidempotentにする | Outbox/Inboxの原子性、順序、重複、retry、reconciliationをWP-0055dのacceptanceへ追加 |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | keyboard、focus not obscured、target size、redundant entry、accessible authentication、error preventionを規定 | UI共通文をview/command/testへ変換し、screen reader/zoom/forced colors/keyboardをjourney testへ追加 |
| [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) | secure practiceをSDLC、review、release evidenceへ統合 | securityを末尾checklistにせずDoR/DoD/Gate manifestへ接続 |
| [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | GenAI riskをgovern/map/measure/manageのlifecycleで扱う | use-case inventory、evaluation、incident、model change、human oversightをWP-0055eへ追加 |
| [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-how.html) | input/output双方でcontentとsensitive informationを評価できる | Guardrail名の記載だけでなくversion、input/output policy、block/fallback、audit、test corpusを固定 |

### Review-closure work packages

- [!] WP-0055a v0.8 source capture and itemized requirement ledger(BLOCKED_SOURCE_CAPTURE、P0、R3)
  - scope: byte-preserving source artifactとSHA-256をresearch areaへ固定し、sourceからMUST/acceptance/test/UIを機械抽出する。production/clinical dataは含めない。
  - ledger fields: `v08_requirement_id`、`source_requirement_id`、source locator、normative text、domain、priority、existing Dxx/WP/SSOT、official artifact/version/applicability、evidence status、authority、duplicate/conflict、human gate、acceptance/test target。
  - acceptance: current observationの22 domain/234 MUST/66 acceptance/141 test/132 UIをsourceから再計算し、全source rowのlocator coverage=100%、namespaced ID unique=100%、target existence=100%。`unmapped=0`はindependent verification後だけ宣言する。
  - stop: source未固定のまま件数を220等へ切り詰めない。v0.8 rawをAPPROVED SSOTへ昇格しない。
- [!] WP-0055b normative registry, SSOT candidate, and routing reconciliation(BLOCKED_WP-0055a、P0、R4)
  - scope: CommonMetadata、sync/verification/claimability/system mode、error/blocker、EventEnvelope、package、API、113 SSOT候補行（110 unique、重複は`device_adapter_registry.md`、`patient_notification_policy.md`、`data_portability_policy.md`）、legacy routingを既存authorityへdispositionする。
  - acceptance: 全candidateが`REUSE / MAP / AMEND_PRC007 / REJECT_DUPLICATE / HUMAN_DECISION`のexactly one、duplicate authority=0、unknown success state=0、APPROVED SSOT silent replacement=0、active fable5/Claude/Opus routing=0。
  - stop: PRC-007 atomic amendmentとhuman approval前に新status/error/package/SSOT authorityをruntimeへ追加しない。
- [!] WP-0055c FHIR/JP Core/SMART/OpenAPI conformance contract(BLOCKED_EVIDENCE_AND_HUMAN_FHIR_REVIEW、P0、R4)
  - scope: exact package/canonical/profile/MustSupport、producer/consumer/single writer、identifier/version/history、CapabilityStatement、OperationOutcome、transaction/If-Match、Terminology、SMART/RFC 9700、OpenAPI compatibilityを固定する。
  - acceptance: profile/resource/operation単位のdeclared-vs-runtime matrix、positive/negative conformance、roundtrip、authorization、backward compatibility、missing-data behaviorを機械実行し、unknown profile/terminology/tenant-purpose accessはfail-closed。
  - stop: WP-0054-D18のhuman FHIR reviewとofficial artifact promotion前に`JP Core準拠`またはPartner production-readyを宣言しない。
- [!] WP-0055d transaction, audit, and offline recovery integrity(BLOCKED_DATA_INTEGRITY_REVIEW、P0、R4)
  - scope: aggregate/resource single writer、DB/FHIR/AuditEvent/Outbox atomicity、idempotency key lifecycle、ambiguous external result、Inbox/dedupe/order/replay/reconciliation/quarantine/repair、LOCAL_ONLY番号とledgerを定義する。
  - acceptance: crash point/retry/reorder/duplicate/conflict/recovery property testsでlost update=0、double financial/inventory effect=0、false success=0、audit gap=0。WP-4050/WP-4151c/WP-4162のopen gapと同じauthorityへ統合する。
  - stop: last-write-wins、送信推測、未確認success、append-only ledger破壊更新を禁止する。
- [!] WP-0055e security, privacy, AI, and operations control matrix(BLOCKED_HUMAN_SECURITY_PRIVACY_AI_REVIEW、P0、R4)
  - scope: operation×role×tenant×pharmacy×purpose×consent×data-class、auth/session/token/support/break-glass/export/webhook/log/key/region/retention、AI use-case/input/output/model/guardrail/fallback/evaluationを定義する。
  - acceptance: deny-by-default matrix coverage=100%、cross-tenant/purpose/consent bypass=0、PHI log=0、unauthorized export/support=0。AIはnamed use caseごとにinput allow-list、grounding/schema、human approve/reject/undo、prompt-injection test、non-AI fallbackを持つ。
  - stop: HD-14とprovider/region/retention/training/guardrail/human-review decision前のclinical PHI invocation=0。AIは算定、請求、処方変更、監査、会計、外部送信を確定しない。
- [!] WP-0055f UI/view, executable acceptance, and performance evidence(BLOCKED_VIEW_AND_MEASUREMENT_CONTRACT、P1、R3)
  - scope: 132 UI labelをview/region/commandへ分類し、fixed context、role、state axis、error/offline/recovery、keyboard/accessibility、66 acceptance、141 test、performance operation registryへ接続する。
  - acceptance: UI 132/132 classified、unmapped=0、duplicate view authority=0、Guided/Expertのdomain state/API/audit diff=0。testはexact command/environment/oracle/artifactを持ち、missing applicable commandはFAIL。WCAG 2.2 journey、screen reader、zoom、forced colors、keyboard-only、destructive/error-preventionを含む。
  - performance: PHI-free RUM/business latency registryとreal-device/Edge/LAN/data-volume/cold-warm baseline後だけcandidateをSLOへ改版する。baseline前は`CANDIDATE_NOT_SLO`。
- [!] WP-0055g Gate 0 packet revision and reissue(BLOCKED_WP-0055a-f_AND_HUMAN_18_OF_18、P0、R4)
  - scope: WP-0055a〜fのverified resultを既存WP-0054i Gate 0 packetへ差分統合する。別Gate authorityを作らない。v0.7とv0.8のsource/version provenanceを分離し、v0.8 source captureをWP-0054qのv0.7 raw recoveryまたはVF-01 closureの代替にしない。
  - acceptance: G0-01〜07=PASS、WP-0054qのv0.7 source recoveryとVF-01/related verification findings=CLOSED、v0.8 source capture independently verified、official evidence promotion complete、PRC-007 atomic amendment approved、human HD-01〜18=18/18、independent technical verification=PASS。続いてのみG0-08でGate 1のexact scope/owner/sole maintainer/verifier/rollback/demoを再発行する。
  - stop: GPT-5.6 technical reviewまたは他のmodel名をhuman approvalの代替にせず、rootは自己承認しない。

### v0.8 review stop gates

1. v0.8はDraft inputであり、WP-0055g完了までimplementation authority=0、production authority=0、evidence promotion=0、Gate 0=`NO_GO`を維持する。
2. sourceから再計算した全MUST、acceptance、test、UIがnamespaced inventoryへ入り、source/target/evidence/human gate coverageをindependent verifierが確認するまでruntimeへ転記しない。
3. status、error、blocker、EventEnvelope、FHIR profile、package、API、SSOT候補はretain/map/amend/reject/human decisionを完了し、duplicate authority=0になるまで新authorityにしない。
4. AI clinical PHI、official adapter、claims/calculation/accounting rule、migration apply、external send、certificate/secret、deploy/restore/failover/publicationはaction-specific human approvalなしに実行しない。
5. GPT-5.6 technical reviewはpharmacist/claims/legal/FHIR/privacy/security/data/accessibility/operations/product authorityを代替しない。
6. JAHIS/NSIPS等のrestricted specificationやvendor behaviorを無許諾で取得・複製・推測実装しない。
7. applicable Gateのcommand、environment、oracle、artifactが欠落する場合はPASSにせずFAILまたはhuman-approved N/Aとする。
8. requirement→WP→SSOT→code→test→evidence coverageにunmapped、orphan implementation、duplicate authority、unsupported compliance claim、failing gateが1件でもあれば停止する。

### v0.8 Functional Specification Variant Reconciliation (2026-07-16)

#### Decision and source lineage

WP-0055 addendum status: `CHANGES_REQUIRED / DRAFT_NO_GO継続 / CODEX_ONLY_REVIEW`。これは`Plans.md`内の既存WP-0055に対する補足であり、同じIDの別Work Packageを発行しない。

  - decision: 今回入力された`yrese・PH-OS 詳細機能仕様書 v0.8`は、既存WP-0055がreviewした`yrese・PH-OS 詳細システム仕様書 v0.8`を上書きしない。同じ版名だがtitle、requirement unit、count、本文可用性が異なるため、raw-to-raw比較まで別source variantとして扱う。
  - routing: fable5、Claude、Opus、model固有mode/laneはactive owner、approver、reviewer、Gate evidenceに使用しない。Codex root、sole maintainer、変更を行わないCodex independent verifier、Codex domain reviewerをtechnical roleとし、pharmacist/claims/legal/FHIR/privacy/security/data-integrity/accessibility/operations等のhuman authorityを別Gateとして維持する。
  - authority: 両variantともDraft inputで、implementation/SSOT/API/DB/UI/package/production authority=0。Gate 0=`NO_GO`、Gate 1 reissue=0、human decision=0/18、WP-0054q/VF-01=openを変更しない。

| source_variant_id | observed source / temporary locator | observed inventory | byte-preserving artifact | relationship |
|---|---|---|---|---|
| `V08-R1-DETAILED-SYSTEM` | user-provided `詳細システム仕様書 v0.8`; conversation observation `obs_00mrneqc828e0269a94a1a9e32` (`UNVERIFIED_CONVERSATION_SOURCE`) | 22 domain / 234 unique MUST / 66 acceptance / 141 test / 132 UI label | missing; conversation observation only | `UNRESOLVED` |
| `V08-R2-DETAILED-FUNCTIONAL-SUMMARY` | user-provided `詳細機能仕様書 v0.8` summary; conversation observation `obs_00mrnfpwusce7e3c66406e3545` (`UNVERIFIED_CONVERSATION_SOURCE`) | 22 domain / `approximately 178` use-case claim; individual IDs/body/locator unavailable | `sandbox:/mnt/data/yrese_phos_detailed_functional_spec_v0_8.md` is not present in repository or accessible workspace path | `UNRESOLVED` |

`approximately 178`は検証済み件数ではなくsource claimである。R1の234 MUSTとR2のuse caseは単位が異なり、算術差もsemantic deltaとして扱わない(`INCOMPARABLE_UNITS / NOT_A_DELTA`)。置換、追加、削除、要約関係のいずれもraw取得前に推定しない。`supersedes / extends / summarizes / conflicts`は全件crosswalkとsource authority判断後だけ確定する。

#### Variant delta findings

| Priority | Finding | Required disposition | Existing target |
|---|---|---|---|
| P0 | R2 raw、hash、exact use-case ID/本文/locatorがなく、約178件を再現できない | `source_variant_id`、title、created/generated time、SHA-256、source locator、unit、predecessor relationを固定し、R1/R2を個別抽出後にmany-to-many crosswalkする | WP-0055a |
| P0 | `PRE_RECEIVED → ... → PAYMENT_COMPLETE / UNPAID_RECORDED → HANDOVER_COMPLETE`が受付、本人/処方確認、調剤、監査、会計、交付を単一state axisへ混在させる | 各stateを`REUSE / PROJECTION_ONLY / MAP_TO_DOMAIN_EVENT / REJECT_DUPLICATE / HUMAN_DECISION`へ分類し、reception/identity/prescription/dispensing/audit/counseling/accounting/handoverの直交軸へ分離する | WP-0054-D02/D05/D09、WP-0055b |
| P0 | `CLAIM_CANDIDATE / VALIDATED / SNAPSHOTTED / FILE_GENERATED / HANDED_OFF / SETTLED`がR1とAPPROVED claim authorityのstate意味を置換し得る | owner、entry/exit、external authority、immutable snapshot、allowed transition、R1/current stateとのsemantic crosswalkを作り、外部hand-offとsubmitted/acceptedを混同しない | WP-0054-D08、WP-0055b/d |
| P0 | `Patient.link`がmerge/split完了手順のように読める | link assertionとmerge commandを分離し、survivor/non-survivor、identifier/Consent/Coverage、reverse reference、search、unlink/rollback、concurrency、auditを定義する | WP-0054-D01、WP-0055c/d |
| P0 | LOCAL_ONLYの「会計の許可範囲」と`PAYMENT_COMPLETE / UNPAID_RECORDED`がfinal/provisional/receipt/handoverを区別しない | Charge、Payment、Allocation、Receipt、Unpaid、Handoverをoperation単位で`FINAL / PROVISIONAL / PENDING / FORBIDDEN / RECOVERY_ONLY`へ分類し、二重効果・未入金領収・false success=0を証明する | WP-0054h、WP-0055d |
| P0 | 「必須AI」10機能がR1のmandatory/staged区分と異なり、`AI_DRAFT / FAILED / EXPIRED`がR2 summary stateから欠落する | use caseごとに`MANDATORY / STAGED / NON_AI_REQUIRED / REJECTED`、PHI allow-list、Region/retention/training、grounding/schema、approve/reject/undo、failure/expiry、non-AI fallbackを決定する | WP-0054-D22、WP-0055e、HD-14 |
| P0 | 主な利用者の記述だけではserver-side authorizationにならない | 全use caseにcommand/resource/action、tenant/pharmacy/patient scope、purpose、Consent/legal exception、data class、break-glass、AuditEvent、negative testを付与する | WP-0055e |
| P1 | 約178 use caseにexecutable acceptance/testが提示されていない | use-case→journey step→shared command/read projection→domain transition→view/region→acceptance/testを100% mappingし、orphan=0。ledgerに`risk_tier / required_test_layers / e2e_scenario_id / n_a_reason / n_a_approver`を持たせ、pure/property、contract/integration、bounded critical E2Eを機械判定する | WP-0055f |
| P1 | Guided/Expert、accessibility、performanceが旧laneの担当名に留まる | interactive use caseごとにshared `command_id`、presentation、focus/keyboard/status announcement/context/error recovery/mode switchを定義し、schema/validation/permission/idempotency/concurrency/resource version/state/API/audit/outcome diff=0。critical operationへPHI-free timerとreal-device baselineを接続する | WP-0054j/k、WP-0055f |

#### Official-source deltas found during review

以下はcandidate external evidenceであり、URL閲覧だけではSSOT/evidence promotionにならない。exact artifact、resolved URL、version/effective date、hash、license/applicability、human decisionをWP-0054c/pへ登録する。

| Official source | Review evidence | Required plan delta |
|---|---|---|
| [MHLW 電子処方箋システムベンダ向け](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/denshishohousen_systemvendor.html) / [電子処方箋の現況と令和7年度の対応](https://www.mhlw.go.jp/content/11121000/001428602.pdf) | 薬局の最小機能は受付/取消/回収/リフィル/重複投薬等check/同意/署名付き調剤結果登録/取消を分離する。要求成功後に応答を受け取れない場合の処方箋ID・調剤結果ID検索も示す | Official Adapterに`AMBIGUOUS_EXTERNAL_RESULT`、status inquiry、idempotent reconciliationを追加し、blind retry/成功推測を禁止する |
| [デジタル庁 PMH](https://www.digital.go.jp/policies/health/public-medical-hub) | 2026-07-15時点でAPI/ファイル設計、error code、制度master、checklist等が更新され、医療機関・薬局向け利用規約と利用開始条件も別artifact | PMHを静的master扱いせず、artifact family・更新日・利用規約・participation/applicability・Edge配布をversion watchへ登録する |
| [MHLW 医療費助成オンライン資格確認](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/iryouhijosei.html) | PMH仕様・PIA・利用規約のauthoritative artifactはデジタル庁側も参照し、参加自治体/施設の実運用状況と制度移管情報は別に管理される | MHLW/Digital Agency/自治体のsource authorityとeffective intervalを分離し、未参加・未確認をsuccessにしない |
| [FHIR R4 Patient](https://hl7.org/fhir/R4/patient.html) | `Patient.link`は同一人物を指す複数resource間のlinkage assertionであり、reference migration等の完全なmerge procedureではない | patient merge/splitをFHIR linkだけで完了扱いせず、identity graphと全reference consumerのcontractを追加する |
| [JP Core MedicationDispense 1.2.0](https://jpfhir.jp/fhir/core/1.2.0/StructureDefinition-jp-medicationdispense.html) | MedicationDispenseは処方を正当化するMedicationRequest参照、required status/identifier、量・daysSupply等のprofile制約を持ち、調剤workflow全体のTask状態とは別責務 | FHIR clinical factとoperational Task/audit/device stateを分離し、declared profile/search/identifier/roundtripをconformance test化する |
| [支払基金 電子レセプトの作成](https://www.ssk.or.jp/smph/seikyushiharai/iryokikan/iryokikan_02.html) / [レセ電通信](https://www.ssk.or.jp/smph/user_ippan/vendor/vendor_01.html) | 調剤の令和8年6月版記録条件/標準/返戻再請求仕様が公開され、2026-06-30にも記載要領変更に伴う調剤通知が出ている | claim month/effective interval、record-condition edition、master、notification watch、golden fixtureを一体管理し、summary例を算定根拠にしない |

#### Amendments to existing WP-0055 execution plan

- WP-0055a: R1/R2の2 source variantを別々にcaptureする。R2 raw取得前のuse-case count statusは`APPROXIMATE_UNVERIFIED`。R1/R2/v0.7のprovenanceを混ぜず、raw-to-raw crosswalk前に優先版を決めない。
- WP-0055b: reception、claim、AI、system/offline stateのvariant crosswalkを追加する。monolithic lifecycle enumを作らず、domain state、business fact、external result、UI projectionを分離する。
- WP-0055c: Patient merge/link/splitとMedicationRequest/MedicationDispense/Taskのwrite owner、profile、reference、search、version/history contractを追加する。
- WP-0055d: electronic-prescription ambiguous-result inquiry、LOCAL_ONLY accounting/handover、outbox/inbox reconciliationのcrash/retry/reorder/duplicate testsを追加する。
- WP-0055e: R2 use case全件のauthorization/purpose/Consent/data-class matrixとAI disposition/DPIAを追加する。clinical PHI invocation=0はhuman gateまで維持する。
- WP-0055f: exact R2 use case取得後に100% traceabilityを作る。各use caseのrisk tierと必須test layerを機械検証し、R4/finalization/offline recovery/cross-tenant/financial use caseはbounded critical E2Eまたはhuman-approved N/Aを要求する。Guided/Expertは同一commandとschema/validation/permission/idempotency/concurrency/version/audit/outcome、accessibilityはjourney acceptance、performanceはinteraction/business completion別operationとして検証する。
- WP-0055g: `R1/R2 precedence and relationship`をhuman source-authority decisionへ追加する。両variant、WP-0054q/VF-01、official evidence、PRC-007、HD-01〜18が閉じるまでG0-08を発行しない。

exact_next_action: WP-0055aでR1/R2を別sourceとしてbyte-preserving captureし、R2 raw取得またはhuman source-authorityによる明示的source-gap判断までcrosswalk、state adoption、SSOT amendmentを開始しない。

#### Additional stop gates

1. R2 raw file、SHA-256、exact use-case ID/locatorがない状態で`178/178`、`semantic delta=56`、superseded、completeを宣言しない。
2. reception/claim/AI stateを既存registryへ直接追加せず、orthogonal axisとsemantic crosswalkを先に承認する。
3. Patient.linkだけでmerge完了、external timeoutで未処理、PMH未参加自治体でverified、LOCAL_ONLYで入金/領収/外部送信成功を表示しない。
4. fable5/Claude/Opus/model modeをactive routingまたはapproval evidenceとして再導入しない。Codex technical reviewもhuman authorityを代替しない。

### WP-0055f Common Workbench UI/UX Layout Proposal (2026-07-16)

#### Decision

- [~] WP-0055f-UX yrese / PH-OS shared workbench layout(`PROPOSED / DRAFT_NO_AUTHORITY / HUMAN_UX_MEDICAL_REVIEW_REQUIRED / R3`)
  - artifact: `docs/research/rececon_v0_8_shared_workbench_layout_proposal_20260716.md`
  - decision: 22 domain共通の第一候補を**Evidence-rail workbench**とする。上部はtenant/pharmacy/system modeとpatient/claim month/facility-visit/versionのContext Lockbar、左は現在journey、中央は一つの主作業、右はblocker・直交状態・根拠のEvidence Spine、下部は安定したcommand領域とする。
  - information architecture: 22 domainまたは132 UI labelをtop-level route化しない。現行の業務順routeを維持し、各route内へ同じ`WorkbenchShell`を置く。132 UI labelは`MERGED_REGION / DISTINCT_VIEW / DEFERRED / REJECTED`へ分類し、queue/list、record detail、command workbench、comparison、issue review、configuration、analyticsのview familyへ集約する。
  - mode contract: Guided/Expertは同じcommand ID、schema、validation、permission、idempotency、concurrency、resource version、domain state、API、audit、outcomeを使う。差分は説明量、表示密度、focus初期位置、review/根拠への移動、競合review済みshortcutだけとし、finalize/reverseをshortcut一発で実行しない。
  - safety: `SYNCED / VERIFIED / REVIEWED / CLAIMABLE / FINALIZED`を統合しない。患者・薬局・version不一致、臨床BLOCKER、未確認、LOCAL_ONLY、外部障害を優先順で表示し、重大状態をdrawer/tab/toastだけへ隠さない。Context switchはdirty guard、再認可、resource version検証、auditを必須候補とする。finalize/reverseはcontext、scope、version、BLOCKER、human review、claimability、external verification、calculation/evidence、System mode、idempotency/concurrency、transactional audit/outboxをserver-sideで再評価し、1件でも失敗すればstateを進めない。
  - accessibility: semantic/DOM順を`GLOBAL → CONTEXT → ALERT/SAFETY summary → JOURNEY → MAIN → ACTIONS`とし、desktopではCSS Gridで三列配置する。200% zoomまたはnarrow containerでは重大状態を主作業より前に保つ単一列へreflowし、sticky領域によるfocus隠蔽、page全体の横scroll、色だけの状態表現を禁止する。
  - performance: shell/context/safety summaryを先に描画し、active main/safety projectionを並列取得する。22 domain moduleと全evidence detailを初期bundleへ含めず、unbounded queueを避ける。interaction-to-paintとauthoritative command completionを分け、実機/Edge/LAN/data-volume/cold-warm baseline前は`CANDIDATE_NOT_SLO`を維持する。
  - innovation brush-up: 製品固有要素をContext SealからEvidence Spine、FinalizeGate、次の安全な操作までを結ぶ**Safety Thread**へ集約し、末端の**Safe Next Beacon**に`いま / 次 / なぜ必要 / 完了条件`を表示する。これはauthoritative context/state/precondition/blockerの決定論的投影で、AI推奨、単一progress、自動実行ではない。iconはnavigation/action/context/evidenceのscan補助に限定し、status/offline/finalize/overrideは既存Visual Status Registryのvisible label+shape+toneを維持する。高頻度、keyboard、context/status/BLOCKERはmotion 0、低頻度popover/modalだけ200ms以下のtransform/opacity候補とする。
  - manual-free: `Safe Next Beacon / Fix Path / Context Seal / Stable Verb / Recovery in Place / Contextual Help`を画面内guidance contract候補とする。外部manualなしで正しい操作と回復ができることを目標とするが、安全確認、human review、FinalizeGate、offline制約は省略しない。coachmarkは任意・dismissible・再表示可能とし、critical context/alert/actionを覆わない。
  - authority: 本entryとartifactはWP-0055fのlayout proposalであり、新しいSSOT、screen inventory、status registry、API contract、実装権限ではない。APPROVED `docs/uiux`、`apps/web`、`packages/contracts`は未変更。Gate 0=`NO_GO`、implementation/production/SSOT authority=0を維持する。

#### Execution slices within WP-0055f

1. `UX-S1`: 132 UI labelをregion/view/command/role/context/state/error/offline/testへ100%分類する。
2. `UX-S2`: 実行可能codeを作らず、synthetic wireframe、Safety Thread / Safe Next Beacon、Clinical Icon Grammar、Quiet Motion matrix、screen/interaction specification、3 journey manual-free test protocol、200% zoom/reflow期待値だけを作る。
3. `UX-S3`: Context Lockbar、Evidence Spine、Safe Next Beacon、command/icon registryのread projectionを既存contract/status registry/componentへ`REUSE / AMEND_PRC007 / REJECT`候補分類する。runtime contract、dependency、status authorityは変更しない。
4. `UX-S4`: 受付事務、薬剤師、請求実務、在宅、UX/accessibility、privacy/securityがwireframe/specification/test protocolをreviewし、Safety Threadの単一progress誤認とmanual-freeによるguardrail省略がないことを確認する。
5. `UX-S5`: UX-S4後、採用差分だけをPRC-007 atomic amendment batchとして既存screen inventory、workflow map、必要なUI原則へ承認・反映する。続いてWP-0055gがWP-0055a〜f、official evidence、human decision、PRC-007を含む全Gate 0条件を再評価し、全件PASS後に限りG0-08でGate 1 exact scopeを再発行する。
6. `UX-S6`: Gate 1再発行とrequired human review後だけ、synthetic dataでshared shell、受付→交付、月次請求、在宅訪問の3 journeyとGuided/Expertをclickable prototype化する。
7. `UX-S7`: prototype independent verification後、shell → bounded critical journey → independent verification → 残journeyの順で実装する。

#### Candidate acceptance

candidate acceptance IDとpass conditionの唯一の記載先はartifact §15の`WB-AC-01..21`とし、本台帳では再定義しない。coverageはcontext/state、mode equivalence、keyboard/zoom、failure injection、inventory、FinalizeGate、privacy shield、manual-free、Safety Thread、Fix Path、icon grammar、Quiet Motion、combined accessibility、learnability safety guardrailを含む。

#### Stop gates and exact next action

1. WP-0055aでR1/R2をbyte-preserving captureし、R2 raw取得またはhuman source-authorityによる明示的source-gap判断とindependent verificationが完了するまで132 UI label分類を開始せず、`132/132 classified`を宣言しない。
2. human pharmacist/claims/UX-accessibility/privacy-security reviewとPRC-007前に本案をAPPROVEDまたはimplementation-readyとしない。
3. claim month、facility/visit、authority/versionのcontractをfixture fieldで仮実装しない。
4. narrow/zoom時にblockerをdrawerだけへ隠す案、Guided/Expert別API/state、22 domain別route、raw status色の追加を採用しない。
5. Gate後のlicense/security/performance/accessibility review前にicon/motion dependency、external CDN、icon font、画面単位の手書きSVG、runtime animationを追加しない。既存Visual Status Registryを新iconで置換しない。
6. PRC-007 atomic amendment approval、WP-0055gによる全Gate 0条件PASS、G0-08 Gate 1 exact scope再発行、required human design review前にclickable prototypeまたはruntime UIを実装しない。
7. exact next action: WP-0055aでR1/R2をbyte-preserving captureし、R2 raw取得またはhuman source-authorityによる明示的source-gap判断とindependent verification後、WP-0055f `UX-S1`で132 UI labelを本artifactのregion/view familyへread-only分類し、non-executable wireframe/test protocol scopeとhuman scenarioを再発行する。
