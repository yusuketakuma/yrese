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


describe('buildServer — patient search anti-tamper inputs', () => {

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
});
