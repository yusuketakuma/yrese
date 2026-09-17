import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createPatientSearchCursorCodec, patientSearchCursorHmacKeyByteLength } from './patient-search-cursor.js';
import {
  pharmacyId,
  receptionId,
  tenantId,
} from '@yrese/shared-kernel';

import {
  InMemoryAuditRepository,
  type AuditRepository,
} from './audit-repository.js';
import { InMemoryReceptionRepository } from './reception-repository.js';
import {
  buildServer,
  type BuildServerOptions,
} from './server.js';

/**
 * WP-7201: POST /reception/{receptionId}/transitions の契約テスト。
 * API-006 0.3.1 / DOM-004 §2: 認可 reception:write のみ、expectedVersion+If-Match
 * CAS、DOM-004 遷移表、監査先行(PHI 非含有応答)。
 */

const fixedNow = new Date('2026-07-09T09:00:00.000Z');

function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    now: () => new Date(fixedNow),
    ...options,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

const writeHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'reception:write',
} as const;

const writeAndReadHeaders = {
  ...writeHeaders,
  'x-dev-scopes': 'reception:write,reception:read,patient:read',
} as const;

const otherTenantHeaders = {
  'x-dev-tenant': 'tenant-002',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-002',
  'x-dev-scopes': 'reception:write',
} as const;

function transitionRequest(
  receptionIdValue: string,
  overrides: {
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
) {
  return {
    method: 'POST' as const,
    url: `/reception/${receptionIdValue}/transitions`,
    headers: {
      ...writeHeaders,
      'if-match': '"1"',
      ...overrides.headers,
    },
    payload: overrides.body ?? { to: 'IN_PROGRESS', expectedVersion: 1 },
  };
}

describe('POST /reception/:receptionId/transitions', () => {
  it('transitions WAITING -> IN_PROGRESS with a PHI-free response and reception.started audit', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(
      transitionRequest('reception-syn-002'),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'receptionId',
      'receptionStatus',
      'statusChangedAt',
      'version',
    ]);
    expect(body).toEqual({
      receptionId: 'reception-syn-002',
      receptionStatus: 'IN_PROGRESS',
      version: 2,
      statusChangedAt: fixedNow.toISOString(),
    });
    expect(response.body).not.toContain('合成患者');
    expect(response.body).not.toContain('ゴウセイ');

    const events = await auditRepository.list({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
    });
    const transitionEvent = events.find(
      (event) => event.auditEventType === 'reception.started',
    );
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent?.targetRef).toEqual({
      kind: 'reception',
      id: 'reception-syn-002',
    });
    expect(transitionEvent?.actorId).toBe('user-001');
    expect(transitionEvent?.outcome).toBe('success');
    expect(transitionEvent?.businessReason).toBeUndefined();
    await server.close();
  });

  it('transitions IN_PROGRESS -> COMPLETED and records reception.completed', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(
      transitionRequest('reception-syn-001', {
        headers: { 'if-match': '"2"' },
        body: { to: 'COMPLETED', expectedVersion: 2 },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      receptionId: 'reception-syn-001',
      receptionStatus: 'COMPLETED',
      version: 3,
      statusChangedAt: fixedNow.toISOString(),
    });
    const events = await auditRepository.list({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
    });
    expect(
      events.some((event) => event.auditEventType === 'reception.completed'),
    ).toBe(true);
    await server.close();
  });

  it('transitions to CANCELLED with a structured businessReason and records reception.cancelled', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(
      transitionRequest('reception-syn-002', {
        body: {
          to: 'CANCELLED',
          expectedVersion: 1,
          businessReason: 'PATIENT_REQUEST',
        },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      receptionId: 'reception-syn-002',
      receptionStatus: 'CANCELLED',
      version: 2,
      statusChangedAt: fixedNow.toISOString(),
    });
    const events = await auditRepository.list({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
    });
    const cancelEvent = events.find(
      (event) => event.auditEventType === 'reception.cancelled',
    );
    expect(cancelEvent?.businessReason).toEqual({ code: 'PATIENT_REQUEST' });
    await server.close();
  });

  it('increments version monotonically across successive transitions', async () => {
    const server = buildDevTestServer();
    const first = await server.inject(transitionRequest('reception-syn-002'));
    expect(first.statusCode).toBe(200);
    const second = await server.inject(
      transitionRequest('reception-syn-002', {
        headers: { 'if-match': '"2"' },
        body: { to: 'COMPLETED', expectedVersion: 2 },
      }),
    );
    expect(second.statusCode).toBe(200);
    expect(second.json().version).toBe(3);
    await server.close();
  });

  it('reflects the bumped version in the reception queue read path', async () => {
    const server = buildDevTestServer();
    await server.inject(transitionRequest('reception-syn-002'));
    const queue = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: writeAndReadHeaders,
    });
    expect(queue.statusCode).toBe(200);
    const entry = queue
      .json()
      .entries.find(
        (candidate: { receptionId: string }) =>
          candidate.receptionId === 'reception-syn-002',
      );
    expect(entry.version).toBe(2);
    expect(entry.receptionStatus).toBe('IN_PROGRESS');
    await server.close();
  });

  it('returns 404 RCV-0006 for a reception outside the tenant scope', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/reception/reception-syn-002/transitions',
      headers: { ...otherTenantHeaders, 'if-match': '"1"' },
      payload: { to: 'IN_PROGRESS', expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe('RCV-0006');
    await server.close();
  });

  it('returns 404 RCV-0006 for a reception outside the pharmacy scope', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/reception/reception-syn-002/transitions',
      headers: { ...writeHeaders, 'x-dev-pharmacy': 'pharmacy-002', 'if-match': '"1"' },
      payload: { to: 'IN_PROGRESS', expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe('RCV-0006');
    await server.close();
  });

  it('returns 404 RCV-0006 for a nonexistent reception', async () => {
    const server = buildDevTestServer();
    const response = await server.inject(
      transitionRequest('reception-nonexistent-001'),
    );
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe('RCV-0006');
    await server.close();
  });

  it.each([
    ['COMPLETED', 'reception-syn-003', '"2"', 2],
    ['IN_PROGRESS', 'reception-syn-001', '"2"', 2],
  ])(
    'returns 409 RCV-0004 for disallowed transition to %s',
    async (to, receptionIdValue, ifMatch, expectedVersion) => {
      const server = buildDevTestServer();
      const response = await server.inject(
        transitionRequest(receptionIdValue, {
          headers: { 'if-match': ifMatch },
          body: { to, expectedVersion },
        }),
      );
      expect(response.statusCode).toBe(409);
      expect(response.json().errorCode).toBe('RCV-0004');
      await server.close();
    },
  );

  it('returns 409 RCV-0004 for terminal COMPLETED -> CANCELLED even with businessReason', async () => {
    const server = buildDevTestServer();
    const response = await server.inject(
      transitionRequest('reception-syn-003', {
        headers: { 'if-match': '"2"' },
        body: {
          to: 'CANCELLED',
          expectedVersion: 2,
          businessReason: 'PATIENT_REQUEST',
        },
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe('RCV-0004');
    await server.close();
  });

  it('returns 409 RCV-0005 when expectedVersion does not match current version', async () => {
    const server = buildDevTestServer();
    const response = await server.inject(
      transitionRequest('reception-syn-002', {
        headers: { 'if-match': '"5"' },
        body: { to: 'IN_PROGRESS', expectedVersion: 5 },
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe('RCV-0005');
    await server.close();
  });

  it.each([
    ['missing', undefined],
    ['unquoted', '1'],
    ['mismatched', '"9"'],
    ['weak etag', 'W/"1"'],
    ['non-integer', '"abc"'],
  ])('returns 400 RCV-0001 for %s If-Match', async (_label, ifMatch) => {
    const server = buildDevTestServer();
    const headers: Record<string, string> = { ...writeHeaders };
    if (ifMatch !== undefined) headers['if-match'] = ifMatch;
    const response = await server.inject({
      method: 'POST',
      url: '/reception/reception-syn-002/transitions',
      headers,
      payload: { to: 'IN_PROGRESS', expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe('RCV-0001');
    await server.close();
  });

  it.each([
    { to: 'WAITING', expectedVersion: 1 },
    { to: 'CANCELLED', expectedVersion: 1 },
    { to: 'IN_PROGRESS', expectedVersion: 1, businessReason: 'PATIENT_REQUEST' },
    {
      to: 'CANCELLED',
      expectedVersion: 1,
      businessReason: 'free text reason',
    },
    { to: 'IN_PROGRESS', expectedVersion: 0 },
    { to: 'IN_PROGRESS' },
    { expectedVersion: 1 },
  ])('returns 400 RCV-0001 for invalid body %j', async (body) => {
    const server = buildDevTestServer();
    const response = await server.inject(
      transitionRequest('reception-syn-002', { body }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe('RCV-0001');
    await server.close();
  });

  it('returns 403 without reception:write scope', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/reception/reception-syn-002/transitions',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'reception:read',
        'if-match': '"1"',
      },
      payload: { to: 'IN_PROGRESS', expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe('AUTH-0003');
    await server.close();
  });

  it('rolls back the transition when audit append fails (no durable state without evidence)', async () => {
    const failingAudit: AuditRepository = {
      record: async () => {
        throw new Error('injected audit sink failure');
      },
      list: async () => [],
    };
    const receptionRepository = new InMemoryReceptionRepository();
    const server = buildDevTestServer({
      receptionRepository,
      auditRepository: failingAudit,
    });
    const response = await server.inject(transitionRequest('reception-syn-002'));
    expect(response.statusCode).toBe(500);

    // 補償後は遷移が残っていない: version 1 のまま再遷移できる。
    const retried = await receptionRepository.transition({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
      receptionId: receptionId('reception-syn-002'),
      to: 'IN_PROGRESS',
      expectedVersion: 1,
      statusChangedAt: new Date(fixedNow),
    });
    expect(retried.kind).toBe('transitioned');
    await server.close();
  });

  it('normalizes repository failures to 500 without leaking internals', async () => {
    const receptionRepository = new InMemoryReceptionRepository();
    vi.spyOn(receptionRepository, 'transition').mockRejectedValue(
      new Error('injected repository failure'),
    );
    const server = buildDevTestServer({ receptionRepository });
    const response = await server.inject(transitionRequest('reception-syn-002'));
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('injected repository failure');
    await server.close();
  });
});
