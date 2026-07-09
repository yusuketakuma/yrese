import { describe, expect, it } from 'vitest';

import { apiVersion, buildServer, type HealthResponse } from './server.js';

describe('buildServer', () => {
  it('returns health status without PHI or database dependencies', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    await server.close();

    expect(response.statusCode).toBe(200);

    const body = response.json<HealthResponse>();

    expect(body).toMatchObject({
      status: 'ok',
      service: 'api',
      version: apiVersion,
    });
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });
});
