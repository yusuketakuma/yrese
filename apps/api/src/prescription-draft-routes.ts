import type {
  FastifyPluginCallback,
  FastifyReply,
} from "fastify";
import fp from "fastify-plugin";

import {
  frameworkErrorResponseSchema,
  prescriptionDraftParamsSchema,
  prescriptionDraftQuerySchema,
  prescriptionDraftSaveRequestSchema,
} from "@yrese/contracts";
import {
  patientId,
  permissionScope,
  receptionId,
} from "@yrese/shared-kernel";

import {
  requirePermission,
  requireTenantContext,
} from "./plugins/tenant-context.js";
import type { PrescriptionDraftService } from "./prescription-draft-service.js";
import {
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from "./route-invariants.js";

export interface PrescriptionDraftRoutesOptions {
  readonly service: PrescriptionDraftService;
  readonly now?: () => Date;
}

export const prescriptionDraftRepositoryErrorMessage =
  "Prescription draft repository operation failed";

function fixedFailure(
  statusCode: 400 | 404 | 409,
  error: "Bad Request" | "Not Found" | "Conflict",
  message: string,
) {
  return frameworkErrorResponseSchema.parse({ statusCode, error, message });
}

function invalidRequest(reply: FastifyReply) {
  return reply
    .code(400)
    .send(
      fixedFailure(
        400,
        "Bad Request",
        "Invalid prescription draft request",
      ),
    );
}

function notFound(reply: FastifyReply) {
  return reply
    .code(404)
    .send(
      fixedFailure(
        404,
        "Not Found",
        "Prescription draft context not found",
      ),
    );
}

function conflict(reply: FastifyReply) {
  return reply
    .code(409)
    .send(
      fixedFailure(
        409,
        "Conflict",
        "Prescription draft version conflict",
      ),
    );
}

function snapshotPrescriptionDraftWallClock(now: () => Date): string {
  return snapshotWallClock(
    now,
    "Prescription draft clock read failed",
    "Prescription draft clock returned an invalid instant",
  );
}

async function callPrescriptionDraftService<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(prescriptionDraftRepositoryErrorMessage);
  }
}

function hasMatchingUpdatePrecondition(
  ifMatch: string | string[] | undefined,
  expectedVersion: number,
): boolean {
  return expectedVersion === 0
    ? ifMatch === undefined
    : ifMatch === `"${expectedVersion}"`;
}

const callback: FastifyPluginCallback<PrescriptionDraftRoutesOptions> = (
  server,
  options,
  done,
) => {
  const now = options.now ?? (() => new Date());

  server.get(
    "/prescription-drafts/by-reception/:receptionId",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("prescription", "read")),
        requirePermission(permissionScope("reception", "read")),
        requirePermission(permissionScope("patient", "read")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);

      const params = prescriptionDraftParamsSchema.safeParse(request.params);
      const query = prescriptionDraftQuerySchema.safeParse(request.query);
      if (!params.success || !query.success) return invalidRequest(reply);

      const result = await callPrescriptionDraftService(() =>
        options.service.get({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          receptionId: receptionId(params.data.receptionId),
          businessDate: query.data.date,
          wallClock: snapshotPrescriptionDraftWallClock(now),
        }),
      );
      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "empty") return reply.code(204).send();
      return reply.code(200).send(result.draft);
    },
  );

  server.put(
    "/prescription-drafts/by-reception/:receptionId",
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope("prescription", "write")),
        requirePermission(permissionScope("reception", "read")),
        requirePermission(permissionScope("patient", "read")),
      ],
    },
    async (request, reply) => {
      const tenantContext = requireTenantContext(request);

      const params = prescriptionDraftParamsSchema.safeParse(request.params);
      const body = prescriptionDraftSaveRequestSchema.safeParse(request.body);
      if (
        !params.success ||
        !body.success ||
        !hasMatchingUpdatePrecondition(
          request.headers["if-match"],
          body.data.expectedVersion,
        )
      ) {
        return invalidRequest(reply);
      }

      const result = await callPrescriptionDraftService(() =>
        options.service.save({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: tenantContext.actorId,
          receptionId: receptionId(params.data.receptionId),
          patientId: patientId(body.data.patientId),
          businessDate: body.data.businessDate,
          expectedVersion: body.data.expectedVersion,
          draft: body.data.draft,
          wallClock: snapshotPrescriptionDraftWallClock(now),
        }),
      );

      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "conflict") return conflict(reply);
      return reply
        .code(result.draft.saveDisposition === "created" ? 201 : 200)
        .send(result.draft);
    },
  );

  done();
};

export const prescriptionDraftRoutes = fp(callback, {
  name: "prescription-draft-routes",
});
