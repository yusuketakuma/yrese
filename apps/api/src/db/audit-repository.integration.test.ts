import { describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { AUDIT_GENESIS_PREV_HASH, verifyAuditHashChain } from '@yrese/audit';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { PostgresAuditRepository } from './audit-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';
import type { AuditScope, RecordAuditInput } from '../audit-repository.js';

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

function createTestSchemaName(): string {
  return `yrese_audit_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

interface MigratedSchemaOptions {
  readonly poolMax?: number;
  readonly applicationName?: string;
}

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  options: MigratedSchemaOptions = {},
): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }

  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: options.poolMax ?? 1,
    options: `-c search_path=${schemaName}${
      options.applicationName === undefined ? '' : ` -c application_name=${options.applicationName}`
    }`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-07-09T00:00:00.000Z'),
    });
    await run(pool);
  } finally {
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await cleanupPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupPool.end();
    }
  }
}

async function waitForAdvisoryLockWaiters(
  client: PoolClient,
  applicationName: string,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const result = await client.query<{ waiting_count: number }>(
      `SELECT count(*)::int AS waiting_count
         FROM pg_locks AS locks
         JOIN pg_stat_activity AS activity ON activity.pid = locks.pid
        WHERE locks.locktype = 'advisory'
          AND locks.granted = false
          AND activity.application_name = $1`,
      [applicationName],
    );
    if (result.rows[0]?.waiting_count === expectedCount) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for concurrent audit advisory-lock waiters');
}

const SCOPE: AuditScope = {
  tenantId: tenantId('tenant-001'),
  pharmacyId: pharmacyId('pharmacy-001'),
};

function receptionCreated(id: string, wallClock: string): RecordAuditInput {
  return {
    actorId: userId('user-001'),
    auditEventType: 'reception.created',
    targetRef: { kind: 'reception', id },
    outcome: 'success',
    wallClock,
  };
}

describePostgres('PostgresAuditRepository (migrations/000004)', () => {
  it('appends a verifiable hash chain and rehydrates it from storage', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresAuditRepository(pool);
      await repository.record(SCOPE, receptionCreated('reception-001', '2026-07-11T01:00:00.000Z'));
      await repository.record(SCOPE, receptionCreated('reception-002', '2026-07-11T02:00:00.000Z'));
      await repository.record(SCOPE, receptionCreated('reception-003', '2026-07-11T03:00:00.000Z'));

      const events = await repository.list(SCOPE);
      expect(events).toHaveLength(3);
      expect(events[1]?.prevHash).toBe(events[0]?.entryHash);
      expect(events[2]?.prevHash).toBe(events[1]?.entryHash);
      expect(events.map((event) => event.sequenceNumber)).toEqual([1n, 2n, 3n]);

      const verification = verifyAuditHashChain(events);
      expect(verification).toMatchObject({ ok: true, checkedCount: 3 });
    });
  });

  it('isolates chains per tenant/pharmacy scope', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresAuditRepository(pool);
      await repository.record(SCOPE, receptionCreated('reception-001', '2026-07-11T01:00:00.000Z'));

      const otherScope: AuditScope = {
        tenantId: tenantId('tenant-002'),
        pharmacyId: pharmacyId('pharmacy-001'),
      };
      expect(await repository.list(otherScope)).toEqual([]);
      // 別スコープの chain は genesis から始まる
      const event = await repository.record(
        otherScope,
        receptionCreated('reception-x', '2026-07-11T02:00:00.000Z'),
      );
      expect(event.sequenceNumber).toBe(1n);
    });
  });

  it('rejects UPDATE/DELETE on audit_events (append-only trigger — 真正性)', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresAuditRepository(pool);
      await repository.record(SCOPE, receptionCreated('reception-001', '2026-07-11T01:00:00.000Z'));

      await expect(
        pool.query(`UPDATE audit_events SET entry_hash = repeat('a', 64)`),
      ).rejects.toThrow(/append-only/);
      await expect(pool.query('DELETE FROM audit_events')).rejects.toThrow(/append-only/);
    });
  });

  it('reports storage-level tampering through chain verification instead of hiding it', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresAuditRepository(pool);
      await repository.record(SCOPE, receptionCreated('reception-001', '2026-07-11T01:00:00.000Z'));
      await repository.record(SCOPE, receptionCreated('reception-002', '2026-07-11T02:00:00.000Z'));

      // trigger を無効化して保存層の改ざんを再現(通常経路では不可能な操作)
      await pool.query('ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only');
      await pool.query(
        `UPDATE audit_events
            SET event_body = jsonb_set(event_body, '{outcome}', '"denied"')
          WHERE sequence_number = 1`,
      );

      const events = await repository.list(SCOPE);
      const verification = verifyAuditHashChain(events);
      expect(verification.ok).toBe(false);
    });
  });

  it(
    'serializes two observed concurrent appends into one verifiable scoped chain',
    async () => {
      const applicationName = `yrese_audit_${process.pid}_${Math.random().toString(36).slice(2)}`;
      await withMigratedSchema(
        async (pool) => {
          const repository = new PostgresAuditRepository(pool);
          const blocker = await pool.connect();
          let blockerTransactionOpen = false;
          let appends: Array<ReturnType<PostgresAuditRepository['record']>> = [];

          try {
            await blocker.query('BEGIN');
            blockerTransactionOpen = true;
            await blocker.query(
              'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
              [`audit_events:${SCOPE.tenantId}\u0000${SCOPE.pharmacyId}`],
            );

            appends = [
              repository.record(
                SCOPE,
                receptionCreated('reception-concurrent-a', '2026-07-11T04:00:00.000Z'),
              ),
              repository.record(
                SCOPE,
                receptionCreated('reception-concurrent-b', '2026-07-11T04:00:01.000Z'),
              ),
            ];
            await waitForAdvisoryLockWaiters(blocker, applicationName, 2);

            await blocker.query('COMMIT');
            blockerTransactionOpen = false;
            const returned = await Promise.all(appends);
            expect(returned.map((event) => event.sequenceNumber).sort((a, b) => Number(a - b))).toEqual([
              1n,
              2n,
            ]);
            expect(new Set(returned.map((event) => event.eventId)).size).toBe(2);
            expect(new Set(returned.map((event) => event.entryHash)).size).toBe(2);

            const events = await repository.list(SCOPE);
            expect(events.map((event) => event.sequenceNumber)).toEqual([1n, 2n]);
            expect(events[0]?.prevHash).toBe(AUDIT_GENESIS_PREV_HASH);
            expect(events[1]?.prevHash).toBe(events[0]?.entryHash);
            expect(new Set(events.map((event) => event.eventId))).toEqual(
              new Set(returned.map((event) => event.eventId)),
            );
            expect(events.map((event) => event.targetRef.id).sort()).toEqual([
              'reception-concurrent-a',
              'reception-concurrent-b',
            ]);
            expect(verifyAuditHashChain(events)).toEqual({
              ok: true,
              checkedCount: 2,
              lastEntryHash: events[1]?.entryHash,
            });
          } finally {
            if (blockerTransactionOpen) {
              await blocker.query('ROLLBACK').catch(() => undefined);
            }
            blocker.release();
            await Promise.allSettled(appends);
          }
        },
        { poolMax: 3, applicationName },
      );
    },
    10_000,
  );
});
