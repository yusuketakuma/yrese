# yrese / PH-OS v0.7 current-state coverage matrix

```yaml
proposal_id: WP-0054b-COVERAGE-20260716
title: yrese / PH-OS v0.7 current-state coverage matrix
status: DRAFT
implementation_authority: none
created_at: 2026-07-16
baseline_commit: 9849062
owner: codex_root
source_refs:
  - docs/research/rececon_v0_7_normative_delta_registry_20260716.md
  - Plans.md#wp-0054
```

## 1. Purpose and decision rule

This research artifact measures current repository evidence for the 22 domains in the
user-provided v0.7 draft. It does not approve scope, create a new SSOT, or authorize
runtime implementation. Current APPROVED SSOT remains authoritative.

Each domain is inspected across eight evidence dimensions:

| Key | Evidence dimension | What counts |
|---|---|---|
| A | APPROVED SSOT | Indexed document with `status: APPROVED` |
| D | Draft / research | PROPOSED, DRAFT, research, or placeholder design evidence |
| C | Code | Executable source implementing domain behavior, not an enum alone |
| K | Contract | Runtime-validated API/event/FHIR contract |
| T | Test | Test that exercises the claimed domain behavior |
| F | Fixture | Synthetic fixture usable by the domain test or demo |
| R | Runtime | Reachable API/UI/worker flow backed by executable domain behavior |
| X | External dependency | Official interface, license, service, device, or human gate |

Aggregate status is fail-closed:

- `IMPLEMENTED`: C/K/T/F/R all prove the stated slice. No domain reaches this status.
- `PARTIAL`: at least one coherent executable slice exists, but the v0.7 domain is incomplete.
- `DOC_ONLY`: design/SSOT exists but no coherent executable domain slice exists.
- `MISSING`: neither sufficient normative nor executable authority exists for the v0.7 domain.
- `BLOCKED`: implementation requires an unresolved official, regulatory, conformance, or license gate.
- `OUT_OF_SCOPE`: current APPROVED PRD-002 keeps the capability outside MVP runtime scope.

An enum, visual shell, mock fixture, or placeholder page never proves a backend/domain
implementation. A PROPOSED document never proves normative authority.

## 2. Fresh-scan evidence

Commands executed against baseline `9849062`:

```text
rg --files -g 'package.json' -g '!node_modules'
rg --files apps packages
rg -n "^\s*'/[^']+'" apps/api/src/server.ts
rg -n "status: (APPROVED|PROPOSED|DRAFT)|ssot_id:" docs/**/*.md
rg -n "Patient|Reception|calculation|claim|account|receipt|inventory|FHIR|Medication|Dispens|Coverage|Consent|Appointment|AuditEvent|offline|sync|Bedrock|AI|Document|master" apps packages --glob '*.{ts,tsx}'
```

Observed executable surface:

- eight workspace packages only: `shared-kernel`, `money`, `date-time`, `trace`,
  `events`, `contracts`, `audit`, and `calculation`;
- API routes: `/health`, `/whoami`, `/patients/search`, `/patients/:patientId`,
  `/reception/queue`, `/reception`, and `/audit/events`;
- persisted repository implementations exist for Patient, Reception, and Audit only;
- Prescription has a patient-context UI foundation, while Claim, Checkout, Masters,
  and core sync flows explicitly identify themselves as placeholders or unconnected;
- there is no `packages/fhir`, `packages/prescription`, `packages/dispensing`,
  `packages/claim`, `packages/accounting`, `packages/documents`, `packages/inventory`,
  `packages/integration`, `packages/edge-sync`, `packages/ai`, or `packages/analytics`.

## 3. 22-domain evidence matrix

`—` means no repository evidence was found that satisfies that dimension. Paths are
evidence pointers, not a claim that the whole document or file is implemented.

| ID | Domain | A: approved authority | D: draft/research | C/K/T/F/R evidence | X: external/gate | Aggregate |
|---|---|---|---|---|---|---|
| D01 | Patient Identity / Consent | `docs/domain/domain_model.md`; `docs/product/mvp_scope.md`; `docs/api/patient_search_contract.md`; `docs/security/privacy_impact_assessment.md` | v0.7 delta registry | C: `apps/api/src/patient-repository.ts`, `apps/api/src/db/patient-repository.ts`; K: `packages/contracts/src/patient-search.ts`; T: patient/API/DB and web patient tests; F: synthetic repository records; R: patient search/get UI+API | consent authority, merge/split, representative and national identifier decisions require human/privacy review | `PARTIAL` |
| D02 | Reception / Queue / Appointment | `docs/domain/bounded_contexts.md`; `docs/domain/state_transition.md`; `docs/api/reception_queue_contract.md` | v0.7 delta registry | C: reception repositories and `apps/web/app/reception-dashboard.tsx`; K: `packages/contracts/src/reception-queue.ts`; T: API/DB/web reception tests; F: synthetic patient/reception records; R: queue/list/create | online intake, notification, appointment, delivery and expiry rules are not implemented | `PARTIAL` |
| D03 | Prescription Ingress | `docs/product/mvp_scope.md`; `docs/adapters/official_adapter_inventory.md`; `docs/adapters/external_system_boundary.md`; `docs/architecture/nsips_quarantine_architecture.md` | `docs/jahis/*.md` are PROPOSED; v0.7 delta registry | C/K/T/F/R: — | JAHIS rights/conformance, NSIPS license, e-prescription official IF, OCR trust and source-retention decisions unresolved | `BLOCKED` |
| D04 | Prescription Lifecycle | `docs/domain/domain_model.md`; `docs/domain/state_transition.md`; `docs/product/mvp_scope.md` | v0.7 delta registry | C: `packages/shared-kernel/src/prescription-change.ts`, patient-context UI foundation; K: —; T: shared-kernel and prescription-workspace tests; F: component synthetic props; R: UI foundation only, no prescription API/persistence | refill, split dispensing, selected medical care and substitution require scope/evidence decisions | `PARTIAL` |
| D05 | Dispensing Workflow | `docs/domain/bounded_contexts.md`; `docs/domain/domain_model.md`; `docs/product/mvp_scope.md` | v0.7 delta registry | C/K/T/F/R: — | device/controlled-drug workflow, pharmacist role separation and incident handling need approved SSOT | `DOC_ONLY` |
| D06 | Clinical Safety / Prescription Audit | `docs/safety/safety_case.md`; `docs/safety/medical_safety_risk_register.md`; `docs/regulatory/samd_applicability_assessment.md` | v0.7 delta registry | C: `packages/shared-kernel/src/clinical-alert.ts`, `apps/web/app/components/clinical-alert.tsx`; K: —; T: enum/component tests; F: synthetic component cases; R: visual warning component only | deterministic knowledge base, dose rules and SaMD boundary remain human/regulatory gated | `PARTIAL` |
| D07 | Calculation Engine | calculation SSOT family including `calculation_engine_architecture.md`, `calculation_coverage_matrix.md`, `evidence_register.md` | `docs/research/calculation_engine_logic_review_20260711.md` | C: `packages/calculation`; K: calculation trace contract only; T/F: package golden/formula fixtures and tests; R: library only, no end-to-end API | uncovered fee rules, public expense, selected medical care and official-example authority remain blocked | `PARTIAL` |
| D08 | Claim Lifecycle | `docs/claim/claim_scope_matrix.md`; `docs/claim/record_spec_reading_notes.md`; `docs/architecture/claim_finalization_immutability_policy.md` | v0.7 delta registry | C: claimability/mode guards in shared-kernel; K: —; T: guard tests; F: synthetic statuses; R: claim/monthly-close UI shells only | official record specification and claim evidence/human approval unresolved | `PARTIAL` |
| D09 | Accounting / Receivables / POS | `docs/accounting/accounting_domain_model.md` and ACC-002..011 | v0.7 delta registry | C/K/T/F: —; R: `apps/web/app/checkout/page.tsx` is an explicit placeholder | POS full integration is PRD-002 N9; facility issue/allocation remains blocked by ACC-010 | `DOC_ONLY` |
| D10 | Documents / Legal Records | receipt SSOT family RCP-001..006; `docs/product/mvp_scope.md` M7 | v0.7 delta registry | C/K/T/F/R: — | legal retention, electronic delivery/signature and template approval need human/legal authority | `DOC_ONLY` |
| D11 | Inventory / Procurement / Traceability | `docs/product/non_mvp_scope.md` N9; `docs/operations/device_compatibility_matrix.md` | v0.7 delta registry | C/K/T/F/R: — | current MVP allows no full inventory/POS/device bidirectional implementation | `OUT_OF_SCOPE` |
| D12 | Device / Edge Integration | `docs/operations/device_compatibility_matrix.md`; `docs/security/edge_node_security_design.md`; adapter boundary SSOT | v0.7 delta registry | C/K/T/F/R: — | vendor protocols, device certification, simulator contracts and operational approval unavailable | `DOC_ONLY` |
| D13 | Eligibility / PMH / e-Prescription | `docs/adapters/official_adapter_inventory.md`; `docs/product/mvp_scope.md`; `docs/product/non_mvp_scope.md` N1/N2 | v0.7 delta registry | C/K/T/F/R: — | ONS/PMH/e-prescription official material, test environment, HPKI and operational approval are explicit blockers | `BLOCKED` |
| D14 | Home Care / Facility Operations / PH-OS | `docs/api/ph_os_reference_integration.md`; `docs/architecture/fhir_native_phos_aws_platform_direction.md`; PRD-002 N4 | v0.7 delta registry | C/K/T/F/R: — | current MVP excludes complex home-care/long-term-care claiming; PH-OS runtime is absent from this repository | `OUT_OF_SCOPE` |
| D15 | Patient Engagement / Online / Delivery | `docs/product/non_mvp_scope.md` N11 and future-scope tables | v0.7 delta registry | C/K/T/F/R: — | partner messaging/payment/delivery contracts, consent, identity and PHI minimization are undecided | `OUT_OF_SCOPE` |
| D16 | Multi-store / Headquarters / Remote Input | `docs/product/non_mvp_scope.md` N10; tenant/security SSOT | v0.7 delta registry | C/K/T/F/R: — | current MVP excludes headquarters/remote-input runtime; cross-store consent and operating authority unresolved | `OUT_OF_SCOPE` |
| D17 | Master / Terminology / Regulatory Change | `docs/masters/master_update_pipeline.md`; `docs/masters/code_mapping_registry_design.md`; `docs/regulatory/version_watchlist.md` | JP Core and terminology research artifacts; v0.7 delta registry | C/K/T/F: —; R: `apps/web/app/masters/page.tsx` explicitly placeholder | official artifacts, licenses, signature/hash sources and approval pipeline remain external/human gated | `PARTIAL` |
| D18 | FHIR / API / Partner Ecosystem | `docs/architecture/fhir_native_phos_aws_platform_direction.md`; `docs/api/platform_api_architecture.md`; API/DOM FHIR authorities carry pending revision conflicts | `docs/api/fhir_rest_facade_contract.md` is PROPOSED; DynamoDB FHIR research | C/K/T/F/R: no FHIR server, IG, validator, terminology server, CapabilityStatement or SMART flow | JP Core baseline/Profile/Must Support/canonical/rights decisions and PRC-007 amendments unresolved | `BLOCKED` |
| D19 | Analytics / Quality / Management | quality/operations SSOT including `claim_return_rate_kpi_policy.md`, `public_quality_kpi_policy.md`, `sla_slo_policy.md` | v0.7 delta registry | C/K/T/F/R: — | current PRD-002 N10 excludes management analytics; public KPI requires legal/statistical review | `OUT_OF_SCOPE` |
| D20 | Migration / Portability / Cutover | `docs/operations/legacy_rececon_migration_matrix.md`; `implementation_migration_plan.md`; `parallel_run_and_cutover_plan.md`; `data_portability_exit_plan.md` | v0.7 delta registry | C/K/T/F/R: — | source-system formats, licenses, sample exports, reconciliation and human acceptance unavailable | `DOC_ONLY` |
| D21 | Security / Operations / Support / Reliability | SEC/OPS/QUA SSOT families, especially tenant isolation, audit, offline, recovery, support and SLO | v0.7 delta registry | C: tenant plugin, audit packages/repositories, Postgres migrations, system-mode/sync enums; K: whoami/audit/reception contracts; T/F: API/DB/package tests with synthetic data; R: development tenant mode and partial API only | production identity, Edge, KMS/WORM, restore/DR, remote support, FY2026 checklist evidence and production demo remain unverified | `PARTIAL` |
| D22 | Amazon Bedrock AI Assist | AI-specific APPROVED SSOT: —; generic privacy/security authority only | referenced v0.6/v0.6.1 artifacts are absent; v0.7 delta registry | C/K/T/F/R: —; no `packages/ai` or Bedrock orchestrator | model/region/lifecycle, data handling, prompt/RAG provenance, human-review contract and mandatory-use-case source artifacts absent | `MISSING` |

## 4. Aggregate result

| Status | Count | Domains |
|---|---:|---|
| `IMPLEMENTED` | 0 | — |
| `PARTIAL` | 8 | D01, D02, D04, D06, D07, D08, D17, D21 |
| `DOC_ONLY` | 5 | D05, D09, D10, D12, D20 |
| `BLOCKED` | 3 | D03, D13, D18 |
| `OUT_OF_SCOPE` | 5 | D11, D14, D15, D16, D19 |
| `MISSING` | 1 | D22 |
| Total | 22 | unclassified = 0 |

This matrix contradicts any broad claim that the current repository already implements
the comprehensive rececon platform. The executable core is a hardened foundation plus
Patient/Reception/Audit and a limited calculation library. Most v0.7 capability is
normative design, explicit placeholder, blocked official integration, or future scope.

## 5. Cross-domain gaps and dependency decisions

1. **Normative conflict first.** ARC-008 establishes FHIR-native authority, while
   PRD-007, DOM-005/006, and API-004/008 require reconciled wording and contract decisions.
   D18 cannot proceed to runtime until PRC-007 amendments, Profile selection, terminology
   rights, canonical namespace, and persistence contracts are human-approved.
2. **Do not create the proposed package list mechanically.** MOD-001 permits new common
   packages only after an approved boundary and second consumer or stable shared need.
   WP-0054f/l must decide package boundaries from dependency direction, not v0.7 names.
3. **Patient/Reception is the only coherent clinical journey.** It should be preserved as
   the contract/persistence/security exemplar, but it does not prove Consent, Coverage,
   Prescription, Dispensing, Claim, Accounting, or FHIR clinical completeness.
4. **Calculation is executable but not claim-complete.** Evidence coverage and official
   examples remain the gate; a passing package test cannot authorize claim generation.
5. **External adapters remain fail-closed.** JAHIS, NSIPS, eligibility, PMH, e-prescription,
   devices, partner delivery, and migration require official artifacts, rights, sandboxes,
   and human operational approval before executable claims.
6. **AI remains absent by design.** No Bedrock implementation should be created until the
   missing v0.6/v0.6.1 sources are recovered and draft/human-review/PHI contracts exist.

## 6. Priority delta for WP-0054e

- Preserve P0 planning priority for D01, D03, D04, D07, D08, D09, D10, D13, D17,
  D18, D20, and D21, but keep runtime blocked by Gate 0.
- Move D05 and D06 boundary/acceptance work into Gate 0 even where broad runtime remains P1;
  dispensing role separation and clinical warning semantics affect patient safety upstream.
- Keep D11, D14, D15, D16, and D19 out of current MVP runtime unless PRD-001/002 is amended.
- Treat D22 as source-recovery and governance work before it becomes a P2 implementation WP.

## 7. Acceptance audit and next action

- 22/22 domains classified; unclassified = 0.
- Every aggregate status is tied to a repository path or the fresh-scan commands in §2.
- APPROVED, draft, code, contract, test, fixture, runtime, and external evidence dimensions
  are explicitly represented; absence is shown as `—` rather than inferred as complete.
- No runtime, database, external system, production, SSOT, or index change was made.
- Result: `WP-0054b READY_FOR_LEDGER_SYNC`; independent verification remains unavailable
  under the current single-editor topology.
- Exact next action after landing: WP-0054c must fingerprint official and vendor primary
  sources with retrieval date/version/hash/license/applicability, without using vendor claims
  as legal, claim, medical-safety, or implementation authority.
