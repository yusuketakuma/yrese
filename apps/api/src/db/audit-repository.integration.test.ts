import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { verifyAuditHashChain } from '@yrese/audit';
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

async function withMigratedSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }

  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: 1,
    options: `-c search_path=${schemaName}`,
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
});
