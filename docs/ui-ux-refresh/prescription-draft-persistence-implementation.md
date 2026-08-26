# Prescription draft persistence slice

This implementation adds a server-saved, versioned prescription draft for the existing reception-to-prescription launch flow.

## Data lineage

```text
/prescriptions/[receptionId]
  -> authenticated reception queue lookup
  -> exact tenant + pharmacy + reception + business-date match; patient derived server-side
  -> GET/PUT /prescription-drafts/by-reception/:receptionId
  -> PrescriptionDraftService
  -> prescription_drafts / prescription_draft_rows / prescription_draft_flags
  -> prescription.created / prescription.updated / prescription.draft.viewed audit evidence
```

The route and body identifiers select a candidate only. They never replace the authenticated tenant/pharmacy context or the patient identity returned by the reception contract.

## Included

- one draft per authenticated tenant/pharmacy/reception
- exact reception/patient/business-date revalidation
- structured PostgreSQL tables for metadata, RP rows, and bounded draft flags
- optimistic concurrency using `expectedVersion`
- stale writes conflict even when their payload matches; no retry is claimed without an idempotency key
- atomic write and successful-read audit evidence in PostgreSQL mode
- fixed PHI-free 400/404/409 responses and `Cache-Control: no-store`
- real-calendar validation for business and prescription dates
- in-memory and PostgreSQL implementations with the same result semantics

## HTTP contract

```text
GET /prescription-drafts/by-reception/:receptionId?date=YYYY-MM-DD
PUT /prescription-drafts/by-reception/:receptionId
```

Required read scopes: `prescription:read`, `reception:read`, `patient:read`.
Required write scopes: `prescription:write`, `reception:read`, `patient:read`.

A first save uses `expectedVersion: 0` without `If-Match`. A subsequent save must use the version returned by the server and send the same quoted version in `If-Match`. A stale version returns 409 without returning the current clinical payload. This endpoint does not claim retryable-create behavior while API-013 retention remains unresolved.

## Database boundary

Migration `000013_create_prescription_drafts.sql` is additive and contains no backfill. The database enforces the exact reception/patient/business-date relationship through a composite foreign key. RP rows and bounded draft flags are structured tables; clinical business values are not stored as an opaque JSON document.

The migration file being present in source does not authorize applying it to production or staging. Application remains an explicit DB-002 operational action.

## Excluded

- MedicationRequest ingestion or FHIR conformance claims
- pharmacist confirmation/finalization
- calculation, dispensing, claim, or external synchronization
- production or staging migration application
- persistent storage of production PHI in CI, screenshots, fixtures, or logs

## Required gates before merge

- workspace typecheck
- unit, route, migration, and PostgreSQL integration tests
- production build
- OpenAPI drift check
- secrets, dependency, SBOM, boundary, calculation-purity, and SSOT-index checks
- independent security/data-integrity review

## Remaining implementation groups

1. Publish the generated OpenAPI path and schema artifact.
2. Connect the existing prescription workspace to draft load/save, loading, permission, error, and conflict states.
3. Implement pharmacist confirmation and immutable finalized versions as a separate bounded phase.
