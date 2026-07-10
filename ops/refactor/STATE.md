# Repository reconciliation state

This is the resume entrypoint for the active repository reconciliation goal.

- Governance: APPROVED AGT-018 Codex-only lane. Root is the sole editor/landing owner; all mapper/reviewer roles are read-only. Do not use Claude/Opus routing or agmsg.
- Current phase: WP-9002 legacy SSOT frontmatter migration W3 (`MOD-006` / `MOD-007`) finalized / landing pending. W1/W2 are LANDED; landed inventory is 173/139/34 and the finalized W3 target is 173/137/36.
- Current task: post-finalization revalidation, independent confirmation, exact-stage, commit, and push of the six owned paths.
- Last completed groups:
  - `7b99cb8` WP-4078 audit intent single-snapshot hardening
  - `276cdae` WP-3011a fixture-first calculation trace viewer foundation
  - `36fc156` WP-3010a fail-closed mode capability foundation
  - `468da34` WP-4080 production plaintext API-base rejection
  - `3e8dee0` WP-9003 resume-safe repository state pack
- Verified blockers:
  - WP-4079: R3 stored audit fingerprint version-before-deep-read; explicit human scope approval required.
  - WP-3010 parent: full ARC-001 capability source, live mode/count contract, route/UI flow and pharmacist/claims review.
  - WP-3011 parent: intermediate value trust boundary plus live endpoint/auth/tenant/route contract.
  - WP-4077 must APPROVED-amend DB-005 before WP-5004b / WP-7001 M3b.
  - Production/external/migration/DML/deploy operations remain human-gated and were not run.
- Validation baseline (2026-07-11): workspace typecheck/test PASS; audit 182, trace 37, contracts 86, web 99, API 161 + 9 expected PostgreSQL skips without `TEST_DATABASE_URL`; web/full builds PASS; OpenAPI, SSOT index 173, boundaries, secrets, dependency audit high=0/critical=0, SBOM 231, calculation purity, script harness and diff check PASS.
- Git resume check: run `git status -sb`, `git rev-list --left-right --count origin/main...HEAD`, and `git log -5 --oneline`. Preserve any new unrelated dirty paths. Root alone stages exact task paths and pushes because the active Goal explicitly requests grouped commit/push.
- Pending W3 checkpoint: baseline `main @ 3e8dee0` equals `origin/main`; only `docs/modules/error_code_registry.md`, `docs/modules/permission_scope_registry.md`, `docs/ssot_index.md`, `Plans.md`, `State.md`, and `ops/refactor/STATE.md` are owned. Target bodies are fixed at MOD-006 3509 bytes / `96ebdea1…` and MOD-007 2139 bytes / `94974900…`; 171 non-target missing-set baseline is 22739 bytes / `40b4506b…`.
- Next action: revalidate the finalized W3 diff and obtain independent finalization confirmation, then commit as `WP-9002-W3: normalize error and permission metadata` and push `main`. After push start a fresh W4 mapping/pre-plan; if that commit is already present on resume, treat W3 as LANDED and go directly to W4.
