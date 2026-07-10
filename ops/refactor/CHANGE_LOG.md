# Reconciliation change log

## WP-4078 (`7b99cb8`)

- Replaced repeated direct audit intent reads with one frozen descriptor snapshot shared by canonical hashing and domain validation.
- Preserved stored M3a behavior, public API, v1 golden/error compatibility; rollback is the five-path commit revert with no migration.

## WP-3011a (`276cdae`)

- Added fixture-only calculation trace zod mapping/viewer, shared canonical result-string and evidence-set validation, PHI/URL and evidence-gap fail-closed behavior.
- Live endpoint/auth/tenant/route and intermediate typed semantics remain explicit blocked children. Rollback is the commit revert.

## WP-3010a (`36fc156`)

- Added five-mode projection of the three shared mode guards. Positive results are “not prohibited / execution undecided,” with required checks; non-LOCAL provisional statuses are candidates only.
- Full 28-operation/16-prohibition source, live mode/count and route remain blocked children. Rollback is the commit revert.

## WP-4080 (`468da34`)

- Rejected absolute plaintext HTTP outside exact development loopback; retained HTTPS/root-relative bases, fixed non-echo errors and zero-fetch behavior for search/queue/create.
- Closed empty `?/#` and userinfo parser edge cases. Production origin TLS/HSTS remains a deploy gate. Rollback is the commit revert.

## WP-9003

- Replaced stale dual-lane/refactor notes with this AGT-018 Codex-only, resume-safe state pack. No product code, DB, external action or deployment change.
