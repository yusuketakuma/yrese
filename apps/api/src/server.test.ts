import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createAuditEvent,
  type AuditEvent,
  type CreateAuditEventInput,
} from '@yrese/audit';
import {
  PATIENT_SEARCH_CURSOR_MAX_LENGTH,
  PATIENT_SEARCH_DEFAULT_LIMIT,
  type PatientSearchResult,
} from '@yrese/contracts';
import { patientId, pharmacyId, receptionId, tenantId, userId } from '@yrese/shared-kernel';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
} from './config.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
  type PatientSearchCursorCodec,
} from './patient-search-cursor.js';
import type { PatientRepository } from './patient-repository.js';
import type {
  ReceptionCreateInput,
  ReceptionCreateResult,
  ReceptionRepository,
} from './reception-repository.js';
import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
import {
  apiVersion,
  buildServer,
  patientSearchInvalidQueryErrorCode,
  patientSearchRepositoryErrorMessage,
  patientSearchPageSchemaInvariantErrorMessage,
  patientSearchCursorDecodeErrorMessage,
  patientSearchCursorEncodeErrorMessage,
  patientSearchDecodedCursorInvariantErrorMessage,
  patientSearchEncodedCursorInvariantErrorMessage,
  patientSearchCursorProgressInvariantErrorMessage,
  patientSearchDuplicateIdentityInvariantErrorMessage,
  patientSearchResultLimitInvariantErrorMessage,
  patientLookupRepositoryErrorMessage,
  receptionIdempotencyConflictErrorCode,
  receptionInvalidRequestErrorCode,
  receptionPatientIdentityMismatchErrorMessage,
  receptionPatientSchemaInvariantErrorMessage,
  receptionQueueBusinessDateInvariantErrorMessage,
  receptionQueueDuplicateIdentityInvariantErrorMessage,
  receptionQueueRepositoryErrorMessage,
  receptionQueueSchemaInvariantErrorMessage,
  receptionCreateRepositoryErrorMessage,
  receptionCreatedPatientSnapshotMismatchErrorMessage,
  receptionCreatedStatusInvariantErrorMessage,
  receptionCreatedAcceptedAtInvariantErrorMessage,
  receptionCreatedAuditInvariantErrorMessage,
  receptionResultPatientIdentityMismatchErrorMessage,
  receptionResultIdempotencyProvenanceMismatchErrorMessage,
  receptionResultKindInvariantErrorMessage,
  receptionResultSchemaInvariantErrorMessage,
  receptionPatientNotFoundErrorCode,
  type BuildServerOptions,
  type HealthResponse,
} from './server.js';

function receptionProvenance(
  input: ReceptionCreateInput,
  receptionIdentity: string,
  patientIdentity: string = input.patient.patientId,
) {
  return {
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    idempotencyKey: input.idempotencyKey,
    receptionId: receptionId(receptionIdentity),
    patientId: patientId(patientIdentity),
  };
}

function rebuildAuditEvent(
  event: AuditEvent,
  overrides: Partial<CreateAuditEventInput>,
): AuditEvent {
  const { entryHash: _entryHash, ...input } = event;
  return createAuditEvent({ ...input, ...overrides });
}

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

  it.each([
    ['Error', (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => new Error(rawSentinel)],
    ['non-Error string', (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => rawSentinel],
    [
      'non-Error object',
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
      }),
    ],
    [
      'hostile Proxy',
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a patient search cursor decode throw from %s',
    async (_label, createThrownValue) => {
      const query = '合成decode秘密4208';
      const rawCursor = 'opaque-decode-secret-4208';
      const rawSentinel = `raw decode failure ${query} ${rawCursor}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const thrownValue = createThrownValue(rawSentinel, propertyRead);
      const decode = vi.fn<PatientSearchCursorCodec['decode']>(() => {
        throw thrownValue;
      });
      const search = vi.fn<PatientRepository['search']>();
      const encode = vi.fn<PatientSearchCursorCodec['encode']>();
      const server = buildDevTestServer({
        patientSearchCursorCodec: { decode, encode },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/search?q=${encodeURIComponent(query)}&cursor=${rawCursor}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: patientSearchCursorDecodeErrorMessage });
      expect(decode).toHaveBeenCalledOnce();
      expect(search).not.toHaveBeenCalled();
      expect(encode).not.toHaveBeenCalled();
      expect(propertyRead).not.toHaveBeenCalled();
      for (const sensitiveValue of [query, rawCursor, rawSentinel]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it('keeps an undefined decoded cursor as PAT-0001 without repository access', async () => {
    const rawCursor = 'opaque-invalid-cursor-4208';
    const decode = vi.fn<PatientSearchCursorCodec['decode']>(() => undefined);
    const search = vi.fn<PatientRepository['search']>();
    const encode = vi.fn<PatientSearchCursorCodec['encode']>();
    const server = buildDevTestServer({
      patientSearchCursorCodec: { decode, encode },
      patientRepository: {
        search,
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/patients/search?q=synthetic&cursor=${rawCursor}`,
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
    expect(decode).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
    expect(response.body).not.toContain(rawCursor);
  });

  it('does not invoke cursor decode when the search request has no cursor token', async () => {
    const decode = vi.fn<PatientSearchCursorCodec['decode']>(() => {
      throw new Error('cursor decode must not run without a token');
    });
    const search = vi.fn<PatientRepository['search']>(async () => ({ results: [] }));
    const server = buildDevTestServer({
      patientSearchCursorCodec: { decode, encode: vi.fn(() => 'unused') },
      patientRepository: {
        search,
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(decode).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledOnce();
    expect(search.mock.calls[0]?.[0]).not.toHaveProperty('cursor');
  });

  it.each([
    ['null root', null],
    ['array root', [{ offset: 2 }]],
    ['function root', Object.assign(() => undefined, { offset: 2 })],
    ['missing offset', {}],
    ['inherited offset', Object.create({ offset: 2 }) as object],
    [
      'non-enumerable offset',
      Object.defineProperty({}, 'offset', { enumerable: false, value: 2 }),
    ],
    ['string offset', { offset: '2' }],
    ['NaN offset', { offset: Number.NaN }],
    ['infinite offset', { offset: Number.POSITIVE_INFINITY }],
    ['negative offset', { offset: -1 }],
    ['fractional offset', { offset: 1.5 }],
    ['unsafe offset', { offset: Number.MAX_SAFE_INTEGER + 1 }],
  ] as const)(
    'rejects a decoded patient search cursor with %s as an internal invariant',
    async (_label, decodedCursor) => {
      const rawCursor = `opaque-invalid-decoded-${_label}-4208`;
      const search = vi.fn<PatientRepository['search']>();
      const encode = vi.fn<PatientSearchCursorCodec['encode']>();
      const server = buildDevTestServer({
        patientSearchCursorCodec: {
          decode: () => decodedCursor as never,
          encode,
        },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/search?q=synthetic&cursor=${encodeURIComponent(rawCursor)}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: patientSearchDecodedCursorInvariantErrorMessage,
      });
      expect(search).not.toHaveBeenCalled();
      expect(encode).not.toHaveBeenCalled();
      expect(response.body).not.toContain(rawCursor);
    },
  );

  it('rejects a decoded cursor offset accessor without invoking it', async () => {
    const rawSentinel = 'raw decoded cursor accessor secret 4208';
    const getter = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const decodedCursor = Object.defineProperty({}, 'offset', {
      enumerable: true,
      get: getter,
    });
    const search = vi.fn<PatientRepository['search']>();
    const encode = vi.fn<PatientSearchCursorCodec['encode']>();
    const server = buildDevTestServer({
      patientSearchCursorCodec: {
        decode: vi.fn(() => decodedCursor as never),
        encode,
      },
      patientRepository: {
        search,
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&cursor=opaque-accessor-4208',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: patientSearchDecodedCursorInvariantErrorMessage,
    });
    expect(getter).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
    expect(response.body).not.toContain(rawSentinel);
  });

  it.each(['throwing descriptor Proxy', 'revoked Proxy'] as const)(
    'normalizes a decoded cursor %s without raw trap reflection',
    async (variant) => {
      const rawSentinel = `raw decoded cursor ${variant} secret 4208`;
      const semanticRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      let decodedCursor: object;
      if (variant === 'revoked Proxy') {
        const revocable = Proxy.revocable({ offset: 2 }, {});
        decodedCursor = revocable.proxy;
        revocable.revoke();
      } else {
        decodedCursor = new Proxy(
          { offset: 2 },
          {
            get: semanticRead,
            has: semanticRead,
            getPrototypeOf: semanticRead,
            ownKeys: semanticRead,
            getOwnPropertyDescriptor: semanticRead,
          },
        );
      }
      const search = vi.fn<PatientRepository['search']>();
      const encode = vi.fn<PatientSearchCursorCodec['encode']>();
      const server = buildDevTestServer({
        patientSearchCursorCodec: {
          decode: () => decodedCursor as never,
          encode,
        },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic&cursor=opaque-proxy-4208',
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        message: patientSearchDecodedCursorInvariantErrorMessage,
      });
      expect(search).not.toHaveBeenCalled();
      expect(encode).not.toHaveBeenCalled();
      if (variant === 'throwing descriptor Proxy') {
        expect(semanticRead).toHaveBeenCalledOnce();
      } else {
        expect(semanticRead).not.toHaveBeenCalled();
      }
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain('Cannot perform');
    },
  );

  it('uses one captured decoded offset for repository input and cursor progress', async () => {
    const rawCursor = { offset: 2 };
    const directRead = vi.fn(() => {
      throw new Error('raw decoded cursor direct read secret 4208');
    });
    const descriptorRead = vi.fn(() => {
      const descriptor = Reflect.getOwnPropertyDescriptor(rawCursor, 'offset');
      rawCursor.offset = 100;
      return descriptor;
    });
    const decodedCursor = new Proxy(rawCursor, {
      get: directRead,
      has: directRead,
      getPrototypeOf: directRead,
      ownKeys: directRead,
      getOwnPropertyDescriptor(_target, property) {
        if (property === 'offset') return descriptorRead();
        return undefined;
      },
    });
    const result = {
      patientId: 'patient-decoded-cursor-4208',
      name: '合成decoded cursor患者',
      kana: 'ゴウセイデコードカーソルカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'DECODED-CURSOR-4208',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    let observedSearchCursor: unknown;
    const search = vi.fn<PatientRepository['search']>(async (input) => {
      observedSearchCursor = input.cursor;
      return { results: [result], nextCursor: { offset: 3 } };
    });
    let observedEncodedCursor: unknown;
    const encode = vi.fn<PatientSearchCursorCodec['encode']>((_binding, cursor) => {
      observedEncodedCursor = cursor;
      return 'encoded-next-cursor-4208';
    });
    const decodeCalls = vi.fn();
    const decode: PatientSearchCursorCodec['decode'] = (binding, token) => {
      decodeCalls();
      expect(Object.isFrozen(binding)).toBe(true);
      expect(token).toBe('opaque-valid-cursor-4208');
      return decodedCursor;
    };
    const server = buildDevTestServer({
      patientSearchCursorCodec: { decode, encode },
      patientRepository: {
        search,
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=2&cursor=opaque-valid-cursor-4208',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      results: [{ patientId: result.patientId }],
      nextCursor: 'encoded-next-cursor-4208',
    });
    expect(decodeCalls).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledOnce();
    expect(encode).toHaveBeenCalledOnce();
    expect(observedSearchCursor === decodedCursor).toBe(false);
    expect(observedSearchCursor).toEqual({ offset: 2 });
    expect(Object.isFrozen(observedSearchCursor)).toBe(true);
    expect(observedEncodedCursor).toEqual({ offset: 3 });
    expect(Object.isFrozen(observedEncodedCursor)).toBe(true);
    expect(descriptorRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
  });

  it.each([
    ['Error', (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => new Error(rawSentinel)],
    ['non-Error string', (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => rawSentinel],
    [
      'non-Error object',
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
      }),
    ],
    [
      'hostile Proxy',
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a patient search cursor encode throw from %s',
    async (_label, createThrownValue) => {
      const query = '合成encode秘密4209';
      const incomingCursor = 'opaque-current-cursor-4209';
      const patient = {
        patientId: 'patient-encode-secret-4209',
        name: '合成encode秘密患者',
        kana: 'ゴウセイエンコードヒミツカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'ENCODE-SECRET-4209',
        eligibilityStatus: 'NOT_CHECKED' as const,
      };
      const rawSentinel = `raw encode ${query} ${incomingCursor} ${patient.patientNumber}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const thrownValue = createThrownValue(rawSentinel, propertyRead);
      const encodeCalls = vi.fn();
      const encode: PatientSearchCursorCodec['encode'] = () => {
        encodeCalls();
        throw thrownValue;
      };
      const search = vi.fn<PatientRepository['search']>(async () => ({
        results: [patient],
        nextCursor: { offset: 3 },
      }));
      const server = buildDevTestServer({
        patientSearchCursorCodec: {
          decode: vi.fn(() => ({ offset: 2 })),
          encode,
        },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/search?q=${encodeURIComponent(query)}&cursor=${incomingCursor}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: patientSearchCursorEncodeErrorMessage });
      expect(search).toHaveBeenCalledOnce();
      expect(encodeCalls).toHaveBeenCalledOnce();
      expect(propertyRead).not.toHaveBeenCalled();
      for (const sensitiveValue of [
        query,
        incomingCursor,
        rawSentinel,
        patient.patientId,
        patient.name,
        patient.kana,
        patient.patientNumber,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['boolean', true],
    ['bigint', 1n],
    ['symbol', Symbol('encoded-cursor-4209')],
    ['function', () => 'encoded-cursor-4209'],
    ['array', ['encoded-cursor-4209']],
    ['object', { value: 'encoded-cursor-4209' }],
    ['boxed String', new String('encoded-cursor-4209')],
    ['Promise', Promise.resolve('encoded-cursor-4209')],
    ['empty string', ''],
    ['oversized string', 'x'.repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH + 1)],
  ] as const)(
    'rejects a patient search cursor encoder %s return value',
    async (_label, encodedValue) => {
      const encodeCalls = vi.fn();
      const encode: PatientSearchCursorCodec['encode'] = () => {
        encodeCalls();
        return encodedValue as never;
      };
      const search = vi.fn<PatientRepository['search']>(async () => ({
        results: [
          {
            patientId: 'patient-invalid-encoded-cursor-4209',
            name: '合成invalid encoded患者',
            kana: 'ゴウセイインバリッドエンコードカンジャ',
            birthDate: '1990-01-01',
            sex: 'unknown',
            patientNumber: 'INVALID-ENCODED-4209',
            eligibilityStatus: 'NOT_CHECKED',
          },
        ],
        nextCursor: { offset: 1 },
      }));
      const server = buildDevTestServer({
        patientSearchCursorCodec: { decode: vi.fn(() => undefined), encode },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic',
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: patientSearchEncodedCursorInvariantErrorMessage,
      });
      expect(search).toHaveBeenCalledOnce();
      expect(encodeCalls).toHaveBeenCalledOnce();
      expect(response.body).not.toContain('patient-invalid-encoded-cursor-4209');
      expect(response.body).not.toContain('INVALID-ENCODED-4209');
    },
  );

  it.each(['hostile Proxy', 'revoked Proxy'] as const)(
    'rejects a patient search cursor encoder %s return without inspecting it',
    async (variant) => {
      const rawSentinel = `raw encoded cursor ${variant} secret 4209`;
      const semanticRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      let encodedValue: object;
      if (variant === 'revoked Proxy') {
        const revocable = Proxy.revocable({}, {});
        encodedValue = revocable.proxy;
        revocable.revoke();
      } else {
        encodedValue = new Proxy(
          {},
          {
            get: semanticRead,
            has: semanticRead,
            getPrototypeOf: semanticRead,
            ownKeys: semanticRead,
            getOwnPropertyDescriptor: semanticRead,
          },
        );
      }
      const encodeCalls = vi.fn();
      const encode: PatientSearchCursorCodec['encode'] = () => {
        encodeCalls();
        return encodedValue as never;
      };
      const server = buildDevTestServer({
        patientSearchCursorCodec: { decode: vi.fn(() => undefined), encode },
        patientRepository: {
          search: vi.fn(async () => ({
            results: [
              {
                patientId: 'patient-hostile-encoded-cursor-4209',
                name: '合成hostile encoded患者',
                kana: 'ゴウセイホスタイルエンコードカンジャ',
                birthDate: '1990-01-01',
                sex: 'unknown' as const,
                patientNumber: 'HOSTILE-ENCODED-4209',
                eligibilityStatus: 'NOT_CHECKED' as const,
              },
            ],
            nextCursor: { offset: 1 },
          })),
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic',
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        message: patientSearchEncodedCursorInvariantErrorMessage,
      });
      expect(encodeCalls).toHaveBeenCalledOnce();
      expect(semanticRead).not.toHaveBeenCalled();
      expect(response.body).not.toContain('patient-hostile-encoded-cursor-4209');
      expect(response.body).not.toContain('HOSTILE-ENCODED-4209');
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain('Cannot perform');
    },
  );

  it.each([
    ['one-character', 'x'],
    ['maximum-length', 'x'.repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH)],
  ] as const)('accepts a %s primitive encoded cursor with frozen inputs', async (_label, encodedCursor) => {
    let observedBinding: unknown;
    let observedCursor: unknown;
    const encode = vi.fn<PatientSearchCursorCodec['encode']>((binding, cursor) => {
      observedBinding = binding;
      observedCursor = cursor;
      return encodedCursor;
    });
    const server = buildDevTestServer({
      patientSearchCursorCodec: { decode: vi.fn(() => undefined), encode },
      patientRepository: {
        search: vi.fn(async () => ({
          results: [
            {
              patientId: 'patient-max-encoded-cursor-4209',
              name: '合成max encoded患者',
              kana: 'ゴウセイマックスエンコードカンジャ',
              birthDate: '1990-01-01',
              sex: 'unknown' as const,
              patientNumber: 'MAX-ENCODED-4209',
              eligibilityStatus: 'NOT_CHECKED' as const,
            },
          ],
          nextCursor: { offset: 1 },
        })),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nextCursor: encodedCursor });
    expect(encode).toHaveBeenCalledOnce();
    expect(observedBinding).toEqual({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
      q: 'synthetic',
    });
    expect(Object.isFrozen(observedBinding)).toBe(true);
    expect(observedCursor).toEqual({ offset: 1 });
    expect(Object.isFrozen(observedCursor)).toBe(true);
  });

  it.each([
    [
      'synchronous Error',
      false,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) =>
        new Error(rawSentinel),
    ],
    [
      'asynchronous non-Error object',
      true,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
        patientNumber: 'PATIENT-SEARCH-REJECTION-SECRET',
      }),
    ],
    [
      'hostile Proxy',
      true,
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a patient search repository rejection from %s without inspecting it',
    async (_label, rejectAsPromise, createRejection) => {
      const query = '合成患者番号SEARCH-SECRET-4194';
      const rawSentinel = `raw patient search rejection ${query}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const rejection = createRejection(rawSentinel, propertyRead);
      const search = vi.fn<PatientRepository['search']>(() => {
        if (rejectAsPromise) return Promise.reject(rejection);
        throw rejection;
      });
      const encode = vi.fn(() => 'must-not-encode-after-search-rejection');
      const server = buildDevTestServer({
        patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/search?q=${encodeURIComponent(query)}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(search).toHaveBeenCalledExactlyOnceWith({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        q: query,
        limit: PATIENT_SEARCH_DEFAULT_LIMIT,
      });
      expect(encode).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: patientSearchRepositoryErrorMessage,
      });
      for (const sensitiveValue of [
        rawSentinel,
        query,
        'PATIENT-SEARCH-REJECTION-SECRET',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(propertyRead).not.toHaveBeenCalled();
    },
  );

  it('closes the former limit bypass without invoking a changing results accessor', async () => {
    const first = {
      patientId: 'patient-results-accessor-a-4203',
      name: '合成 results accessor患者A',
      kana: 'ゴウセイ リザルツアクセサーカンジャエー',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'RESULTS-ACCESSOR-A-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const second = {
      ...first,
      patientId: 'patient-results-accessor-b-secret-4203',
      patientNumber: 'RESULTS-ACCESSOR-B-SECRET-4203',
    };
    const getterRead = vi.fn(() => (getterRead.mock.calls.length === 1 ? [first] : [first, second]));
    const page = {};
    Object.defineProperty(page, 'results', { enumerable: true, get: getterRead });
    const encode = vi.fn(() => 'must-not-encode-results-accessor');
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => page as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(first.patientId);
    expect(response.body).not.toContain(second.patientId);
    expect(response.body).not.toContain(second.patientNumber);
    expect(getterRead).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });

  it.each([
    ['non-array', {}],
    ['sparse array', new Array(1)],
  ] as const)('rejects patient search results with a %s root', async (_label, results) => {
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results }) as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
  });

  it('rejects an in-limit patient search array index accessor without invoking it', async () => {
    const rawSentinel = 'raw in-limit patient index accessor secret 4203';
    const getterRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const results: unknown[] = [];
    Object.defineProperty(results, '0', { enumerable: true, get: getterRead });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results }) as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(getterRead).not.toHaveBeenCalled();
  });

  it('rejects an over-limit page before inspecting array indices or nextCursor', async () => {
    const rawSentinel = 'raw over-limit patient element secret 4203';
    const elementGetter = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const cursorGetter = vi.fn(() => {
      throw new Error('raw over-limit cursor secret 4203');
    });
    const results: unknown[] = [];
    Object.defineProperty(results, '0', { enumerable: true, get: elementGetter });
    Object.defineProperty(results, '1', { enumerable: true, value: {} });
    const page = { results };
    Object.defineProperty(page, 'nextCursor', { enumerable: true, get: cursorGetter });
    const encode = vi.fn(() => 'must-not-encode-over-limit-hostile-page');
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => page as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchResultLimitInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(elementGetter).not.toHaveBeenCalled();
    expect(cursorGetter).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });

  it('rejects a patient search results array Proxy without invoking its traps', async () => {
    const rawSentinel = 'raw patient results array Proxy secret 4203';
    const directRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const results = new Proxy([], {
      get: directRead,
      has: directRead,
      getPrototypeOf: directRead,
      ownKeys: directRead,
      getOwnPropertyDescriptor: directRead,
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results }) as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(directRead).not.toHaveBeenCalled();
  });

  it('rejects a fulfilled revoked patient search page Proxy without inspecting it', async () => {
    const directRead = vi.fn(() => {
      throw new Error('raw revoked patient page Proxy secret 4203');
    });
    const { proxy: page, revoke } = Proxy.revocable(
      { results: [] },
      {
        get(_target, property) {
          if (property === 'then') return undefined;
          return directRead();
        },
        has: directRead,
        getPrototypeOf: directRead,
        ownKeys: directRead,
        getOwnPropertyDescriptor: directRead,
      },
    );
    const fulfilledPage = new Promise<unknown>((resolve) => {
      resolve(page);
      revoke();
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(() => fulfilledPage as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
    expect(directRead).not.toHaveBeenCalled();
  });

  it.each(['patientId', 'name', 'eligibilityCheckedAt'] as const)(
    'rejects a patient search %s accessor without invoking it',
    async (field) => {
      const rawSentinel = `raw patient search ${field} accessor secret 4203`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const patient: Record<string, unknown> = {
        patientId: 'patient-search-accessor-4203',
        name: '合成 search accessor患者',
        kana: 'ゴウセイ サーチアクセサーカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown',
        patientNumber: 'SEARCH-ACCESSOR-4203',
        eligibilityStatus: 'NOT_CHECKED',
      };
      Object.defineProperty(patient, field, { enumerable: true, get: getterRead });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [patient] }) as never),
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic&limit=1',
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain('SEARCH-ACCESSOR-4203');
      expect(getterRead).not.toHaveBeenCalled();
    },
  );

  it('uses one captured results descriptor when the page backing value mutates', async () => {
    const first = {
      patientId: 'patient-search-snapshot-a-4203',
      name: '合成 snapshot患者A',
      kana: 'ゴウセイ スナップショットカンジャエー',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'SEARCH-SNAPSHOT-A-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const second = {
      ...first,
      patientId: 'patient-search-mutated-secret-4203',
      patientNumber: 'SEARCH-MUTATED-SECRET-4203',
    };
    const target = { results: [first] };
    const resultsDescriptorRead = vi.fn();
    const directRead = vi.fn((property: PropertyKey) => {
      if (property === 'then') return undefined;
      throw new Error(`raw patient page direct read ${String(property)} 4203`);
    });
    const page = new Proxy(target, {
      get(_currentTarget, property) {
        return directRead(property);
      },
      getOwnPropertyDescriptor(currentTarget, property) {
        if (property === 'results') {
          resultsDescriptorRead();
          const descriptor = Reflect.getOwnPropertyDescriptor(currentTarget, property);
          currentTarget.results = [second];
          return descriptor;
        }
        return Reflect.getOwnPropertyDescriptor(currentTarget, property);
      },
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(() => Promise.resolve(page as never)),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ results: [first] });
    expect(response.body).not.toContain(second.patientId);
    expect(response.body).not.toContain(second.patientNumber);
    expect(resultsDescriptorRead).toHaveBeenCalledOnce();
    expect(directRead).toHaveBeenCalledOnce();
    expect(directRead).toHaveBeenCalledWith('then');
  });

  it('hydrates one fulfilled patient search page graph without semantic direct reads', async () => {
    const directRead = vi.fn((property: PropertyKey) => {
      throw new Error(`raw direct patient search page read ${String(property)} 4203`);
    });
    const descriptorRead = vi.fn();
    const descriptorProxy = <T extends object>(target: T, allowThen = false): T =>
      new Proxy(target, {
        get(_currentTarget, property) {
          if (allowThen && property === 'then') return undefined;
          return directRead(property);
        },
        has(_currentTarget, property) {
          return directRead(property);
        },
        getPrototypeOf() {
          return directRead('getPrototypeOf');
        },
        ownKeys() {
          return directRead('ownKeys');
        },
        getOwnPropertyDescriptor(currentTarget, property) {
          descriptorRead(property);
          return Reflect.getOwnPropertyDescriptor(currentTarget, property);
        },
      });
    const patient = descriptorProxy({
      patientId: 'patient-search-graph-4203',
      name: '合成 search graph患者',
      kana: 'ゴウセイ サーチグラフカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'SEARCH-GRAPH-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
      eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
    });
    const cursor = descriptorProxy({ offset: 1 });
    const page = descriptorProxy({ results: [patient], nextCursor: cursor }, true);
    const encode = vi.fn<PatientSearchCursorCodec['encode']>(
      () => 'signed-search-graph-cursor-4203',
    );
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(() => Promise.resolve(page as never)),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        {
          patientId: 'patient-search-graph-4203',
          name: '合成 search graph患者',
          kana: 'ゴウセイ サーチグラフカンジャ',
          birthDate: '1990-01-01',
          sex: 'unknown',
          patientNumber: 'SEARCH-GRAPH-4203',
          eligibilityStatus: 'NOT_CHECKED',
          eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
        },
      ],
      nextCursor: 'signed-search-graph-cursor-4203',
    });
    expect(encode).toHaveBeenCalledOnce();
    expect(encode.mock.calls[0]?.[1]).toEqual({ offset: 1 });
    expect(Object.is(encode.mock.calls[0]?.[1], cursor)).toBe(false);
    expect(descriptorRead).toHaveBeenCalledTimes(11);
    expect(directRead).not.toHaveBeenCalled();
  });

  it('rejects duplicate patients before inspecting nextCursor', async () => {
    const patient = {
      patientId: 'patient-search-duplicate-cursor-4203',
      name: '合成 duplicate cursor患者',
      kana: 'ゴウセイ デュプリケートカーソルカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'DUPLICATE-CURSOR-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const cursorGetter = vi.fn(() => {
      throw new Error('raw duplicate nextCursor secret 4203');
    });
    const page = { results: [patient, { ...patient }] };
    Object.defineProperty(page, 'nextCursor', { enumerable: true, get: cursorGetter });
    const encode = vi.fn(() => 'must-not-encode-duplicate-hostile-cursor');
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => page as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=2',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: patientSearchDuplicateIdentityInvariantErrorMessage,
    });
    expect(cursorGetter).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });

  it('prioritizes patient search schema failure over a duplicate identity', async () => {
    const patientIdentity = 'patient-search-schema-before-duplicate-4203';
    const first = {
      patientId: patientIdentity,
      name: '合成 schema duplicate患者A',
      kana: 'ゴウセイ スキーマデュプリケートカンジャエー',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'SCHEMA-DUPLICATE-A-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const invalid = {
      ...first,
      name: '',
      patientNumber: 'SCHEMA-DUPLICATE-INVALID-SECRET-4203',
    };
    const encode = vi.fn(() => 'must-not-encode-schema-before-duplicate');
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [first, invalid] }) as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=2',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: patientSearchPageSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(patientIdentity);
    expect(response.body).not.toContain(invalid.patientNumber);
    expect(encode).not.toHaveBeenCalled();
  });

  it.each(['nextCursor', 'offset'] as const)(
    'rejects a patient search %s accessor without invoking it',
    async (layer) => {
      const rawSentinel = `raw patient search ${layer} accessor secret 4203`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const patient = {
        patientId: 'patient-search-cursor-accessor-4203',
        name: '合成 cursor accessor患者',
        kana: 'ゴウセイ カーソルアクセサーカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'CURSOR-ACCESSOR-4203',
        eligibilityStatus: 'NOT_CHECKED' as const,
      };
      const page: Record<string, unknown> = { results: [patient] };
      if (layer === 'nextCursor') {
        Object.defineProperty(page, 'nextCursor', { enumerable: true, get: getterRead });
      } else {
        const nextCursor = {};
        Object.defineProperty(nextCursor, 'offset', { enumerable: true, get: getterRead });
        page.nextCursor = nextCursor;
      }
      const encode = vi.fn(() => 'must-not-encode-cursor-accessor');
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => page as never),
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
        },
        patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=synthetic&limit=1',
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: patientSearchCursorProgressInvariantErrorMessage,
      });
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain(patient.patientNumber);
      expect(getterRead).not.toHaveBeenCalled();
      expect(encode).not.toHaveBeenCalled();
    },
  );

  it('uses one captured cursor offset after the repository backing value mutates', async () => {
    const mutatedOffset = 9007199254740991;
    const patient = {
      patientId: 'patient-search-cursor-snapshot-4203',
      name: '合成 cursor snapshot患者',
      kana: 'ゴウセイ カーソルスナップショットカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'CURSOR-SNAPSHOT-4203',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const cursorTarget = { offset: 1 };
    const offsetDescriptorRead = vi.fn();
    const directRead = vi.fn((property: PropertyKey) => {
      throw new Error(`raw mutated cursor read ${String(property)} ${mutatedOffset}`);
    });
    const cursor = new Proxy(cursorTarget, {
      get(_target, property) {
        return directRead(property);
      },
      has(_target, property) {
        return directRead(property);
      },
      getPrototypeOf() {
        return directRead('getPrototypeOf');
      },
      ownKeys() {
        return directRead('ownKeys');
      },
      getOwnPropertyDescriptor(target, property) {
        offsetDescriptorRead(property);
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        target.offset = mutatedOffset;
        return descriptor;
      },
    });
    const encode = vi.fn<PatientSearchCursorCodec['encode']>(
      () => 'signed-captured-cursor-4203',
    );
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({
          results: [patient],
          nextCursor: cursor,
        }) as never),
        findById: vi.fn<PatientRepository['findById']>(async () => undefined),
      },
      patientSearchCursorCodec: { encode, decode: vi.fn(() => undefined) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic&limit=1',
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nextCursor: 'signed-captured-cursor-4203' });
    expect(response.body).not.toContain(String(mutatedOffset));
    expect(encode).toHaveBeenCalledOnce();
    expect(encode.mock.calls[0]?.[1]).toEqual({ offset: 1 });
    expect(Object.is(encode.mock.calls[0]?.[1], cursor)).toBe(false);
    expect(offsetDescriptorRead).toHaveBeenCalledExactlyOnceWith('offset');
    expect(directRead).not.toHaveBeenCalled();
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
    [
      'synchronous Error',
      false,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) =>
        new Error(rawSentinel),
    ],
    [
      'asynchronous non-Error object',
      true,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
        patientNumber: 'QUEUE-PATIENT-SECRET-4195',
      }),
    ],
    [
      'hostile Proxy',
      true,
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a reception queue repository rejection from %s without inspecting it',
    async (_label, rejectAsPromise, createRejection) => {
      const date = '2026-07-17';
      const rawSentinel = `raw reception queue rejection ${date}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const rejection = createRejection(rawSentinel, propertyRead);
      const list = vi.fn<ReceptionRepository['list']>(() => {
        if (rejectAsPromise) return Promise.reject(rejection);
        throw rejection;
      });
      const create = vi.fn<ReceptionRepository['create']>();
      const server = buildDevTestServer({
        receptionRepository: { list, create },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/reception/queue?date=${date}`,
        headers: tenantOneReceptionReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(list).toHaveBeenCalledExactlyOnceWith({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        date,
      });
      expect(create).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionQueueRepositoryErrorMessage,
      });
      for (const sensitiveValue of [rawSentinel, date, 'QUEUE-PATIENT-SECRET-4195']) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(propertyRead).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['non-array root', {}],
    ['sparse array', new Array(1)],
  ] as const)('rejects a fulfilled reception queue with a %s', async (_label, entries) => {
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => entries as never),
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
    expect(response.json()).toMatchObject({
      message: receptionQueueSchemaInvariantErrorMessage,
    });
  });

  it('rejects a reception queue array index accessor without invoking it', async () => {
    const rawSentinel = 'raw queue array accessor secret 4202';
    const getterRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const entries: unknown[] = [];
    Object.defineProperty(entries, '0', { enumerable: true, get: getterRead });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => entries as never),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(getterRead).not.toHaveBeenCalled();
  });

  it('rejects a fulfilled reception queue array Proxy without invoking its traps', async () => {
    const rawSentinel = 'raw queue array Proxy trap secret 4202';
    const directRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const descriptorRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const entries = new Proxy([], {
      get(_target, property) {
        if (property === 'then') return undefined;
        return directRead();
      },
      has: directRead,
      getPrototypeOf: directRead,
      ownKeys: directRead,
      getOwnPropertyDescriptor: descriptorRead,
    });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(() => Promise.resolve(entries as never)),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(descriptorRead).not.toHaveBeenCalled();
    expect(directRead).not.toHaveBeenCalled();
  });

  it('rejects a fulfilled revoked reception queue array Proxy without inspecting it', async () => {
    const directRead = vi.fn(() => {
      throw new Error('raw revoked queue array Proxy trap secret 4202');
    });
    const { proxy: entries, revoke } = Proxy.revocable([], {
      get(_target, property) {
        if (property === 'then') return undefined;
        return directRead();
      },
      has: directRead,
      getPrototypeOf: directRead,
      ownKeys: directRead,
      getOwnPropertyDescriptor: directRead,
    });
    const fulfilledEntries = new Promise<unknown>((resolve) => {
      resolve(entries);
      revoke();
    });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(() => fulfilledEntries as never),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    expect(directRead).not.toHaveBeenCalled();
  });

  it('rejects a fulfilled reception queue entry accessor without invoking or echoing it', async () => {
    const rawSentinel = 'raw queue acceptedAt accessor secret 4202';
    const getterRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const entry = {
      receptionId: 'reception-accessor-secret-4202',
      patient: {
        patientId: 'patient-accessor-secret-4202',
        name: '合成 accessor患者',
        kana: 'ゴウセイ アクセサーカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'ACCESSOR-SECRET-4202',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
    };
    Object.defineProperty(entry, 'acceptedAt', { enumerable: true, get: getterRead });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [entry] as never),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    for (const sensitiveValue of [
      rawSentinel,
      entry.receptionId,
      entry.patient.patientId,
      entry.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
    expect(getterRead).not.toHaveBeenCalled();
  });

  it('normalizes a throwing queue entry descriptor Proxy without direct inspection', async () => {
    const rawSentinel = 'raw queue entry descriptor trap secret 4202';
    const directRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const descriptorRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const entry = new Proxy(
      {},
      {
        get: directRead,
        has: directRead,
        getPrototypeOf: directRead,
        ownKeys: directRead,
        getOwnPropertyDescriptor: descriptorRead,
      },
    );
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [entry] as never),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
    expect(descriptorRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
  });

  it('hydrates one fulfilled reception queue descriptor graph without semantic direct reads', async () => {
    const directRead = vi.fn((property: PropertyKey) => {
      throw new Error(`raw direct reception queue read ${String(property)} 4202`);
    });
    const descriptorRead = vi.fn();
    const descriptorProxy = <T extends object>(target: T): T =>
      new Proxy(target, {
        get(_currentTarget, property) {
          return directRead(property);
        },
        has(_currentTarget, property) {
          return directRead(property);
        },
        getPrototypeOf() {
          return directRead('getPrototypeOf');
        },
        ownKeys() {
          return directRead('ownKeys');
        },
        getOwnPropertyDescriptor(currentTarget, property) {
          descriptorRead(property);
          return Reflect.getOwnPropertyDescriptor(currentTarget, property);
        },
      });
    const patient = descriptorProxy({
      patientId: 'patient-queue-descriptor-4202',
      name: '合成 queue descriptor患者',
      kana: 'ゴウセイ キューディスクリプタカンジャ',
      birthDate: '1990-01-01',
      sex: 'unknown' as const,
      patientNumber: 'QUEUE-DESC-4202',
      eligibilityStatus: 'NOT_CHECKED' as const,
      eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
    });
    const entry = descriptorProxy({
      receptionId: 'reception-queue-descriptor-4202',
      patient,
      acceptedAt: '2026-07-09T09:00:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
    });
    const entries = [entry];
    const list = vi.fn<ReceptionRepository['list']>(async () => entries as never);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>() },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: tenantOneReceptionReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      date: '2026-07-09',
      entries: [
        {
          receptionId: 'reception-queue-descriptor-4202',
          patient: {
            patientId: 'patient-queue-descriptor-4202',
            name: '合成 queue descriptor患者',
            kana: 'ゴウセイ キューディスクリプタカンジャ',
            birthDate: '1990-01-01',
            sex: 'unknown',
            patientNumber: 'QUEUE-DESC-4202',
            eligibilityStatus: 'NOT_CHECKED',
            eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
          },
          acceptedAt: '2026-07-09T09:00:00.000Z',
          receptionStatus: 'WAITING',
          prescriptionIntakeType: 'paper',
        },
      ],
    });
    expect(descriptorRead).toHaveBeenCalledTimes(13);
    expect(directRead).not.toHaveBeenCalled();
  });

  it('accepts an entry whose UTC date differs but whose JST business date matches the request', async () => {
    const boundaryEntry = {
      receptionId: 'reception-jst-boundary',
      acceptedAt: '2026-07-09T15:00:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      patient: {
        patientId: 'patient-jst-boundary',
        name: '合成 境界患者',
        kana: 'ゴウセイ キョウカイカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'JST-BOUNDARY-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const list = vi.fn<ReceptionRepository['list']>(async () => [boundaryEntry]);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>() },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-10',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ date: '2026-07-10', entries: [boundaryEntry] });
  });

  it.each([
    ['previous', '2026-07-08T14:59:59.999Z'],
    ['next', '2026-07-09T15:00:00.000Z'],
  ] as const)('rejects a schema-valid entry from the %s JST business date without echoing PHI', async (_label, acceptedAt) => {
    const wrongDateEntry = {
      receptionId: 'reception-wrong-date-sensitive',
      acceptedAt,
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      patient: {
        patientId: 'patient-wrong-date-sensitive',
        name: '合成 別日患者',
        kana: 'ゴウセイ ベツジツカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'WRONG-DATE-SECRET-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const list = vi.fn<ReceptionRepository['list']>(async () => [wrongDateEntry]);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>() },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionQueueBusinessDateInvariantErrorMessage,
    });
    for (const sensitiveValue of [
      '2026-07-09',
      wrongDateEntry.receptionId,
      wrongDateEntry.acceptedAt,
      wrongDateEntry.receptionStatus,
      wrongDateEntry.patient.patientId,
      wrongDateEntry.patient.name,
      wrongDateEntry.patient.kana,
      wrongDateEntry.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it('rejects a mixed-date queue without returning the otherwise-valid row', async () => {
    const valid = {
      receptionId: 'reception-valid-sensitive',
      acceptedAt: '2026-07-09T00:15:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      patient: {
        patientId: 'patient-valid-sensitive',
        name: '合成 当日患者',
        kana: 'ゴウセイ トウジツカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'VALID-DATE-SECRET-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const wrongDate = {
      ...valid,
      receptionId: 'reception-mixed-wrong-date',
      acceptedAt: '2026-07-09T15:00:00.000Z',
      patient: {
        ...valid.patient,
        patientId: 'patient-mixed-wrong-date',
        patientNumber: 'MIXED-WRONG-SECRET-001',
      },
    };
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [valid, wrongDate]),
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
    expect(response.body).toContain(receptionQueueBusinessDateInvariantErrorMessage);
    for (const sensitiveValue of [
      valid.receptionId,
      valid.patient.patientId,
      valid.patient.patientNumber,
      wrongDate.receptionId,
      wrongDate.patient.patientId,
      wrongDate.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
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
            acceptedAt: '2026-07-09T15:00:00.000Z',
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

  it('prioritizes queue schema failure over a duplicate reception identity', async () => {
    const receptionIdentity = 'reception-schema-before-duplicate-4202';
    const valid = {
      receptionId: receptionIdentity,
      acceptedAt: '2026-07-09T09:00:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      patient: {
        patientId: 'patient-schema-before-duplicate-a-4202',
        name: '合成 schema優先患者A',
        kana: 'ゴウセイ スキーマユウセンカンジャエー',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'SCHEMA-FIRST-A-4202',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const invalid = {
      ...valid,
      receptionStatus: 'RAW_INVALID_RECEPTION_STATUS_SECRET_4202',
      patient: {
        ...valid.patient,
        patientId: 'patient-schema-before-duplicate-b-4202',
        patientNumber: 'SCHEMA-FIRST-B-4202',
      },
    };
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [valid, invalid] as never),
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
    expect(response.json()).toMatchObject({ message: receptionQueueSchemaInvariantErrorMessage });
    for (const sensitiveValue of [
      receptionIdentity,
      invalid.receptionStatus,
      valid.patient.patientId,
      invalid.patient.patientId,
      valid.patient.patientNumber,
      invalid.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

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
    expect(response.json()).not.toHaveProperty('provenance');
    expect(response.body).not.toContain('reception-create-001');
  });

  it.each([
    [
      'synchronous Error',
      false,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) =>
        new Error(rawSentinel),
    ],
    [
      'asynchronous non-Error object',
      true,
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
        patientNumber: 'SYN-CREATE-REJECTION-SECRET',
      }),
    ],
    [
      'hostile Proxy',
      true,
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a reception repository create rejection from %s without inspecting it',
    async (_label, rejectAsPromise, createRejection) => {
      const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const requestedPatientId = 'patient-syn-004';
      const idempotencyKey = 'reception-create-rejection-key-secret-4197';
      const rawSentinel = 'raw reception create rejection SQL driver secret 4197';
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const rejection = createRejection(rawSentinel, propertyRead);
      const create = vi.fn<ReceptionRepository['create']>(() => {
        if (rejectAsPromise) return Promise.reject(rejection);
        throw rejection;
      });
      const server = buildDevTestServer({
        now: () => acceptedAt,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: { patientId: requestedPatientId, idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(create).toHaveBeenCalledExactlyOnceWith({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        patient: {
          patientId: patientId(requestedPatientId),
          name: '合成患者D',
          kana: 'ゴウセイカンジャディー',
          birthDate: '1965-04-04',
          sex: 'female',
          patientNumber: 'SYN-004',
          eligibilityStatus: 'NOT_CHECKED',
        },
        idempotencyKey,
        acceptedAt,
      });
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionCreateRepositoryErrorMessage,
      });
      for (const sensitiveValue of [
        rawSentinel,
        requestedPatientId,
        idempotencyKey,
        '合成患者D',
        'ゴウセイカンジャディー',
        'SYN-004',
        'SYN-CREATE-REJECTION-SECRET',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(propertyRead).not.toHaveBeenCalled();
    },
  );

  it('does not re-assimilate a fulfilled reception create result thenable', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const rawSentinel = 'raw second reception result then read secret 4204';
    const thenRead = vi.fn(() => {
      if (thenRead.mock.calls.length > 1) throw new Error(rawSentinel);
      return undefined;
    });
    const directRead = vi.fn((property: PropertyKey) => {
      throw new Error(`raw reception result semantic read ${String(property)} 4204`);
    });
    const create = vi.fn<ReceptionRepository['create']>((input) => {
      const result = new Proxy(
        {
          kind: 'idempotency_conflict' as const,
          provenance: receptionProvenance(
            input,
            'reception-thenable-result-4204',
            'patient-thenable-conflict-4204',
          ),
        },
        {
          get(_target, property) {
            if (property === 'then') return thenRead();
            return directRead(property);
          },
          has(_target, property) {
            return directRead(property);
          },
          getPrototypeOf() {
            return directRead('getPrototypeOf');
          },
          ownKeys() {
            return directRead('ownKeys');
          },
          getOwnPropertyDescriptor(target, property) {
            return Reflect.getOwnPropertyDescriptor(target, property);
          },
        },
      );
      return Promise.resolve(result as ReceptionCreateResult);
    });
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create,
      },
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
        record: auditRecord,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-thenable-result-4204',
      },
    });
    await server.close();

    expect({
      statusCode: response.statusCode,
      body: response.json(),
      thenReads: thenRead.mock.calls.length,
      directReads: directRead.mock.calls.length,
    }).toEqual({
      statusCode: 409,
      body: {
        errorCode: receptionIdempotencyConflictErrorCode,
        message: 'Reception idempotency conflict',
      },
      thenReads: 1,
      directReads: 0,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toContain(rawSentinel);
    expect(create).toHaveBeenCalledOnce();
    expect(thenRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('normalizes a fulfilled revoked reception create result as a kind invariant', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const idempotencyKey = 'reception-revoked-result-secret-4204';
    const directRead = vi.fn(() => {
      throw new Error('raw revoked reception result trap secret 4204');
    });
    const create = vi.fn<ReceptionRepository['create']>((input) => {
      const { proxy: result, revoke } = Proxy.revocable(
        {
          kind: 'created' as const,
          provenance: receptionProvenance(input, 'reception-revoked-result-4204'),
          entry: {
            receptionId: 'reception-revoked-result-4204',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING' as const,
            prescriptionIntakeType: 'paper' as const,
            patient: input.patient,
          },
        },
        {
          get(_target, property) {
            if (property === 'then') return undefined;
            return directRead();
          },
          has: directRead,
          getPrototypeOf: directRead,
          ownKeys: directRead,
          getOwnPropertyDescriptor: directRead,
        },
      );
      return new Promise<ReceptionCreateResult>((resolve) => {
        resolve(result);
        revoke();
      });
    });
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create,
      },
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
        record: auditRecord,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: 'patient-syn-004', idempotencyKey },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: receptionResultKindInvariantErrorMessage });
    for (const sensitiveValue of [
      idempotencyKey,
      'reception-revoked-result-4204',
      'Cannot perform',
      'raw revoked reception result trap secret 4204',
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
    expect(create).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('rejects an unknown reception result kind instead of treating it as an existing success', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const idempotencyKey = 'reception-unknown-kind-secret-4198';
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) =>
          ({
            kind: 'forged_existing_kind',
            provenance: receptionProvenance(input, 'reception-forged-kind-secret-4198'),
            entry: {
              receptionId: 'reception-forged-kind-secret-4198',
              acceptedAt: acceptedAt.toISOString(),
              receptionStatus: 'COMPLETED',
              prescriptionIntakeType: 'paper',
              patient: input.patient,
            },
          }) as unknown as ReceptionCreateResult,
        ),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: 'patient-syn-004', idempotencyKey },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionResultKindInvariantErrorMessage,
    });
    for (const sensitiveValue of [
      'forged_existing_kind',
      'reception-forged-kind-secret-4198',
      'patient-syn-004',
      idempotencyKey,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it.each([
    [
      'missing',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown => ({}),
    ],
    [
      'non-string',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown => ({ kind: 42 }),
    ],
    [
      'inherited',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown =>
        Object.create({ kind: 'existing' }) as object,
    ],
    [
      'non-enumerable',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown =>
        Object.defineProperty({}, 'kind', { value: 'existing' }),
    ],
    [
      'accessor',
      (_rawSentinel: string, getterRead: ReturnType<typeof vi.fn>): unknown =>
        Object.defineProperty({}, 'kind', { enumerable: true, get: getterRead }),
    ],
    [
      'array root',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown =>
        Object.assign([], { kind: 'existing' }),
    ],
    [
      'function root',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown =>
        Object.assign(() => undefined, { kind: 'existing' }),
    ],
    [
      'null root',
      (_rawSentinel: string, _getterRead: ReturnType<typeof vi.fn>): unknown => null,
    ],
  ] as const)(
    'rejects a reception result with a %s kind authority before reading result detail',
    async (_label, createInvalidResult) => {
      const rawSentinel = `raw invalid reception kind detail ${_label} 4198`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const provenanceRead = vi.fn(() => {
        throw new Error(`raw provenance ${rawSentinel}`);
      });
      const entryRead = vi.fn(() => {
        throw new Error(`raw entry ${rawSentinel}`);
      });
      const invalidResult = createInvalidResult(rawSentinel, getterRead);
      if (
        invalidResult !== null &&
        (typeof invalidResult === 'object' || typeof invalidResult === 'function')
      ) {
        Object.defineProperties(invalidResult, {
          provenance: { enumerable: true, get: provenanceRead },
          entry: { enumerable: true, get: entryRead },
        });
      }
      const idempotencyKey = `reception-invalid-kind-${_label}-secret-4198`;
      const server = buildDevTestServer({
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async () =>
            invalidResult as ReceptionCreateResult,
          ),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: { patientId: 'patient-syn-004', idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: receptionResultKindInvariantErrorMessage });
      for (const sensitiveValue of [rawSentinel, 'patient-syn-004', idempotencyKey]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(getterRead).not.toHaveBeenCalled();
      expect(provenanceRead).not.toHaveBeenCalled();
      expect(entryRead).not.toHaveBeenCalled();
    },
  );

  it('normalizes a throwing result-kind descriptor trap without other Proxy inspection', async () => {
    const rawSentinel = 'raw reception result kind descriptor trap secret 4198';
    const directRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const descriptorRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const invalidResult = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') return undefined;
          return directRead();
        },
        has: directRead,
        getPrototypeOf: directRead,
        ownKeys: directRead,
        getOwnPropertyDescriptor: descriptorRead,
      },
    );
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(() => Promise.resolve(invalidResult as never)),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-kind-descriptor-trap-secret-4198',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ message: receptionResultKindInvariantErrorMessage });
    for (const sensitiveValue of [
      rawSentinel,
      'patient-syn-004',
      'reception-kind-descriptor-trap-secret-4198',
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
    expect(descriptorRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
  });

  it('uses one captured result kind for every later branch without a direct kind read', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const kindRead = vi.fn(() => {
      throw new Error('raw direct kind read secret 4198');
    });
    const descriptorRead = vi.fn(() => ({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 'created',
    }));
    const target = {
      kind: 'existing',
      provenance: undefined as unknown,
      entry: undefined as unknown,
    };
    const result = new Proxy(target, {
      get(currentTarget, property, receiver) {
        if (property === 'kind') return kindRead();
        return Reflect.get(currentTarget, property, receiver);
      },
      getOwnPropertyDescriptor(currentTarget, property) {
        if (property === 'kind') return descriptorRead();
        return Reflect.getOwnPropertyDescriptor(currentTarget, property);
      },
    });
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) => {
          target.provenance = receptionProvenance(input, 'reception-kind-snapshot-4198');
          target.entry = {
            receptionId: 'reception-kind-snapshot-4198',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING',
            prescriptionIntakeType: 'paper',
            patient: input.patient,
          };
          return result as unknown as ReceptionCreateResult;
        }),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-kind-snapshot-4198',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(201);
    expect(descriptorRead).toHaveBeenCalledOnce();
    expect(kindRead).not.toHaveBeenCalled();
  });

  it.each([
    ['result provenance', 'result', 'provenance', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['provenance tenant', 'provenance', 'tenantId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['provenance pharmacy', 'provenance', 'pharmacyId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['provenance key', 'provenance', 'idempotencyKey', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['provenance reception', 'provenance', 'receptionId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['provenance patient', 'provenance', 'patientId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['result entry', 'result', 'entry', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['entry reception', 'entry', 'receptionId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['entry patient', 'entry', 'patient', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['patient identity', 'patient', 'patientId', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['entry acceptedAt', 'entry', 'acceptedAt', receptionResultSchemaInvariantErrorMessage],
    ['entry status', 'entry', 'receptionStatus', receptionResultSchemaInvariantErrorMessage],
    ['entry intake type', 'entry', 'prescriptionIntakeType', receptionResultSchemaInvariantErrorMessage],
    ['patient name', 'patient', 'name', receptionResultSchemaInvariantErrorMessage],
    ['patient kana', 'patient', 'kana', receptionResultSchemaInvariantErrorMessage],
    ['patient birth date', 'patient', 'birthDate', receptionResultSchemaInvariantErrorMessage],
    ['patient sex', 'patient', 'sex', receptionResultSchemaInvariantErrorMessage],
    ['patient number', 'patient', 'patientNumber', receptionResultSchemaInvariantErrorMessage],
    ['patient eligibility', 'patient', 'eligibilityStatus', receptionResultSchemaInvariantErrorMessage],
    ['patient eligibility time', 'patient', 'eligibilityCheckedAt', receptionResultSchemaInvariantErrorMessage],
  ] as const)(
    'rejects a fulfilled reception result with a %s accessor without invoking it',
    async (_label, layer, key, expectedMessage) => {
      const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const idempotencyKey = `reception-result-accessor-${layer}-${key}-4199`;
      const rawSentinel = `raw fulfilled reception ${layer}.${key} patient secret 4199`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const server = buildDevTestServer({
        now: () => acceptedAt,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async (input) => {
            const provenance: Record<string, unknown> = {
              ...receptionProvenance(input, 'reception-result-accessor-4199'),
            };
            const patient: Record<string, unknown> = { ...input.patient };
            const entry: Record<string, unknown> = {
              receptionId: 'reception-result-accessor-4199',
              acceptedAt: acceptedAt.toISOString(),
              receptionStatus: 'WAITING',
              prescriptionIntakeType: 'paper',
              patient,
            };
            const result: Record<string, unknown> = { kind: 'created', provenance, entry };
            const container =
              layer === 'result'
                ? result
                : layer === 'provenance'
                  ? provenance
                  : layer === 'entry'
                    ? entry
                    : patient;
            Object.defineProperty(container, key, { enumerable: true, get: getterRead });
            return result as unknown as ReceptionCreateResult;
          }),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: { patientId: 'patient-syn-004', idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: expectedMessage });
      for (const sensitiveValue of [rawSentinel, 'patient-syn-004', idempotencyKey]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(getterRead).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['result provenance', 'result', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['nested provenance', 'provenance', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['nested entry', 'entry', receptionResultIdempotencyProvenanceMismatchErrorMessage],
    ['nested patient', 'patient', receptionResultIdempotencyProvenanceMismatchErrorMessage],
  ] as const)(
    'normalizes a throwing %s descriptor Proxy without direct semantic inspection',
    async (_label, layer, expectedMessage) => {
      const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const rawSentinel = `raw fulfilled reception ${layer} descriptor trap secret 4199`;
      const directRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const descriptorRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const hostileProxy = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === 'then') return undefined;
            return directRead();
          },
          has: directRead,
          getPrototypeOf: directRead,
          ownKeys: directRead,
          getOwnPropertyDescriptor: descriptorRead,
        },
      );
      const idempotencyKey = `reception-result-${layer}-descriptor-secret-4199`;
      const server = buildDevTestServer({
        now: () => acceptedAt,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>((input) => {
            const provenance: Record<string, unknown> = {
              ...receptionProvenance(input, 'reception-result-descriptor-4199'),
            };
            const patient: Record<string, unknown> = { ...input.patient };
            const entry: Record<string, unknown> = {
              receptionId: 'reception-result-descriptor-4199',
              acceptedAt: acceptedAt.toISOString(),
              receptionStatus: 'WAITING',
              prescriptionIntakeType: 'paper',
              patient: layer === 'patient' ? hostileProxy : patient,
            };
            const result: Record<string, unknown> = {
              kind: 'created',
              provenance: layer === 'provenance' ? hostileProxy : provenance,
              entry: layer === 'entry' ? hostileProxy : entry,
            };
            const resultWithHostileProvenanceDescriptor = new Proxy(result, {
              get(currentTarget, property, receiver) {
                if (property === 'then') return undefined;
                return Reflect.get(currentTarget, property, receiver);
              },
              getOwnPropertyDescriptor(currentTarget, property) {
                if (property === 'kind') {
                  return Reflect.getOwnPropertyDescriptor(currentTarget, property);
                }
                return descriptorRead();
              },
            });
            return Promise.resolve(
              (layer === 'result'
                ? resultWithHostileProvenanceDescriptor
                : result) as ReceptionCreateResult,
            );
          }),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: { patientId: 'patient-syn-004', idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: expectedMessage });
      expect(response.body).not.toContain(rawSentinel);
      expect(descriptorRead).toHaveBeenCalledOnce();
      expect(directRead).not.toHaveBeenCalled();
    },
  );

  it('hydrates one fulfilled reception result descriptor graph without semantic direct reads', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const directRead = vi.fn((property: PropertyKey) => {
      throw new Error(`raw direct reception result read ${String(property)} 4199`);
    });
    const descriptorRead = vi.fn();
    const descriptorProxy = <T extends object>(target: T, allowThen = false): T =>
      new Proxy(target, {
        get(currentTarget, property) {
          if (allowThen && property === 'then') return undefined;
          return directRead(property);
        },
        has(_currentTarget, property) {
          return directRead(property);
        },
        getPrototypeOf() {
          return directRead('getPrototypeOf');
        },
        ownKeys() {
          return directRead('ownKeys');
        },
        getOwnPropertyDescriptor(currentTarget, property) {
          descriptorRead(property);
          return Reflect.getOwnPropertyDescriptor(currentTarget, property);
        },
      });
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>((input) => {
          const patient = descriptorProxy({ ...input.patient });
          const entry = descriptorProxy({
            receptionId: 'reception-descriptor-graph-4199',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING',
            prescriptionIntakeType: 'paper',
            patient,
          });
          const provenance = descriptorProxy(
            receptionProvenance(input, 'reception-descriptor-graph-4199'),
          );
          return Promise.resolve(
            descriptorProxy(
              { kind: 'created', provenance, entry },
              true,
            ) as unknown as ReceptionCreateResult,
          );
        }),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-001',
        idempotencyKey: 'reception-descriptor-graph-4199',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      receptionId: 'reception-descriptor-graph-4199',
      patient: { eligibilityCheckedAt: '2026-07-09T08:16:15.000Z' },
    });
    expect(descriptorRead).toHaveBeenCalledTimes(21);
    expect(directRead).not.toHaveBeenCalled();
  });

  it('uses the captured entry descriptor after the repository backing value mutates', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const mutatedAcceptedAt = 'raw-mutated-accepted-at-secret-4199';
    const acceptedAtDescriptorRead = vi.fn();
    const directRead = vi.fn(() => {
      throw new Error(mutatedAcceptedAt);
    });
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) => {
          const entryTarget = {
            receptionId: 'reception-entry-snapshot-4199',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING' as const,
            prescriptionIntakeType: 'paper' as const,
            patient: input.patient,
          };
          const entry = new Proxy(entryTarget, {
            get: directRead,
            getOwnPropertyDescriptor(currentTarget, property) {
              const descriptor = Reflect.getOwnPropertyDescriptor(currentTarget, property);
              if (property === 'acceptedAt') {
                acceptedAtDescriptorRead();
                currentTarget.acceptedAt = mutatedAcceptedAt;
              }
              return descriptor;
            },
          });
          return {
            kind: 'created',
            provenance: receptionProvenance(input, 'reception-entry-snapshot-4199'),
            entry,
          };
        }),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-entry-snapshot-4199',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      receptionId: 'reception-entry-snapshot-4199',
      acceptedAt: acceptedAt.toISOString(),
    });
    expect(response.body).not.toContain(mutatedAcceptedAt);
    expect(acceptedAtDescriptorRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
  });

  it('does not inspect a hostile entry when a valid provenance snapshot selects conflict', async () => {
    const entryRead = vi.fn(() => {
      throw new Error('raw conflict entry secret 4199');
    });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) => {
          const result = {
            kind: 'idempotency_conflict' as const,
            provenance: receptionProvenance(
              input,
              'reception-conflict-entry-unread-4199',
              'patient-other-conflict-4199',
            ),
          };
          Object.defineProperty(result, 'entry', { enumerable: true, get: entryRead });
          return result;
        }),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: 'patient-syn-004',
        idempotencyKey: 'reception-conflict-entry-unread-4199',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      errorCode: receptionIdempotencyConflictErrorCode,
      message: 'Reception idempotency conflict',
    });
    expect(entryRead).not.toHaveBeenCalled();
  });

  it.each([
    [
      'Error',
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) =>
        new Error(rawSentinel),
    ],
    [
      'non-Error object',
      (rawSentinel: string, _propertyRead: ReturnType<typeof vi.fn>) => ({
        message: rawSentinel,
        patientId: 'patient-rejection-object-secret',
      }),
    ],
    [
      'hostile Proxy',
      (_rawSentinel: string, propertyRead: ReturnType<typeof vi.fn>) =>
        new Proxy({}, { get: propertyRead, has: propertyRead, getPrototypeOf: propertyRead }),
    ],
  ] as const)(
    'normalizes a patient GET repository rejection from %s without inspecting it',
    async (_label, createRejection) => {
      const requestedPatientId = 'patient-lookup-rejection-secret-4193';
      const rawSentinel = `raw patient lookup rejection ${requestedPatientId}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const findById = vi.fn<PatientRepository['findById']>(() => {
        throw createRejection(rawSentinel, propertyRead);
      });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/${requestedPatientId}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(findById).toHaveBeenCalledExactlyOnceWith({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        patientId: patientId(requestedPatientId),
      });
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: patientLookupRepositoryErrorMessage,
      });
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain(requestedPatientId);
      expect(response.body).not.toContain('patient-rejection-object-secret');
      expect(propertyRead).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['patientId', receptionPatientIdentityMismatchErrorMessage],
    ['name', receptionPatientSchemaInvariantErrorMessage],
    ['kana', receptionPatientSchemaInvariantErrorMessage],
    ['birthDate', receptionPatientSchemaInvariantErrorMessage],
    ['sex', receptionPatientSchemaInvariantErrorMessage],
    ['patientNumber', receptionPatientSchemaInvariantErrorMessage],
    ['eligibilityStatus', receptionPatientSchemaInvariantErrorMessage],
    ['eligibilityCheckedAt', receptionPatientSchemaInvariantErrorMessage],
  ] as const)(
    'rejects a reception patient lookup with a %s accessor without invoking it',
    async (field, expectedMessage) => {
      const requestedPatientId = 'patient-syn-004';
      const idempotencyKey = `reception-patient-accessor-${field}-4201`;
      const rawSentinel = `raw reception patient ${field} PHI secret 4201`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const patient: Record<string, unknown> = {
        patientId: requestedPatientId,
        name: '合成患者D',
        kana: 'ゴウセイカンジャディー',
        birthDate: '1965-04-04',
        sex: 'female',
        patientNumber: 'SYN-004',
        eligibilityStatus: 'NOT_CHECKED',
        eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
      };
      Object.defineProperty(patient, field, { enumerable: true, get: getterRead });
      const create = vi.fn<ReceptionRepository['create']>();
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(async () => patient as never),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/reception',
        headers: tenantOneReceptionWriteHeaders,
        payload: { patientId: requestedPatientId, idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: expectedMessage });
      for (const sensitiveValue of [
        rawSentinel,
        requestedPatientId,
        idempotencyKey,
        '合成患者D',
        'SYN-004',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(getterRead).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['patientId', receptionPatientIdentityMismatchErrorMessage],
    ['name', receptionPatientSchemaInvariantErrorMessage],
  ] as const)(
    'rejects a patient GET lookup with a %s accessor without invoking it',
    async (field, expectedMessage) => {
      const requestedPatientId = 'patient-get-accessor-4201';
      const rawSentinel = `raw patient GET ${field} PHI secret 4201`;
      const getterRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const patient: Record<string, unknown> = {
        patientId: requestedPatientId,
        name: '合成GET患者',
        kana: 'ゴウセイゲットカンジャ',
        birthDate: '1970-01-01',
        sex: 'unknown',
        patientNumber: 'GET-4201',
        eligibilityStatus: 'NOT_CHECKED',
      };
      Object.defineProperty(patient, field, { enumerable: true, get: getterRead });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(async () => patient as never),
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/patients/${requestedPatientId}`,
        headers: tenantOnePatientReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: expectedMessage });
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain(requestedPatientId);
      expect(response.body).not.toContain('GET-4201');
      expect(getterRead).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['GET', 200],
    ['POST', 201],
  ] as const)(
    'hydrates one fulfilled patient descriptor snapshot for %s without semantic direct reads',
    async (method, expectedStatus) => {
      const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const requestedPatientId = 'patient-descriptor-snapshot-4201';
      const idempotencyKey = 'reception-patient-descriptor-snapshot-4201';
      const directRead = vi.fn((property: PropertyKey) => {
        throw new Error(`raw patient direct read ${String(property)} 4201`);
      });
      const rawSecondThenSentinel = 'raw second patient then read secret 4205';
      const thenRead = vi.fn(() => {
        if (thenRead.mock.calls.length > 1) throw new Error(rawSecondThenSentinel);
        return undefined;
      });
      const descriptorRead = vi.fn();
      const patientTarget = {
        patientId: requestedPatientId,
        name: '合成descriptor患者',
        kana: 'ゴウセイディスクリプタカンジャ',
        birthDate: '1988-08-08',
        sex: 'unknown' as const,
        patientNumber: 'DESC-4201',
        eligibilityStatus: 'NOT_CHECKED' as const,
        eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
      };
      const patient = new Proxy(patientTarget, {
        get(_target, property) {
          if (property === 'then') return thenRead();
          return directRead(property);
        },
        has(_target, property) {
          return directRead(property);
        },
        getPrototypeOf() {
          return directRead('getPrototypeOf');
        },
        ownKeys() {
          return directRead('ownKeys');
        },
        getOwnPropertyDescriptor(target, property) {
          descriptorRead(property);
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      });
      const create = vi.fn<ReceptionRepository['create']>(async (input) => ({
        kind: 'created',
        provenance: receptionProvenance(input, 'reception-patient-snapshot-4201'),
        entry: {
          receptionId: 'reception-patient-snapshot-4201',
          acceptedAt: acceptedAt.toISOString(),
          receptionStatus: 'WAITING',
          prescriptionIntakeType: 'paper',
          patient: input.patient,
        },
      }));
      const server = buildDevTestServer({
        now: () => acceptedAt,
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(() => Promise.resolve(patient)),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
        },
      });

      const response = await server.inject(
        method === 'GET'
          ? {
              method,
              url: `/patients/${requestedPatientId}`,
              headers: tenantOnePatientReadHeaders,
            }
          : {
              method,
              url: '/reception',
              headers: tenantOneReceptionWriteHeaders,
              payload: { patientId: requestedPatientId, idempotencyKey },
            },
      );
      await server.close();

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toMatchObject(
        method === 'GET'
          ? {
              patientId: requestedPatientId,
              eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
            }
          : {
              patient: {
                patientId: requestedPatientId,
                eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
              },
            },
      );
      expect(descriptorRead).toHaveBeenCalledTimes(8);
      expect(thenRead).toHaveBeenCalledOnce();
      expect(directRead).not.toHaveBeenCalled();
      expect(response.body).not.toContain(rawSecondThenSentinel);
      if (method === 'POST') {
        expect(create).toHaveBeenCalledOnce();
        expect(create.mock.calls[0]?.[0].patient).toEqual(patientTarget);
        expect(Object.is(create.mock.calls[0]?.[0].patient, patient)).toBe(false);
      } else {
        expect(create).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['GET', 'POST'] as const)(
    'normalizes a fulfilled revoked patient lookup for %s without raw TypeError reflection',
    async (method) => {
      const requestedPatientId = 'patient-revoked-lookup-secret-4205';
      const idempotencyKey = 'reception-revoked-lookup-secret-4205';
      const directRead = vi.fn(() => {
        throw new Error('raw revoked patient lookup trap secret 4205');
      });
      const { proxy: patient, revoke } = Proxy.revocable(
        {
          patientId: requestedPatientId,
          name: '合成 revoked患者',
          kana: 'ゴウセイ リボークドカンジャ',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: 'REVOKED-PATIENT-SECRET-4205',
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
        {
          get(_target, property) {
            if (property === 'then') return undefined;
            return directRead();
          },
          has: directRead,
          getPrototypeOf: directRead,
          ownKeys: directRead,
          getOwnPropertyDescriptor: directRead,
        },
      );
      const fulfilledPatient = new Promise<PatientSearchResult>((resolve) => {
        resolve(patient);
        revoke();
      });
      const create = vi.fn<ReceptionRepository['create']>();
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(() => fulfilledPatient),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
        },
        auditRepository: {
          list: vi.fn<AuditRepository['list']>(async () => []),
          record: auditRecord,
        },
      });

      const response = await server.inject(
        method === 'GET'
          ? {
              method,
              url: `/patients/${requestedPatientId}`,
              headers: tenantOnePatientReadHeaders,
            }
          : {
              method,
              url: '/reception',
              headers: tenantOneReceptionWriteHeaders,
              payload: { patientId: requestedPatientId, idempotencyKey },
            },
      );
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: receptionPatientIdentityMismatchErrorMessage,
      });
      for (const sensitiveValue of [
        requestedPatientId,
        idempotencyKey,
        'REVOKED-PATIENT-SECRET-4205',
        'Cannot perform',
        'raw revoked patient lookup trap secret 4205',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      expect(directRead).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
    },
  );

  it('keeps a captured patient identity authoritative after repository backing mutation', async () => {
    const requestedPatientId = 'patient-identity-snapshot-4201';
    const mutatedPatientId = 'patient-mutated-after-descriptor-secret-4201';
    const identityDescriptorRead = vi.fn();
    const directRead = vi.fn(() => {
      throw new Error(mutatedPatientId);
    });
    const patientTarget = {
      patientId: requestedPatientId,
      name: '合成snapshot患者',
      kana: 'ゴウセイスナップショットカンジャ',
      birthDate: '1999-09-09',
      sex: 'unknown' as const,
      patientNumber: 'SNAP-4201',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const patient = new Proxy(patientTarget, {
      get(_target, property) {
        if (property === 'then') return undefined;
        return directRead();
      },
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property === 'patientId') {
          identityDescriptorRead();
          target.patientId = mutatedPatientId;
        }
        return descriptor;
      },
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(() => Promise.resolve(patient)),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/patients/${requestedPatientId}`,
      headers: tenantOnePatientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ patientId: requestedPatientId });
    expect(response.body).not.toContain(mutatedPatientId);
    expect(identityDescriptorRead).toHaveBeenCalledOnce();
    expect(directRead).not.toHaveBeenCalled();
  });

  it('rejects a mismatched patient identity before inspecting other patient fields', async () => {
    const requestedPatientId = 'patient-requested-precedence-4201';
    const returnedPatientId = 'patient-returned-precedence-secret-4201';
    const nameRead = vi.fn(() => {
      throw new Error('raw mismatched patient name secret 4201');
    });
    const patient: Record<string, unknown> = {
      patientId: returnedPatientId,
      kana: 'ゴウセイフイッチカンジャ',
      birthDate: '1980-01-01',
      sex: 'unknown',
      patientNumber: 'MISMATCH-4201',
      eligibilityStatus: 'NOT_CHECKED',
    };
    Object.defineProperty(patient, 'name', { enumerable: true, get: nameRead });
    const create = vi.fn<ReceptionRepository['create']>();
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(async () => patient as never),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: {
        patientId: requestedPatientId,
        idempotencyKey: 'reception-patient-precedence-4201',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ message: receptionPatientIdentityMismatchErrorMessage });
    expect(response.body).not.toContain(returnedPatientId);
    expect(response.body).not.toContain('MISMATCH-4201');
    expect(nameRead).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('stops reception creation and audit after a patient lookup rejection', async () => {
    const requestedPatientId = 'patient-reception-lookup-secret-4193';
    const idempotencyKey = 'reception-lookup-rejection-key-secret-4193';
    const rawSentinel = `raw reception patient lookup ${requestedPatientId}`;
    const findById = vi.fn<PatientRepository['findById']>(async () => {
      throw new Error(rawSentinel);
    });
    const receptionCreate = vi.fn<ReceptionRepository['create']>();
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById,
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
      },
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
        record: auditRecord,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: requestedPatientId, idempotencyKey },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(findById).toHaveBeenCalledOnce();
    expect(receptionCreate).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({ message: patientLookupRepositoryErrorMessage });
    for (const sensitiveValue of [requestedPatientId, idempotencyKey, rawSentinel]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
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

  it('rejects a matching-identity malformed patient snapshot before reception persistence', async () => {
    const sensitivePatient = {
      patientId: 'patient-requested-synthetic-001',
      name: '合成 不正患者',
      kana: 'ゴウセイ フセイカンジャ',
      birthDate: 'invalid-sensitive-birth-date',
      sex: 'unknown' as const,
      patientNumber: 'PATIENT-SCHEMA-SENSITIVE-001',
      eligibilityStatus: 'NOT_CHECKED' as const,
    };
    const receptionCreate = vi.fn<ReceptionRepository['create']>();
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(async () => sensitivePatient),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
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
        patientId: sensitivePatient.patientId,
        idempotencyKey: 'reception-malformed-patient-snapshot',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(receptionCreate).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionPatientSchemaInvariantErrorMessage,
    });
    for (const sensitiveValue of [
      sensitivePatient.patientId,
      sensitivePatient.name,
      sensitivePatient.kana,
      sensitivePatient.birthDate,
      sensitivePatient.patientNumber,
      sensitivePatient.eligibilityStatus,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it.each([
    ['created', 'tenantId'],
    ['created', 'pharmacyId'],
    ['created', 'idempotencyKey'],
    ['created', 'receptionId'],
    ['created', 'patientId'],
    ['created', 'missingEntry'],
    ['created', 'missing'],
    ['existing', 'tenantId'],
    ['existing', 'pharmacyId'],
    ['existing', 'idempotencyKey'],
    ['existing', 'receptionId'],
    ['existing', 'patientId'],
    ['existing', 'missingEntry'],
    ['existing', 'missing'],
    ['idempotency_conflict', 'tenantId'],
    ['idempotency_conflict', 'pharmacyId'],
    ['idempotency_conflict', 'idempotencyKey'],
    ['idempotency_conflict', 'patientId'],
    ['idempotency_conflict', 'invalidReceptionId'],
    ['idempotency_conflict', 'missing'],
  ] as const)(
    'rejects %s repository result with %s provenance before branch, entry validation, audit, and response',
    async (resultKind, mismatchField) => {
      const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const requestedKey = `requested-sensitive-${resultKind}-${mismatchField}`;
      const returnedSentinel = `stored-sensitive-${resultKind}-${mismatchField}`;
      const auditRecord = vi.fn<AuditRepository['record']>();
      const create = vi.fn<ReceptionRepository['create']>(async (input) => {
        const matchingProvenance = receptionProvenance(
          input,
          resultKind === 'idempotency_conflict'
            ? 'reception-conflict-provenance'
            : 'reception-sensitive-provenance-mismatch',
          resultKind === 'idempotency_conflict'
            ? 'patient-other-provenance'
            : input.patient.patientId,
        );
        let provenance: unknown;
        if (mismatchField === 'missing') {
          provenance = undefined;
        } else if (mismatchField === 'invalidReceptionId') {
          provenance = { ...matchingProvenance, receptionId: '' };
        } else {
          const mismatchValue =
            resultKind === 'idempotency_conflict' && mismatchField === 'patientId'
              ? input.patient.patientId
              : returnedSentinel;
          provenance = { ...matchingProvenance, [mismatchField]: mismatchValue };
        }
        let result: unknown;
        if (resultKind === 'idempotency_conflict' || mismatchField === 'missingEntry') {
          result = { kind: resultKind, provenance };
        } else {
          result = {
            kind: resultKind,
            provenance,
            entry: {
              receptionId: 'reception-sensitive-provenance-mismatch',
              acceptedAt: 'invalid-sensitive-instant',
              receptionStatus: 'WAITING',
              prescriptionIntakeType: 'paper',
              patient: {
                patientId: 'patient-syn-004',
                name: '合成由来不一致患者',
                kana: 'ゴウセイユライフイッチカンジャ',
                birthDate: '1990-01-01',
                sex: 'unknown',
                patientNumber: 'PROVENANCE-SENSITIVE-001',
                eligibilityStatus: 'NOT_CHECKED',
              },
            },
          };
        }
        return result as ReceptionCreateResult;
      });
      const server = buildDevTestServer({
        now: () => acceptedAt,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
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
        payload: { patientId: 'patient-syn-004', idempotencyKey: requestedKey },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionResultIdempotencyProvenanceMismatchErrorMessage,
      });
      for (const sensitiveValue of [
        requestedKey,
        returnedSentinel,
        'reception-sensitive-provenance-mismatch',
        'patient-syn-004',
        '合成由来不一致患者',
        'ゴウセイユライフイッチカンジャ',
        'PROVENANCE-SENSITIVE-001',
        'invalid-sensitive-instant',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

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
          create: vi.fn<ReceptionRepository['create']>(async (input) => ({
            kind: resultKind,
            provenance: receptionProvenance(
              input,
              'reception-mismatched-result-999',
              mismatchedPatientId,
            ),
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

  it.each([
    ['name', { name: '合成差替氏名4207' }],
    ['kana', { kana: 'ゴウセイサシカエシメイヨンニイチゼロ' }],
    ['birthDate', { birthDate: '1965-04-05' }],
    ['sex', { sex: 'male' as const }],
    ['patientNumber', { patientNumber: 'DRIFT-4207' }],
    ['eligibilityStatus', { eligibilityStatus: 'VERIFIED' as const }],
    ['eligibilityCheckedAt added', { eligibilityCheckedAt: '2026-07-09T08:59:00.000Z' }],
    ['eligibilityCheckedAt present undefined', { eligibilityCheckedAt: undefined }],
  ] as const)(
    'rejects a created reception whose validated patient %s drifted before success audit',
    async (_label, patientMutation) => {
      const auditRecord = vi.fn<AuditRepository['record']>();
      const idempotencyKey = `reception-created-patient-drift-${_label}`;
      const create = vi.fn<ReceptionRepository['create']>(async (input) => ({
        kind: 'created',
        provenance: receptionProvenance(input, 'reception-created-patient-drift-4207'),
        entry: {
          receptionId: 'reception-created-patient-drift-4207',
          acceptedAt: input.acceptedAt.toISOString(),
          receptionStatus: 'WAITING' as const,
          prescriptionIntakeType: 'paper' as const,
          patient: { ...input.patient, ...patientMutation },
        },
      }));
      const server = buildDevTestServer({
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
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
        payload: { patientId: 'patient-syn-004', idempotencyKey },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: receptionCreatedPatientSnapshotMismatchErrorMessage,
      });
      expect(create).toHaveBeenCalledOnce();
      expect(auditRecord).not.toHaveBeenCalled();
      for (const sensitiveValue of [
        'patient-syn-004',
        idempotencyKey,
        'reception-created-patient-drift-4207',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
      for (const sensitiveValue of Object.values(patientMutation)) {
        if (typeof sensitiveValue === 'string') {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it.each([
    [
      'removed',
      (patient: Record<string, unknown>) => {
        delete patient.eligibilityCheckedAt;
      },
    ],
    [
      'changed',
      (patient: Record<string, unknown>) => {
        patient.eligibilityCheckedAt = '2026-07-09T08:59:00.001Z';
      },
    ],
  ] as const)(
    'rejects a created reception whose eligibilityCheckedAt was %s',
    async (_label, mutatePatient) => {
      const lookupPatient: PatientSearchResult = {
        patientId: patientId('patient-created-eligibility-drift-4207'),
        name: '合成資格差替患者',
        kana: 'ゴウセイシカクサシカエカンジャ',
        birthDate: '1985-04-10',
        sex: 'female',
        patientNumber: 'ELIGIBILITY-4207',
        eligibilityStatus: 'VERIFIED',
        eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
      };
      const auditRecord = vi.fn<AuditRepository['record']>();
      const create = vi.fn<ReceptionRepository['create']>(async (input) => {
        const returnedPatient = { ...input.patient } as Record<string, unknown>;
        mutatePatient(returnedPatient);
        return {
          kind: 'created' as const,
          provenance: receptionProvenance(input, 'reception-created-eligibility-drift-4207'),
          entry: {
            receptionId: 'reception-created-eligibility-drift-4207',
            acceptedAt: input.acceptedAt.toISOString(),
            receptionStatus: 'WAITING' as const,
            prescriptionIntakeType: 'paper' as const,
            patient: returnedPatient as unknown as PatientSearchResult,
          },
        };
      });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(async () => lookupPatient),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create,
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
          patientId: lookupPatient.patientId,
          idempotencyKey: `reception-created-eligibility-${_label}`,
        },
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        message: receptionCreatedPatientSnapshotMismatchErrorMessage,
      });
      expect(create).toHaveBeenCalledOnce();
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.body).not.toContain(lookupPatient.patientId);
      expect(response.body).not.toContain(lookupPatient.patientNumber);
      expect(response.body).not.toContain(lookupPatient.eligibilityCheckedAt!);
    },
  );

  it('uses detached frozen patient snapshots and rejects repository-side patient drift', async () => {
    const lookupPatient: PatientSearchResult = {
      patientId: patientId('patient-created-detached-4207'),
      name: '合成固定患者',
      kana: 'ゴウセイコテイカンジャ',
      birthDate: '1981-04-10',
      sex: 'unknown',
      patientNumber: 'DETACHED-4207',
      eligibilityStatus: 'NOT_CHECKED',
    };
    const auditRecord = vi.fn<AuditRepository['record']>();
    const create = vi.fn<ReceptionRepository['create']>(async (input) => {
      expect(input.patient).not.toBe(lookupPatient);
      expect(Object.isFrozen(input.patient)).toBe(true);
      expect(Reflect.set(input.patient, 'name', '合成直接変異4207')).toBe(false);
      return {
        kind: 'created',
        provenance: receptionProvenance(input, 'reception-created-detached-4207'),
        entry: {
          receptionId: 'reception-created-detached-4207',
          acceptedAt: input.acceptedAt.toISOString(),
          receptionStatus: 'WAITING',
          prescriptionIntakeType: 'paper',
          patient: { ...input.patient, name: '合成返却差替4207' },
        },
      };
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(async () => lookupPatient),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create,
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
        patientId: lookupPatient.patientId,
        idempotencyKey: 'reception-created-detached-4207',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: receptionCreatedPatientSnapshotMismatchErrorMessage,
    });
    expect(create).toHaveBeenCalledOnce();
    expect(auditRecord).not.toHaveBeenCalled();
    expect(lookupPatient.name).toBe('合成固定患者');
    expect(response.body).not.toContain('合成直接変異4207');
    expect(response.body).not.toContain('合成返却差替4207');
  });

  it('prioritizes created patient snapshot drift over status and acceptance-time drift', async () => {
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) => ({
          kind: 'created',
          provenance: receptionProvenance(input, 'reception-created-precedence-4207'),
          entry: {
            receptionId: 'reception-created-precedence-4207',
            acceptedAt: '2026-07-09T09:00:00.001Z',
            receptionStatus: 'COMPLETED',
            prescriptionIntakeType: 'paper',
            patient: { ...input.patient, patientNumber: 'PRECEDENCE-DRIFT-4207' },
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
        idempotencyKey: 'reception-created-precedence-4207',
      },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: receptionCreatedPatientSnapshotMismatchErrorMessage,
    });
    expect(auditRecord).not.toHaveBeenCalled();
  });

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
          create: vi.fn<ReceptionRepository['create']>(async (input) => ({
            kind: resultKind,
            provenance: receptionProvenance(
              input,
              sensitiveEntry.receptionId,
              sensitiveEntry.patient.patientId,
            ),
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
          create: vi.fn<ReceptionRepository['create']>(async (input) => ({
            kind: 'created',
            provenance: receptionProvenance(
              input,
              'reception-created-status-sensitive',
            ),
            entry: {
              receptionId: 'reception-created-status-sensitive',
              acceptedAt: '2026-07-09T09:00:00.000Z',
              receptionStatus,
              prescriptionIntakeType: 'paper',
              patient: input.patient,
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
        receptionStatus,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each([
    ['earlier', '2026-07-09T08:59:59.999Z'],
    ['later', '2026-07-09T09:00:00.001Z'],
  ] as const)(
    'rejects a created reception with a %s acceptedAt before success audit',
    async (_label, returnedAcceptedAt) => {
      const serverAcceptedAt = new Date('2026-07-09T09:00:00.000Z');
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        now: () => serverAcceptedAt,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: vi.fn<ReceptionRepository['create']>(async (input) => ({
            kind: 'created',
            provenance: receptionProvenance(
              input,
              'reception-accepted-at-sensitive',
            ),
            entry: {
              receptionId: 'reception-accepted-at-sensitive',
              acceptedAt: returnedAcceptedAt,
              receptionStatus: 'WAITING',
              prescriptionIntakeType: 'paper',
              patient: input.patient,
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
          idempotencyKey: `reception-accepted-at-${_label}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionCreatedAcceptedAtInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        returnedAcceptedAt,
        serverAcceptedAt.toISOString(),
        'reception-accepted-at-sensitive',
        'patient-syn-004',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it('passes one validated patient snapshot and server-issued instant into a created reception', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const auditAt = new Date('2026-07-09T09:00:00.100Z');
    const now = vi.fn().mockReturnValueOnce(acceptedAt).mockReturnValueOnce(auditAt);
    const receptionCreate = vi.fn<ReceptionRepository['create']>(async (input) => ({
      kind: 'created',
      provenance: receptionProvenance(input, 'reception-valid-boundary'),
      entry: {
        receptionId: 'reception-valid-boundary',
        acceptedAt: acceptedAt.toISOString(),
        receptionStatus: 'WAITING',
        prescriptionIntakeType: 'paper',
        patient: input.patient,
      },
    }));
    const backingAuditRepository = new InMemoryAuditRepository();
    const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) => {
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Object.isFrozen(input)).toBe(true);
      expect(Object.isFrozen(input.targetRef)).toBe(true);
      return backingAuditRepository.record(scope, input);
    });
    const server = buildDevTestServer({
      now,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
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
        idempotencyKey: 'reception-valid-boundary',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(201);
    expect(receptionCreate).toHaveBeenCalledOnce();
    expect(receptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: expect.objectContaining({ patientId: 'patient-syn-004' }),
        acceptedAt,
      }),
    );
    expect(auditRecord).toHaveBeenCalledOnce();
    expect(auditRecord.mock.calls[0]?.[1]).toMatchObject({
      wallClock: auditAt.toISOString(),
    });
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('normalizes a rejected reception audit append without exposing raw failure detail', async () => {
    const rawSentinel = 'raw-audit-rejection-patient-secret-4188';
    const auditRecord = vi.fn<AuditRepository['record']>(async () => {
      throw new Error(rawSentinel);
    });
    const server = buildDevTestServer({
      now: () => new Date('2026-07-09T09:00:00.000Z'),
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
        idempotencyKey: 'reception-audit-rejection-4188',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(auditRecord).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionCreatedAuditInvariantErrorMessage,
    });
    expect(response.body).not.toContain(rawSentinel);
    expect(response.body).not.toContain('patient-syn-004');
  });

  it.each([
    [
      'tenant',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { tenantId: tenantId('tenant-foreign-audit-4188') }),
      'tenant-foreign-audit-4188',
    ],
    [
      'pharmacy',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { pharmacyId: pharmacyId('pharmacy-foreign-audit-4188') }),
      'pharmacy-foreign-audit-4188',
    ],
    [
      'actor',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { actorId: userId('user-foreign-audit-4188') }),
      'user-foreign-audit-4188',
    ],
    [
      'event type',
      (event: AuditEvent) => rebuildAuditEvent(event, { auditEventType: 'audit.viewed' }),
      'audit.viewed',
    ],
    [
      'target kind',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          targetRef: { kind: 'audit_log', id: event.targetRef.id },
          aggregateType: 'audit_log',
        }),
      'audit_log',
    ],
    [
      'target id',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          targetRef: { kind: 'reception', id: 'reception-foreign-audit-4188' },
          aggregateId: 'reception-foreign-audit-4188',
        }),
      'reception-foreign-audit-4188',
    ],
    [
      'outcome',
      (event: AuditEvent) => rebuildAuditEvent(event, { outcome: 'failed' }),
      'failed',
    ],
    [
      'wall clock',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { wallClock: '2026-07-09T09:00:00.999Z' }),
      '2026-07-09T09:00:00.999Z',
    ],
    [
      'aggregate type',
      (event: AuditEvent) => rebuildAuditEvent(event, { aggregateType: 'audit_log' }),
      'audit_log',
    ],
    [
      'aggregate id',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { aggregateId: 'reception-foreign-aggregate-4188' }),
      'reception-foreign-aggregate-4188',
    ],
    [
      'reason code',
      (event: AuditEvent) => rebuildAuditEvent(event, { reasonCode: 'AUTH-0003' }),
      'AUTH-0003',
    ],
    [
      'business reason',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          businessReason: { code: 'SYNTHETIC_AUDIT_CONTRADICTION' },
        }),
      'SYNTHETIC_AUDIT_CONTRADICTION',
    ],
  ] as const)(
    'rejects a hash-valid reception audit result with mismatched %s before 201',
    async (_label, mutateAudit, rawSentinel) => {
      const backingAuditRepository = new InMemoryAuditRepository();
      const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) =>
        mutateAudit(await backingAuditRepository.record(scope, input)),
      );
      const server = buildDevTestServer({
        now: () => new Date('2026-07-09T09:00:00.000Z'),
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
          idempotencyKey: `reception-audit-mismatch-${_label}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).toHaveBeenCalledOnce();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionCreatedAuditInvariantErrorMessage,
      });
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain('patient-syn-004');
    },
  );

  it.each([
    ['null', (_event: AuditEvent): null => null],
    [
      'corrupted entry hash',
      (event: AuditEvent): AuditEvent =>
        Object.freeze({ ...event, entryHash: '0'.repeat(64) }),
    ],
  ] as const)(
    'rejects a malformed reception audit result (%s) before 201',
    async (_label, resultOf) => {
      const backingAuditRepository = new InMemoryAuditRepository();
      const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) =>
        resultOf(await backingAuditRepository.record(scope, input)) as AuditEvent,
      );
      const server = buildDevTestServer({
        now: () => new Date('2026-07-09T09:00:00.000Z'),
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
          idempotencyKey: `reception-audit-malformed-${_label}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(auditRecord).toHaveBeenCalledOnce();
      expect(response.json()).toMatchObject({ message: receptionCreatedAuditInvariantErrorMessage });
    },
  );

  it('rejects an accessor-bearing audit result without invoking its getter', async () => {
    const rawSentinel = 'raw-audit-accessor-4188';
    let getterCalls = 0;
    const backingAuditRepository = new InMemoryAuditRepository();
    const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) => {
      const event = await backingAuditRepository.record(scope, input);
      const result = { ...event } as Record<string, unknown>;
      Object.defineProperty(result, 'actorId', {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error(rawSentinel);
        },
      });
      return result as unknown as AuditEvent;
    });
    const server = buildDevTestServer({
      now: () => new Date('2026-07-09T09:00:00.000Z'),
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
        idempotencyKey: 'reception-audit-accessor-4188',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(getterCalls).toBe(0);
    expect(response.json()).toMatchObject({ message: receptionCreatedAuditInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
  });

  it.each(['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const)(
    'normalizes a throwing audit-result Proxy %s trap to the fixed invariant error',
    async (trapName) => {
      const rawSentinel = `raw-audit-proxy-${trapName}-4188`;
      const backingAuditRepository = new InMemoryAuditRepository();
      const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) => {
        const event = await backingAuditRepository.record(scope, input);
        const handler: ProxyHandler<AuditEvent> = {};
        handler[trapName] = (() => {
          throw new Error(rawSentinel);
        }) as never;
        return new Proxy(event, handler);
      });
      const server = buildDevTestServer({
        now: () => new Date('2026-07-09T09:00:00.000Z'),
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
          idempotencyKey: `reception-audit-proxy-${trapName}`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({ message: receptionCreatedAuditInvariantErrorMessage });
      expect(response.body).not.toContain(rawSentinel);
    },
  );

  it('hydrates a data-descriptor Proxy once and never directly reads the raw audit result', async () => {
    let thenReads = 0;
    let rawGetCalls = 0;
    let rawHasCalls = 0;
    const backingAuditRepository = new InMemoryAuditRepository();
    const auditRecord = vi.fn<AuditRepository['record']>(async (scope, input) => {
      const event = await backingAuditRepository.record(scope, input);
      return new Proxy(event, {
        get(_target, property) {
          if (property === 'then') {
            thenReads += 1;
            return undefined;
          }
          rawGetCalls += 1;
          throw new Error('raw audit get must not run');
        },
        has() {
          rawHasCalls += 1;
          throw new Error('raw audit has must not run');
        },
      });
    });
    const server = buildDevTestServer({
      now: () => new Date('2026-07-09T09:00:00.000Z'),
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
        idempotencyKey: 'reception-audit-data-descriptor-proxy-4188',
      },
    });

    await server.close();

    expect(thenReads).toBe(1);
    expect(rawGetCalls).toBe(0);
    expect(rawHasCalls).toBe(0);
    expect(response.statusCode).toBe(201);
    expect(auditRecord).toHaveBeenCalledOnce();
  });

  it('allows an existing reception to retain an advanced status without a duplicate audit', async () => {
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: vi.fn<ReceptionRepository['create']>(async (input) => ({
          kind: 'existing',
          provenance: receptionProvenance(input, 'reception-existing-advanced'),
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
    expect(created.json()).not.toHaveProperty('provenance');
    expect(resent.body).not.toContain(payload.idempotencyKey);
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
