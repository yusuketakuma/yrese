import type {
  FastifyPluginCallback,
  FastifyReply,
  onRequestHookHandler,
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

import { requirePermission } from "./plugins/tenant-context.js";
import type { PrescriptionDraftService } from "./prescription-draft-service.js";

export interface PrescriptionDraftRoutesOptions {
  readonly service: PrescriptionDraftService;
  readonly now?: () => Date;
}

const setSensitiveResponseNoStore: onRequestHookHandler = async (
  _request,
  reply,
) => {
  reply.header("Cache-Control", "no-store");
};

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

function snapshotWallClock(now: () => Date): string {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw new Error("Prescription draft clock read failed");
  }
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Prescription draft clock returned an invalid instant");
  }
  return value.toISOString();
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
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error(
          "tenantContext is unexpectedly missing after authorization",
        );
      }

      const params = prescriptionDraftParamsSchema.safeParse(request.params);
      const query = prescriptionDraftQuerySchema.safeParse(request.query);
      if (!params.success || !query.success) return invalidRequest(reply);

      const result = await options.service.get({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        receptionId: receptionId(params.data.receptionId),
        patientId: patientId(query.data.patientId),
        businessDate: query.data.date,
      });
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
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error(
          "tenantContext is unexpectedly missing after authorization",
        );
      }

      const params = prescriptionDraftParamsSchema.safeParse(request.params);
      const body = prescriptionDraftSaveRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) return invalidRequest(reply);

      const result = await options.service.save({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        actorId: tenantContext.actorId,
        receptionId: receptionId(params.data.receptionId),
        patientId: patientId(body.data.patientId),
        businessDate: body.data.businessDate,
        expectedVersion: body.data.expectedVersion,
        draft: body.data.draft,
        wallClock: snapshotWallClock(now),
      });

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
