# Prescription draft vertical slice — bounded implementation record

## Scope implemented in this branch

- Adds a reception-scoped prescription route: `/prescriptions/[receptionId]?date=YYYY-MM-DD`.
- Treats route values as untrusted selectors, never as authorization evidence.
- Re-fetches the existing authenticated, tenant/pharmacy-scoped reception queue for the stated business date.
- Requires the selected patient context and queue entry patient to match before rendering the prescription workspace.
- Keeps the current in-tab unsaved draft and clinical/calculation unavailable boundaries unchanged.

## Explicitly not implemented

The current repository does not yet authorize a prescription-draft database schema, durable writer, confirmation command, or MedicationRequest cutover in this bounded UI slice. Therefore this branch does not add:

- DB schema or migration
- durable prescription draft storage
- pharmacist confirmation API
- calculation, billing, or clinical decision claims
- external prescription transmission

Those items require the relevant APPROVED SSOT and human gates before implementation.

## Acceptance for this slice

1. Ambiguous or malformed launch parameters fail closed.
2. A missing selected patient blocks the workspace before API use.
3. The reception must exist in the authenticated tenant/pharmacy queue for the requested business date.
4. The queue entry patient must match the selected patient.
5. Unknown, missing, or failed reception context never degrades to an unverified editable workspace.
6. No production mock patient, medication, or prescription data is introduced.
