import type {
  FastifyPluginCallback,
  FastifyReply,
} from "fastify";
import fp from "fastify-plugin";

import {
  errorResponseSchema,
  prescriptionAmendmentHeadersSchema,
  prescriptionAmendRequestSchema,
  prescriptionInquiryAnswerParamsSchema,
  prescriptionInquiryAnswerRequestSchema,
  prescriptionInquiryCreateRequestSchema,
  prescriptionInquiryParamsSchema,
  prescriptionVersionParamsSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  permissionScope,
  PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE,
  PRESCRIPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  PRESCRIPTION_INQUIRY_INVALID_REQUEST_ERROR_CODE,
  PRESCRIPTION_INQUIRY_NOT_FOUND_ERROR_CODE,
  PRESCRIPTION_INQUIRY_UNRESOLVED_ERROR_CODE,
  PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE,
  PRESCRIPTION_LIFECYCLE_INVALID_REQUEST_ERROR_CODE,
  PRESCRIPTION_METADATA_INCOMPLETE_ERROR_CODE,
  PRESCRIPTION_NOT_FOUND_ERROR_CODE,
  prescriptionId,
  prescriptionInquiryId,
} from "@yrese/shared-kernel";

import {
  requirePermission,
  requireTenantContext,
} from "./plugins/tenant-context.js";
import type {
  PrescriptionDraftService,
  PrescriptionScopedReadInput,
} from "./prescription-draft-service.js";
import {
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from "./route-invariants.js";

/**
 * WP-7403: 処方訂正(新版)と疑義照会記録の route。
 * DOM-002 §4/§5・DOM-004 §1・SEC-010・MOD-006(RX-0007〜0010)・MOD-008 に従う。
 * amend は確定済み臨床記録の変更のため prescription:confirm scope +
 * SEC-010 ACTIVE PHARMACIST_LICENSE(service 側 fail-closed 判定)を要求する。
 */
export interface PrescriptionAmendmentRoutesOptions {
  readonly service: PrescriptionDraftService;
  readonly now?: () => Date;
}

export const prescriptionAmendmentRepositoryErrorMessage =
  "Prescription amendment repository operation failed";

const invalidAmendRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_LIFECYCLE_INVALID_REQUEST_ERROR_CODE,
  message: "Invalid prescription amendment request",
});
function invalidAmendRequest(reply: FastifyReply) {
  return reply.code(400).send({ ...invalidAmendRequestResponseTemplate });
}

const invalidInquiryRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_INQUIRY_INVALID_REQUEST_ERROR_CODE,
  message: "Invalid prescription inquiry request",
});
function invalidInquiryRequest(reply: FastifyReply) {
  return reply.code(400).send({ ...invalidInquiryRequestResponseTemplate });
}

const notFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_NOT_FOUND_ERROR_CODE,
  message: "Prescription not found",
});
function notFound(reply: FastifyReply) {
  return reply.code(404).send({ ...notFoundResponseTemplate });
}

const inquiryNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_INQUIRY_NOT_FOUND_ERROR_CODE,
  message: "Prescription inquiry not found",
});
function inquiryNotFound(reply: FastifyReply) {
  return reply.code(404).send({ ...inquiryNotFoundResponseTemplate });
}

const forbiddenResponseTemplate = errorResponseSchema.parse({
  errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
  message: "Forbidden",
});
function forbidden(reply: FastifyReply) {
  return reply.code(403).send({ ...forbiddenResponseTemplate });
}

const idempotencyConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  message: "Idempotency-Key replay with a different payload",
});
function idempotencyConflict(reply: FastifyReply) {
  return reply.code(409).send({ ...idempotencyConflictResponseTemplate });
}

function conflict(
  reply: FastifyReply,
  errorCode: string,
  message: string,
) {
  return reply.code(409).send(
    errorResponseSchema.parse({ errorCode, message }),
  );
}

function snapshotAmendmentWallClock(now: () => Date): string {
  return snapshotWallClock(
    now,
    "Prescription amendment clock read failed",
    "Prescription amendment clock returned an invalid instant",
  );
}

async function callAmendmentService<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(prescriptionAmendmentRepositoryErrorMessage);
  }
}

const callback: FastifyPluginCallback<PrescriptionAmendmentRoutesOptions> = (
  server,
  options,
  done,
) => {
  const now = options.now ?? (() => new Date());
  const readInput = (
    tenantContext: {
      tenantId: PrescriptionScopedReadInput["tenantId"];
      pharmacyId: PrescriptionScopedReadInput["pharmacyId"];
      actorId: PrescriptionScopedReadInput["actorId"];
    },
    prescriptionIdValue: string,
  ): PrescriptionScopedReadInput => ({
    tenantId: tenantContext.tenantId,
    pharmacyId: tenantContext.pharmacyId,
    actorId: tenantContext.actorId,
    prescriptionId: prescriptionId(prescriptionIdValue),
    wallClock: snapshotAmendmentWallClock(now),
  });

  server.post(
    "/prescriptions/:prescriptionId/inquiries",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("prescription", "write")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionInquiryParamsSchema.safeParse(request.params);
      const headers = prescriptionAmendmentHeadersSchema.safeParse({
        "idempotency-key": request.headers["idempotency-key"],
      });
      const body = prescriptionInquiryCreateRequestSchema.safeParse(
        request.body,
      );
      if (!params.success || !headers.success || !body.success) {
        return invalidInquiryRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.createInquiry({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          prescriptionId: prescriptionId(params.data.prescriptionId),
          idempotencyKey: headers.data["idempotency-key"],
          wallClock: snapshotAmendmentWallClock(now),
          directedTo: body.data.directedTo,
          content: body.data.content,
        }),
      );
      switch (result.kind) {
        case "recorded":
          return reply.code(200).send(result.inquiry);
        case "not_found":
          return notFound(reply);
        case "idempotency_conflict":
          return idempotencyConflict(reply);
      }
    },
  );

  server.post(
    "/prescriptions/:prescriptionId/inquiries/:inquiryId/answer",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("prescription", "write")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionInquiryAnswerParamsSchema.safeParse(
        request.params,
      );
      const headers = prescriptionAmendmentHeadersSchema.safeParse({
        "idempotency-key": request.headers["idempotency-key"],
      });
      const body = prescriptionInquiryAnswerRequestSchema.safeParse(
        request.body,
      );
      if (!params.success || !headers.success || !body.success) {
        return invalidInquiryRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.answerInquiry({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          prescriptionId: prescriptionId(params.data.prescriptionId),
          inquiryId: prescriptionInquiryId(params.data.inquiryId),
          idempotencyKey: headers.data["idempotency-key"],
          wallClock: snapshotAmendmentWallClock(now),
          answer: body.data.answer,
          result: body.data.result,
        }),
      );
      switch (result.kind) {
        case "answered":
          return reply.code(200).send(result.inquiry);
        case "not_found":
          return notFound(reply);
        case "inquiry_not_found":
          return inquiryNotFound(reply);
        case "invalid_transition":
          return conflict(
            reply,
            PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE,
            "Prescription inquiry is already answered",
          );
        case "idempotency_conflict":
          return idempotencyConflict(reply);
      }
    },
  );

  server.post(
    "/prescriptions/:prescriptionId/amend",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("prescription", "confirm")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionInquiryParamsSchema.safeParse(request.params);
      const headers = prescriptionAmendmentHeadersSchema.safeParse({
        "idempotency-key": request.headers["idempotency-key"],
      });
      const body = prescriptionAmendRequestSchema.safeParse(request.body);
      if (!params.success || !headers.success || !body.success) {
        return invalidAmendRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.amend({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          prescriptionId: prescriptionId(params.data.prescriptionId),
          inquiryId: prescriptionInquiryId(body.data.inquiryId),
          idempotencyKey: headers.data["idempotency-key"],
          wallClock: snapshotAmendmentWallClock(now),
          content: body.data.content,
        }),
      );
      switch (result.kind) {
        case "amended":
          return reply.code(200).send(result.version);
        case "not_found":
          return notFound(reply);
        case "unqualified":
          return forbidden(reply);
        case "invalid_transition":
          return conflict(
            reply,
            PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE,
            "Prescription amendment is allowed only for a finalized prescription",
          );
        case "inquiry_unresolved":
          return reply.code(422).send(
            errorResponseSchema.parse({
              errorCode: PRESCRIPTION_INQUIRY_UNRESOLVED_ERROR_CODE,
              message:
                "Prescription amendment requires a resolved inquiry with result CHANGED",
            }),
          );
        case "unresolved_items":
          return conflict(
            reply,
            PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE,
            "Prescription contains unresolved medication items",
          );
        case "metadata_incomplete":
          return conflict(
            reply,
            PRESCRIPTION_METADATA_INCOMPLETE_ERROR_CODE,
            "Required source prescription metadata is incomplete",
          );
        case "idempotency_conflict":
          return idempotencyConflict(reply);
      }
    },
  );

  const readPreHandler = [
    requirePermission(permissionScope("prescription", "read")),
    requirePermission(permissionScope("reception", "read")),
    requirePermission(permissionScope("patient", "read")),
  ];

  server.get(
    "/prescriptions/:prescriptionId/versions",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: readPreHandler,
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionInquiryParamsSchema.safeParse(request.params);
      if (!params.success) {
        return invalidAmendRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.listVersions(
          readInput(tenantContext, params.data.prescriptionId),
        ),
      );
      switch (result.kind) {
        case "listed":
          return reply.code(200).send({ versions: result.versions });
        case "not_found":
          return notFound(reply);
      }
    },
  );

  server.get(
    "/prescriptions/:prescriptionId/versions/:version",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: readPreHandler,
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionVersionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return invalidAmendRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.getVersion({
          ...readInput(tenantContext, params.data.prescriptionId),
          version: params.data.version,
        }),
      );
      switch (result.kind) {
        case "found":
          return reply.code(200).send(result.version);
        case "not_found":
          return notFound(reply);
      }
    },
  );

  server.get(
    "/prescriptions/:prescriptionId/inquiries",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: readPreHandler,
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = prescriptionInquiryParamsSchema.safeParse(request.params);
      if (!params.success) {
        return invalidAmendRequest(reply);
      }
      const result = await callAmendmentService(() =>
        options.service.listInquiries(
          readInput(tenantContext, params.data.prescriptionId),
        ),
      );
      switch (result.kind) {
        case "listed":
          return reply.code(200).send({ inquiries: result.inquiries });
        case "not_found":
          return notFound(reply);
      }
    },
  );

  done();
};

export const prescriptionAmendmentRoutes = fp(callback, {
  name: "prescription-amendment-routes",
});
