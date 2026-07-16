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
import { InMemoryPatientRepository, type PatientRepository } from './patient-repository.js';
import {
  businessDateFromAcceptedAt,
  InMemoryReceptionRepository,
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
export const receptionInvalidRequestErrorCode = RECEPTION_INVALID_REQUEST_ERROR_CODE;
export const receptionPatientNotFoundErrorCode = RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
export const receptionIdempotencyConflictErrorCode = RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;
export const receptionPatientIdentityMismatchErrorMessage =
  'Patient lookup returned a mismatched patient identity';
export const receptionPatientSchemaInvariantErrorMessage =
  'Patient lookup returned an invalid patient snapshot';
export const receptionResultPatientIdentityMismatchErrorMessage =
  'Reception repository returned a mismatched patient identity';
export const receptionResultIdempotencyProvenanceMismatchErrorMessage =
  'Reception repository returned mismatched idempotency provenance';
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
const auditLogProjectionInvariantErrorMessage =
  'Audit event display projection failed for a verified hash chain';
export const auditLogScopeInvariantErrorMessage =
  'Audit repository returned events outside the requested scope';
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

      const cursor =
        query.data.cursor === undefined
          ? undefined
          : patientSearchCursorCodec.decode({
              tenantId: tenantContext.tenantId,
              pharmacyId: tenantContext.pharmacyId,
              q: query.data.q,
            }, query.data.cursor);

      if (query.data.cursor !== undefined && cursor === undefined) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      const page = await patientRepository.search({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        q: query.data.q,
        limit: query.data.limit,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (page.results.length > query.data.limit) {
        throw new Error(patientSearchResultLimitInvariantErrorMessage);
      }
      const validatedResults = page.results.map((result) =>
        patientSearchResultSchema.parse(result),
      );
      const patientIds = new Set<string>();
      for (const result of validatedResults) {
        if (patientIds.has(result.patientId)) {
          throw new Error(patientSearchDuplicateIdentityInvariantErrorMessage);
        }
        patientIds.add(result.patientId);
      }
      if (page.nextCursor !== undefined) {
        const expectedNextOffset = (cursor?.offset ?? 0) + validatedResults.length;
        if (
          validatedResults.length === 0 ||
          !Number.isSafeInteger(expectedNextOffset) ||
          page.nextCursor.offset !== expectedNextOffset
        ) {
          throw new Error(patientSearchCursorProgressInvariantErrorMessage);
        }
      }

      return patientSearchResponseSchema.parse({
        results: validatedResults,
        ...(page.nextCursor === undefined
          ? {}
          : {
              nextCursor: patientSearchCursorCodec.encode(
                {
                  tenantId: tenantContext.tenantId,
                  pharmacyId: tenantContext.pharmacyId,
                  q: query.data.q,
                },
                page.nextCursor,
              ),
            }),
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
      const patient = await patientRepository.findById({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        patientId: parsedPatientId,
      });
      if (patient === undefined) {
        return reply.code(404).send(patientNotFoundResponse());
      }
      if (patient.patientId !== parsedPatientId) {
        throw new Error(receptionPatientIdentityMismatchErrorMessage);
      }

      return patientSearchResultSchema.parse(patient);
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

      const entries = await receptionRepository.list({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        date: query.data.date,
      });

      const response = receptionQueueResponseSchema.parse({
        date: query.data.date,
        entries,
      });
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
      const patient = await patientRepository.findById({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        patientId: parsedPatientId,
      });
      if (patient === undefined) {
        return reply.code(404).send(receptionPatientNotFoundResponse());
      }
      if (patient.patientId !== parsedPatientId) {
        throw new Error(receptionPatientIdentityMismatchErrorMessage);
      }
      const parsedPatient = patientSearchResultSchema.safeParse(patient);
      if (!parsedPatient.success) {
        throw new Error(receptionPatientSchemaInvariantErrorMessage);
      }

      const acceptedAt = now();
      const acceptedAtIso = acceptedAt.toISOString();
      const result = await receptionRepository.create({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        patient: parsedPatient.data,
        idempotencyKey: body.data.idempotencyKey,
        acceptedAt,
      });

      const provenance = result.provenance;
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

      if (result.kind === 'idempotency_conflict') {
        if (provenance.patientId === parsedPatientId) {
          throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
        }
        return reply.code(409).send(receptionIdempotencyConflictResponse());
      }
      const rawEntryValue = (result as { readonly entry?: unknown }).entry;
      if (typeof rawEntryValue !== 'object' || rawEntryValue === null) {
        throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
      }
      const rawEntry = rawEntryValue as {
        readonly receptionId?: unknown;
        readonly patient?: { readonly patientId?: unknown };
      };
      if (
        provenance.receptionId !== rawEntry.receptionId ||
        provenance.patientId !== rawEntry.patient?.patientId
      ) {
        throw new Error(receptionResultIdempotencyProvenanceMismatchErrorMessage);
      }
      const parsedEntry = receptionQueueEntrySchema.safeParse(result.entry);
      if (!parsedEntry.success) {
        throw new Error(receptionResultSchemaInvariantErrorMessage);
      }
      if (parsedEntry.data.patient.patientId !== parsedPatientId) {
        throw new Error(receptionResultPatientIdentityMismatchErrorMessage);
      }
      if (result.kind === 'created' && parsedEntry.data.receptionStatus !== 'WAITING') {
        throw new Error(receptionCreatedStatusInvariantErrorMessage);
      }
      if (result.kind === 'created' && parsedEntry.data.acceptedAt !== acceptedAtIso) {
        throw new Error(receptionCreatedAcceptedAtInvariantErrorMessage);
      }

      // 監査証跡(who/when/what)。冪等再送(existing)では二重記録しない。
      // targetRef は識別子のみ(PHI 非含有)。
      if (result.kind === 'created') {
        const auditScope = Object.freeze({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
        });
        const auditIntent = Object.freeze({
          actorId: userId(tenantContext.actorId),
          auditEventType: 'reception.created',
          targetRef: Object.freeze({ kind: 'reception', id: parsedEntry.data.receptionId }),
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

      return reply.code(result.kind === 'created' ? 201 : 200).send(parsedEntry.data);
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
      const events = await auditRepository.list(scope);
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
