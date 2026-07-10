# High-risk change register

## WP-4078 audit integrity

- Risk: R3/HIGH audit integrity. Hostile Proxy/mutable input could separate hashed and validated values.
- Control: one version-first frozen snapshot for canonicalization and validation; hostile descriptor/getter/Date cases fixed by tests.
- Compatibility: stored path, public API, v1 golden, errors, DB/network/storage unchanged.
- Reviews: independent, security/data-integrity, medical-safety and privacy APPROVED under the active Goal’s pre-start HR authority.
- Rollback: revert `7b99cb8`; no data remediation.

## WP-4080 PHI transport

- Risk: R3/HIGH confidentiality/integrity. Production misconfiguration could send patient/reception traffic over plaintext HTTP.
- Control: HTTPS/root-relative only outside exact development loopback; fixed non-echo failure before fetch; parser delimiter/userinfo edge cases rejected.
- Reviews: independent and security/privacy/medical-safety APPROVED. No deploy was performed.
- Rollback: revert `468da34`; production HTTPS/HSTS remains a separate human Go/No-Go check.

## Not implemented

- WP-4079 and WP-4077 remain gated as recorded in `PENDING_DECISIONS.md`; no risk acceptance is implied.
