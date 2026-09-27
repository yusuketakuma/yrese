import {
  domainErrorResponse,
  eligibilitySnapshotListResponseOpenApiSchema,
  eligibilitySnapshotParamsOpenApiSchema,
  eligibilitySnapshotRecordRequestOpenApiSchema,
  eligibilitySnapshotRecordResponseOpenApiSchema,
  forbiddenErrorResponse,
  internalErrorResponse,
  jsonContentType,
  noStoreHeaders,
  receptionCreateBadRequestOpenApiSchema,
  receptionCreateRequestOpenApiSchema,
  receptionQueueEntryOpenApiSchema,
  receptionQueueQueryOpenApiSchema,
  receptionQueueResponseOpenApiSchema,
  receptionTransitionHeadersOpenApiSchema,
  receptionTransitionParamsOpenApiSchema,
  receptionTransitionRequestOpenApiSchema,
  receptionTransitionResponseOpenApiSchema,
} from "./openapi-schemas.js";

export const receptionPaths = {
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
    },};
