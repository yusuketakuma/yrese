# Final local demo record

## Status

`DEMO_REQUIRED` as of 2026-07-16. The repository-wide final demo has not been completed, and this file must not be read as release readiness.

## Current automated evidence

- Frozen install with pnpm 11.13.1 succeeds without lockfile changes.
- Workspace typecheck, unit/contract tests and production builds pass.
- API tests: 270 passed; 14 PostgreSQL integration tests are expected local skips because `TEST_DATABASE_URL` is absent.
- Web tests: 335 passed. Audit tests: 183 passed. Calculation tests: 87 passed.
- OpenAPI, calculation purity, boundaries, SSOT index (173), dependency audit (high=0, critical=0), SBOM (231), script harness and diff checks pass.
- Secret scan passes on the tracked snapshot. The live shared worktree intentionally fails closed on the user-owned ignored `.codegraph` symlink; that environment artifact was not removed or allowlisted.

## Not yet demonstrated

- Clean PostgreSQL migration/seed and zero-skip integration run.
- Production-like API/Web startup, health/readiness/restart/shutdown.
- Real authentication callback/cancel/session expiry/logout and role allow/deny.
- Tenant-crossing runtime attempts against a disposable DB.
- Browser journeys for patient search/switch, reception create/retry, audit view/error retention.
- Mobile/tablet/desktop, keyboard/focus/zoom/forced-colors and console/network/hydration checks.
- Offline/sync/upload flows; these are not implemented and must not be simulated as passing.
- Placeholder routes for prescription, checkout, claim check, masters and closing; their domain/SSOT gates remain unresolved.

## Exact next demo gate

1. Provide a disposable PostgreSQL URL and run the integration suite with zero skips.
2. Start production builds locally with synthetic-only data and approved development authentication.
3. Execute the reachable patient/reception/audit journeys and record browser/network/accessibility evidence.
4. Keep blocked placeholder journeys marked not implemented; do not substitute mock success.
