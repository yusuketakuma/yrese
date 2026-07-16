# yrese / PH-OS v0.7 domain, API, and module architecture candidate

```yaml
proposal_id: WP-0054f-20260716
status: DRAFT
implementation_authority: none
created_at: 2026-07-16
baseline_commit: 255501a
normative_amendment_targets:
  - ARC-008
  - DOM-001
  - DOM-005
  - DOM-006
  - API-002
  - API-003
  - API-004
  - MOD-001
  - MOD-002
  - MOD-003
blockers:
  - BLOCKED_GATE0
  - SSOT_UPDATE_REQUIRED
  - BLOCKED_FHIR_CONFORMANCE_REVIEW
  - BLOCKED_SECURITY_REVIEW
```

## 1. Result and conflict resolution order

This candidate maps all 22 v0.7 domains to one authoritative data model, API class,
event class, package boundary, and tenant/store rule. It creates no runtime package and
does not amend APPROVED SSOT.

A current authority conflict must be resolved before implementation:

- DOM-005's old body says FHIR is an external projection and not an internal source of
  truth.
- Later APPROVED ARC-008 explicitly amends that direction: clinical/external resources
  use stored FHIR as source of truth, while calculation, claim, receipt, accounting, and
  audit internals remain non-FHIR.
- v0.5/v0.7 extends the FHIR-native set and treats clinical Provenance/AuditEvent as FHIR
  resources, while preserving Japanese transaction domains and technical ledgers.

Under PRC-007's pending-revision mechanism, ARC-008 is the temporary direction. Gate 0
must amend DOM-005 and dependent documents rather than letting an implementer choose.
The proposed final distinction is:

1. clinical facts and clinical lineage are stored as versioned FHIR resources;
2. Japanese calculation/claim/accounting/inventory and operational workflows are
   non-FHIR domain sources of truth with FHIR references;
3. technical delivery/security ledgers remain non-FHIR, but may store the canonical FHIR
   AuditEvent/Provenance payload or derive interoperable views without creating a second
   mutable clinical source;
4. each entity has exactly one authoritative write path.

## 2. Five product layers and three architectural planes

The five layers describe product capability. The three planes describe integration and
runtime responsibility; they are not competing decompositions.

| product layer | authoritative content | plane participation |
|---|---|---|
| Clinical Data Platform | yrese/PH-OS FHIR resources, history, profiles, terminology, clinical Provenance/AuditEvent | FHIR Clinical Data Plane |
| Japanese Pharmacy Transaction Core | calculation, claim, accounting, receipts, public-expense allocation and immutable transaction traces | business domains adjacent to Clinical Plane; never Technical Control Plane |
| Pharmacy Operations Platform | reception, dispensing work, documents, inventory, procurement, home/facility/delivery and multistore workflow | business domains; clinical facts remain FHIR references/resources |
| Open Integration Platform | FHIR REST/IG/SMART/Subscription/Bulk/CDS, approved business APIs, partner registry and Official/Legacy Adapters | Clinical Plane + Adapter Plane; Control API only for technical operations |
| Reliability / UX / AI Platform | Edge, retry/dead letter, security, monitoring, support, UX projections and AI orchestration metadata | Technical Control Plane; AI clinical output is Draft FHIR, not control-plane clinical duplication |

Plane invariants:

```text
FHIR Clinical Data Plane
  owns clinical resources, version history, clinical search, clinical references

Technical Control Plane
  owns cursor/retry/dead-letter/lease/job/queue/adapter health/device process/metrics
  must not own a duplicate patient/prescription/dispensing/visit payload

Legacy / Official Adapter Plane
  owns external-format parsing, protocol, character set, source evidence and conversion
  must not leak JAHIS/NSIPS/official record structures into Clinical or business cores
```

## 3. API classes

| API class | base/contract | allowed data and behavior | prohibited |
|---|---|---|---|
| Clinical FHIR | `/fhir/r4`; FHIR R4 + locked JP Core/derived IG; CapabilityStatement is machine authority | read/vread/search/history/create/update/transaction and declared operations for approved clinical resources | FHIR-like JSON, hidden UI clinical endpoint, clinical DTO as second source, unsupported interaction not declared |
| Public business | versioned OpenAPI + `@yrese/contracts` | non-clinical reception orchestration, calculation request/result, claim/accounting/document/inventory operations when APPROVED | patient/prescription/medication/visit clinical CRUD, direct DB, silent breaking change |
| Partner | Clinical FHIR plus explicitly approved public business subset; SMART/OAuth/mTLS as applicable | consent/purpose-scoped partner access and event/reference delivery | official-system replacement, partner DB access, unrestricted PHI export |
| Technical Control | separate OpenAPI and scopes | sync status/retry/dead letter/job/adapter/device/health/metrics/deployment state | clinical payload CRUD, billing decision, pharmacist decision |
| Official/Legacy Adapter | private boundary defined by exact official/license artifact | supported protocol/file conversion to/from FHIR or approved transaction model | public reuse as a substitute national interface; guessed/mimicked format |

FHIR R4 confirms that servers choose supported resources/interactions and declare them in
CapabilityStatement. `$operation` is permitted only when the operation definition is
approved, declared, and more appropriate than a standard resource interaction. It is not
a waiver for moving calculation, claim, accounting, device control, or retry state into
FHIR.

## 4. Authority and boundary matrix (22/22)

| ID | domain | authoritative source(s) | write owner | API class | event class | package/module candidate | tenant/store invariant |
|---|---|---|---|---|---|---|---|
| D01 | Patient Identity / Consent | FHIR Patient/RelatedPerson/Coverage/Consent + immutable merge/split lineage; matching decisions are identity-domain records referencing FHIR IDs | yrese for patient/coverage; approved consent origin; no replica writes | Clinical FHIR; business operation only for reviewed merge/split command | FHIR resource/version event + identity decision event with references | `fhir`, `patient-identity`, existing `contracts/shared-kernel` | JWT tenant/store scope; cross-store search requires purpose/consent; name/DOB never auto-merge |
| D02 | Reception / Queue / Appointment | Reception/queue is non-FHIR operations source; clinical Appointment/Encounter remains FHIR when applicable | yrese reception; PH-OS Encounter; Appointment owner per workflow registry | public business for reception; Clinical FHIR for Appointment/Encounter | reception business event; FHIR resource event | `reception` app/domain module; `fhir` | active store/patient fixed; reception cannot mutate clinical replica |
| D03 | Prescription Ingress | immutable source evidence in Adapter archive; accepted clinical result is FHIR MedicationRequest/Medication/Provenance | Adapter proposes; yrese pharmacist-confirmed write | Adapter private + Clinical FHIR | adapter technical event then FHIR resource event | `integration`, `prescription`, `fhir` | source tenant/store bound before parsing; raw source never grants authority |
| D04 | Prescription Lifecycle | versioned FHIR MedicationRequest, Medication, Practitioner/Role, Organization, DetectedIssue/Task/Communication | yrese | Clinical FHIR; approved `$operation` only for atomic reviewed transition if standard interactions insufficient | FHIR resource/version event | `prescription`, `fhir`, `terminology` | PH-OS replicas read-only; no destructive overwrite or cross-tenant reference |
| D05 | Dispensing Workflow | MedicationDispense is FHIR clinical fact; picking/compounding/device step/rework ledger is non-FHIR operations source; Task only where its semantics fit | yrese for dispense; dispensing operations service for work ledger | Clinical FHIR + public business workflow API + Control device API | FHIR dispense event + workflow/reversal/device technical events | `dispensing`, `integration`, `fhir` | pharmacist/store/device context fixed; work ledger cannot rewrite MedicationRequest |
| D06 | Clinical Safety / Audit | FHIR AllergyIntolerance/Condition/Observation/MedicationStatement/DetectedIssue; versioned approved rule/knowledge registry is non-FHIR evidence authority | source clinical server; safety service proposes DetectedIssue; pharmacist resolves | Clinical FHIR; business rule-evaluation command only if approved; no AI final API | FHIR issue/task event + rule evaluation trace reference | `clinical-safety`, `terminology`, `fhir`, existing `trace` | rules and results scoped to patient/store/version; unknown != no issue |
| D07 | Calculation Engine | non-FHIR deterministic calculation result/trace/evidence/rule/master versions with FHIR references | yrese calculation domain | public business API | calculation candidate/final/reversal business events | existing `calculation`, `money`, `date-time`, `trace`; future rules registry | tenant/store/claim month explicit inputs; no DB/current time/external dependency |
| D08 | Claim Lifecycle | non-FHIR claim case/snapshot/lock/electronic receipt/return lineage with FHIR references | yrese claim domain | public business API; Official Adapter handoff | claim snapshot/final/return/resubmit events | `claim`, existing `calculation/trace/date-time` | tenant/store/claim month immutable on finalized snapshot |
| D09 | Accounting / Receivables / POS | non-FHIR append-only Charge/Payment/Allocation/Refund/Adjustment/Invoice/Receipt/Closing ledgers | yrese accounting domain | public business API; payment/POS Adapter private | append-only accounting and compensating events | `accounting`, existing `money/audit` | tenant/store/currency/ledger fixed; calculation result never becomes ledger implicitly |
| D10 | Documents / Legal Records | FHIR DocumentReference/Composition/Binary for clinical documents; non-FHIR template/render/issuance/receipt-number/legal-hold registry | clinical document owner; yrese document/issuance domain | Clinical FHIR + public business document/issuance API + printer Control API | FHIR document event + issuance/print/reissue/destruction events | `documents`, `fhir`, existing `audit/date-time` | recipient/purpose/store bound; print success separate from document creation |
| D11 | Inventory / Procurement / Traceability | non-FHIR append-only inventory/procurement/lot/expiry/recall ledger with Medication/MedicationDispense references | yrese inventory domain | public business API; supplier/device Adapter private | inventory reservation/post/reversal/transfer/recall events | `inventory`, `integration`, existing `events` | store is stock authority; interstore transfer is two-sided controlled transaction |
| D12 | Device / Edge Integration | capability/config/health/queue/retry are Control Plane; clinical output becomes FHIR or referenced business event after validation | device Adapter for technical state; relevant clinical/business owner for accepted result | Technical Control + Adapter private | device technical event; accepted normalized event with FHIR/business reference | `integration`, `edge-sync`; vendor adapters outside core packages | Edge provisioned to one pharmacy; device payload cannot set tenant/store |
| D13 | Eligibility / PMH / e-Prescription | exact official source evidence + immutable inbound result; accepted clinical representation is FHIR Coverage/MedicationRequest/MedicationDispense/Provenance; PMH calculation input is non-FHIR transaction input | Official Adapter proposes; yrese authoritative FHIR/business domains accept | Adapter private + Clinical FHIR + approved claim business API | adapter delivery event + FHIR resource event + claim recheck event | `integration`, `fhir`, `terminology` | official context/certificate/store fixed; unavailable/stale remains pending |
| D14 | Home Care / Facility / PH-OS | PH-OS FHIR Encounter/MedicationStatement/Observation/DetectedIssue/CarePlan/Task/Communication/DocumentReference; route/offline job metadata non-FHIR | PH-OS for listed clinical facts; yrese replicas read-only | Clinical FHIR + public business route/facility API + Control sync API | FHIR resource events + route/sync technical events | `fhir`, PH-OS domain modules, `edge-sync` | no multi-master; facility membership never substitutes tenant/patient consent |
| D15 | Patient Engagement / Online / Delivery | FHIR Communication/QuestionnaireResponse/Consent/DocumentReference and applicable Encounter; delivery/order/handover is non-FHIR business source | yrese/PH-OS clinical owner; engagement/delivery domain for logistics | Clinical FHIR + public business patient/delivery API + partner Adapter | FHIR communication/document event + delivery/notification events | `engagement`, `documents`, `integration`, `fhir` | patient/representative/recipient purpose fixed; carrier receives minimum PHI |
| D16 | Multi-store / HQ / Remote Input | tenant/store/role/delegation configuration non-FHIR; each clinical/business entity keeps its existing authority | no new HQ clinical writer; commands route to authoritative store/server | public business/partner APIs with delegated scopes; Clinical FHIR unchanged | delegated command/audit + existing domain event | `security`, domain services; no generic shared HQ model | corporate membership never bypasses store/consent/role; active target always explicit |
| D17 | Master / Terminology / Regulatory Change | clinical CodeSystem/ValueSet/ConceptMap/package registry; non-FHIR fee/claim/public/program/device masters and evidence/version registry | terminology/master governance service after human approval | Clinical terminology FHIR operations as declared + public admin business API + Control distribution status | master staged/approved/activated/rolled-back events | `terminology`, `masters`, existing `date-time/trace` | global source may distribute; activation is tenant/store/version aware and audited |
| D18 | FHIR / API / Partner Ecosystem | CapabilityStatement/IG/contracts/partner registry and conformance evidence; clinical data remains source domains | FHIR/API governance; resource write owner unchanged | all API classes, strictly separated | FHIR resource/reference webhook + partner/control lifecycle events | `fhir`, `contracts`, generated clients/SDK; no handwritten wire duplicates | scope/audience/purpose/tenant enforced before search/read/export |
| D19 | Analytics / Quality / Management | rebuildable projections only; metric definitions/version are non-FHIR analytics authority | analytics service cannot mutate source domains | public/partner analytics API after privacy approval; Bulk where appropriate | projection/checkpoint/late-correction technical events | `analytics`, existing `events/date-time` | tenant/store aggregation and suppression policy explicit; no source-of-truth claim |
| D20 | Migration / Portability / Cutover | immutable source manifest/mapping/reconciliation/certificate; accepted targets use each target domain's normal authority | migration orchestrator proposes; domain owners accept through normal contracts | migration business/control APIs; Adapter private; FHIR import for clinical | migration stage/accept/reject/reconcile events with target references | `integration`, migration tool app, `test-fixtures`; no core legacy schema | source and target tenant/store bound; no auto merge/code guess; rollback window explicit |
| D21 | Security / Operations / Support / Reliability | auth/policy/device/support/control/config/metrics ledgers non-FHIR; canonical clinical AuditEvent representation and internal tamper evidence have one append path | security/operations services; clinical resource writer unchanged | Technical Control; security admin business contract; Clinical AuditEvent read/search if approved | append-only security/audit/incident/control events | `security`, `edge-sync`, existing `audit/events` | trusted AuthContext only; support session single tenant/store; break-glass audited |
| D22 | Bedrock AI Assist | AI request/config/prompt/output/review metadata non-FHIR control/business record; accepted clinical Draft is appropriate FHIR resource with Provenance | AI proposes; pharmacist/domain owner accepts; no autonomous external writer | public business assist API + Clinical FHIR for reviewed Draft; Control health/config API | AI requested/generated/rejected/accepted/fallback events with FHIR references | `ai`, `security`, `fhir`, existing `audit/trace` | data-class/purpose/model/region/store fixed; PHI/config gate before invocation |

## 5. Resource ownership candidate

| resource group | authoritative server | replica/write rule |
|---|---|---|
| Patient, Coverage, Medication, MedicationRequest, MedicationDispense, Practitioner, PractitionerRole, Organization, Location, AllergyIntolerance, Condition | yrese | PH-OS read-only replica; updates return to yrese workflow |
| Encounter, MedicationStatement, home-care Observation/DetectedIssue/CarePlan/Task/Communication/QuestionnaireResponse/DocumentReference | PH-OS | yrese read-only replica; updates return to PH-OS workflow |
| Consent | purpose/origin-specific registry required before implementation | one logical consent record has one writer; replicas are read-only |
| Provenance | server that creates/transforms the target resource | target/version references mandatory; no shared mutable provenance |
| AuditEvent | event-origin server through one append-only audit path | interoperable FHIR form and tamper ledger metadata must not become two independently writable audits |

Conditional resource ownership (`Observation`, `DetectedIssue`, `Task`, `Communication`,
`DocumentReference`, `Consent`) requires an ownership registry keyed by semantic use case,
not merely `resourceType`. A resource type cannot be assigned globally when both products
legitimately create distinct instances.

## 6. Event catalog classes

| class | payload rule | authority rule | idempotency/recovery |
|---|---|---|---|
| FHIR resource change | encrypted FHIR resource/Bundle or canonical reference + version; no custom clinical DTO | source FHIR server owns resource and version | resource ID + version/event ID; recover from history/delta |
| business domain | approved schema containing business entity ID and FHIR references, not copied clinical fields | owning non-FHIR domain | domain command/event idempotency key; compensating event, never destructive rewrite |
| technical control | cursor/retry/job/lease/health/device status and references only | Control Plane service | delivery ID/attempt; dead letter and replay |
| adapter | raw-source hash/reference, adapter/version, conversion result references, OperationOutcome | Adapter owns conversion evidence, never accepted clinical truth | source ID/hash + adapter version; quarantine/reprocess |
| audit/security | canonical action/outcome/actor/tenant/store/target references plus tamper metadata | single append path | intent/event ID; ambiguous append reconciliation; no update/delete |

Webhook/Subscription delivery cannot introduce a second payload authority. A consumer can
always resolve the authoritative FHIR resource or business entity and recover missed
delivery through history/delta or an approved business cursor.

## 7. Package disposition

| package | disposition | boundary/dependency rule |
|---|---|---|
| existing `shared-kernel`, `money`, `date-time`, `trace`, `events`, `contracts`, `audit`, `calculation` | reuse/amend only | remain runtime-neutral; no duplicate ID/status/error/money/date/audit/event/contract authority |
| `fhir` | candidate new | FHIR wire/resource validation/client/server-neutral primitives; depends on contracts/shared/date-time as approved, never apps/DB/AWS/UI |
| `terminology` | candidate new | CodeSystem/ValueSet/ConceptMap/package validation; no fee-rule duplication |
| `patient-identity` | candidate new | matching/merge/split decision rules referencing FHIR IDs; no second Patient model |
| `prescription` | candidate new | MedicationRequest lifecycle/orchestration; FHIR resource remains clinical source |
| `dispensing` | candidate new | dispensing work ledger and MedicationDispense orchestration; device drivers excluded |
| `claim`, `accounting`, `documents`, `inventory` | candidate new per bounded context | non-FHIR transaction authority; depend on shared primitives and references, not apps or each other's internals |
| `integration` | candidate new umbrella only if subpackages remain isolated | Official/JAHIS/partner adapters separated by artifact/license and dependency; NSIPS quarantined |
| `edge-sync` | candidate new | technical delivery/retry/cursor only; encrypted FHIR/business envelope references |
| `security` | candidate new only for runtime-neutral policy types | no AWS/auth provider SDK in frontend-shared package |
| `ai` | candidate new orchestration contracts | no clinical finalization, calculation, claim, external-send authority |
| `analytics` | candidate new | projection/metric definitions only; no source writes |
| `test-fixtures` | candidate new | synthetic only, profile/contract validated, no production/de-identified-real PHI |
| `shared-types` | reject | would duplicate existing shared-kernel/contracts and hide authority |

Physical package creation requires MOD-001/002/003 amendments and a concrete second
consumer or bounded-context reason. A package name in v0.7 is not creation authority.

Proposed dependency direction:

```text
apps/web -> generated client/contracts/fhir client UI adapters
apps/api -> domain packages + persistence/adapter composition
apps/workers -> integration/edge-sync/domain application services

domain packages -> shared-kernel/money/date-time/trace/events/contracts/fhir references
fhir/terminology/contracts/shared packages -> no apps, DB, AWS, UI
calculation -> no DB, external API, current time, AWS, UI
adapters -> approved domain/FHIR ports; domain packages never import adapters
analytics -> read projections/events; source domains never import analytics
```

## 8. Tenant, pharmacy, and authorization invariants

1. `TenantId`, `PharmacyId`, actor, scopes, audience, and purpose come from trusted
   AuthContext, never FHIR `meta.security`, extension, path/body/query, adapter payload,
   device payload, or partner-supplied tenant fields.
2. Every FHIR read/search/write, business command, event, projection, export, webhook,
   audit append, Edge queue, and support session is tenant scoped. Store scope is explicit
   or a reviewed corporate/system scope.
3. Resource references are resolved under AuthContext. Absolute/cross-tenant references
   are rejected or normalized only by an approved intake ACL.
4. HQ/remote input delegates commands; it does not become a second resource owner.
5. system-wide master distribution and operational monitoring use separate privileged
   Control/admin contracts and cannot read PHI by default.

## 9. Release-WP boundary coverage (40/40)

| release WP | domain boundary | API boundary | package/authority boundary |
|---|---|---|---|
| G0-01 | D01-D22 source governance | none | research/SSOT only |
| G0-02 | D03/D06-D08/D10/D13/D17/D21/D22 evidence | Adapter/none | regulatory evidence, no runtime package |
| G0-03 | D01/D03-D10/D13-D15/D21/D22 controls | none | REG/SEC/SAF amendments only |
| G0-04 | D01-D22 planning | none | release DAG only |
| G0-05 | D01-D22 authority map | all five API classes | ARC/DOM/API/MOD amendments only |
| G0-06 | D01-D05/D07-D10/D13-D15/D21 journeys | Clinical FHIR + public business + Control status | UI contract/prototype only |
| G0-07 | D03/D05/D08-D13/D15/D20-D22 failure/recovery | public business + Control + Adapter | edge-sync/security/migration candidates only |
| G0-08 | D01-D22 decision | none | decision packet, no package |
| G1-01 | D01/D03-D06/D10/D13-D15/D17/D18 | Clinical FHIR | fhir/terminology |
| G1-02 | D01/D03-D06/D10/D13-D15/D17/D18 | Clinical FHIR | fhir/contracts + persistence composition |
| G1-03 | D01/D16 | Clinical FHIR + reviewed identity operation | patient-identity/fhir |
| G1-04 | D01-D22 cross-cutting | all API authorization | security/audit/shared-kernel |
| G1-05 | D03-D08/D11/D13/D17 | terminology FHIR + admin business | terminology/masters/date-time/trace |
| G1-06 | D05/D12-D15/D20-D22 | Control + Adapter | edge-sync/integration/events |
| G1-07 | D01-D22 presentation | Clinical FHIR + public business | generated client/contracts, apps/web |
| G2-01 | D03/D04 | Adapter + Clinical FHIR | prescription/fhir/integration |
| G2-02 | D07/D13/D17 | public business | calculation/money/date-time/trace |
| G2-03 | D10 | Clinical FHIR + public business + printer Control | documents/fhir/audit |
| G2-04 | D09 | public business | accounting/money/audit |
| G2-05 | D08 | public business + claim Adapter handoff | claim/calculation/trace |
| G2-06 | D13 | Adapter + Clinical FHIR + claim business | integration/fhir/terminology |
| G2-07 | D06 | Clinical FHIR + approved evaluation business | clinical-safety/terminology/trace |
| G2-08 | D02-D05/D07-D10/D12/D13/D20/D21 | business + Control + Adapter | edge-sync/events/domain packages |
| G2-09 | D01/D03-D11/D17/D20 | migration Control/Adapter/FHIR import | migration app/integration/test-fixtures |
| G2-10 | D01-D13/D17/D20/D21 | all applicable non-partner APIs | release evidence only |
| G3-01 | D05/D06/D10/D12 | Clinical FHIR + dispensing business + device Control | dispensing/fhir/integration |
| G3-02 | D08 | public business + return Adapter | claim/integration |
| G3-03 | D09/D12/D14 | public business + payment/POS Adapter | accounting/integration/security |
| G3-04 | D05/D11/D17 | public business + supplier Adapter | inventory/integration/events |
| G3-05 | D05/D11/D12 | Control + Adapter | integration/edge-sync |
| G3-06 | D21 | Technical Control + security admin | security/edge-sync/audit |
| G3-07 | D01-D13/D17/D20/D21 | release evidence, no new API | operations/release evidence |
| G4-01 | D14 | Clinical FHIR + route business + sync Control | fhir/edge-sync/PH-OS modules |
| G4-02 | D09-D11/D14 | Clinical FHIR + facility business | PH-OS/accounting/documents/inventory |
| G4-03 | D01/D10/D15 | Clinical FHIR + engagement/delivery business + partner Adapter | engagement/documents/integration |
| G4-04 | D14/D22 | assist business + Clinical FHIR Draft + AI Control | ai/fhir/security/audit |
| G5-01 | D11/D16/D19/D20 | public business/partner with delegated scope | security/domain modules/analytics projections |
| G5-02 | D18 | Clinical FHIR + Partner | fhir/contracts/generated SDK |
| G5-03 | D06/D18/D19/D22 | Clinical FHIR operations/Subscription/Bulk/CDS | fhir/analytics/ai when approved |
| G5-04 | D11/D16/D19/D22 | Partner analytics + approved business | analytics/events/date-time |

## 10. SSOT amendment batch

Order matters to avoid an interval where contradictory APPROVED documents can be used:

1. amend ARC-008 with the final clinical resource/Provenance/AuditEvent and transaction
   boundary decision;
2. in the same PRC-007 batch, replace DOM-005's facade-only body and resolve its
   `PENDING_REVISION` stamp;
3. amend DOM-001 bounded contexts from 14 MVP contexts to the approved v0.7 context map
   without deleting existing accounting/claim authorities;
4. amend DOM-006 resource/semantic-use-case ownership and mapping registries;
5. amend API-002/003/004 and promote/replace the FHIR REST contract so Clinical FHIR,
   public business, Partner, Control, and Adapter APIs cannot be confused;
6. amend MOD-001/002/003 before creating packages or changing dependency checks;
7. align DB/event/security/offline/PH-OS/claim documents and tests in the same controlled
   migration train; no constant/schema-only partial cutover.

## 11. Automated acceptance checks

WP-0054f is locally ready only if:

- 22 unique domain rows exist;
- every row has authority, write owner, API, event, package, and tenant/store rule;
- API classes are exactly Clinical FHIR, public business, Partner, Technical Control, and
  Official/Legacy Adapter;
- direct DB integration count is zero;
- hidden UI clinical API count is zero;
- `shared-types` disposition is reject;
- all 40 release WPs from WP-0054e can map to at least one domain/API/package boundary;
- current APPROVED conflicts and amendment order remain explicit;
- no runtime/SSOT implementation authority is asserted.

Exact next action after landing: WP-0054g uses these authoritative context and API classes
to define the three critical journeys, Guided/Expert shared state, performance measurement,
accessibility/safety acceptance, and KPI evidence. Gate 1 remains blocked by G0-08.
