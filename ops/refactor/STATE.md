# Repository reconciliation state

This is the resume entrypoint for the active repository reconciliation goal.

- Governance: APPROVED AGT-018 Codex-only lane. Root is the sole editor/landing owner; all mapper/reviewer roles are read-only. Do not use Claude/Opus routing or agmsg.
- Current phase: WP-9002 legacy SSOT frontmatter migration W4 preparation. W1/W2/W3 are LANDED; inventory is 173 total / 137 incomplete / 36 complete.
- Current task: fresh read-only mapping and pre-plan review for the next bounded metadata-only wave. No W4 target edit has started.
- Last completed groups:
  - `7b99cb8` WP-4078 audit intent single-snapshot hardening
  - `276cdae` WP-3011a fixture-first calculation trace viewer foundation
  - `36fc156` WP-3010a fail-closed mode capability foundation
  - `468da34` WP-4080 production plaintext API-base rejection
  - `3e8dee0` WP-9003 resume-safe repository state pack
  - `1b07db6` WP-9002-W3 error/permission registry metadata migration
- Verified blockers:
  - WP-4079: R3 stored audit fingerprint version-before-deep-read; explicit human scope approval required.
  - WP-3010 parent: full ARC-001 capability source, live mode/count contract, route/UI flow and pharmacist/claims review.
  - WP-3011 parent: intermediate value trust boundary plus live endpoint/auth/tenant/route contract.
  - WP-4077 must APPROVED-amend DB-005 before WP-5004b / WP-7001 M3b.
  - Production/external/migration/DML/deploy operations remain human-gated and were not run.
- Validation baseline (2026-07-11): workspace typecheck/test PASS; audit 182, trace 37, contracts 86, web 99, API 161 + 9 expected PostgreSQL skips without `TEST_DATABASE_URL`; web/full builds PASS; OpenAPI, SSOT index 173, boundaries, secrets, dependency audit high=0/critical=0, SBOM 231, calculation purity, script harness and diff check PASS.
- Git resume check: run `git status -sb`, `git rev-list --left-right --count origin/main...HEAD`, and `git log -5 --oneline`. Preserve any new unrelated dirty paths. Root alone stages exact task paths and pushes because the active Goal explicitly requests grouped commit/push.
- Landing-record checkpoint: `main @ 1b07db6` equals `origin/main`; this three-path ledger update records that already-pushed W3 landing and must not include any product or target SSOT change.
- Next action: exact-stage only `Plans.md`, `State.md`, and `ops/refactor/STATE.md`, commit as `WP-9002-W3: record metadata landing`, push `main`, then begin fresh W4 read-only mapping/pre-plan from the new clean HEAD.
