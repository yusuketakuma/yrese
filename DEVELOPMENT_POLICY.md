# yrese Development Policy Charter

## 1. Authority and scope

This charter records the repository work-selection decision made under the direct
user instruction dated 2026-07-29, amended on 2026-08-23 by direct user
instruction to make **information interoperability the product's primary
strength** (FHIR R4 / JP Core native, JAHIS conformance, an open shared partner
API, and online eligibility / Myna linkage). It is the single pointer for the
next 6–12 weeks of development sequencing.

- This is a non-SSOT operational charter. Its architecture and Core Logic
  Register sections are evidence-linked planning summaries, not implementation
  authority.
- Product, clinical, legal, billing, security, privacy, and data-integrity truth
  remains in the applicable APPROVED SSOT.
- This charter does not authorize production use, deployment, migration
  application, external transmission, or a conformance claim.
- If this charter conflicts with an APPROVED SSOT, implementation stops for the
  required SSOT amendment and human gate. It must not silently invent a
  compatibility layer.
- `Plans.md` contains the small executable queue. This file contains the durable
  policy and must not become a progress log.

## 2. Decision

### Primary policy

Use the **smallest falsifiable architecture proof, then one pharmacist vertical
journey**. Do not build a broad FHIR/AWS/PH-OS platform first, and do not extend
the current PostgreSQL model into a second permanent clinical authority.

The order is:

1. restore a trustworthy green dependency baseline;
2. close the existing reception/audit partial-write boundary;
3. decide authority and migration for only `Patient` and
   `MedicationRequest`;
4. prove that bounded architecture with synthetic data;
5. connect reception, manual paper-prescription draft, pharmacist confirmation,
   and immutable audit evidence capture in one user journey.

### Fallback policy

If the bounded `Patient` + `MedicationRequest` authority decision cannot reach
its exit criteria within 10 business days, freeze the FHIR/AWS/PH-OS platform
scope. After PRC-007 amendment and explicit human approval, run a limited
yrese-only pilot on one canonical PostgreSQL model with a read-only FHIR
projection. The fallback does not permit dual writers, a silent rollback to the
legacy model, or a FHIR/JP Core conformance claim.

Only this fallback may be activated. Do not blend both policies indefinitely.

### Interoperability-first amendment (2026-08-23)

The primary policy is kept. Its prerequisites — a green baseline, one atomic
reception/audit/outbox command boundary, and the bounded single-writer proof for
`Patient` and `MedicationRequest` — are unchanged and are not bypassed. What
changes is what is selected **after** them:

- The FHIR facade publishes only resources whose single writer has been proven.
- Interoperability tracks (Integration Hub, FHIR facade, JAHIS, online
  eligibility / e-prescription, partner-facing extras) are sequenced in
  `Plans.md §16` and become selectable in the order of §11 below.
- External-interface code is written only after the official specification is
  registered in `source_registry` with an evidence_id and the corresponding
  REG-004 blocker row is released; obtaining ONS access, JAHIS documents, or
  NSIPS licence remains a human procedure.

### Strategy comparison

| Strategy | Time to user value | Safety / migration risk | Decision |
|---|---:|---:|---|
| Full FHIR/AWS platform first | slow | unresolved owner and amendment cascade | reject for this horizon |
| Journey first on the current model | fast | creates a likely second clinical authority | reject |
| Continue patient/tenant hardening | slow | safe but diminishing product learning | stop except critical defects |
| Smallest architecture proof, then journey | fast enough | bounded and falsifiable | **primary** |
| Freeze platform scope, limited yrese pilot | fast enough | requires explicit rollback decision | **fallback only** |

The primary rejects both sunk-cost continuation and a greenfield rewrite: it
preserves verified runtime foundations, proves one narrow target boundary, and
retires legacy authority aggregate by aggregate.

## 3. Why development stalled

### FACT

- The reachable API surface is health, identity context, patient read/search,
  paper reception create/list, and audit read.
- The persistent runtime model has `patients`, `reception_entries`, and
  `audit_events`; there is no prescription, dispensing, schedule, visit,
  report-delivery, billing, outbox, or PH-OS synchronization store.
- The prescription screen explicitly states that prescription/dispensing data
  is not connected.
- The repository accumulated 703 commits over 10 active days. 531 touched the
  four manual ledgers and 307 touched only those ledgers. The prior active plan
  exposed 136 TODO/PARTIAL/BLOCKED entries.
- `POST /reception` commits a reception before it appends its audit event in a
  separate transaction. An audit failure can therefore leave a durable
  reception without a recoverable `reception.created` event.

### DECISION

The primary cause is the work-selection system: it optimized for low-risk work
package consumption and recordability instead of a completed user journey.
Amplifiers were four overlapping ledgers, fixed-cardinality review generations,
large executable evidence embedded in Markdown, and routine record-only commits.
The large backlog and repeated hardening of the same small surface are symptoms,
not the cause.

This conclusion does not mean earlier safety work had no value. Tenant-scoped
queries, fail-closed authorization, idempotent reception creation, append-only
audit storage, pure calculation, and contract boundaries are foundations to
preserve. The policy changes what is selected next.

## 4. North Star and milestones

### 6–12 week North Star

Using synthetic data only, a pharmacist can complete this real Web/API/contracts
journey:

```text
patient search and selection
→ reception creation
→ manual paper-prescription draft
→ pharmacist confirmation
→ immutable audit evidence capture
→ partner sandbox receives the dispensing event through the shared API
```

The journey must be tenant-safe, versioned, retry-safe, correction-aware, and
fail closed for calculation, claims, external delivery, and unimplemented
clinical decisions. It is not a production-readiness or standards-conformance
claim.
Audit review is not a pharmacist Web step; the synthetic acceptance scenario
verifies evidence capture through the permissioned API/test boundary.

### Milestone 1 — Green baseline and safe command boundary (week 1–2)

Exit criteria:

- the PostCSS dependency advisory is remediated without weakening the gate;
- current repository validation is green on the resulting exact head;
- reception, audit intent, and required outbox intent have one durable command
  boundary;
- retry, response loss, process restart, conflict, and injected sink failure
  converge without a duplicate or missing durable effect;
- any legacy orphan is surfaced as reconciliation evidence without inventing
  its original actor or timestamp;
- R3 implementation scope and any migration application receive their separate
  human approvals.

### Milestone 2 — Bounded architecture proof (week 3–4)

Limit the proof to synthetic `Patient` and `MedicationRequest`.

Exit criteria:

- one approved table identifies canonical writer, read projection, version,
  correction owner, tenant boundary, and cutover state for both resources;
- the ARC-008 / DOM-005 canonical-owner conflict is resolved in one approved
  amendment batch;
- a contract/integration proof covers cross-tenant denial, stale-version
  conflict, retry deduplication, audit/provenance, and one authoritative writer;
- FHIR R4 4.0.1 and JP Core 1.2.0 profiles, terminology, Must Support choices,
  and known mapping loss are explicit;
- failed conformance or migration proof activates a stop/reframe, not a second
  writer.

### Milestone 2.5 — Integration Hub foundation and FHIR read facade

Runs alongside Milestone 2/3 packets; see `Plans.md §16.3` stages S1–S3.

Exit criteria:

- JP Core package provenance is registered and locked-profile validation runs
  in CI;
- DOM-006 has field mapping entries for every Must Support element of
  `JP_Patient` and oral/topical `JP_MedicationRequest`, with loss listed;
- Integration Hub SSOTs exist and MOD-009 is APPROVED;
- the outbox delivery worker delivers `reception.created` at-least-once with
  injected-failure proof;
- `GET /fhir/R4/Patient` read/vread/search passes the validator on synthetic
  data under the same cross-tenant / stale-version / retry proofs as
  Milestone 2.

### Milestone 3 — Pharmacist vertical journey (week 5–10)

Exit criteria:

- reception connects to one manual paper-prescription draft;
- provisional data and pharmacist-confirmed data are distinct states;
- confirmation requires the approved actor/qualification boundary;
- corrections create history instead of overwriting the prior clinical state;
- every accepted state change has version, audit, and transactional outbox
  evidence;
- a synthetic browser/API integration scenario completes the North Star;
- calculation, claims, JAHIS/QR, PH-OS synchronization, and report delivery stay
  visibly fail closed;
- a human pharmacist safety/UX review occurs before any pilot decision.

### Milestone 4 — JAHIS intake, pharmacy-record delivery, eligibility boundary

Exit criteria (`Plans.md §16.3` stage S4):

- a JAHIS 2D symbol is decoded into a provisional draft, confirmed by a
  pharmacist, traced by the calculation engine, and delivered to a partner as a
  JAHIS pharmacy-record message, all on synthetic data;
- decode success, syntax validity, patient identity match, source authenticity,
  and pharmacist confirmation remain five separate evidence records;
- the eligibility snapshot state machine exists and an unverified reception
  cannot reach calculation or claims (fail-closed test);
- online eligibility, e-prescription, and PMH connections stay stubbed until
  their official specifications are registered and RB-002/003/005 are released.

## 5. Architecture and ownership

### Current

| Concern | Current authority | Reachability |
|---|---|---|
| Patient | PostgreSQL `patients` | read/search only |
| Reception | PostgreSQL `reception_entries` | paper create/list only |
| Audit | PostgreSQL `audit_events` | append/read; separate from reception transaction |
| Prescription and dispense | none | UI shell only |
| Calculation | pure package | no API/DB consumer; claim allow-list empty |
| PH-OS workflow | none in this repository | document-only |

PH-OS is the home-visit pharmacy management operating system. It is not a
second yrese writer and is not part of the currently reachable runtime in this
repository.

### Target

- Clinical and external-exchange resources follow ARC-008: FHIR R4 4.0.1 with
  JP Core 1.2.0 is the target representation and storage authority only after
  the bounded owner/mapping proof is approved.
- Reception workflow, calculation, billing/accounting, and audit ledgers remain
  non-FHIR canonical domains.
- yrese owns prescription, dispensing, billing evidence, and its audit facts.
  PH-OS owns schedule proposal/contact/confirmation, visits, clinical reports,
  and delivery outcomes. Each cross-system resource has one writer; the other
  system receives a versioned projection or reference.
- A queue insertion is not delivery. A schedule proposal or hold is not a
  confirmed schedule. An audit log is not domain history.

### Migration and legacy retirement

Migrate one aggregate at a time:

1. approve owner, mapping, version, reconciliation, abort, and rollback rules;
2. build a read-only shadow projection from the current authority;
3. compare synthetic or approved de-identified records and expose all loss;
4. cut over one writer through an explicit switch and human-gated migration;
5. disable the legacy writer;
6. retain bounded reconciliation and rollback evidence for the approved window;
7. retire the legacy path after parity and rollback-window exit.

Indefinite dual write, hidden bidirectional synchronization, and field-level
multi-master are prohibited.

## 6. Cross-domain safety invariants

- Tenant, pharmacy, actor, scope, and qualification come from authenticated
  trusted context, never an untrusted request tenant identifier.
- Weak attributes such as name and birth date never auto-merge patients.
- A retryable create carries a stable idempotency key plus approved
  conditional-create/no-overwrite semantics; it does not require an expected
  version or `If-Match`.
- An update or correction requires the expected version and `If-Match`, and also
  carries a stable idempotency key when retryable. Every write preserves
  auditable actor/context and Provenance where the target contract requires it.
- Decode success, JAHIS syntax/version validity, patient identity match,
  source-document authenticity, and pharmacist-confirmed clinical data are five
  separate results and evidence records.
- Unknown status, mapping loss, evidence gap, qualification gap, and
  conformance uncertainty fail closed.
- Clinical corrections append a new version and preserve the previous version.
- PHI is excluded from keys, URLs, metric labels, logs, raw errors, and
  cross-agent artifacts.

### Applicable external baselines

- [HL7 FHIR R4 4.0.1](https://www.hl7.org/fhir/R4/)
- [JP Core 1.2.0](https://jpfhir.jp/fhir/core/1.2.0/)
- [JAHIS outpatient prescription 2D symbol Ver.1.11](https://www.jahis.jp/standard/detail/id=1233)
- [JAHIS electronic medication notebook Ver.2.6](https://www.jahis.jp/standard/detail/id=1124)

Availability of an official document is not legal approval, implemented
coverage, profile validation, source authenticity, or clinical validity.

## 7. Core Logic Register

| Domain | Current status | Canonical invariant / main failure | Action | Priority |
|---|---|---|---|---:|
| Electronic medication-notebook QR | UNREACHABLE | Decode is not syntax, identity, authenticity, or clinical confirmation; no runtime/fixture | DEFER until approved JAHIS 2.6 adapter boundary | P3 |
| Prescription QR / JAHIS parser | UNREACHABLE | Repo inventory is stale; no parser or synthetic conformance fixture; official outpatient prescription format is Ver.1.11 | VERIFY rights/version, then private adapter slice | P3 |
| FHIR R4 / JP Core / yrese sync | DOCUMENT_ONLY / CONFLICT | ARC-008 and DOM-005 differ on canonical owner; mapping registry is empty; no conformance evidence | REPAIR with bounded Patient + MedicationRequest proof | P1 |
| Database / transaction / history / RLS | PARTIAL | Reception and audit are split transactions; no outbox, domain history, RLS, or runtime-role proof | REPAIR atomic command first; RLS remains human/security-gated | P0 |
| Patient identity / merge | PARTIAL | Read/search only; no version, merge lineage, immutable eligibility snapshot; weak-attribute auto-merge prohibited | PRESERVE read path; design explicit versioned merge later | P2 |
| Prescription history | UNREACHABLE | No schema/contract/route/repository; authority unresolved | REPAIR in bounded architecture proof | P1 |
| Dispense / clinical checks / sets | UNREACHABLE | Shared types/UI shell are not a state machine or persistence | DEFER until confirmed prescription foundation | P2 |
| Schedule management | UNREACHABLE | No yrese runtime owner; proposal and confirmed schedule must differ | RETIRE as yrese writer; PH-OS owns versioned workflow | P3 |
| Visit history | UNREACHABLE | No route/store/owner in yrese | RETIRE as yrese writer; consume approved PH-OS projection only | P3 |
| Report approval / delivery | DOCUMENT_ONLY | Report instance differs from clinical report; queued is not delivered | DEFER; PH-OS owns approval/delivery receipt | P3 |
| Authn/authz/tenant/qualification | FAIL_CLOSED / PARTIAL | Development stub is isolated; production identity and qualification are absent; no RLS proof | VERIFY before pilot; no release claim | P1 |
| Reception/audit/outbox | PARTIAL / HIGH | Separate commits can permanently lose audit evidence after retry | REPAIR in WP-4050 | P0 |
| Calculation / claims | PARTIAL / UNREACHABLE | Pure evidence-aware engine exists, but no API/DB consumer and no safe claimable status | PRESERVE package; DEFER workflow | P3 |
| Task / notification / event delivery | TYPE_ONLY | Envelope validation exists; no store, worker, dedupe, replay, or delivery receipt | DEFER until transactional outbox proof | P2 |

No JAHIS, FHIR, JP Core, PH-OS synchronization, production-authentication, or
production-readiness conformance claim is currently justified.

## 8. Work selection, validation, and records

### Work selection

- WIP is exactly one; `READY` contains at most two entries.
- A human-gated item is listed separately and is not claimable or counted as
  READY until the gate is cleared.
- Select only work that closes the current milestone exit or a critical
  safety/security blocker preventing that exit.
- Documentation-only work is allowed only when it directly unlocks the current
  implementation boundary.
- If a human/external blocker remains for one business day, take the next READY
  item in the same milestone without expanding the queue.
- While two READY items exist, do not discover or register more work.
- A bounded enabling task must have a timebox and may not become a new hardening
  program.

### Validation

- Slice validation proves the changed boundary and its failure modes.
- Integration validation proves adjacent contract, persistence, tenant, retry,
  version, audit, and rollback behavior.
- Milestone validation proves the full synthetic user journey and all
  fail-closed exclusions.
- Existing CI gates remain intact. A known failing gate means the slice is not
  complete.

### Development topology

Use one sole writer, read-only mapping/planning, one independent verifier, and
only the risk specialists required by the changed boundary. Fixed reviewer
counts and repeated review generations are prohibited. Human authority remains
mandatory for R3+, clinical/legal conclusions, production operations, and
security/privacy relaxation.

### Record policy

- `Plans.md`: the only active queue.
- Git diff: implementation evidence.
- Commit and CI: normal completion and validation evidence.
- `State.md`: pointer-only resume snapshot for interruption, blocker, human gate,
  or uncommitted ownership; not a routine success log.
- `ops/refactor/STATE.md` and `ops/refactor/EVIDENCE.md`:
  `FROZEN / GIT_HISTORY_ONLY`.
- Decision document or sanitized Gbrain decision entry: durable knowledge only.
- Do not append routine successes, command output, commit lists, reviewer IDs,
  or memory IDs to a manual ledger.

## 9. Stop-doing / NOT NOW

- WP-9002 metadata-completion loops and WP-4158/4159/4160 evidence expansion.
- New generic verifiers embedded in Markdown.
- Fixed `exact5`, `exact10`, or other reviewer-cardinality gates.
- Routine record-only commits and per-slice success entries in multiple ledgers.
- Broad 22-domain fan-out or a full AWS/DynamoDB platform before the bounded
  proof. A full generic FHIR server remains out of scope; the facade exposes
  only proven-writer resources.
- Billing/claims electronic file generation, schedule/visit/report writers,
  and noncritical patient/reception/audit hardening before the North Star
  prerequisites. (JAHIS, FHIR facade, Integration Hub, and eligibility
  boundaries are no longer NOT NOW; they follow §11 and `Plans.md §16`.)
- Any external-interface connection code before its official specification is
  registered and the matching REG-004 row is released.
- Production data, deploy, external send, conformance, or release-readiness
  claims.

## 10. Reframe triggers

Reframe immediately when:

- a critical patient-safety, privacy, tenant, or data-integrity contradiction is
  found;
- the same two consecutive slices do not advance a milestone exit;
- Milestone 1 exceeds 10 business days;
- bounded FHIR mapping/conformance or single-writer migration is falsified;
- a gate can pass only by weakening security, privacy, evidence, or test
  coverage.

Activate the fallback only through the human/PRC-007 gate in section 2.

## 11. Exact implementation sequence

1. **CURRENT — WP-4250 DECISION PACKET:** mapping for the bounded `Patient` +
   `MedicationRequest` authority/profile/lifecycle/concurrency/cutover decision
   is complete. Await the exact human approval phrase recorded in `Plans.md`;
   approval authorizes only candidate exact11 PRC-007 PROPOSED amendment
   drafting/review and does not authorize implementation or final SSOT approval.
   Patient retains read-only shadow parity plus human cutover. MedicationRequest
   has no current writer/data and begins with the FHIR ingestion boundary as sole
   writer only after approved amendments, locked-profile validation, and security
   prerequisites, with no migration, backfill, dual writer, or automatic fallback.
2. **SEPARATE HUMAN-GATED NEXT — WP-4050:** after explicit R3 scope approval,
   make reception, audit intent, and transactional outbox one retry-safe durable
   command boundary. It is not a READY slot and is independent of WP-4250.
3. **CONDITIONAL MILESTONE LABEL — WP-4251:** synthetic bounded architecture
   proof, claimable only after the WP-4250 atomic amendment batch receives all
   required review and final human approval.
4. **CONDITIONAL MILESTONE LABEL — WP-4252:** pharmacist vertical journey,
   claimable only after its predecessors and separate safety gates are complete.

5. **INTEROPERABILITY SEQUENCE (2026-08-23 amendment):** after WP-4050's
   independent review passes, select in this order, one WIP at a time and
   subject to each item's human gate: WP-6101 (JP Core package provenance),
   WP-6001 (Integration Hub SSOTs), WP-6202/6203 (JAHIS version alignment and
   promotion), WP-6302 (eligibility boundary SSOT skeleton), WP-6003 (outbox
   delivery worker), then the Milestone 2.5 FHIR read facade packets, then
   Milestone 3 and 4 items per `Plans.md §16.3`. External procedures
   (WP-6201, WP-6301) start immediately and run in parallel as human work.

WP-4251 and WP-4252 are labels, not READY or implementation authorization.
WP-4250 owns only the active `Plans.md` block, active `State.md` snapshot, and
this §11. Because the full files contain pre-existing dirty changes and
`DEVELOPMENT_POLICY.md` was already untracked, exact3 landing is not authorized
or provable as an isolated commit until root resolves whole-file ownership or
constructs and reviews an isolated commit that excludes unrelated changes.
