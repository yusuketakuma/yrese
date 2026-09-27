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

describe('buildServer — reception queue', () => {
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
        createHostileProxy(propertyRead),
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
        receptionRepository: { list, create, transition: vi.fn<ReceptionRepository['transition']>() },
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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

  it('returns 503 RCV-0007 when the queue exceeds the defensive cap and does not record a view audit', async () => {
    const record = vi.fn<AuditRepository['record']>();
    const entries = new Array(RECEPTION_QUEUE_MAX_ENTRIES + 1).fill({});
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => entries as never),
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(),
      },
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: tenantOneReceptionReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      errorCode: 'RCV-0007',
      message: 'Reception queue exceeds the servable bound',
      nextAction:
        '当日受付件数が上限を超えています。件数が正常であれば運用手順に従ってシステム管理者へ連絡してください。',
    });
    expect(record).not.toHaveBeenCalled();
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
      eligibility: unverifiedEligibility,
      version: 1,
    };
    Object.defineProperty(entry, 'acceptedAt', { enumerable: true, get: getterRead });
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [entry] as never),
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
      eligibility: unverifiedEligibility,
      version: 1,
    });
    const entries = [entry];
    const list = vi.fn<ReceptionRepository['list']>(async () => entries as never);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>(), transition: vi.fn<ReceptionRepository['transition']>() },
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
          eligibility: unverifiedEligibility,
          version: 1,
        },
      ],
    });
    expect(descriptorRead).toHaveBeenCalledTimes(15);
    expect(directRead).not.toHaveBeenCalled();
  });

});
