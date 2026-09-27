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
} from './patient-search-cursor.js';
import type { PatientRepository } from './patient-repository.js';
import {
  InMemoryReceptionRepository,
  type ReceptionCreateInput,
  type ReceptionCreateResult,
  type ReceptionRepository,
} from './reception-repository.js';
import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
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


describe('buildServer — reception create audit/idempotency outcomes', () => {
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
    const now = vi.fn(() => new Date('2026-07-09T09:00:00.000Z'));
    const server = buildDevTestServer({
      now,
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(async (input) => ({
          kind: 'existing',
          provenance: receptionProvenance(input, 'reception-existing-advanced'),
          entry: {
            receptionId: 'reception-existing-advanced',
            acceptedAt: '2026-07-09T09:00:00.000Z',
            receptionStatus: 'IN_PROGRESS',
            prescriptionIntakeType: 'paper',
            eligibility: unverifiedEligibility,
            version: 1,
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
    expect(now).toHaveBeenCalledOnce();
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
    const now = vi.fn(() => acceptedAt);
    const server = buildDevTestServer({
      now,
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
    expect(now).toHaveBeenCalledTimes(3);
  });

  it('returns RCV-0003 when an idempotency key is reused with a different patient', async () => {
    const now = vi.fn(() => new Date('2026-07-09T09:10:00.000Z'));
    const server = buildDevTestServer({
      now,
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
    expect(now).toHaveBeenCalledTimes(3);
  });

  it('returns RCV-0001 for invalid reception create requests', async () => {
    const now = vi.fn(() => new Date('2026-07-09T09:00:00.000Z'));
    const server = buildDevTestServer({ now });

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
    expect(now).not.toHaveBeenCalled();
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
