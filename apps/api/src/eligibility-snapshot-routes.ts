import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  eligibilitySnapshotListResponseSchema,
  eligibilitySnapshotParamsSchema,
  eligibilitySnapshotRecordRequestSchema,
  eligibilitySnapshotRecordResponseSchema,
  eligibilitySnapshotSchema,
  errorResponseSchema,
  isManualEligibilityRecordAllowed,
  type EligibilitySnapshot as WireEligibilitySnapshot,
  type EligibilitySnapshotListResponse,
  type EligibilitySnapshotRecordResponse,
} from '@yrese/contracts';
import {
  INSURANCE_ELIGIBILITY_INVALID_REQUEST_ERROR_CODE,
  INSURANCE_ELIGIBILITY_RECEPTION_NOT_FOUND_ERROR_CODE,
  INSURANCE_ELIGIBILITY_SNAPSHOT_CONFLICT_ERROR_CODE,
  INSURANCE_ELIGIBILITY_TRANSITION_ERROR_CODE,
  isEligibilityMethodConsistent,
  permissionScope,
  receptionId,
  userId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import {
  eligibilityRecordAuditEventType,
  eligibilitySnapshotAggregateType,
  insuranceViewedAuditEventType,
  isEligibilityAuditAppendError,
  type EligibilityRecordCommand,
} from './eligibility-snapshot-command.js';
import {
  deriveEligibilityState,
  EligibilityMethodError,
  EligibilityReceptionNotFoundError,
  EligibilitySnapshotConflictError,
  EligibilityTransitionError,
  type EligibilitySnapshotRepository,
  type EligibilitySnapshotView,
} from './eligibility-snapshot-repository.js';
import {
  requirePermission,
  requireTenantContext,
} from './plugins/tenant-context.js';
import {
  assertRecordedAuditMatchesIntent,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from './route-invariants.js';

/**
 * WP-7204 / API-019 0.1.0: POST/GET /reception/{receptionId}/eligibility-snapshots。
 *
 * - 認可: POST = insurance:write + reception:read 併須、GET = insurance:read +
 *   reception:read 併須(API-019 §3)。tenant/pharmacy/actor は認証 context 由来。
 * - POST: method-state 不整合は 400 INS-0007、手動記録不可の組
 *   (VERIFIED_MYNA/MYNA_ONLINE、OFFLINE_PROVISIONAL/NONE、EXPIRED、MISMATCH)は
 *   422 INS-0010、ADP-004 §3 遷移表にない遷移も 422 INS-0010。冪等再送は 200、
 *   snapshot_id の別内容衝突は 409 INS-0009、受付不在(スコープ外含む)は
 *   404 INS-0008。
 * - 監査: recorded → eligibility.verified / eligibility.provisional_recorded
 *   (targetRef=eligibility_snapshot、payload は識別子+方式+状態のみ)。
 *   GET → insurance.viewed(targetRef=reception)。1 操作=1 監査、失敗は fail-closed。
 * - raw_response_ref・保険者番号等の資格内容は応答にも監査にも載せない。
 */

export const eligibilityInvalidRequestErrorCode =
  INSURANCE_ELIGIBILITY_INVALID_REQUEST_ERROR_CODE;
export const eligibilityReceptionNotFoundErrorCode =
  INSURANCE_ELIGIBILITY_RECEPTION_NOT_FOUND_ERROR_CODE;
export const eligibilitySnapshotConflictErrorCode =
  INSURANCE_ELIGIBILITY_SNAPSHOT_CONFLICT_ERROR_CODE;
export const eligibilityTransitionErrorCode =
  INSURANCE_ELIGIBILITY_TRANSITION_ERROR_CODE;

export const eligibilityRepositoryErrorMessage =
  'Eligibility repository failed';
export const eligibilityResultInvariantErrorMessage =
  'Eligibility repository returned an invalid record result';
export const eligibilitySchemaInvariantErrorMessage =
  'Eligibility repository returned a result that fails the wire schema';
export const eligibilityClockReadErrorMessage =
  'Eligibility clock read failed';
export const eligibilityClockInvariantErrorMessage =
  'Eligibility clock returned an invalid instant';
export const eligibilityAuditInvariantErrorMessage =
  'Audit repository returned mismatched eligibility evidence';
export const eligibilityViewAuditInvariantErrorMessage =
  'Audit repository returned mismatched insurance.viewed evidence';

const eligibilityInvalidRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: eligibilityInvalidRequestErrorCode,
  message: 'Invalid eligibility snapshot request',
});

function eligibilityInvalidRequestResponse() {
  return { ...eligibilityInvalidRequestResponseTemplate };
}

const eligibilityReceptionNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: eligibilityReceptionNotFoundErrorCode,
  message: 'Reception not found',
});

function eligibilityReceptionNotFoundResponse() {
  return { ...eligibilityReceptionNotFoundResponseTemplate };
}

const eligibilitySnapshotConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: eligibilitySnapshotConflictErrorCode,
  message: 'Eligibility snapshot conflict',
});

function eligibilitySnapshotConflictResponse() {
  return { ...eligibilitySnapshotConflictResponseTemplate };
}

const eligibilityTransitionResponseTemplate = errorResponseSchema.parse({
  errorCode: eligibilityTransitionErrorCode,
  message: 'Eligibility transition not allowed',
});

function eligibilityTransitionNotAllowedResponse() {
  return { ...eligibilityTransitionResponseTemplate };
}

export interface EligibilitySnapshotRoutesOptions {
  readonly eligibilityRecordCommand: EligibilityRecordCommand;
  readonly eligibilitySnapshotRepository: EligibilitySnapshotRepository;
  readonly auditRepository: AuditRepository;
  readonly now: () => Date;
}

const callback: FastifyPluginCallback<EligibilitySnapshotRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.post(
    '/reception/:receptionId/eligibility-snapshots',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('insurance', 'write')),
        requirePermission(permissionScope('reception', 'read')),
      ],
    },
    async (request, reply): Promise<EligibilitySnapshotRecordResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = eligibilitySnapshotParamsSchema.safeParse(request.params);
      const body = eligibilitySnapshotRecordRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send(eligibilityInvalidRequestResponse());
      }

      // method-state 不整合は 400(API-019 §5)、手動記録不可の組は 422。
      if (
        !isEligibilityMethodConsistent(
          body.data.verifiedMethod,
          body.data.state,
        )
      ) {
        return reply.code(400).send(eligibilityInvalidRequestResponse());
      }
      if (
        !isManualEligibilityRecordAllowed(
          body.data.verifiedMethod,
          body.data.state,
        )
      ) {
        return reply.code(422).send(eligibilityTransitionNotAllowedResponse());
      }

      const recordedAtIso = snapshotWallClock(
        options.now,
        eligibilityClockReadErrorMessage,
        eligibilityClockInvariantErrorMessage,
      );

      let result: unknown;
      try {
        result = await options.eligibilityRecordCommand.execute({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          receptionId: receptionId(params.data.receptionId),
          snapshotId: body.data.snapshotId,
          verifiedMethod: body.data.verifiedMethod,
          state: body.data.state,
          verifiedAt: new Date(body.data.verifiedAt),
          validFrom: body.data.validFrom,
          ...(body.data.validTo === undefined || body.data.validTo === null
            ? {}
            : { validTo: body.data.validTo }),
          ...(body.data.rawResponseRef === undefined
            ? {}
            : { rawResponseRef: body.data.rawResponseRef }),
          recordedBy: userId(tenantContext.actorId),
          now: new Date(recordedAtIso),
          asOfDate: body.data.asOfDate,
          auditWallClock: () => recordedAtIso,
        });
      } catch (error) {
        if (error instanceof EligibilityReceptionNotFoundError) {
          return reply.code(404).send(eligibilityReceptionNotFoundResponse());
        }
        if (error instanceof EligibilitySnapshotConflictError) {
          return reply.code(409).send(eligibilitySnapshotConflictResponse());
        }
        if (error instanceof EligibilityMethodError) {
          return reply.code(400).send(eligibilityInvalidRequestResponse());
        }
        if (error instanceof EligibilityTransitionError) {
          return reply.code(422).send(eligibilityTransitionNotAllowedResponse());
        }
        if (isEligibilityAuditAppendError(error)) {
          throw new Error(eligibilityAuditInvariantErrorMessage);
        }
        throw new Error(eligibilityRepositoryErrorMessage);
      }

      // 結果フィールドを own-property で検証してから wire schema へ。
      const kind = readRequiredOwnEnumerableDataProperty(
        result,
        'kind',
        eligibilityResultInvariantErrorMessage,
      );
      const snapshot = readRequiredOwnEnumerableDataProperty(
        result,
        'snapshot',
        eligibilityResultInvariantErrorMessage,
      );
      const undo = readRequiredOwnEnumerableDataProperty(
        result,
        'undo',
        eligibilityResultInvariantErrorMessage,
      );
      if (kind !== 'recorded' && kind !== 'existing') {
        throw new Error(eligibilityResultInvariantErrorMessage);
      }
      const snapshotReader = (
        property: string,
      ): unknown =>
        readRequiredOwnEnumerableDataProperty(
          snapshot,
          property,
          eligibilityResultInvariantErrorMessage,
        );

      let parsedSnapshot: WireEligibilitySnapshot;
      try {
        parsedSnapshot = eligibilitySnapshotSchema.parse({
          snapshotId: snapshotReader('snapshotId'),
          verifiedMethod: snapshotReader('verifiedMethod'),
          state: snapshotReader('state'),
          verifiedAt: snapshotReader('verifiedAt'),
          validFrom: snapshotReader('validFrom'),
          validTo: snapshotReader('validTo'),
        });
      } catch {
        throw new Error(eligibilitySchemaInvariantErrorMessage);
      }
      const derivedState = deriveEligibilityState(
        parsedSnapshot,
        body.data.asOfDate,
      );
      let parsedResponse: EligibilitySnapshotRecordResponse;
      try {
        parsedResponse = eligibilitySnapshotRecordResponseSchema.parse({
          ...parsedSnapshot,
          receptionId: params.data.receptionId,
          derivedState,
        });
      } catch {
        throw new Error(eligibilitySchemaInvariantErrorMessage);
      }

      if (kind === 'existing') {
        // 冪等再送: 監査は発火しない(1 新規記録 = 1 監査)。
        return reply.code(200).send(parsedResponse);
      }

      // recorded: 監査証跡を応答前に確定する。監査失敗は記録ごと巻き戻して 500。
      const auditEventType = eligibilityRecordAuditEventType(
        parsedResponse.state,
      );
      let recordedAudit: unknown;
      try {
        recordedAudit = await options.eligibilityRecordCommand.ensureRecordEvidence({
          result,
          provenance: {
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
            snapshotId: parsedResponse.snapshotId,
          },
          auditEventType,
          actorId: userId(tenantContext.actorId),
          wallClock: recordedAtIso,
        });
      } catch {
        // 監査追記失敗: 記録を巻き戻してから正規化 500(監査なしの durable
        // snapshot を残さない)。巻き戻し自体の失敗も同じ 500 に吸収する。
        try {
          await options.eligibilityRecordCommand.rollbackRecordEvidence(undo);
        } catch {
          // fall through to the normalized 500
        }
        throw new Error(eligibilityAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType,
          targetRef: Object.freeze({
            kind: eligibilitySnapshotAggregateType,
            id: parsedResponse.snapshotId,
          }),
          outcome: 'success',
          wallClock: recordedAtIso,
        },
        eligibilityAuditInvariantErrorMessage,
      );

      return reply.code(201).send(parsedResponse);
    },
  );

  server.get(
    '/reception/:receptionId/eligibility-snapshots',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('insurance', 'read')),
        requirePermission(permissionScope('reception', 'read')),
      ],
    },
    async (request, reply): Promise<EligibilitySnapshotListResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = eligibilitySnapshotParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send(eligibilityInvalidRequestResponse());
      }

      let view: EligibilitySnapshotView;
      try {
        view = await options.eligibilitySnapshotRepository.viewForReception(
          {
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          },
          params.data.receptionId,
        );
      } catch (error) {
        if (error instanceof EligibilityReceptionNotFoundError) {
          return reply.code(404).send(eligibilityReceptionNotFoundResponse());
        }
        throw new Error(eligibilityRepositoryErrorMessage);
      }

      const wallClock = snapshotWallClock(
        options.now,
        eligibilityClockReadErrorMessage,
        eligibilityClockInvariantErrorMessage,
      );

      // GET の read 監査(insurance.viewed)を応答前に確定する。失敗は 500。
      // payload は識別子+件数のみ(状態値・資格内容は載せない — API-019 §4)。
      let recordedAudit: unknown;
      try {
        recordedAudit = await options.auditRepository.record(
          Object.freeze({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          }),
          Object.freeze({
            actorId: userId(tenantContext.actorId),
            auditEventType: insuranceViewedAuditEventType,
            targetRef: Object.freeze({
              kind: 'reception',
              id: params.data.receptionId,
            }),
            outcome: 'success' as const,
            wallClock,
          }),
        );
      } catch {
        throw new Error(eligibilityViewAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType: insuranceViewedAuditEventType,
          targetRef: Object.freeze({
            kind: 'reception',
            id: params.data.receptionId,
          }),
          outcome: 'success',
          wallClock,
        },
        eligibilityViewAuditInvariantErrorMessage,
      );

      let parsedResponse: EligibilitySnapshotListResponse;
      try {
        parsedResponse = eligibilitySnapshotListResponseSchema.parse({
          receptionId: params.data.receptionId,
          current: {
            state: view.current.state,
            snapshotId: view.current.snapshotId,
            allowsProvisionalCalculation:
              view.current.allowsProvisionalCalculation,
            allowsFinalCalculation: view.current.allowsFinalCalculation,
          },
          snapshots: view.snapshots.map((snapshot) => ({
            snapshotId: snapshot.snapshotId,
            verifiedMethod: snapshot.verifiedMethod,
            state: snapshot.state,
            verifiedAt: snapshot.verifiedAt,
            validFrom: snapshot.validFrom,
            validTo: snapshot.validTo,
          })),
        });
      } catch {
        throw new Error(eligibilitySchemaInvariantErrorMessage);
      }

      return reply.code(200).send(parsedResponse);
    },
  );

  done();
};

export const eligibilitySnapshotRoutes = fp(callback, {
  name: 'eligibility-snapshot-routes',
});
