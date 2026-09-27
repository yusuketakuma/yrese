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


describe('buildServer — reception create patient snapshot integrity', () => {
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
          eligibility: unverifiedEligibility,
          version: 1,
          patient: { ...input.patient, name: '合成返却差替4207' },
        },
      };
    });
    const server = buildDevTestServer({
      patientRepository: {
        search: vi.fn<PatientRepository['search']>(async () => ({ results: [] })),
        findById: vi.fn<PatientRepository['findById']>(async () => lookupPatient),
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error("unexpected patient create"); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error("unexpected patient update"); }),
      },
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => []),
        transition: vi.fn<ReceptionRepository['transition']>(),
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
        transition: vi.fn<ReceptionRepository['transition']>(),
        create: vi.fn<ReceptionRepository['create']>(async (input) => ({
          kind: 'created',
          provenance: receptionProvenance(input, 'reception-created-precedence-4207'),
          entry: {
            receptionId: 'reception-created-precedence-4207',
            acceptedAt: '2026-07-09T09:00:00.001Z',
            receptionStatus: 'COMPLETED',
            prescriptionIntakeType: 'paper',
            eligibility: unverifiedEligibility,
            version: 1,
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
        eligibility: unverifiedEligibility,
        version: 1,
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              eligibility: unverifiedEligibility,
              version: 1,
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              eligibility: unverifiedEligibility,
              version: 1,
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

  it.each([
    ['Error', new Error('raw reception clock patient-syn-004 key-secret-4211')],
    ['string', 'raw reception clock patient-syn-004 key-secret-4211'],
    ['object', { secret: 'raw reception clock patient-syn-004 key-secret-4211' }],
  ] as const)(
    'normalizes a thrown reception acceptance clock %s before create',
    async (_label, thrownValue) => {
      const receptionCreate = vi.fn<ReceptionRepository['create']>();
      const auditRecord = vi.fn<AuditRepository['record']>();
      const now = vi.fn(() => {
        throw thrownValue;
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
          idempotencyKey: 'reception-clock-read-key-secret-4211',
        },
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({ message: receptionAcceptedAtClockReadErrorMessage });
      expect(now).toHaveBeenCalledOnce();
      expect(receptionCreate).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
      for (const sensitiveValue of [
        'raw reception clock patient-syn-004 key-secret-4211',
        'patient-syn-004',
        'reception-clock-read-key-secret-4211',
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

});
