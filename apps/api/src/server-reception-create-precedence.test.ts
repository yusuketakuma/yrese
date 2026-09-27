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


describe('buildServer — reception create field precedence', () => {
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
              eligibility: unverifiedEligibility,
              version: 1,
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
          transition: vi.fn<ReceptionRepository['transition']>(),
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
              eligibility: unverifiedEligibility,
              version: 1,
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
          eligibility: unverifiedEligibility,
          version: 1,
          patient: { ...input.patient, ...patientMutation },
        },
      }));
      const server = buildDevTestServer({
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
            eligibility: unverifiedEligibility,
            version: 1,
            patient: returnedPatient as unknown as PatientSearchResult,
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

});
