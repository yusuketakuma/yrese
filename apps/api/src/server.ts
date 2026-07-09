import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  errorResponseSchema,
  healthResponseSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  receptionCreateRequestSchema,
  receptionQueueResponseSchema,
  receptionQueueQuerySchema,
  type HealthResponse,
  type PatientSearchResponse,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
  whoamiResponseSchema,
  type WhoamiResponse,
} from '@yrese/contracts';
import { CalendarDate } from '@yrese/date-time';
import {
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE,
  patientId,
  permissionScope,
} from '@yrese/shared-kernel';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
  type ApiRepositoryMode,
} from './config.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
  type PatientSearchCursorCodec,
} from './patient-search-cursor.js';
import {
  requirePermission,
  tenantContextPlugin,
  type TenantContextMode,
} from './plugins/tenant-context.js';
import { InMemoryPatientRepository, type PatientRepository } from './patient-repository.js';
import { InMemoryReceptionRepository, type ReceptionRepository } from './reception-repository.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';
export const patientSearchInvalidQueryErrorCode = PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;
export const receptionInvalidRequestErrorCode = RECEPTION_INVALID_REQUEST_ERROR_CODE;
export const receptionPatientNotFoundErrorCode = RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
export const receptionIdempotencyConflictErrorCode = RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;

export interface BuildServerOptions {
  readonly patientRepository?: PatientRepository;
  readonly receptionRepository?: ReceptionRepository;
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

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const tenantContextMode = options.tenantContextMode ?? 'disabled';
  if (tenantContextMode === 'dev_headers' && options.repositoryMode !== 'in_memory') {
    throw new Error(devTenantContextConfigurationErrorMessage);
  }

  if (options.patientSearchCursorCodec === undefined && options.repositoryMode === 'postgres') {
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }
  const patientSearchCursorCodec =
    options.patientSearchCursorCodec ??
    createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength));

  const patientRepository = options.patientRepository ?? new InMemoryPatientRepository();
  const receptionRepository = options.receptionRepository ?? new InMemoryReceptionRepository();
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
      preHandler: requirePermission(permissionScope('patient', 'read')),
    },
    async (request, reply): Promise<PatientSearchResponse | void> => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      reply.header('Cache-Control', 'no-store');

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
    '/reception/queue',
    {
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

      reply.header('Cache-Control', 'no-store');

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

      reply.header('Cache-Control', 'no-store');

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

      const result = await receptionRepository.create({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        patientId: parsedPatientId,
        patient,
        idempotencyKey: body.data.idempotencyKey,
        acceptedAt: now(),
      });

      if (result.kind === 'idempotency_conflict') {
        return reply.code(409).send(receptionIdempotencyConflictResponse());
      }

      return reply.code(result.kind === 'created' ? 201 : 200).send(result.entry);
    },
  );

  return server;
}
