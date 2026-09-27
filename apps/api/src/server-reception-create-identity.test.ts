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


describe('buildServer — reception create patient identity authority', () => {
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
      version: 1,
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(() => Promise.resolve(patient)),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error('unexpected patient create'); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error('unexpected patient update'); }),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error('unexpected patient create'); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error('unexpected patient update'); }),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        create: receptionCreate,
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
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

});
