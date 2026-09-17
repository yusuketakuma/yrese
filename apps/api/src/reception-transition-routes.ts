import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  errorResponseSchema,
  receptionTransitionParamsSchema,
  receptionTransitionRequestSchema,
  receptionTransitionResponseSchema,
  type ReceptionTransitionResponse,
} from '@yrese/contracts';
import {
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_INVALID_TRANSITION_ERROR_CODE,
  RECEPTION_NOT_FOUND_ERROR_CODE,
  RECEPTION_VERSION_CONFLICT_ERROR_CODE,
  permissionScope,
  receptionId,
  userId,
} from '@yrese/shared-kernel';

import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  isReceptionAuditAppendError,
  receptionTransitionAuditEventType,
  type ReceptionTransitionCommand,
  type ReceptionTransitionExecuteResult,
} from './reception-command.js';
import { invalidReceptionRequestResponse } from './reception-queue-routes.js';
import {
  assertRecordedAuditMatchesIntent,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from './route-invariants.js';

/**
 * WP-7201 / API-006 0.3.x: POST /reception/{receptionId}/transitions。
 * DOM-004 §2 の副状態機械を駆動する唯一の write 経路。
 *
 * - 認可は reception:write のみ(応答は PHI 非含有 — PatientSummary を返さない)。
 * - CAS: body.expectedVersion と If-Match "<n>" の一致を要求し、repository が
 *   単一書込み単位で version を単調増加させる。冪等収束は 409 + GET queue の
 *   version で行う(Idempotency-Key なし — API-013 update 規則)。
 * - 監査は応答の前に確定する(監査失敗は 500 で遷移を巻き戻す)。
 * - 遷移先→監査種別の写像: IN_PROGRESS→reception.started、
 *   COMPLETED→reception.completed、CANCELLED→reception.cancelled。
 * - CANCELLED は構造化理由コード businessReason 必須(MOD-008)、他遷移では拒否。
 */

export interface ReceptionTransitionRoutesOptions {
  readonly receptionTransitionCommand: ReceptionTransitionCommand;
  readonly now: () => Date;
}

export const receptionNotFoundErrorCode = RECEPTION_NOT_FOUND_ERROR_CODE;
export const receptionInvalidTransitionErrorCode =
  RECEPTION_INVALID_TRANSITION_ERROR_CODE;
export const receptionVersionConflictErrorCode =
  RECEPTION_VERSION_CONFLICT_ERROR_CODE;
export const receptionTransitionInvalidRequestErrorCode =
  RECEPTION_INVALID_REQUEST_ERROR_CODE;

export const receptionTransitionRepositoryErrorMessage =
  'Reception repository transition failed';
export const receptionTransitionResultKindInvariantErrorMessage =
  'Reception repository returned an invalid transition result kind';
export const receptionTransitionResultInvariantErrorMessage =
  'Reception repository returned an invalid transition result';
export const receptionTransitionSchemaInvariantErrorMessage =
  'Reception repository returned a transition result that fails the wire schema';
export const receptionTransitionClockReadErrorMessage =
  'Reception transition clock read failed';
export const receptionTransitionClockInvariantErrorMessage =
  'Reception transition clock returned an invalid instant';
export const receptionTransitionAuditInvariantErrorMessage =
  'Audit repository returned mismatched reception transition evidence';

const receptionNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionNotFoundErrorCode,
  message: 'Reception not found',
});

function receptionNotFoundResponse() {
  return { ...receptionNotFoundResponseTemplate };
}

const receptionInvalidTransitionResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionInvalidTransitionErrorCode,
  message: 'Reception status transition not allowed',
});

function receptionInvalidTransitionResponse() {
  return { ...receptionInvalidTransitionResponseTemplate };
}

const receptionVersionConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionVersionConflictErrorCode,
  message: 'Reception version conflict',
});

function receptionVersionConflictResponse() {
  return { ...receptionVersionConflictResponseTemplate };
}

type TransitionResultKind =
  | 'transitioned'
  | 'not_found'
  | 'transition_not_allowed'
  | 'version_conflict';

function readReceptionTransitionResultKind(value: unknown): TransitionResultKind {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    receptionTransitionResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'transitioned' &&
    kind !== 'not_found' &&
    kind !== 'transition_not_allowed' &&
    kind !== 'version_conflict'
  ) {
    throw new Error(receptionTransitionResultKindInvariantErrorMessage);
  }
  return kind;
}

const callback: FastifyPluginCallback<ReceptionTransitionRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.post(
    '/reception/:receptionId/transitions',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [requirePermission(permissionScope('reception', 'write'))],
    },
    async (request, reply): Promise<ReceptionTransitionResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = receptionTransitionParamsSchema.safeParse(request.params);
      const body = receptionTransitionRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      // CAS 前提条件: If-Match は引用符付き expectedVersion と完全一致
      // (API-006 §2.3)。欠落・非整数・不一致はすべて 400 RCV-0001。
      if (request.headers['if-match'] !== `"${body.data.expectedVersion}"`) {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      const statusChangedAtIso = snapshotWallClock(
        options.now,
        receptionTransitionClockReadErrorMessage,
        receptionTransitionClockInvariantErrorMessage,
      );

      let result: ReceptionTransitionExecuteResult;
      try {
        result = await options.receptionTransitionCommand.execute({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          receptionId: receptionId(params.data.receptionId),
          to: body.data.to,
          expectedVersion: body.data.expectedVersion,
          ...(body.data.businessReason === undefined
            ? {}
            : { businessReason: body.data.businessReason }),
          statusChangedAt: new Date(statusChangedAtIso),
          actorId: userId(tenantContext.actorId),
          auditWallClock: () => statusChangedAtIso,
        });
      } catch (error) {
        // WeakSet 恒等判定のみ(hostile な例外値を一切検査しない)。
        if (isReceptionAuditAppendError(error)) {
          throw new Error(receptionTransitionAuditInvariantErrorMessage);
        }
        throw new Error(receptionTransitionRepositoryErrorMessage);
      }

      const resultKind = readReceptionTransitionResultKind(result);
      if (resultKind === 'not_found') {
        return reply.code(404).send(receptionNotFoundResponse());
      }
      if (resultKind === 'transition_not_allowed') {
        return reply.code(409).send(receptionInvalidTransitionResponse());
      }
      if (resultKind === 'version_conflict') {
        return reply.code(409).send(receptionVersionConflictResponse());
      }

      // transitioned: 応答フィールドを own-property で検証してから wire schema へ。
      const transitionedResult = Object.freeze({
        receptionId: readRequiredOwnEnumerableDataProperty(
          result,
          'receptionId',
          receptionTransitionResultInvariantErrorMessage,
        ),
        receptionStatus: readRequiredOwnEnumerableDataProperty(
          result,
          'receptionStatus',
          receptionTransitionResultInvariantErrorMessage,
        ),
        version: readRequiredOwnEnumerableDataProperty(
          result,
          'version',
          receptionTransitionResultInvariantErrorMessage,
        ),
        statusChangedAt: readRequiredOwnEnumerableDataProperty(
          result,
          'statusChangedAt',
          receptionTransitionResultInvariantErrorMessage,
        ),
        undo: readRequiredOwnEnumerableDataProperty(
          result,
          'undo',
          receptionTransitionResultInvariantErrorMessage,
        ),
      });
      let parsedResponse: ReceptionTransitionResponse;
      try {
        parsedResponse = receptionTransitionResponseSchema.parse({
          receptionId: transitionedResult.receptionId,
          receptionStatus: transitionedResult.receptionStatus,
          version: transitionedResult.version,
          statusChangedAt: transitionedResult.statusChangedAt,
        });
      } catch {
        throw new Error(receptionTransitionSchemaInvariantErrorMessage);
      }
      if (
        parsedResponse.receptionId !== params.data.receptionId ||
        parsedResponse.receptionStatus !== body.data.to ||
        parsedResponse.version !== body.data.expectedVersion + 1 ||
        parsedResponse.statusChangedAt !== statusChangedAtIso
      ) {
        throw new Error(receptionTransitionResultInvariantErrorMessage);
      }

      // 監査証跡(who/when/what)。targetRef は識別子のみ(PHI 非含有)。
      // 監査失敗は遷移ごと巻き戻して 500(成功した遷移が監査なしで残らない)。
      const auditEventType = receptionTransitionAuditEventType(body.data.to);
      let recordedAudit: unknown;
      try {
        recordedAudit = await options.receptionTransitionCommand.ensureTransitionEvidence({
          result,
          provenance: {
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
            receptionId: receptionId(parsedResponse.receptionId),
          },
          auditEventType,
          ...(body.data.businessReason === undefined
            ? {}
            : { businessReason: { code: body.data.businessReason } }),
          actorId: userId(tenantContext.actorId),
          wallClock: statusChangedAtIso,
        });
      } catch {
        // 監査追記失敗: 遷移を巻き戻してから正規化 500。
        // 巻き戻し自体の失敗も同じ 500 に吸収する(状態は fail-visible)。
        try {
          await options.receptionTransitionCommand.rollbackTransitionEvidence(
            transitionedResult.undo,
          );
        } catch {
          // fall through to the normalized 500
        }
        throw new Error(receptionTransitionAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType,
          targetRef: Object.freeze({
            kind: 'reception',
            id: parsedResponse.receptionId,
          }),
          outcome: 'success',
          wallClock: statusChangedAtIso,
          ...(body.data.businessReason === undefined
            ? {}
            : { businessReasonCode: body.data.businessReason }),
        },
        receptionTransitionAuditInvariantErrorMessage,
      );

      return reply.code(200).send(parsedResponse);
    },
  );

  done();
};

export const receptionTransitionRoutes = fp(callback, {
  name: 'reception-transition-routes',
});
