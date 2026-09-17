import { randomUUID } from 'node:crypto';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  coverageListQuerySchema,
  coverageListResponseSchema,
  coverageParamsSchema,
  coverageRecordHeadersSchema,
  coverageRecordRequestSchema,
  coverageRecordResponseSchema,
  errorResponseSchema,
  insuranceCardSchema,
  publicExpenseSchema,
  type CoverageListResponse,
  type CoverageRecordResponse,
} from '@yrese/contracts';
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  COVERAGE_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  COVERAGE_INVALID_REQUEST_ERROR_CODE,
  COVERAGE_PATIENT_NOT_FOUND_ERROR_CODE,
  COVERAGE_PERIOD_OVERLAP_ERROR_CODE,
  COVERAGE_PRIORITY_CONFLICT_ERROR_CODE,
  COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE,
  patientId,
  permissionScope,
  userId,
  type PermissionScope,
} from '@yrese/shared-kernel';

import { insuranceViewedAuditEventType } from './eligibility-snapshot-command.js';
import {
  coverageCommandAggregateType,
  coverageRecordRequestFingerprint,
  coverageUpdatedAuditEventType,
  isCoverageAuditAppendError,
  type CoverageRecordCommand,
  type CoverageRecordCommandResult,
} from './coverage-command.js';
import type {
  CoverageEntryKind,
  CoverageRepository,
} from './coverage-repository.js';
import type { AuditRepository } from './audit-repository.js';
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
 * WP-7203 / API-020: GET/POST /patients/{patientId}/coverage。
 *
 * - GET: `insurance:read` + `patient:read` + `public-expense:read` 併須
 *   (insurance + public-expense 双方を含むため)。asOf 必須(MOD-011)。
 *   監査 `insurance.viewed`(targetRef=patient)を応答前に確定。
 * - POST: `patient:read` に加え kind 別 write scope(insurance-card→
 *   `insurance:write`、public-expense→`public-expense:write`、supersede は
 *   targetKind に対応)。Idempotency-Key 必須。監査 `insurance.updated`。
 * - 監査 payload は行 ID + kind のみ。保険者番号・記号番号・受給者番号は
 *   応答には含まれるが監査・ログ・エラーには出さない。
 */

export interface CoverageRoutesOptions {
  readonly coverageRepository: CoverageRepository;
  readonly coverageRecordCommand: CoverageRecordCommand;
  readonly auditRepository: AuditRepository;
  readonly now: () => Date;
}

export const coverageInvalidRequestErrorCode = COVERAGE_INVALID_REQUEST_ERROR_CODE;
export const coveragePatientNotFoundErrorCode = COVERAGE_PATIENT_NOT_FOUND_ERROR_CODE;
export const coveragePeriodOverlapErrorCode = COVERAGE_PERIOD_OVERLAP_ERROR_CODE;
export const coveragePriorityConflictErrorCode = COVERAGE_PRIORITY_CONFLICT_ERROR_CODE;
export const coverageSupersedeConflictErrorCode = COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE;
export const coverageIdempotencyConflictErrorCode = COVERAGE_IDEMPOTENCY_CONFLICT_ERROR_CODE;

export const coverageRepositoryErrorMessage =
  'Coverage repository operation failed';
export const coverageResultKindInvariantErrorMessage =
  'Coverage command returned an invalid result kind';
export const coverageResultSchemaInvariantErrorMessage =
  'Coverage command returned an invalid row snapshot';
export const coverageAuditInvariantErrorMessage =
  'Audit repository returned mismatched coverage evidence';
export const coverageViewAuditInvariantErrorMessage =
  'Audit repository returned mismatched insurance.viewed evidence';
export const coverageClockReadErrorMessage = 'Coverage clock read failed';
export const coverageClockInvariantErrorMessage =
  'Coverage clock returned an invalid instant';

const invalidCoverageRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: coverageInvalidRequestErrorCode,
  message: 'Invalid coverage request',
});
function invalidCoverageRequestResponse() {
  return { ...invalidCoverageRequestResponseTemplate };
}

const coverageNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: coveragePatientNotFoundErrorCode,
  message: 'Patient not found',
});
function coverageNotFoundResponse() {
  return { ...coverageNotFoundResponseTemplate };
}

const coveragePeriodOverlapResponseTemplate = errorResponseSchema.parse({
  errorCode: coveragePeriodOverlapErrorCode,
  message: 'Insurance card period overlap',
});
function coveragePeriodOverlapResponse() {
  return { ...coveragePeriodOverlapResponseTemplate };
}

const coveragePriorityConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: coveragePriorityConflictErrorCode,
  message: 'Public expense priority conflict',
});
function coveragePriorityConflictResponse() {
  return { ...coveragePriorityConflictResponseTemplate };
}

const coverageSupersedeConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: coverageSupersedeConflictErrorCode,
  message: 'Coverage supersede target invalid',
});
function coverageSupersedeConflictResponse() {
  return { ...coverageSupersedeConflictResponseTemplate };
}

const coverageIdempotencyConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: coverageIdempotencyConflictErrorCode,
  message: 'Coverage idempotency conflict',
});
function coverageIdempotencyConflictResponse() {
  return { ...coverageIdempotencyConflictResponseTemplate };
}

const coverageAuthorizationErrorResponse = errorResponseSchema.parse({
  errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
  message: 'Forbidden',
});
function coverageAuthorizationResponse() {
  return { ...coverageAuthorizationErrorResponse };
}

/** kind 別の write scope(API-020 §3)。 */
function requiredWriteScope(
  request: { readonly kind: string; readonly targetKind?: string },
): PermissionScope {
  const resource =
    request.kind === 'supersede'
      ? request.targetKind === 'public-expense'
        ? 'public-expense'
        : 'insurance'
      : request.kind === 'public-expense'
        ? 'public-expense'
        : 'insurance';
  return permissionScope(resource, 'write');
}

function readRecordResultKind(
  value: unknown,
): CoverageRecordCommandResult['kind'] {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    coverageResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'recorded' &&
    kind !== 'existing' &&
    kind !== 'idempotency_conflict' &&
    kind !== 'patient_not_found' &&
    kind !== 'period_overlap' &&
    kind !== 'priority_conflict' &&
    kind !== 'supersede_conflict'
  ) {
    throw new Error(coverageResultKindInvariantErrorMessage);
  }
  return kind;
}

function parseCoverageRow(
  entryKind: CoverageEntryKind,
  value: unknown,
): { readonly row: unknown; readonly rowId: string } {
  const schema =
    entryKind === 'insurance-card' ? insuranceCardSchema : publicExpenseSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(coverageResultSchemaInvariantErrorMessage);
  }
  return {
    row: parsed.data,
    rowId:
      entryKind === 'insurance-card'
        ? (parsed.data as { insuranceCardId: string }).insuranceCardId
        : (parsed.data as { publicExpenseId: string }).publicExpenseId,
  };
}

function recordResponseBody(row: unknown): CoverageRecordResponse {
  // API-020 §2: 応答は登録された行そのもの(envelope なし)。
  const parsed = coverageRecordResponseSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(coverageResultSchemaInvariantErrorMessage);
  }
  return parsed.data;
}

const callback: FastifyPluginCallback<CoverageRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.get(
    '/patients/:patientId/coverage',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('patient', 'read')),
        requirePermission(permissionScope('insurance', 'read')),
        requirePermission(permissionScope('public-expense', 'read')),
      ],
    },
    async (request, reply): Promise<CoverageListResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = coverageParamsSchema.safeParse(request.params);
      const query = coverageListQuerySchema.safeParse(request.query);
      if (!params.success || !query.success) {
        return reply.code(400).send(invalidCoverageRequestResponse());
      }

      let view;
      try {
        view = await options.coverageRepository.viewForPatient({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: patientId(params.data.patientId),
          asOf: query.data.asOf,
        });
      } catch {
        throw new Error(coverageRepositoryErrorMessage);
      }

      const viewKind = readRequiredOwnEnumerableDataProperty(
        view,
        'kind',
        coverageResultKindInvariantErrorMessage,
      );
      if (viewKind === 'patient_not_found') {
        return reply.code(404).send(coverageNotFoundResponse());
      }
      if (viewKind !== 'listed') {
        throw new Error(coverageResultKindInvariantErrorMessage);
      }

      const wallClock = snapshotWallClock(
        options.now,
        coverageClockReadErrorMessage,
        coverageClockInvariantErrorMessage,
      );

      // GET の read 監査(insurance.viewed)を応答前に確定する。失敗は 500。
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
              kind: 'patient',
              id: params.data.patientId,
            }),
            outcome: 'success' as const,
            wallClock,
          }),
        );
      } catch {
        throw new Error(coverageViewAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType: insuranceViewedAuditEventType,
          targetRef: Object.freeze({
            kind: 'patient',
            id: params.data.patientId,
          }),
          outcome: 'success',
          wallClock,
        },
        coverageViewAuditInvariantErrorMessage,
      );

      const rawCards = readRequiredOwnEnumerableDataProperty(
        view,
        'insuranceCards',
        coverageResultSchemaInvariantErrorMessage,
      );
      const rawExpenses = readRequiredOwnEnumerableDataProperty(
        view,
        'publicExpenses',
        coverageResultSchemaInvariantErrorMessage,
      );
      const parsedResponse = coverageListResponseSchema.safeParse({
        patientId: params.data.patientId,
        asOf: query.data.asOf,
        insuranceCards: rawCards,
        publicExpenses: rawExpenses,
      });
      if (!parsedResponse.success) {
        throw new Error(coverageResultSchemaInvariantErrorMessage);
      }
      return reply.code(200).send(parsedResponse.data);
    },
  );

  server.post(
    '/patients/:patientId/coverage',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [requirePermission(permissionScope('patient', 'read'))],
    },
    async (request, reply): Promise<CoverageRecordResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = coverageParamsSchema.safeParse(request.params);
      const body = coverageRecordRequestSchema.safeParse(request.body);
      const idempotencyKey = coverageRecordHeadersSchema.safeParse({
        'idempotency-key': request.headers['idempotency-key'],
      });
      if (!params.success || !body.success || !idempotencyKey.success) {
        return reply.code(400).send(invalidCoverageRequestResponse());
      }

      // kind 別 write scope(ボディ判別が必要なため handler 内で検査)。
      if (!tenantContext.scopes.includes(requiredWriteScope(body.data))) {
        return reply.code(403).send(coverageAuthorizationResponse());
      }

      const recordedAtIso = snapshotWallClock(
        options.now,
        coverageClockReadErrorMessage,
        coverageClockInvariantErrorMessage,
      );
      const entryKind: CoverageEntryKind =
        body.data.kind === 'supersede' ? body.data.targetKind : body.data.kind;

      let result: CoverageRecordCommandResult;
      try {
        result = await options.coverageRecordCommand.recordCoverage({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: patientId(params.data.patientId),
          request: body.data,
          idempotencyKey: idempotencyKey.data['idempotency-key'],
          requestFingerprint: coverageRecordRequestFingerprint(body.data),
          actorId: userId(tenantContext.actorId),
          recordedAt: recordedAtIso,
          auditWallClock: () => recordedAtIso,
          mintRowId: () => `${entryKind}-${randomUUID()}`,
        });
      } catch (error) {
        if (isCoverageAuditAppendError(error)) {
          throw new Error(coverageAuditInvariantErrorMessage);
        }
        throw new Error(coverageRepositoryErrorMessage);
      }

      const resultKind = readRecordResultKind(result);
      if (resultKind === 'idempotency_conflict') {
        return reply.code(409).send(coverageIdempotencyConflictResponse());
      }
      if (resultKind === 'patient_not_found') {
        return reply.code(404).send(coverageNotFoundResponse());
      }
      if (resultKind === 'period_overlap') {
        return reply.code(409).send(coveragePeriodOverlapResponse());
      }
      if (resultKind === 'priority_conflict') {
        return reply.code(409).send(coveragePriorityConflictResponse());
      }
      if (resultKind === 'supersede_conflict') {
        return reply.code(409).send(coverageSupersedeConflictResponse());
      }

      const resultEntryKind = readRequiredOwnEnumerableDataProperty(
        result,
        'entryKind',
        coverageResultKindInvariantErrorMessage,
      );
      if (resultEntryKind !== entryKind) {
        throw new Error(coverageResultKindInvariantErrorMessage);
      }
      const rawRow = readRequiredOwnEnumerableDataProperty(
        result,
        'row',
        coverageResultSchemaInvariantErrorMessage,
      );
      const { row, rowId } = parseCoverageRow(entryKind, rawRow);

      if (resultKind === 'existing') {
        return reply.code(200).send(recordResponseBody(row));
      }

      // 監査証跡の意図一致検証(1 操作 = 1 insurance.updated)。
      const recordedAudit = readRequiredOwnEnumerableDataProperty(
        result,
        'auditEvent',
        coverageAuditInvariantErrorMessage,
      );
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType: coverageUpdatedAuditEventType,
          targetRef: Object.freeze({
            kind: coverageCommandAggregateType,
            id: `${entryKind}:${rowId}`,
          }),
          outcome: 'success',
          wallClock: recordedAtIso,
        },
        coverageAuditInvariantErrorMessage,
      );

      return reply.code(201).send(recordResponseBody(row));
    },
  );

  done();
};

export const coverageRoutes = fp(callback, {
  name: 'coverage-routes',
});
