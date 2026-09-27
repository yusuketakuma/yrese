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

describe('buildServer — health, whoami, dev tenant context, server construction', () => {
  it('returns health status without PHI or database dependencies', async () => {
    const healthTimestamp = new Date('2026-07-09T10:20:00.000Z');
    const now = vi.fn(() => healthTimestamp);
    const server = buildDefaultTestServer({
      now,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBeUndefined();

    const body = response.json<HealthResponse>();

    expect(body).toMatchObject({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: healthTimestamp.toISOString(),
    });
    expect(now).toHaveBeenCalledOnce();
  });

  it.each([
    ['Error', new Error('raw health clock secret 4212')],
    ['string', 'raw health clock secret 4212'],
    ['object', { secret: 'raw health clock secret 4212' }],
  ] as const)('normalizes a thrown health clock %s', async (_label, thrownValue) => {
    const now = vi.fn(() => {
      throw thrownValue;
    });
    const server = buildDefaultTestServer({ now });

    const response = await server.inject({ method: 'GET', url: '/health' });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(response.json()).toMatchObject({ message: healthClockReadErrorMessage });
    expect(now).toHaveBeenCalledOnce();
    expect(response.body).not.toContain('raw health clock secret 4212');
  });

  it('does not inspect a hostile value thrown by the health clock', async () => {
    let propertyReads = 0;
    const thrownValue = new Proxy(
      {},
      {
        get() {
          propertyReads += 1;
          throw new Error('raw hostile health clock secret 4212');
        },
      },
    );
    const now = vi.fn(() => {
      throw thrownValue;
    });
    const server = buildDefaultTestServer({ now });

    const response = await server.inject({ method: 'GET', url: '/health' });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ message: healthClockReadErrorMessage });
    expect(now).toHaveBeenCalledOnce();
    expect(propertyReads).toBe(0);
    expect(response.body).not.toContain('raw hostile health clock secret 4212');
  });

  it('rejects invalid health clock authorities instead of reporting ok', async () => {
    const fakeToISOString = vi.fn(() => '2026-07-09T10:20:00.000Z');
    const invalidValues: readonly unknown[] = [
      undefined,
      null,
      '2026-07-09T10:20:00.000Z',
      0,
      false,
      0n,
      Symbol('health-clock'),
      () => new Date(),
      [],
      { toISOString: fakeToISOString },
      Promise.resolve(new Date()),
      new Date(Number.NaN),
      Object.create(Date.prototype),
    ];

    for (const invalidValue of invalidValues) {
      const now = vi.fn(() => invalidValue as Date);
      const server = buildDefaultTestServer({ now });

      const response = await server.inject({ method: 'GET', url: '/health' });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBeUndefined();
      expect(response.json()).toMatchObject({ message: healthClockInvariantErrorMessage });
      expect(now).toHaveBeenCalledOnce();
      expect(response.body).not.toContain('Invalid time value');
      expect(response.body).not.toContain('2026-07-09T10:20:00.000Z');
    }

    expect(fakeToISOString).not.toHaveBeenCalled();
  });

  it.each(['hostile', 'revoked'] as const)(
    'rejects a %s Date Proxy health clock without semantic traps',
    async (mode) => {
      let semanticTraps = 0;
      const handler: ProxyHandler<Date> = {
        get() {
          semanticTraps += 1;
          throw new Error('raw health Date Proxy secret 4212');
        },
        getPrototypeOf() {
          semanticTraps += 1;
          throw new Error('raw health Date Proxy prototype secret 4212');
        },
      };
      const rawDate = new Date('2026-07-09T10:20:00.000Z');
      let value: Date;
      if (mode === 'revoked') {
        const revocable = Proxy.revocable(rawDate, handler);
        value = revocable.proxy;
        revocable.revoke();
      } else {
        value = new Proxy(rawDate, handler);
      }
      let nowCalls = 0;
      const now = () => {
        nowCalls += 1;
        return value;
      };
      const server = buildDefaultTestServer({ now });

      const response = await server.inject({ method: 'GET', url: '/health' });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({ message: healthClockInvariantErrorMessage });
      expect(nowCalls).toBe(1);
      expect(semanticTraps).toBe(0);
      expect(response.body).not.toContain('raw health Date Proxy');
      expect(response.body).not.toContain('Cannot perform');
    },
  );

  it('uses the intrinsic timestamp without reading an own health clock method', async () => {
    const healthTimestampIso = '2026-07-09T10:20:00.000Z';
    const healthTimestamp = new Date(healthTimestampIso);
    let ownMethodReads = 0;
    Object.defineProperty(healthTimestamp, 'toISOString', {
      get() {
        ownMethodReads += 1;
        throw new Error('raw own health clock method secret 4212');
      },
    });
    const now = vi.fn(() => healthTimestamp);
    const server = buildDefaultTestServer({ now });

    const response = await server.inject({ method: 'GET', url: '/health' });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: healthTimestampIso,
    });
    expect(now).toHaveBeenCalledOnce();
    expect(ownMethodReads).toBe(0);
    expect(response.body).not.toContain('raw own health clock method secret 4212');
  });

  it('denies /whoami when dev tenant context headers are absent', async () => {
    const server = buildDefaultTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it.each(sensitiveRouteCases)(
    'sets no-store before missing tenant context is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDefaultTestServer();

      const response = await server.inject({ method, url });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it.each(sensitiveRouteCases)(
    'sets no-store before insufficient scope is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method,
        url,
        headers: tenantOneTenantReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it.each(sensitiveRouteCases)(
    'sets no-store before malformed tenant context is denied: %s %s (%s)',
    async (method, url) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method,
        url,
        headers: { ...tenantOnePatientReadHeaders, 'x-dev-tenant': '   ' },
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ errorCode: 'AUTH-0003', message: 'Forbidden' });
    },
  );

  it('ignores attacker-controlled dev headers by default before protected repositories run', async () => {
    const patientSearch = vi.fn<PatientRepository['search']>(async () => ({ results: [] }));
    const patientFindById = vi.fn<PatientRepository['findById']>(async () => undefined);
    const receptionList = vi.fn<ReceptionRepository['list']>(async () => []);
    const receptionCreate = vi.fn<ReceptionRepository['create']>(async () => {
      throw new Error('repository must not run without an authenticated tenant context');
    });
    const server = buildDefaultTestServer({
      patientRepository: {
        search: patientSearch,
        findById: patientFindById,
        findVersionedById: vi.fn<PatientRepository['findVersionedById']>(async () => undefined),
        create: vi.fn<PatientRepository['create']>(async () => { throw new Error('unexpected patient create'); }),
        update: vi.fn<PatientRepository['update']>(async () => { throw new Error('unexpected patient update'); }),
      },
      receptionRepository: { list: receptionList, create: receptionCreate, transition: vi.fn<ReceptionRepository['transition']>() },
    });
    const attackerHeaders = {
      'x-dev-tenant': 'attacker-selected-tenant',
      'x-dev-pharmacy': 'attacker-selected-pharmacy',
      'x-dev-actor': 'attacker-selected-actor',
      'x-dev-scopes': 'patient:read,reception:read,reception:write',
    } as const;

    const patientResponse = await server.inject({
      method: 'GET',
      url: '/patients/search?q=synthetic',
      headers: attackerHeaders,
    });
    const queueResponse = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-10',
      headers: attackerHeaders,
    });
    const createResponse = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: attackerHeaders,
      payload: {
        patientId: 'patient-attacker-selected',
        idempotencyKey: 'attacker-selected-key',
      },
    });

    await server.close();

    for (const response of [patientResponse, queueResponse, createResponse]) {
      expect(response.statusCode).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({
        errorCode: 'AUTH-0003',
        message: 'Forbidden',
      });
    }
    expect(patientSearch).not.toHaveBeenCalled();
    expect(patientFindById).not.toHaveBeenCalled();
    expect(receptionList).not.toHaveBeenCalled();
    expect(receptionCreate).not.toHaveBeenCalled();
  });

  it('denies /whoami when tenant scope is missing', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'claim:read',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it('denies /whoami when tenant scope has extra malformed segments', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'tenant:read:extra',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      errorCode: 'AUTH-0003',
      message: 'Forbidden',
    });
  });

  it.each(malformedDevIdHeaderCases)(
    'denies /whoami when %s is malformed: %s',
    async (headerName, invalidValue) => {
      const server = buildDevTestServer();

      const response = await server.inject({
        method: 'GET',
        url: '/whoami',
        headers: {
          ...tenantOneTenantReadHeaders,
          [headerName]: invalidValue,
        },
      });

      await server.close();

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        errorCode: 'AUTH-0003',
        message: 'Forbidden',
      });
    },
  );

  it('returns dev tenant context from /whoami when tenant read scope is present', async () => {
    const server = buildDevTestServer();

    const response = await server.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'tenant:read,claim:read,not-a-scope',
      },
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
      actorId: 'user-001',
      scopes: ['tenant:read', 'claim:read'],
    });
  });

  it('rejects dev headers unless in-memory repository mode is explicit before server construction', () => {
    expect(() => buildServer({ tenantContextMode: 'dev_headers' })).toThrowError(
      new Error(devTenantContextConfigurationErrorMessage),
    );
    expect(() =>
      buildServer({ repositoryMode: 'postgres', tenantContextMode: 'dev_headers' }),
    ).toThrowError(new Error(devTenantContextConfigurationErrorMessage));
  });

  it('requires an injected cursor codec for every repository mode', async () => {
    expect(() => buildServer()).toThrowError(
      new Error(patientSearchCursorHmacConfigurationErrorMessage),
    );
    expect(() =>
      buildServer({
        repositoryMode: 'in_memory',
        tenantContextMode: 'dev_headers',
      }),
    ).toThrowError(new Error(patientSearchCursorHmacConfigurationErrorMessage));
    expect(() => buildServer({ repositoryMode: 'postgres' })).toThrowError(
      new Error(patientSearchCursorHmacConfigurationErrorMessage),
    );

    const inMemoryServer = buildServer({
      patientSearchCursorCodec: createPatientSearchCursorCodec(
        randomBytes(patientSearchCursorHmacKeyByteLength),
      ),
      repositoryMode: 'in_memory',
      tenantContextMode: 'dev_headers',
    });
    await inMemoryServer.close();
  });

  it('rejects postgres mode without an explicit receptionCreateCommand', () => {
    // in-memory 合成 command への silent fallback は受付・監査・outbox の
    // 単一 transaction を失わせるため、postgres mode では明示注入を強制する。
    expect(() =>
      buildServer({
        patientSearchCursorCodec: createPatientSearchCursorCodec(
          randomBytes(patientSearchCursorHmacKeyByteLength),
        ),
        repositoryMode: 'postgres',
      }),
    ).toThrowError(new Error(postgresCompositionConfigurationErrorMessage));
  });

});
