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

Durable draft persistence is connected: the workspace loads and saves the server draft through `GET`/`PUT /prescription-drafts/by-reception/:receptionId` with optimistic concurrency (version + `saveDisposition`). A successful save is a draft save only.

Pharmacist confirmation, clinical judgement, calculation and external transmission remain unavailable, and the screen names the gate that stops each one:

- pharmacist confirmation (SCR-014, `dispensing:confirm`) — no registered API operation;
- duplicate-therapy and contraindication checking — `RB-007 BLOCKED_PMDA_SAMD_REVIEW`;
- points, drug prices and calculation — `RB-008 BLOCKED_REGULATORY_REVIEW`;
- past prescriptions, lab values, patient tasks and evidence — no patient-scoped API.

The screen is SCR-004 (prescription entry workspace). SCR-006 (electronic prescription intake) is a different, `RB-003`-blocked screen and is not served by this route.
