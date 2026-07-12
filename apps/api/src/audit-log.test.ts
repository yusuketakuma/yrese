import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AuditLogResponse } from '@yrese/contracts';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { InMemoryAuditRepository, type AuditRepository, type AuditScope } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { buildServer, type BuildServerOptions } from './server.js';

function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

const auditReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'audit-log:read',
} as const;

const SCOPE: AuditScope = {
  tenantId: tenantId('tenant-001'),
  pharmacyId: pharmacyId('pharmacy-001'),
};

async function seedEvents(repository: InMemoryAuditRepository, count: number): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await repository.record(SCOPE, {
      actorId: userId('user-001'),
      auditEventType: 'reception.created',
      targetRef: { kind: 'reception', id: `reception-${String(i).padStart(3, '0')}` },
      outcome: 'success',
      wallClock: `2026-07-11T0${Math.min(i, 9)}:00:00.000Z`,
    });
  }
}

describe('GET /audit/events (SCR-028)', () => {
  it('denies access without audit-log:read scope (deny-by-default)', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: { ...auditReadHeaders, 'x-dev-scopes': 'patient:read' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns an empty verified log and audits the view itself (audit.viewed)', async () => {
    const repository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository: repository });

    const first = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    const firstBody = first.json() as AuditLogResponse;
    expect(firstBody.entries).toEqual([]);
    expect(firstBody.totalCount).toBe(0);
    expect(firstBody.chainVerification).toEqual({ ok: true, checkedCount: 0 });

    // 監査ログの閲覧自体が監査される(2回目には audit.viewed が現れる)
    const second = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    const secondBody = second.json() as AuditLogResponse;
    expect(secondBody.totalCount).toBe(1);
    expect(secondBody.entries[0]?.auditEventType).toBe('audit.viewed');
    expect(secondBody.entries[0]?.actorId).toBe('user-001');
  });

  it('returns events newest-first, applies limit, and verifies the full chain', async () => {
    const repository = new InMemoryAuditRepository();
    await seedEvents(repository, 3);
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=2',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.totalCount).toBe(3);
    expect(body.entries).toHaveLength(2);
    // 新しい順(最後に追記された reception-003 が先頭)
    expect(body.entries[0]?.targetRef.id).toBe('reception-003');
    expect(body.entries[1]?.targetRef.id).toBe('reception-002');
    // chain 検証は limit に関わらず全保存イベントに対して行う
    expect(body.chainVerification).toEqual({ ok: true, checkedCount: 3 });
    // 表示投影に hash・envelope 内部を漏らさない
    expect(JSON.stringify(body.entries)).not.toMatch(/entryHash|prevHash|payloadHash/);
  });

  it('reports a broken hash chain instead of hiding tampering', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 2);
    const tampering: AuditRepository = {
      record: (scope, input) => base.record(scope, input),
      list: async (scope) => {
        const events = await base.list(scope);
        // 2件目の prevHash を改ざんした読み出し結果を返す(保存層の破損/改ざんの再現)
        return events.map((event, index) =>
          index === 1
            ? {
                ...event,
                prevHash:
                  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
              }
            : event,
        );
      },
    };
    const server = buildDevTestServer({ auditRepository: tampering });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.chainVerification.ok).toBe(false);
    if (!body.chainVerification.ok) {
      expect(body.chainVerification.breakIndex).toBe(1);
      expect(body.chainVerification.reason).toBe('prev_hash_mismatch');
    }
  });

  it('reports malformed stored canonical payloads without hiding the view audit', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 1);
    const malformed: AuditRepository = {
      record: (scope, input) => base.record(scope, input),
      list: async (scope) => {
        const events = await base.list(scope);
        return events.map((event, index) =>
          index === 0
            ? ({
                ...event,
                schemaVersion: Number.MAX_SAFE_INTEGER + 1,
              } as typeof event)
            : event,
        );
      },
    };
    const server = buildDevTestServer({ auditRepository: malformed });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      chainVerification: {
        ok: false,
        checkedCount: 0,
        breakIndex: 0,
        reason: 'hash_format_invalid',
      },
    });
    expect(JSON.stringify(response.json())).not.toContain(String(Number.MAX_SAFE_INTEGER + 1));

    const stored = await base.list(SCOPE);
    expect(stored).toHaveLength(2);
    expect(stored[1]?.auditEventType).toBe('audit.viewed');
  });

  it('rejects invalid limits with AUD-0001', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=0',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errorCode: 'AUD-0001' });
  });

  it('isolates audit logs per tenant/pharmacy', async () => {
    const repository = new InMemoryAuditRepository();
    await seedEvents(repository, 2);
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: { ...auditReadHeaders, 'x-dev-tenant': 'tenant-002', 'x-dev-actor': 'user-002' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.totalCount).toBe(0);
    expect(body.entries).toEqual([]);
  });
});

describe('InMemoryAuditRepository', () => {
  it('chains entries so verifyAuditHashChain accepts genuine appends', async () => {
    const repository = new InMemoryAuditRepository();
    await seedEvents(repository, 3);
    const events = await repository.list(SCOPE);
    expect(events).toHaveLength(3);
    expect(events[1]?.prevHash).toBe(events[0]?.entryHash);
    expect(events[2]?.prevHash).toBe(events[1]?.entryHash);
  });
});
