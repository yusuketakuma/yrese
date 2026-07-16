import { isProxy } from 'node:util/types';

import Fastify, { type FastifyInstance, type onRequestHookHandler } from 'fastify';
import { hydrateAuditEvent, verifyAuditHashChain, type AuditEvent } from '@yrese/audit';
import {
  auditLogEntrySchema,
  auditLogQuerySchema,
  auditLogResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  patientGetParamsSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
  type PatientSearchResult,
  receptionCreateRequestSchema,
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
  receptionQueueQuerySchema,
  type AuditLogResponse,
  type AuditLogEntry,
  type HealthResponse,
  type PatientSearchResponse,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
  whoamiResponseSchema,
  type WhoamiResponse,
} from '@yrese/contracts';
import { CalendarDate } from '@yrese/date-time';
import {
  AUDIT_LOG_INVALID_QUERY_ERROR_CODE,
  PATIENT_NOT_FOUND_ERROR_CODE,
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE,
  patientId,
  permissionScope,
  receptionId,
  userId,
} from '@yrese/shared-kernel';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
  type ApiRepositoryMode,
} from './config.js';
import type { PatientSearchCursorCodec } from './patient-search-cursor.js';
import {
  requirePermission,
  tenantContextPlugin,
  type TenantContextMode,
} from './plugins/tenant-context.js';
import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
import {
  InMemoryPatientRepository,
  type PatientRepository,
  type PatientSearchCursor,
  type PatientSearchPage,
} from './patient-repository.js';
import {
  businessDateFromAcceptedAt,
  InMemoryReceptionRepository,
  type ReceptionCreateResult,
  type ReceptionRepository,
} from './reception-repository.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';
export const patientSearchInvalidQueryErrorCode = PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;
export const patientSearchResultLimitInvariantErrorMessage =
  'Patient repository returned more results than requested';
export const patientSearchDuplicateIdentityInvariantErrorMessage =
  'Patient repository returned duplicate patient identities';
export const patientSearchCursorProgressInvariantErrorMessage =
  'Patient repository returned an invalid next cursor';
export const patientSearchCursorDecodeErrorMessage = 'Patient search cursor decode failed';
export const patientSearchDecodedCursorInvariantErrorMessage =
  'Patient search cursor codec returned an invalid cursor';
export const patientSearchRepositoryErrorMessage = 'Patient repository search failed';
export const patientSearchPageSchemaInvariantErrorMessage =
  'Patient repository returned an invalid search page';
export const patientLookupRepositoryErrorMessage = 'Patient repository lookup failed';
export const receptionInvalidRequestErrorCode = RECEPTION_INVALID_REQUEST_ERROR_CODE;
export const receptionPatientNotFoundErrorCode = RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
export const receptionIdempotencyConflictErrorCode = RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;
export const receptionPatientIdentityMismatchErrorMessage =
  'Patient lookup returned a mismatched patient identity';
export const receptionPatientSchemaInvariantErrorMessage =
  'Patient lookup returned an invalid patient snapshot';
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
export const receptionCreatedAuditInvariantErrorMessage =
  'Audit repository returned mismatched reception creation evidence';
export const receptionQueueDuplicateIdentityInvariantErrorMessage =
  'Reception repository returned duplicate reception identities';
export const receptionQueueBusinessDateInvariantErrorMessage =
  'Reception repository returned entries outside the requested business date';
export const receptionQueueRepositoryErrorMessage =
  'Reception repository queue lookup failed';
export const receptionQueueSchemaInvariantErrorMessage =
  'Reception repository returned invalid queue entries';
export const receptionCreateRepositoryErrorMessage = 'Reception repository create failed';
const auditLogProjectionInvariantErrorMessage =
  'Audit event display projection failed for a verified hash chain';
export const auditLogScopeInvariantErrorMessage =
  'Audit repository returned events outside the requested scope';
export const auditLogRepositoryReadErrorMessage = 'Audit repository list failed';
export const auditLogListSchemaInvariantErrorMessage =
  'Audit repository returned an invalid event list';
export const auditLogDuplicateIdentityInvariantErrorMessage =
  'Verified audit chain contains duplicate event identities';
export const auditLogSequenceInvariantErrorMessage =
  'Verified audit chain contains a non-contiguous event sequence';
export const auditLogViewAuditInvariantErrorMessage =
  'Audit repository returned mismatched audit view evidence';

export interface BuildServerOptions {
  readonly patientRepository?: PatientRepository;
  readonly receptionRepository?: ReceptionRepository;
  readonly auditRepository?: AuditRepository;
  readonly now?: () => Date;
  readonly repositoryMode?: ApiRepositoryMode;
  readonly tenantContextMode?: TenantContextMode;
  readonly patientSearchCursorCodec?: PatientSearchCursorCodec;
}

function assertRecordedAuditMatchesIntent(
  value: unknown,
  expected: {
    readonly tenantId: string;
    readonly pharmacyId: string;
    readonly actorId: string;
    readonly auditEventType: string;
    readonly targetRef: { readonly kind: string; readonly id: string };
    readonly outcome: string;
    readonly wallClock: string;
  },
  invariantErrorMessage: string,
): void {
  let event: AuditEvent;
  try {
    event = hydrateAuditEvent(value);
  } catch {
    throw new Error(invariantErrorMessage);
  }

  if (
    event.tenantId !== expected.tenantId ||
    event.pharmacyId !== expected.pharmacyId ||
    event.actorId !== expected.actorId ||
    event.auditEventType !== expected.auditEventType ||
    event.targetRef.kind !== expected.targetRef.kind ||
    event.targetRef.id !== expected.targetRef.id ||
    event.outcome !== expected.outcome ||
    event.wallClock !== expected.wallClock ||
    event.aggregateType !== expected.targetRef.kind ||
    event.aggregateId !== expected.targetRef.id ||
    event.reasonCode !== undefined ||
    event.businessReason !== undefined
  ) {
    throw new Error(invariantErrorMessage);
  }
}

function invalidPatientSearchQueryResponse() {
  return errorResponseSchema.parse({
    errorCode: patientSearchInvalidQueryErrorCode,
    message: 'Invalid patient search query',
  });
}

type OwnDataPropertySnapshot =
  | { readonly present: false }
  | { readonly present: true; readonly value: unknown };

function readOwnEnumerableDataProperty(
  value: unknown,
  key: string,
  invariantErrorMessage: string,
): OwnDataPropertySnapshot {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(invariantErrorMessage);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return Object.freeze({ present: false });
    if (descriptor.enumerable !== true || !('value' in descriptor)) {
      throw new Error(invariantErrorMessage);
    }
    return Object.freeze({ present: true, value: descriptor.value });
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

function readRequiredOwnEnumerableDataProperty(
  value: unknown,
  key: string,
  invariantErrorMessage: string,
): unknown {
  const property = readOwnEnumerableDataProperty(value, key, invariantErrorMessage);
  if (!property.present) throw new Error(invariantErrorMessage);
  return property.value;
}

function snapshotDecodedPatientSearchCursor(value: unknown): PatientSearchCursor {
  const offset = readRequiredOwnEnumerableDataProperty(
    value,
    'offset',
    patientSearchDecodedCursorInvariantErrorMessage,
  );
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error(patientSearchDecodedCursorInvariantErrorMessage);
  }
  return Object.freeze({ offset });
}

function readReceptionCreateResultKind(value: unknown): ReceptionCreateResult['kind'] {
  const kind = readRequiredOwnEnumerableDataProperty(
    value,
    'kind',
    receptionResultKindInvariantErrorMessage,
  );
  if (
    kind !== 'created' &&
    kind !== 'existing' &&
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

function snapshotPatientSearchResultIdentity(
  value: unknown,
  invariantErrorMessage: string,
): unknown {
  return readRequiredOwnEnumerableDataProperty(value, 'patientId', invariantErrorMessage);
}

function snapshotPatientSearchResult(
  value: unknown,
  patientIdentity: unknown,
  invariantErrorMessage: string,
) {
  const eligibilityCheckedAt = readOwnEnumerableDataProperty(
    value,
    'eligibilityCheckedAt',
    invariantErrorMessage,
  );
  return Object.freeze({
    patientId: patientIdentity,
    name: readRequiredOwnEnumerableDataProperty(
      value,
      'name',
      invariantErrorMessage,
    ),
    kana: readRequiredOwnEnumerableDataProperty(
      value,
      'kana',
      invariantErrorMessage,
    ),
    birthDate: readRequiredOwnEnumerableDataProperty(
      value,
      'birthDate',
      invariantErrorMessage,
    ),
    sex: readRequiredOwnEnumerableDataProperty(
      value,
      'sex',
      invariantErrorMessage,
    ),
    patientNumber: readRequiredOwnEnumerableDataProperty(
      value,
      'patientNumber',
      invariantErrorMessage,
    ),
    eligibilityStatus: readRequiredOwnEnumerableDataProperty(
      value,
      'eligibilityStatus',
      invariantErrorMessage,
    ),
    ...(eligibilityCheckedAt.present
      ? { eligibilityCheckedAt: eligibilityCheckedAt.value }
      : {}),
  });
}

function parsePatientSearchResultSnapshot(
  value: unknown,
  invariantErrorMessage: string,
): PatientSearchResult {
  try {
    const parsed = patientSearchResultSchema.safeParse(value);
    if (!parsed.success) throw new Error(invariantErrorMessage);
    return parsed.data;
  } catch {
    throw new Error(invariantErrorMessage);
  }
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

function snapshotDenseArray(
  value: unknown,
  invariantErrorMessage: string,
  maximum?: { readonly length: number; readonly errorMessage: string },
): readonly unknown[] {
  let arrayLength: number;
  try {
    if (isProxy(value) || !Array.isArray(value)) throw new Error(invariantErrorMessage);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      throw new Error(invariantErrorMessage);
    }
    arrayLength = lengthDescriptor.value;
  } catch {
    throw new Error(invariantErrorMessage);
  }

  if (maximum !== undefined && arrayLength > maximum.length) {
    throw new Error(maximum.errorMessage);
  }

  try {
    const snapshot: unknown[] = [];
    for (let index = 0; index < arrayLength; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor)
      ) {
        throw new Error(invariantErrorMessage);
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

function snapshotReceptionEntryIdentity(value: unknown, invariantErrorMessage: string) {
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

function snapshotReceptionEntry(
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
  });
}

function parseReceptionEntrySnapshot(
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

function invalidReceptionRequestResponse() {
  return errorResponseSchema.parse({
    errorCode: receptionInvalidRequestErrorCode,
    message: 'Invalid reception request',
  });
}

function projectAuditLogEntry(event: AuditEvent): AuditLogEntry | undefined {
  try {
    const projected = auditLogEntrySchema.safeParse({
      eventId: event.eventId,
      wallClock: event.wallClock,
      actorId: event.actorId,
      auditEventType: event.auditEventType,
      targetRef: event.targetRef,
      outcome: event.outcome,
      ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
      ...(event.businessReason === undefined
        ? {}
        : { businessReasonCode: event.businessReason.code }),
    });
    return projected.success ? projected.data : undefined;
  } catch {
    return undefined;
  }
}

function receptionPatientNotFoundResponse() {
  return errorResponseSchema.parse({
    errorCode: receptionPatientNotFoundErrorCode,
    message: 'Patient not found for reception',
  });
}

function receptionIdempotencyConflictResponse() {
  return errorResponseSchema.parse({
    errorCode: receptionIdempotencyConflictErrorCode,
    message: 'Reception idempotency conflict',
  });
}

function invalidAuditLogQueryResponse() {
  return errorResponseSchema.parse({
    errorCode: AUDIT_LOG_INVALID_QUERY_ERROR_CODE,
    message: 'Invalid audit log query',
  });
}

function patientNotFoundResponse() {
  return errorResponseSchema.parse({
    errorCode: PATIENT_NOT_FOUND_ERROR_CODE,
    message: 'Patient not found',
  });
}

const setSensitiveResponseNoStore: onRequestHookHandler = async (_request, reply) => {
  reply.header('Cache-Control', 'no-store');
};

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const tenantContextMode = options.tenantContextMode ?? 'disabled';
  if (tenantContextMode === 'dev_headers' && options.repositoryMode !== 'in_memory') {
    throw new Error(devTenantContextConfigurationErrorMessage);
  }

  if (options.patientSearchCursorCodec === undefined) {
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }
  const patientSearchCursorCodec = options.patientSearchCursorCodec;

  const patientRepository = options.patientRepository ?? new InMemoryPatientRepository();
  const receptionRepository = options.receptionRepository ?? new InMemoryReceptionRepository();
  const auditRepository = options.auditRepository ?? new InMemoryAuditRepository();
  const now = options.now ?? (() => new Date());
  const server = Fastify({
    logger: false,
  });

  server.register(tenantContextPlugin, { mode: tenantContextMode });

  server.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: now().toISOString(),
    });
  });

  server.get(
    '/whoami',
    {
      preHandler: requirePermission(permissionScope('tenant', 'read')),
    },
    async (request): Promise<WhoamiResponse> => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      return whoamiResponseSchema.parse({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        actorId: tenantContext.actorId,
        scopes: tenantContext.scopes,
      });
    },
  );

  server.get(
    '/patients/search',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('patient', 'read')),
    },
    async (request, reply): Promise<PatientSearchResponse | void> => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      const query = patientSearchQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      let cursor: PatientSearchCursor | undefined;
      if (query.data.cursor !== undefined) {
        const cursorBinding = Object.freeze({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          q: query.data.q,
        });
        let decodedCursor: PatientSearchCursor | undefined;
        try {
          decodedCursor = patientSearchCursorCodec.decode(
            cursorBinding,
            query.data.cursor,
          );
        } catch {
          throw new Error(patientSearchCursorDecodeErrorMessage);
        }
        if (decodedCursor !== undefined) {
          cursor = snapshotDecodedPatientSearchCursor(decodedCursor);
        }
      }

      if (query.data.cursor !== undefined && cursor === undefined) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      const requestedOffset = cursor?.offset ?? 0;

      let page: PatientSearchPage;
      try {
        page = await patientRepository.search({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          q: query.data.q,
          limit: query.data.limit,
          ...(cursor === undefined ? {} : { cursor }),
        });
      } catch {
        throw new Error(patientSearchRepositoryErrorMessage);
      }
      const rawResultsValue = readRequiredOwnEnumerableDataProperty(
        page,
        'results',
        patientSearchPageSchemaInvariantErrorMessage,
      );
      const rawResults = snapshotDenseArray(
        rawResultsValue,
        patientSearchPageSchemaInvariantErrorMessage,
        {
          length: query.data.limit,
          errorMessage: patientSearchResultLimitInvariantErrorMessage,
        },
      );
      const validatedResults = rawResults.map((result) => {
        const patientIdentity = snapshotPatientSearchResultIdentity(
          result,
          patientSearchPageSchemaInvariantErrorMessage,
        );
        const patientSnapshot = snapshotPatientSearchResult(
          result,
          patientIdentity,
          patientSearchPageSchemaInvariantErrorMessage,
        );
        return parsePatientSearchResultSnapshot(
          patientSnapshot,
          patientSearchPageSchemaInvariantErrorMessage,
        );
      });
      const patientIds = new Set<string>();
      for (const result of validatedResults) {
        if (patientIds.has(result.patientId)) {
          throw new Error(patientSearchDuplicateIdentityInvariantErrorMessage);
        }
        patientIds.add(result.patientId);
      }
      const nextCursorProperty = readOwnEnumerableDataProperty(
        page,
        'nextCursor',
        patientSearchCursorProgressInvariantErrorMessage,
      );
      let encodedNextCursor: string | undefined;
      if (nextCursorProperty.present && nextCursorProperty.value !== undefined) {
        const rawNextOffset = readRequiredOwnEnumerableDataProperty(
          nextCursorProperty.value,
          'offset',
          patientSearchCursorProgressInvariantErrorMessage,
        );
        const expectedNextOffset = requestedOffset + validatedResults.length;
        if (
          validatedResults.length === 0 ||
          !Number.isSafeInteger(expectedNextOffset) ||
          rawNextOffset !== expectedNextOffset
        ) {
          throw new Error(patientSearchCursorProgressInvariantErrorMessage);
        }
        encodedNextCursor = patientSearchCursorCodec.encode(
          {
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
            q: query.data.q,
          },
          Object.freeze({ offset: expectedNextOffset }),
        );
      }

      return patientSearchResponseSchema.parse({
        results: validatedResults,
        ...(encodedNextCursor === undefined ? {} : { nextCursor: encodedNextCursor }),
      });
    },
  );

  server.get(
    '/patients/:patientId',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('patient', 'read')),
    },
    async (request, reply): Promise<PatientSearchResult | void> => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      const params = patientGetParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      const parsedPatientId = patientId(params.data.patientId);
      let patient: PatientSearchResult | undefined;
      try {
        patient = await patientRepository.findById({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: parsedPatientId,
        });
      } catch {
        throw new Error(patientLookupRepositoryErrorMessage);
      }
      if (patient === undefined) {
        return reply.code(404).send(patientNotFoundResponse());
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
      return parsePatientSearchResultSnapshot(
        patientSnapshot,
        receptionPatientSchemaInvariantErrorMessage,
      );
    },
  );

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
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

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
        entries = await receptionRepository.list({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          date: query.data.date,
        });
      } catch {
        throw new Error(receptionQueueRepositoryErrorMessage);
      }

      const rawEntries = snapshotDenseArray(entries, receptionQueueSchemaInvariantErrorMessage);
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
        if (businessDateFromAcceptedAt(new Date(entry.acceptedAt)) !== query.data.date) {
          throw new Error(receptionQueueBusinessDateInvariantErrorMessage);
        }
      }
      return response;
    },
  );

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
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      const body = receptionCreateRequestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send(invalidReceptionRequestResponse());
      }

      const parsedPatientId = patientId(body.data.patientId);
      let patient: PatientSearchResult | undefined;
      try {
        patient = await patientRepository.findById({
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

      const acceptedAt = now();
      const acceptedAtIso = acceptedAt.toISOString();
      let result: ReceptionCreateResult;
      try {
        result = await receptionRepository.create({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patient: repositoryPatient,
          idempotencyKey: body.data.idempotencyKey,
          acceptedAt,
        });
      } catch {
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

      // 監査証跡(who/when/what)。冪等再送(existing)では二重記録しない。
      // targetRef は識別子のみ(PHI 非含有)。
      if (resultKind === 'created') {
        const auditScope = Object.freeze({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
        });
        const auditIntent = Object.freeze({
          actorId: userId(tenantContext.actorId),
          auditEventType: 'reception.created',
          targetRef: Object.freeze({ kind: 'reception', id: parsedEntry.receptionId }),
          outcome: 'success' as const,
          wallClock: now().toISOString(),
        });
        let recordedAudit: unknown;
        try {
          recordedAudit = await auditRepository.record(auditScope, auditIntent);
        } catch {
          throw new Error(receptionCreatedAuditInvariantErrorMessage);
        }
        assertRecordedAuditMatchesIntent(recordedAudit, {
          ...auditScope,
          ...auditIntent,
        }, receptionCreatedAuditInvariantErrorMessage);
      }

      return reply.code(resultKind === 'created' ? 201 : 200).send(parsedEntry);
    },
  );

  server.get(
    '/audit/events',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('audit-log', 'read')),
    },
    async (request, reply): Promise<AuditLogResponse | void> => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      const query = auditLogQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidAuditLogQueryResponse());
      }

      const scope = Object.freeze({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
      });
      let rawEvents: readonly AuditEvent[];
      try {
        rawEvents = await auditRepository.list(scope);
      } catch {
        throw new Error(auditLogRepositoryReadErrorMessage);
      }
      const events = snapshotDenseArray(
        rawEvents,
        auditLogListSchemaInvariantErrorMessage,
      ) as readonly AuditEvent[];
      if (
        events.some(
          (event) =>
            event.tenantId !== scope.tenantId || event.pharmacyId !== scope.pharmacyId,
        )
      ) {
        throw new Error(auditLogScopeInvariantErrorMessage);
      }

      // 改ざん検知: 保存されている全イベントに対する hash chain 検証(返却分だけではない)。
      const verification = verifyAuditHashChain(events);
      if (verification.ok) {
        const eventIds = new Set<string>();
        for (const event of events) {
          if (eventIds.has(event.eventId)) {
            throw new Error(auditLogDuplicateIdentityInvariantErrorMessage);
          }
          eventIds.add(event.eventId);
        }
        for (const [index, event] of events.entries()) {
          if (event.sequenceNumber !== BigInt(index + 1)) {
            throw new Error(auditLogSequenceInvariantErrorMessage);
          }
        }
      }

      // 監査ログの閲覧自体を監査する(audit.viewed)。今回の応答には含めない(閲覧後に追記)。
      const viewTarget = Object.freeze({ kind: 'audit_log', id: `view:${events.length}` });
      const viewIntent = Object.freeze({
        actorId: userId(tenantContext.actorId),
        auditEventType: 'audit.viewed',
        targetRef: viewTarget,
        outcome: 'success',
        wallClock: now().toISOString(),
      });
      let recordedViewAudit: unknown;
      try {
        recordedViewAudit = await auditRepository.record(scope, viewIntent);
      } catch {
        throw new Error(auditLogViewAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedViewAudit,
        { ...scope, ...viewIntent },
        auditLogViewAuditInvariantErrorMessage,
      );

      // 検証済みchainは公開契約どおりwallClock降順。同時刻は後のappendを先にする。
      // 破損chainはwallClockを信頼せず、WP-4093のraw append window/no-backfillを維持する。
      const displayCandidates = events.map((event, appendIndex) => ({ event, appendIndex }));
      displayCandidates.sort((left, right) => {
        if (!verification.ok) return right.appendIndex - left.appendIndex;
        if (left.event.wallClock < right.event.wallClock) return 1;
        if (left.event.wallClock > right.event.wallClock) return -1;
        return right.appendIndex - left.appendIndex;
      });
      const displayWindow = displayCandidates
        .slice(0, query.data.limit)
        .map(({ event }) => event);
      const entries: AuditLogEntry[] = [];
      let projectionFailed = false;
      for (const event of displayWindow) {
        const entry = projectAuditLogEntry(event);
        if (entry === undefined) {
          projectionFailed = true;
        } else {
          entries.push(entry);
        }
      }
      if (projectionFailed && verification.ok) {
        throw new Error(auditLogProjectionInvariantErrorMessage);
      }

      return auditLogResponseSchema.parse({
        entries,
        chainVerification: verification.ok
          ? { ok: true, checkedCount: verification.checkedCount }
          : {
              ok: false,
              checkedCount: verification.checkedCount,
              breakIndex: verification.breakIndex,
              reason: verification.reason,
            },
        totalCount: events.length,
      });
    },
  );

  return server;
}
