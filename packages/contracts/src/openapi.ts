import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { z } from "zod";

import { auditLogQuerySchema, auditLogResponseSchema } from "./audit-log.js";
import { errorResponseSchema, frameworkErrorResponseSchema } from "./error.js";
import { healthResponseSchema } from "./health.js";
import {
  patientGetParamsSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
} from "./patient-search.js";
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
            description: "Idempotent resend returned the existing reception entry",
            headers: noStoreHeaders,
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
