# Prescription launch slice — adversarial review

## Closed in this branch

- Route values are not authorization evidence.
- The existing authenticated tenant/pharmacy reception queue is re-fetched with `no-store` before the editable workspace is rendered.
- Patient selection is mandatory and mismatches stop the workflow.
- Patient identity is excluded from the workflow URL and comes from the authenticated queue.
- Missing reception, cross-patient identity, permission failure, malformed input, and partial API failure fail closed.
- No fixed patient, medication, calculation, or clinical safety result is introduced.

## Remaining before durable draft persistence

- APPROVED prescription-draft storage model and single-writer authority.
- Idempotent create contract and optimistic concurrency contract.
- Atomic audit/outbox behavior for create/update/confirm.
- Pharmacist confirmation and immutable versioning.
- Tenant/RLS integration evidence and negative tests.
