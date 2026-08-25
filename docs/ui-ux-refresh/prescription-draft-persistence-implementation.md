# Prescription draft persistence slice

This implementation adds a server-saved, versioned prescription draft for the existing reception-to-prescription launch flow.

## Included

- one draft per authenticated tenant/pharmacy/reception
- exact reception/patient/business-date revalidation
- structured PostgreSQL tables for metadata, RP rows, and bounded draft flags
- optimistic concurrency using `expectedVersion`
- idempotent replay for an already committed identical payload
- atomic `prescription.created` / `prescription.updated` audit evidence in PostgreSQL mode
- fixed PHI-free 400/404/409 responses and `Cache-Control: no-store`

## Excluded

- MedicationRequest ingestion or FHIR conformance claims
- pharmacist confirmation/finalization
- calculation, dispensing, claim, or external synchronization
- production migration application

The migration is additive and must be applied only through the existing DB-002 operational gate.
