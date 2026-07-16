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
- Synthetic development browser evidence now covers patient search/select, reception create/queue reflection/context clear, reception queue exact-500 retention/raw-suppression/native retry/replacement, reception registration known-non-commit exact-500/no-false-success/native retry/queue reload, audit success/hash-chain status, and audit refresh exact-500 retention/raw-suppression/retry recovery. Focused audit 50/50, reception dashboard 70/70, and combined reception/patient-context 139/139 passed. Registration retry used different idempotency keys, so ambiguous committed outcomes remain unproved and human-gated. Audit retry native input, production-like API/auth and broader accessibility remain `DEMO_REQUIRED`. See `EVIDENCE.md` and `FINAL_DEMO.md`.
- Production Web evidence covers root build/start (12 pages, ready 237ms) plus an independent fresh build (12 pages/6.10s), `next start` readiness 270ms, `/sync-status` HTTP200/31.983ms and exact disconnected-state rendering, browser console/page errors 0, normal shutdown and port release. Dev-format `.next` rejection remains root-captured. Fixed-NORMAL `通常稼働` is not treated as connected health detection. Production API/auth, clinical production journeys and restart remain unverified.
- WP-3010a/WP-3011a are intentionally dormant fixture-only components. Browser/live API flow is not claimed; their parent tasks are BLOCKED with concrete unlock conditions.
- Production HTTPS/HSTS, deploy, external systems, PHI production data and infrastructure were not exercised and remain human-gated.
