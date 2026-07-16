# Verification record

## Current validated tree (2026-07-16)

| Command / evidence | Result |
|---|---|
| `pnpm -r typecheck` | PASS (all workspaces) |
| `pnpm -r test` | PASS: API 270 + 14 expected PostgreSQL skips, Web 336, audit 183, calculation 87; all other packages PASS |
| `pnpm -r build` | PASS, including Next.js production build |
| `pnpm install --frozen-lockfile` | PASS with pnpm 11.13.1; lockfile unchanged; only esbuild/sharp build scripts explicitly allowed |
| `pnpm check:openapi` | PASS |
| `pnpm check:ssot-index` | PASS, 173 documents |
| `pnpm check:boundaries` | PASS |
| tracked-snapshot `pnpm check:secrets` | PASS; live shared worktree fails closed on ignored user-owned `.codegraph` symlink |
| `pnpm check:deps` | PASS, high=0 / critical=0 |
| `pnpm check:sbom` | PASS, 231 components |
| `pnpm check:calculation-purity` | PASS |
| `pnpm test:scripts` | PASS |
| `git diff --check` | PASS before every landing |

## Environment-limited checks

- PostgreSQL integration: 14 expected local skips because `TEST_DATABASE_URL` is absent. No DB connection, migration or DML was performed in this goal run.
- Synthetic development browser evidence now covers patient search/select, reception create/queue reflection/context clear, audit success display/hash-chain status, 375/768/1280 page-overflow checks and clean console/error capture on the completed journeys. Audit refresh failure retention remains component-test-only after two browser automation tool failures; production-like startup, error/retry and accessibility coverage remain `DEMO_REQUIRED`. See `EVIDENCE.md` and `FINAL_DEMO.md`.
- WP-3010a/WP-3011a are intentionally dormant fixture-only components. Browser/live API flow is not claimed; their parent tasks are BLOCKED with concrete unlock conditions.
- Production HTTPS/HSTS, deploy, external systems, PHI production data and infrastructure were not exercised and remain human-gated.
