import { randomUUID } from 'node:crypto';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES,
  errorResponseSchema,
  patientCreateRequestSchema,
  patientCreateResponseSchema,
  patientGetParamsSchema,
  patientIdempotencyKeySchema,
  patientUpdateRequestSchema,
  patientUpdateResponseSchema,
  patientVersionedSummarySchema,
  patientDuplicateWarningSchema,
  type PatientCreateResponse,
  type PatientDuplicateWarning,
  type PatientUpdateResponse,
} from '@yrese/contracts';
import {
  PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  PATIENT_IMMUTABLE_FIELD_ERROR_CODE,
  PATIENT_NOT_FOUND_ERROR_CODE,
  PATIENT_NUMBER_CONFLICT_ERROR_CODE,
  PATIENT_VERSION_CONFLICT_ERROR_CODE,
  PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE,
  patientId,
  permissionScope,
  userId,
} from '@yrese/shared-kernel';

import {
  isPatientAuditAppendError,
  patientCommandAggregateType,
  patientCreateAuditEventType,
  patientCreateRequestFingerprint,
  patientDuplicateSearchTargetKind,
  patientSearchedAuditEventType,
  patientUpdateAuditEventType,
  type PatientCreateAttributes,
  type PatientCreateCommandResult,
  type PatientUpdateCommandResult,
  type PatientWriteCommand,
} from './patient-command.js';
import {
  parsePatientSearchResultSnapshot,
  snapshotPatientSearchResult,
  snapshotPatientSearchResultIdentity,
} from './patient-routes.js';
import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  assertRecordedAuditMatchesIntent,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotDenseArray,
  snapshotWallClock,
} from './route-invariants.js';

export interface PatientWriteRoutesOptions {
  readonly patientWriteCommand: PatientWriteCommand;
  readonly now: () => Date;
}

export const patientWriteInvalidRequestErrorCode =
  PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE;
export const patientNumberConflictErrorCode = PATIENT_NUMBER_CONFLICT_ERROR_CODE;
export const patientVersionConflictErrorCode = PATIENT_VERSION_CONFLICT_ERROR_CODE;
export const patientImmutableFieldErrorCode = PATIENT_IMMUTABLE_FIELD_ERROR_CODE;
export const patientIdempotencyConflictErrorCode =
  PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE;
export const patientWriteNotFoundErrorCode = PATIENT_NOT_FOUND_ERROR_CODE;

export const patientWriteRepositoryErrorMessage =
  'Patient repository write failed';
export const patientCreateResultKindInvariantErrorMessage =
  'Patient repository returned an invalid create result kind';
export const patientUpdateResultKindInvariantErrorMessage =
  'Patient repository returned an invalid update result kind';
export const patientWriteResultSchemaInvariantErrorMessage =
  'Patient repository returned an invalid patient snapshot';
export const patientWriteAuditInvariantErrorMessage =
  'Audit repository returned mismatched patient write evidence';
export const patientWriteClockReadErrorMessage =
  'Patient write clock read failed';
export const patientWriteClockInvariantErrorMessage =
  'Patient write clock returned an invalid instant';
export const patientDuplicateCandidatesInvariantErrorMessage =
  'Patient repository returned invalid duplicate candidates';

const invalidPatientWriteRequestResponseTemplate = errorResponseSchema.parse({
  errorCode: patientWriteInvalidRequestErrorCode,
  message: 'Invalid patient write request',
});
function invalidPatientWriteRequestResponse() {
  return { ...invalidPatientWriteRequestResponseTemplate };
}

const patientNumberConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: patientNumberConflictErrorCode,
  message: 'Patient number conflict',
});
function patientNumberConflictResponse() {
  return { ...patientNumberConflictResponseTemplate };
}

const patientVersionConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: patientVersionConflictErrorCode,
  message: 'Patient version conflict',
});
function patientVersionConflictResponse() {
  return { ...patientVersionConflictResponseTemplate };
}

const patientImmutableFieldResponseTemplate = errorResponseSchema.parse({
  errorCode: patientImmutableFieldErrorCode,
  message: 'Immutable patient field change',
});
function patientImmutableFieldResponse() {
  return { ...patientImmutableFieldResponseTemplate };
}

const patientIdempotencyConflictResponseTemplate = errorResponseSchema.parse({
  errorCode: patientIdempotencyConflictErrorCode,
  message: 'Patient idempotency conflict',
});
function patientIdempotencyConflictResponse() {
  return { ...patientIdempotencyConflictResponseTemplate };
}

const patientNotFoundResponseTemplate = errorResponseSchema.parse({
  errorCode: patientWriteNotFoundErrorCode,
  message: 'Patient not found',
});
function patientWriteNotFoundResponse() {
  return { ...patientNotFoundResponseTemplate };
}

function snapshotVersionedPatientSummary(
  value: unknown,
  invariantErrorMessage: string,
) {
  const patientIdentity = snapshotPatientSearchResultIdentity(
    value,
    invariantErrorMessage,
  );
  const version = readRequiredOwnEnumerableDataProperty(
    value,
    'version',
    invariantErrorMessage,
  );
  return Object.freeze({
    ...snapshotPatientSearchResult(value, patientIdentity, invariantErrorMessage),
    version,
  });
}

function parseVersionedPatientSummary(
  value: unknown,
  invariantErrorMessage: string,
) {
  try {
    const parsed = patientVersionedSummarySchema.safeParse(value);
    if (!parsed.success) throw new Error(invariantErrorMessage);
    return parsed.data;
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

function readCreateResultKind(
  value: unknown,
): 'created' | 'existing' | 'idempotency_conflict' | 'patient_number_conflict' {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    patientCreateResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'created' &&
    kind !== 'existing' &&
    kind !== 'idempotency_conflict' &&
    kind !== 'patient_number_conflict'
  ) {
    throw new Error(patientCreateResultKindInvariantErrorMessage);
  }
  return kind;
}

function readUpdateResultKind(
  value: unknown,
): 'updated' | 'not_found' | 'version_conflict' {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    patientUpdateResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'updated' &&
    kind !== 'not_found' &&
    kind !== 'version_conflict'
  ) {
    throw new Error(patientUpdateResultKindInvariantErrorMessage);
  }
  return kind;
}

function parseDuplicateCandidates(
  value: unknown,
): readonly PatientDuplicateWarning['candidates'][number][] {
  const raw = snapshotDenseArray(
    value,
    patientDuplicateCandidatesInvariantErrorMessage,
    {
      length: PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES,
      errorMessage: patientDuplicateCandidatesInvariantErrorMessage,
    },
  );
  return raw.map((candidate) =>
    parsePatientSearchResultSnapshot(
      candidate,
      patientDuplicateCandidatesInvariantErrorMessage,
    ),
  );
}

/** PUT ボディへの出現を 422(PAT-0005)で拒否する wire 上不変 field。 */
const PATIENT_IMMUTABLE_WIRE_FIELDS = Object.freeze([
  'patientNumber',
  'patientId',
  'version',
  'eligibilityStatus',
  'eligibilityCheckedAt',
]);

const callback: FastifyPluginCallback<PatientWriteRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.post(
    '/patients',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [
        requirePermission(permissionScope('patient', 'write')),
        requirePermission(permissionScope('patient', 'read')),
      ],
    },
    async (request, reply): Promise<PatientCreateResponse | void> => {
      const tenantContext = requireTenantContext(request);

      // Idempotency-Key ヘッダ(API-013 形式)。欠落・非適合は 400。
      const idempotencyKey = patientIdempotencyKeySchema.safeParse(
        request.headers['idempotency-key'],
      );
      const body = patientCreateRequestSchema.safeParse(request.body);
      if (!idempotencyKey.success || !body.success) {
        return reply.code(400).send(invalidPatientWriteRequestResponse());
      }

      const recordedAtIso = snapshotWallClock(
        options.now,
        patientWriteClockReadErrorMessage,
        patientWriteClockInvariantErrorMessage,
      );

      const attributes: PatientCreateAttributes =
        body.data.patientNumber === undefined
          ? {
              name: body.data.name,
              kana: body.data.kana,
              birthDate: body.data.birthDate,
              sex: body.data.sex,
            }
          : {
              name: body.data.name,
              kana: body.data.kana,
              birthDate: body.data.birthDate,
              sex: body.data.sex,
              patientNumber: body.data.patientNumber,
            };
      let result: PatientCreateCommandResult;
      try {
        result = await options.patientWriteCommand.createPatient({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          attributes,
          idempotencyKey: idempotencyKey.data,
          requestFingerprint: patientCreateRequestFingerprint(attributes),
          recordedAt: recordedAtIso,
          auditWallClock: () => recordedAtIso,
          mintPatientId: () => patientId(`patient-${randomUUID()}`),
        });
      } catch (error) {
        if (isPatientAuditAppendError(error)) {
          throw new Error(patientWriteAuditInvariantErrorMessage);
        }
        throw new Error(patientWriteRepositoryErrorMessage);
      }

      const resultKind = readCreateResultKind(result);
      if (resultKind === 'idempotency_conflict') {
        return reply.code(409).send(patientIdempotencyConflictResponse());
      }
      if (resultKind === 'patient_number_conflict') {
        return reply.code(409).send(patientNumberConflictResponse());
      }

      const rawPatient = readRequiredOwnEnumerableDataProperty(
        result,
        'patient',
        patientWriteResultSchemaInvariantErrorMessage,
      );
      const patient = parseVersionedPatientSummary(
        snapshotVersionedPatientSummary(
          rawPatient,
          patientWriteResultSchemaInvariantErrorMessage,
        ),
        patientWriteResultSchemaInvariantErrorMessage,
      );

      if (resultKind === 'existing') {
        return reply.code(200).send({ patient });
      }

      const rawCandidates = readRequiredOwnEnumerableDataProperty(
        result,
        'duplicateCandidates',
        patientDuplicateCandidatesInvariantErrorMessage,
      );
      const candidates = parseDuplicateCandidates(rawCandidates);
      const warnings: PatientDuplicateWarning[] =
        candidates.length === 0
          ? []
          : [
              patientDuplicateWarningSchema.parse({
                type: 'POSSIBLE_DUPLICATE',
                candidates,
              }),
            ];

      // 監査証跡の意図一致検証: [searched?] + created。
      const rawAuditEvents = readRequiredOwnEnumerableDataProperty(
        result,
        'auditEvents',
        patientWriteAuditInvariantErrorMessage,
      );
      const auditEvents = snapshotDenseArray(
        rawAuditEvents,
        patientWriteAuditInvariantErrorMessage,
        { length: 2, errorMessage: patientWriteAuditInvariantErrorMessage },
      );
      const expectedAuditCount = warnings.length > 0 ? 2 : 1;
      if (auditEvents.length !== expectedAuditCount) {
        throw new Error(patientWriteAuditInvariantErrorMessage);
      }
      const scope = { tenantId: tenantContext.tenantId, pharmacyId: tenantContext.pharmacyId };
      let auditIndex = 0;
      if (warnings.length > 0) {
        assertRecordedAuditMatchesIntent(
          auditEvents[auditIndex],
          {
            ...scope,
            actorId: userId(tenantContext.actorId),
            auditEventType: patientSearchedAuditEventType,
            targetRef: Object.freeze({
              kind: patientDuplicateSearchTargetKind,
              id: `duplicates:${candidates.length}`,
            }),
            outcome: 'success',
            wallClock: recordedAtIso,
          },
          patientWriteAuditInvariantErrorMessage,
        );
        auditIndex += 1;
      }
      assertRecordedAuditMatchesIntent(
        auditEvents[auditIndex],
        {
          ...scope,
          actorId: userId(tenantContext.actorId),
          auditEventType: patientCreateAuditEventType,
          targetRef: Object.freeze({
            kind: patientCommandAggregateType,
            id: patient.patientId,
          }),
          outcome: 'success',
          wallClock: recordedAtIso,
        },
        patientWriteAuditInvariantErrorMessage,
      );

      return reply.code(201).send(
        patientCreateResponseSchema.parse({
          patient,
          ...(warnings.length === 0 ? {} : { warnings }),
        }),
      );
    },
  );

  server.put(
    '/patients/:patientId',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: [requirePermission(permissionScope('patient', 'write'))],
    },
    async (request, reply): Promise<PatientUpdateResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const params = patientGetParamsSchema.safeParse(request.params);
      const body = patientUpdateRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send(invalidPatientWriteRequestResponse());
      }

      // 不変 field の変更試行は 422(PAT-0005)。wire 上不変な全項目を対象とし、
      // 非 strict schema の strip に頼らず fail-closed で拒否する。
      const rawBody: unknown = request.body;
      if (
        typeof rawBody === 'object' &&
        rawBody !== null &&
        PATIENT_IMMUTABLE_WIRE_FIELDS.some((field) => field in rawBody)
      ) {
        return reply.code(422).send(patientImmutableFieldResponse());
      }

      // CAS 前提条件: If-Match は引用符付き expectedVersion と完全一致。
      // 欠落・非整数・不一致はすべて 400 PAT-0007。
      if (request.headers['if-match'] !== `"${body.data.expectedVersion}"`) {
        return reply.code(400).send(invalidPatientWriteRequestResponse());
      }

      const recordedAtIso = snapshotWallClock(
        options.now,
        patientWriteClockReadErrorMessage,
        patientWriteClockInvariantErrorMessage,
      );

      let result: PatientUpdateCommandResult;
      try {
        result = await options.patientWriteCommand.updatePatient({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: patientId(params.data.patientId),
          expectedVersion: body.data.expectedVersion,
          attributes: {
            ...(body.data.name === undefined ? {} : { name: body.data.name }),
            ...(body.data.kana === undefined ? {} : { kana: body.data.kana }),
            ...(body.data.birthDate === undefined
              ? {}
              : { birthDate: body.data.birthDate }),
            ...(body.data.sex === undefined ? {} : { sex: body.data.sex }),
          },
          actorId: userId(tenantContext.actorId),
          recordedAt: recordedAtIso,
          auditWallClock: () => recordedAtIso,
        });
      } catch (error) {
        if (isPatientAuditAppendError(error)) {
          throw new Error(patientWriteAuditInvariantErrorMessage);
        }
        throw new Error(patientWriteRepositoryErrorMessage);
      }

      const resultKind = readUpdateResultKind(result);
      if (resultKind === 'not_found') {
        return reply.code(404).send(patientWriteNotFoundResponse());
      }
      if (resultKind === 'version_conflict') {
        return reply.code(412).send(patientVersionConflictResponse());
      }

      const rawPatient = readRequiredOwnEnumerableDataProperty(
        result,
        'patient',
        patientWriteResultSchemaInvariantErrorMessage,
      );
      const patient = parseVersionedPatientSummary(
        snapshotVersionedPatientSummary(
          rawPatient,
          patientWriteResultSchemaInvariantErrorMessage,
        ),
        patientWriteResultSchemaInvariantErrorMessage,
      );
      if (
        patient.patientId !== params.data.patientId ||
        patient.version !== body.data.expectedVersion + 1
      ) {
        throw new Error(patientWriteResultSchemaInvariantErrorMessage);
      }

      const recordedAudit = readRequiredOwnEnumerableDataProperty(
        result,
        'auditEvent',
        patientWriteAuditInvariantErrorMessage,
      );
      assertRecordedAuditMatchesIntent(
        recordedAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          actorId: userId(tenantContext.actorId),
          auditEventType: patientUpdateAuditEventType,
          targetRef: Object.freeze({
            kind: patientCommandAggregateType,
            id: patient.patientId,
          }),
          outcome: 'success',
          wallClock: recordedAtIso,
        },
        patientWriteAuditInvariantErrorMessage,
      );

      return reply.code(200).send(patientUpdateResponseSchema.parse({ patient }));
    },
  );

  done();
};

export const patientWriteRoutes = fp(callback, {
  name: 'patient-write-routes',
});
