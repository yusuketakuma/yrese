import { createHash } from 'node:crypto';
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
  type PharmacyId,
  type TenantId,
} from '@yrese/shared-kernel';

import { requirePermission, tenantContextPlugin } from './plugins/tenant-context.js';
import { InMemoryPatientRepository, type PatientRepository, type PatientSearchCursor } from './patient-repository.js';
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
}

interface EncodedPatientSearchCursor {
  readonly t: string;
  readonly p: string;
  readonly qh: string;
  readonly offset: number;
}

function queryHash(q: string): string {
  return createHash('sha256').update(q).digest('hex');
}

function encodePatientSearchCursor(input: {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
  readonly cursor: PatientSearchCursor;
}): string {
  const cursor: EncodedPatientSearchCursor = {
    t: input.tenantId,
    p: input.pharmacyId,
    qh: queryHash(input.q),
    offset: input.cursor.offset,
  };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function isEncodedPatientSearchCursor(value: unknown): value is EncodedPatientSearchCursor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const cursor = value as Partial<EncodedPatientSearchCursor>;
  const offset = cursor.offset;
  return (
    typeof cursor.t === 'string' &&
    typeof cursor.p === 'string' &&
    typeof cursor.qh === 'string' &&
    /^[a-f0-9]{64}$/.test(cursor.qh) &&
    Number.isSafeInteger(offset) &&
    offset !== undefined &&
    offset >= 0
  );
}

function decodePatientSearchCursor(input: {
  readonly value: string;
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
}): PatientSearchCursor | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input.value, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }

  if (!isEncodedPatientSearchCursor(parsed)) {
    return undefined;
  }

  if (parsed.t !== input.tenantId || parsed.p !== input.pharmacyId || parsed.qh !== queryHash(input.q)) {
    return undefined;
  }

  return { offset: parsed.offset };
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
  const patientRepository = options.patientRepository ?? new InMemoryPatientRepository();
  const receptionRepository = options.receptionRepository ?? new InMemoryReceptionRepository();
  const now = options.now ?? (() => new Date());
  const server = Fastify({
    logger: false,
  });

  server.register(tenantContextPlugin);

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
          : decodePatientSearchCursor({
              value: query.data.cursor,
              tenantId: tenantContext.tenantId,
              pharmacyId: tenantContext.pharmacyId,
              q: query.data.q,
            });

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
              nextCursor: encodePatientSearchCursor({
                tenantId: tenantContext.tenantId,
                pharmacyId: tenantContext.pharmacyId,
                q: query.data.q,
                cursor: page.nextCursor,
              }),
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
