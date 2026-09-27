import {
  dispensingConfirmParamsOpenApiSchema,
  dispensingConfirmRequestOpenApiSchema,
  dispensingConfirmResponseOpenApiSchema,
  dispensingCreateRequestOpenApiSchema,
  dispensingCreateResponseOpenApiSchema,
  domainErrorResponse,
  forbiddenErrorResponse,
  internalErrorResponse,
  jsonContentType,
  noStoreHeaders,
  prescriptionLifecycleHeadersOpenApiSchema,
} from "./openapi-schemas.js";

export const dispensingPaths = {
    "/dispensings": {
      post: {
        operationId: "createDispensingRecord",
        tags: ["dispensing"],
        summary: "Record dispensing execution against a finalized prescription version",
        description:
          "WP-7404 (DOM-002 §5, DOM-004 §1, API-021). Requires dispensing:write scope. The target prescription version is explicit and must be finalized; open inquiries block creation (DSP-0001), one record per prescription version (DSP-0007), items must cover every rpItem exactly once (DSP-0005), and generic substitution requires the source item's genericSubstitutionPermitted plus matching genericNameCode (DSP-0004). Idempotency-Key is required; replaying the same key with an identical payload returns the stored record. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "API-021",
        "x-yrese-required-scopes": ["dispensing:write"],
        requestParams: {
          header: prescriptionLifecycleHeadersOpenApiSchema,
        },
        requestBody: {
          content: {
            [jsonContentType]: {
              schema: dispensingCreateRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Dispensing record created (status null until confirmation)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: dispensingCreateResponseOpenApiSchema,
              },
            },
          },
          "200": {
            description: "Idempotent replay of the stored dispensing record",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: dispensingCreateResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid dispensing request (DSP-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription or finalized version not found in scope (DSP-0003)",
          ),
          "409": domainErrorResponse(
            "Dispensing guard failed (DSP-0001/DSP-0004/DSP-0007/DSP-0008)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/dispensings/{dispensingId}/confirm": {
      post: {
        operationId: "confirmDispensingRecord",
        tags: ["dispensing"],
        summary: "Confirm a dispensing record (DISPENSING_RECORDED) by a qualified pharmacist",
        description:
          "WP-7404 (DOM-004 §1, SEC-010, API-021). Requires dispensing:confirm scope and an active pharmacist qualification evidence record; qualification is evaluated before existence. The status transition, audit event, and dispense.confirmed outbox intent commit in one transaction; records are immutable after confirmation. Idempotency-Key is required; replaying the same key returns the stored view, a different key on a confirmed record is an invalid transition (DSP-0002), and a key already used to confirm another record conflicts (DSP-0008). Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "API-021",
        "x-yrese-required-scopes": ["dispensing:confirm"],
        requestParams: {
          path: dispensingConfirmParamsOpenApiSchema,
          header: prescriptionLifecycleHeadersOpenApiSchema,
        },
        requestBody: {
          content: {
            [jsonContentType]: {
              schema: dispensingConfirmRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Dispensing confirmed (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: dispensingConfirmResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid dispensing request (DSP-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Dispensing record not found in scope (DSP-0003)",
          ),
          "409": domainErrorResponse(
            "Invalid lifecycle transition (DSP-0002) or confirm idempotency conflict (DSP-0008)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },};
