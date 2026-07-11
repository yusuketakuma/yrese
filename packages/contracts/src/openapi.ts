import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { auditLogQuerySchema, auditLogResponseSchema } from "./audit-log.js";
import { errorResponseSchema } from "./error.js";
import { healthResponseSchema } from "./health.js";
import { patientSearchQuerySchema, patientSearchResponseSchema } from "./patient-search.js";
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
    description: "@yrese/contracts zod schemas are the source of truth for this generated OpenAPI document.",
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
            content: {
              [jsonContentType]: {
                schema: receptionQueueEntryOpenApiSchema,
              },
            },
          },
          "200": {
            description: "Idempotent resend returned the existing reception entry",
            content: {
              [jsonContentType]: {
                schema: receptionQueueEntryOpenApiSchema,
              },
            },
          },
          "400": {
            description: "Invalid reception create request (RCV-0001)",
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
