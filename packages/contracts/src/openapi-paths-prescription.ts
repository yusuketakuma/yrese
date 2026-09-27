import {
  domainErrorResponse,
  forbiddenErrorResponse,
  frameworkFailureResponse,
  internalErrorResponse,
  jsonContentType,
  noStoreHeaders,
  prescriptionAmendRequestOpenApiSchema,
  prescriptionAmendmentHeadersOpenApiSchema,
  prescriptionDraftFromPriorRequestOpenApiSchema,
  prescriptionDraftParamsOpenApiSchema,
  prescriptionDraftQueryOpenApiSchema,
  prescriptionDraftResponseOpenApiSchema,
  prescriptionDraftSaveRequestOpenApiSchema,
  prescriptionDraftSaveResponseOpenApiSchema,
  prescriptionDraftUpdateHeadersOpenApiSchema,
  prescriptionInquiryAnswerParamsOpenApiSchema,
  prescriptionInquiryAnswerRequestOpenApiSchema,
  prescriptionInquiryCreateRequestOpenApiSchema,
  prescriptionInquiryListResponseOpenApiSchema,
  prescriptionInquiryParamsOpenApiSchema,
  prescriptionInquiryViewOpenApiSchema,
  prescriptionLifecycleHeadersOpenApiSchema,
  prescriptionLifecycleParamsOpenApiSchema,
  prescriptionLifecycleViewOpenApiSchema,
  prescriptionVersionListResponseOpenApiSchema,
  prescriptionVersionParamsOpenApiSchema,
  prescriptionVersionViewOpenApiSchema,
} from "./openapi-schemas.js";

export const prescriptionPaths = {
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
    },};
