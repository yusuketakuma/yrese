import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

export const apiVersion = '0.0.1';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

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
