# WP-9002 remaining SSOT classification

Baseline: `57e9a66`
Index: IDX-001 v0.4.44
Inventory: 173 total / 57 incomplete / 116 complete
Status: REVIEW

This is a non-SSOT planning artifact. It does not approve, amend, activate, or deprecate any SSOT. It records why the byte-preserving metadata-only loop stopped after W31 and routes every remaining document to the next required gate.

## Classification rules

- `metadata-safe`: body and authority are current, and only mechanical PRC-007 fields are missing.
- `semantic-amendment-required`: the body contains a known current-fact contradiction or implementation-state drift. A PRC-007 semantic revision is required before metadata completion.
- `human-authority-required`: completing missing semantic/approval fields or refreshing external facts requires the applicable product, legal, medical, claims, privacy, security, operations, accounting, or business authority.

Current result: `metadata-safe=0`, `semantic-amendment-required=18`, `human-authority-required=39`; total 57, with no overlap.

## Missing-field signatures

- `S1`: effective_from, effective_to, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, blockers
- `S2`: effective_from, effective_to, related_work_packages, related_tests, related_prs, evidence_ids
- `S3`: effective_from, effective_to, related_work_packages, related_tests, related_prs, evidence_ids, change_log
- `S4`: effective_from, effective_to, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions, blockers
- `S5`: updated_at, approved_at, approved_by, effective_from, effective_to, depends_on, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, blockers
- `S6`: approved_at, approved_by, effective_from, effective_to, depends_on, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions
- `S7`: approved_at, approved_by, effective_from, effective_to, depends_on, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, blockers
- `S8`: approved_at, approved_by, effective_from, effective_to, depends_on, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions, blockers
- `S9`: effective_from, effective_to, source_refs, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions, blockers
- `S10`: approved_at, approved_by, effective_from, effective_to, related_work_packages, related_tests, related_prs, evidence_ids, change_log, blockers
- `S11`: effective_from, effective_to, depends_on, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions, blockers
- `S12`: effective_from, effective_to, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log, open_questions, blockers
- `S13`: effective_from, effective_to, depends_on, impacts, related_work_packages, related_tests, related_prs, evidence_ids, change_log
- `S14`: effective_from, effective_to, impacts, related_work_packages, related_tests, related_prs, evidence_ids
- `S15`: effective_from, effective_to, related_work_packages, related_tests, related_prs, evidence_ids, change_log, blockers

## Semantic amendment required (18)

| ID | Path | Missing | Drift evidence / next gate |
|---|---|---|---|
| CAL-001 | `docs/calculation/calculation_coverage_matrix.md` | S2 | Coverage/evidence and historical routing assertions require a calculation/evidence revision. |
| CAL-004 | `docs/calculation/calculation_engine_design.md` | S4 | Missing questions/blockers and live engine expansion require semantic adjudication. |
| CAL-005 | `docs/calculation/calculation_engine_architecture.md` | S3 | Nine-stage implementation matrix is stale versus current rules/tests; revise architecture state. |
| CAL-006 | `docs/calculation/calculation_rule_dsl.md` | S3 | Body says effectiveTo is unimplemented/from-only, while runtime guards are live; revise before metadata. |
| CAL-007 | `docs/calculation/claimability_status_policy.md` | S3 | Body says `BLOCKER_TYPES` has 31 values; live registry has 33; revise without changing claim semantics. |
| CAL-002 | `docs/calculation/tensuhyo_reading_notes.md` | S5 | Approval/evidence reading state requires a substantive evidence review. |
| CLM-001 | `docs/claim/claim_scope_matrix.md` | S3 | Claim coverage and historical routing assertions are stale; claims/evidence revision required. |
| CLM-002 | `docs/claim/record_spec_reading_notes.md` | S5 | Approval and official record-spec reading state require claims/legal evidence review. |
| PLAN-PHASE0-GATE-001 | `docs/plan/phase0_gate_report.md` | S9 | Historical gate report cannot receive current source/impact authority mechanically. |
| PRD-007 | `docs/product/jp_core_fhir_platform_strategy.md` | S3 | Forward-reference/current platform facts and reserved amendment require product revision. |
| PRD-003 | `docs/product/risk_register.md` | S3 | Current risk/agent-state assertions are stale; refresh through product risk governance. |
| SAF-001 | `docs/safety/medical_safety_risk_register.md` | S3 | Dated control counts and implementation states require medical-safety reassessment. |
| SAF-002 | `docs/safety/safety_case.md` | S3 | Implementation evidence/status snapshot is stale; safety case revision and human review required. |
| SEC-007 | `docs/security/audit_log_design.md` | S3 | Body describes audit package/API as future although live implementation exists; security revision required. |
| SEC-005 | `docs/security/edge_node_security_design.md` | S3 | Approval/blocker and Edge security readiness statements require substantive security review. |
| SEC-004 | `docs/security/privacy_impact_assessment.md` | S2 | Implementation-state controls and fixture-PHI scan status require a fresh PIA revision. |
| SEC-001 | `docs/security/security_guideline_mapping.md` | S2 | Dated implementation and official-guideline mapping require security/evidence refresh. |
| SEC-006 | `docs/security/tenant_isolation_design.md` | S3 | PostgreSQL/RLS and DynamoDB direction conflict requires DB/security architecture adjudication. |

## Human authority required (39)

| IDs | Paths / domain | Missing | Required next authority |
|---|---|---|---|
| ACC-011, ACC-005 | `docs/accounting/` audit/refund policies | S1 | Accounting, legal, claims, data-integrity, and audit authority must define impacts/blockers. |
| JHS-001, JHS-002, JHS-003, JHS-004, JHS-005, JHS-006, JHS-007, JHS-008 | `docs/jahis/` | S6/S7/S8 | Official JAHIS document access/version/license and adapter applicability require human/legal review; all remain PROPOSED. |
| OPS-001, OPS-002, OPS-003, OPS-004, OPS-005, OPS-006, OPS-007, OPS-008, OPS-009, OPS-010, OPS-011, OPS-013, OPS-014 | `docs/operations/` | S1 | Current operations, migration, device, SLA, support, PHI/break-glass, capacity, cost, and production facts require operations/business/security review. |
| PRD-004, PRD-005 | Product benchmark/matrix | S10 | PROPOSED product scope and public-source freshness require product/human approval. |
| PRD-006, PRD-008, PRD-009 | Product concept/doctrine/strategy | S11 | Dependencies, questions, blockers, and current strategy require product authority. |
| QUA-005, QUA-006 | Incident/post-release quality | S12 | Incident, reporting, monitoring, and production readiness require operations/legal/medical authority. |
| REG-001, REG-002, REG-003, REG-004, REG-005, REG-007 | `docs/regulatory/` | S13 | Official source/version/applicability/legal evidence must be refreshed by regulatory/legal authority. |
| SEC-002 | Provider security guideline mapping | S14 | Official provider-guideline and implementation status require security/human evidence review. |
| UIX-001 | Medical UI/UX principles | S15 | Blocker classification and medical/accessibility acceptance require pharmacist/product authority. |
| UIX-007 | Screen inventory | S1 | Current screen implementation/readiness and blockers require product/UI/accessibility review. |

## Separate code candidate blocked by human choice

WP-4057 keyset-only pagination is not currently executable as a code-only slice. API-001 requires a cursor to be opaque and non-PHI. The existing deterministic order uses `patientNumber` and `patientId`, which must not be placed in signed base64 cursor plaintext.

- Option A: authenticated-encrypted anchor cursor. Requires an API-001 privacy/security amendment defining classification, AEAD/key derivation/rotation, logging, and compatibility.
- Option B: immutable non-PHI ordering key. Requires DB/data-model SSOT, migration/backfill/index design, and explicit migration/production-data approval.

Until a human authority selects and approves one option, keep OFFSET pagination and the current v1 HMAC cursor unchanged. Search-index/SLO work remains a separate WP-4057 follow-up.

## Resume rules

1. Do not create IDX v0.4.45 or decrement inventory until a substantive revision is approved.
2. Start semantic revisions one document at a time with PROPOSED/null approval semantics, independent/domain review, and applicable human gate.
3. Recompute the 57-document set from live frontmatter before every revision; this manifest is a routing snapshot, not an authority source.
4. Preserve WP-4050 and persistence/migration tasks behind their existing human gates.
