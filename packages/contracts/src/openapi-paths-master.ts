import {
  domainErrorResponse,
  forbiddenErrorResponse,
  internalErrorResponse,
  jsonContentType,
  masterMedicationsResponseOpenApiSchema,
  masterQueryOpenApiSchema,
  masterUsagesResponseOpenApiSchema,
} from "./openapi-schemas.js";

export const masterPaths = {
    "/masters/medications": {
      get: {
        operationId: "listMedicationMasters",
        tags: ["masters"],
        summary: "List medication master items valid at an explicit asOf (MST-003)",
        description:
          "Requires master:read scope. asOf is mandatory — the server never resolves an implicit 'today'. q filters by localCode prefix or name substring (case-sensitive, code-point order). Returns masterVersion=null with an empty items array when no version covers asOf (existence is not disclosed across scopes). Synthetic data only — real master import remains blocked by RB-009. Non-PHI: no read audit and no no-store requirement (MST-003 §5).",
        "x-yrese-ssot": "MST-003",
        "x-yrese-required-scopes": ["master:read"],
        requestParams: {
          query: masterQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Medication items of the version valid at asOf",
            content: {
              [jsonContentType]: {
                schema: masterMedicationsResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid master query (missing/invalid asOf or q — MST-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/masters/usages": {
      get: {
        operationId: "listUsageMasters",
        tags: ["masters"],
        summary: "List usage master items valid at an explicit asOf (MST-003)",
        description:
          "Requires master:read scope. asOf is mandatory — the server never resolves an implicit 'today'. q filters by localCode prefix or text substring (case-sensitive, code-point order). Returns masterVersion=null with an empty items array when no version covers asOf. Synthetic data only — real master import remains blocked by RB-009. Non-PHI: no read audit and no no-store requirement (MST-003 §5).",
        "x-yrese-ssot": "MST-003",
        "x-yrese-required-scopes": ["master:read"],
        requestParams: {
          query: masterQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Usage items of the version valid at asOf",
            content: {
              [jsonContentType]: {
                schema: masterUsagesResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid master query (missing/invalid asOf or q — MST-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },};
