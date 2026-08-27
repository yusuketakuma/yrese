import type { FastifyPluginCallback, FastifyReply } from "fastify";
import fp from "fastify-plugin";

import {
  errorResponseSchema,
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryQuerySchema,
  receptionSummaryResponseSchema,
} from "@yrese/contracts";
import { CalendarDate } from "@yrese/date-time";
import {
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  permissionScope,
} from "@yrese/shared-kernel";

import type { OperationsReadService } from "./operations-service.js";
import { requirePermission } from "./plugins/tenant-context.js";

/**
 * BE-1: 運用状態の読み取りルート。
 *
 * - 新しい error code は作らない。403 は requirePermission が返す AUTH-0003、
 *   受付集計の不正な業務日は既存の RCV-0001 だけを使う。それ以外の失敗は定数
 *   invariant メッセージで throw し、Fastify に FrameworkErrorResponse 500 へ
 *   正規化させる(raw 例外・PHI を返さない)。
 * - 応答は件数・時刻・enum・スキーマ版数だけで PHI を含まないため、
 *   Cache-Control: no-store は付けない(PHI ルートとの区別を保つ)。
 */

export interface OperationsRoutesOptions {
  readonly service: OperationsReadService;
}

export const operationsOutboxSummaryReadErrorMessage =
  "Operations outbox summary read failed";
export const operationsReceptionSummaryReadErrorMessage =
  "Operations reception summary read failed";
export const operationsMigrationStateReadErrorMessage =
  "Operations migration state read failed";
export const operationsResponseInvariantErrorMessage =
  "Operations summary response is invalid";

function invalidReceptionSummaryRequest(reply: FastifyReply) {
  return reply.code(400).send(
    errorResponseSchema.parse({
      errorCode: RECEPTION_INVALID_REQUEST_ERROR_CODE,
      message: "Invalid reception request",
    }),
  );
}

async function readOperationsState<T>(
  operation: () => Promise<T>,
  invariantErrorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

const callback: FastifyPluginCallback<OperationsRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.get(
    "/operations/outbox-summary",
    {
      preHandler: [requirePermission(permissionScope("sync", "read"))],
    },
    async (request) => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error(
          "tenantContext is unexpectedly missing after authorization",
        );
      }

      const summary = await readOperationsState(
        () =>
          options.service.outboxSummary({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          }),
        operationsOutboxSummaryReadErrorMessage,
      );
      const parsed = outboxSummaryResponseSchema.safeParse(summary);
      if (!parsed.success) {
        throw new Error(operationsResponseInvariantErrorMessage);
      }
      return parsed.data;
    },
  );

  server.get(
    "/operations/reception-summary",
    {
      // patient:read は要求しない。応答は件数だけで患者を列挙しないため不要であり、
      // バッチ画面が患者スコープを取らずに済むことが本エンドポイントの主目的。
      preHandler: [requirePermission(permissionScope("reception", "read"))],
    },
    async (request, reply) => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error(
          "tenantContext is unexpectedly missing after authorization",
        );
      }

      const query = receptionSummaryQuerySchema.safeParse(request.query);
      if (!query.success) {
        return invalidReceptionSummaryRequest(reply);
      }
      try {
        CalendarDate.fromString(query.data.date);
      } catch {
        return invalidReceptionSummaryRequest(reply);
      }

      const summary = await readOperationsState(
        () =>
          options.service.receptionSummary({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
            date: query.data.date,
          }),
        operationsReceptionSummaryReadErrorMessage,
      );
      const parsed = receptionSummaryResponseSchema.safeParse(summary);
      if (!parsed.success) {
        throw new Error(operationsResponseInvariantErrorMessage);
      }
      return reply.code(200).send(parsed.data);
    },
  );

  server.get(
    "/operations/migration-state",
    {
      preHandler: [requirePermission(permissionScope("tenant", "admin"))],
    },
    async () => {
      const state = await readOperationsState(
        () => options.service.migrationState(),
        operationsMigrationStateReadErrorMessage,
      );
      const parsed = migrationStateResponseSchema.safeParse(state);
      if (!parsed.success) {
        throw new Error(operationsResponseInvariantErrorMessage);
      }
      return parsed.data;
    },
  );

  done();
};

export const operationsRoutes = fp(callback, {
  name: "operations-routes",
});
