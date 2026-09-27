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
  RECEPTION_QUEUE_MAX_ENTRIES,
  type PatientSearchResult,
  type PatientVersionedSummary,
} from '@yrese/contracts';
import { patientId, pharmacyId, receptionId, tenantId, userId } from '@yrese/shared-kernel';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
  postgresCompositionConfigurationErrorMessage,
} from './config.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
  type PatientSearchCursorCodec,
} from './patient/patient-search-cursor.js';
import type { PatientRepository } from './patient/patient-repository.js';
import {
  InMemoryReceptionRepository,
  type ReceptionCreateInput,
  type ReceptionCreateResult,
  type ReceptionRepository,
} from './reception/reception-repository.js';
import { InMemoryAuditRepository, type AuditRepository } from './audit/audit-repository.js';
import {
  apiVersion,
  buildServer,
  healthClockReadErrorMessage,
  healthClockInvariantErrorMessage,
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
  receptionAcceptedAtClockReadErrorMessage,
  receptionAcceptedAtClockInvariantErrorMessage,
  receptionCreatedAuditInvariantErrorMessage,
  receptionResultPatientIdentityMismatchErrorMessage,
  receptionResultIdempotencyProvenanceMismatchErrorMessage,
  receptionResultKindInvariantErrorMessage,
  receptionResultSchemaInvariantErrorMessage,
  receptionPatientNotFoundErrorCode,
  type BuildServerOptions,
  type HealthResponse,
} from './server.js';


import {
  receptionProvenance,
  rebuildAuditEvent,
  buildDevTestServer,
  createHostileProxy,
  buildDefaultTestServer,
  unverifiedEligibility,
  tenantOnePatientReadHeaders,
  tenantTwoPatientReadHeaders,
  otherPharmacyPatientReadHeaders,
  devUiPatientReadHeaders,
  tenantOneTenantReadHeaders,
  tenantOneReceptionReadHeaders,
  tenantOneReceptionWriteHeaders,
  malformedDevIdHeaderCases,
  sensitiveRouteCases,
} from './server-test-support.js';


describe('buildServer — patient search and cursor', () => {
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
        createHostileProxy(propertyRead),
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
      const decodeCalls = vi.fn();
      const decode: PatientSearchCursorCodec['decode'] = () => {
        decodeCalls();
        throw thrownValue;
      };
      const search = vi.fn<PatientRepository['search']>();
      const encode = vi.fn<PatientSearchCursorCodec['encode']>();
      const server = buildDevTestServer({
        patientSearchCursorCodec: { decode, encode },
        patientRepository: {
          search,
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
      expect(decodeCalls).toHaveBeenCalledOnce();
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        createHostileProxy(propertyRead),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        createHostileProxy(propertyRead),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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

});
