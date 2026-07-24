# Plans.md — 調剤用レセプトコンピューター MVP タスク計画

構築プロンプト v0.2.0 / `docs/plan/phase0_plan.md` に基づく実行計画。
運用ルール: AGT-018 APPROVEDによりrepository-wideでCodex-only運用を適用する。活動単位ごとにsole Codex maintainerが実装し、independent verifier後にCodex rootだけがowned exact pathをcommitし、要求時にpushする。活動ログは`State.md`に記録。
高リスク領域(R3+)は根拠(evidence_id)未確認のまま実装しない — 「根拠不足を正しく検知して止まるコード」を優先する。

> [!IMPORTANT]
> **current routing (2026-07-10):** AGT-018 APPROVEDによりCodex root → read-only mapper → read-only pre-plan reviewer → sole maintainer → independent verifier + relevant specialists → root exact-stage landingをrepository全体へ適用する。本台帳のcompleted-historyに残る旧model名、旧role名、旧lane、旧message/approval名は当時のprovenanceであり、新規WPのowner/reviewer/gateとして再利用しない。

## ステータス凡例

- `[ ]` TODO / `[~]` IN_PROGRESS / `[!]` BLOCKED。`Plans.md`はactive taskのみを保持し、completed taskとそのattached historyは削除して`State.md`とgit historyへ記録する。`[x]` task entryは禁止する。

## Active governance cutover

- [!] WP-9002 legacy SSOT frontmatter migration(METADATA_LOOP_EXHAUSTED、W1-W31 + WP-9005/9006 LANDED、W32 NO_ELIGIBLE、WP-0020〜0023 ledger reconciled `6dff2a3`、remaining57=`semantic18 + human39` / metadata-safe=0 classification LANDED `e654938`、P1)

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

## Phase 0: 調査・計画(ドキュメント)

Phase 0 文書は実装と並行して整備する(ユーザー指示により実装開始が承認済み)。
ただし R3+ 実装の根拠となるSSOTは該当実装より先に APPROVED にする。

## Phase 2: 実装(承認済み範囲から着手)

### 基盤(shared / R0-R1)

### バックエンド(Codex sole maintainer所有 / apps/api)

- [ ] WP-2004 患者・保険・公費ドメインCRUD — patient read/searchはWP-2008/WP-5003で完了。残scopeは患者create/update/deleteとCoverage/PublicExpense CRUDであり、APPROVED SSOT/API contract後に実装する。
- [!] WP-2101 算定エンジン(公式点数根拠 evidence_id 未確認 → BLOCKED_REGULATORY_REVIEW。純粋関数の骨格・trace配線のみ先行可)
- [!] WP-2102 電子レセプト生成(記録条件仕様未確認 → BLOCKED_REGULATORY_REVIEW)
- historical alias: 旧 `WP-2103 Official Adapter` はID衝突により単独実行しない。オンライン資格確認・電子処方箋の仕様入手はWP-0016、電子レセプト出力/オンライン請求はWP-2102、JAHIS adapterはWP-2204、Legacy/Official Adapter ACLはWP-2213へ移管し、official evidence・regulatory/legal/pharmacist/privacy human gateを各移管先で維持する。

### フロントエンド(Codex sole maintainer所有 / apps/web)

#### UI/UX 開発計画(正本: docs/plan/uiux_development_plan.md = PLAN-UIUX-001。詳細・依存・品質ゲートは計画書に従う)

- [ ] WP-3022 SCR-002 類似候補区別(historical Opus review finding F2): カナ近似(長音・濁点ゆれ等)の差分強調。近似規則の定義が必要なため、AGT-018のread-only mapperとpre-plan reviewerがUIX系SSOT改版、誤選択edge case、test、human gateを先に確定し、APPROVED後にsole Codex maintainerが実装する。makerとは別contextのindependent verifier、`medical_safety_reviewer`、`privacy_compliance_reviewer`、`frontend_reviewer`、`accessibility_ux_reviewer`、`ui_flow_tester`を必須とし、人間薬剤師/患者安全authorityの確認を別gateとして保持する。同姓同名該当時の選択前確認(F6)を受入条件に含める。
- [!] WP-3010 SCR-026 LOCAL_ONLY モード UX(parent、BLOCKED_CAPABILITY_CONTRACT / foundationはWP-3010aで完了)— UI-2
  - [!] WP-3010b ARC-001 full capability/count/live-mode contract(BLOCKED_SSOT_UPDATE_REQUIRED): 28操作・LOCAL_ONLY絶対禁止16項目の機械可読単一正本、各modeの三値状態、実SystemMode供給、仮状態件数data sourceをAPPROVED化する。薬剤師・請求実務human review必須。
  - [!] WP-3010c reachable SCR-026 route / UI-flow(BLOCKED_ON_WP-3010b): route/navigation、live mode/count binding、Testing Library/browser viewport/keyboard/a11y flowを実装・検証する。
- [!] WP-3011 SCR-012 calculation_trace ビューア(parent、BLOCKED_LIVE_CONTRACT / foundationはWP-3011aで完了)— UI-3
  - [!] WP-3011b CAL-008 intermediateValues typed semantic/trust boundary(BLOCKED_SSOT_UPDATE_REQUIRED): `Record<string,string>`には数量・code・versionも含まれ、金額/点数keyを名前から推測して整数制約を掛けられない。live transport前にtyped key registry、producer責任、value PHI非包含の機械境界をAPPROVED SSOTで確定する。
  - [!] WP-3011c live calculation trace API / route integration(BLOCKED_API_CONTRACT): API-007のopen questionであるendpoint/key、`calculation:read` deny-by-default、tenant/pharmacy binding、response parse、live trace生成、reachable route/browser UI-flowを別契約で確定・実装する。
- [~] WP-3012 SCR-025 同期状態画面 — PARTIAL: `/sync-status` route shellとgeneric system health表示のみ実装済み。正規scopeのOutbox/Inbox rows、backlog/dead-letter、queue age、live source/API契約は未実装である。埋込mode capability/P-19 overviewはSCR-026系のcross-mode referenceであり、SCR-025達成やSCR-027の要再検証/競合解決実装を意味しない。
- [ ] WP-3013 SCR-024 外部連携状態 — UI-3
- [ ] WP-3014 処方・調剤 API 契約 SSOT パック起草 — UI-4(WP-3015/3016の発行条件)
- [~] WP-3015 SCR-004 処方入力 — PARTIAL: patient-context/未選択blockingと臨床alert未接続のfail-closed prescription workspace foundationのみ実装済み。紙/manual入力と処方APIはWP-3014、SCR-005 2次元symbolはWP-0035/WP-2204 + JAHIS evidence、SCR-006電子処方箋受付はWP-0016/必要なWP-2213 authorityへ分離し、本WPの解除条件へ吸収しない。
- [ ] WP-3016 SCR-010+014 調剤入力・薬剤師確認 — UI-4(WP-3014 APPROVED後)
- [ ] WP-3017 SCR-011 算定結果 — UI-5
- [ ] WP-3018 SCR-016+017 会計・未収 — UI-5(WP-2201契約が発行条件)
- [ ] WP-3019 SCR-018 帳票出力 — UI-5(WP-2202契約が発行条件)
- [ ] WP-3020 SCR-019 請求前点検 — UI-6(CLM系実装が発行条件)
- [~] WP-3021 SCR-020 月次締め — PARTIAL: `allowsClaimFinalization`によるmode-gate foundationは実装済み。締め処理・請求data lock・権限/data-state判定/APIはCLM系契約承認後。

### 横断

### データベース構築(正本: docs/plan/database_construction_plan.md = PLAN-DB-001。種別12+マスターM1〜M10+対象外3の台帳・段階計画・停止条件は計画書に従う)

- [~] WP-5004 監査ログ永続化 + ハッシュチェーン(WP-2009 と統合。SEC-007/008 論理層規律の実装)— DB-3。WP-5004a core は e49ff35 で実装済み: `@yrese/audit` に決定的 canonical serialization、`entryHash = sha256(prevHash || canonicalJson)` 実計算、genesis(64 zero)検証、破断位置付き chain verification、固定 canonical JSON/entryHash golden と payload/prevHash/entryHash 改ざん否定テストを追加。follow-up db2e505 で `node:crypto` 利用に必要な `@types/node` / `types: ["node"]` を audit package に明示し、`packages/audit build` を復旧。永続化(WP-5004b)はAGT-018のmapper/pre-plan review後、sole Codex maintainerが担当し、independent verifier、`db_steward`、`data_integrity_auditor`、`security_critic`、`privacy_compliance_reviewer`がread-onlyで確認する。append-only/WORM/tenant-isolation/PHI非露出を受入条件にし、migration適用・production DML・production security/risk acceptanceは人間の別承認なしに実行しない。
  - bounded-read統合要件: 現行PostgreSQL readは全eventを取得し、APIが全件hash検証/sort後に表示limitを掛け、閲覧ごとの`audit.viewed`追記で次回costが増える。DB-005/APIでsegment/checkpoint/cursorとtamper assuranceを先に確定し、単純な`LIMIT`で全chain検証済みを偽装せず、DB row/network/heap/hash/sortを承認済み上限へ拘束する。
  - acceptance/gate: 過去segment改竄検知、`checkedCount`/`totalCount`/break位置、`audit.viewed` exactly-onceを維持し、大規模synthetic chain・old/current segment改竄・cursor境界・bounded query/heapをintegration/load testで固定する。実装前にsecurity/data-integrity/privacy/storage human authorityを要求する。
- [ ] WP-5005 イベントストア + 投影再構築(ARC-005/006 の適用集約のみ)— DB-4
- [ ] WP-5006 マスター DB 版管理(MST-001 パイプライン永続化。M1〜M8 は各配布元 evidence 発行が個別前提)— DB-5
- [ ] WP-5007 Edge ローカルストア設計 SSOT(設計先行。実装は同期設計 SSOT 承認後)— DB-5
- [ ] WP-5008 帳票・文書ストア(RCP 系実装と同期)— 従属
- 本番インフラ製品の確定は独立ゲート(SEC-008 §3 の4条件 + BLOCKED_SECURITY_REVIEW 解除 + 人間承認)。どの Phase にも先行させない

## 直近の実行順序

1. 既存dirty exact4のWP-4158をcurrent candidateからfresh reviewし、他task差分と混ぜずに継続する。
2. WP-4159/WP-4160の既存docs-only evidenceを独立verificationし、Profile採用・package lock・実装・human decisionには踏み込まない。
3. 低riskのWP-4237 → WP-4238 → WP-4234をsmallest verified sliceで処理する。
4. WP-4057bはcursor方式を変更せず、検索index/SLO evidenceだけを独立plan reviewする。
5. WP-4235/WP-4236/WP-4050/WP-4151c/WP-4162はR3+のため、SSOT改版とhuman authorityなしに実装しない。

- [!] WP-0016 ONS登録手続き(human action required: オン資外部IF・電子処方箋記録条件の入手と利用条件確認)

## Codex 自律スキャン backlog

Codex rootはcurrent WPとdirty stateを確認し、read-only mapperでコード・CI・契約・SSOT境界をscanして候補をここへ記録する。
候補から完了条件への寄与が最大の1件だけを選び、read-only Codex pre-plan reviewerがscope、SSOT/evidence、risk、test、human gateを確認した後にのみsole maintainerへ割り当てる。`CHANGES_REQUIRED`なら計画を修正し、review完了前に編集しない。untracked/dirtyな他作業のpathは所有権不明として保護する。

- [!] WP-4007 package entrypoint/build output alignment(DEFERRED — 外部公開/partner配布決定時に再開)
  - 発見根拠: `packages/*/package.json` は `main` / `types` / `exports` が `./src/index.ts` を指す一方、`pnpm -r build` は `dist/` を生成する。build成果物を使う実行・配布・CI検証の方針がmetadataに反映されていない。
  - 目的: workspace内部はsource参照、build成果物はdist参照など、Phase 0のpackaging方針に合わせてpackage entrypointをSSOT化する。
  - historical provenance(2026-07-09 fable5判断): 当時はworkspace内消費のみで、src exportsはdev/test/transpilePackagesと整合。dist exports切替は`pnpm clean`後の解決不能やweb extensionAlias前提を壊すriskが大きいためDEFERし、外部公開/partner配布開始時にconditional exportsを再検討する判断だった。これは現行assignment/approvalではない。
  - 再開gate: Codex rootがread-only mapperでpackage consumer・build・clean checkout・web bundling・公開契約のimpactを再調査し、pre-plan reviewerがSSOT/API compatibility・rollback・test・公開riskを確認する。sole maintainer実装後はindependent verifierとpackage/build・API contract・security specialistsがreviewする。SDK/partner公開、契約・許諾、公開security/risk acceptanceはproduct/legal/securityのhuman authorityが別途承認する。
  - 想定スコープ: `packages/*/package.json`, 必要なら `tsconfig*.json`。
  - 検証: `pnpm -r build`, `pnpm -r typecheck`, `pnpm check:boundaries`。

- [!] WP-4050 reception/audit atomic persistence and repair boundary(HIGH data integrity/audit) — PARTIAL / BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - 現行事実: `apps/api/src/server.ts:427-465`の`POST /reception`は新規受付に対して`reception.created`をaudit repositoryへ配線済み。ただし`apps/api/src/db/reception-repository.ts:162-166`のreception DB `COMMIT`が先行し、その後に別audit appendをawaitする。audit append失敗時は受付だけが永続化してHTTP失敗となり、同一key再送は`existing`となる一方、現行codeは`created`だけを監査するため欠落イベントを補修しない。
  - root cause/impact: 業務mutationと監査appendに共通のdurable transaction/outbox/reconciliation境界がない。受付済みだが監査証跡が欠落した状態を恒久化し、blind retry・監査完全性・運用復旧を不整合にする。
  - required decision: transaction/outbox/repairのcanonical設計、`existing`再送時の補修規律、audit sink障害時のAPI outcome、idempotency lifecycle、observability/recovery/rollbackをAPPROVED SSOTへ確定する。AIだけでaudit semantics、DB migration、残存riskを確定しない。
  - review/human gate: 実装前にR3 scope reviewとsecurity/privacy/data-integrity/medical-safety authorityを要求。migration適用、production write、監査制約緩和は別の明示human approvalなしに行わない。
  - acceptance: create commit後audit append失敗、response loss、同key existing retry、process restartをsynthetic/DB integrationで固定し、受付と`reception.created`が各1件へ収束する。PHI-free identifier-only targetRef、tenant/pharmacy/actor、append-only chain、error non-leakageを維持し、`pnpm --filter @yrese/api test`、PostgreSQL integration、audit tests、boundaries/secrets/full regressionをPASSする。

- historical alias: `WP-4054 reception idempotency payload fingerprint hardening` は `PLAN_INVALID_AS_WRITTEN` / non-executableであり、単独taskとして発行・再利用しない。canonical dispositionと将来の再計画条件はWP-4076。
  - 発見根拠: WP-5003 後の `PostgresReceptionRepository.create()` / `InMemoryReceptionRepository.create()` は `(tenantId, pharmacyId, idempotencyKey)` 再送時に `patientId` だけを比較しており、同じ idempotencyKey で患者は同じだが受付時刻・業務日付・将来追加される受付属性が異なる再送を `existing` として扱いうる。現行 `reception_entries` には request fingerprint / payload hash がなく、WP-4051 の「同一key異payloadの409」検証範囲が DB 実装後も未充足。
  - 目的: 受付作成の冪等性を「同一key + 同一要求内容のみ 200(existing)」へ厳格化し、同一key異payloadは 409 `RCV-0003` に fail-closed する。将来の電子処方箋受付・取消・監査配線前に、二重受付防止の境界を患者IDだけへ依存させない。
  - 想定スコープ: `ReceptionCreateInput` の fingerprint 対象定義、`reception_entries` への immutable request fingerprint/hash 追加 migration、in-memory / PostgreSQL repository の同一key異payload判定、API / DB 統合テスト。hash に PHI を直接含めず、監査・ハッシュチェーン(WP-5004)と混同しない。
  - historical invalid-plan verification proposal(再利用禁止): 同一key同一payload 200(existing)、同一key同一patient別acceptedAt/別業務日付 409、同一key別patient 409等を想定し、当時はfable5 PLAN_APPROVED後のDB migration着手としていた。この検証案と旧approval routingはAPI-006と矛盾するためcurrent acceptance/gateではない。
  - 裁定根拠: `acceptedAt` / 業務日付は server 採番であり fingerprint に含めると正当な再送を409にして key 再発行による二重受付を誘発する。API-006 の payload は `patientId` のみで、その範囲の WP-4051 要件は in-memory / PostgreSQL の両実装で充足済み。
  - historical provenance(2026-07-10 fable5裁定): API-006 v0.2.0矛盾により本記載のまま無効(`PLAN_INVALID_AS_WRITTEN`)とされた。current statusも無効のまま維持し、清算はWP-4076とする。将来client送信field追加後にfingerprintを再検討する場合は新規WPとして、AGT-018のmapper → pre-plan reviewer → sole maintainer → independent verifierに加え、`api_contract_reviewer`、`security_critic`、`privacy_compliance_reviewer`、`medical_safety_reviewer`、`data_integrity_auditor`で再計画する。PHI/患者安全判断、API scope変更、migration適用・production riskはpharmacist/privacy/security/data-governanceのhuman authorityが別途承認する。

- historical umbrella: `WP-4057 patient search DB pagination and search index SLO hardening` は、privacy/security判断が必要なcursor方式と独立に進められるindex/SLO evidenceを混在させていたため、WP-4057a/4057bへ分割した。

- [!] WP-4057a patient-search cursor scalability/privacy design(BLOCKED_SECURITY_REVIEW / SSOT_UPDATE_REQUIRED、human decision required、R3)
  - finding: API-001 cursorはopaque/non-PHI必須だが現行安定順序の`patientNumber`/`patientId`をsigned base64 plaintextへ置けない。Option Aはauthenticated-encrypted anchor cursorでAEAD/key rotation/logging/compatibilityのAPI-001改版、Option Bはimmutable non-PHI ordering keyでDB/data-model SSOTとmigration/backfill/index承認を要する。
  - acceptance/gate: human security/privacy/data authorityが方式を選び、API-001/DB SSOT、wire compatibility、rollbackをAPPROVED化するまでOFFSET/v1 HMAC cursorを変更しない。tenant/pharmacy/query binding、安定順序、no-store、PHI log禁止を維持し、境界/replay/rotation/migrationをsynthetic/DB integrationで検証する。production migration/data/security riskは別human approval。

- [ ] WP-4057b patient-search index and measured SLO evidence(R2、cursor方式変更なし)
  - finding: `name/kana/patient_number ILIKE '%query%'`に対し現行indexはtenant/pharmacy/patient_numberのみで、先頭wildcard検索の実測baselineとSLO evidenceがない。
  - acceptance/gate: fixed v1 cursor/OFFSETとAPI wireを不変にし、representative synthetic volumeで`EXPLAIN`/latency/cold-warm baselineを取得後にindex/generated column/`pg_trgm`候補をDB SSOTで選ぶ。tenant/pharmacy境界、同順位安定順序、in-memory parity、query plan、bounded resourceを検証し、migration適用・production PHI/indexはdata-governance/security/privacy human approvalを要求する。

- [!] WP-4151c define reception-create idempotency-key lifecycle for ambiguous outcomes(HIGH patient/data integrity) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: `apps/web/app/reception-dashboard.tsx`はretryごとにfresh UUIDを生成し、受付contractはsame key + same patientだけをdedupeする。初回createがcommit済みだがresponseを失った場合、現行retryは別受付を生成しうる。WP-4084はambiguous-network retry key reuseを明示的にscope外としていた。
  - required_decision: attempt/session境界、同一key再利用期間、patient/date/prescription payload drift時の409/OperationOutcome相当、成功確認/失敗確定/取消後のkey rotation、Edge/offline復旧、監査・retention・UX copyをpatient-safety/data-integrity authorityが承認する。
  - acceptance: APPROVED contract/SSOTとrisk review後に、commit-before-response-loss、timeout、5xx、double-click、reload、patient change、stale retry、cross-tenant拒否をcontract/API/Web/browser testで固定する。human gate前はruntime変更を禁止し、WP-4151bのknown-non-commit synthetic proofを根拠に解除しない。

- [~] WP-4158 map JP Core terminology rights provenance(MEDIUM read-only legal evidence) — S1_BUG_REFACTOR_REVIEW / S0_REMOTE_CI_PASS / S1_PLAN_GATE_5_OF_5 / S1_IMPLEMENTATION_GATE_5_OF_5
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
  - transport/security: exact GitHub endpoints are ref URL above, `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/tags/8b9780cbdb9086e6f41b35aa8935038bd884243e`, `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/commits/c06f02059c2a8aed6a33d624c9eee6fe0669ef06`, and exact tree URL above; plus exact notice/core/terminology URLs。allowed origins=`https://api.github.com:443`,`https://jpfhir.jp:443`; approved redirect set empty。userinfo、unexpected query/fragment、downgrade/redirect/other origin拒否。explicit empty ProxyHandler、auth/cookie/custom credential headerなし、ambient proxy/credential/netrc/cookie/SSL override無効。dangerous Git locality/config overrideはpresence拒否し、ambient PATH非依存のabsolute system Git、minimal child env、explicit cwd/stdin DEVNULL、single rev-parse、per-call15s以下かつaggregate remaining以下、strict three-line outputを必須化する。monotonic deadline checked before/during every read plus per-request signal wall alarm15s、aggregate signal wall alarm120s、download total16MiB。API/notice max4MiB、core4MiB、terminology8MiB; Content-Length必須、artifact/notice size exact、API上限内。repo外temp mode0700/file0600、root/protected existing pathのdevice/inode same-file + 双方向ancestor chain拒否、normal/error/catchable INT/TERM/HUP cleanup + path nonexistence。SIGKILL/kernel loss cleanupは非主張。core archive caps512 entries/32MiB regular/8MiB largest、terminology256/96MiB/32MiB。absolute/traversal/backslash/NUL、duplicate/casefold collision、link/device/nonregular拒否、repo artifact residue0。
  - verifier_contract: S1だけがhost exact `ops/refactor/EVIDENCE.md`へexact marker lines `<!-- WP4158_VERIFIER_BEGIN -->` / `<!-- WP4158_VERIFIER_END -->` と単一Python sourceを追加する。PrecheckはそのhostのUTF-8 `splitlines()`に対して各exact line count=1、begin<end、strict interiorのfirst line exact ` ```python `、last exact ` ``` `、内部に` ``` ` prefixなしをassertし、interior[1:-1]をLF join + final LFでemitする。他file/substringはcountしない。Invalidはsource実行前に`VERIFIER_MARKER_INVALID`。Source SHA authorityはこのcanonical emitted bytes（terminal LF含む）だけで、fence separatorをsplitしてterminal LFを落としたbody hashは無効。Emitted sourceをrepo外temp fileへ0600保存し、sanitized envの`python3 -I <temp> --self-test|--live`へ渡し、source SHA + candidate treeをgate packetへ固定、tempをfinally削除する。S0はmarkers/sourceを持たずfuture verifierを実行しない。
  - handoff_schema: candidate-direct 25 canonicals × exact lane enum `private-ci-validation-cache|runtime-terminology-service|ui-display|export|public-ig-test-bundle|partner-sandbox|sdk|bulk-data` = 200 unique rows。exact fields=`canonical,lane,terminologyVersion,rightsholder,authoritativeTermsUrl,evidenceDate,permittedUse,attributionObligation,redistributionObligation,derivativeObligation,updateObligation,decision,humanAuthority,decisionDate`。terminologyVersion=`1.4.0`; rightsholderからdecisionまでの9 decision fieldsはexact `UNRESOLVED`; humanAuthority/decisionDateはnull（manifestではempty field）。全14 fieldをmanifest grammar順に連結した200-row digest=`1999669b561192d12e3567a096588a7a69dbb8a6c84e85ad3701acb21e2ae02d`。missing/extra/duplicate row、lane drift、field欠落、premature non-UNRESOLVED decisionをfailし、これはpermission decisionでなくhuman legal input schema。
  - self_test_matrix: offline/no-network tests call the same live functions。metamorphic positive exact2=`rights_case_only,direct_known_duplicate_order`。negative exact95 with globally unique names and exact family mapping: `SOURCE_IDENTITY_MISMATCH`=`tag_ref_sha,tag_target,tree_body_identity`; `TAG_TYPE_DRIFT`=`tag_type`; `TREE_TRUNCATED`=`tree_truncated`; `TREE_PATH_INVALID`=`tree_count,tree_duplicate_path,tree_license_basename`; `NOTICE_MISMATCH`=`notice_digest,notice_anchor` (source10)。`ARTIFACT_MISMATCH`=`core_digest,core_size,terminology_digest,terminology_size,package_singleton,package_identity,ig_singleton,ig_identity`; `ARCHIVE_UNSAFE`=`core_entry_bound,core_total_bound,core_largest_bound,terminology_entry_bound,terminology_total_bound,terminology_largest_bound,absolute_path,traversal_path,backslash_path,nul_path,archive_duplicate_member,casefold_collision,nonregular_member`; `JSON_DUPLICATE_KEY`=`duplicate_json_key`; `RESOURCE_SHAPE`=`resource_count,resource_object_type,resource_type,resource_url_type,resource_id_type,resource_version_type` (archive28)。`RIGHTS_TYPE_INVALID`=`copyright_nonstring`; `RIGHTS_OVERLAP`=`category_overlap`; `RIGHTS_MANIFEST_MISMATCH`=`unicode_confusable,whitespace_drift,punctuation_drift,near_miss,member_swap,duplicate_identity` (rights8)。`PROFILE_UNIVERSE_MISMATCH`=`profile_manifest`; `PROFILE_SHAPE_INVALID`=`profile_object_type,profile_url_type,profile_version_type,profile_status_type,profile_type_type,snapshot_type,element_type,element_path_type,binding_type,valueset_type,strength_type`; `DIRECT_ROW_MISMATCH`=`row_manifest,duplicate_multiplicity,duplicate_key,direct_duplicate_member`; `DIRECT_URL_MISMATCH`=`url_manifest`; `DIRECT_RESOLUTION_ERROR`=`missing_valueset,duplicate_valueset,version_alias,wrong_package` (direct21)。`HANDOFF_SCHEMA_MISMATCH`=`missing_row,duplicate_row,lane_drift,field_missing`; `HANDOFF_NOT_UNRESOLVED`=`premature_decision` (handoff5)。`TRANSPORT_POLICY`=`redirect,downgrade,other_origin,wrong_path,unexpected_query,unexpected_fragment,userinfo,ambient_proxy,ambient_credential,ambient_netrc,ambient_cookie,ambient_ssl_override,temp_inside_worktree,temp_inside_gitdir,temp_inside_commondir,temp_dir_mode,temp_file_mode`; `TRANSPORT_LIMIT`=`content_length_missing,content_length_mismatch,body_bound,request_timeout,aggregate_timeout,aggregate_bytes` (transport23)。Every negative mutates exactly one named boundary, proves before/after inequality and must return only its mapped token。
  - cleanup_self_test: exact10=`cleanup_pending_normal,cleanup_pending_operation_error,cleanup_pending_sigint,cleanup_pending_sigterm,cleanup_pending_sighup,cleanup_final_normal,cleanup_final_operation_error,cleanup_final_sigint,cleanup_final_sigterm,cleanup_final_sighup` run as subprocess-level probes against both actual verifier temp-owner lifecycle phases, not a pure model。Parent creates one private repo-external parent plus a fixed-byte sibling canary and starts each child with `start_new_session=True`; before readiness it requires `child_pgid=os.getpgid(child.pid) == child.pid` and `child_pgid != os.getpgrp()`。Parent opens the private root with `O_DIRECTORY|O_NOFOLLOW` and passes only that directory-FD capability plus inherited lifecycle-ready/release、cleanup-ready/go、signal-ack pipe FDs via `pass_fds`; pending/final path strings and filesystem control files are forbidden。Child installs INT/TERM/HUP handlers first, creates fixed relative pending directory0700、nested `partial/`0700 and non-empty `partial/download.part`0600 with fixed synthetic bytes, fsyncs/closes it, then either writes exact byte `P` and closes the pipe while pending remains authoritative, or no-replace atomically renames pending→final before writing exact byte `F` and closing the pipe。Parent uses `select` plus bounded reads every at most10ms with monotonic startup deadline2s and total deadline10s; lifecycle readiness `P|F`+EOFとcleanup readiness `C`+EOFはいずれもsingle remaining sample、nonpositive break、≤10ms select loop、phase deadline2sかつtotal10s内completionを必須化する。Before triggering completion it verifies the selected target path、other lifecycle path absence、exact modes/owner、sentinel bytes and sibling canary。For each phase, `normal` child proceeds through the actual verifier success return without a signal and `operation_error` child raises the actual synthetic operation exception without a signal by closing the operation release; INT/TERM/HUP probes keep operation release open, deliver the named signal exactly once while the child blocks on it, require exact handler ack `S`, then require cleanup-ready `C`+EOF before releasing deletion through cleanup-go。The separate live-context guards prove cleanup-active signal deferral through root nonexistence。Each probe emits exactly `WP4158_CLEANUP_EXIT probe=<exact_probe> phase=<pending|final> reason=<NORMAL_RETURN|OPERATION_EXCEPTION|SIGINT|SIGTERM|SIGHUP>\n`, empty stderr, and respectively exits0/70/130/143/129; phase/probe/reason/code swapping or sharing fails。Every probe requires bounded child exit、recursive pending/final nonexistence including nested sentinel、sibling-canary byte identity、parent-context cleanup and repository residue0。On startup/total failure parent sends TERM only to the verified isolated `child_pgid`, waits2s, then KILLs only that group if needed, reaps it in `finally`, removes only the exact pending/final pair under its private parent, asserts sibling canary unchanged and no other path touched, and fails the self-test; no unverified/current parent group is signalled。Normal/error/catchable INT/TERM/HUP cleanupだけを保証し、uncatchable external SIGKILL/kernel loss cleanup is excluded/nonclaimed。Exact aggregate token is emitted only after all ten exact terminal oracles pass: `WP4158_SELFTEST_PASS positives=2 negatives=95 cleanup=10 residue=0`。
  - cleanup_path_guard: child CLIはrepoとdevice/inode上でsame-fileまたは相互ancestorでないabsolute private root0700、same-UID regular canary0600/exact size+EOF bytes、directory-FD inode/dev一致、fixed relative pending/finalの`lstat`初期不存在、distinct inherited FIFO FDだけを受理する。Signal mask/deferred decision/active解除/restoration/unmaskを唯一のshared transition primitiveが所有し、live allocation、success tail、outer finalizerとguardが同primitiveを使う。held directory FDsとidentityが一致するknown file/dirsだけをexact unlink/rmdirする。Exact10前のsubprocess/static guardsはpre-existing directory sentinel、dangling symlink、canary suffix、全他条件を満たすsynthetic repo-ancestor root、macOS case-variant workspace-local TMPDIR、post-validation target insertionに対するno-replaceを検証し、Git call0、artifact不存在、pre-existing/canary byte identity、root/FD/mask/handler/timer residue0を必須化する。Live rootは32-attempt bounded allocatorがrandom candidate pathをmkdir前に保持し、mkdir callを含むsingle `try/except BaseException`でexclusive create後chmod0700へ正規化する。Exception時はknown candidateをlstatしsame-UID non-symlink directoryかつgroup/world permission=0だけをrmdirしてrethrowする。Additional guardsはpost-create pointとprivate root rmtree中にINT/TERM/HUP/SIGALRMをinjectし、pending/final removal中にもSIGALRMをinjectしてhandler deferとroot不存在を必須化する。mkdir直後/pre-return、real mkdir成功/call-return前、umask0777 call-boundaryのsynthetic non-signal failures、allocation/tail call-site AST bindingとcontrolled bypass mutationsも元例外保持またはexact binding failureを必須化する。Guardsはnegative95またはcleanup exact10のcountへ加算しない。同一UIDの別processによる判定後namespace replacementはportable conditional-unlink primitiveがないため除外/nonclaimであり、verifierはその防御を主張しない。
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
  - s0_terminal_record: commit `68470672bd0f5efff6cc06f42cfb374dc59dc0f7` / parent `9a3e715f49532ea2b57bda8ec715b0f6c06435c0` / tree `f955580a95c1866087ec456a11693488a16d0ae2`。COMMIT fifth generation reviewer1/2/3c/4/5は5/5 PASS。PUSH same-generation fiveはAC9L/AC9Pを5/5 PASSし、run `29658334162` / workflow `309812329` / attempt1はcompleted-success、jobs1/steps22 all success。local/origin/PR parity、main guard、deployments0、tracked/index clean。
  - s1_plan_gate: fresh reviewer1〜5が`WP4158_S1_PLAN_READY base=68470672bd0f5efff6cc06f42cfb374dc59dc0f7 scope=exact4 verifier=planned`を5/5 PASS。future verifier未実行のままexact4、marker/source、pins/manifests/direct/handoff/security/cleanup、nonclaims/human gatesを確認。
  - s1_implementation_review_history: first generation reviewer1/2はcandidate tree `2cf57a692341bd5b814bd8d1c02b89f6a1ae00d4`を0/2 PASSで停止し、slots3〜5未起動。exact4/marker/AST/happy-path liveはPASSしたが、95 negativesのtable-only expected-token raise、cleanup unbounded readiness/擬似operation-error/mode-owner不足、transport signal alarm/ambient/gitdir不足をblock。
  - s1_implementation_review_history_2: second generation reviewer1/2はtree `c6659d0944dd532dfb29c992101ea1f2f0efc856`を0/2 PASSで停止。95 mapped production tokens/cleanup mechanicsは前進したが、distinct-order positiveとbefore/after証明、named direct mutations、live-shared lifecycle/spawn-PGID回収、chunk中aggregate、SSLKEYLOGFILE、production request deadlineをblock。
  - s1_implementation_review_history_3: third generationはtree `ab4617383d01669d9682716d2b95d2d2f665b27a`を1/2 PASS。全prior blockerは修正済みだが、`notice_digest`がappendでdigest+sizeを同時変更しsize checkで先に落ちるnamed-boundary false-greenだけをblock。
  - s1_implementation_review_history_4: fourth generationはtree `efbb1219450563e7a2a37029622635d7eed67724`をreviewer1/2/4 PASS、reviewer3 FAIL、reviewer5未起動。notice digestは解消、explicit JSON null copyrightが`.get()`でmissingと同じabsentへ潰れるtaxonomy fail-openだけをblock。
  - s1_implementation_review_history_5: fifth generationはtree `08d361bc02e1279af0d404669688dfe7a61ddc51`をreviewer1/2/4 PASS、reviewer3 FAIL、reviewer5未起動。taxonomyは解消、readiness byte後のEOFを10ms一度だけ待つscheduler-flaky cleanup oracleだけをblock。
  - s1_implementation_review_history_6: sixth generationはtree `f4b1926f9ce79c4477e32a66557c27248edb80d8`を1/2 PASS。readiness loopで別clock readによりselect timeoutがnegative化し得る点と、final acceptanceがstartup2sでなくtotal10sだけを見る点をblock。
  - s1_implementation_history: seventh candidate tree `b534406011e666b3c6ea61db9217d381519db04b`はreviewer1/2 PASS、reviewer3/4 FAIL、reviewer5未起動。`communicate(timeout=max(0.01, remaining))`がtotal10s後に最大10msを追加し得て、completion後のstrict total deadline assertもなかったため停止した。
  - s1_implementation_history: eighth candidate tree `3e2de4cd12498ba3b410c1e0c313168f81fa28f0`はreviewer1 PASS、reviewer2 FAILで停止し、reviewer3は中断、reviewer4/5未起動。child completion/owned-path cleanup後のdeadline assertはあったが、parent `finally`と`TemporaryDirectory` context exit後のassertがなく、最終cleanupがtotal10sを越えても成功し得た。
  - s1_implementation_result: ninth candidate tree `f00be4f442776dc991806442271f9c89b37f023e`、source SHA=`dcd5969f4fd225983730d9a54d8fe760e95e975364f56760a440c8d1ea21cdc4`（889 LF lines）はfresh reviewer1〜5の5/5 PASS。exact4/source/index、positive2/negative95/cleanup10、startup2s/total10s through temp context exit、transport/provenance/security/privacy/nonclaimsを独立確認し、当該checkpointでBUG_REFACTORへ進んだ。
  - s1_bug_refactor_history: first BUG_REFACTOR candidate tree `f890e90533f76cdb41e2d7d7529629427d7de2b5`はreviewer2 FAILで停止し、reviewer1を中断、reviewer3〜5未起動。cleanup childが外部CLI pathを無検証で受け、create前失敗でも既存pending/finalを再帰削除し得た。
  - s1_bug_refactor_history: second BUG_REFACTOR candidate tree `318e29d68d83180dc6784edc0809d3446e2a5f11`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。dangling symlink absence bypass、validate→rename/remove TOCTOU、inode非追跡、repo ancestor rootをblock。
  - s1_bug_refactor_history: third BUG_REFACTOR candidate tree `a5d432e501f1961ce12e20fd1e7d784cac4c9e73`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。same-UID replacementをthreat modelへ入れながらidentity check→unlink/rmdir TOCTOUが残り、repo-ancestor guardはcanary欠如でも同tokenとなるfalse-greenだった。
  - s1_bug_refactor_history: fourth BUG_REFACTOR candidate tree `d608936ca9af205e1b808489bdc7139e720ff702`はreviewer1 PASS、reviewer2 FAILで停止し、reviewer3〜5未起動。signalがcleanup中にPython callbackとして削除を中断し得る未検証timingと、canary prefix-only validationをblock。
  - s1_bug_refactor_history: fifth BUG_REFACTOR candidate tree `2478c07bcbb8cd5373a325c6b64a4b572622032e`はreviewer1 FAIL、reviewer2 PASSで停止し、reviewer3〜5未起動。child signal timing/canaryは解消したが、live deferをpending/final削除後かつprivate owner root context exit前に解除してroot residueを許し得た。
  - s1_bug_refactor_history: sixth BUG_REFACTOR candidate tree `d4b9d5cc5f7e02dcea50456b6f619bb4c4acf4d2`はreviewer1 PASS、reviewer2 FAILで停止し、reviewer3〜5未起動。owner作成からcleanupを保証するtry開始までのallocation/registration signal gapをblock。
  - s1_bug_refactor_history: seventh BUG_REFACTOR candidate tree `2de575daf8f84f056254f61ae00e73318c4565d5`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。`TemporaryDirectory` constructorがmkdtemp後かつobject return前に非signal例外を出すとowner/path未取得でrootを回収できないgapをblock。
  - s1_bug_refactor_history: eighth BUG_REFACTOR candidate tree `d130dbb0bb0c9ea2dff8edc2cc8f8e5c808f42e2`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。stdlib `mkdtemp`内部のmkdir成功後/abspath-return前非signal例外ではassignment前でpathを捕捉できないgapをblock。
  - s1_bug_refactor_history: ninth BUG_REFACTOR candidate tree `098df9e0d8ef051b48256476822e801a95ea8e7c`はreviewer2 FAILで停止し、reviewer1を中断、reviewer3〜5未起動。real mkdir成功後かつPython call return前のSIGALRM callback例外が、分離したcleanup try開始前にroot residueを残すgapをblock。
  - s1_bug_refactor_history: tenth BUG_REFACTOR candidate tree `9dbdbdf6fc5c4d9b8f99bc52998f93d7faea260a`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。restrictive umaskでself-created rootがmode000となり、exception cleanupのexact0700条件がrootを見逃すgapをblock。
  - s1_bug_refactor_history: eleventh BUG_REFACTOR candidate tree `7d68892439875a75600b6266fe57791e77baa17f`はreviewer2 FAILで停止。reviewer1 contextはsecurity filter errorでnoncount、reviewer3〜5未起動。作成後callbackの`FileExistsError`までcollisionとしてcontinueしrootを残す発生位置混同をblock。
  - s1_bug_refactor_history: twelfth BUG_REFACTOR candidate tree `ea22472704809c9071aa33c93298a74ec4931dd2`はreviewer2 FAILで停止し、reviewer1を中断、reviewer3〜5未起動。FileExists fixはPASSしたが、Transport SIGALRMがlive cleanupでunmaskedのためtimeout handlerがrmtreeを中断しroot residueを残し得た。Direct gateの単発generic cleanup failureは同一source通常版120/120+診断版50/50で再現せず、reviewer2 fresh30/30でも非再現・単独blockerなしと評価した事実を保持する。
  - s1_bug_refactor_history: thirteenth BUG_REFACTOR candidate tree `1c0fb60a5997178a9c20c23904c555cb0587f664`はreviewer1 PASS、reviewer2 FAILで停止し、reviewer3〜5未起動。SIGALRMはallocation assignment/cleanup finally-entry gapでTransport handlerがdefer前にraiseし得て、cleanup-ready `C`後EOF readもunboundedだった。
  - s1_bug_refactor_history: fourteenth BUG_REFACTOR candidate tree `4e6cfc15f0a12c38768f95b624dcacb4d3b093ff`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。既知のcommon SIGALRM handler、owner registration、bounded cleanup EOFはPASSしたが、Transport constructorがhandler/timer設定後のTLS/opener構築失敗でsignal stateをrollbackしないgapをblock。
  - s1_bug_refactor_history: fifteenth BUG_REFACTOR candidate tree `b25839ccee740f31e1dd4119b8270283bc8edc42`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。TLS/opener failure rollbackはPASSしたが、timer activation後のmask解除でpending SIGALRMが配送されるとconstructorがobject return前にraiseしsignal stateを残すgapをblock。
  - s1_bug_refactor_history: sixteenth BUG_REFACTOR candidate tree `9493eb1db9547950f78205a5f060323586d9bed3`はreviewer1 FAILで停止し、reviewer2を中断、reviewer3〜5未起動。二段階activation/pending alarm rollbackはPASSしたが、closeのtimer restorationがreal effect後にraiseするとhandler restoration/active clearへ進まないgapをblock。
  - s1_bug_refactor_history: seventeenth BUG_REFACTOR candidate tree `ba897dd04fe164423a7b1f949d22d68c16aa8ec5`はreviewer1 FAILで停止。reviewer2はsecurity filter errorでnoncount、reviewer3〜5未起動。close restorationはPASSしたが、start rollbackのtimer restoration secondary errorが元のactivation errorを上書きし後続handler/active/mask restorationを止めるgapをblock。
  - s1_bug_refactor_history: eighteenth BUG_REFACTOR candidate tree `8f07e4434e4c483d790db43696d8a7c05cb24f3d`はreviewer1 PASS、reviewer2 FAILで停止、reviewer3〜5未起動。start rollbackはPASSしたが、close冒頭SIGALRM blockがrestoration transaction外でafter-real-return exception時にmask/handler/timer/activeを残すgapをblock。
  - s1_bug_refactor_history: nineteenth BUG_REFACTOR candidate tree `1381bcc5bf92f076861837226da2df01ded0b767`はreviewer1 PASS、reviewer2 FAILで停止、reviewer3〜5未起動。initial mask restorationはPASSしたが、active Transportへのsecond `start()`がoriginal handler/timer snapshotをTransport自身で上書きし、single close後もreplacement stateを残すgapをblock。
  - s1_bug_refactor_history: twentieth BUG_REFACTOR candidate tree `22abfa911e344af6e15943c65944d6947a2e1be0`はreviewer1 PASS、reviewer2 FAILで停止、reviewer3〜5未起動。double-startはPASSしたが、inactiveなpre-start/post-close `get()`がtimerをarmし、inactive `close()`がno-opのためtimerを残すlifecycle gapをblock。
  - s1_bug_refactor_history: twenty-first BUG_REFACTOR candidate tree `7678f329857aa9f1177e73e20fbea47a8fcce62d`はreviewer1/2 PASS、reviewer3 FAILで停止し、reviewer4を中断、reviewer5未起動。verifier技術面はPASSしたがauthoritative headingとexact_next_actionがstale IMPLEMENTATION_REVIEW/GATEをpresent-tense表示するprojection driftをblock。
  - s1_bug_refactor_history: twenty-second BUG_REFACTOR candidate tree `670bb3a65ff5990b450a7561050199d5a1e7717e`はreviewer1/2 FAILで停止、reviewer3〜5未起動。projection同期はPASSしたが、allocation中deferred timeout後にpost-timeout git subprocessへ進むgapと、tree response top-level shaをpinned TREEへ結合しないimmutable provenance gapをblock。
  - s1_bug_refactor_history: twenty-third BUG_REFACTOR candidate tree `ce3d92259d2695c6775edb605766e4c2484d2642`はreviewer1/2/4 PASS、reviewer3 FAILで停止、reviewer5未起動。timeout/tree identityはPASSしたが、Plans内signal timing矛盾と、exact10 signal probeがrelease EOF後cleanup-active signalだけを試しoperation待機中signal起点cleanupを証明しないfalse-greenをblock。
  - s1_bug_refactor_history: twenty-fourth BUG_REFACTOR candidate tree `a21b45a051cd58cb8b5d697035c75b1003716a1e`はreviewer1/2 FAILで停止、reviewer3〜5未起動。signal-origin exact10はPASSしたがlive operation→finally entry SIGALRM raceと、probeのFD/identity/no-replace primitiveに対しliveがpath-only rename/rmtreeを使う別実装false-greenをblock。
  - s1_bug_refactor_history: twenty-fifth BUG_REFACTOR candidate tree `cc71dc0069ebcaaa11ff67a729e19cfac5340dfd`はreviewer1 FAILで停止、reviewer2中断、reviewer3〜5未起動。shared FD primitiveはPASSしたがchild/live finally-entryのsuccess/catchable signal raceと、live file open後write完了までidentity未登録でpartial file residueを残すgapをblock。
  - s1_bug_refactor_history: twenty-sixth BUG_REFACTOR candidate tree `f71505449668cdb265f6a434032076f0f6e317ce`はreviewer1/2 FAILで停止、reviewer3〜5未起動。finally/file registrationはPASSしたがouter transport-close/handler-restore tailでdeferred signalを再確認しないgap、begin_owned_dir post-create rollback不足、live create/rename projectionのsignal transaction不足をblock。
  - s1_bug_refactor_history: twenty-seventh BUG_REFACTOR candidate tree `73a105fcbe6abdaa4e6d94c1c3a771397c9e13f7`はreviewer1/2 FAILで停止、reviewer3〜5未起動。begin_owned_dirがrestrictive umaskのmode000を0700へ正規化せずrollback条件からも外すgapと、directory/file/rootのreal `os.open`後かつassignment前例外でunassigned FDを漏らすgapをblock。Twenty-eighth candidate tree `970c5519a1cf7f93cd37b235f7d21b6b8282cbbe`はreviewer1〜3 FAILで停止、reviewer4/5未起動。deferred checks後/active解除前signal race、aggregate deadlineに拘束されないambient Git discovery、Git locality overrideによるcwd/temp境界迂回、State headingのIMPLEMENTATION gate欠落をblock。Twenty-ninth candidate tree `ef1fc1e6389a44a25e69c8c14526a24d8058e071`はreviewer1/2 FAIL、reviewer3 PASSで停止、reviewer4/5未起動。記録`a71ff936…`はterminal LFを欠く無効hashでcanonical emitted SHAは`7a42c9a5…`、live call-site bypass mutationがself-testを通るguard false-green、success tail/outer finalizerのunmask後deactivate race、macOS case-insensitive aliasによるworkspace-local TMPDIR迂回をblock。Thirtieth candidate tree `c095e836707deafb20b9e883e693bf35ccddea22`はreviewer1 FAIL、reviewer2/3 PASSで停止、reviewer4/5未起動。protected operationがsignalをqueue後primary exceptionを送出するとpending drainをskipし、actual default disposition復元後のunmaskでSIGTERM/SIGHUP/SIGALRMがprocessを終了するgapと、custom `ProbeSignal` guardのfalse-greenをblock。
  - s1_bug_refactor_candidate: thirty-first BUG_REFACTOR source SHA=`9661c715c218aa8c7ebcf4fdabb42125455fa6d2f30a9d08619b435a669d2e87`（2544 LF lines）はoperation成否捕捉直後のone common pending drain、operation primaryのexact identity/type/message/traceback/empty notes優先、then deactivate/actual handler restore/unmaskへ修正。Fresh `python -I` childでSIGINT Python defaultとSIGTERM/SIGHUP/SIGALRM `SIG_DFL`を各独立検証し、deferred state/pending/root/FD/mask/handler/timer/canary residue0を固定。旧failure-drain欠落mutation、terminal-LF欠落、allocation/tail bypassをexact tokenで拒否し、20/20 self-testとsanitized live exact six-line oracleをPASS。Current action=fresh thirty-first-generation exactly5 BUG_REFACTOR_GATE review-only。
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
  - commit_review_history_4: fourth generationはstaged tree `70e8edb7e895c803cd568534d498e8067135efd9`でreviewer1/2b/3がPASS、reviewer4がFAILし、reviewer5は未起動。応答しなかったoriginal reviewer2は中断してcountしない。Reviewer4はgeneral `commit_push_oracles`がAC9Cにも`EXPECTED_COMMIT`を要求する読みに残り、直後のprecommit boundaryと衝突する点をblockした。general clauseをAC9C base/tree/messageとpostcommit AC9L/P commitへ明示分離し、そのcheckpointのrestage/review actionはS0 fifth-generation COMMIT/PUSH terminalでsuperseded済み。
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

- [!] WP-4162 wire mandatory patient-view audit across PHI read surfaces(HIGH privacy/security/audit) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: APPROVED MOD-008/SEC-007は要配慮情報閲覧を`patient.viewed`で必須記録し、outcome必須・targetRefはPHIを含まないID参照のみと定める。一方、`apps/api/src/server.ts:223-299`の`GET /patients/search`、`:302-333`の`GET /patients/:patientId`、`:336-385`の患者投影を含む`GET /reception/queue`はtenant/scope/no-storeを実装済みだがaudit appendへ未接続。
  - impact: 誰がどの患者情報へアクセスしたかを追跡できず、不正閲覧調査、privacy accountability、監査完全性が未達。既決の「閲覧監査必須」「PHI-free identifier-only targetRef」「outcome必須」はhuman reviewで緩和しない。
  - required decision: search/bulk/listのevent粒度、0件/denied/failedの記録境界、ordering、audit sink障害時のread可否、retry/reconciliation、identifier集合のdata minimization、retention/observabilityをprivacy/security/data-integrity/medical-safety authorityが承認する。
  - stop conditions: human-approved SSOT/plan前にruntime/API/DB/migrationを変更しない。患者氏名・カナ・生年月日・検索語をaudit payload/targetRef/logへ含めない。audit失敗を成功として隠さず、既存tenant/permission/no-store境界を弱めない。
  - acceptance: approved policyに従いsearch/get/queueのsuccess/denied/failedとbulk cardinalityをsynthetic testsで固定し、targetRefはidentifier-only、tenant/pharmacy/actor/outcome/chainを検証。audit append/recoveryのDB integration、privacy/security/medical-safety review、full gates、local browser journey後にのみ完了扱いとする。

- [!] WP-4213 harden migration missing-table SQLSTATE authority(MEDIUM-HIGH migration/data integrity / R2) — BLOCKED_HUMAN_REVIEW / SSOT_UPDATE_REQUIRED
  - finding: `isUndefinedTableError`がprototype継承`code='42P01'`をmissing history tableと誤認し、明示`db:migrate`のfake-client proofでinitial SELECT failure後にoperation client→BEGIN→DDL→history INSERT→COMMITへ進んだ。hostile Proxyは`has` trapで元DB error identityを置換したが、それ自体はDDL到達原因ではない。
  - reviewed candidate: exact2 `apps/api/src/db/migration-runner.ts`, `apps/api/src/db/migration-runner.test.ts`で`isProxy`先行拒否＋own data descriptor exact primitive `42P01`限定を実装し、focused14/API typecheck/full workspace gatesで技術PASS。negativeはoriginal identity、connect/query/release各1、operation/SQL zero、accessor/proxy trap0、pg-protocol own data code互換を確認した。
  - stop/gate: 最終SSOT reviewでAPPROVED QUA-003がmigration semanticsをC3としてSSOT delta＋required human authorityを要求すると判定。SQL/実DB/migration適用は行わずcandidate exact2をrevertし、worktree cleanへ復帰した。DB-002/QUA-003準拠のhuman authorityとWP/SSOT delta後に再実装する。reception timestamp adapterは次の非gated sliceへ繰り下げる。

- [ ] WP-4234 add machine-checked Plans task-ledger structure gate(R1 governance/tooling)
  - finding: 2026-07-23 scanでcheckbox taskのduplicate ID(WP-2002)、semantic ID collision(旧Official Adapter/PrescriptionGroupResolverのWP-2103)、複数taskを1 checkboxへ結合したWP-3014〜3021、IDなしcheckboxを検出したが、CIにPlans構造checkがない。
  - acceptance: Markdown fenced blockをtaskとして数えず、checkbox taskはallow-list status(` ` / `~` / `!`)とexactly one leading WP IDを必須にし、`[x]` task残存・leading ID重複・IDなし・malformed statusをfail-closedにする。dependency/本文中のWP参照とnon-checkbox historical aliasはtask/重複として数えない。複数deliverableは1 WP/1 checkboxへ分割する運用をfixtureで固定する。
  - validation: `scripts/check-plans.mjs`とscript harness fixtureを追加し、root package/CIの既存governance gateへ接続する。clean/current ledger、duplicate、IDless、fence、alias、nested task、malformed inputを検証し、relative path/line/reasonだけを出力する。

- [!] WP-4235 serialize explicit PostgreSQL migration runners across the full apply window(C3/R3 data integrity — SSOT_UPDATE_REQUIRED / human R3 review required)
  - finding: `apps/api/src/db/migration-runner.ts`は別connectionの初期check後、pending migrationをlockなしで順次適用するため、2 runnerが同じpending列を観測して同一DDL/historyを競合実行できる。
  - acceptance: DB-002/QUA-003でdatabase単位single-writer、wait timeout、lock loss/release failureをAPPROVED化する。専用sessionでlock取得後にpendingを再判定し、全migrationと最終照合まで保持する。待機runnerは先行完了後にzero-apply成功へ収束し、lock失敗はDDL zero・固定non-echo error、session不確実時はclientを破棄する。
  - validation/gate: disposable PostgreSQLで2 pool/2 runner同時開始、timeout/failure、先行完了後no-op、history uniqueness、全migration zero-skipを固定する。実装前R3 review、migration適用/production DB/data-integrity riskはhuman authorityの別承認を要求する。

- [!] WP-4236 detach the complete audit-event graph before verification and projection(R3+ audit/security/privacy — BLOCKED_SECURITY_REVIEW / SSOT_UPDATE_REQUIRED)
  - finding: `apps/api/src/server.ts`のaudit readはroot配列snapshot後もevent/nested `targetRef`/`businessReason`をhash検証・sort・projectionで複数回参照し、hostile accessor/Proxyやmutationでhash対象と表示対象をすり替え得る。WP-4206後のactive residualを正式化する。
  - acceptance: scope/hash/identity/sequence/sort/projection前に全fieldとnested graphをown data-descriptorからexactly once detached snapshot化し、以後raw graphを再参照しない。v1 canonical bytes/golden hash、malformed row CRITICAL表示、raw append window、no-backfill、`audit.viewed`規律を不変にする。
  - validation/gate: accessor/inherited/stateful/revoked Proxy、hash後target変更、tenant/pharmacy/eventId/sequence/wallClock変異をsynthetic testで固定し、raw sentinelをresponse/logへ出さない。security/data-integrity/privacy human approval後にfocused audit/API/PostgreSQL integrationとfull gatesを実行する。

- [ ] WP-4237 include `pnpm-lock.yaml` in the fail-closed secret scan(R2 supply-chain/security)
  - finding: `scripts/check-secrets.mjs`は`pnpm-lock.yaml`を`ignoredFiles`で明示除外し、CIも同scannerを使うため、credential-bearing resolution/configurationがlockfileへ入ってもgateを通り得る。現tracked lockfileから実credentialは検出しておらず、予防gateのblind spotである。
  - acceptance: whole-file除外を廃止し、高confidence credential patternをlockfileにも適用する。integrity hashはfalse positiveにせず、synthetic credential findingはrelative `path:line:type`だけを出して値/absolute pathを非表示にする。clean lockfile、same-line allow marker、symlink/protected-scope fail-closedを維持する。
  - validation/gate: `node --check scripts/check-secrets.mjs`、`node --check scripts/check-scripts.mjs`、`pnpm test:scripts`、tracked snapshot上の`pnpm check:secrets`をPASSする。実credential検出時は削除だけで完了せず、human security authorityによるrevoke/rotationを要求する。

- [ ] WP-4238 bind audit UI error codes to exact HTTP status tuples(R1-R2 Web contract/error UX)
  - finding: `apps/web/app/admin/audit-log-view.tsx`はregistered error codeかだけを確認し、任意のnon-OK statusへ表示する。OpenAPIが定義するaudit endpointのtupleは`400/AUD-0001`と`403/AUTH-0003`である。
  - acceptance: canonical constantsからexact 2 tupleだけを表示し、相互mismatch・5xx・契約外status・他endpoint codeは固定案内を維持してcodeのみ省略する。body exactly-once、getter/Proxy/descriptor trap、raw body非echo防御、accessible noticeを不変にする。
  - validation: positive 2 tuple、相互mismatch、他endpoint registered code、5xx registered codeをfocused Web testへ追加し、Web typecheck/test/build、OpenAPI、boundaries、scripts、diff checkをPASSする。

- [ ] WP-4239 align Web screen-ID annotations with the canonical UI inventory(R1 documentation/code-map drift)
  - finding: `/prescriptions`のpage/workspace/testと`docs/ui-ux-refresh/PROGRESS.md`がSCR-004処方入力をSCR-006(電子処方箋受付)と記載し、`/sync-status` page/mode overview/test/CSS/PROGRESSがSCR-025 shellとP-19 referenceをSCR-027(RECOVERY_SYNC)と記載する。月次締めpage/PROGRESSもcanonical SCR-020をSCR-021(レセプト出力)と誤記している。
  - exact scope: `apps/web/app/prescriptions/{page.tsx,prescription-workspace.tsx,prescription-workspace.test.tsx}`、`apps/web/app/sync-status/{page.tsx,mode-overview.tsx,mode-overview.test.tsx}`、`apps/web/app/monthly-closing/page.tsx`、`apps/web/app/globals.css`、`docs/ui-ux-refresh/PROGRESS.md`。
  - acceptance: prescriptions annotationはSCR-004、`/sync-status` route shellはSCR-025、mode overviewは「SCR-025へ埋め込むP-19 cross-mode referenceでSCR-027実装ではない」、月次締めはSCR-020へ限定する。正しいSCR-006=e-prescription、SCR-021=claim output、SCR-027=RECOVERY_SYNC参照は保持し、global一括置換を禁止する。runtime/JSX/user copy/DOM/CSS rule/API/APPROVED SSOTは変更しない。
  - validation: exact scopeの`rg` mapping、focused Web tests、Web typecheck/build、diff checkをPASSし、rendered behaviorとaccessible outputのbyte-level changeがないことを確認する。

- [!] WP-4077 raw audit DynamoDB physical item envelope SSOT pin(owner: Codex sole maintainer、WP-7001 M3b / WP-5004b共通DoR、SSOT_UPDATE_REQUIRED / human infrastructure review、SSOT-only)
  - 発見根拠: APPROVED DB-005 は監査chainのkey/sequence、event/dedupe/TIP minimum属性までを定めるが、raw eventの完全属性表、各属性のDynamoDB `AttributeValue`型(`S`/`N`/`M`)とnestedのflat/`M`表現、optionalのomit/`NULL`、`entityType` / item schema version、共通timestamp、item別PHI/encryption、golden bytes/map、decoder互換性をpinしていない。実装で補完すると永続契約を推測するため `SSOT_UPDATE_REQUIRED`。
  - 必須pin: low-level physical mapの完全表と、logical fingerprint versionから分離した正の `itemSchemaVersion`、event/dedupe/TIPだけのexact 3 discriminator allow-listを確定する。bigintはcanonical decimal `S`、optionalはomitのみ(`NULL`禁止)、unknown属性は拒否。nestedのflat/`M`、共通timestampのapp-supplied sourceとambiguous retry時の保持/再生成 semanticsを属性単位で固定する。
  - security/compatibility pin: item種別ごとの `phiClassification` / `encryptionStatus`を定義し、生PHIをkey/GSI/logへ置かず、event/dedupe/TIPへTTL/GSIを付けない。synthetic-onlyのfull/min event、dedupe、TIP exact goldenを固定し、version dispatchは未知versionをdistinct fail-closed、implicit v0を禁止。append-only event/dedupeのin-place rewriteを禁止し、TIP schema migrationは別の明示手順とする。
  - M3b DoR: DB-005のAPPROVED改版 + `ssot_index`反映後、Codex root → read-only mapper → read-only pre-plan reviewer → sole maintainer → independent verifierに加え、`security_critic` / `data_integrity_auditor` / `privacy_compliance_reviewer` / DB specialistと必要なhuman infrastructure authorityのreviewを必須とする。旧fable5/opus4.8/Codex実装可能性レビュー要件はhistorical provenanceであり、current gateには再利用しない。最初の実装sliceは `apps/api` server-onlyのpure raw item codecだけとし、M2 key/sequence codecとM3a hydrate/fingerprintを再利用する。AWS SDK、TWI/CAS、network、DynamoDB Local/writeは後続laneへ分離する。

- [!] WP-4079 stored audit intent fingerprint version-before-deep-read hardening(HIGH audit integrity、BLOCKED_HUMAN_SCOPE_APPROVAL)
  - 発見根拠: `computeAuditEventIntentFingerprint` はstored outerのschema versionをdispatchする前に`context` / `event`をdeep-copyするため、unsupported v2でもhostile stored Proxy trapを先に実行し得る。JSON persistence上の実運用exploitabilityはadapter境界次第だが、versioned trust boundaryとして非対称である。
  - Blocker / Unlock Condition: WP-4078のstored M3a不変scopeと分離する。human authorityがR3 scopeを明示承認後、outer descriptor snapshot→version検証→v1だけdeep copyを実装し、v2 hostile context/event deep-read zero、stored v1 golden/error/public API不変をindependent/security/data/medical/privacy reviewで証明する。

- [~] WP-7001 Phase 1 DynamoDB persistence foundation + first aggregate synthetic proof(HIGH、M1/M2/M3a完了・M3b以降はWP-4077/AGT-018再planまでHOLD)
  - 目的: APPROVED 済み DB-005 §11 step 2 に従い、DynamoDB 永続化アダプタ基盤と最初の集約スライスを synthetic-only(PHI禁止)で実証する。
  - 歴史的に承認済みの技術計画: persistence adapter は `apps/api` server-only に置き、AWS SDK import を adapter 層へ限定する。最初の集約は、FHIR REST/CapabilityStatement を推測実装せず、DB-005 §6.1/§10 と `@yrese/audit` core が確定済みの synthetic-only `AuditAppendStore` とする。DynamoDB Local harness は CI では接続必須、local では明示 skip 可とし、IAM/STS/KMS/PITR/throughput の証明には使わない。これはtechnical provenanceであり、後続着手のcurrent approvalではない。
  - 確定済みtechnical pin: A=`SEQ#` は zero-pad width 20、uint64 `[1, 18446744073709551615]`、overflow は書込前拒否。B=app-local `AuditPersistenceVerification` が連番・dedupe pointer/hash・TIP整合を検証し、hash continuity は `@yrese/audit` へ委譲。C=同一 eventId + 同一 logical intent は既存 event、異なる intent は hard conflict。trusted `AuditWriteContext` からのみ authority を再構成し、event/dedupe/TIP は同一 tenant-scoped PK・別SK、stable eventId は retry loop 外で一度だけ生成する。
  - 準拠範囲: DB-005 §§3-6/10-12 のキー設計、ConditionExpression/楽観ロック、監査 dedupe ガード + tip 採番 sequence、TTL/物理削除禁止、per-request tenant scope、PHI のキー/GSI/ログ非露出、AWS import の adapter 層限定、PostgreSQL 正本の段階移行を計画へ列挙する。
  - M1完了: `@yrese/audit` に trusted context + `AuditAppendIntent` 全フィールド(`retryCount`含む)だけを対象とする strict v1 canonicalizer と SHA-256 fingerprint を実装。`fingerprintSchemaVersion=1` は hash 入力に含めず dispatch metadata として別返却し、未知versionは専用errorで拒否する。exact outer/context/intent/nested key、domain validation再利用、undefined/null/array/cycle/非対応値、authority/chain field混入、PHIを fail-closed に固定。全optional fieldを含む synthetic-only golden hashは `2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745`。既存 audit canonical JSON/entryHash bytesは不変。independent Codex verifier/security reviewerの`APPROVED`をcurrent M1 completion evidenceとし、旧追加reviewはhistorical provenanceとしてのみ保持する。
  - M1検証: audit 105/105 (intent fingerprint 59 + legacy audit 46)、全workspace typecheck/test、audit build、boundaries、secrets、deps、SBOM、script harness、full build、diff-checkがPASS。local PostgreSQL integration 5件は `TEST_DATABASE_URL` 不在でexpected skip、DB操作なし。AWS SDK/package/lock、DynamoDB Local harness、adapter/persistence writeは未変更。後続workはCodex rootがDB-005 pinのAPPROVED反映を確認し、read-only pre-plan reviewer、independent verifier、DB/security/privacy specialists、必要なhuman infrastructure gateをcurrent WPへ定義するまでHOLDする。
  - M2完了: historical fable5 `PLAN_APPROVED` の単一sliceとして、`apps/api` server-only に pure audit persistence key/sequence codecを追加。trusted `AuditWriteContext` の tenant/pharmacyだけから exact chain PKを構築し、event/dedupe/TIPの同一PK・相異SK、uint64 `[1, 18446744073709551615]` のunpadded decimal attribute / 20桁 sort segment、strict event SK parse + byte round-tripを固定した。全補間IDの `#` / blank / control / runtime type、非ASCII・非canonical decimal、20桁overflowを入力値非echoの固定errorで拒否する。
  - M2検証・境界: focused codec 74/74、API 161 PASS + PostgreSQL integration 5 expected SKIP、audit 105/105、全workspace typecheck/test、API/full build、OpenAPI、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、frozen lock、diff-checkをPASSさせた。独立 verifier 10/10 とread-only Opus最終reviewの承認はcompleted-historyのprovenanceとして保持する。blocker/HIGH findingなし。追加依存は `@yrese/audit` workspace linkだけ。AWS SDK/table/network/write、DynamoDB Local、PostgreSQL操作、migration、genesis/state判断、raw item hydrate、TWI/CAS/retry/verifyは変更せず、M3以降はAGT-018のcurrent re-plan完了までHOLDする。
  - M3a完了: WP-2009と統合し、保存済み`AuditEvent`のstrict hydrate/hash照合と保存event→M1 logical intent fingerprint再計算を `@yrese/audit` pure coreへ追加。authority/chain位置を保存値から再信頼せず、context一致・hash真正性・versioned fingerprintを永続adapter着手前にfail-closed固定した。検証はWP-2009記載の全gateをPASSし、独立 verifier 10/10 / read-only Opus承認はcompleted-historyのprovenanceとして保持する。raw item/AWS/DB persistence laneは物理属性SSOTをpinするまで `SSOT_UPDATE_REQUIRED`、かつ後続M3b以降はAGT-018のcurrent re-plan完了までHOLDする。

## v0.2.0 レセコンベンチマーク反映(ユーザー提供調査 2026-07-09)

ユーザー提供の主要レセコン調査(MEDIXS / EMシステムズ MAPs・Recepty NEXT / PHC Pharnes / Pharmy Connect / P-CUBE n / GENNAI just / 調剤くんV8)に基づく計画拡張。
方針決定(fable5): ①各社実装の模倣ではなく公式仕様準拠の**根拠追跡型・決定論的ルールエンジン**として設計する ②**LLM/AIに算定判断をさせない**(補助・候補提示・説明生成のみ可) ③ベンダー公開情報は Priority C(要件抽出の補助のみ、実装根拠禁止) ④MVPは「正確な算定・請求」に加えて入力速度・請求前点検・連携口・オフライン・二重UXまでを競争力条件とする。

### ベンチマーク・スコープSSOT

- [ ] WP-0018 レセコン機能ベンチマークSSOT: docs/product/rececon_feature_benchmark.md(ベンダー別特徴・出典URL付き・Priority C明記)+ docs/product/major_rececon_feature_matrix.md(14分類×ベンダー×MVP反映方針)。ユーザー提供調査を一次入力とし、source_registry へベンダーURL(Priority C)とSSK電子レセプト作成手引きページ(Priority A)を追記
- historical alias: `WP-0019 mvp_scope(PRD-001) benchmark amendment` はWP-0038へ統合済みのため単独実行しない。prior-Rx/OCR/電子薬歴・未記録/処方監査・疑義照会/在庫/拡張事前点検/二系統UX/remote diagnostics、後続AI等の全要件とreview/human gateはWP-0038が正規task authorityである。

### 算定エンジンSSOT(CAL-004 の後継拡張群)

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
2. WP-0038(mvp_scope統合改版、旧WP-0019を包含)はWP-0018完了後、Codex rootがmapper evidenceを基に発行し、pre-plan review → sole maintainer起案 → independent/domain review → 人間薬剤師・請求実務・法務・product reviewの順で進める
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

- [ ] WP-0036 Integration Hub SSOT 11文書(docs/integration/: hub_architecture / partner_registry / data_sharing_module_inventory / data_sharing_policy / api_scope_registry / webhook_event_catalog / idempotency_policy / partner_sandbox / contract_test_policy / data_portability / adapter_registry)
- [ ] WP-0037 派生機能調査+ベンチマーク拡張(docs/product/: derivative_feature_inventory / mvp_feature_prioritization + PRD-004/005 への ORCA・POS・API公開性観点追記)
- [ ] WP-0038 mvp_scope(PRD-001)0.2.0統合改版(旧WP-0019の唯一の実行先)
  - scope: 前回Do入力、OCR受け口、電子薬歴連携APIと薬歴未記載check、処方監査/疑義照会の双方向API、在庫連携口+現在庫表示、請求前点検拡充(入力漏れ・算定根拠・薬歴未記載・資格確認・公費・レセプト形式)、初心者guide+熟練者shortcutの二系統UX、remote diagnosticsをMVP判断へ統合する。一部入金・append-only会計台帳・領収証発行・日計をMVP必須とし、POS/セルフレジ/施設請求は境界設計のみとする。
  - later-phase inventory: AI薬歴、服薬follow、本部入力、在庫高度化、経営分析、オンライン服薬指導、多店舗薬歴共有を明示的な後続scopeとして分類し、AIに算定/請求/処方変更/監査/会計/外部送信を確定させない。
  - dependencies/gate: WP-0018 benchmark、APPROVED accounting/receipt/JAHIS/integration/calculation SSOTとofficial evidenceを照合し、PRC-007改版前に実装WPへscopeを流さない。AGT-018 mapper/pre-plan/sole-maintainer/independent verifierに加え、medical safety、privacy、claim、accessibility、accounting/data-integrity specialistsがreviewし、人間薬剤師、請求実務者、法務、product authorityがMVP範囲・法令/請求安全・残riskを最終承認する。
- [ ] WP-0039 算定エンジン深化 残SSOT(docs/calculation/: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy)— WP-0024〜0030 と統合実行

### 新規実装WP(SSOT承認後に発行、0.2.0実装レーン準拠)

- [!] WP-2201 会計台帳バックエンド(BLOCKED_REGULATORY_REVIEW / SSOT_UPDATE_REQUIRED、R3+)
  - unlock: copay evidence発行、ACC-006→DOM-004/MOD-005のconsuming landing、Charge/Payment/Allocation/Receivable状態と必須auditのatomic transaction、append-only DB privilege、LOCAL_ONLY/RECOVERY_SYNCのidempotency/dedup/reverifyをAPPROVED planへ固定する。accounting/claims/pharmacist/legal/security/privacy/data human review、migration/production writeの別承認を要求する。
- [!] WP-2202 領収証ドキュメントバックエンド(BLOCKED_LEGAL_REVIEW / SSOT_UPDATE_REQUIRED、R3+)
  - unlock: authoritative Payment `RECEIVED`/`CAPTURED`、ReceiptDocument法定項目/evidence、代理人同意/PHI、WP-5008電子保存/hash/retention、receipt/statement audit taxonomyとtransaction atomicity、offline採番/sync/reverifyを確定する。legal/pharmacist/accounting/claims/privacy/security/data human review、storage/migration/production writeの別承認を要求する。
- [!] WP-2203 Integration Hub 骨格(Codex sole maintainer — WP-0036 APPROVED まで BLOCKED)
- [!] WP-2204 JAHIS 2Dシンボル Adapter(Codex sole maintainer — WP-0035 承認 + JAHIS仕様本文入手(Ver.1.11、入手経路【要確認: 人間手続きの可能性】)まで BLOCKED)
- [!] WP-3101 会計・未収・一部入金・領収証画面(Codex sole maintainer — WP-0033/0034 + API契約承認まで BLOCKED)
- 共通モジュール統合注記: accounting/payment statusはWP-2201、receipt statusはWP-2202のconsuming implementation landingへ統合する。ACC-006/DOM-004/MOD-005を同時改版し、未実装statusの先行登録・apps層での重複定義を禁止するため、独立checkbox taskは発行しない。

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
  - scope: JAHIS/NSIPS/電子処方箋/資格確認/PMHをACLでFHIR Resource/Bundleへ変換し、外部形式をClinical Coreへ漏らさない。レセ電・オンライン請求はFHIRへ置換せず、日本固有Domain/official outputをWP-2102で維持する。旧`WP-2103 Official Adapter`のACL authorityは本WPへ統合済みで、PrescriptionGroupResolverの現WP-2103とは別物である。
  - dependencies: WP-0016(オン資/電子処方箋official interface入手)、WP-2102(電子レセプト/オンライン請求)、WP-0035/WP-2204(JAHIS)、ARC-003/004、adapter source/license/evidence、該当FHIR profiles。acceptance/verification: approved mapping、roundtrip loss report、encoding/invalid input/PHI/audit、official-format conformance、FHIR validator PASS。
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
