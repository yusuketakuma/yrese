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
  dispensingConfirmParamsSchema,
  dispensingConfirmRequestSchema,
  dispensingConfirmResponseSchema,
  dispensingRecordCreateRequestSchema,
  dispensingRecordCreateResponseSchema,
} from "./dispensing.js";
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

export const jsonContentType = "application/json";

export const errorResponseOpenApiSchema = errorResponseSchema.meta({
  id: "ErrorResponse",
  description: "PHI-free API error response",
});

export const frameworkErrorResponseOpenApiSchema = frameworkErrorResponseSchema.meta({
  id: "FrameworkErrorResponse",
  description:
    "Normalized framework-shaped error (JSON body parse 400 with `code`, unknown-route 404, internal 500). Message is a constant safe string; never a raw exception, never PHI.",
});

export const receptionCreateBadRequestOpenApiSchema = z
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
export const noStoreHeaders = {
  "Cache-Control": {
    description:
      "Always `no-store` on this PHI-bearing route — applied to every status including errors.",
    schema: { type: "string" as const, enum: ["no-store"] },
  },
};

export const internalErrorResponse = (options: { readonly noStore: boolean }) => ({
  description:
    "Normalized internal error. Constant invariant message; no raw exception detail, no PHI.",
  ...(options.noStore ? { headers: noStoreHeaders } : {}),
  content: {
    [jsonContentType]: {
      schema: frameworkErrorResponseOpenApiSchema,
    },
  },
});

export const frameworkFailureResponse = (description: string) => ({
  description,
  headers: noStoreHeaders,
  content: {
    [jsonContentType]: {
      schema: frameworkErrorResponseOpenApiSchema,
    },
  },
});

export const domainErrorResponse = (description: string) => ({
  description,
  content: {
    [jsonContentType]: {
      schema: errorResponseOpenApiSchema,
    },
  },
});

export const forbiddenErrorResponse = (options: { readonly noStore: boolean }) => ({
  description: "Forbidden (AUTH-0003)",
  ...(options.noStore ? { headers: noStoreHeaders } : {}),
  content: {
    [jsonContentType]: {
      schema: errorResponseOpenApiSchema,
    },
  },
});

export const healthResponseOpenApiSchema = healthResponseSchema.meta({
  id: "HealthResponse",
  description: "Health check response",
});

export const patientSearchQueryOpenApiSchema = patientSearchQuerySchema.meta({
  id: "PatientSearchQuery",
  description: "Patient search query parameters",
});

export const patientSearchResponseOpenApiSchema = patientSearchResponseSchema.meta({
  id: "PatientSearchResponse",
  description: "Patient search response. Contains PHI and must not be logged in plaintext.",
});

export const whoamiResponseOpenApiSchema = whoamiResponseSchema.meta({
  id: "WhoamiResponse",
  description: "Current tenant context response. PHI-free.",
});

export const patientGetParamsOpenApiSchema = patientGetParamsSchema.meta({
  id: "PatientGetParams",
  description: "Patient get-by-id path parameters",
});



export const patientVersionedSummaryOpenApiSchema = patientVersionedSummarySchema.meta({
  id: "PatientVersionedSummary",
  description:
    "Patient summary including the optimistic-concurrency version consumed by PUT If-Match/expectedVersion.",
});

export const patientCreateHeadersOpenApiSchema = patientCreateHeadersSchema.meta({
  id: "PatientCreateHeaders",
  description:
    "Idempotency-Key is required on every patient create request (API-013 opaque key).",
});

export const patientCreateRequestOpenApiSchema = patientCreateRequestSchema.meta({
  id: "PatientCreateRequest",
  description:
    "Patient registration. patientNumber is optional; when omitted the server assigns the next scope-local number.",
});

export const patientCreateResponseOpenApiSchema = patientCreateResponseSchema.meta({
  id: "PatientCreateResponse",
  description:
    "Created or replayed patient with optional duplicate-candidate warnings (capped at 5).",
});

export const patientUpdateHeadersOpenApiSchema = patientUpdateHeadersSchema.meta({
  id: "PatientUpdateHeaders",
  description:
    'If-Match must equal the quoted expectedVersion, for example "2". Required on every update request.',
});

export const patientUpdateRequestOpenApiSchema = patientUpdateRequestSchema.meta({
  id: "PatientUpdateRequest",
  description:
    "Patient update command. expectedVersion is required and at least one mutable identity field must be present. patientNumber is immutable and rejected when present.",
});

export const patientUpdateResponseOpenApiSchema = patientUpdateResponseSchema.meta({
  id: "PatientUpdateResponse",
  description: "Updated patient with the incremented version.",
});

export const receptionQueueQueryOpenApiSchema = receptionQueueQuerySchema.meta({
  id: "ReceptionQueueQuery",
  description: "Reception queue query parameters",
});

export const receptionQueueEntryOpenApiSchema = receptionQueueEntrySchema.meta({
  id: "ReceptionQueueEntry",
  description: "Reception queue entry. Contains PatientSummary PHI and must not be logged in plaintext.",
});

export const receptionQueueResponseOpenApiSchema = receptionQueueResponseSchema.meta({
  id: "ReceptionQueueResponse",
  description: "Reception queue response. Contains PHI and must use Cache-Control: no-store.",
});

export const receptionCreateRequestOpenApiSchema = receptionCreateRequestSchema.meta({
  id: "ReceptionCreateRequest",
  description: "Create a reception entry using an opaque idempotency key.",
});

export const receptionTransitionParamsOpenApiSchema = receptionTransitionParamsSchema.meta({
  id: "ReceptionTransitionParams",
  description: "Reception transition path parameters",
});

export const receptionTransitionHeadersOpenApiSchema = receptionTransitionHeadersSchema.meta({
  id: "ReceptionTransitionHeaders",
  description:
    'If-Match must equal the quoted expectedVersion, for example "2". Required on every transition request.',
});

export const receptionTransitionRequestOpenApiSchema = receptionTransitionRequestSchema.meta({
  id: "ReceptionTransitionRequest",
  description:
    "Reception status transition command. businessReason is a structured uppercase reason code required only when to=CANCELLED.",
});

export const receptionTransitionResponseOpenApiSchema = receptionTransitionResponseSchema.meta({
  id: "ReceptionTransitionResponse",
  description:
    "Reception transition result. PHI-free: carries reception identity, new status, and version only.",
});

export const eligibilitySnapshotParamsOpenApiSchema =
  eligibilitySnapshotParamsSchema.meta({
    id: "EligibilitySnapshotParams",
    description: "Eligibility snapshot path parameters scoped by reception ID.",
  });

export const eligibilitySnapshotRecordRequestOpenApiSchema =
  eligibilitySnapshotRecordRequestSchema.meta({
    id: "EligibilitySnapshotRecordRequest",
    description:
      "Manual eligibility confirmation record. Only counter-verifiable pairs are accepted: CARD_ONLINE→VERIFIED_CARD, CARD_VISUAL→PROVISIONAL_VISUAL (API-019). rawResponseRef is an opaque external-evidence handle — never qualification content.",
  });

export const eligibilitySnapshotRecordResponseOpenApiSchema =
  eligibilitySnapshotRecordResponseSchema.meta({
    id: "EligibilitySnapshotRecordResponse",
    description:
      "Recorded eligibility snapshot. PHI-free: identifiers, method, state, and dates only — no insurer or card identifiers.",
  });

export const eligibilitySnapshotListResponseOpenApiSchema =
  eligibilitySnapshotListResponseSchema.meta({
    id: "EligibilitySnapshotListResponse",
    description:
      "Current reception eligibility (derived at the reception business date) plus append-only snapshot history, newest first. PHI-free identifiers and state only.",
  });

export const coverageParamsOpenApiSchema = coverageParamsSchema.meta({
  id: "CoverageParams",
  description: "Coverage path parameters scoped by patient ID.",
});

export const coverageListQueryOpenApiSchema = coverageListQuerySchema.meta({
  id: "CoverageListQuery",
  description:
    "Coverage list query. asOf is required (YYYY-MM-DD real calendar date) — the server never resolves an implicit 'today' (MOD-011).",
});

export const coverageRecordRequestOpenApiSchema = coverageRecordRequestSchema.meta({
  id: "CoverageRecordRequest",
  description:
    "Append-only coverage registration (API-020). kind=insurance-card or public-expense records a new row; kind=supersede records a corrected row linked to targetId. UPDATE/DELETE do not exist — correction is supersede only. copayRatio and priority are recorded input values, never calculated (CAL-R-024 remains BLOCKED).",
});

export const coverageRecordResponseOpenApiSchema = coverageRecordResponseSchema.meta({
  id: "CoverageRecordResponse",
  description:
    "Recorded coverage row. Contains coverage identifiers (insurer/insured numbers or payer/recipient numbers) — PHI; no-store only.",
});

export const coverageListResponseOpenApiSchema = coverageListResponseSchema.meta({
  id: "CoverageListResponse",
  description:
    "Coverage rows date-valid at asOf, including superseded rows carrying the supersededBy marker. Contains coverage identifiers — PHI; no-store only.",
});

export const coverageRecordHeadersOpenApiSchema = coverageRecordHeadersSchema.meta({
  id: "CoverageRecordHeaders",
  description:
    "Required headers: Idempotency-Key (opaque, [A-Za-z0-9_-]{16,128}).",
});

export const prescriptionDraftParamsOpenApiSchema = prescriptionDraftParamsSchema.meta({
  id: "PrescriptionDraftParams",
  description: "Prescription draft path parameters scoped by reception ID.",
});

export const prescriptionDraftQueryOpenApiSchema = prescriptionDraftQuerySchema.meta({
  id: "PrescriptionDraftQuery",
  description: "Business-date selector. Patient identity is derived from the verified reception.",
});

export const prescriptionDraftUpdateHeadersOpenApiSchema =
  prescriptionDraftUpdateHeadersSchema.meta({
    id: "PrescriptionDraftUpdateHeaders",
    description:
      'If-Match is absent for the first save and must equal the quoted expectedVersion for updates, for example "2".',
  });

export const prescriptionDraftSaveRequestOpenApiSchema =
  prescriptionDraftSaveRequestSchema.meta({
    id: "PrescriptionDraftSaveRequest",
    description:
      "Versioned prescription draft save request. Contains clinical PHI and must not be logged in plaintext.",
  });

export const prescriptionDraftFromPriorRequestOpenApiSchema =
  prescriptionDraftFromPriorRequestSchema.meta({
    id: "PrescriptionDraftFromPriorRequest",
    description:
      "WP-7304 (PRD-001 M4) copy-start request. sourcePrescriptionId is required and never auto-selected; sourceVersion defaults to the latest finalized version.",
  });

export const prescriptionDraftResponseOpenApiSchema = prescriptionDraftResponseSchema.meta({
  id: "PrescriptionDraftResponse",
  description:
    "Server-saved prescription draft with optimistic-concurrency version and actor metadata. Contains clinical PHI.",
});

export const prescriptionLifecycleParamsOpenApiSchema =
  prescriptionLifecycleParamsSchema.meta({
    id: "PrescriptionLifecycleParams",
    description:
      "Target prescription path parameter for confirm/finalize commands.",
  });
export const prescriptionLifecycleHeadersOpenApiSchema =
  prescriptionLifecycleHeadersSchema.meta({
    id: "PrescriptionLifecycleHeaders",
    description:
      "Required Idempotency-Key header for lifecycle command replay handling.",
  });
export const prescriptionLifecycleViewOpenApiSchema =
  prescriptionLifecycleViewSchema.meta({
    id: "PrescriptionLifecycleView",
    description:
      "Lifecycle state after a confirm/finalize transition (no clinical content beyond identifiers and status).",
  });
export const prescriptionDraftSaveResponseOpenApiSchema =
  prescriptionDraftSaveResponseSchema.meta({
    id: "PrescriptionDraftSaveResponse",
    description:
      "Prescription draft save result, including created/updated/unchanged disposition. Contains clinical PHI.",
  });

export const prescriptionInquiryParamsOpenApiSchema =
  prescriptionInquiryParamsSchema.meta({
    id: "PrescriptionInquiryParams",
    description:
      "Target prescription path parameter for amendment/inquiry routes.",
  });
export const prescriptionInquiryAnswerParamsOpenApiSchema =
  prescriptionInquiryAnswerParamsSchema.meta({
    id: "PrescriptionInquiryAnswerParams",
    description:
      "Prescription and inquiry path parameters for the answer command.",
  });
export const prescriptionVersionParamsOpenApiSchema =
  prescriptionVersionParamsSchema.meta({
    id: "PrescriptionVersionParams",
    description:
      "Prescription and immutable version path parameters for version reads.",
  });
export const prescriptionAmendmentHeadersOpenApiSchema =
  prescriptionAmendmentHeadersSchema.meta({
    id: "PrescriptionAmendmentHeaders",
    description:
      "Required Idempotency-Key header for amendment/inquiry command replay handling.",
  });
export const prescriptionInquiryCreateRequestOpenApiSchema =
  prescriptionInquiryCreateRequestSchema.meta({
    id: "PrescriptionInquiryCreateRequest",
    description:
      "Inquiry record creation (directedTo + content). Contains clinical free text and must not be logged in plaintext.",
  });
export const prescriptionInquiryAnswerRequestOpenApiSchema =
  prescriptionInquiryAnswerRequestSchema.meta({
    id: "PrescriptionInquiryAnswerRequest",
    description:
      "Write-once inquiry answer (answer + result UNCHANGED/CHANGED). Contains clinical free text.",
  });
export const prescriptionAmendRequestOpenApiSchema =
  prescriptionAmendRequestSchema.meta({
    id: "PrescriptionAmendRequest",
    description:
      "Amendment command: the resolving CHANGED inquiryId plus the new version content (same schema as draft save). Contains clinical PHI.",
  });
export const prescriptionInquiryViewOpenApiSchema =
  prescriptionInquiryViewSchema.meta({
    id: "PrescriptionInquiryView",
    description:
      "Recorded inquiry with derived OPEN/RESOLVED status. Contains clinical free text (directedTo/content/answer).",
  });
export const prescriptionInquiryListResponseOpenApiSchema =
  prescriptionInquiryListResponseSchema.meta({
    id: "PrescriptionInquiryListResponse",
    description:
      "Inquiry list for one prescription in recorded order. Contains clinical free text.",
  });

export const dispensingCreateRequestOpenApiSchema =
  dispensingRecordCreateRequestSchema.meta({
    id: "DispensingRecordCreateRequest",
    description:
      "Dispensing record creation against an explicit finalized prescription version. Items cover every rpItem exactly once. Contains clinical record fields (quantity, free-text dispensed item).",
  });
export const dispensingCreateResponseOpenApiSchema =
  dispensingRecordCreateResponseSchema.meta({
    id: "DispensingRecordCreateResponse",
    description:
      "Created dispensing record (status null until pharmacist confirmation). Contains clinical record fields.",
  });
export const dispensingConfirmParamsOpenApiSchema =
  dispensingConfirmParamsSchema.meta({
    id: "DispensingConfirmParams",
    description: "Target dispensing path parameter for the confirm command.",
  });
export const dispensingConfirmRequestOpenApiSchema =
  dispensingConfirmRequestSchema.meta({
    id: "DispensingConfirmRequest",
    description: "Empty confirm body (Idempotency-Key header carries replay identity).",
  });
export const dispensingConfirmResponseOpenApiSchema =
  dispensingConfirmResponseSchema.meta({
    id: "DispensingConfirmResponse",
    description:
      "Confirmed dispensing record (DISPENSING_RECORDED). Contains clinical record fields.",
  });
export const prescriptionVersionViewOpenApiSchema =
  prescriptionVersionViewSchema.meta({
    id: "PrescriptionVersionView",
    description:
      "Immutable prescription version snapshot with amendment lineage (supersedesVersion/inquiryId on version >= 2). Contains clinical PHI.",
  });
export const prescriptionVersionListResponseOpenApiSchema =
  prescriptionVersionListResponseSchema.meta({
    id: "PrescriptionVersionListResponse",
    description:
      "Immutable version list for one prescription in version order. Contains clinical PHI.",
  });

export const masterQueryOpenApiSchema = masterQuerySchema.meta({
  id: "MasterQuery",
  description:
    "Explicit asOf date is mandatory — the server never resolves an implicit 'today' (MOD-011). q is optional, max 100 chars: prefix match on localCode, substring match on name/text, case-sensitive code-point comparison (COLLATE \"C\" parity).",
});

export const masterMedicationsResponseOpenApiSchema =
  masterMedicationsResponseSchema.meta({
    id: "MasterMedicationsResponse",
    description:
      "Medication items of the master version valid at asOf (masterVersion is null when no version covers asOf — empty result, not 404). Non-PHI; synthetic distribution only (RB-009).",
  });

export const masterUsagesResponseOpenApiSchema = masterUsagesResponseSchema.meta({
  id: "MasterUsagesResponse",
  description:
    "Usage items of the master version valid at asOf (masterVersion is null when no version covers asOf). Non-PHI; synthetic distribution only (RB-009).",
});

export const outboxSummaryResponseOpenApiSchema = outboxSummaryResponseSchema.meta({
  id: "OutboxSummaryResponse",
  description:
    "Transactional outbox counters and instants only (pending/delivered per event type, oldest pending instant). PHI-free: no reception, patient, or payload content. `legacyOrphanCount` is present only where it was actually derived; an omitted field means not derived, which is not the same as zero.",
});

export const receptionSummaryQueryOpenApiSchema = receptionSummaryQuerySchema.meta({
  id: "ReceptionSummaryQuery",
  description: "Business-date selector for the reception count summary",
});

export const receptionSummaryResponseOpenApiSchema = receptionSummaryResponseSchema.meta({
  id: "ReceptionSummaryResponse",
  description:
    "Reception counts for one business date, folded before leaving the service. Every reception status and eligibility status member is listed in declaration order; a zero is a measured count, not a placeholder. PHI-free: no patient identity is enumerated.",
});

export const migrationStateResponseOpenApiSchema = migrationStateResponseSchema.meta({
  id: "MigrationStateResponse",
  description:
    "schema_migrations reconciliation state. Carries the reconciliation result, counts, pending versions, and the latest applied version/name only — never a connection string, host name, or checksum value (a checksum difference appears solely as the `checksum_mismatch` result). `pendingVersions` is present only where it was actually derived (`up_to_date`/`db_ahead` carry a measured empty list, `unapplied_required` the pending versions); a mismatch result stops the reconciliation part-way and omits the field, which is not the same as zero. The `available: false` branch is returned when no persistent store is configured.",
});

export const auditLogQueryOpenApiSchema = auditLogQuerySchema.meta({
  id: "AuditLogQuery",
  description: "Audit log view query parameters",
});

export const auditLogResponseOpenApiSchema = auditLogResponseSchema.meta({
  id: "AuditLogResponse",
  description:
    "Audit log display projection (who/when/what) with hash chain verification. IDs only; no PHI names.",
});

