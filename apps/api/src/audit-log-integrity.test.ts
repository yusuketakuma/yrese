import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createAuditEvent,
  verifyAuditHashChain,
  type AuditEvent,
  type CreateAuditEventInput,
} from '@yrese/audit';
import type { AuditLogResponse } from '@yrese/contracts';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { InMemoryAuditRepository, type AuditRepository, type AuditScope } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import {
  auditLogDuplicateIdentityInvariantErrorMessage,
  auditLogListSchemaInvariantErrorMessage,
  auditLogRepositoryReadErrorMessage,
  auditLogSequenceInvariantErrorMessage,
  auditLogScopeInvariantErrorMessage,
  auditLogViewAuditInvariantErrorMessage,
  auditLogViewClockInvariantErrorMessage,
  auditLogViewClockReadErrorMessage,
  buildServer,
  type BuildServerOptions,
} from './server.js';

import {
  buildDevTestServer,
  auditReadHeaders,
  SCOPE,
  receptionCreated,
  rebuildAuditEvent,
  seedEvents,
  createHostileProxy,
} from './audit-log-test-support.js';

describe('GET /audit/events — integrity and scope isolation', () => {
  it('keeps duplicate EventId rejection authoritative over a sequence anomaly', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 2);
    const seeded = await base.list(SCOPE);
    const first = seeded[0]!;
    const firstWithBadSequence = createAuditEvent({
      ...first,
      sequenceNumber: 2n,
      logicalClock: 2n,
    });
    const duplicate = createAuditEvent({
      ...seeded[1]!,
      eventId: first.eventId,
      sequenceNumber: 3n,
      logicalClock: 3n,
      prevHash: firstWithBadSequence.entryHash,
    });
    expect(verifyAuditHashChain([firstWithBadSequence, duplicate])).toMatchObject({
      ok: true,
      checkedCount: 2,
    });
    const record = vi.fn<AuditRepository['record']>(async () => first);
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn(async () => [firstWithBadSequence, duplicate]),
        record,
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(record).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({
      message: auditLogDuplicateIdentityInvariantErrorMessage,
    });
  });

  it('preserves broken-chain reason and view auditing when EventIds also repeat', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 2);
    const seeded = await base.list(SCOPE);
    const first = seeded[0]!;
    const duplicate = createAuditEvent({
      ...seeded[1]!,
      eventId: first.eventId,
      sequenceNumber: 3n,
      logicalClock: 3n,
      prevHash: first.entryHash,
    });
    const brokenDuplicate = {
      ...duplicate,
      prevHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };
    const viewAuditRepository = new InMemoryAuditRepository();
    const record = vi.fn<AuditRepository['record']>((scope, input) =>
      viewAuditRepository.record(scope, input),
    );
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn(async () => [first, brokenDuplicate]),
        record,
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      chainVerification: {
        ok: false,
        checkedCount: 1,
        breakIndex: 1,
        reason: 'prev_hash_mismatch',
      },
      totalCount: 2,
    });
    expect(record).toHaveBeenCalledOnce();
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

  it('omits a malformed latest display row without backfilling or hiding chain failure', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 2);
    const malformedTarget = 'raw-malformed-target-must-not-appear';
    const malformed: AuditRepository = {
      record: (scope, input) => base.record(scope, input),
      list: async (scope) => {
        const events = await base.list(scope);
        return events.map((event, index) =>
          index === 1
            ? ({
                ...event,
                targetRef: null,
                businessReason: { code: malformedTarget },
              } as unknown as typeof event)
            : event,
        );
      },
    };
    const server = buildDevTestServer({ auditRepository: malformed });

    const limited = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=1',
      headers: auditReadHeaders,
    });
    expect(limited.statusCode).toBe(200);
    expect(limited.headers['cache-control']).toBe('no-store');
    expect(limited.json()).toMatchObject({
      entries: [],
      totalCount: 2,
      chainVerification: {
        ok: false,
        checkedCount: 1,
        breakIndex: 1,
        reason: 'hash_format_invalid',
      },
    });
    expect(limited.body).not.toContain(malformedTarget);

    const stored = await base.list(SCOPE);
    expect(stored).toHaveLength(3);
    expect(stored[2]?.auditEventType).toBe('audit.viewed');
  });

  it('keeps valid rows in the raw display window when another stored wallClock is malformed', async () => {
    const base = new InMemoryAuditRepository();
    await seedEvents(base, 2);
    const malformedWallClock = 'raw-invalid-wall-clock-must-not-appear';
    const malformed: AuditRepository = {
      record: (scope, input) => base.record(scope, input),
      list: async (scope) => {
        const events = await base.list(scope);
        return events.map((event, index) =>
          index === 1
            ? ({ ...event, wallClock: malformedWallClock } as typeof event)
            : event,
        );
      },
    };
    const server = buildDevTestServer({ auditRepository: malformed });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=2',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      entries: [{ targetRef: { id: 'reception-001' } }],
      totalCount: 2,
      chainVerification: {
        ok: false,
        checkedCount: 1,
        breakIndex: 1,
        reason: 'hash_format_invalid',
      },
    });
    expect(response.body).not.toContain(malformedWallClock);
  });

  it('fails before clock or view append when a verified event cannot enter the response schema', async () => {
    const repository = new InMemoryAuditRepository();
    const oversizedTargetId = `raw-verified-target-${'x'.repeat(109)}`;
    expect(oversizedTargetId).toHaveLength(129);
    await repository.record(
      SCOPE,
      receptionCreated(oversizedTargetId, '2026-07-11T01:00:00.000Z'),
    );
    const persistedBefore = await repository.list(SCOPE);
    expect(persistedBefore).toHaveLength(1);
    expect(verifyAuditHashChain(persistedBefore)).toMatchObject({ ok: true, checkedCount: 1 });

    const now = vi.fn(() => new Date('2026-07-17T00:00:00.000Z'));
    const record = vi.fn<AuditRepository['record']>((scope, input) =>
      repository.record(scope, input),
    );
    const server = buildDevTestServer({
      now,
      auditRepository: {
        list: (scope) => repository.list(scope),
        record,
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toContain(oversizedTargetId);
    expect(now).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(await repository.list(SCOPE)).toEqual(persistedBefore);
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

  it.each([
    {
      label: 'tenant',
      foreignScope: {
        tenantId: tenantId('tenant-foreign-sensitive'),
        pharmacyId: pharmacyId('pharmacy-001'),
      },
    },
    {
      label: 'pharmacy',
      foreignScope: {
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-foreign-sensitive'),
      },
    },
  ])(
    'fails closed before view audit or projection for a foreign-$label repository result',
    async ({ foreignScope }) => {
      const foreignRepository = new InMemoryAuditRepository();
      const foreignTarget = 'reception-foreign-sensitive';
      const foreignActor = 'user-foreign-sensitive';
      await foreignRepository.record(foreignScope, {
        actorId: userId(foreignActor),
        auditEventType: 'reception.created',
        targetRef: { kind: 'reception', id: foreignTarget },
        outcome: 'success',
        wallClock: '2026-07-11T03:00:00.000Z',
      });
      const foreignEvents = await foreignRepository.list(foreignScope);
      const record = vi.fn<AuditRepository['record']>();
      const now = vi.fn(() => new Date('2026-07-17T00:00:00.000Z'));
      const list = vi.fn<AuditRepository['list']>(async () => foreignEvents);
      const server = buildDevTestServer({ now, auditRepository: { list, record } });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events',
        headers: auditReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(list).toHaveBeenCalledOnce();
      expect(list).toHaveBeenCalledWith(SCOPE);
      expect(now).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: auditLogScopeInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        foreignScope.tenantId,
        foreignScope.pharmacyId,
        foreignTarget,
        foreignActor,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it('rejects a mixed local and foreign repository result without a partial response', async () => {
    const localRepository = new InMemoryAuditRepository();
    await localRepository.record(
      SCOPE,
      receptionCreated('reception-local', '2026-07-11T01:00:00.000Z'),
    );
    const foreignScope: AuditScope = {
      tenantId: tenantId('tenant-foreign-mixed'),
      pharmacyId: pharmacyId('pharmacy-foreign-mixed'),
    };
    const foreignRepository = new InMemoryAuditRepository();
    await foreignRepository.record(
      foreignScope,
      receptionCreated('reception-foreign-mixed', '2026-07-11T02:00:00.000Z'),
    );
    const events = [
      ...(await localRepository.list(SCOPE)),
      ...(await foreignRepository.list(foreignScope)),
    ];
    const record = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      auditRepository: { list: vi.fn(async () => events), record },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=1',
      headers: auditReadHeaders,
    });

    await server.close();

    expect(response.statusCode).toBe(500);
    expect(record).not.toHaveBeenCalled();
    expect(response.body).not.toContain('reception-local');
    expect(response.body).not.toContain('reception-foreign-mixed');
    expect(response.body).not.toContain('tenant-foreign-mixed');
    expect(response.body).not.toContain('pharmacy-foreign-mixed');
  });
});
