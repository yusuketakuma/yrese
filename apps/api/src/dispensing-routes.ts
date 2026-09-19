import type { FastifyPluginCallback, FastifyReply } from "fastify";
import fp from "fastify-plugin";

import {
  dispensingConfirmParamsSchema,
  dispensingConfirmRequestSchema,
  dispensingHeadersSchema,
  dispensingRecordCreateRequestSchema,
  errorResponseSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  DISPENSING_ALREADY_RECORDED_ERROR_CODE,
  DISPENSING_GENERIC_MISMATCH_ERROR_CODE,
  DISPENSING_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  DISPENSING_INQUIRY_UNRESOLVED_ERROR_CODE,
  DISPENSING_INVALID_REQUEST_ERROR_CODE,
  DISPENSING_INVALID_TRANSITION_ERROR_CODE,
  DISPENSING_NOT_FOUND_ERROR_CODE,
  dispensingId,
  permissionScope,
  prescriptionId,
} from "@yrese/shared-kernel";

import {
  requirePermission,
  requireTenantContext,
} from "./plugins/tenant-context.js";
import type { DispensingService } from "./dispensing-service.js";
import {
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from "./route-invariants.js";

/**
 * WP-7404 / API-021 / DOM-002 §5: 調剤記録の route。
 * create は dispensing:write、confirm は dispensing:confirm + SEC-010
 * ACTIVE PHARMACIST_LICENSE(service 側 fail-closed 判定、存在判定より先)。
 * error body は固定 template のみで PHI を含めない。
 */
export interface DispensingRoutesOptions {
  readonly service: DispensingService;
  readonly now?: () => Date;
}

export const dispensingRepositoryErrorMessage =
  "Dispensing repository operation failed";

const invalidDispensingRequestTemplate = errorResponseSchema.parse({
  errorCode: DISPENSING_INVALID_REQUEST_ERROR_CODE,
  message: "Invalid dispensing request",
});
function invalidDispensingRequest(reply: FastifyReply) {
  return reply.code(400).send({ ...invalidDispensingRequestTemplate });
}

const dispensingNotFoundTemplate = errorResponseSchema.parse({
  errorCode: DISPENSING_NOT_FOUND_ERROR_CODE,
  message: "Dispensing record not found",
});
function dispensingNotFound(reply: FastifyReply) {
  return reply.code(404).send({ ...dispensingNotFoundTemplate });
}

const forbiddenResponseTemplate = errorResponseSchema.parse({
  errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
  message: "Forbidden",
});
function forbidden(reply: FastifyReply) {
  return reply.code(403).send({ ...forbiddenResponseTemplate });
}

const dispensingIdempotencyConflictTemplate = errorResponseSchema.parse({
  errorCode: DISPENSING_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  message: "Idempotency-Key replay with a different payload",
});
function dispensingIdempotencyConflict(reply: FastifyReply) {
  return reply.code(409).send({ ...dispensingIdempotencyConflictTemplate });
}

function dispensingConflict(
  reply: FastifyReply,
  errorCode: string,
  message: string,
) {
  return reply.code(409).send(errorResponseSchema.parse({ errorCode, message }));
}

function snapshotDispensingWallClock(now: () => Date): string {
  return snapshotWallClock(
    now,
    "Dispensing clock read failed",
    "Dispensing clock returned an invalid instant",
  );
}

async function callDispensingService<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(dispensingRepositoryErrorMessage);
  }
}

const callback: FastifyPluginCallback<DispensingRoutesOptions> = (
  server,
  options,
  done,
) => {
  const now = options.now ?? (() => new Date());

  server.post(
    "/dispensings",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [requirePermission(permissionScope("dispensing", "write"))],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const headers = dispensingHeadersSchema.safeParse({
        "idempotency-key": request.headers["idempotency-key"],
      });
      const body = dispensingRecordCreateRequestSchema.safeParse(request.body);
      if (!headers.success || !body.success) {
        return invalidDispensingRequest(reply);
      }
      const result = await callDispensingService(() =>
        options.service.create({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          prescriptionId: prescriptionId(body.data.prescriptionId),
          prescriptionVersion: body.data.prescriptionVersion,
          dispensingDate: body.data.dispensingDate,
          items: body.data.items,
          idempotencyKey: headers.data["idempotency-key"],
          wallClock: snapshotDispensingWallClock(now),
        }),
      );
      switch (result.kind) {
        case "created":
          return reply
            .code(result.replayed ? 200 : 201)
            .send({ ...result.record, replayed: result.replayed });
        case "not_found":
          return dispensingNotFound(reply);
        case "inquiry_unresolved":
          return dispensingConflict(
            reply,
            DISPENSING_INQUIRY_UNRESOLVED_ERROR_CODE,
            "Prescription has unresolved inquiries",
          );
        case "already_recorded":
          return dispensingConflict(
            reply,
            DISPENSING_ALREADY_RECORDED_ERROR_CODE,
            "Dispensing record already exists for this prescription version",
          );
        case "invalid_items":
          return invalidDispensingRequest(reply);
        case "generic_mismatch":
          return dispensingConflict(
            reply,
            DISPENSING_GENERIC_MISMATCH_ERROR_CODE,
            "Dispensed medication is not compatible with the prescription",
          );
        case "idempotency_conflict":
          return dispensingIdempotencyConflict(reply);
      }
    },
  );

  server.post(
    "/dispensings/:dispensingId/confirm",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("dispensing", "confirm")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);
      const params = dispensingConfirmParamsSchema.safeParse(request.params);
      const headers = dispensingHeadersSchema.safeParse({
        "idempotency-key": request.headers["idempotency-key"],
      });
      const body = dispensingConfirmRequestSchema.safeParse(request.body ?? {});
      if (!params.success || !headers.success || !body.success) {
        return invalidDispensingRequest(reply);
      }
      const result = await callDispensingService(() =>
        options.service.confirm({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          dispensingId: dispensingId(params.data.dispensingId),
          idempotencyKey: headers.data["idempotency-key"],
          wallClock: snapshotDispensingWallClock(now),
        }),
      );
      switch (result.kind) {
        case "confirmed":
          return reply
            .code(200)
            .send({ ...result.record, replayed: result.replayed });
        case "not_found":
          return dispensingNotFound(reply);
        case "unqualified":
          return forbidden(reply);
        case "invalid_transition":
          return dispensingConflict(
            reply,
            DISPENSING_INVALID_TRANSITION_ERROR_CODE,
            "Dispensing record is already confirmed",
          );
        case "idempotency_conflict":
          return dispensingIdempotencyConflict(reply);
      }
    },
  );

  done();
};

export const dispensingRoutes = fp(callback, {
  name: "dispensing-routes",
});
