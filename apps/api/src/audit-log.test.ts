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
  auditLogSequenceInvariantErrorMessage,
  auditLogScopeInvariantErrorMessage,
  auditLogViewAuditInvariantErrorMessage,
  buildServer,
  type BuildServerOptions,
} from './server.js';

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

function receptionCreated(id: string, wallClock: string) {
  return {
    actorId: userId('user-001'),
    auditEventType: 'reception.created' as const,
    targetRef: { kind: 'reception', id },
    outcome: 'success' as const,
    wallClock,
  };
}

function rebuildAuditEvent(
  event: AuditEvent,
  overrides: Partial<CreateAuditEventInput>,
): AuditEvent {
  const { entryHash: _entryHash, ...input } = event;
  return createAuditEvent({ ...input, ...overrides });
}

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

  it('normalizes a rejected audit-view append without exposing raw failure detail', async () => {
    const rawSentinel = 'raw-audit-view-rejection-secret-4192';
    const record = vi.fn<AuditRepository['record']>(async () => {
      throw new Error(rawSentinel);
    });
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
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
    expect(record).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: auditLogViewAuditInvariantErrorMessage,
    });
    expect(response.body).not.toContain(rawSentinel);
  });

  it.each([
    [
      'tenant',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { tenantId: tenantId('tenant-foreign-audit-view') }),
      'tenant-foreign-audit-view',
    ],
    [
      'pharmacy',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { pharmacyId: pharmacyId('pharmacy-foreign-audit-view') }),
      'pharmacy-foreign-audit-view',
    ],
    [
      'actor',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { actorId: userId('user-foreign-audit-view') }),
      'user-foreign-audit-view',
    ],
    [
      'event type',
      (event: AuditEvent) => rebuildAuditEvent(event, { auditEventType: 'reception.created' }),
      'reception.created',
    ],
    [
      'target kind',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          targetRef: { kind: 'reception', id: event.targetRef.id },
          aggregateType: 'reception',
        }),
      'reception',
    ],
    [
      'target id',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          targetRef: { kind: 'audit_log', id: 'view:999' },
          aggregateId: 'view:999',
        }),
      'view:999',
    ],
    [
      'outcome',
      (event: AuditEvent) => rebuildAuditEvent(event, { outcome: 'failed' }),
      'failed',
    ],
    [
      'wall clock',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, { wallClock: '2026-07-17T00:00:00.999Z' }),
      '2026-07-17T00:00:00.999Z',
    ],
    [
      'aggregate type',
      (event: AuditEvent) => rebuildAuditEvent(event, { aggregateType: 'reception' }),
      'reception',
    ],
    [
      'aggregate id',
      (event: AuditEvent) => rebuildAuditEvent(event, { aggregateId: 'view:foreign' }),
      'view:foreign',
    ],
    [
      'reason code',
      (event: AuditEvent) => rebuildAuditEvent(event, { reasonCode: 'AUTH-0003' }),
      'AUTH-0003',
    ],
    [
      'business reason',
      (event: AuditEvent) =>
        rebuildAuditEvent(event, {
          businessReason: { code: 'SYNTHETIC_AUDIT_VIEW_CONTRADICTION' },
        }),
      'SYNTHETIC_AUDIT_VIEW_CONTRADICTION',
    ],
  ] as const)(
    'rejects a hash-valid audit-view result with mismatched %s before 200',
    async (_label, mutateAudit, rawSentinel) => {
      const backing = new InMemoryAuditRepository();
      const record = vi.fn<AuditRepository['record']>(async (scope, input) =>
        mutateAudit(await backing.record(scope, input)),
      );
      const server = buildDevTestServer({
        now: () => new Date('2026-07-17T00:00:00.000Z'),
        auditRepository: {
          list: vi.fn<AuditRepository['list']>(async () => []),
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
      expect(record).toHaveBeenCalledOnce();
      expect(response.json()).toMatchObject({ message: auditLogViewAuditInvariantErrorMessage });
      expect(response.body).not.toContain(rawSentinel);
    },
  );

  it.each([
    ['null', (_event: AuditEvent): null => null],
    [
      'corrupted entry hash',
      (event: AuditEvent): AuditEvent =>
        Object.freeze({ ...event, entryHash: '0'.repeat(64) }),
    ],
  ] as const)('rejects a malformed audit-view result (%s)', async (_label, resultOf) => {
    const backing = new InMemoryAuditRepository();
    const record = vi.fn<AuditRepository['record']>(async (scope, input) =>
      resultOf(await backing.record(scope, input)) as AuditEvent,
    );
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
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
    expect(response.json()).toMatchObject({ message: auditLogViewAuditInvariantErrorMessage });
  });

  it('rejects an accessor-bearing audit-view result without invoking its getter', async () => {
    const rawSentinel = 'raw-audit-view-accessor-4192';
    const getter = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const backing = new InMemoryAuditRepository();
    const record = vi.fn<AuditRepository['record']>(async (scope, input) => {
      const result = { ...(await backing.record(scope, input)) } as Record<string, unknown>;
      Object.defineProperty(result, 'actorId', { enumerable: true, get: getter });
      return result as unknown as AuditEvent;
    });
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
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
    expect(getter).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({ message: auditLogViewAuditInvariantErrorMessage });
    expect(response.body).not.toContain(rawSentinel);
  });

  it.each(['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const)(
    'normalizes a throwing audit-view Proxy %s trap',
    async (trapName) => {
      const rawSentinel = `raw-audit-view-proxy-${trapName}-4192`;
      const backing = new InMemoryAuditRepository();
      const record = vi.fn<AuditRepository['record']>(async (scope, input) => {
        const event = await backing.record(scope, input);
        const handler: ProxyHandler<AuditEvent> = {};
        handler[trapName] = (() => {
          throw new Error(rawSentinel);
        }) as never;
        return new Proxy(event, handler);
      });
      const server = buildDevTestServer({
        auditRepository: {
          list: vi.fn<AuditRepository['list']>(async () => []),
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
      expect(response.json()).toMatchObject({ message: auditLogViewAuditInvariantErrorMessage });
      expect(response.body).not.toContain(rawSentinel);
    },
  );

  it('hydrates one audit-view result snapshot without raw get/has reads', async () => {
    const backing = new InMemoryAuditRepository();
    const now = vi.fn(() => new Date('2026-07-17T00:00:00.000Z'));
    let thenReads = 0;
    let rawGetCalls = 0;
    let rawHasCalls = 0;
    const record = vi.fn<AuditRepository['record']>(async (scope, input) => {
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Object.isFrozen(input)).toBe(true);
      expect(Object.isFrozen(input.targetRef)).toBe(true);
      const event = await backing.record(scope, input);
      return new Proxy(event, {
        get(_target, property) {
          if (property === 'then') {
            thenReads += 1;
            return undefined;
          }
          rawGetCalls += 1;
          throw new Error('raw audit-view get must not run');
        },
        has() {
          rawHasCalls += 1;
          throw new Error('raw audit-view has must not run');
        },
      });
    });
    const server = buildDevTestServer({
      now,
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => []),
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
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ entries: [], totalCount: 0 });
    expect(record).toHaveBeenCalledOnce();
    expect(now).toHaveBeenCalledOnce();
    expect(thenReads).toBe(1);
    expect(rawGetCalls).toBe(0);
    expect(rawHasCalls).toBe(0);
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

  it('orders a verified display window by wallClock before applying limit', async () => {
    const repository = new InMemoryAuditRepository();
    await repository.record(
      SCOPE,
      receptionCreated('reception-late', '2026-07-11T03:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-early', '2026-07-11T01:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-middle', '2026-07-11T02:00:00.000Z'),
    );
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=2',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.entries.map((entry) => entry.targetRef.id)).toEqual([
      'reception-late',
      'reception-middle',
    ]);
    expect(body.chainVerification).toEqual({ ok: true, checkedCount: 3 });
    expect(body.totalCount).toBe(3);
  });

  it('uses later append order as the deterministic tie-break for equal wallClock', async () => {
    const repository = new InMemoryAuditRepository();
    await repository.record(
      SCOPE,
      receptionCreated('reception-equal-a', '2026-07-11T03:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-equal-b', '2026-07-11T03:00:00.000Z'),
    );
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as AuditLogResponse).entries.map((entry) => entry.targetRef.id)).toEqual([
      'reception-equal-b',
      'reception-equal-a',
    ]);
  });

  it.each([
    ['same logical payload', false],
    ['conflicting logical payload', true],
  ] as const)(
    'rejects a verified full chain that reuses one EventId with %s',
    async (_label, conflicting) => {
      const base = new InMemoryAuditRepository();
      await seedEvents(base, 2);
      const seeded = await base.list(SCOPE);
      const first = seeded[0]!;
      const duplicate = createAuditEvent(
        conflicting
          ? {
              ...seeded[1]!,
              eventId: first.eventId,
              prevHash: first.entryHash,
            }
          : {
              ...first,
              sequenceNumber: 2n,
              logicalClock: 2n,
              prevHash: first.entryHash,
            },
      );
      expect(verifyAuditHashChain([first, duplicate])).toMatchObject({
        ok: true,
        checkedCount: 2,
      });
      const record = vi.fn<AuditRepository['record']>(async () => first);
      const server = buildDevTestServer({
        auditRepository: {
          list: vi.fn(async () => [first, duplicate]),
          record,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events?limit=1',
        headers: auditReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(record).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: auditLogDuplicateIdentityInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        first.eventId,
        first.actorId,
        first.targetRef.id,
        first.correlationId,
        first.idempotencyKey,
        duplicate.targetRef.id,
        duplicate.entryHash,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each([
    ['starts after genesis', [2n]],
    ['contains a gap', [1n, 3n]],
    ['reuses a sequence', [1n, 1n]],
    ['moves backwards after a valid prefix', [1n, 2n, 1n]],
  ] as const)(
    'rejects a verified full chain that %s',
    async (_label, sequenceNumbers) => {
      const base = new InMemoryAuditRepository();
      await seedEvents(base, sequenceNumbers.length);
      const seeded = await base.list(SCOPE);
      let previousEntryHash: string | undefined;
      const events = sequenceNumbers.map((sequenceNumber, index) => {
        const event = createAuditEvent({
          ...seeded[index]!,
          sequenceNumber,
          logicalClock: sequenceNumber,
          ...(previousEntryHash === undefined
            ? {}
            : { prevHash: previousEntryHash }),
        });
        previousEntryHash = event.entryHash;
        return event;
      });
      expect(verifyAuditHashChain(events)).toMatchObject({
        ok: true,
        checkedCount: events.length,
      });
      const record = vi.fn<AuditRepository['record']>(async () => events[0]!);
      const server = buildDevTestServer({
        auditRepository: {
          list: vi.fn(async () => events),
          record,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events?limit=1',
        headers: auditReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(record).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: auditLogSequenceInvariantErrorMessage,
      });
      for (const event of events) {
        for (const sensitiveValue of [
          event.eventId,
          event.actorId,
          event.targetRef.id,
          event.correlationId,
          event.idempotencyKey,
          event.entryHash,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );

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
      const list = vi.fn<AuditRepository['list']>(async () => foreignEvents);
      const server = buildDevTestServer({ auditRepository: { list, record } });

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
