import { describe, expect, it } from 'vitest';

import {
  apiVersion,
  buildServer,
  patientSearchInvalidQueryErrorCode,
  type HealthResponse,
} from './server.js';

const tenantOnePatientReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'patient:read',
} as const;

const tenantTwoPatientReadHeaders = {
  'x-dev-tenant': 'tenant-002',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-002',
  'x-dev-scopes': 'patient:read',
} as const;

const otherPharmacyPatientReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-002',
  'x-dev-actor': 'user-003',
  'x-dev-scopes': 'patient:read',
} as const;

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

  it('denies /whoami when dev tenant context headers are absent', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('denies /whoami when tenant scope is missing', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'claim:read',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('denies /whoami when tenant scope has extra malformed segments', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'tenant:read:extra',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('returns dev tenant context from /whoami when tenant read scope is present', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'tenant:read,claim:read,not-a-scope',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
      actorId: 'user-001',
      scopes: ['tenant:read', 'claim:read'],
    });
  });

  it('throws during plugin registration in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const server = buildServer();

    try {
      await expect(server.ready()).rejects.toThrow(/BLOCKED_SECURITY_REVIEW/);
      await server.close();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('denies /patients/search when dev tenant context headers are absent', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成',
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('denies /patients/search when patient read scope is missing', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'tenant:read',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it.each([
    ['/patients/search', 'missing q'],
    ['/patients/search?q=', 'blank q'],
    ['/patients/search?q=%20%20%20', 'whitespace q'],
    [`/patients/search?q=${'x'.repeat(101)}`, 'q too long'],
    ['/patients/search?q=合成&limit=0', 'limit too low'],
    ['/patients/search?q=合成&limit=51', 'limit too high'],
    ['/patients/search?q=合成&cursor=not-a-cursor', 'malformed cursor'],
  ])('returns PAT-0001 for invalid patient search query: %s (%s)', async (url) => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('returns patient search results with no-store and supports second-page cursor pagination', async () => {
    const server = buildServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });

    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.headers['cache-control']).toBe('no-store');
    const firstBody = firstPage.json();
    expect(firstBody.results).toHaveLength(3);
    expect(firstBody.results.map((result: { patientId: string }) => result.patientId)).toEqual([
      'patient-syn-001',
      'patient-syn-002',
      'patient-syn-003',
    ]);
    expect(typeof firstBody.nextCursor).toBe('string');

    const secondPage = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.headers['cache-control']).toBe('no-store');
    const secondBody = secondPage.json();
    expect(secondBody.results.map((result: { patientId: string }) => result.patientId)).toEqual([
      'patient-syn-004',
      'patient-syn-005',
      'patient-syn-006',
    ]);
    expect(typeof secondBody.nextCursor).toBe('string');
  });

  it('rejects cursor reuse across tenant boundaries', async () => {
    const server = buildServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const crossTenant = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: tenantTwoPatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(crossTenant.statusCode).toBe(400);
    expect(crossTenant.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse across pharmacy boundaries', async () => {
    const server = buildServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const crossPharmacy = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: otherPharmacyPatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(crossPharmacy.statusCode).toBe(400);
    expect(crossPharmacy.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse with a different query', async () => {
    const server = buildServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const differentQuery = await server.inject({
      method: 'GET',
      url: `/patients/search?q=SYN&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(differentQuery.statusCode).toBe(400);
    expect(differentQuery.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });
});
