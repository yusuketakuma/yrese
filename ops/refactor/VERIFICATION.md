# Verification record

## Validation baseline (2026-07-16; current WP-4152 evidence dated 2026-07-18 below)

| Command / evidence | Result |
|---|---|
| `pnpm -r typecheck` | PASS (all workspaces) |
| `pnpm -r test` | PASS: API 272 + 14 expected local PostgreSQL skips, Web 337, audit 183, calculation 87; all other packages PASS |
| GitHub Actions CI `29499861743` / job `87625797181` (`1d2a2da`) | PASS: all steps green; API 286/286 zero-skip, including PostgreSQL repositories 7/7, audit integration 5/5 and migration integration 2/2; Web 337/337 |
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

Independent bounded verification also passed for WP-4146 (including padded dependency key, primitive dependency section and legal workspace-alias fixtures), WP-4147 (exact pnpm pin, frozen install, allowBuilds scope and audit/SBOM evidence), and WP-4150 (375/768/1280 geometry, Tab focus, pointer selection and empty console/page-error capture).

WP-4163 validation passed: patient-search focused 44/44, Web 337/337, Web typecheck/build, boundaries, SSOT index 173 and diff check. Independent privacy/security review passed the exact2 source/test diff. Fresh hydrated pointer search kept `/patients` query-free; complete JavaScript-disabled native browser submission was unavailable in the browser tool.

## Environment-limited checks

- Local PostgreSQL integration remains unavailable because `TEST_DATABASE_URL` is absent, so the local workspace run has 14 expected skips and performs no DB connection, migration or DML. This environment limitation is now complemented—not erased—by direct zero-skip PostgreSQL CI evidence from run `29499861743`; production database operation and WP-4050 atomicity remain unverified.
- Synthetic development browser evidence now covers patient search/select, reception create/queue reflection/context clear, reception queue exact-500 retention/raw-suppression/native retry/replacement, reception registration known-non-commit exact-500/no-false-success/native retry/queue reload, audit success/hash-chain status, and audit refresh exact-500 retention/raw-suppression/retry recovery. Focused audit 50/50, reception dashboard 70/70, and combined reception/patient-context 139/139 passed. Registration retry used different idempotency keys, so ambiguous committed outcomes remain unproved and human-gated. Audit retry native input, production-like API/auth and broader accessibility remain `DEMO_REQUIRED`. See `EVIDENCE.md` and `FINAL_DEMO.md`.
- WP-4150 independent browser evidence covers 375px horizontal-scroll endpoints with both actions fully visible, 3px Tab focus, pointer-selected patient identity consistency, 768/1280 no page overflow and empty console/page errors. Browser-CLI Enter did not change state, so full keyboard activation remains inside the broader accessibility gap.
- Production Web evidence covers root build/start (12 pages, ready237ms), an independent fresh build/start (12 pages/6.10s, ready270ms, `/sync-status` HTTP200/31.983ms, exact disconnected rendering, error0, shutdown), and current target `87aa747` same-artifact restart evidence. The current fresh build produced 12 static pages in real19.98s; BUILD_ID `GMvkAu8EW7gWyinpQPEln` and three route hashes stayed identical across two starts. Run1 ready1796ms/HTTP200 80.717ms/23,036 bytes and run2 ready2.9s/HTTP200 297.738ms/23,036 bytes; each produced an accessibility-tree snapshot and passed copy/reload/console-page-error0/shutdown/port-release checks. Dev-format `.next` rejection remains historical root-captured and was not repeated. Fixed-NORMAL `通常稼働` is not connected health detection and timings are not SLOs. Production API startup/restart, auth/tenant, clinical/DB/deploy/repository-wide readiness and broad accessibility conformance remain unverified.
- WP-3010a/WP-3011a are intentionally dormant fixture-only components. Browser/live API flow is not claimed; their parent tasks are BLOCKED with concrete unlock conditions.
- Production HTTPS/HSTS, deploy, external systems, PHI production data and infrastructure were not exercised and remain human-gated.
