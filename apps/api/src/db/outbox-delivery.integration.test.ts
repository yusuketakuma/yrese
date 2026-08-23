import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { appendAuditEventWithinTransaction } from './audit-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import {
  PostgresOutboxDeliveryWorker,
  type OutboxDeliverySink,
  type OutboxPendingEvent,
} from './outbox-delivery.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/**
 * WP-6003 outbox 配送 worker の PostgreSQL 統合テスト(synthetic のみ)。
 * 受付コマンドを経由せず outbox 行を直接挿入し、worker の規律だけを検証する。
 */
const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

const scope = { tenantId: 'tenant-obx-int-001', pharmacyId: 'pharmacy-obx-int-001' };

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  options: { readonly poolMax?: number } = {},
): Promise<void> {
  if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL unexpectedly missing');
  const schemaName = `yrese_outbox_delivery_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();
  const pool = createDbPool(testDatabaseUrl, {
    max: options.poolMax ?? 1,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-08-23T00:00:00.000Z'),
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

const auditScope = { tenantId: tenantId(scope.tenantId), pharmacyId: pharmacyId(scope.pharmacyId) };

async function seedPatient(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO patients (tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
       patient_number, eligibility_status, eligibility_checked_at)
     VALUES ($1, $2, 'patient-obx-001', '合成配送患者', 'ゴウセイハイソウカンジャ', '1980-01-01'::date,
             'female', 'OBX-001', 'VERIFIED', NULL)`,
    [scope.tenantId, scope.pharmacyId],
  );
}

/**
 * FK(migrations/000007)を満たす intent を作る: 受付行 + 監査行 + outbox 行。
 * 同一 aggregate の 2 本目は eventType を変えて UNIQUE を避ける。
 */
async function seedIntent(
  pool: Pool,
  input: {
    readonly id: string;
    readonly aggregateId: string;
    readonly createdAt: string;
    readonly eventType?: string;
  },
): Promise<void> {
  const eventType = input.eventType ?? 'reception.created';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO reception_entries (tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
         business_date, reception_status, prescription_intake_type, idempotency_key)
       VALUES ($1, $2, $3, 'patient-obx-001', $4::timestamptz, '2026-08-23'::date, 'WAITING', 'paper', $5)
       ON CONFLICT DO NOTHING`,
      [scope.tenantId, scope.pharmacyId, input.aggregateId, input.createdAt, `idem-${input.aggregateId}`],
    );
    const audit = await appendAuditEventWithinTransaction(client, auditScope, {
      actorId: userId('user-obx-001'),
      auditEventType: 'reception.created',
      targetRef: { kind: 'reception', id: input.aggregateId },
      outcome: 'success',
      wallClock: input.createdAt,
    });
    await client.query(
      `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type,
         aggregate_type, aggregate_id, audit_event_id, payload, created_at)
       VALUES ($1, $2, $3, $4, 'reception', $5, $6, $7::jsonb, $8::timestamptz)`,
      [
        scope.tenantId,
        scope.pharmacyId,
        input.id,
        eventType,
        input.aggregateId,
        audit.eventId,
        JSON.stringify({ receptionId: input.aggregateId, patientId: 'patient-obx-001' }),
        input.createdAt,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deliveredIds(pool: Pool): Promise<readonly string[]> {
  const result = await pool.query<{ outbox_event_id: string }>(
    'SELECT outbox_event_id FROM outbox_events WHERE delivered_at IS NOT NULL ORDER BY outbox_event_id',
  );
  return result.rows.map((row) => row.outbox_event_id);
}

function recordingSink(failFor: ReadonlySet<string> = new Set()): OutboxDeliverySink & {
  readonly seen: OutboxPendingEvent[];
} {
  const seen: OutboxPendingEvent[] = [];
  return {
    seen,
    async deliver(event) {
      seen.push(event);
      if (failFor.has(event.outboxEventId)) throw new Error('injected sink failure');
    },
  };
}

describePostgres('PostgresOutboxDeliveryWorker (PostgreSQL)', () => {
  it('delivers pending intents oldest-first and marks only the delivered rows', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, { id: 'ob-2', aggregateId: 'r-2', createdAt: '2026-08-23T00:00:02Z' });
      await seedIntent(pool, { id: 'ob-1', aggregateId: 'r-1', createdAt: '2026-08-23T00:00:01Z' });
      const sink = recordingSink();

      const summary = await new PostgresOutboxDeliveryWorker(pool, sink).runOnce();

      expect(summary).toEqual({ delivered: 2, failed: 0 });
      expect(sink.seen.map((e) => e.outboxEventId)).toEqual(['ob-1', 'ob-2']);
      expect(sink.seen[0]).toMatchObject({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
        eventType: 'reception.created',
        aggregateType: 'reception',
        aggregateId: 'r-1',
        payload: { receptionId: 'r-1', patientId: 'patient-obx-001' },
      });
      await expect(deliveredIds(pool)).resolves.toEqual(['ob-1', 'ob-2']);
    });
  });

  it('leaves a failed intent pending, blocks later intents of the same aggregate, and retries on the next run', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, { id: 'ob-a1', aggregateId: 'r-a', createdAt: '2026-08-23T00:00:01Z' });
      await seedIntent(pool, {
        id: 'ob-a2',
        aggregateId: 'r-a',
        createdAt: '2026-08-23T00:00:02Z',
        eventType: 'reception.updated',
      });
      await seedIntent(pool, { id: 'ob-b1', aggregateId: 'r-b', createdAt: '2026-08-23T00:00:03Z' });
      const failing = recordingSink(new Set(['ob-a1']));

      const first = await new PostgresOutboxDeliveryWorker(pool, failing).runOnce();
      expect(first).toEqual({ delivered: 1, failed: 1 });
      // 失敗した aggregate の後続(ob-a2)は配送されず、別 aggregate(ob-b1)は進む。
      expect(failing.seen.map((e) => e.outboxEventId)).toEqual(['ob-a1', 'ob-b1']);
      await expect(deliveredIds(pool)).resolves.toEqual(['ob-b1']);

      const healthy = recordingSink();
      const second = await new PostgresOutboxDeliveryWorker(pool, healthy).runOnce();
      expect(second).toEqual({ delivered: 2, failed: 0 });
      expect(healthy.seen.map((e) => e.outboxEventId)).toEqual(['ob-a1', 'ob-a2']);
      await expect(deliveredIds(pool)).resolves.toEqual(['ob-a1', 'ob-a2', 'ob-b1']);

      // 再実行は no-op(冪等)。
      await expect(new PostgresOutboxDeliveryWorker(pool, healthy).runOnce()).resolves.toEqual({
        delivered: 0,
        failed: 0,
      });
    });
  });

  it('never delivers the same intent twice across concurrent workers', async () => {
    await withMigratedSchema(
      async (pool) => {
        await seedPatient(pool);
        for (let i = 0; i < 6; i += 1) {
          await seedIntent(pool, {
            id: `ob-c${i}`,
            aggregateId: `r-c${i}`,
            createdAt: `2026-08-23T00:00:0${i}Z`,
          });
        }
        const seen: string[] = [];
        const slowSink: OutboxDeliverySink = {
          async deliver(event) {
            seen.push(event.outboxEventId);
            await new Promise((resolve) => setTimeout(resolve, 20));
          },
        };
        const workers = [1, 2, 3].map(() => new PostgresOutboxDeliveryWorker(pool, slowSink));

        const summaries = await Promise.all(workers.map((w) => w.runOnce()));

        const total = summaries.reduce((sum, s) => sum + s.delivered, 0);
        expect(total).toBe(6);
        expect(new Set(seen).size).toBe(6);
        expect(seen).toHaveLength(6);
        await expect(deliveredIds(pool)).resolves.toHaveLength(6);
      },
      { poolMax: 4 },
    );
  });
});
