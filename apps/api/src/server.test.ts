import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PATIENT_SEARCH_CURSOR_MAX_LENGTH } from '@yrese/contracts';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
} from './config.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import type { PatientRepository } from './patient-repository.js';
import type { ReceptionRepository } from './reception-repository.js';
import type { AuditRepository } from './audit-repository.js';
import {
  apiVersion,
  buildServer,
  patientSearchInvalidQueryErrorCode,
  patientSearchCursorProgressInvariantErrorMessage,
  patientSearchDuplicateIdentityInvariantErrorMessage,
  patientSearchResultLimitInvariantErrorMessage,
  receptionIdempotencyConflictErrorCode,
  receptionInvalidRequestErrorCode,
  receptionPatientIdentityMismatchErrorMessage,
  receptionQueueDuplicateIdentityInvariantErrorMessage,
  receptionCreatedStatusInvariantErrorMessage,
  receptionResultPatientIdentityMismatchErrorMessage,
  receptionResultSchemaInvariantErrorMessage,
  receptionPatientNotFoundErrorCode,
  type BuildServerOptions,
  type HealthResponse,
} from './server.js';

function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

function buildDefaultTestServer(options: BuildServerOptions = {}) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
  });
}

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

const devUiPatientReadHeaders = {
  'x-dev-tenant': 't-dev',
  'x-dev-pharmacy': 'ph-dev',
  'x-dev-actor': 'u-dev',
  'x-dev-scopes': 'patient:read',
} as const;

const tenantOneTenantReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'tenant:read',
} as const;

const tenantOneReceptionReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'reception:read,patient:read',
} as const;

const tenantOneReceptionWriteHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'reception:write,patient:read',
} as const;

const malformedDevIdHeaderCases = [
  ['x-dev-tenant', '   ', 'blank tenant id'],
  ['x-dev-pharmacy', 'pharmacy-001\t', 'control-character pharmacy id'],
  ['x-dev-actor', 'user-001\t', 'control-character actor id'],
] as const;

const sensitiveRouteCases = [
  ['GET', '/patients/search?q=synthetic', 'patient search'],
  ['GET', '/patients/patient-syn-001', 'patient get'],
  ['GET', '/reception/queue?date=2026-07-10', 'reception queue'],
  ['POST', '/reception', 'reception create'],
  ['GET', '/audit/events', 'audit events'],
] as const;

describe('buildServer', () => {
  it('returns health status without PHI or database dependencies', async () => {
    const healthTimestamp = new Date('2026-07-09T10:20:00.000Z');
    const server = buildDefaultTestServer({
      now: () => healthTimestamp,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBeUndefined();

    const body = response.json<HealthResponse>();

    expect(body).toMatchObject({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: healthTimestamp.toISOString(),
    });
  });

  it('denies /whoami when dev tenant context headers are absent', async () => {
    const server = buildDefaultTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it.each(sensitiveRouteCases)(
    'sets no-store before missing tenant context is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDefaultTestServer();

      const response = await server.inject({ method, url });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it.each(sensitiveRouteCases)(
    'sets no-store before insufficient scope is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method,
        url,
        headers: tenantOneTenantReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it.each(sensitiveRouteCases)(
    'sets no-store before malformed tenant context is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method,
        url,
        headers: { ...tenantOnePatientReadHeaders, 'x-dev-tenant': '   ' },
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it('ignores attacker-controlled dev headers by default before protected repositories run', async () => {
    const patientSearch = vi.fn<PatientRepository['search']>(async () => ({ results: [] }));
    const patientFindById = vi.fn<PatientRepository['findById']>(async () => undefined);
    const receptionList = vi.fn<ReceptionRepository['list']>(async () => []);
    const receptionCreate = vi.fn<ReceptionRepository['create']>(async () => {
      throw new Error('repository must not run without an authenticated tenant context');
    });
    const server = buildDefaultTestServer({
      patientRepository: { search: patientSearch, findById: patientFindById },
      receptionRepository: { list: receptionList, create: receptionCreate },
    });
    const attackerHeaders = {
      'x-dev-tenant': 'attacker-selected-tenant',
      'x-dev-pharmacy': 'attacker-selected-pharmacy',
      'x-dev-actor': 'attacker-selected-actor',
      'x-dev-scopes': 'patient:read,reception:read,reception:write',
    } as const;

    const patientResponse = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic',
      headers: attackerHeaders,
    });
    const queueResponse = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-10',
      headers: attackerHeaders,
    });
    const createResponse = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: attackerHeaders,
      payload: {
        patientId: 'patient-attacker-selected',
        idempotencyKey: 'attacker-selected-key',
      },
    });

    await server.close();

    for (const response of [patientResponse, queueResponse, createResponse]) {
      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({
        errorCode: 'AUTH-0003',
        message: 'Forbidden',
      });
    }
    expect(patientSearch).not.toHaveBeenCalled();
    expect(patientFindById).not.toHaveBeenCalled();
    expect(receptionList).not.toHaveBeenCalled();
    expect(receptionCreate).not.toHaveBeenCalled();
  });

  it('denies /whoami when tenant scope is missing', async () => {
    const server = buildDevTestServer();

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
    const server = buildDevTestServer();

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

  it.each(malformedDevIdHeaderCases)(
    'denies /whoami when %s is malformed: %s',
    async (headerName, invalidValue) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method: 'GET',
        url: '/whoami',
        headers: {
          ...tenantOneTenantReadHeaders,
          [headerName]: invalidValue,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        errorCode: 'AUTH-0003',
        message: 'Forbidden',
      });
    },
  );

  it('returns dev tenant context from /whoami when tenant read scope is present', async () => {
    const server = buildDevTestServer();

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

  it('rejects dev headers unless in-memory repository mode is explicit before server construction', () => {
    expect(() => buildServer({ tenantContextMode: 'dev_headers' })).toThrowError(
      new Error(devTenantContextConfigurationErrorMessage),
    );
    expect(() =>
      buildServer({ repositoryMode: 'postgres', tenantContextMode: 'dev_headers' }),
    ).toThrowError(new Error(devTenantContextConfigurationErrorMessage));
  });

  it('requires an injected cursor codec for every repository mode', async () => {
    expect(() => buildServer()).toThrowError(
      new Error(patientSearchCursorHmacConfigurationErrorMessage),
    );
    expect(() =>
      buildServer({
        repositoryMode: 'in_memory',
        tenantContextMode: 'dev_headers',
      }),
    ).toThrowError(new Error(patientSearchCursorHmacConfigurationErrorMessage));
    expect(() => buildServer({ repositoryMode: 'postgres' })).toThrowError(
      new Error(patientSearchCursorHmacConfigurationErrorMessage),
    );

    const inMemoryServer = buildServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(
        randomBytes(patientSearchCursorHmacKeyByteLength),
      ),
      repositoryMode: 'in_memory',
      tenantContextMode: 'dev_headers',
    });
    await inMemoryServer.close();
  });

  it('denies /patients/search when dev tenant context headers are absent', async () => {
    const server = buildDefaultTestServer();

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
    const server = buildDevTestServer();

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

  it.each(malformedDevIdHeaderCases)(
    'denies /patients/search when %s is malformed: %s',
    async (headerName, invalidValue) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=合成',
        headers: {
          ...tenantOnePatientReadHeaders,
          [headerName]: invalidValue,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        errorCode: 'AUTH-0003',
        message: 'Forbidden',
      });
    },
  );

  it('returns synthetic patients for the default development UI tenant headers', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成',
      headers: devUiPatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json();
    expect(body.results.map((result: { patientId: string }) => result.patientId)).toEqual([
      'patient-dev-001',
      'patient-dev-002',
    ]);
    expect(body.nextCursor).toBeUndefined();
  });

  it.each([
    ['/patients/search', 'missing q'],
    ['/patients/search?q=', 'blank q'],
    ['/patients/search?q=%20%20%20', 'whitespace q'],
    [`/patients/search?q=${'x'.repeat(101)}`, 'q too long'],
    ['/patients/search?q=合成&limit=0', 'limit too low'],
    ['/patients/search?q=合成&limit=51', 'limit too high'],
    ['/patients/search?q=合成&cursor=not-a-cursor', 'malformed cursor'],
    [`/patients/search?q=合成&cursor=${'x'.repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH + 1)}`, 'cursor too long'],
  ])('returns PAT-0001 for invalid patient search query: %s (%s)', async (url) => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('returns patient search results with no-store and supports second-page cursor pagination', async () => {
    const server = buildDevTestServer();

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

  it.each([1, 50])(
    'fails closed without encoding a cursor when repository results exceed limit=%s',
    async (limit) => {
      const syntheticPatients = Array.from({ length: limit + 1 }, (_, index) => ({
        patientId: `patient-over-limit-${String(index).padStart(3, '0')}`,
        name: `合成超過患者${index}`,
        kana: `ゴウセイチョウカカンジャ${index}`,
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: `OVER-LIMIT-${String(index).padStart(3, '0')}`,
        eligibilityStatus: 'NOT_CHECKED' as const,
      }));
      const search = vi.fn<PatientRepository['search']>(async () => ({
        results: syntheticPatients,
        nextCursor: { offset: limit + 1 },
      }));
      const encode = vi.fn(() => {
        throw new Error('cursor encoding must not run for an over-limit page');
      });
      const server = buildDevTestServer({
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
        patientSearchCursorCodec: {
          encode,
          decode: vi.fn(() => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/search?q=synthetic&limit=${limit}`,
        headers: tenantOnePatientReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(search).toHaveBeenCalledOnce();
      expect(search).toHaveBeenCalledWith({
        tenantId: tenantOnePatientReadHeaders['x-dev-tenant'],
        pharmacyId: tenantOnePatientReadHeaders['x-dev-pharmacy'],
        q: 'synthetic',
        limit,
      });
      expect(encode).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: patientSearchResultLimitInvariantErrorMessage,
      });
      for (const result of syntheticPatients) {
        for (const sensitiveValue of [
          result.patientId,
          result.name,
          result.kana,
          result.patientNumber,
          result.birthDate,
          result.eligibilityStatus,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it.each([
    ['identical', false],
    ['conflicting', true],
  ] as const)(
    'rejects %s duplicate patient identities without issuing a cursor',
    async (_label, conflicting) => {
      const duplicatePatientId = 'patient-duplicate-sensitive';
      const first = {
        patientId: duplicatePatientId,
        name: '合成 重複患者A',
        kana: 'ゴウセイ ジュウフクカンジャエー',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'DUPLICATE-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      };
      const second = conflicting
        ? {
            ...first,
            name: '合成 矛盾患者B',
            kana: 'ゴウセイ ムジュンカンジャビー',
            birthDate: '1985-12-31',
            patientNumber: 'DUPLICATE-999',
            eligibilityStatus: 'VERIFIED' as const,
          }
        : { ...first };
      const encode = vi.fn(() => {
        throw new Error('cursor encoding must not run for duplicate patient identities');
      });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn(async () => ({
            results: [first, second],
            nextCursor: { offset: 2 },
          })),
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
        patientSearchCursorCodec: {
          encode,
          decode: vi.fn(() => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic&limit=2',
        headers: tenantOnePatientReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(encode).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: patientSearchDuplicateIdentityInvariantErrorMessage,
      });
      for (const result of [first, second]) {
        for (const sensitiveValue of [
          result.patientId,
          result.name,
          result.kana,
          result.birthDate,
          result.patientNumber,
          result.eligibilityStatus,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it.each([
    ['initial empty page repeats offset zero', undefined, 0, 0],
    ['continued page repeats the requested offset', 2, 1, 2],
    ['continued page moves backwards', 2, 1, 1],
    ['continued page skips a patient position', 2, 1, 4],
    ['continued page overflows the safe offset range', Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER],
  ] as const)(
    'rejects a repository next cursor that %s',
    async (_label, requestedOffset, resultCount, returnedOffset) => {
      const results = Array.from({ length: resultCount }, (_, index) => ({
        patientId: `patient-cursor-sensitive-${index}`,
        name: `合成カーソル患者${index}`,
        kana: `ゴウセイカーソルカンジャ${index}`,
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: `CURSOR-SENSITIVE-${index}`,
        eligibilityStatus: 'NOT_CHECKED' as const,
      }));
      const search = vi.fn<PatientRepository['search']>(async () => ({
        results,
        nextCursor: { offset: returnedOffset },
      }));
      const encode = vi.fn(() => {
        throw new Error('cursor encoding must not run for an invalid repository cursor');
      });
      const rawCursor = 'opaque-sensitive-cursor';
      const decode = vi.fn(() =>
        requestedOffset === undefined ? undefined : { offset: requestedOffset },
      );
      const server = buildDevTestServer({
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
        patientSearchCursorCodec: { encode, decode },
      });

      const response = await server.inject({
        method: 'GET',
        url:
          requestedOffset === undefined
            ? '/patients/search?q=synthetic&limit=2'
            : `/patients/search?q=synthetic&limit=2&cursor=${rawCursor}`,
        headers: tenantOnePatientReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(search).toHaveBeenCalledWith({
        tenantId: tenantOnePatientReadHeaders['x-dev-tenant'],
        pharmacyId: tenantOnePatientReadHeaders['x-dev-pharmacy'],
        q: 'synthetic',
        limit: 2,
        ...(requestedOffset === undefined ? {} : { cursor: { offset: requestedOffset } }),
      });
      expect(encode).not.toHaveBeenCalled();
      expect(response.json()).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: patientSearchCursorProgressInvariantErrorMessage,
      });
      expect(response.body).not.toContain(rawCursor);
      for (const result of results) {
        for (const sensitiveValue of [
          result.patientId,
          result.name,
          result.kana,
          result.birthDate,
          result.patientNumber,
          result.eligibilityStatus,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it('allows a repository cursor at the exact next consumed offset', async () => {
    const result = {
      patientId: 'patient-cursor-valid-001',
      name: '合成カーソル正常患者',
      kana: 'ゴウセイカーソルセイジョウカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'CURSOR-VALID-001',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const encode = vi.fn(() => 'signed-next-cursor');
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn(async () => ({
          results: [result],
          nextCursor: { offset: 3 },
        })),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: {
        encode,
        decode: vi.fn(() => ({ offset: 2 })),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=2&cursor=current-cursor',
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [result],
      nextCursor: 'signed-next-cursor',
    });
    expect(encode).toHaveBeenCalledWith(
      {
        tenantId: tenantOnePatientReadHeaders['x-dev-tenant'],
        pharmacyId: tenantOnePatientReadHeaders['x-dev-pharmacy'],
        q: 'synthetic',
      },
      { offset: 3 },
    );
  });

  it('allows distinct patient identities with the same display attributes', async () => {
    const sharedDisplay = {
      name: '合成 同姓同名',
      kana: 'ゴウセイ ドウセイドウメイ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'SHARED-DISPLAY',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const results = [
      { patientId: 'patient-distinct-001', ...sharedDisplay },
      { patientId: 'patient-distinct-002', ...sharedDisplay },
    ];
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn(async () => ({ results })),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=2',
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().results).toEqual(results);
  });

  it('keeps cursor scope/query opaque and rejects an authenticated offset mutation', async () => {
    const cursorKey = randomBytes(patientSearchCursorHmacKeyByteLength);
    const server = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(cursorKey),
    });
    const query = '合成';
    const firstPage = await server.inject({
      method: 'GET',
      url: `/patients/search?q=${encodeURIComponent(query)}&limit=1`,
      headers: tenantOnePatientReadHeaders,
    });
    const cursor = firstPage.json().nextCursor as string;
    const tokenBody = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;

    expect(Object.keys(tokenBody)).toEqual(['v', 'o', 'm']);
    const serializedBody = JSON.stringify(tokenBody);
    expect(serializedBody).not.toContain(query);
    expect(serializedBody).not.toContain(tenantOnePatientReadHeaders['x-dev-tenant']);
    expect(serializedBody).not.toContain(tenantOnePatientReadHeaders['x-dev-pharmacy']);
    expect(serializedBody).not.toContain(createHash('sha256').update(query).digest('hex'));

    const tamperedCursor = Buffer.from(
      JSON.stringify({ v: tokenBody.v, o: 999, m: tokenBody.m }),
      'utf8',
    ).toString('base64url');
    const tampered = await server.inject({
      method: 'GET',
      url: `/patients/search?q=${encodeURIComponent(query)}&limit=1&cursor=${encodeURIComponent(tamperedCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(tampered.statusCode).toBe(400);
    expect(tampered.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('accepts a cursor across servers with the same key and rejects it with a different key', async () => {
    const sharedKey = randomBytes(patientSearchCursorHmacKeyByteLength);
    const issuer = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(sharedKey),
    });
    const sameKeyVerifier = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(sharedKey),
    });
    const differentKeyVerifier = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(
        randomBytes(patientSearchCursorHmacKeyByteLength),
      ),
    });
    const firstPage = await issuer.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const cursor = firstPage.json().nextCursor as string;

    const sameKeyPage = await sameKeyVerifier.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(cursor)}`,
      headers: tenantOnePatientReadHeaders,
    });
    const differentKeyPage = await differentKeyVerifier.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(cursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await Promise.all([issuer.close(), sameKeyVerifier.close(), differentKeyVerifier.close()]);

    expect(firstPage.statusCode).toBe(200);
    expect(sameKeyPage.statusCode).toBe(200);
    expect(
      sameKeyPage.json().results.map((result: { patientId: string }) => result.patientId),
    ).toEqual(['patient-syn-004', 'patient-syn-005', 'patient-syn-006']);
    expect(differentKeyPage.statusCode).toBe(400);
    expect(differentKeyPage.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects the legacy unsigned patient search cursor without downgrade decoding', async () => {
    const server = buildDevTestServer();
    const legacyCursor = Buffer.from(
      JSON.stringify({
        t: 'tenant-001',
        p: 'pharmacy-001',
        qh: createHash('sha256').update('合成').digest('hex'),
        offset: 1,
      }),
      'utf8',
    ).toString('base64url');

    const response = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=1&cursor=${encodeURIComponent(legacyCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse across tenant boundaries', async () => {
    const server = buildDevTestServer();

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
    const server = buildDevTestServer();

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
    const server = buildDevTestServer();

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

  it('returns the reception queue in acceptedAt and receptionId stable order', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json();
    expect(body.date).toBe('2026-07-09');
    expect(body.entries.map((entry: { receptionId: string }) => entry.receptionId)).toEqual([
      'reception-syn-001',
      'reception-syn-002',
      'reception-syn-003',
    ]);
  });

  it.each([
    ['identical', false],
    ['conflicting', true],
  ] as const)(
    'rejects %s duplicate reception identities without returning a partial queue',
    async (_label, conflicting) => {
      const duplicateReceptionId = 'reception-duplicate-sensitive';
      const first = {
        receptionId: duplicateReceptionId,
        acceptedAt: '2026-07-09T00:15:00.000Z',
        receptionStatus: 'WAITING' as const,
        prescriptionIntakeType: 'paper' as const,
        patient: {
          patientId: 'patient-reception-duplicate-a',
          name: '合成 重複受付A',
          kana: 'ゴウセイ ジュウフクウケツケエー',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: 'RECEPTION-DUPLICATE-001',
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
      };
      const second = conflicting
        ? {
            ...first,
            acceptedAt: '2026-07-09T01:15:00.000Z',
            receptionStatus: 'IN_PROGRESS' as const,
            patient: {
              ...first.patient,
              patientId: 'patient-reception-duplicate-b',
              name: '合成 矛盾受付B',
              kana: 'ゴウセイ ムジュンウケツケビー',
              patientNumber: 'RECEPTION-DUPLICATE-999',
            },
          }
        : { ...first, patient: { ...first.patient } };
      const list = vi.fn<ReceptionRepository['list']>(async () => [first, second]);
      const server = buildDevTestServer({
        receptionRepository: {
          list,
          create: vi.fn<ReceptionRepository['create']>(),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/reception/queue?date=2026-07-09',
        headers: tenantOneReceptionReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(list).toHaveBeenCalledOnce();
      expect(list).toHaveBeenCalledWith({
        tenantId: tenantOneReceptionReadHeaders['x-dev-tenant'],
        pharmacyId: tenantOneReceptionReadHeaders['x-dev-pharmacy'],
        date: '2026-07-09',
      });
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionQueueDuplicateIdentityInvariantErrorMessage,
      });
      for (const queueEntry of [first, second]) {
        for (const sensitiveValue of [
          queueEntry.receptionId,
          queueEntry.acceptedAt,
          queueEntry.receptionStatus,
          queueEntry.patient.patientId,
          queueEntry.patient.name,
          queueEntry.patient.kana,
          queueEntry.patient.patientNumber,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it('denies /reception/queue when patient read scope is missing', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: {
        ...tenantOneReceptionReadHeaders,
        'x-dev-scopes': 'reception:read',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('returns RCV-0001 for invalid reception queue dates', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-02-31',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: receptionInvalidRequestErrorCode,
      message: 'Invalid reception request',
    });
  });

  it('creates a reception entry with patient summary and no-store response', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const server = buildDevTestServer({
      now: () => acceptedAt,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-create-001',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      receptionId: 'reception-000004',
      acceptedAt: acceptedAt.toISOString(),
      receptionStatus: 'WAITING',
      prescriptionIntakeType: 'paper',
      patient: {
        patientId: 'patient-syn-004',
      },
    });
  });

  it('fails closed before reception creation when scoped patient lookup returns another identity', async () => {
    const requestedPatientId = 'patient-requested-synthetic-001';
    const mismatchedPatientId = 'patient-other-synthetic-999';
    const mismatchedName = '合成別患者氏名';
    const mismatchedKana = 'ゴウセイベツカンジャシメイ';
    const receptionCreate = vi.fn<ReceptionRepository['create']>();
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(async () => ({
          patientId: mismatchedPatientId,
          name: mismatchedName,
          kana: mismatchedKana,
          birthDate: '1990-01-01',
          sex: 'unknown',
          patientNumber: 'SYN-MISMATCH-999',
          eligibilityStatus: 'NOT_CHECKED',
        })),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: requestedPatientId,
        idempotencyKey: 'reception-mismatched-patient-identity',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(receptionCreate).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionPatientIdentityMismatchErrorMessage,
    });
    for (const sensitiveValue of [
      requestedPatientId,
      mismatchedPatientId,
      mismatchedName,
      mismatchedKana,
      'SYN-MISMATCH-999',
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it.each(['created', 'existing'] as const)(
    'fails closed before audit and response when a %s reception result belongs to another patient',
    async (resultKind) => {
      const requestedPatientId = 'patient-syn-004';
      const mismatchedPatientId = 'patient-other-synthetic-999';
      const mismatchedName = '合成別患者氏名';
      const mismatchedKana = 'ゴウセイベツカンジャシメイ';
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async () => ({
            kind: resultKind,
            entry: {
              receptionId: 'reception-mismatched-result-999',
              acceptedAt: '2026-07-09T09:00:00.000Z',
              receptionStatus: 'WAITING',
              prescriptionIntakeType: 'paper',
              patient: {
                patientId: mismatchedPatientId,
                name: mismatchedName,
                kana: mismatchedKana,
                birthDate: '1990-01-01',
                sex: 'unknown',
                patientNumber: 'SYN-MISMATCH-999',
                eligibilityStatus: 'NOT_CHECKED',
              },
            },
          })),
        },
        auditRepository: {
          record: auditRecord,
          list: vi.fn<AuditRepository['list']>(async () => []),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: {
          patientId: requestedPatientId,
          idempotencyKey: `reception-mismatched-result-${resultKind}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionResultPatientIdentityMismatchErrorMessage,
      });
      for (const sensitiveValue of [
        requestedPatientId,
        mismatchedPatientId,
        mismatchedName,
        mismatchedKana,
        'SYN-MISMATCH-999',
        'reception-mismatched-result-999',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each(['created', 'existing'] as const)(
    'rejects a schema-invalid %s reception result before audit and response',
    async (resultKind) => {
      const auditRecord = vi.fn<AuditRepository['record']>();
      const sensitiveEntry = {
        receptionId: 'reception-schema-sensitive',
        acceptedAt: 'invalid-sensitive-instant',
        receptionStatus: 'WAITING' as const,
        prescriptionIntakeType: 'paper' as const,
        patient: {
          patientId: 'patient-syn-004',
          name: '合成 検証患者',
          kana: 'ゴウセイ ケンショウカンジャ',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: 'SCHEMA-SENSITIVE-001',
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
      };
      const server = buildDevTestServer({
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async () => ({
            kind: resultKind,
            entry: sensitiveEntry,
          })),
        },
        auditRepository: {
          record: auditRecord,
          list: vi.fn<AuditRepository['list']>(async () => []),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: {
          patientId: 'patient-syn-004',
          idempotencyKey: `reception-schema-invalid-${resultKind}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionResultSchemaInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        sensitiveEntry.receptionId,
        sensitiveEntry.acceptedAt,
        sensitiveEntry.patient.patientId,
        sensitiveEntry.patient.name,
        sensitiveEntry.patient.kana,
        sensitiveEntry.patient.patientNumber,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects a newly created reception in %s before success audit',
    async (receptionStatus) => {
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async (_input) => ({
            kind: 'created',
            entry: {
              receptionId: 'reception-created-status-sensitive',
              acceptedAt: '2026-07-09T09:00:00.000Z',
              receptionStatus,
              prescriptionIntakeType: 'paper',
              patient: {
                patientId: 'patient-syn-004',
                name: '合成状態患者',
                kana: 'ゴウセイジョウタイカンジャ',
                birthDate: '1990-01-01',
                sex: 'unknown',
                patientNumber: 'STATUS-SENSITIVE-001',
                eligibilityStatus: 'NOT_CHECKED',
              },
            },
          })),
        },
        auditRepository: {
          record: auditRecord,
          list: vi.fn<AuditRepository['list']>(async () => []),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: {
          patientId: 'patient-syn-004',
          idempotencyKey: `reception-created-status-${receptionStatus}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionCreatedStatusInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        'reception-created-status-sensitive',
        'patient-syn-004',
        '合成状態患者',
        'ゴウセイジョウタイカンジャ',
        'STATUS-SENSITIVE-001',
        receptionStatus,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it('allows an existing reception to retain an advanced status without a duplicate audit', async () => {
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async () => ({
          kind: 'existing',
          entry: {
            receptionId: 'reception-existing-advanced',
            acceptedAt: '2026-07-09T09:00:00.000Z',
            receptionStatus: 'IN_PROGRESS',
            prescriptionIntakeType: 'paper',
            patient: {
              patientId: 'patient-syn-004',
              name: '合成既存患者',
              kana: 'ゴウセイキソンカンジャ',
              birthDate: '1990-01-01',
              sex: 'unknown',
              patientNumber: 'EXISTING-001',
              eligibilityStatus: 'NOT_CHECKED',
            },
          },
        })),
      },
      auditRepository: {
        record: auditRecord,
        list: vi.fn<AuditRepository['list']>(async () => []),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-existing-advanced',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ receptionStatus: 'IN_PROGRESS' });
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('stores reception queue dates as JST business dates, not UTC dates', async () => {
    const acceptedAt = new Date('2026-07-09T20:00:00.000Z'); // JST 2026-07-10 05:00
    const server = buildDevTestServer({
      now: () => acceptedAt,
    });

    const created = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-create-jst-date',
      },
    });
    const jstBusinessDateQueue = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-10',
      headers: tenantOneReceptionReadHeaders,
    });
    const utcDateQueue = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(created.statusCode).toBe(201);
    expect(jstBusinessDateQueue.statusCode).toBe(200);
    expect(
      jstBusinessDateQueue
        .json()
        .entries.map((entry: { readonly receptionId: string }) => entry.receptionId),
    ).toContain('reception-000004');
    expect(
      utcDateQueue.json().entries.map((entry: { readonly receptionId: string }) => entry.receptionId),
    ).not.toContain('reception-000004');
  });

  it('returns the existing entry for an idempotent reception resend', async () => {
    const acceptedAt = new Date('2026-07-09T09:05:00.000Z');
    const server = buildDevTestServer({
      now: () => acceptedAt,
    });
    const payload = {
      patientId: 'patient-syn-005',
      idempotencyKey: 'reception-create-002',
    };

    const created = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload,
    });
    const resent = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload,
    });

    await server.close();

    expect(created.statusCode).toBe(201);
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toEqual(created.json());
  });

  it('returns RCV-0003 when an idempotency key is reused with a different patient', async () => {
    const server = buildDevTestServer({
      now: () => new Date('2026-07-09T09:10:00.000Z'),
    });

    const created = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-006',
        idempotencyKey: 'reception-create-003',
      },
    });
    const conflict = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-007',
        idempotencyKey: 'reception-create-003',
      },
    });

    await server.close();

    expect(created.statusCode).toBe(201);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.headers['cache-control']).toBe('no-store');
    expect(conflict.json()).toEqual({
      errorCode: receptionIdempotencyConflictErrorCode,
      message: 'Reception idempotency conflict',
    });
  });

  it('returns RCV-0001 for invalid reception create requests', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-001',
        idempotencyKey: '   ',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: receptionInvalidRequestErrorCode,
      message: 'Invalid reception request',
    });
  });

  it('returns RCV-0002 when a reception patient is absent within the tenant and pharmacy', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-not-found',
        idempotencyKey: 'reception-create-004',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      errorCode: receptionPatientNotFoundErrorCode,
      message: 'Patient not found for reception',
    });
  });

  it('denies /reception when reception write scope is missing', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: {
        ...tenantOneReceptionWriteHeaders,
        'x-dev-scopes': 'patient:read',
      },
      payload: {
        patientId: 'patient-syn-001',
        idempotencyKey: 'reception-create-005',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });
});
