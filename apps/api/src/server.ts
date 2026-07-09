import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  errorResponseSchema,
  healthResponseSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  type HealthResponse,
  type PatientSearchResponse,
} from '@yrese/contracts';
import {
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  permissionScope,
  type PharmacyId,
  type TenantId,
} from '@yrese/shared-kernel';

import { requirePermission, tenantContextPlugin } from './plugins/tenant-context.js';
import { InMemoryPatientRepository, type PatientRepository, type PatientSearchCursor } from './patient-repository.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';
export const patientSearchInvalidQueryErrorCode = PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;

export interface BuildServerOptions {
  readonly patientRepository?: PatientRepository;
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

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const patientRepository = options.patientRepository ?? new InMemoryPatientRepository();
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
    async (request) => {
      const tenantContext = request.tenantContext;
      if (tenantContext === undefined) {
        throw new Error('tenantContext is unexpectedly missing after authorization');
      }

      return {
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        actorId: tenantContext.actorId,
        scopes: tenantContext.scopes,
      };
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

  return server;
}
