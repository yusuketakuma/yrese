# Verification record

## Current validated tree (2026-07-11)

| Command / evidence | Result |
|---|---|
| `pnpm -r typecheck` | PASS (all workspaces) |
| `pnpm -r test` | PASS: audit 182, trace 37, contracts 86, web 99, API 161 + 9 expected PostgreSQL skips; all other packages PASS |
| `pnpm -r build` / focused web and audit builds | PASS |
| WP-4078 focused fingerprint | PASS 80/80 |
| WP-4080 resolver/search/reception focused | PASS 59/59 |
| `pnpm check:openapi` | PASS |
| `pnpm check:ssot-index` | PASS, 173 documents |
| `pnpm check:boundaries` | PASS |
| `pnpm check:secrets` | PASS |
| `pnpm check:deps` | PASS, high=0 / critical=0 |
| `pnpm check:sbom` | PASS, 231 components |
| `pnpm check:calculation-purity` | PASS |
| `pnpm test:scripts` | PASS |
| `git diff --check` | PASS before every landing |

## Environment-limited checks

- PostgreSQL integration: 9 expected local skips because `TEST_DATABASE_URL` is absent. No DB connection, migration or DML was performed in this goal run.
- WP-3010a/WP-3011a are intentionally dormant fixture-only components. Browser/live API flow is not claimed; their parent tasks are BLOCKED with concrete unlock conditions.
- Production HTTPS/HSTS, deploy, external systems, PHI production data and infrastructure were not exercised and remain human-gated.
