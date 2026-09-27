import {
  auditLogQueryOpenApiSchema,
  auditLogResponseOpenApiSchema,
  domainErrorResponse,
  forbiddenErrorResponse,
  internalErrorResponse,
  jsonContentType,
  migrationStateResponseOpenApiSchema,
  noStoreHeaders,
  outboxSummaryResponseOpenApiSchema,
  receptionSummaryQueryOpenApiSchema,
  receptionSummaryResponseOpenApiSchema,
} from './openapi-schemas.js';

export const operationsPaths = {
    "/operations/outbox-summary": {
      get: {
        operationId: "getOperationsOutboxSummary",
        tags: ["operations"],
        summary: "Return transactional outbox counters for the authenticated tenant and pharmacy",
        description:
          "Requires sync:read scope. Returns counts and instants derived from persisted outbox intents (migrations/000005 + 000007 `outbox_events`; the in-memory mode reads the in-process intent store). No delivery worker runs in this slice, so intents observed as pending are genuinely pending. The response is PHI-free — counts, event-type labels, and one instant only — so it declares no Cache-Control: no-store. `legacyOrphanCount` is omitted where it is not derived rather than reported as zero, and the orphan reception IDs themselves are never returned.",
        "x-yrese-ssot": "MOD-009",
        "x-yrese-required-scope": "sync:read",
        responses: {
          "200": {
            description: "Outbox counters grouped by event type in eventType asc order",
            content: {
              [jsonContentType]: {
                schema: outboxSummaryResponseOpenApiSchema,
              },
            },
          },
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },
    "/operations/reception-summary": {
      get: {
        operationId: "getOperationsReceptionSummary",
        tags: ["operations"],
        summary: "Return reception counts for one explicit calendar date",
        description:
          "Requires reception:read only. patient:read is deliberately not required: the service folds the reception list into counts before the route sees it, so no patient identity crosses the route boundary and a batch screen does not need a patient scope. Both count arrays list every enum member in declaration order, so an absent status is reported as a measured zero rather than being dropped. The response is PHI-free and declares no Cache-Control: no-store.",
        "x-yrese-ssot": "API-006",
        "x-yrese-required-scope": "reception:read",
        requestParams: {
          query: receptionSummaryQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Reception counts by reception status and eligibility status",
            content: {
              [jsonContentType]: {
                schema: receptionSummaryResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid reception summary query (RCV-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },
    "/operations/migration-state": {
      get: {
        operationId: "getOperationsMigrationState",
        tags: ["operations"],
        summary: "Return the schema_migrations reconciliation state",
        description:
          "Requires tenant:admin scope. Reuses the same reconciliation the db:check CLI and the startup gate use (checkMigrationState over migrations/000001 `schema_migrations`). Returns the reconciliation result, applied/available counts, the derived pending versions, and the latest applied version and name. `pendingVersions` is omitted where the reconciliation stopped before it could be derived rather than reported as zero. Never returns DATABASE_URL, a connection string, a host name, or a checksum value. When no persistent store is configured the response is the explicit `available: false` branch rather than a fabricated up-to-date state.",
        "x-yrese-ssot": "DB-002",
        "x-yrese-required-scope": "tenant:admin",
        responses: {
          "200": {
            description:
              "Migration reconciliation state, or the explicit not-configured branch",
            content: {
              [jsonContentType]: {
                schema: migrationStateResponseOpenApiSchema,
              },
            },
          },
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },
    "/audit/events": {
      get: {
        operationId: "getAuditEvents",
        tags: ["audit"],
        summary: "Return recent audit events with hash chain verification",
        description:
          "Requires audit-log:read scope. Returns a display projection (IDs only, no PHI names) ordered by wallClock desc, plus a hash chain verification over all stored events. Must use Cache-Control: no-store.",
        "x-yrese-ssot": "SCR-028",
        "x-yrese-required-scope": "audit-log:read",
        requestParams: {
          query: auditLogQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Audit events and chain verification",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: auditLogResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse("Invalid audit log query (AUD-0001)"),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },};
