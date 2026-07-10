# Repository reconciliation state

This is the resume entrypoint for the active repository reconciliation goal.

- Governance: APPROVED AGT-018 Codex-only lane. Root is the sole editor/landing owner; all mapper/reviewer roles are read-only. Do not use Claude/Opus routing or agmsg.
- Current phase: WP-9002 legacy SSOT frontmatter migration, preparing W3 (`MOD-006` / `MOD-007`). W1/W2 are LANDED; inventory is 173 total / 139 incomplete / 34 complete.
- Current task: fresh W3 read-only mapping and pre-plan review. No W3 edit has started.
- Last completed groups:
  - `7b99cb8` WP-4078 audit intent single-snapshot hardening
  - `276cdae` WP-3011a fixture-first calculation trace viewer foundation
  - `36fc156` WP-3010a fail-closed mode capability foundation
  - `468da34` WP-4080 production plaintext API-base rejection
  - WP-9003 is the state-pack commit containing this file; root exact-stages and pushes it after verification.
- Verified blockers:
  - WP-4079: R3 stored audit fingerprint version-before-deep-read; explicit human scope approval required.
  - WP-3010 parent: full ARC-001 capability source, live mode/count contract, route/UI flow and pharmacist/claims review.
  - WP-3011 parent: intermediate value trust boundary plus live endpoint/auth/tenant/route contract.
  - WP-4077 must APPROVED-amend DB-005 before WP-5004b / WP-7001 M3b.
  - Production/external/migration/DML/deploy operations remain human-gated and were not run.
- Validation baseline (2026-07-11): workspace typecheck/test PASS; audit 182, trace 37, contracts 86, web 99, API 161 + 9 expected PostgreSQL skips without `TEST_DATABASE_URL`; web/full builds PASS; OpenAPI, SSOT index 173, boundaries, secrets, dependency audit high=0/critical=0, SBOM 231, calculation purity, script harness and diff check PASS.
- Git resume check: run `git status -sb`, `git rev-list --left-right --count origin/main...HEAD`, and `git log -5 --oneline`. Preserve any new unrelated dirty paths. Root alone stages exact task paths and pushes because the active Goal explicitly requests grouped commit/push.
- Pending landing checkpoint: `main @ 468da34` equals `origin/main`. After docs gates and independent review pass, exact-stage only `Plans.md`, `State.md`, `ops/refactor/STATE.md`, `ops/refactor/CODE_MAP.md`, `ops/refactor/CHANGE_LOG.md`, `ops/refactor/HIGH_RISK_CHANGES.md`, `ops/refactor/PENDING_DECISIONS.md`, `ops/refactor/SCAN_LOG.md`, and `ops/refactor/VERIFICATION.md`; commit as `WP-9003: add resume-safe reconciliation state`, then push `main`.
- Next action: finish the pending WP-9003 landing first. After push, map W3 target frontmatter/body hashes/preserved fields from current `origin/main`, obtain spec/data-integrity/domain review, then perform metadata-only edits with non-target missing-set identity and exact-path validation.
