import type {
  FastifyPluginCallback,
  FastifyReply,
} from "fastify";
import fp from "fastify-plugin";

import {
  errorResponseSchema,
  prescriptionLifecycleHeadersSchema,
  prescriptionLifecycleParamsSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  permissionScope,
  PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE,
  PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE,
  PRESCRIPTION_LIFECYCLE_INVALID_REQUEST_ERROR_CODE,
  PRESCRIPTION_METADATA_INCOMPLETE_ERROR_CODE,
  PRESCRIPTION_NOT_FOUND_ERROR_CODE,
  PRESCRIPTION_RECEPTION_NOT_IN_PROGRESS_ERROR_CODE,
  prescriptionId,
} from "@yrese/shared-kernel";

import {
  requirePermission,
  requireTenantContext,
} from "./plugins/tenant-context.js";
import type {
  PrescriptionDraftService,
  PrescriptionLifecycleCommandInput,
  PrescriptionLifecycleCommandResult,
} from "./prescription-draft-service.js";
import {
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from "./route-invariants.js";

export interface PrescriptionLifecycleRoutesOptions {
  readonly service: PrescriptionDraftService;
  readonly now?: () => Date;
}

export const prescriptionLifecycleRepositoryErrorMessage =
  "Prescription lifecycle repository operation failed";

const invalidRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_LIFECYCLE_INVALID_REQUEST_ERROR_CODE,
  message: "Invalid prescription lifecycle request",
});
function invalidRequest(reply: FastifyReply) {
  return reply.code(400).send({ ...invalidRequestResponseTemplate });
}

const notFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: PRESCRIPTION_NOT_FOUND_ERROR_CODE,
  message: "Prescription not found",
});
function notFound(reply: FastifyReply) {
  return reply.code(404).send({ ...notFoundResponseTemplate });
}

const forbiddenResponseTemplate = errorResponseSchema.parse({
  errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
  message: "Forbidden",
});
function forbidden(reply: FastifyReply) {
  return reply.code(403).send({ ...forbiddenResponseTemplate });
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

function snapshotLifecycleWallClock(now: () => Date): string {
  return snapshotWallClock(
    now,
    "Prescription lifecycle clock read failed",
    "Prescription lifecycle clock returned an invalid instant",
  );
}

async function callLifecycleService<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(prescriptionLifecycleRepositoryErrorMessage);
  }
}

function sendLifecycleResult(
  reply: FastifyReply,
  result: PrescriptionLifecycleCommandResult,
) {
  switch (result.kind) {
    case "transitioned":
      return reply.code(200).send(result.view);
    case "not_found":
      return notFound(reply);
    case "unqualified":
      return forbidden(reply);
    case "invalid_transition":
      return conflict(
        reply,
        PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE,
        "Prescription lifecycle transition is not allowed",
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
    case "reception_not_in_progress":
      return conflict(
        reply,
        PRESCRIPTION_RECEPTION_NOT_IN_PROGRESS_ERROR_CODE,
        "Reception is not in progress",
      );
  }
}

const callback: FastifyPluginCallback<PrescriptionLifecycleRoutesOptions> = (
  server,
  options,
  done,
) => {
  const now = options.now ?? (() => new Date());

  const registerTransition = (
    path: string,
    command: (
      service: PrescriptionDraftService,
      input: PrescriptionLifecycleCommandInput,
    ) => Promise<PrescriptionLifecycleCommandResult>,
  ) => {
    server.post(
      path,
      {
        onRequest: setSensitiveResponseNoStore,
        preHandler: [
          requirePermission(permissionScope("prescription", "confirm")),
        ],
      },
      async (request, reply) => {
        const tenantContext = requireTenantContext(request);
        const params = prescriptionLifecycleParamsSchema.safeParse(
          request.params,
        );
        const headers = prescriptionLifecycleHeadersSchema.safeParse({
          "idempotency-key": request.headers["idempotency-key"],
        });
        if (!params.success || !headers.success) {
          return invalidRequest(reply);
        }
        const result = await callLifecycleService(() =>
          command(options.service, {
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
            actorId: tenantContext.actorId,
            prescriptionId: prescriptionId(params.data.prescriptionId),
            idempotencyKey: headers.data["idempotency-key"],
            wallClock: snapshotLifecycleWallClock(now),
          }),
        );
        return sendLifecycleResult(reply, result);
      },
    );
  };

  registerTransition(
    "/prescriptions/:prescriptionId/confirm",
    (service, input) => service.confirm(input),
  );
  registerTransition(
    "/prescriptions/:prescriptionId/finalize",
    (service, input) => service.finalize(input),
  );

  done();
};

export const prescriptionLifecycleRoutes = fp(callback, {
  name: "prescription-lifecycle-routes",
});
