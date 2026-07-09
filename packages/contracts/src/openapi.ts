import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { errorResponseSchema } from "./error.js";
import { healthResponseSchema } from "./health.js";
import { patientSearchQuerySchema, patientSearchResponseSchema } from "./patient-search.js";
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
  },
} satisfies ZodOpenApiObject;

export function createYreseOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument(openApiDefinition, {
    cycles: "throw",
    reused: "inline",
  });
}
