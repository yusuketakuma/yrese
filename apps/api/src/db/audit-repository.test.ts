import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { verifyAuditHashChain } from '@yrese/audit';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { buildChainedAuditEvent } from '../audit-repository.js';
import {
  buildAuditScopeAdvisoryLockKey,
  PostgresAuditRepository,
} from './audit-repository.js';

const auditQueryResultInvariantErrorMessage =
  'Audit query result violated repository invariants';

const scope = {
  tenantId: tenantId('tenant-audit-client-test'),
  pharmacyId: pharmacyId('pharmacy-audit-client-test'),
} as const;

const input = {
  actorId: userId('user-audit-client-test'),
  auditEventType: 'reception.created' as const,
  targetRef: { kind: 'reception', id: 'reception-audit-client-test' },
  outcome: 'success' as const,
  wallClock: '2026-07-13T00:00:00.000Z',
};

function createRepository(options: {
  readonly operationError?: Error;
  readonly rollbackError?: Error;
}) {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT') && options.operationError !== undefined) {
      throw options.operationError;
    }
    if (normalized === 'ROLLBACK' && options.rollbackError !== undefined) {
      throw options.rollbackError;
    }
    return { rows: [] };
  });
  const client = {
    query: query as unknown as PoolClient['query'],
    release,
  } as unknown as PoolClient;
  const pool = {
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  return { repository: new PostgresAuditRepository(pool), query, release };
}

function createListRepository(queryResult: unknown | Promise<unknown>) {
  const query = vi.fn(() => Promise.resolve(queryResult));
  const pool = {
    query: query as unknown as Pool['query'],
  } as unknown as Pool;
  return { repository: new PostgresAuditRepository(pool), query };
}

function toStoredEvent(
  event: ReturnType<typeof buildChainedAuditEvent>,
): Record<string, unknown> {
  const serialized = JSON.stringify(event, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  if (serialized === undefined) {
    throw new Error('expected synthetic audit event to serialize');
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected repository operation to reject');
}

describe('PostgresAuditRepository client lifecycle', () => {
  it('reuses the client after a successful rollback and preserves the original error', async () => {
    const operationError = new Error('synthetic audit insert failure');
    const { repository, query, release } = createRepository({ operationError });

    expect(await captureRejection(() => repository.record(scope, input))).toBe(operationError);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toContain('ROLLBACK');
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).not.toContain('COMMIT');
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after rollback fails without masking the original error', async () => {
    const operationError = new Error('synthetic audit insert failure');
    const rollbackError = new Error('synthetic rollback failure');
    const { repository, query, release } = createRepository({ operationError, rollbackError });

    expect(await captureRejection(() => repository.record(scope, input))).toBe(operationError);
    expect(query.mock.calls.filter(([sql]) => String(sql).trim() === 'ROLLBACK')).toHaveLength(1);
    expect(release.mock.calls).toEqual([[true]]);
  });

  it('commits successfully and returns the reusable client exactly once', async () => {
    const { repository, query, release } = createRepository({});

    const event = await repository.record(scope, input);

    expect(event.sequenceNumber).toBe(1n);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toContain('COMMIT');
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).not.toContain('ROLLBACK');
    expect(release.mock.calls).toEqual([[]]);
  });
});

describe('PostgresAuditRepository list row boundary', () => {
  it('rehydrates ordered JSONB-shaped rows with the exact scoped query', async () => {
    const first = buildChainedAuditEvent(scope, input, undefined, 1n);
    const second = buildChainedAuditEvent(
      scope,
      {
        ...input,
        targetRef: { kind: 'reception', id: 'reception-audit-client-test-2' },
        wallClock: '2026-07-13T00:01:00.000Z',
      },
      first.entryHash,
      2n,
    );
    const storedFirst = toStoredEvent(first);
    const storedSecond = toStoredEvent(second);
    const { repository, query } = createListRepository({
      rows: [{ event_body: storedFirst }, { event_body: storedSecond }],
    });

    expect(storedFirst.sequenceNumber).toBe('1');
    expect(storedSecond.logicalClock).toBe('2');
    await expect(repository.list(scope)).resolves.toEqual([first, second]);
    expect(query.mock.calls).toEqual([
      [
        `SELECT event_body
         FROM audit_events
        WHERE tenant_id = $1 AND pharmacy_id = $2
        ORDER BY sequence_number ASC`,
        [scope.tenantId, scope.pharmacyId],
      ],
    ]);
  });

  it('preserves an own-data malformed body for downstream verification', async () => {
    const { repository } = createListRepository({ rows: [{ event_body: null }] });

    await expect(repository.list(scope)).resolves.toEqual([null]);
  });

  it('keeps known-field tampering fail-visible to the chain verifier', async () => {
    const event = buildChainedAuditEvent(scope, input, undefined, 1n);
    const stored = toStoredEvent(event);
    stored.outcome = 'denied';
    const { repository } = createListRepository({ rows: [{ event_body: stored }] });

    const events = await repository.list(scope);
    expect(verifyAuditHashChain(events).ok).toBe(false);
  });

  it('normalizes a fulfilled then-read query-result Proxy revoked before projection', async () => {
    let thenReads = 0;
    let semanticReads = 0;
    const revocable = Proxy.revocable(
      { rows: [] },
      {
        get(target, property, receiver) {
          if (property === 'then') {
            thenReads += 1;
            return undefined;
          }
          semanticReads += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const fulfilled = new Promise<unknown>((resolve) => {
      resolve(revocable.proxy);
      revocable.revoke();
    });
    const { repository } = createListRepository(fulfilled);

    const error = await captureRejection(() => repository.list(scope));
    expect(error).toEqual(new Error(auditQueryResultInvariantErrorMessage));
    expect(thenReads).toBe(1);
    expect(semanticReads).toBe(0);
  });

  it('rejects a rows array Proxy without invoking semantic traps', async () => {
    const rawSentinel = 'raw audit rows Proxy detail';
    let semanticReads = 0;
    const rows = new Proxy([], {
      get() {
        semanticReads += 1;
        throw new Error(rawSentinel);
      },
    });
    const { repository } = createListRepository({ rows });

    const error = await captureRejection(() => repository.list(scope));
    expect(error).toEqual(new Error(auditQueryResultInvariantErrorMessage));
    expect(String(error)).not.toContain(rawSentinel);
    expect(semanticReads).toBe(0);
  });

  it('normalizes a revoked rows array Proxy', async () => {
    const rows = Proxy.revocable([], {});
    rows.revoke();
    const { repository } = createListRepository({ rows: rows.proxy });

    const error = await captureRejection(() => repository.list(scope));
    expect(error).toEqual(new Error(auditQueryResultInvariantErrorMessage));
  });

  it('rejects a raw row Proxy without invoking semantic traps', async () => {
    const rawSentinel = 'raw audit row Proxy detail';
    let semanticReads = 0;
    const row = new Proxy(
      { event_body: null },
      {
        get() {
          semanticReads += 1;
          throw new Error(rawSentinel);
        },
      },
    );
    const { repository } = createListRepository({ rows: [row] });

    const error = await captureRejection(() => repository.list(scope));
    expect(error).toEqual(new Error(auditQueryResultInvariantErrorMessage));
    expect(String(error)).not.toContain(rawSentinel);
    expect(semanticReads).toBe(0);
  });

  it('rejects inherited event_body accessors without invoking them', async () => {
    const getter = vi.fn(() => null);
    const prototype = Object.create(null) as object;
    Object.defineProperty(prototype, 'event_body', { get: getter });
    const { repository } = createListRepository({ rows: [Object.create(prototype)] });

    const error = await captureRejection(() => repository.list(scope));
    expect(error).toEqual(new Error(auditQueryResultInvariantErrorMessage));
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('buildAuditScopeAdvisoryLockKey', () => {
  it('produces a valid NUL-free UTF-8 tuple key', () => {
    const key = buildAuditScopeAdvisoryLockKey({
      tenantId: tenantId('tenant-\\-"-薬局'),
      pharmacyId: pharmacyId('pharmacy-\\-"-一号'),
    });

    expect(key).not.toContain('\u0000');
    expect(Buffer.from(key, 'utf8').toString('utf8')).toBe(key);
    expect(JSON.parse(key)).toEqual([
      'yrese.audit.scope.v1',
      'tenant-\\-"-薬局',
      'pharmacy-\\-"-一号',
    ]);
  });

  it('keeps ambiguous concatenations and swapped scopes distinct', () => {
    const first = buildAuditScopeAdvisoryLockKey({
      tenantId: tenantId('tenant:a'),
      pharmacyId: pharmacyId('b:c'),
    });
    const second = buildAuditScopeAdvisoryLockKey({
      tenantId: tenantId('tenant:a:b'),
      pharmacyId: pharmacyId('c'),
    });
    const swapped = buildAuditScopeAdvisoryLockKey({
      tenantId: tenantId('b:c'),
      pharmacyId: pharmacyId('tenant:a'),
    });

    expect(new Set([first, second, swapped]).size).toBe(3);
  });
});
