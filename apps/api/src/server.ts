import Fastify, { type FastifyInstance, type onRequestHookHandler } from 'fastify';
import { verifyAuditHashChain, type AuditEvent } from '@yrese/audit';
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
import { InMemoryReceptionRepository, type ReceptionRepository } from './reception-repository.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';
export const patientSearchInvalidQueryErrorCode = PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;
export const receptionInvalidRequestErrorCode = RECEPTION_INVALID_REQUEST_ERROR_CODE;
export const receptionPatientNotFoundErrorCode = RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
export const receptionIdempotencyConflictErrorCode = RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;
export const receptionPatientIdentityMismatchErrorMessage =
  'Patient lookup returned a mismatched patient identity';
const auditLogProjectionInvariantErrorMessage =
  'Audit event display projection failed for a verified hash chain';

export interface BuildServerOptions {
  readonly patientRepository?: PatientRepository;
  readonly receptionRepository?: ReceptionRepository;
  readonly auditRepository?: AuditRepository;
  readonly now?: () => Date;
  readonly repositoryMode?: ApiRepositoryMode;
  readonly tenantContextMode?: TenantContextMode;
  readonly patientSearchCursorCodec?: PatientSearchCursorCodec;
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

      return patientSearchResponseSchema.parse({
        results: page.results,
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

      return receptionQueueResponseSchema.parse({
        date: query.data.date,
        entries,
      });
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

      const result = await receptionRepository.create({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        patient,
        idempotencyKey: body.data.idempotencyKey,
        acceptedAt: now(),
      });

      if (result.kind === 'idempotency_conflict') {
        return reply.code(409).send(receptionIdempotencyConflictResponse());
      }

      // 監査証跡(who/when/what)。冪等再送(existing)では二重記録しない。
      // targetRef は識別子のみ(PHI 非含有)。
      if (result.kind === 'created') {
        await auditRepository.record(
          { tenantId: tenantContext.tenantId, pharmacyId: tenantContext.pharmacyId },
          {
            actorId: userId(tenantContext.actorId),
            auditEventType: 'reception.created',
            targetRef: { kind: 'reception', id: result.entry.receptionId },
            outcome: 'success',
            wallClock: now().toISOString(),
          },
        );
      }

      return reply.code(result.kind === 'created' ? 201 : 200).send(result.entry);
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

      const scope = { tenantId: tenantContext.tenantId, pharmacyId: tenantContext.pharmacyId };
      const events = await auditRepository.list(scope);

      // 改ざん検知: 保存されている全イベントに対する hash chain 検証(返却分だけではない)。
      const verification = verifyAuditHashChain(events);

      // 監査ログの閲覧自体を監査する(audit.viewed)。今回の応答には含めない(閲覧後に追記)。
      await auditRepository.record(scope, {
        actorId: userId(tenantContext.actorId),
        auditEventType: 'audit.viewed',
        targetRef: { kind: 'audit_log', id: `view:${events.length}` },
        outcome: 'success',
        wallClock: now().toISOString(),
      });

      // 新しい順(追記順の逆)で limit 件へ射影。表示投影に hash・envelope 内部は含めない。
      const displayWindow = [...events].reverse().slice(0, query.data.limit);
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
