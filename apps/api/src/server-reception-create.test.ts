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


describe('buildServer — reception create', () => {
  it('surfaces a legacy orphan reception on idempotent resend without inventing audit evidence (WP-4050 HIGH-1)', async () => {
    const acceptedAt = new Date('2026-07-09T09:00:00.000Z');
    const receptionRepository = new InMemoryReceptionRepository();
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({
      now: () => acceptedAt,
      receptionRepository,
      auditRepository,
    });

    const created = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: 'patient-syn-004', idempotencyKey: 'reception-orphan-complete' },
    });
    expect(created.statusCode).toBe(201);
    const auditCountAfterCreate = (await auditRepository.list({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
    })).length;

    // 境界導入前の受付を模す: リポジトリ直接 create(監査・outbox なし)。
    const legacy = await receptionRepository.create({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
      patient: created.json().patient,
      idempotencyKey: 'reception-orphan-legacy',
      acceptedAt,
    });
    expect(legacy.kind).toBe('created');

    const completeResend = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: 'patient-syn-004', idempotencyKey: 'reception-orphan-complete' },
    });
    const orphanResend = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: tenantOneReceptionWriteHeaders,
      payload: { patientId: 'patient-syn-004', idempotencyKey: 'reception-orphan-legacy' },
    });
    const auditCountAfterResends = (await auditRepository.list({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
    })).length;
    await server.close();

    expect(completeResend.statusCode).toBe(200);
    expect(completeResend.headers).not.toHaveProperty('x-yrese-reconciliation');
    expect(orphanResend.statusCode).toBe(200);
    expect(orphanResend.headers['x-yrese-reconciliation']).toBe('legacy_orphan');
    expect(orphanResend.headers['cache-control']).toBe('no-store');
    expect(orphanResend.json()).not.toHaveProperty('provenance');
    // 元の actor / 時刻を捏造した修復をしない: 再送で監査は増えない。
    expect(auditCountAfterResends).toBe(auditCountAfterCreate);
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
      eligibility: unverifiedEligibility,
      version: 1,
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
        createHostileProxy(propertyRead),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
            eligibility: unverifiedEligibility,
            version: 1,
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(async (input) =>
          ({
            kind: 'forged_existing_kind',
            provenance: receptionProvenance(input, 'reception-forged-kind-secret-4198'),
            entry: {
              receptionId: 'reception-forged-kind-secret-4198',
              acceptedAt: acceptedAt.toISOString(),
              receptionStatus: 'COMPLETED',
              prescriptionIntakeType: 'paper',
              eligibility: unverifiedEligibility,
              version: 1,
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
        Object.defineProperty(
          {},
          'kind',
          { enumerable: true, get: getterRead as unknown as () => never },
        ),
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(async (input) => {
          target.provenance = receptionProvenance(input, 'reception-kind-snapshot-4198');
          target.entry = {
            receptionId: 'reception-kind-snapshot-4198',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING',
            prescriptionIntakeType: 'paper',
            eligibility: unverifiedEligibility,
            version: 1,
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              eligibility: unverifiedEligibility,
              version: 1,
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              eligibility: unverifiedEligibility,
              version: 1,
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
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>((input) => {
          const patient = descriptorProxy({ ...input.patient });
          const entry = descriptorProxy({
            receptionId: 'reception-descriptor-graph-4199',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING',
            prescriptionIntakeType: 'paper',
            eligibility: unverifiedEligibility,
            version: 1,
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
    expect(descriptorRead).toHaveBeenCalledTimes(23);
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
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(async (input) => {
          const entryTarget = {
            receptionId: 'reception-entry-snapshot-4199',
            acceptedAt: acceptedAt.toISOString(),
            receptionStatus: 'WAITING' as const,
            prescriptionIntakeType: 'paper' as const,
            eligibility: unverifiedEligibility,
            version: 1,
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
        transition: vi.fn<ReceptionRepository['transition']>(),
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
