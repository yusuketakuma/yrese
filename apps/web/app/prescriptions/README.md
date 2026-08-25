# Prescription workspace route boundary

The existing `/prescriptions` route remains the patient-context-only draft workspace.

A reception-scoped launch uses:

```text
/prescriptions/{receptionId}?date=YYYY-MM-DD
```

The URL values are selectors only. Before the workspace is rendered, the client re-fetches the existing authenticated and tenant/pharmacy-scoped reception queue for the business date and verifies:

1. a patient is explicitly selected;
2. the reception exists in the authenticated queue;
3. the queue entry patient equals the selected patient.

Durable draft persistence, confirmation, calculation, and external transmission remain unavailable until their approved contracts and storage authority are present.
