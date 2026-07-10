# Pending decisions and blockers

- WP-4079 stored audit fingerprint version-first boundary
  - Decision: explicit R3 human scope approval before implementation.
  - Recommended change: outer descriptor snapshot -> version validation -> v1-only deep copy; prove v2 hostile deep-read zero and v1 compatibility.
- WP-4077 DynamoDB audit physical envelope
  - Decision: APPROVED DB-005 amendment for complete AttributeValue map, item schema/discriminator, nested/optional/timestamp semantics, PHI/encryption, golden and migration rules.
  - Unlocks: WP-5004b and WP-7001 M3b after DB/security/privacy/human infrastructure gates.
- WP-3010b/c full SCR-026
  - Decision: machine-readable ARC-001 28-operation/16-prohibition tri-state source, live SystemMode/provisional counts, pharmacist/claims review, then reachable route/browser/a11y flow.
- WP-3011b/c live SCR-012
  - Decision: typed intermediate value/trust boundary; endpoint/key, `calculation:read`, tenant/pharmacy binding, response parse, live trace and route/UI flow.
- WP-0016 and regulatory/external adapter tasks
  - Decision: human ONS/official-source acquisition and applicable legal/claim/medical review. Agents must not infer missing official requirements.
