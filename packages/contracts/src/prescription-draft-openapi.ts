import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { errorResponseSchema, frameworkErrorResponseSchema } from "./error.js";
import {
  prescriptionDraftParamsSchema,
  prescriptionDraftQuerySchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
} from "./prescription-draft.js";

const jsonContentType = "application/json";

const errorResponseOpenApiSchema = errorResponseSchema.meta({
  id: "ErrorResponse",
  description: "PHI-free API error response",
});

const frameworkErrorResponseOpenApiSchema = frameworkErrorResponseSchema.meta({
  id: "FrameworkErrorResponse",
  description:
    "Normalized framework-shaped error with constant safe text; never a raw exception and never PHI.",
});

const prescriptionDraftParamsOpenApiSchema = prescriptionDraftParamsSchema.meta({
  id: "PrescriptionDraftParams",
  description: "Reception-scoped prescription draft path parameters.",
});

const prescriptionDraftQueryOpenApiSchema = prescriptionDraftQuerySchema.meta({
  id: "PrescriptionDraftQuery",
  description:
    "Exact patient and business-date selector. Authorization remains server-side tenant and pharmacy scoped.",
});

const prescriptionDraftSaveRequestOpenApiSchema =
  prescriptionDraftSaveRequestSchema.meta({
    id: "PrescriptionDraftSaveRequest",
    description:
      "Version-checked structured prescription draft save request. Contains PHI and must not be logged in plaintext.",
  });

const prescriptionDraftResponseOpenApiSchema = prescriptionDraftResponseSchema.meta({
  id: "PrescriptionDraftResponse",
  description:
    "Structured versioned prescription draft. Contains PHI and must use Cache-Control: no-store.",
});

const prescriptionDraftSaveResponseOpenApiSchema =
  prescriptionDraftSaveResponseSchema.meta({
    id: "PrescriptionDraftSaveResponse",
    description:
      "Saved prescription draft plus deterministic save disposition. Contains PHI and must use Cache-Control: no-store.",
  });

const noStoreHeaders = {
  "Cache-Control": {
    description:
      "Always `no-store` on this PHI-bearing route, including error responses.",
    schema: { type: "string" as const, enum: ["no-store"] },
  },
};

const frameworkFailure = (description: string) => ({
  description,
  headers: noStoreHeaders,
  content: {
    [jsonContentType]: {
      schema: frameworkErrorResponseOpenApiSchema,
    },
  },
});

const forbiddenResponse = {
  description: "Forbidden (AUTH-0003)",
  headers: noStoreHeaders,
  content: {
    [jsonContentType]: {
      schema: errorResponseOpenApiSchema,
    },
  },
};

const definition = {
  openapi: "3.1.0",
  info: {
    title: "yrese Prescription Draft API fragment",
    version: "0.0.1",
  },
  paths: {
    "/prescription-drafts/by-reception/{receptionId}": {
      get: {
        operationId: "getPrescriptionDraftByReception",
        tags: ["prescriptions"],
        summary: "Get the versioned prescription draft for one verified reception context",
        description:
          "Requires prescription:read, reception:read, and patient:read. Tenant, pharmacy, reception, patient, and business date are checked together. A 404 does not disclose which scoped identity failed.",
        "x-yrese-ssot": "API-008",
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
          "400": frameworkFailure("Invalid prescription draft selector"),
          "403": forbiddenResponse,
          "404": frameworkFailure(
            "Draft or exact reception-patient-business-date context not found",
          ),
          "500": frameworkFailure(
            "Normalized internal error with constant PHI-free message",
          ),
        },
      },
      put: {
        operationId: "savePrescriptionDraftByReception",
        tags: ["prescriptions"],
        summary: "Create or update a versioned prescription draft",
        description:
          "Requires prescription:write, reception:read, and patient:read. Uses expectedVersion for optimistic concurrency. Save, structured rows/flags, and audit evidence are atomic in PostgreSQL repository mode.",
        "x-yrese-ssot": "API-008",
        "x-yrese-required-scopes": [
          "prescription:write",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionDraftParamsOpenApiSchema,
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
          "200": {
            description:
              "Existing draft updated, unchanged, or an identical committed request replayed",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftSaveResponseOpenApiSchema,
              },
            },
          },
          "201": {
            description: "New prescription draft created",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftSaveResponseOpenApiSchema,
              },
            },
          },
          "400": frameworkFailure("Invalid prescription draft save request"),
          "403": forbiddenResponse,
          "404": frameworkFailure(
            "Exact reception-patient-business-date context not found",
          ),
          "409": frameworkFailure(
            "expectedVersion does not match the authoritative server version",
          ),
          "500": frameworkFailure(
            "Normalized internal error with constant PHI-free message",
          ),
        },
      },
    },
  },
} satisfies ZodOpenApiObject;

export function createPrescriptionDraftOpenApiDocument(): ReturnType<
  typeof createDocument
> {
  return createDocument(definition, {
    cycles: "throw",
    reused: "inline",
  });
}
