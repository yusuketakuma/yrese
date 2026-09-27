import {
  forbiddenErrorResponse,
  healthResponseOpenApiSchema,
  internalErrorResponse,
  jsonContentType,
  whoamiResponseOpenApiSchema,
} from './openapi-schemas.js';

export const systemPaths = {
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
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: false }),
        },
      },
    },};
