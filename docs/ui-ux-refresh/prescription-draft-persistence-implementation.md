# Prescription draft persistence slice

This implementation adds a server-saved, versioned prescription draft and connects it to the existing reception-to-prescription operator workspace.

## Scope discipline

The primary implementation surface is frontend UI/UX. Backend work is limited to the read/write contracts and persistence boundary required by that UI. It does not introduce a second API client, a parallel state store, calculation logic, pharmacist confirmation, or unrelated domain services.

## Data lineage

```text
reception dashboard handoff
  -> selected patient + reception origin in the existing app context
  -> authenticated reception queue lookup
  -> exact tenant + pharmacy + reception + patient + business-date match
  -> GET/PUT /prescription-drafts/by-reception/:receptionId
  -> PrescriptionDraftService
  -> prescription_drafts / prescription_draft_rows / prescription_draft_flags
  -> prescription.created / prescription.updated audit evidence
```

The route, context, query, and body identifiers select a candidate only. They never replace the authenticated tenant/pharmacy context or the patient identity returned by the reception contract.

## Connected frontend behavior

- reception and patient relationship is revalidated before rendering the editor
- existing draft loading and blank-draft empty state
- initial loading, permission denied, invalid response, unavailable service, and retry states
- versioned save using the server-provided baseline version
- visible saved, dirty, saving, and save-result states
- tab-local unsaved recovery keyed by both patient and reception
- unsaved guard removal after a successful server save
- 409 conflict stop with explicit local-versus-server decision; no silent overwrite or automatic merge
- keyboard-reachable data table and safety rail
- synthetic browser evidence for create, save, route change, reload, update, patient switch, reflow, forced colors, and axe checks

## Operator-facing capability boundary

The workspace explicitly separates the stages below:

1. reception and patient verification — connected and completed before editing
2. draft input and versioned save — connected
3. clinical review — unavailable
4. pharmacist confirmation — unavailable
5. finalization and calculation — unavailable

A successful draft save does not mean the prescription was clinically checked, pharmacist-confirmed, finalized, calculated, dispensed, or submitted for claim.

Shared warning surfaces use the visible label `機能境界`; connected screens are not described as static UI prototypes.

## Included backend boundary

- one draft per authenticated tenant/pharmacy/reception
- exact reception/patient/business-date revalidation
- structured PostgreSQL tables for metadata, RP rows, and bounded draft flags
- optimistic concurrency using `expectedVersion`
- idempotent replay for an already committed identical payload
- atomic `prescription.created` / `prescription.updated` audit evidence in PostgreSQL mode
- fixed PHI-free 400/404/409 responses and `Cache-Control: no-store`
- real-calendar validation for business and prescription dates
- in-memory and PostgreSQL implementations with the same result semantics

## HTTP contract

```text
GET /prescription-drafts/by-reception/:receptionId?patientId=...&date=YYYY-MM-DD
PUT /prescription-drafts/by-reception/:receptionId
```

Required read scopes: `prescription:read`, `reception:read`, `patient:read`.
Required write scopes: `prescription:write`, `reception:read`, `patient:read`.

A first save uses `expectedVersion: 0`. A subsequent save must use the version returned by the server. A stale version returns 409 without returning the current clinical payload. Retrying an identical request after an already committed save returns `saveDisposition: replayed` without another mutation or audit event.

## Database boundary

Migration `000013_create_prescription_drafts.sql` is additive and contains no backfill. The database enforces the exact reception/patient/business-date relationship through a composite foreign key. RP rows and bounded draft flags are structured tables; clinical business values are not stored as an opaque JSON document.

The migration file being present in source does not authorize applying it to production or staging. Application remains an explicit DB-002 operational action.

## Excluded

- patient-specific past-prescription read API
- MedicationRequest ingestion or FHIR conformance claims
- clinical alerts, laboratory results, or evidence retrieval
- pharmacist confirmation and immutable finalized versions
- calculation, dispensing, claim, or external synchronization
- production or staging migration application
- persistent storage of production PHI in CI, screenshots, fixtures, or logs

## Required gates before merge

- workspace typecheck
- unit, route, migration, and PostgreSQL integration tests
- production build
- OpenAPI drift check
- secrets, dependency, SBOM, boundary, calculation-purity, and SSOT-index checks
- browser create/save/reload/update and local-draft isolation checks
- axe, keyboard, reflow, and forced-colors checks
- independent security/data-integrity and operator-UX review

## Remaining implementation groups

1. Add the patient-specific past-prescription read model and place real history in the existing left column.
2. Add clinical alerts/evidence only after their approved contracts exist.
3. Implement pharmacist confirmation and immutable finalized versions as a separate bounded phase.
4. Connect calculation and claim flows only after the draft-to-confirmed boundary is approved.
