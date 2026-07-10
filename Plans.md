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

- [~] WP-9002 legacy SSOT frontmatter migration(IN_PROGRESS、W1/W2 LANDED、remaining 139、metadata-only、P1)

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

- [ ] WP-4050 reception audit event persistence boundary(codex 提案 SELF-SCAN-20260709-29、SEC-007高リスク隣接)
  - 発見根拠: MOD-008 v0.2.3 と `@yrese/audit` には `reception.created` / `reception.cancelled` が登録済みだが、WP-3009-BE/93aefa1 の `apps/api` は `POST /reception` の受付作成時に監査イベントを永続化・出力していない。`docs/uiux/stability_slo_policy.md` は「監査対象操作は監査ログ書き込み成功を操作完了条件にする」としており、監査台帳とAPI実装の間に配線境界が残っている。
  - 目的と現行routing: 受付作成・将来の受付取消を、監査イベント台帳だけでなくAPI実行時のaudit sinkへ接続する境界を定義する。Codex rootがmapper evidenceを基に、SEC-007/WP-2009未完了時のsynthetic in-memory/test adapterと本番BLOCKERを分離した計画を作り、pre-plan reviewerがAPPROVED SSOT・偽tamper-evidence禁止・fail-closed条件を確認してからsole maintainerへ割り当てる。
  - 想定スコープとreview gate: `docs/security/audit_log_design.md`または後続audit implementation plan、`apps/api`のaudit adapter interface、必要なら`packages/audit`の作成helper。実装後はindependent verifier、`security_critic`、`privacy_compliance_reviewer`、`medical_safety_reviewer`、`db_steward`、`data_integrity_auditor`がread-only reviewする。監査payload/retentionの法務判断、患者安全・薬局業務上の最終判断、production security/risk acceptance、migration/production writeはlegal/pharmacist/security/data-governanceのhuman authorityが別途承認する。
  - 検証: 受付作成成功時の audit event 生成/書込テスト、audit 書込失敗時の fail-closed テスト、PHIを audit payload に含めないテスト、`pnpm --filter @yrese/api test`, `pnpm --filter @yrese/audit test`, `pnpm check:boundaries`, `git diff --check`。

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

- [ ] WP-0020 calculation_engine_architecture.md: 9段パイプライン(入力検証→マスター解決→処方グルーピング→候補抽出→条件評価→点数計算→負担金計算→請求可否判定→出力)+ CalculationInput/Output 型仕様(mode・versions・外部確認状態を明示入力)。CAL-004 を包含・置換
- [ ] WP-0021 calculation_rule_dsl.md: ルールメタデータ仕様(rule_id / fee_item_code / effective_from・to / law_or_notice_ref / evidence_id / predicate / calculation_formula / exclusion_group / upper_limit / frequency_limit / required_records / required_facility_basis / offline_allowed / requires_human_confirmation / test_case_refs)。コード直書き禁止の根拠
- [ ] WP-0022 claimability_status_policy.md: 候補抽出と確定算定の分離ステータス(AUTO_CALCULATED / SUGGESTED_REQUIRES_CONFIRMATION / REQUIRES_PHARMACIST_CONFIRMATION / REQUIRES_RECORD / BLOCKED_MISSING_EVIDENCE / BLOCKED_UNSUPPORTED_CLAIM)— shared-kernel status_registry との整合必須
- [ ] WP-0023 calculation_trace_schema.md: trace拡張仕様(formula / intermediateValues / rounding{method, evidenceId} / status: applied|suggested|excluded|blocked)— @yrese/trace 現行実装からの拡張差分を定義
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
