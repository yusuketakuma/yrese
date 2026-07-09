import Fastify, { type FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '@yrese/contracts';
import { permissionScope } from '@yrese/shared-kernel';

import { requirePermission, tenantContextPlugin } from './plugins/tenant-context.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: false,
  });

  server.register(tenantContextPlugin);

  server.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: new Date().toISOString(),
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

  return server;
}
