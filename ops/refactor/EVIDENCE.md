# Refactor evidence index

Updated on 2026-07-16. This file is the durable index for the active repository-improvement goal. It points to authoritative records instead of duplicating their full command output.

## Evidence authority

| Evidence class | Authoritative record | Current status |
|---|---|---|
| Repository structure and commands | `CODE_MAP.md` | CURRENT |
| Frontend/backend/API/persistence alignment | `FULLSTACK_ALIGNMENT.md` | PARTIAL; explicit blockers retained |
| Automated validation | `VERIFICATION.md` | PASS with documented environment limits |
| Browser and local-demo journeys | `FINAL_DEMO.md` | DEMO_REQUIRED |
| Resume point, blockers and rollback | `STATE.md` | CURRENT |
| High-risk changes | `HIGH_RISK_CHANGES.md` | Human gates remain authoritative |

## Landed evidence groups

| Work package | Implementation evidence | Ledger evidence | Result |
|---|---|---|---|
| WP-0053 | `050df59` | `Plans.md` FHIR Native v0.5 section | Phase 0 through Phase 5 work split landed; approval gates remain closed |
| WP-4149 | `7ba1003` | `30bca4a` | Reception registration accepts only the selected Patient Context |
| WP-4150 | `87b5c41` | `f28921a` | Patient selection action remains reachable at narrow widths |

All commits above are pushed to `origin/agent/reconcile-wp9002-w7c-20260712`. Commit presence does not satisfy independent verification, human approval or final-demo gates by itself.

## Current browser evidence

- Environment: development API and Web servers, in-memory repositories, explicit development-only tenant stub, synthetic fixtures only.
- Patient/reception: patient search, selection, reception registration, queue reflection and context clear passed. The registration form has no freeform Patient ID input.
- Responsive: 375, 768 and 1280 CSS-pixel viewports had no page-level overflow. At 375, the patient-selection action remained inside the viewport before and after horizontal table scrolling.
- Audit success path: after a synthetic reception was created, `/admin` displayed `reception.created` and `audit.viewed`; the displayed hash chain was verified as normal.
- Browser console/page-error capture was empty for the completed patient/reception and responsive journeys.

## Evidence not obtained

- Audit refresh failure retention is covered by the 50-test `audit-log-view.test.tsx` component suite, but not by browser evidence. Both network-abort interception and an immediate synthetic `fetch` rejection caused the browser automation session itself to stop responding before post-failure DOM capture. Those attempts are tool failures, not application pass or fail evidence.
- The reduced-motion browser setting did not report an active media query in the automation session, so no reduced-motion conformance claim is made. Forced-colors, 200% zoom focus flow and detailed network/hydration capture remain unverified.
- PostgreSQL integration, real authentication, role/tenant denial, production-like startup and clean restart remain unverified. See `FINAL_DEMO.md`.

## Evidence rules

- Never use production credentials, PHI or real patient data in local evidence.
- A test proves only the path and invariant it asserts; component tests do not substitute for browser, database or production-like evidence.
- Environment/tool failures remain explicit and do not become green evidence.
- `DEMO_REQUIRED`, `VERIFY_REQUIRED`, human gates and expected PostgreSQL skips remain open until direct evidence closes them.
