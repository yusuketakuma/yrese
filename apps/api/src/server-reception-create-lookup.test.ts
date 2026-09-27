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


describe('buildServer — reception create patient lookup hostile input', () => {
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
        createHostileProxy(propertyRead),
    ],
  ] as const)(
    'normalizes a patient GET repository rejection from %s without inspecting it',
    async (_label, createRejection) => {
      const requestedPatientId = 'patient-lookup-rejection-secret-4193';
      const rawSentinel = `raw patient lookup rejection ${requestedPatientId}`;
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const findVersionedByIdCalls = vi.fn<PatientRepository['findVersionedById']>();
      const findVersionedById: PatientRepository['findVersionedById'] = (scope) => {
        findVersionedByIdCalls(scope);
        throw createRejection(rawSentinel, propertyRead);
      };
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(async () => undefined),
          findVersionedById,
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error('unexpected patient create'); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error('unexpected patient update'); }),
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
      expect(findVersionedByIdCalls).toHaveBeenCalledExactlyOnceWith({
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
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          transition: vi.fn<ReceptionRepository['transition']>(),
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
        version: 1,
      };
      Object.defineProperty(patient, field, { enumerable: true, get: getterRead });
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(async () => patient as never),
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => patient as never),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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
        version: 1,
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
          eligibility: unverifiedEligibility,
          version: 1,
          patient: input.patient,
        },
      }));
      const server = buildDevTestServer({
        now: () => acceptedAt,
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(() => Promise.resolve(patient)),
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(() => Promise.resolve(patient)),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              version: 1,
            }
          : {
              patient: {
                patientId: requestedPatientId,
                eligibilityCheckedAt: '2026-07-09T08:59:00.000Z',
              },
            },
      );
      // GET は version 付き要約を snapshot するため descriptor 読取りが 1 件多い。
      expect(descriptorRead).toHaveBeenCalledTimes(method === 'GET' ? 9 : 8);
      expect(thenRead).toHaveBeenCalledOnce();
      expect(directRead).not.toHaveBeenCalled();
      expect(response.body).not.toContain(rawSecondThenSentinel);
      if (method === 'POST') {
        expect(create).toHaveBeenCalledOnce();
        const { version: _descriptorOnlyVersion, ...expectedPatientSnapshot } = patientTarget;
        expect(create.mock.calls[0]?.[0].patient).toEqual(expectedPatientSnapshot);
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
          version: 1,
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
      const fulfilledPatient = new Promise<PatientVersionedSummary>((resolve) => {
        resolve(patient as PatientVersionedSummary);
        revoke();
      });
      const create = vi.fn<ReceptionRepository['create']>();
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        patientRepository: {
          search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
          findById: vi.fn<PatientRepository['findById']>(() => fulfilledPatient),
          findVersionedById: vi.fn<PatientRepository['findVersionedById']>(() => fulfilledPatient),
          create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
          update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
        },
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          transition: vi.fn<ReceptionRepository['transition']>(),
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

});
