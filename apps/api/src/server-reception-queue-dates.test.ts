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

describe('buildServer — reception queue business dates and scope', () => {
  it('accepts an entry whose UTC date differs but whose JST business date matches the request', async () => {
    const boundaryEntry = {
      receptionId: 'reception-jst-boundary',
      acceptedAt: '2026-07-09T15:00:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      eligibility: unverifiedEligibility,
      version: 1,
      patient: {
        patientId: 'patient-jst-boundary',
        name: '合成 境界患者',
        kana: 'ゴウセイ キョウカイカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'JST-BOUNDARY-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const list = vi.fn<ReceptionRepository['list']>(async () => [boundaryEntry]);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>(), transition: vi.fn<ReceptionRepository['transition']>() },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-10',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ date: '2026-07-10', entries: [boundaryEntry] });
  });

  it.each([
    ['0001-01-01', '0001-01-01T00:00:00.000Z'],
    ['0099-12-31', '0099-12-31T14:59:59.999Z'],
    ['0100-01-01', '0099-12-31T15:00:00.000Z'],
    ['9999-12-31', '9999-12-31T14:59:59.999Z'],
  ] as const)(
    'accepts canonical low/upper JST business date %s from %s',
    async (date, acceptedAt) => {
      const boundaryEntry = {
        receptionId: `reception-canonical-${date}`,
        acceptedAt,
        receptionStatus: 'WAITING' as const,
        prescriptionIntakeType: 'paper' as const,
        eligibility: unverifiedEligibility,
        version: 1,
        patient: {
          patientId: `patient-canonical-${date}`,
          name: '合成 暦日境界患者',
          kana: 'ゴウセイ レキジツキョウカイカンジャ',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: `CALENDAR-${date}`,
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
      };
      const list = vi.fn<ReceptionRepository['list']>(async () => [boundaryEntry]);
      const server = buildDevTestServer({
        receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>(), transition: vi.fn<ReceptionRepository['transition']>() },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/reception/queue?date=${date}`,
        headers: tenantOneReceptionReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ date, entries: [boundaryEntry] });
    },
  );

  it.each([
    ['local BCE', '0001-01-01', '0000-01-01T00:00:00.000Z'],
    ['JST year 10000', '9999-12-31', '9999-12-31T15:00:00.000Z'],
  ] as const)(
    'rejects %s queue evidence with the fixed non-PHI business-date invariant',
    async (_label, requestedDate, acceptedAt) => {
      const boundaryEntry = {
        receptionId: 'reception-calendar-sensitive-4232',
        acceptedAt,
        receptionStatus: 'WAITING' as const,
        prescriptionIntakeType: 'paper' as const,
        eligibility: unverifiedEligibility,
        version: 1,
        patient: {
          patientId: 'patient-calendar-sensitive-4232',
          name: '合成 暦日機密患者',
          kana: 'ゴウセイ レキジツキミツカンジャ',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: 'CALENDAR-SECRET-4232',
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
      };
      const list = vi.fn<ReceptionRepository['list']>(async () => [boundaryEntry]);
      const server = buildDevTestServer({
        receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>(), transition: vi.fn<ReceptionRepository['transition']>() },
      });

      const response = await server.inject({
        method: 'GET',
        url: `/reception/queue?date=${requestedDate}`,
        headers: tenantOneReceptionReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionQueueBusinessDateInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        requestedDate,
        acceptedAt,
        boundaryEntry.receptionId,
        boundaryEntry.patient.patientId,
        boundaryEntry.patient.name,
        boundaryEntry.patient.kana,
        boundaryEntry.patient.patientNumber,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each([
    ['previous', '2026-07-08T14:59:59.999Z'],
    ['next', '2026-07-09T15:00:00.000Z'],
  ] as const)('rejects a schema-valid entry from the %s JST business date without echoing PHI', async (_label, acceptedAt) => {
    const wrongDateEntry = {
      receptionId: 'reception-wrong-date-sensitive',
      acceptedAt,
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      eligibility: unverifiedEligibility,
      version: 1,
      patient: {
        patientId: 'patient-wrong-date-sensitive',
        name: '合成 別日患者',
        kana: 'ゴウセイ ベツジツカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'WRONG-DATE-SECRET-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const list = vi.fn<ReceptionRepository['list']>(async () => [wrongDateEntry]);
    const server = buildDevTestServer({
      receptionRepository: { list, create: vi.fn<ReceptionRepository['create']>(), transition: vi.fn<ReceptionRepository['transition']>() },
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
      statusCode: 500,
      error: 'Internal Server Error',
      message: receptionQueueBusinessDateInvariantErrorMessage,
    });
    for (const sensitiveValue of [
      '2026-07-09',
      wrongDateEntry.receptionId,
      wrongDateEntry.acceptedAt,
      wrongDateEntry.receptionStatus,
      wrongDateEntry.patient.patientId,
      wrongDateEntry.patient.name,
      wrongDateEntry.patient.kana,
      wrongDateEntry.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it('rejects a mixed-date queue without returning the otherwise-valid row', async () => {
    const valid = {
      receptionId: 'reception-valid-sensitive',
      acceptedAt: '2026-07-09T00:15:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      eligibility: unverifiedEligibility,
      version: 1,
      patient: {
        patientId: 'patient-valid-sensitive',
        name: '合成 当日患者',
        kana: 'ゴウセイ トウジツカンジャ',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'VALID-DATE-SECRET-001',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const wrongDate = {
      ...valid,
      receptionId: 'reception-mixed-wrong-date',
      acceptedAt: '2026-07-09T15:00:00.000Z',
      patient: {
        ...valid.patient,
        patientId: 'patient-mixed-wrong-date',
        patientNumber: 'MIXED-WRONG-SECRET-001',
      },
    };
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [valid, wrongDate]),
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
    expect(response.body).toContain(receptionQueueBusinessDateInvariantErrorMessage);
    for (const sensitiveValue of [
      valid.receptionId,
      valid.patient.patientId,
      valid.patient.patientNumber,
      wrongDate.receptionId,
      wrongDate.patient.patientId,
      wrongDate.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it.each([
    ['identical', false],
    ['conflicting', true],
  ] as const)(
    'rejects %s duplicate reception identities without returning a partial queue',
    async (_label, conflicting) => {
      const duplicateReceptionId = 'reception-duplicate-sensitive';
      const first = {
        receptionId: duplicateReceptionId,
        acceptedAt: '2026-07-09T00:15:00.000Z',
        receptionStatus: 'WAITING' as const,
        prescriptionIntakeType: 'paper' as const,
        eligibility: unverifiedEligibility,
        version: 1,
        patient: {
          patientId: 'patient-reception-duplicate-a',
          name: '合成 重複受付A',
          kana: 'ゴウセイ ジュウフクウケツケエー',
          birthDate: '1990-01-01',
          sex: 'unknown' as const,
          patientNumber: 'RECEPTION-DUPLICATE-001',
          eligibilityStatus: 'NOT_CHECKED' as const,
        },
      };
      const second = conflicting
        ? {
            ...first,
            acceptedAt: '2026-07-09T15:00:00.000Z',
            receptionStatus: 'IN_PROGRESS' as const,
            patient: {
              ...first.patient,
              patientId: 'patient-reception-duplicate-b',
              name: '合成 矛盾受付B',
              kana: 'ゴウセイ ムジュンウケツケビー',
              patientNumber: 'RECEPTION-DUPLICATE-999',
            },
          }
        : { ...first, patient: { ...first.patient } };
      const list = vi.fn<ReceptionRepository['list']>(async () => [first, second]);
      const server = buildDevTestServer({
        receptionRepository: {
          list,
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
      expect(list).toHaveBeenCalledOnce();
      expect(list).toHaveBeenCalledWith({
        tenantId: tenantOneReceptionReadHeaders['x-dev-tenant'],
        pharmacyId: tenantOneReceptionReadHeaders['x-dev-pharmacy'],
        date: '2026-07-09',
      });
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: receptionQueueDuplicateIdentityInvariantErrorMessage,
      });
      for (const queueEntry of [first, second]) {
        for (const sensitiveValue of [
          queueEntry.receptionId,
          queueEntry.acceptedAt,
          queueEntry.receptionStatus,
          queueEntry.patient.patientId,
          queueEntry.patient.name,
          queueEntry.patient.kana,
          queueEntry.patient.patientNumber,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it('prioritizes queue schema failure over a duplicate reception identity', async () => {
    const receptionIdentity = 'reception-schema-before-duplicate-4202';
    const valid = {
      receptionId: receptionIdentity,
      acceptedAt: '2026-07-09T09:00:00.000Z',
      receptionStatus: 'WAITING' as const,
      prescriptionIntakeType: 'paper' as const,
      eligibility: unverifiedEligibility,
      version: 1,
      patient: {
        patientId: 'patient-schema-before-duplicate-a-4202',
        name: '合成 schema優先患者A',
        kana: 'ゴウセイ スキーマユウセンカンジャエー',
        birthDate: '1990-01-01',
        sex: 'unknown' as const,
        patientNumber: 'SCHEMA-FIRST-A-4202',
        eligibilityStatus: 'NOT_CHECKED' as const,
      },
    };
    const invalid = {
      ...valid,
      receptionStatus: 'RAW_INVALID_RECEPTION_STATUS_SECRET_4202',
      patient: {
        ...valid.patient,
        patientId: 'patient-schema-before-duplicate-b-4202',
        patientNumber: 'SCHEMA-FIRST-B-4202',
      },
    };
    const server = buildDevTestServer({
      receptionRepository: {
        list: vi.fn<ReceptionRepository['list']>(async () => [valid, invalid] as never),
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
      receptionIdentity,
      invalid.receptionStatus,
      valid.patient.patientId,
      invalid.patient.patientId,
      valid.patient.patientNumber,
      invalid.patient.patientNumber,
    ]) {
      expect(response.body).not.toContain(sensitiveValue);
    }
  });

  it('denies /reception/queue when patient read scope is missing', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: {
        ...tenantOneReceptionReadHeaders,
        'x-dev-scopes': 'reception:read',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('returns RCV-0001 for invalid reception queue dates', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-02-31',
      headers: tenantOneReceptionReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: receptionInvalidRequestErrorCode,
      message: 'Invalid reception request',
    });
  });

});
