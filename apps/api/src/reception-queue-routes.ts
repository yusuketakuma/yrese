import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  errorResponseSchema,
  receptionQueueEntrySchema,
  receptionQueueQuerySchema,
  receptionQueueResponseSchema,
  RECEPTION_QUEUE_MAX_ENTRIES,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
} from '@yrese/contracts';
import { CalendarDate } from '@yrese/date-time';
import {
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_QUEUE_BOUND_EXCEEDED_ERROR_CODE,
  permissionScope,
  userId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import {
  snapshotPatientSearchResult,
  snapshotPatientSearchResultIdentity,
} from './patient-routes.js';
import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  businessDateFromAcceptedAt,
  type ReceptionRepository,
} from './reception-repository.js';
import {
  assertRecordedAuditMatchesIntent,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotDenseArray,
  snapshotWallClock,
} from './route-invariants.js';

export interface ReceptionQueueRoutesOptions {
  readonly receptionRepository: ReceptionRepository;
  readonly auditRepository: AuditRepository;
  readonly now: () => Date;
}

export const receptionInvalidRequestErrorCode = RECEPTION_INVALID_REQUEST_ERROR_CODE;
export const receptionQueueDuplicateIdentityInvariantErrorMessage =
  'Reception repository returned duplicate reception identities';
export const receptionQueueBusinessDateInvariantErrorMessage =
  'Reception repository returned entries outside the requested business date';
export const receptionQueueRepositoryErrorMessage =
  'Reception repository queue lookup failed';
export const receptionQueueSchemaInvariantErrorMessage =
  'Reception repository returned invalid queue entries';
export const receptionQueueAuditInvariantErrorMessage =
  'Audit repository returned mismatched reception queue view evidence';
export const receptionQueueAuditClockReadErrorMessage =
  'Reception queue audit clock read failed';
export const receptionQueueAuditClockInvariantErrorMessage =
  'Reception queue audit clock returned an invalid instant';
// C-021(選択肢 b): cap 超過を schema invariant の 500 と区別する sentinel。
// snapshotDenseArray の maximum.errorMessage として渡し、route が同値比較で
// 503 + RCV-0007 へ写像する(PHI 非含有・監査非記録 — 結果を返却しないため)。
export const receptionQueueBoundExceededMessage =
  'Reception queue exceeds the servable bound';

export function snapshotReceptionEntryIdentity(
  value: unknown,
  invariantErrorMessage: string,
) {
  const receptionIdentity = readRequiredOwnEnumerableDataProperty(
    value,
    'receptionId',
    invariantErrorMessage,
  );
  const rawPatient = readRequiredOwnEnumerableDataProperty(
    value,
    'patient',
    invariantErrorMessage,
  );
  const patientIdentity = snapshotPatientSearchResultIdentity(
    rawPatient,
    invariantErrorMessage,
  );
  return Object.freeze({
    receptionId: receptionIdentity,
    rawPatient,
    patientId: patientIdentity,
  });
}

export function snapshotReceptionEntry(
  value: unknown,
  identity: ReturnType<typeof snapshotReceptionEntryIdentity>,
  invariantErrorMessage: string,
) {
  const patientSnapshot = snapshotPatientSearchResult(
    identity.rawPatient,
    identity.patientId,
    invariantErrorMessage,
  );

  return Object.freeze({
    receptionId: identity.receptionId,
    patient: patientSnapshot,
    acceptedAt: readRequiredOwnEnumerableDataProperty(
      value,
      'acceptedAt',
      invariantErrorMessage,
    ),
    receptionStatus: readRequiredOwnEnumerableDataProperty(
      value,
      'receptionStatus',
      invariantErrorMessage,
    ),
    prescriptionIntakeType: readRequiredOwnEnumerableDataProperty(
      value,
      'prescriptionIntakeType',
      invariantErrorMessage,
    ),
    version: readRequiredOwnEnumerableDataProperty(
      value,
      'version',
      invariantErrorMessage,
    ),
    eligibility: readRequiredOwnEnumerableDataProperty(
      value,
      'eligibility',
      invariantErrorMessage,
    ),
  });
}

export function parseReceptionEntrySnapshot(
  value: unknown,
  invariantErrorMessage: string,
): ReceptionQueueEntry {
  try {
    const parsed = receptionQueueEntrySchema.safeParse(value);
    if (!parsed.success) throw new Error(invariantErrorMessage);
    return parsed.data;
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

const invalidReceptionRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionInvalidRequestErrorCode,
  message: 'Invalid reception request',
});

export function invalidReceptionRequestResponse() {
  return { ...invalidReceptionRequestResponseTemplate };
}

const callback: FastifyPluginCallback<ReceptionQueueRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.get(
    '/reception/queue',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('reception', 'read')),
        requirePermission(permissionScope('patient', 'read')),
      ],
    },
    async (request, reply): Promise<ReceptionQueueResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const query = receptionQueueQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      try {
        CalendarDate.fromString(query.data.date);
      } catch {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      let entries: readonly ReceptionQueueEntry[];
      try {
        entries = await options.receptionRepository.list({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          date: query.data.date,
        });
      } catch {
        throw new Error(receptionQueueRepositoryErrorMessage);
      }

      let rawEntries: readonly unknown[];
      try {
        rawEntries = snapshotDenseArray(
          entries,
          receptionQueueSchemaInvariantErrorMessage,
          {
            length: RECEPTION_QUEUE_MAX_ENTRIES,
            errorMessage: receptionQueueBoundExceededMessage,
          },
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === receptionQueueBoundExceededMessage
        ) {
          return reply.code(503).send(
            errorResponseSchema.parse({
              errorCode: RECEPTION_QUEUE_BOUND_EXCEEDED_ERROR_CODE,
              message: receptionQueueBoundExceededMessage,
              nextAction:
                '当日受付件数が上限を超えています。件数が正常であれば運用手順に従ってシステム管理者へ連絡してください。',
            }),
          );
        }
        throw error;
      }
      const entrySnapshots = rawEntries.map((entry) => {
        const identity = snapshotReceptionEntryIdentity(
          entry,
          receptionQueueSchemaInvariantErrorMessage,
        );
        const snapshot = snapshotReceptionEntry(
          entry,
          identity,
          receptionQueueSchemaInvariantErrorMessage,
        );
        return parseReceptionEntrySnapshot(snapshot, receptionQueueSchemaInvariantErrorMessage);
      });
      let response: ReceptionQueueResponse;
      try {
        const parsedResponse = receptionQueueResponseSchema.safeParse({
          date: query.data.date,
          entries: entrySnapshots,
        });
        if (!parsedResponse.success) throw new Error(receptionQueueSchemaInvariantErrorMessage);
        response = parsedResponse.data;
      } catch {
        throw new Error(receptionQueueSchemaInvariantErrorMessage);
      }
      const receptionIds = new Set<string>();
      for (const entry of response.entries) {
        if (receptionIds.has(entry.receptionId)) {
          throw new Error(receptionQueueDuplicateIdentityInvariantErrorMessage);
        }
        receptionIds.add(entry.receptionId);
      }
      for (const entry of response.entries) {
        if (
          businessDateFromAcceptedAt(
            new Date(entry.acceptedAt),
            receptionQueueBusinessDateInvariantErrorMessage,
          ) !== query.data.date
        ) {
          throw new Error(receptionQueueBusinessDateInvariantErrorMessage);
        }
      }

      // WP-4162: 受付キュー閲覧は要配慮情報の列挙アクセス
      // (reception.queue.viewed — MOD-008 0.2.4)。payload は業務日付+件数のみ
      // (PHI 非含有)。0 件でも 1 件記録。記録失敗は 500 で PHI 非返却。
      const queueViewWallClock = snapshotWallClock(
        options.now,
        receptionQueueAuditClockReadErrorMessage,
        receptionQueueAuditClockInvariantErrorMessage,
      );
      const queueViewTarget = Object.freeze({
        kind: 'reception_queue',
        id: `${query.data.date}:results:${response.entries.length}`,
      });
      const queueViewIntent = Object.freeze({
        actorId: userId(tenantContext.actorId),
        auditEventType: 'reception.queue.viewed',
        targetRef: queueViewTarget,
        outcome: 'success',
        wallClock: queueViewWallClock,
      });
      let recordedQueueViewAudit: unknown;
      try {
        recordedQueueViewAudit = await options.auditRepository.record(
          Object.freeze({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          }),
          queueViewIntent,
        );
      } catch {
        throw new Error(receptionQueueAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedQueueViewAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          ...queueViewIntent,
        },
        receptionQueueAuditInvariantErrorMessage,
      );

      return response;
    },
  );

  done();
};

export const receptionQueueRoutes = fp(callback, {
  name: 'reception-queue-routes',
});
