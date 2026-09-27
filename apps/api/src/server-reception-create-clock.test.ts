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


describe('buildServer — reception create clock authority', () => {
  it('does not inspect a hostile value thrown by the reception acceptance clock', async () => {
    let propertyReads = 0;
    const thrownValue = new Proxy(
      {},
      {
        get() {
          propertyReads += 1;
          throw new Error('raw reception clock proxy secret 4211');
        },
      },
    );
    const receptionCreate = vi.fn<ReceptionRepository['create']>();
    const auditRecord = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      now: () => {
        throw thrownValue;
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        idempotencyKey: 'reception-clock-hostile-throw-4211',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ message: receptionAcceptedAtClockReadErrorMessage });
    expect(propertyReads).toBe(0);
    expect(receptionCreate).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
    expect(response.body).not.toContain('raw reception clock proxy secret 4211');
  });

  it('rejects invalid reception acceptance clock authorities before create', async () => {
    const fakeToISOString = vi.fn(() => '2026-07-09T09:00:00.000Z');
    const invalidValues: readonly unknown[] = [
      undefined,
      null,
      '2026-07-09T09:00:00.000Z',
      0,
      false,
      0n,
      Symbol('clock'),
      () => new Date(),
      [],
      { toISOString: fakeToISOString },
      Promise.resolve(new Date()),
      new Date(Number.NaN),
      Object.create(Date.prototype),
    ];

    for (const invalidValue of invalidValues) {
      const receptionCreate = vi.fn<ReceptionRepository['create']>();
      const auditRecord = vi.fn<AuditRepository['record']>();
      const now = vi.fn(() => invalidValue as Date);
      const server = buildDevTestServer({
        now,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: receptionCreate,
          transition: vi.fn<ReceptionRepository['transition']>(),
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
          idempotencyKey: 'reception-invalid-clock-key-secret-4211',
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        message: receptionAcceptedAtClockInvariantErrorMessage,
      });
      expect(now).toHaveBeenCalledOnce();
      expect(receptionCreate).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.body).not.toContain('Invalid time value');
      expect(response.body).not.toContain('reception-invalid-clock-key-secret-4211');
      expect(response.body).not.toContain('patient-syn-004');
    }

    expect(fakeToISOString).not.toHaveBeenCalled();
  });

  it.each(['hostile', 'revoked'] as const)(
    'rejects a %s Date Proxy as a reception acceptance clock without semantic traps',
    async (mode) => {
      let semanticTraps = 0;
      const handler: ProxyHandler<Date> = {
        get() {
          semanticTraps += 1;
          throw new Error('raw reception Date Proxy secret 4211');
        },
        getPrototypeOf() {
          semanticTraps += 1;
          throw new Error('raw reception Date Proxy prototype secret 4211');
        },
      };
      const rawDate = new Date('2026-07-09T09:00:00.000Z');
      let value: Date;
      if (mode === 'revoked') {
        const revocable = Proxy.revocable(rawDate, handler);
        value = revocable.proxy;
        revocable.revoke();
      } else {
        value = new Proxy(rawDate, handler);
      }
      const receptionCreate = vi.fn<ReceptionRepository['create']>();
      const auditRecord = vi.fn<AuditRepository['record']>();
      const server = buildDevTestServer({
        now: () => value,
        receptionRepository: {
          list: vi.fn<ReceptionRepository['list']>(async () => []),
          create: receptionCreate,
          transition: vi.fn<ReceptionRepository['transition']>(),
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
          idempotencyKey: `reception-${mode}-clock-proxy-4211`,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        message: receptionAcceptedAtClockInvariantErrorMessage,
      });
      expect(semanticTraps).toBe(0);
      expect(receptionCreate).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
      expect(response.body).not.toContain('raw reception Date Proxy');
      expect(response.body).not.toContain('Cannot perform');
    },
  );

  it('passes a detached intrinsic reception instant without reading an own clock method', async () => {
    const acceptedAtIso = '2026-07-09T09:00:00.000Z';
    const rawAcceptedAt = new Date(acceptedAtIso);
    let ownMethodReads = 0;
    Object.defineProperty(rawAcceptedAt, 'toISOString', {
      configurable: true,
      get() {
        ownMethodReads += 1;
        throw new Error('raw own reception clock method secret 4211');
      },
    });
    const auditAt = new Date('2026-07-09T09:00:00.100Z');
    const now = vi.fn().mockReturnValueOnce(rawAcceptedAt).mockReturnValueOnce(auditAt);
    const receptionCreate = vi.fn<ReceptionRepository['create']>(async (input) => {
      expect(input.acceptedAt).not.toBe(rawAcceptedAt);
      expect(Object.getPrototypeOf(input.acceptedAt)).toBe(Date.prototype);
      expect(Object.hasOwn(input.acceptedAt, 'toISOString')).toBe(false);
      expect(Date.prototype.toISOString.call(input.acceptedAt)).toBe(acceptedAtIso);
      input.acceptedAt.setTime(input.acceptedAt.getTime() + 86_400_000);
      return {
        kind: 'created',
        provenance: receptionProvenance(input, 'reception-detached-clock-4211'),
        entry: {
          receptionId: 'reception-detached-clock-4211',
          acceptedAt: acceptedAtIso,
          receptionStatus: 'WAITING',
          prescriptionIntakeType: 'paper',
          eligibility: unverifiedEligibility,
          version: 1,
          patient: input.patient,
        },
      };
    });
    const backingAuditRepository = new InMemoryAuditRepository();
    const auditRecord = vi.fn<AuditRepository['record']>((scope, input) =>
      backingAuditRepository.record(scope, input),
    );
    const server = buildDevTestServer({
      now,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        idempotencyKey: 'reception-detached-clock-key-4211',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ acceptedAt: acceptedAtIso });
    expect(ownMethodReads).toBe(0);
    expect(Date.prototype.toISOString.call(rawAcceptedAt)).toBe(acceptedAtIso);
    expect(now).toHaveBeenCalledTimes(2);
    expect(receptionCreate).toHaveBeenCalledOnce();
    expect(auditRecord).toHaveBeenCalledOnce();
    expect(auditRecord.mock.calls[0]?.[1]).toMatchObject({ wallClock: auditAt.toISOString() });
    expect(response.body).not.toContain('raw own reception clock method secret 4211');
  });

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
        eligibility: unverifiedEligibility,
        version: 1,
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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

});
