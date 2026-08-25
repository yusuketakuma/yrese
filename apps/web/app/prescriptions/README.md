# Prescription workspace route boundary

The existing `/prescriptions` route remains the patient-context-only draft workspace.

A direct reception-scoped verification URL uses:

```text
/prescriptions/{receptionId}?date=YYYY-MM-DD
```

The URL values are selectors only. Queue results and direct verification URLs both pass through the existing guarded handoff to `/prescriptions`. Before the workspace is rendered, the client re-fetches the authenticated tenant/pharmacy-scoped reception queue and verifies:

1. a patient is explicitly selected;
2. the reception exists in the authenticated queue;
3. the queue entry patient equals the selected patient;
4. the reception is still `WAITING` or `IN_PROGRESS`;
5. changing reception cannot reuse a same-patient unsaved draft without explicit confirmation.

Durable draft persistence, confirmation, calculation, and external transmission remain unavailable until their approved contracts and storage authority are present.
