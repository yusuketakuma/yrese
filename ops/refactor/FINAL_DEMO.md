# Final local demo record

## Status

`DEMO_REQUIRED` as of 2026-07-16. The repository-wide final demo has not been completed, and this file must not be read as release readiness.

## Current automated evidence

- Frozen install with pnpm 11.13.1 succeeds without lockfile changes.
- Workspace typecheck, unit/contract tests and production builds pass.
- API tests: 270 passed; 14 PostgreSQL integration tests are expected local skips because `TEST_DATABASE_URL` is absent.
- Web tests: 336 passed. Audit tests: 183 passed. Calculation tests: 87 passed.
- OpenAPI, calculation purity, boundaries, SSOT index (173), dependency audit (high=0, critical=0), SBOM (231), script harness and diff checks pass.
- Secret scan passes on the tracked snapshot. The live shared worktree intentionally fails closed on the user-owned ignored `.codegraph` symlink; that environment artifact was not removed or allowlisted.

## Partial browser evidence

- Synthetic-only development API/Web servers passed health and normal shutdown checks.
- Patient search, patient selection, reception registration, queue reflection and patient-context clear were completed through the browser. Registration exposed no freeform Patient ID and disabled submission after context clear.
- The independent WP-4149 rerun used native double-click and observed exactly one create POST plus one authoritative queue GET, matching WAITING identity, then context clear disabled registration and cleared the result while retaining committed queue history. The API completed too quickly to capture transient pending UI or an in-flight patient switch.
- A stale-build hydration failure initially let the patient query fall through to a native GET URL. WP-4163 fixed the SSR fallback to POST `/patients` with no named query control; static regression, independent privacy review and fresh hydrated pointer search passed with a query-free `/patients` URL. Full JavaScript-disabled native submission could not be automated and is not claimed.
- Viewports 375, 768 and 1280 had no page-level horizontal overflow. The selected-patient mobile form was visually inspected; browser console and page-error capture were empty.
- An independent responsive rerun measured the 375px table scroller at 343px client width, 535px content width and 192px maximum scroll. Both patient-selection actions remained fully visible at scroll 0 and 192; Tab reached the first action with a 3px focus ring, pointer selection preserved the displayed kana/name/birth identity, and 768/1280 page overflow plus console/page errors remained zero. Browser-CLI Enter did not produce a state transition, so keyboard activation itself is not claimed.
- After a synthetic reception create, the `/admin` browser journey displayed `reception.created` and `audit.viewed` with a normal verified hash chain.
- A controlled synthetic `/admin` refresh sequence returned 200 with two verified rows, exact HTTP 500 with a raw sentinel, then 200 with one replacement row. After the 500, the browser retained the two verified rows and normal chain, displayed the stale-data qualifier, fixed error and retry, and did not expose the raw sentinel. Retry cleared the error, installed the one-row response and restored the idle refresh action. The browser command's native ref/semantic click and Enter did not dispatch this session, so the application retry was invoked with a page-context DOM click and is not keyboard/native-input evidence.
- A controlled reception-queue sequence returned 200 with one retained row, exact HTTP 500 with a raw sentinel, then 200 with a replacement row. Native `表示` activation issued both refresh requests. The 500 retained the prior row/date/last-updated value, displayed fixed error, stale qualifier and next action, and exposed neither the raw sentinel nor the future replacement. Retry replaced the old row, cleared stale/error state and left browser console/page errors empty.
- A controlled reception-registration sequence used one selected synthetic patient and native submit twice. The first response was an exact HTTP 500 from a mock path known not to commit: pending UI disabled the submit action, failure produced no success or queue reload, retained patient/target context, displayed fixed recovery copy, suppressed raw sentinel/errorCode/stack, and re-enabled submit. The second response was 201/WAITING: success appeared, the authoritative queue reloaded once and displayed the matching row, and console/page errors remained empty. Both POST bodies referenced the same patient and carried valid opaque 36-character keys, but the keys differed. This therefore proves only known-non-commit retry recovery, not idempotent safety after an ambiguous committed outcome. The existing PatientHeader also exposes its identifier in a `data-patient-id` DOM attribute; identifier absence from DOM is not claimed.
- Production Web clean sequence passed: root evidence showed a dev-format `.next` rejected by `next start`, then a 12-page build, ready in 237 ms, explicit disconnected/not-synced `/sync-status`, and normal shutdown. An independent fresh rerun built 12 static pages in 6.10s, became ready in 270ms, returned `/sync-status` HTTP200 in 31.983ms, rendered the exact backend-disconnected/not-synced copy with console/page errors 0, and released the port after shutdown. The independent run did not repeat the dev-format rejection. The simultaneous fixed-NORMAL `通常稼働` label is not health-detection success evidence.
- These are bounded development journeys plus a production Web static-route startup check; they do not prove PostgreSQL, production API/authentication, tenant isolation, clinical production journeys or repository-wide release readiness.

## Not yet demonstrated

- Clean PostgreSQL migration/seed and zero-skip integration run.
- Production API startup/health/restart and a production Web clinical journey. Production Web build/start/static-route/shutdown alone is demonstrated.
- Real authentication callback/cancel/session expiry/logout and role allow/deny.
- Tenant-crossing runtime attempts against a disposable DB.
- Reception registration under ambiguous outcomes (commit-before-response-loss, timeout or unknown server result). The known-non-commit synthetic HTTP 500/retry path is browser-demonstrated, but the two attempts used different idempotency keys; WP-4151c requires human-approved semantics before implementation. Reception queue refresh failure/recovery is browser-demonstrated; audit retry native pointer/keyboard activation remains part of the broader input/accessibility gap below.
- Complete keyboard/focus/200%-zoom/forced-colors/reduced-motion, detailed network inspection and hydration checks. Existing table horizontal-scroll behavior remains a documented P2 responsive risk.
- Offline/sync/upload flows; these are not implemented and must not be simulated as passing.
- Placeholder routes for prescription, checkout, claim check, masters and closing; their domain/SSOT gates remain unresolved.

## Exact next demo gate

1. Provide a disposable PostgreSQL URL and run the integration suite with zero skips.
2. Add a disposable production-like API/auth environment, then execute the production Web clinical journey and restart checks. Web build/start/static placeholder proof is already recorded.
3. Obtain human-approved reception-create idempotency semantics, then prove ambiguous-outcome retry; separately complete native keyboard/focus/zoom/forced-colors/network/accessibility evidence.
4. Keep blocked placeholder journeys marked not implemented; do not substitute mock success.
