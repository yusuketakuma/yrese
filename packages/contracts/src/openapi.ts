import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { z } from "zod";

import { auditLogQuerySchema, auditLogResponseSchema } from "./audit-log.js";
import { errorResponseSchema, frameworkErrorResponseSchema } from "./error.js";
import { healthResponseSchema } from "./health.js";
import {
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryQuerySchema,
  receptionSummaryResponseSchema,
} from "./operations-status.js";
import {
  patientGetParamsSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
} from "./patient-search.js";
import {
  prescriptionDraftParamsSchema,
  prescriptionDraftQuerySchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
  prescriptionDraftUpdateHeadersSchema,
} from "./prescription-draft.js";
import {
  receptionCreateRequestSchema,
  receptionQueueQuerySchema,
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
} from "./reception-queue.js";
import { whoamiResponseSchema } from "./whoami.js";

const jsonContentType = "application/json";

const errorResponseOpenApiSchema = errorResponseSchema.meta({
  id: "ErrorResponse",
  description: "PHI-free API error response",
});

const frameworkErrorResponseOpenApiSchema = frameworkErrorResponseSchema.meta({
  id: "FrameworkErrorResponse",
  description:
    "Normalized framework-shaped error (JSON body parse 400 with `code`, unknown-route 404, internal 500). Message is a constant safe string; never a raw exception, never PHI.",
});

const receptionCreateBadRequestOpenApiSchema = z
  .union([errorResponseSchema, frameworkErrorResponseSchema])
  .meta({
    id: "ReceptionCreateBadRequest",
    description:
      "Validation failure (RCV-0001) or JSON body parse failure (framework shape with code FST_ERR_CTP_INVALID_JSON_BODY). Non-JSON content types are coerced through validation and fail as RCV-0001.",
  });

/**
 * WP-9008: PHI を運ぶルートは onRequest フックにより **全 status** の応答へ
 * Cache-Control: no-store を付ける(エラー・パーサ 400 を含む)。宣言は代表として
 * 成功応答と 500 に付与し、適用範囲はこの説明とルート description を正とする。
 */
const noStoreHeaders = {
  "Cache-Control": {
    description:
      "Always `no-store` on this PHI-bearing route — applied to every status including errors.",
    schema: { type: "string" as const, enum: ["no-store"] },
  },
};

const internalErrorResponse = (options: { readonly noStore: boolean }) => ({
  description:
    "Normalized internal error. Constant invariant message; no raw exception detail, no PHI.",
  ...(options.noStore ? { headers: noStoreHeaders } : {}),
  content: {
    [jsonContentType]: {
      schema: frameworkErrorResponseOpenApiSchema,
    },
  },
});

const frameworkFailureResponse = (description: string) => ({
  description,
  headers: noStoreHeaders,
  content: {
    [jsonContentType]: {
      schema: frameworkErrorResponseOpenApiSchema,
    },
  },
});

const healthResponseOpenApiSchema = healthResponseSchema.meta({
  id: "HealthResponse",
  description: "Health check response",
});

const patientSearchQueryOpenApiSchema = patientSearchQuerySchema.meta({
  id: "PatientSearchQuery",
  description: "Patient search query parameters",
});

const patientSearchResponseOpenApiSchema = patientSearchResponseSchema.meta({
  id: "PatientSearchResponse",
  description: "Patient search response. Contains PHI and must not be logged in plaintext.",
});

const whoamiResponseOpenApiSchema = whoamiResponseSchema.meta({
  id: "WhoamiResponse",
  description: "Current tenant context response. PHI-free.",
});

const patientGetParamsOpenApiSchema = patientGetParamsSchema.meta({
  id: "PatientGetParams",
  description: "Patient get-by-id path parameters",
});

const patientSummaryOpenApiSchema = patientSearchResultSchema.meta({
  id: "PatientSummary",
  description:
    "Patient summary projection (same shape as search results). Contains PHI and must not be logged in plaintext.",
});

const receptionQueueQueryOpenApiSchema = receptionQueueQuerySchema.meta({
  id: "ReceptionQueueQuery",
  description: "Reception queue query parameters",
});

const receptionQueueEntryOpenApiSchema = receptionQueueEntrySchema.meta({
  id: "ReceptionQueueEntry",
  description: "Reception queue entry. Contains PatientSummary PHI and must not be logged in plaintext.",
});

const receptionQueueResponseOpenApiSchema = receptionQueueResponseSchema.meta({
  id: "ReceptionQueueResponse",
  description: "Reception queue response. Contains PHI and must use Cache-Control: no-store.",
});

const receptionCreateRequestOpenApiSchema = receptionCreateRequestSchema.meta({
  id: "ReceptionCreateRequest",
  description: "Create a reception entry using an opaque idempotency key.",
});

const prescriptionDraftParamsOpenApiSchema = prescriptionDraftParamsSchema.meta({
  id: "PrescriptionDraftParams",
  description: "Prescription draft path parameters scoped by reception ID.",
});

const prescriptionDraftQueryOpenApiSchema = prescriptionDraftQuerySchema.meta({
  id: "PrescriptionDraftQuery",
  description: "Business-date selector. Patient identity is derived from the verified reception.",
});

const prescriptionDraftUpdateHeadersOpenApiSchema =
  prescriptionDraftUpdateHeadersSchema.meta({
    id: "PrescriptionDraftUpdateHeaders",
    description:
      'If-Match is absent for the first save and must equal the quoted expectedVersion for updates, for example "2".',
  });

const prescriptionDraftSaveRequestOpenApiSchema =
  prescriptionDraftSaveRequestSchema.meta({
    id: "PrescriptionDraftSaveRequest",
    description:
      "Versioned prescription draft save request. Contains clinical PHI and must not be logged in plaintext.",
  });

const prescriptionDraftResponseOpenApiSchema = prescriptionDraftResponseSchema.meta({
  id: "PrescriptionDraftResponse",
  description:
    "Server-saved prescription draft with optimistic-concurrency version and actor metadata. Contains clinical PHI.",
});

const prescriptionDraftSaveResponseOpenApiSchema =
  prescriptionDraftSaveResponseSchema.meta({
    id: "PrescriptionDraftSaveResponse",
    description:
      "Prescription draft save result, including created/updated/unchanged disposition. Contains clinical PHI.",
  });

const outboxSummaryResponseOpenApiSchema = outboxSummaryResponseSchema.meta({
  id: "OutboxSummaryResponse",
  description:
    "Transactional outbox counters and instants only (pending/delivered per event type, oldest pending instant). PHI-free: no reception, patient, or payload content. `legacyOrphanCount` is present only where it was actually derived; an omitted field means not derived, which is not the same as zero.",
});

const receptionSummaryQueryOpenApiSchema = receptionSummaryQuerySchema.meta({
  id: "ReceptionSummaryQuery",
  description: "Business-date selector for the reception count summary",
});

const receptionSummaryResponseOpenApiSchema = receptionSummaryResponseSchema.meta({
  id: "ReceptionSummaryResponse",
  description:
    "Reception counts for one business date, folded before leaving the service. Every reception status and eligibility status member is listed in declaration order; a zero is a measured count, not a placeholder. PHI-free: no patient identity is enumerated.",
});

const migrationStateResponseOpenApiSchema = migrationStateResponseSchema.meta({
  id: "MigrationStateResponse",
  description:
    "schema_migrations reconciliation state. Carries the reconciliation result, counts, pending versions, and the latest applied version/name only — never a connection string, host name, or checksum value (a checksum difference appears solely as the `checksum_mismatch` result). `pendingVersions` is present only where it was actually derived (`up_to_date`/`db_ahead` carry a measured empty list, `unapplied_required` the pending versions); a mismatch result stops the reconciliation part-way and omits the field, which is not the same as zero. The `available: false` branch is returned when no persistent store is configured.",
});

const auditLogQueryOpenApiSchema = auditLogQuerySchema.meta({
  id: "AuditLogQuery",
  description: "Audit log view query parameters",
});

const auditLogResponseOpenApiSchema = auditLogResponseSchema.meta({
  id: "AuditLogResponse",
  description:
    "Audit log display projection (who/when/what) with hash chain verification. IDs only; no PHI names.",
});

const openApiDefinition = {
  openapi: "3.1.0",
  info: {
    title: "yrese Pharmacy Integration API",
    version: "0.0.1",
    description:
      "@yrese/contracts zod schemas are the source of truth for this generated OpenAPI document. " +
      "Error model (WP-9008): domain errors use ErrorResponse ({errorCode, message}); parser 400 / unknown-route 404 / normalized 500 use FrameworkErrorResponse with constant safe messages (no raw detail, no PHI). " +
      "Authorization denial is uniformly 403 AUTH-0003 (deny-by-default). Authentication model: development uses explicit dev-header tenant context only; production authentication and its 401/WWW-Authenticate semantics are a separately gated release surface and are intentionally not declared here. " +
      "PHI-bearing routes send Cache-Control: no-store on every status including errors.",
  },
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        tags: ["system"],
        summary: "Health check",
        responses: {
          "200": {
            description: "API health status",
            content: {
              [jsonContentType]: {
                schema: healthResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },
    "/whoami": {
      get: {
        operationId: "getWhoami",
        tags: ["system"],
        summary: "Return the authenticated tenant context",
        description: "Requires tenant:read scope. Returns the current tenant, pharmacy, actor, and granted scopes.",
        "x-yrese-ssot": "API-002",
        "x-yrese-required-scope": "tenant:read",
        responses: {
          "200": {
            description: "Current tenant context",
            content: {
              [jsonContentType]: {
                schema: whoamiResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },
    "/patients/search": {
      get: {
        operationId: "searchPatients",
        tags: ["patients"],
        summary: "Search patients within the authenticated tenant and pharmacy context",
        description:
          "Requires patient:read scope and tenant context. The response contains PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-001",
        "x-yrese-required-scope": "patient:read",
        requestParams: {
          query: patientSearchQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Patient search results",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientSearchResponseOpenApiSchema,
              },
            },
          },
          "400": {
            description: "Invalid patient search query (PAT-0001)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/patients/{patientId}": {
      get: {
        operationId: "getPatientById",
        tags: ["patients"],
        summary: "Return one patient summary by ID within the authenticated tenant and pharmacy context",
        description:
          "Requires patient:read scope and tenant context. Used to refresh the cross-route patient context (R-PATCTX). The response contains PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-001",
        "x-yrese-required-scope": "patient:read",
        requestParams: {
          path: patientGetParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Patient summary (same projection as search results)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientSummaryOpenApiSchema,
              },
            },
          },
          "400": {
            description: "Invalid patient ID (PAT-0001)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: true }),
          "404": {
            description: "Patient not found (PAT-0002)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
        },
      },
    },
    "/reception/queue": {
      get: {
        operationId: "getReceptionQueue",
        tags: ["reception"],
        summary: "Return the reception queue for one explicit calendar date",
        description:
          "Requires reception:read and patient:read scopes. The response contains PatientSummary PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-006",
        "x-yrese-required-scopes": ["reception:read", "patient:read"],
        requestParams: {
          query: receptionQueueQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Reception queue entries in acceptedAt asc + receptionId asc order",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: receptionQueueResponseOpenApiSchema,
              },
            },
          },
          "400": {
            description: "Invalid reception queue query (RCV-0001)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/reception": {
      post: {
        operationId: "createReception",
        tags: ["reception"],
        summary: "Create a reception queue entry",
        description:
          "Requires reception:write and patient:read scopes. The response contains PatientSummary PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-006",
        "x-yrese-required-scopes": ["reception:write", "patient:read"],
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: receptionCreateRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Reception entry created",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: receptionQueueEntryOpenApiSchema,
              },
            },
          },
          "200": {
            description:
              "Idempotent resend returned the existing reception entry. When the stored reception has no complete audit/outbox evidence (a reception created before the atomic command boundary, or a dangling outbox intent), the response carries `X-Yrese-Reconciliation: legacy_orphan` as reconciliation evidence; the server never fabricates the original actor or timestamp.",
            headers: {
              ...noStoreHeaders,
              "X-Yrese-Reconciliation": {
                description:
                  "Present only when the existing reception lacks complete audit/outbox evidence. Fixed vocabulary, no PHI.",
                schema: { type: "string" as const, enum: ["legacy_orphan"] },
              },
            },
            content: {
              [jsonContentType]: {
                schema: receptionQueueEntryOpenApiSchema,
              },
            },
          },
          "400": {
            description:
              "Invalid reception create request (RCV-0001) or JSON body parse failure (framework shape)",
            content: {
              [jsonContentType]: {
                schema: receptionCreateBadRequestOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: true }),
          "404": {
            description: "Patient not found for reception (RCV-0002)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "409": {
            description: "Idempotency conflict (RCV-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
        },
      },
    },
    "/prescription-drafts/by-reception/{receptionId}": {
      get: {
        operationId: "getPrescriptionDraftByReception",
        tags: ["prescriptions"],
        summary: "Read the server-saved prescription draft for one verified reception context",
        description:
          "Requires prescription:read, reception:read, and patient:read. Tenant and pharmacy come only from authenticated context. The response contains clinical PHI and every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": [
          "prescription:read",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionDraftParamsOpenApiSchema,
          query: prescriptionDraftQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Current server-saved prescription draft",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftResponseOpenApiSchema,
              },
            },
          },
          "204": {
            description:
              "Verified reception context has no server-saved prescription draft",
            headers: noStoreHeaders,
          },
          "400": frameworkFailureResponse("Invalid prescription draft request"),
          "403": {
            description: "Forbidden (AUTH-0003)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "404": frameworkFailureResponse(
            "Verified reception context not found",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
      put: {
        operationId: "savePrescriptionDraftByReception",
        tags: ["prescriptions"],
        summary: "Create or update a versioned prescription draft",
        description:
          "Requires prescription:write, reception:read, and patient:read. Uses expectedVersion for optimistic concurrency. A 409 never echoes the current clinical payload. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": [
          "prescription:write",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionDraftParamsOpenApiSchema,
          header: prescriptionDraftUpdateHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: prescriptionDraftSaveRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Prescription draft created",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftSaveResponseOpenApiSchema,
              },
            },
          },
          "200": {
            description: "Prescription draft updated or unchanged",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftSaveResponseOpenApiSchema,
              },
            },
          },
          "400": frameworkFailureResponse("Invalid prescription draft request"),
          "403": {
            description: "Forbidden (AUTH-0003)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "404": frameworkFailureResponse(
            "Verified reception and patient context not found",
          ),
          "409": frameworkFailureResponse(
            "Prescription draft version conflict",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
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
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
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
          "400": {
            description: "Invalid reception summary query (RCV-0001)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
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
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
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
          "400": {
            description: "Invalid audit log query (AUD-0001)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "403": {
            description: "Forbidden (AUTH-0003)",
            content: {
              [jsonContentType]: {
                schema: errorResponseOpenApiSchema,
              },
            },
          },
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
  },
} satisfies ZodOpenApiObject;

export function createYreseOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument(openApiDefinition, {
    cycles: "throw",
    reused: "inline",
  });
}
