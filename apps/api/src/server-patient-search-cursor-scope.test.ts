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


describe('buildServer — patient search cursor scope', () => {
  it('keeps cursor scope/query opaque and rejects an authenticated offset mutation', async () => {
    const cursorKey = randomBytes(patientSearchCursorHmacKeyByteLength);
    const server = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(cursorKey),
    });
    const query = '合成';
    const firstPage = await server.inject({
      method: 'GET',
      url: `/patients/search?q=${encodeURIComponent(query)}&limit=1`,
      headers: tenantOnePatientReadHeaders,
    });
    const cursor = firstPage.json().nextCursor as string;
    const tokenBody = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;

    expect(Object.keys(tokenBody)).toEqual(['v', 'o', 'm']);
    const serializedBody = JSON.stringify(tokenBody);
    expect(serializedBody).not.toContain(query);
    expect(serializedBody).not.toContain(tenantOnePatientReadHeaders['x-dev-tenant']);
    expect(serializedBody).not.toContain(tenantOnePatientReadHeaders['x-dev-pharmacy']);
    expect(serializedBody).not.toContain(createHash('sha256').update(query).digest('hex'));

    const tamperedCursor = Buffer.from(
      JSON.stringify({ v: tokenBody.v, o: 999, m: tokenBody.m }),
      'utf8',
    ).toString('base64url');
    const tampered = await server.inject({
      method: 'GET',
      url: `/patients/search?q=${encodeURIComponent(query)}&limit=1&cursor=${encodeURIComponent(tamperedCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(tampered.statusCode).toBe(400);
    expect(tampered.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('accepts a cursor across servers with the same key and rejects it with a different key', async () => {
    const sharedKey = randomBytes(patientSearchCursorHmacKeyByteLength);
    const issuer = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(sharedKey),
    });
    const sameKeyVerifier = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(sharedKey),
    });
    const differentKeyVerifier = buildDevTestServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(
        randomBytes(patientSearchCursorHmacKeyByteLength),
      ),
    });
    const firstPage = await issuer.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const cursor = firstPage.json().nextCursor as string;

    const sameKeyPage = await sameKeyVerifier.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(cursor)}`,
      headers: tenantOnePatientReadHeaders,
    });
    const differentKeyPage = await differentKeyVerifier.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(cursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await Promise.all([issuer.close(), sameKeyVerifier.close(), differentKeyVerifier.close()]);

    expect(firstPage.statusCode).toBe(200);
    expect(sameKeyPage.statusCode).toBe(200);
    expect(
      sameKeyPage.json().results.map((result: { patientId: string }) => result.patientId),
    ).toEqual(['patient-syn-004', 'patient-syn-005', 'patient-syn-006']);
    expect(differentKeyPage.statusCode).toBe(400);
    expect(differentKeyPage.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects the legacy unsigned patient search cursor without downgrade decoding', async () => {
    const server = buildDevTestServer();
    const legacyCursor = Buffer.from(
      JSON.stringify({
        t: 'tenant-001',
        p: 'pharmacy-001',
        qh: createHash('sha256').update('合成').digest('hex'),
        offset: 1,
      }),
      'utf8',
    ).toString('base64url');

    const response = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=1&cursor=${encodeURIComponent(legacyCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse across tenant boundaries', async () => {
    const server = buildDevTestServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const crossTenant = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: tenantTwoPatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(crossTenant.statusCode).toBe(400);
    expect(crossTenant.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse across pharmacy boundaries', async () => {
    const server = buildDevTestServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const crossPharmacy = await server.inject({
      method: 'GET',
      url: `/patients/search?q=合成&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: otherPharmacyPatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(crossPharmacy.statusCode).toBe(400);
    expect(crossPharmacy.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

  it('rejects cursor reuse with a different query', async () => {
    const server = buildDevTestServer();

    const firstPage = await server.inject({
      method: 'GET',
      url: '/patients/search?q=合成&limit=3',
      headers: tenantOnePatientReadHeaders,
    });
    const firstBody = firstPage.json();

    const differentQuery = await server.inject({
      method: 'GET',
      url: `/patients/search?q=SYN&limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: tenantOnePatientReadHeaders,
    });

    await server.close();

    expect(firstPage.statusCode).toBe(200);
    expect(differentQuery.statusCode).toBe(400);
    expect(differentQuery.json()).toEqual({
      errorCode: patientSearchInvalidQueryErrorCode,
      message: 'Invalid patient search query',
    });
  });

});
