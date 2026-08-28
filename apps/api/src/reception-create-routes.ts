import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  errorResponseSchema,
  type PatientSearchResult,
  receptionCreateRequestSchema,
  type ReceptionQueueEntry,
} from '@yrese/contracts';
import {
  RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE,
  patientId,
  permissionScope,
  receptionId,
  userId,
} from '@yrese/shared-kernel';

import {
  parsePatientSearchResultSnapshot,
  patientLookupRepositoryErrorMessage,
  receptionPatientIdentityMismatchErrorMessage,
  receptionPatientSchemaInvariantErrorMessage,
  snapshotPatientSearchResult,
  snapshotPatientSearchResultIdentity,
} from './patient-routes.js';
import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  isReceptionAuditAppendError,
  isReceptionOutboxAppendError,
  type ReceptionCreateCommand,
  type ReceptionCreateExecuteResult,
  type ReceptionExistingClassification,
} from './reception-command.js';
import type { PatientRepository } from './patient-repository.js';
import type { ReceptionCreateProvenance } from './reception-repository.js';
import {
  invalidReceptionRequestResponse,
  parseReceptionEntrySnapshot,
  snapshotReceptionEntry,
  snapshotReceptionEntryIdentity,
} from './reception-queue-routes.js';
import {
  assertRecordedAuditMatchesIntent,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotWallClock,
} from './route-invariants.js';

export interface ReceptionCreateRoutesOptions {
  readonly patientRepository: PatientRepository;
  readonly receptionCreateCommand: ReceptionCreateCommand;
  readonly now: () => Date;
}

export const receptionPatientNotFoundErrorCode = RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
export const receptionIdempotencyConflictErrorCode = RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;
export const receptionReconciliationHeaderName = 'x-yrese-reconciliation';
export const receptionResultPatientIdentityMismatchErrorMessage =
  'Reception repository returned a mismatched patient identity';
export const receptionCreatedPatientSnapshotMismatchErrorMessage =
  'Created reception did not preserve the validated patient snapshot';
export const receptionResultIdempotencyProvenanceMismatchErrorMessage =
  'Reception repository returned mismatched idempotency provenance';
export const receptionResultKindInvariantErrorMessage =
  'Reception repository returned an invalid result kind';
export const receptionResultSchemaInvariantErrorMessage =
  'Reception repository returned an invalid reception entry';
export const receptionCreatedStatusInvariantErrorMessage =
  'Created reception did not start in WAITING status';
export const receptionCreatedAcceptedAtInvariantErrorMessage =
  'Created reception did not preserve the server-issued acceptance time';
export const receptionAcceptedAtClockReadErrorMessage =
  'Reception acceptance clock read failed';
export const receptionAcceptedAtClockInvariantErrorMessage =
  'Reception acceptance clock returned an invalid instant';
export const receptionCreatedAuditInvariantErrorMessage =
  'Audit repository returned mismatched reception creation evidence';
export const receptionCreateRepositoryErrorMessage = 'Reception repository create failed';
export const receptionCreatedOutboxInvariantErrorMessage =
  'Reception outbox intent could not be recorded';

function readReceptionCreateResultKind(
  value: unknown,
): 'created' | 'existing' | 'existing_complete' | 'legacy_orphan' | 'idempotency_conflict' {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    receptionResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'created' &&
    kind !== 'existing' &&
    kind !== 'existing_complete' &&
    kind !== 'legacy_orphan' &&
    kind !== 'idempotency_conflict'
  ) {
    throw new Error(receptionResultKindInvariantErrorMessage);
  }
  return kind;
}

function snapshotReceptionCreateProvenance(value: unknown) {
  return Object.freeze({
    tenantId: readRequiredOwnEnumerableDataProperty(
      value,
      'tenantId',
      receptionResultIdempotencyProvenanceMismatchErrorMessage,
    ),
    pharmacyId: readRequiredOwnEnumerableDataProperty(
      value,
      'pharmacyId',
      receptionResultIdempotencyProvenanceMismatchErrorMessage,
    ),
    idempotencyKey: readRequiredOwnEnumerableDataProperty(
      value,
      'idempotencyKey',
      receptionResultIdempotencyProvenanceMismatchErrorMessage,
    ),
    receptionId: readRequiredOwnEnumerableDataProperty(
      value,
      'receptionId',
      receptionResultIdempotencyProvenanceMismatchErrorMessage,
    ),
    patientId: readRequiredOwnEnumerableDataProperty(
      value,
      'patientId',
      receptionResultIdempotencyProvenanceMismatchErrorMessage,
    ),
  });
}

function cloneFrozenPatientSearchResult(value: PatientSearchResult): PatientSearchResult {
  const eligibilityCheckedAtPresent = Object.hasOwn(value, 'eligibilityCheckedAt');
  return Object.freeze({
    patientId: value.patientId,
    name: value.name,
    kana: value.kana,
    birthDate: value.birthDate,
    sex: value.sex,
    patientNumber: value.patientNumber,
    eligibilityStatus: value.eligibilityStatus,
    ...(eligibilityCheckedAtPresent
      ? { eligibilityCheckedAt: value.eligibilityCheckedAt }
      : {}),
  });
}

function patientSnapshotsMatch(
  left: PatientSearchResult,
  right: PatientSearchResult,
): boolean {
  return (
    left.patientId === right.patientId &&
    left.name === right.name &&
    left.kana === right.kana &&
    left.birthDate === right.birthDate &&
    left.sex === right.sex &&
    left.patientNumber === right.patientNumber &&
    left.eligibilityStatus === right.eligibilityStatus &&
    Object.hasOwn(left, 'eligibilityCheckedAt') ===
      Object.hasOwn(right, 'eligibilityCheckedAt') &&
    left.eligibilityCheckedAt === right.eligibilityCheckedAt
  );
}

const receptionPatientNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionPatientNotFoundErrorCode,
  message: 'Patient not found for reception',
});

function receptionPatientNotFoundResponse() {
  return { ...receptionPatientNotFoundResponseTemplate };
}

const receptionIdempotencyConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: receptionIdempotencyConflictErrorCode,
  message: 'Reception idempotency conflict',
});

function receptionIdempotencyConflictResponse() {
  return { ...receptionIdempotencyConflictResponseTemplate };
}

const callback: FastifyPluginCallback<ReceptionCreateRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.post(
    '/reception',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('reception', 'write')),
        requirePermission(permissionScope('patient', 'read')),
      ],
    },
    async (request, reply): Promise<ReceptionQueueEntry | void> => {
      const tenantContext = requireTenantContext(request);

      const body = receptionCreateRequestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      const parsedPatientId = patientId(body.data.patientId);
      let patient: PatientSearchResult | undefined;
      try {
        patient = await options.patientRepository.findById({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: parsedPatientId,
        });
      } catch {
        throw new Error(patientLookupRepositoryErrorMessage);
      }
      if (patient === undefined) {
        return reply.code(404).send(receptionPatientNotFoundResponse());
      }
      const patientIdentity = snapshotPatientSearchResultIdentity(
        patient,
        receptionPatientIdentityMismatchErrorMessage,
      );
      if (patientIdentity !== parsedPatientId) {
        throw new Error(receptionPatientIdentityMismatchErrorMessage);
      }
      const patientSnapshot = snapshotPatientSearchResult(
        patient,
        patientIdentity,
        receptionPatientSchemaInvariantErrorMessage,
      );
      const parsedPatient = parsePatientSearchResultSnapshot(
        patientSnapshot,
        receptionPatientSchemaInvariantErrorMessage,
      );
      const expectedCreatedPatient = cloneFrozenPatientSearchResult(parsedPatient);
      const repositoryPatient = cloneFrozenPatientSearchResult(parsedPatient);

      const acceptedAtIso = snapshotWallClock(
        options.now,
        receptionAcceptedAtClockReadErrorMessage,
        receptionAcceptedAtClockInvariantErrorMessage,
      );
      const acceptedAt = new Date(acceptedAtIso);
      // WP-4050: 受付・監査・outbox は1つのコマンド境界(unit of work)で書く。
      // 監査/outbox の追記失敗は受付ごと巻き戻る(受付だけが durable に残らない)。
      // 時計は created 経路でだけ1回読む(existing / conflict では読まない)。
      let auditWallClockUsed: string | undefined;
      let result: ReceptionCreateExecuteResult;
      try {
        result = await options.receptionCreateCommand.execute({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patient: repositoryPatient,
          idempotencyKey: body.data.idempotencyKey,
          acceptedAt,
          actorId: userId(tenantContext.actorId),
          auditWallClock: () => {
            const wallClock = options.now().toISOString();
            auditWallClockUsed = wallClock;
            return wallClock;
          },
        });
      } catch (error) {
        // WeakSet 恒等判定のみ(hostile な例外値を一切検査しない)。
        if (isReceptionAuditAppendError(error)) {
          throw new Error(receptionCreatedAuditInvariantErrorMessage);
        }
        if (isReceptionOutboxAppendError(error)) {
          throw new Error(receptionCreatedOutboxInvariantErrorMessage);
        }
        throw new Error(receptionCreateRepositoryErrorMessage);
      }
      const resultKind = readReceptionCreateResultKind(result);

      const rawProvenance = readRequiredOwnEnumerableDataProperty(
        result,
        'provenance',
        receptionResultIdempotencyProvenanceMismatchErrorMessage,
      );
      const provenance = snapshotReceptionCreateProvenance(rawProvenance);
      if (
        provenance?.tenantId !== tenantContext.tenantId ||
        provenance.pharmacyId !== tenantContext.pharmacyId ||
        provenance.idempotencyKey !== body.data.idempotencyKey ||
        typeof provenance.receptionId !== 'string' ||
        typeof provenance.patientId !== 'string'
      ) {
        throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
      }
      try {
        receptionId(provenance.receptionId);
        patientId(provenance.patientId);
      } catch {
        throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
      }

      if (resultKind === 'idempotency_conflict') {
        if (provenance.patientId === parsedPatientId) {
          throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
        }
        return reply.code(409).send(receptionIdempotencyConflictResponse());
      }
      const rawEntryValue = readRequiredOwnEnumerableDataProperty(
        result,
        'entry',
        receptionResultIdempotencyProvenanceMismatchErrorMessage,
      );
      const entryIdentity = snapshotReceptionEntryIdentity(
        rawEntryValue,
        receptionResultIdempotencyProvenanceMismatchErrorMessage,
      );
      if (
        provenance.receptionId !== entryIdentity.receptionId ||
        provenance.patientId !== entryIdentity.patientId
      ) {
        throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
      }
      const entrySnapshot = snapshotReceptionEntry(
        rawEntryValue,
        entryIdentity,
        receptionResultSchemaInvariantErrorMessage,
      );
      const parsedEntry = parseReceptionEntrySnapshot(
        entrySnapshot,
        receptionResultSchemaInvariantErrorMessage,
      );
      if (parsedEntry.patient.patientId !== parsedPatientId) {
        throw new Error(receptionResultPatientIdentityMismatchErrorMessage);
      }
      if (
        resultKind === 'created' &&
        !patientSnapshotsMatch(parsedEntry.patient, expectedCreatedPatient)
      ) {
        throw new Error(receptionCreatedPatientSnapshotMismatchErrorMessage);
      }
      if (resultKind === 'created' && parsedEntry.receptionStatus !== 'WAITING') {
        throw new Error(receptionCreatedStatusInvariantErrorMessage);
      }
      if (resultKind === 'created' && parsedEntry.acceptedAt !== acceptedAtIso) {
        throw new Error(receptionCreatedAcceptedAtInvariantErrorMessage);
      }

      // 全フィールド検証済みのソースからだけ typed provenance を組み立てる
      // (snapshot の静的型は unknown のままにし、hostile 入力を型で信用しない)。
      const validatedProvenance: ReceptionCreateProvenance = {
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        idempotencyKey: body.data.idempotencyKey,
        receptionId: receptionId(parsedEntry.receptionId),
        patientId: patientId(parsedEntry.patient.patientId),
      };

      // 素通し 'existing' 結果(in-memory 経路)は、検証済み provenance を使って
      // outbox intent の有無で existing_complete / legacy_orphan へ分類する。
      // legacy_orphan は照合証跡であり、元の actor / 時刻を捏造する修復はしない
      // (wire 応答は既存契約どおり 200 のまま)。
      // 分類結果は応答 header で照合証跡として表面化する(WP-4050 HIGH-1)。
      // 値は固定語のみで PHI を含まない。
      let reconciliation: ReceptionExistingClassification | undefined;
      if (resultKind === 'existing') {
        try {
          reconciliation = await options.receptionCreateCommand.classifyExisting(validatedProvenance);
        } catch {
          throw new Error(receptionCreateRepositoryErrorMessage);
        }
      } else if (resultKind === 'legacy_orphan') {
        reconciliation = 'legacy_orphan';
      }

      // 監査証跡(who/when/what)。冪等再送(existing 系)では二重記録しない。
      // targetRef は識別子のみ(PHI 非含有)。created の evidence 確定は
      // コマンド境界の責務(Postgres はトランザクション内で確定済み、
      // in-memory は失敗時に受付ごと補償)で、意図一致検証はここで行う。
      if (resultKind === 'created') {
        const auditWallClock = auditWallClockUsed ?? options.now().toISOString();
        let recordedAudit: unknown;
        try {
          recordedAudit = await options.receptionCreateCommand.ensureCreatedEvidence({
            result,
            provenance: validatedProvenance,
            actorId: userId(tenantContext.actorId),
            wallClock: auditWallClock,
          });
        } catch (error) {
          // WeakSet 恒等判定のみ(hostile な失敗値を一切検査しない)。
          if (isReceptionOutboxAppendError(error)) {
            throw new Error(receptionCreatedOutboxInvariantErrorMessage);
          }
          // 監査追記失敗: outbox intent と受付を巻き戻してから正規化 500。
          // 巻き戻し自体の失敗も同じ 500 に吸収する(状態は fail-visible)。
          try {
            await options.receptionCreateCommand.rollbackCreatedEvidence(validatedProvenance);
          } catch {
            // fall through to the normalized 500
          }
          throw new Error(receptionCreatedAuditInvariantErrorMessage);
        }
        assertRecordedAuditMatchesIntent(recordedAudit, {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType: 'reception.created',
          targetRef: Object.freeze({ kind: 'reception', id: parsedEntry.receptionId }),
          outcome: 'success',
          wallClock: auditWallClock,
        }, receptionCreatedAuditInvariantErrorMessage);
      } else if (auditWallClockUsed !== undefined) {
        // 非 created 経路で監査時計が読まれたなら unit of work の規律違反。
        throw new Error(receptionCreatedAuditInvariantErrorMessage);
      }

      if (reconciliation === 'legacy_orphan') {
        void reply.header(receptionReconciliationHeaderName, 'legacy_orphan');
      }
      return reply.code(resultKind === 'created' ? 201 : 200).send(parsedEntry);
    },
  );

  done();
};

export const receptionCreateRoutes = fp(callback, {
  name: 'reception-create-routes',
});
