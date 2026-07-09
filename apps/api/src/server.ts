import Fastify, { type FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '@yrese/contracts';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: false,
  });

  server.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: new Date().toISOString(),
    });
  });

  return server;
}
