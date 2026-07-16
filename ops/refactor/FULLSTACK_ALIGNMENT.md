# Full-stack alignment

Validated against the live tree on 2026-07-16. This file records current wiring; it does not promote blocked placeholders to implemented features.

| Backend/API surface | Frontend consumer / screen | Auth and tenant boundary | Persistence | Status | Evidence / next gate |
|---|---|---|---|---|---|
| `GET /health` | none | public operational probe; no tenant context | none | INTENTIONAL_ONE_SIDED | `apps/api/src/server.ts`; health contract/OpenAPI tests |
| `GET /whoami` | none | `tenant:read`; authenticated scope is returned through the contract | none | VERIFY_REQUIRED | Contract/OpenAPI are implemented, but no current Web consumer exists. Decide its real-auth bootstrap role with the authentication SSOT; do not add a speculative screen. |
| `GET /patients/search` | `/patients` patient search | `patient:read`, tenant/pharmacy scoped, no-store | in-memory or PostgreSQL patient repository | ALIGNED | `patient-search.tsx` parses `patientSearchResponseSchema`; API validates query/cursor/identity/limit. |
| `GET /patients/:patientId` | cross-screen `PatientContextProvider` refresh | `patient:read`, tenant/pharmacy scoped, no-store | in-memory or PostgreSQL patient repository | ALIGNED | client requires exact 200/404 and response identity; API binds repository identity before response. |
| `GET /reception/queue` | `/` reception dashboard | `reception:read` + `patient:read`, tenant/pharmacy scoped, no-store | in-memory or PostgreSQL reception repository | ALIGNED | client and API parse the reception contract and independently reject identity/date/order drift. |
| `POST /reception` | `/` reception dashboard create flow | `reception:write` + `patient:read`, tenant/pharmacy scoped, no-store | reception repository + append-only audit record | ALIGNED | Registration accepts only the globally selected `PatientContext`; there is no freeform clinical identifier input. Unselected state fails closed, selection changes clear stale results, and in-flight patient changes are reported without leaking the submitted identifier. 200/201/404/409 handling, idempotency, patient binding and duplicate-submit controls are covered. |
| `GET /audit/events` | `/admin` audit log panel | `audit-log:read`, tenant/pharmacy scoped, no-store | in-memory or PostgreSQL append-only audit repository | ALIGNED | full-chain verification precedes display projection; Web revalidates count/order/window/identity. |

## Reachable one-sided UI

| Route | Current state | Classification | Unlock condition |
|---|---|---|---|
| `/prescriptions` | fixture-only patient/prescription components plus explicit unimplemented copy | INTENTIONAL_PLACEHOLDER / BLOCKED | approved prescription data model, API contract, authorization and live route |
| `/checkout` | explicit unimplemented copay/receipt/receivable placeholder | INTENTIONAL_PLACEHOLDER / BLOCKED | regulatory calculation evidence and accounting/payment contracts |
| `/claim-check` | explicit pre-claim inspection placeholder | INTENTIONAL_PLACEHOLDER / BLOCKED | regulatory record-condition evidence and claim contract |
| `/masters` | explicit master-version/update placeholder | INTENTIONAL_PLACEHOLDER / BLOCKED | approved master update pipeline SSOT |
| `/monthly-closing` | explicit closing/claim-lock placeholder | INTENTIONAL_PLACEHOLDER / BLOCKED | calculation engine and closing API contract |
| `/sync-status` | explicit disconnected state; never presented as synced | INTENTIONAL_PLACEHOLDER / BLOCKED | offline/sync persistence and mode detection contracts |
| `/admin` tenant/user/permission management copy | audit viewer is live; management controls remain explicit placeholders | PARTIAL / BLOCKED | permission-scope registry and real authentication/administration design |

## Mapping conclusion

- No unblocked backend-only business capability lacks a required frontend.
- No unblocked functional frontend lacks a backend. Reachable placeholders are intentionally non-functional and name their gates.
- `/whoami` remains the only non-operational one-sided API decision. It must not be wired speculatively before the real-auth bootstrap contract is approved.
- Production authentication, PostgreSQL integration execution, offline/sync, claim/accounting/calculation evidence and placeholder journeys remain outside demonstrated readiness.
