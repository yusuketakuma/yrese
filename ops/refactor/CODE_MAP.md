# Repository code map

- Stack: pnpm 11 monorepo, Node >=24, TypeScript NodeNext, Fastify 5 API, Next.js 15 / React 19 web, zod contracts, Vitest.
- Runtime apps: `apps/api` (deny-by-default permission, explicit tenant context/repository mode) and `apps/web` (same-origin dev proxy, production HTTPS/root-relative API base boundary).
- Shared packages: `shared-kernel`, `money`, `date-time`, `trace`, `events`, `contracts`, `calculation`, `audit`. `packages/* -> apps/*`, cycles and duplicated shared concepts are forbidden by `check:boundaries`.
- Data: PostgreSQL forward-only migrations are explicit operations; in-memory remains the default. DynamoDB audit work is pure codec/design only until DB-005 physical envelope approval.
- High-risk hotspots: audit append/fingerprint/persistence, tenant/auth, calculation/claim/accounting, migrations, PHI transport, external adapters.
- Full-stack status: patient search/get, reception queue/create and audit events are connected Web/API paths. Health is operational-only; whoami has no current Web consumer and remains a real-auth bootstrap decision. Reachable prescription/checkout/claim/master/closing/sync placeholders remain explicitly BLOCKED. See `FULLSTACK_ALIGNMENT.md`.
- SSOT: 173 indexed documents. APPROVED documents are implementation authority; WP-9002 is migrating legacy metadata without changing body/status/approval/effective semantics.
- Primary commands: `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, `pnpm check:openapi`, `check:ssot-index`, `check:boundaries`, `check:secrets`, `check:deps`, `check:sbom`, `check:calculation-purity`, `test:scripts`, `pnpm clean`.
