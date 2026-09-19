import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { z } from "zod";

import { auditLogQuerySchema, auditLogResponseSchema } from "./audit-log.js";
import {
  eligibilitySnapshotListResponseSchema,
  eligibilitySnapshotParamsSchema,
  eligibilitySnapshotRecordRequestSchema,
  eligibilitySnapshotRecordResponseSchema,
} from "./eligibility-snapshot.js";
import {
  coverageListQuerySchema,
  coverageListResponseSchema,
  coverageParamsSchema,
  coverageRecordHeadersSchema,
  coverageRecordRequestSchema,
  coverageRecordResponseSchema,
} from "./coverage.js";
import { errorResponseSchema, frameworkErrorResponseSchema } from "./error.js";
import { healthResponseSchema } from "./health.js";
import {
  masterMedicationsResponseSchema,
  masterQuerySchema,
  masterUsagesResponseSchema,
} from "./master.js";
import {
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryQuerySchema,
  receptionSummaryResponseSchema,
} from "./operations-status.js";
import {
  patientCreateHeadersSchema,
  patientCreateRequestSchema,
  patientCreateResponseSchema,
  patientGetParamsSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientUpdateHeadersSchema,
  patientUpdateRequestSchema,
  patientUpdateResponseSchema,
  patientVersionedSummarySchema,
} from "./patient-search.js";
import {
  prescriptionDraftFromPriorRequestSchema,
  prescriptionDraftParamsSchema,
  prescriptionDraftQuerySchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
  prescriptionDraftUpdateHeadersSchema,
} from "./prescription-draft.js";
import {
  prescriptionLifecycleHeadersSchema,
  prescriptionLifecycleParamsSchema,
  prescriptionLifecycleViewSchema,
} from "./prescription-lifecycle.js";
import {
  prescriptionAmendRequestSchema,
  prescriptionAmendmentHeadersSchema,
  prescriptionInquiryAnswerParamsSchema,
  prescriptionInquiryAnswerRequestSchema,
  prescriptionInquiryCreateRequestSchema,
  prescriptionInquiryListResponseSchema,
  prescriptionInquiryParamsSchema,
  prescriptionInquiryViewSchema,
  prescriptionVersionListResponseSchema,
  prescriptionVersionParamsSchema,
  prescriptionVersionViewSchema,
} from "./prescription-amendment.js";
import {
  receptionCreateRequestSchema,
  receptionQueueQuerySchema,
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
  receptionTransitionHeadersSchema,
  receptionTransitionParamsSchema,
  receptionTransitionRequestSchema,
  receptionTransitionResponseSchema,
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

const domainErrorResponse = (description: string) => ({
  description,
  content: {
    [jsonContentType]: {
      schema: errorResponseOpenApiSchema,
    },
  },
});

const forbiddenErrorResponse = (options: { readonly noStore: boolean }) => ({
  description: "Forbidden (AUTH-0003)",
  ...(options.noStore ? { headers: noStoreHeaders } : {}),
  content: {
    [jsonContentType]: {
      schema: errorResponseOpenApiSchema,
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



const patientVersionedSummaryOpenApiSchema = patientVersionedSummarySchema.meta({
  id: "PatientVersionedSummary",
  description:
    "Patient summary including the optimistic-concurrency version consumed by PUT If-Match/expectedVersion.",
});

const patientCreateHeadersOpenApiSchema = patientCreateHeadersSchema.meta({
  id: "PatientCreateHeaders",
  description:
    "Idempotency-Key is required on every patient create request (API-013 opaque key).",
});

const patientCreateRequestOpenApiSchema = patientCreateRequestSchema.meta({
  id: "PatientCreateRequest",
  description:
    "Patient registration. patientNumber is optional; when omitted the server assigns the next scope-local number.",
});

const patientCreateResponseOpenApiSchema = patientCreateResponseSchema.meta({
  id: "PatientCreateResponse",
  description:
    "Created or replayed patient with optional duplicate-candidate warnings (capped at 5).",
});

const patientUpdateHeadersOpenApiSchema = patientUpdateHeadersSchema.meta({
  id: "PatientUpdateHeaders",
  description:
    'If-Match must equal the quoted expectedVersion, for example "2". Required on every update request.',
});

const patientUpdateRequestOpenApiSchema = patientUpdateRequestSchema.meta({
  id: "PatientUpdateRequest",
  description:
    "Patient update command. expectedVersion is required and at least one mutable identity field must be present. patientNumber is immutable and rejected when present.",
});

const patientUpdateResponseOpenApiSchema = patientUpdateResponseSchema.meta({
  id: "PatientUpdateResponse",
  description: "Updated patient with the incremented version.",
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

const receptionTransitionParamsOpenApiSchema = receptionTransitionParamsSchema.meta({
  id: "ReceptionTransitionParams",
  description: "Reception transition path parameters",
});

const receptionTransitionHeadersOpenApiSchema = receptionTransitionHeadersSchema.meta({
  id: "ReceptionTransitionHeaders",
  description:
    'If-Match must equal the quoted expectedVersion, for example "2". Required on every transition request.',
});

const receptionTransitionRequestOpenApiSchema = receptionTransitionRequestSchema.meta({
  id: "ReceptionTransitionRequest",
  description:
    "Reception status transition command. businessReason is a structured uppercase reason code required only when to=CANCELLED.",
});

const receptionTransitionResponseOpenApiSchema = receptionTransitionResponseSchema.meta({
  id: "ReceptionTransitionResponse",
  description:
    "Reception transition result. PHI-free: carries reception identity, new status, and version only.",
});

const eligibilitySnapshotParamsOpenApiSchema =
  eligibilitySnapshotParamsSchema.meta({
    id: "EligibilitySnapshotParams",
    description: "Eligibility snapshot path parameters scoped by reception ID.",
  });

const eligibilitySnapshotRecordRequestOpenApiSchema =
  eligibilitySnapshotRecordRequestSchema.meta({
    id: "EligibilitySnapshotRecordRequest",
    description:
      "Manual eligibility confirmation record. Only counter-verifiable pairs are accepted: CARD_ONLINE→VERIFIED_CARD, CARD_VISUAL→PROVISIONAL_VISUAL (API-019). rawResponseRef is an opaque external-evidence handle — never qualification content.",
  });

const eligibilitySnapshotRecordResponseOpenApiSchema =
  eligibilitySnapshotRecordResponseSchema.meta({
    id: "EligibilitySnapshotRecordResponse",
    description:
      "Recorded eligibility snapshot. PHI-free: identifiers, method, state, and dates only — no insurer or card identifiers.",
  });

const eligibilitySnapshotListResponseOpenApiSchema =
  eligibilitySnapshotListResponseSchema.meta({
    id: "EligibilitySnapshotListResponse",
    description:
      "Current reception eligibility (derived at the reception business date) plus append-only snapshot history, newest first. PHI-free identifiers and state only.",
  });

const coverageParamsOpenApiSchema = coverageParamsSchema.meta({
  id: "CoverageParams",
  description: "Coverage path parameters scoped by patient ID.",
});

const coverageListQueryOpenApiSchema = coverageListQuerySchema.meta({
  id: "CoverageListQuery",
  description:
    "Coverage list query. asOf is required (YYYY-MM-DD real calendar date) — the server never resolves an implicit 'today' (MOD-011).",
});

const coverageRecordRequestOpenApiSchema = coverageRecordRequestSchema.meta({
  id: "CoverageRecordRequest",
  description:
    "Append-only coverage registration (API-020). kind=insurance-card or public-expense records a new row; kind=supersede records a corrected row linked to targetId. UPDATE/DELETE do not exist — correction is supersede only. copayRatio and priority are recorded input values, never calculated (CAL-R-024 remains BLOCKED).",
});

const coverageRecordResponseOpenApiSchema = coverageRecordResponseSchema.meta({
  id: "CoverageRecordResponse",
  description:
    "Recorded coverage row. Contains coverage identifiers (insurer/insured numbers or payer/recipient numbers) — PHI; no-store only.",
});

const coverageListResponseOpenApiSchema = coverageListResponseSchema.meta({
  id: "CoverageListResponse",
  description:
    "Coverage rows date-valid at asOf, including superseded rows carrying the supersededBy marker. Contains coverage identifiers — PHI; no-store only.",
});

const coverageRecordHeadersOpenApiSchema = coverageRecordHeadersSchema.meta({
  id: "CoverageRecordHeaders",
  description:
    "Required headers: Idempotency-Key (opaque, [A-Za-z0-9_-]{16,128}).",
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

const prescriptionDraftFromPriorRequestOpenApiSchema =
  prescriptionDraftFromPriorRequestSchema.meta({
    id: "PrescriptionDraftFromPriorRequest",
    description:
      "WP-7304 (PRD-001 M4) copy-start request. sourcePrescriptionId is required and never auto-selected; sourceVersion defaults to the latest finalized version.",
  });

const prescriptionDraftResponseOpenApiSchema = prescriptionDraftResponseSchema.meta({
  id: "PrescriptionDraftResponse",
  description:
    "Server-saved prescription draft with optimistic-concurrency version and actor metadata. Contains clinical PHI.",
});

const prescriptionLifecycleParamsOpenApiSchema =
  prescriptionLifecycleParamsSchema.meta({
    id: "PrescriptionLifecycleParams",
    description:
      "Target prescription path parameter for confirm/finalize commands.",
  });
const prescriptionLifecycleHeadersOpenApiSchema =
  prescriptionLifecycleHeadersSchema.meta({
    id: "PrescriptionLifecycleHeaders",
    description:
      "Required Idempotency-Key header for lifecycle command replay handling.",
  });
const prescriptionLifecycleViewOpenApiSchema =
  prescriptionLifecycleViewSchema.meta({
    id: "PrescriptionLifecycleView",
    description:
      "Lifecycle state after a confirm/finalize transition (no clinical content beyond identifiers and status).",
  });
const prescriptionDraftSaveResponseOpenApiSchema =
  prescriptionDraftSaveResponseSchema.meta({
    id: "PrescriptionDraftSaveResponse",
    description:
      "Prescription draft save result, including created/updated/unchanged disposition. Contains clinical PHI.",
  });

const prescriptionInquiryParamsOpenApiSchema =
  prescriptionInquiryParamsSchema.meta({
    id: "PrescriptionInquiryParams",
    description:
      "Target prescription path parameter for amendment/inquiry routes.",
  });
const prescriptionInquiryAnswerParamsOpenApiSchema =
  prescriptionInquiryAnswerParamsSchema.meta({
    id: "PrescriptionInquiryAnswerParams",
    description:
      "Prescription and inquiry path parameters for the answer command.",
  });
const prescriptionVersionParamsOpenApiSchema =
  prescriptionVersionParamsSchema.meta({
    id: "PrescriptionVersionParams",
    description:
      "Prescription and immutable version path parameters for version reads.",
  });
const prescriptionAmendmentHeadersOpenApiSchema =
  prescriptionAmendmentHeadersSchema.meta({
    id: "PrescriptionAmendmentHeaders",
    description:
      "Required Idempotency-Key header for amendment/inquiry command replay handling.",
  });
const prescriptionInquiryCreateRequestOpenApiSchema =
  prescriptionInquiryCreateRequestSchema.meta({
    id: "PrescriptionInquiryCreateRequest",
    description:
      "Inquiry record creation (directedTo + content). Contains clinical free text and must not be logged in plaintext.",
  });
const prescriptionInquiryAnswerRequestOpenApiSchema =
  prescriptionInquiryAnswerRequestSchema.meta({
    id: "PrescriptionInquiryAnswerRequest",
    description:
      "Write-once inquiry answer (answer + result UNCHANGED/CHANGED). Contains clinical free text.",
  });
const prescriptionAmendRequestOpenApiSchema =
  prescriptionAmendRequestSchema.meta({
    id: "PrescriptionAmendRequest",
    description:
      "Amendment command: the resolving CHANGED inquiryId plus the new version content (same schema as draft save). Contains clinical PHI.",
  });
const prescriptionInquiryViewOpenApiSchema =
  prescriptionInquiryViewSchema.meta({
    id: "PrescriptionInquiryView",
    description:
      "Recorded inquiry with derived OPEN/RESOLVED status. Contains clinical free text (directedTo/content/answer).",
  });
const prescriptionInquiryListResponseOpenApiSchema =
  prescriptionInquiryListResponseSchema.meta({
    id: "PrescriptionInquiryListResponse",
    description:
      "Inquiry list for one prescription in recorded order. Contains clinical free text.",
  });
const prescriptionVersionViewOpenApiSchema =
  prescriptionVersionViewSchema.meta({
    id: "PrescriptionVersionView",
    description:
      "Immutable prescription version snapshot with amendment lineage (supersedesVersion/inquiryId on version >= 2). Contains clinical PHI.",
  });
const prescriptionVersionListResponseOpenApiSchema =
  prescriptionVersionListResponseSchema.meta({
    id: "PrescriptionVersionListResponse",
    description:
      "Immutable version list for one prescription in version order. Contains clinical PHI.",
  });

const masterQueryOpenApiSchema = masterQuerySchema.meta({
  id: "MasterQuery",
  description:
    "Explicit asOf date is mandatory — the server never resolves an implicit 'today' (MOD-011). q is optional, max 100 chars: prefix match on localCode, substring match on name/text, case-sensitive code-point comparison (COLLATE \"C\" parity).",
});

const masterMedicationsResponseOpenApiSchema =
  masterMedicationsResponseSchema.meta({
    id: "MasterMedicationsResponse",
    description:
      "Medication items of the master version valid at asOf (masterVersion is null when no version covers asOf — empty result, not 404). Non-PHI; synthetic distribution only (RB-009).",
  });

const masterUsagesResponseOpenApiSchema = masterUsagesResponseSchema.meta({
  id: "MasterUsagesResponse",
  description:
    "Usage items of the master version valid at asOf (masterVersion is null when no version covers asOf). Non-PHI; synthetic distribution only (RB-009).",
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
          "403": forbiddenErrorResponse({ noStore: false }),
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
    },
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
          "400": domainErrorResponse(
            "Invalid reception queue query (RCV-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
          "503": domainErrorResponse(
            "Queue exceeds the defensive bound RECEPTION_QUEUE_MAX_ENTRIES (RCV-0007). PHI-free response carrying nextAction; no queue.viewed audit is recorded",
          ),
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
          "403": forbiddenErrorResponse({ noStore: false }),
          "500": internalErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Patient not found for reception (RCV-0002)",
          ),
          "409": domainErrorResponse("Idempotency conflict (RCV-0003)"),
        },
      },
    },
    "/reception/{receptionId}/transitions": {
      post: {
        operationId: "transitionReception",
        tags: ["reception"],
        summary: "Drive the reception queue sub-state machine (DOM-004 §2)",
        description:
          "Requires reception:write scope only — the response carries no PatientSummary PHI. Optimistic concurrency via expectedVersion + If-Match; retry convergence is via 409 + GET /reception/queue (no Idempotency-Key). businessReason is a structured uppercase reason code required only when to=CANCELLED.",
        "x-yrese-ssot": "API-006",
        "x-yrese-required-scopes": ["reception:write"],
        requestParams: {
          path: receptionTransitionParamsOpenApiSchema,
          header: receptionTransitionHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: receptionTransitionRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Reception transition applied",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: receptionTransitionResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid transition request — bad body, missing/malformed/mismatched If-Match, or businessReason misuse (RCV-0001)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Reception not found within tenant/pharmacy scope (RCV-0006)",
          ),
          "409": domainErrorResponse(
            "Transition not allowed (RCV-0004) or version conflict (RCV-0005)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/reception/{receptionId}/eligibility-snapshots": {
      post: {
        operationId: "recordEligibilitySnapshot",
        tags: ["reception"],
        summary: "Record a manual eligibility confirmation snapshot (API-019)",
        description:
          "Requires insurance:write and reception:read scopes. Counter-verifiable pairs only (CARD_ONLINE→VERIFIED_CARD, CARD_VISUAL→PROVISIONAL_VISUAL); EXPIRED/MISMATCH/MYNA states are system- or external-IF-derived and rejected with 422. Idempotent resend of the same snapshotId+payload returns 200; a different payload returns 409. Success emits eligibility.verified or eligibility.provisional_recorded audit before the response.",
        "x-yrese-ssot": "API-019",
        "x-yrese-required-scopes": ["insurance:write", "reception:read"],
        requestParams: {
          path: eligibilitySnapshotParamsOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: eligibilitySnapshotRecordRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Eligibility snapshot recorded and linked to the reception",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: eligibilitySnapshotRecordResponseOpenApiSchema,
              },
            },
          },
          "200": {
            description:
              "Idempotent resend returned the existing snapshot (no new audit event)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: eligibilitySnapshotRecordResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid eligibility request or method-state inconsistency (INS-0007)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Reception not found within tenant/pharmacy scope (INS-0008)",
          ),
          "409": domainErrorResponse(
            "snapshotId exists with a different payload (INS-0009)",
          ),
          "422": domainErrorResponse(
            "State/method pair not manually recordable or transition not allowed (INS-0010)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
      get: {
        operationId: "listEligibilitySnapshots",
        tags: ["reception"],
        summary: "Read current reception eligibility and snapshot history (API-019)",
        description:
          "Requires insurance:read and reception:read scopes. Current state is derived from the reception business date; history is append-only and returned newest first. Emits insurance.viewed audit before the response.",
        "x-yrese-ssot": "API-019",
        "x-yrese-required-scopes": ["insurance:read", "reception:read"],
        requestParams: {
          path: eligibilitySnapshotParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Current eligibility and snapshot history",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: eligibilitySnapshotListResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse("Invalid reception ID (INS-0007)"),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Reception not found within tenant/pharmacy scope (INS-0008)",
          ),
          "500": internalErrorResponse({ noStore: true }),
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
          "403": forbiddenErrorResponse({ noStore: true }),
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
          "403": forbiddenErrorResponse({ noStore: true }),
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
    "/prescription-drafts/by-reception/{receptionId}/from-prior": {
      post: {
        operationId: "createPrescriptionDraftFromPrior",
        tags: ["prescriptions"],
        summary: "Create an editable draft copied from a finalized prescription version",
        description:
          "WP-7304 (PRD-001 M4). Requires prescription:write, reception:read, and patient:read. The source prescription must be identified explicitly by sourcePrescriptionId (never auto-selected); sourceVersion defaults to the latest finalized version. Master references are re-resolved against current master data and stale items degrade to unresolved text. No Idempotency-Key: the per-reception draft uniqueness makes a retried copy a 409. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
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
              schema: prescriptionDraftFromPriorRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "201": {
            description: "Prescription draft created from a prior finalized version",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionDraftSaveResponseOpenApiSchema,
              },
            },
          },
          "400": frameworkFailureResponse("Invalid prescription draft request"),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": frameworkFailureResponse(
            "Verified reception/patient context or finalized source version not found",
          ),
          "409": frameworkFailureResponse(
            "Prescription draft already exists for this reception",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/confirm": {
      post: {
        operationId: "confirmPrescription",
        tags: ["prescriptions"],
        summary: "Record pharmacist confirmation for a prescription draft",
        description:
          "WP-7402 (DOM-004, SEC-010). Requires prescription:confirm scope and an active pharmacist qualification evidence record. Fails closed: unresolved medication codes (RX-0001), incomplete source metadata (RX-0003), reception not IN_PROGRESS (RX-0004), and any reverse transition (RX-0002) are rejected. Idempotency-Key is required; replaying the same key returns the stored view. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-004",
        "x-yrese-required-scopes": ["prescription:confirm"],
        requestParams: {
          path: prescriptionLifecycleParamsOpenApiSchema,
          header: prescriptionLifecycleHeadersOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Prescription confirmed (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionLifecycleViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid lifecycle command request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "409": domainErrorResponse(
            "Transition guard failed (RX-0001/RX-0002/RX-0003/RX-0004)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/finalize": {
      post: {
        operationId: "finalizePrescription",
        tags: ["prescriptions"],
        summary: "Finalize a pharmacist-confirmed prescription into an immutable version",
        description:
          "WP-7402 (DOM-004, SEC-010). Requires prescription:confirm scope and an active pharmacist qualification. Only PHARMACIST_CONFIRMED prescriptions finalize; the status update, immutable prescription_versions snapshot, audit event, and outbox intent commit in one transaction. Idempotency-Key is required. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-004",
        "x-yrese-required-scopes": ["prescription:confirm"],
        requestParams: {
          path: prescriptionLifecycleParamsOpenApiSchema,
          header: prescriptionLifecycleHeadersOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Prescription finalized (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionLifecycleViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid lifecycle command request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "409": domainErrorResponse(
            "Transition guard failed (RX-0001/RX-0002/RX-0003/RX-0004)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/inquiries": {
      post: {
        operationId: "createPrescriptionInquiry",
        tags: ["prescriptions"],
        summary: "Record a prescription inquiry (疑点・照会) for a prescription",
        description:
          "WP-7403 (DOM-002 §5, MOD-006). Requires prescription:write scope. Records the inquiry target and content; the answer is written once via the answer command. Idempotency-Key is required; replaying the same key with the same payload returns the stored view and a different payload fails with RX-0010. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": ["prescription:write"],
        requestParams: {
          path: prescriptionInquiryParamsOpenApiSchema,
          header: prescriptionAmendmentHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: prescriptionInquiryCreateRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Inquiry recorded (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionInquiryViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid inquiry command request (RX-0008)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "409": domainErrorResponse(
            "Idempotency-Key replay with a different payload (RX-0010)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
      get: {
        operationId: "listPrescriptionInquiries",
        tags: ["prescriptions"],
        summary: "List recorded inquiries for a prescription",
        description:
          "WP-7403 (DOM-002 §5). Requires prescription:read, reception:read, and patient:read. Returns inquiry views in recorded order (OPEN first by entry time, not grouped). Contains clinical free text. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": [
          "prescription:read",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionInquiryParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Recorded inquiries in recorded order",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionInquiryListResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid prescription read request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/inquiries/{inquiryId}/answer": {
      post: {
        operationId: "answerPrescriptionInquiry",
        tags: ["prescriptions"],
        summary: "Record the write-once answer and result for an inquiry",
        description:
          "WP-7403 (DOM-002 §5, DOM-004 §1). Requires prescription:write scope. The answer is write-once: re-answering with a different key or payload is rejected (RX-0002/RX-0010), and a corrected record requires a new inquiry. result CHANGED is the precondition for the amend command. answeredBy/answeredAt come from trusted context and the server clock. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": ["prescription:write"],
        requestParams: {
          path: prescriptionInquiryAnswerParamsOpenApiSchema,
          header: prescriptionAmendmentHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: prescriptionInquiryAnswerRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Inquiry answer recorded (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionInquiryViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid inquiry command request (RX-0008)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription or inquiry not found in scope (RX-0006/RX-0009)",
          ),
          "409": domainErrorResponse(
            "Inquiry already answered (RX-0002) or idempotent payload mismatch (RX-0010)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/amend": {
      post: {
        operationId: "amendPrescription",
        tags: ["prescriptions"],
        summary: "Create an amended version of a finalized prescription",
        description:
          "WP-7403 (DOM-002 §4/§5, DOM-004 §1, SEC-010). Requires prescription:confirm scope and an active pharmacist qualification evidence record. Only PRESCRIPTION_FINALIZED prescriptions amend; the new version requires a RESOLVED inquiry with result CHANGED on the same prescription (RX-0007 otherwise). The status stays PRESCRIPTION_FINALIZED — the version number carries the amendment. The version insert, audit event, and outbox intent commit in one transaction. Idempotency-Key is required. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": ["prescription:confirm"],
        requestParams: {
          path: prescriptionInquiryParamsOpenApiSchema,
          header: prescriptionAmendmentHeadersOpenApiSchema,
        },
        requestBody: {
          required: true,
          content: {
            [jsonContentType]: {
              schema: prescriptionAmendRequestOpenApiSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Amended version created (or replayed idempotent view)",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionVersionViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid amendment command request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "409": domainErrorResponse(
            "Guard failed (RX-0001/RX-0002/RX-0003/RX-0010)",
          ),
          "422": domainErrorResponse(
            "Amendment precondition inquiry missing, open, or not CHANGED (RX-0007)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/versions": {
      get: {
        operationId: "listPrescriptionVersions",
        tags: ["prescriptions"],
        summary: "List immutable prescription versions",
        description:
          "WP-7403 (DOM-002 §4). Requires prescription:read, reception:read, and patient:read. Returns the append-only version snapshots in version order; the highest version is the authoritative current content of a finalized prescription. Contains clinical PHI. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": [
          "prescription:read",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionInquiryParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Immutable versions in version order",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionVersionListResponseOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid prescription read request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription not found in scope (RX-0006)",
          ),
          "500": internalErrorResponse({ noStore: true }),
        },
      },
    },
    "/prescriptions/{prescriptionId}/versions/{version}": {
      get: {
        operationId: "getPrescriptionVersion",
        tags: ["prescriptions"],
        summary: "Read one immutable prescription version",
        description:
          "WP-7403 (DOM-002 §4). Requires prescription:read, reception:read, and patient:read. Superseded versions remain readable; an absent version is reported as not found. Contains clinical PHI. Every status uses Cache-Control: no-store.",
        "x-yrese-ssot": "DOM-002",
        "x-yrese-required-scopes": [
          "prescription:read",
          "reception:read",
          "patient:read",
        ],
        requestParams: {
          path: prescriptionVersionParamsOpenApiSchema,
        },
        responses: {
          "200": {
            description: "Immutable version snapshot",
            headers: noStoreHeaders,
            content: {
              [jsonContentType]: {
                schema: prescriptionVersionViewOpenApiSchema,
              },
            },
          },
          "400": domainErrorResponse(
            "Invalid prescription read request (RX-0005)",
          ),
          "403": forbiddenErrorResponse({ noStore: true }),
          "404": domainErrorResponse(
            "Prescription or version not found in scope (RX-0006)",
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
    },
  },
} satisfies ZodOpenApiObject;

export function createYreseOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument(openApiDefinition, {
    cycles: "throw",
    reused: "inline",
  });
}
