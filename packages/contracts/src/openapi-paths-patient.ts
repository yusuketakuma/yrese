import {
  coverageListQueryOpenApiSchema,
  coverageListResponseOpenApiSchema,
  coverageParamsOpenApiSchema,
  coverageRecordHeadersOpenApiSchema,
  coverageRecordRequestOpenApiSchema,
  coverageRecordResponseOpenApiSchema,
  domainErrorResponse,
  forbiddenErrorResponse,
  internalErrorResponse,
  jsonContentType,
  noStoreHeaders,
  patientCreateHeadersOpenApiSchema,
  patientCreateRequestOpenApiSchema,
  patientCreateResponseOpenApiSchema,
  patientGetParamsOpenApiSchema,
  patientSearchQueryOpenApiSchema,
  patientSearchResponseOpenApiSchema,
  patientUpdateHeadersOpenApiSchema,
  patientUpdateRequestOpenApiSchema,
  patientUpdateResponseOpenApiSchema,
  patientVersionedSummaryOpenApiSchema,
} from "./openapi-schemas.js";

export const patientPaths = {
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
          "400": domainErrorResponse(
            "Invalid patient search query (PAT-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/patients": {
      post: {
        operationId: "createPatient",
        tags: ["patients"],
        summary: "Register a new patient within the authenticated tenant and pharmacy context",
        description:
          "Requires patient:write and patient:read scopes and tenant context (POSSIBLE_DUPLICATE warnings enumerate other patients' PHI, so write alone is insufficient per API-001). Idempotent via the Idempotency-Key header: replaying the same key with the same payload returns the existing patient with 200; a different payload returns 409 PAT-0006. patientNumber may be omitted for server-side assignment. The response contains PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-001",
        "x-yrese-required-scopes": ["patient:write", "patient:read"],
        requestParams: {
          header: patientCreateHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: patientCreateRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Patient created",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientCreateResponseOpenApiSchema,
              },
            },
          },
          "200": {
            description: "Identical idempotent replay; existing patient returned",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientCreateResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid patient create request or Idempotency-Key header (PAT-0007)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "409": domainErrorResponse(
            "Patient number conflict (PAT-0003) or idempotency conflict (PAT-0006)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/patients/{patientId}": {
      get: {
        operationId: "getPatientById",
        tags: ["patients"],
        summary: "Return one versioned patient summary by ID within the authenticated tenant and pharmacy context",
        description:
          "Requires patient:read scope and tenant context. Used to refresh the cross-route patient context (R-PATCTX) and to obtain the version consumed by PUT. The response contains PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-001",
        "x-yrese-required-scope": "patient:read",
        requestParams: {
          path: patientGetParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Versioned patient summary",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientVersionedSummaryOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse("Invalid patient ID (PAT-0001)"),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
          "404": domainErrorResponse("Patient not found (PAT-0002)"),
        },
      },
      put: {
        operationId: "updatePatient",
        tags: ["patients"],
        summary: "Update mutable patient identity fields with optimistic concurrency",
        description:
          "Requires patient:write scope and tenant context. expectedVersion in the body and the quoted If-Match header must both equal the current version. Identity changes are appended to patient identity history. patientNumber is immutable and rejected with 422 PAT-0005. The response contains PHI and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-001",
        "x-yrese-required-scope": "patient:write",
        requestParams: {
          path: patientGetParamsOpenApiSchema,
          header: patientUpdateHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: patientUpdateRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Patient updated",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: patientUpdateResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid patient update request or If-Match header (PAT-0007)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "404": domainErrorResponse("Patient not found (PAT-0002)"),
          "412": domainErrorResponse("Patient version conflict (PAT-0004)"),
          "422": domainErrorResponse(
            "Immutable patient field change attempt (PAT-0005)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/patients/{patientId}/coverage": {
      get: {
        operationId: "listPatientCoverage",
        tags: ["patients", "coverage"],
        summary: "List coverage rows date-valid at an explicit asOf date (API-020)",
        description:
          "Requires patient:read, insurance:read, and public-expense:read scopes (the response carries both insurance and public-expense rows). asOf is mandatory — the server never resolves an implicit 'today' (MOD-011). Superseded rows are returned with the supersededBy marker; full history without asOf is not offered. Emits insurance.viewed audit before the response. The response contains coverage identifiers (PHI) and must use Cache-Control: no-store.",
        "x-yrese-ssot": "API-020",
        "x-yrese-required-scopes": [
          "patient:read",
          "insurance:read",
          "public-expense:read",
        ],
        requestParams: {
          path: coverageParamsOpenApiSchema,
          query: coverageListQueryOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Coverage rows valid at asOf",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: coverageListResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid coverage list request (missing/invalid asOf — INS-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "404": domainErrorResponse("Patient not found (INS-0002)"),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
      post: {
        operationId: "recordPatientCoverage",
        tags: ["patients", "coverage"],
        summary: "Append a coverage row or a superseding correction (API-020)",
        description:
          "Requires patient:read plus a kind-specific write scope: insurance:write for kind=insurance-card, public-expense:write for kind=public-expense, and the targetKind's write scope for kind=supersede. Idempotent via the Idempotency-Key header (API-013): same key + same payload returns the existing row with 200; a different payload returns 409 INS-0006. Overlapping insurance-card periods return 409 INS-0003, duplicate public-expense priority with overlapping period returns 409 INS-0004, and a missing or already-superseded target returns 409 INS-0005. Emits insurance.updated audit before the response.",
        "x-yrese-ssot": "API-020",
        "x-yrese-required-scope": "patient:read + kind-scoped write",
        requestParams: {
          path: coverageParamsOpenApiSchema,
          header: coverageRecordHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: coverageRecordRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Coverage row recorded",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: coverageRecordResponseOpenApiSchema,
              },
            },
          },
          "200": {
            description: "Identical idempotent replay; existing row returned",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: coverageRecordResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid coverage request or Idempotency-Key header (INS-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "404": domainErrorResponse("Patient not found (INS-0002)"),
          "409": domainErrorResponse(
            "Period overlap (INS-0003), priority conflict (INS-0004), supersede target invalid (INS-0005), or idempotency conflict (INS-0006)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },};
