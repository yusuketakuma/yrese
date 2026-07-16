import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import {
  buildAuditScopeAdvisoryLockKey,
  PostgresAuditRepository,
} from './audit-repository.js';

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
