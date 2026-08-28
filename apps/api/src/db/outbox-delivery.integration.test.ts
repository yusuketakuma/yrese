import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import { appendAuditEventWithinTransaction } from "./audit-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import {
  PostgresOutboxDeliveryWorker,
  type OutboxDeliverySink,
  type OutboxPendingEvent,
} from "./outbox-delivery.js";
import { createDbPool } from "./pool.js";
import { resolveTestDatabaseUrl } from "./test-database-environment.js";

/**
 * WP-6003 outbox 配送 worker の PostgreSQL 統合テスト(synthetic のみ)。
 * 受付コマンドを経由せず outbox 行を直接挿入し、worker の規律だけを検証する。
 */
describe("outbox delivery instant mapping (DB-less / WP-5274)", () => {
  function fakePoolFor(row: Record<string, unknown>): Pool {
    let claimed = false;
    const client = {
      query: async (text: string) => {
        if (text.includes("SELECT") && !claimed) {
          claimed = true;
          return { rows: [row], rowCount: 1 };
        }
        if (text.includes("SELECT")) return { rows: [], rowCount: 0 };
        if (text.includes("UPDATE")) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    };
    return { connect: async () => client } as unknown as Pool;
  }

  const baseRow = {
    tenant_id: "tenant-obx-dbless",
    pharmacy_id: "pharmacy-obx-dbless",
    outbox_event_id: "outbox-dbless-1",
    event_type: "reception.created",
    aggregate_type: "reception",
    aggregate_id: "reception-dbless-1",
    audit_event_id: "audit-dbless-1",
    payload: { synthetic: true },
    sequence_number: "1",
  };

  function recordingSink(): { sink: OutboxDeliverySink; events: OutboxPendingEvent[] } {
    const events: OutboxPendingEvent[] = [];
    return {
      events,
      sink: {
        deliver: async (event) => {
          events.push(event);
        },
      },
    };
  }

  it("maps created_at without reading an own Date method and delivers", async () => {
    const clock = new Date("2026-08-24T02:00:00.000Z");
    const ownToISOStringRead = vi.fn(() => {
      throw new Error("raw outbox clock secret");
    });
    Object.defineProperty(clock, "toISOString", {
      configurable: true,
      get: ownToISOStringRead,
    });
    const { sink, events } = recordingSink();
    const worker = new PostgresOutboxDeliveryWorker(
      fakePoolFor({ ...baseRow, created_at: clock }),
      sink,
    );

    const summary = await worker.runOnce({ limit: 2 });

    expect(summary).toMatchObject({ delivered: 1, failed: 0 });
    expect(ownToISOStringRead).not.toHaveBeenCalled();
    expect(events[0]?.createdAt).toBe("2026-08-24T02:00:00.000Z");
  });

  it("normalizes a string driver created_at instead of failing delivery", async () => {
    const { sink, events } = recordingSink();
    const worker = new PostgresOutboxDeliveryWorker(
      fakePoolFor({ ...baseRow, created_at: "2026-08-24T02:00:00.000Z" }),
      sink,
    );

    const summary = await worker.runOnce({ limit: 2 });

    expect(summary).toMatchObject({ delivered: 1, failed: 0 });
    expect(events[0]?.createdAt).toBe("2026-08-24T02:00:00.000Z");
  });
});

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: "tenant-obx-int-001",
  pharmacyId: "pharmacy-obx-int-001",
};

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  options: { readonly poolMax?: number } = {},
): Promise<void> {
  if (testDatabaseUrl === undefined)
    throw new Error("TEST_DATABASE_URL unexpectedly missing");
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
      appliedBy: "vitest",
      appliedAt: new Date("2026-08-23T00:00:00.000Z"),
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

const auditScope = {
  tenantId: tenantId(scope.tenantId),
  pharmacyId: pharmacyId(scope.pharmacyId),
};

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
  const eventType = input.eventType ?? "reception.created";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reception_entries (tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
         business_date, reception_status, prescription_intake_type, idempotency_key)
       VALUES ($1, $2, $3, 'patient-obx-001', $4::timestamptz, '2026-08-23'::date, 'WAITING', 'paper', $5)
       ON CONFLICT DO NOTHING`,
      [
        scope.tenantId,
        scope.pharmacyId,
        input.aggregateId,
        input.createdAt,
        `idem-${input.aggregateId}`,
      ],
    );
    const audit = await appendAuditEventWithinTransaction(client, auditScope, {
      actorId: userId("user-obx-001"),
      auditEventType: "reception.created",
      targetRef: { kind: "reception", id: input.aggregateId },
      outcome: "success",
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
        JSON.stringify({
          receptionId: input.aggregateId,
          patientId: "patient-obx-001",
        }),
        input.createdAt,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deliveredIds(pool: Pool): Promise<readonly string[]> {
  const result = await pool.query<{ outbox_event_id: string }>(
    "SELECT outbox_event_id FROM outbox_events WHERE delivered_at IS NOT NULL ORDER BY outbox_event_id",
  );
  return result.rows.map((row) => row.outbox_event_id);
}

function recordingSink(
  failFor: ReadonlySet<string> = new Set(),
): OutboxDeliverySink & {
  readonly seen: OutboxPendingEvent[];
} {
  const seen: OutboxPendingEvent[] = [];
  return {
    seen,
    async deliver(event) {
      seen.push(event);
      if (failFor.has(event.outboxEventId))
        throw new Error("injected sink failure");
    },
  };
}

describePostgres("PostgresOutboxDeliveryWorker (PostgreSQL)", () => {
  it("delivers pending intents in insertion (sequence) order and marks only the delivered rows", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, {
        id: "ob-2",
        aggregateId: "r-2",
        createdAt: "2026-08-23T00:00:02Z",
      });
      await seedIntent(pool, {
        id: "ob-1",
        aggregateId: "r-1",
        createdAt: "2026-08-23T00:00:01Z",
      });
      const sink = recordingSink();

      const summary = await new PostgresOutboxDeliveryWorker(
        pool,
        sink,
      ).runOnce();

      expect(summary).toEqual({ delivered: 2, failed: 0, failures: [] });
      // 挿入順 = sequence 順。wall clock(created_at)は順序に使わない。
      expect(sink.seen.map((e) => e.outboxEventId)).toEqual(["ob-2", "ob-1"]);
      expect(sink.seen[1]).toMatchObject({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
        eventType: "reception.created",
        aggregateType: "reception",
        aggregateId: "r-1",
        payload: { receptionId: "r-1", patientId: "patient-obx-001" },
      });
      await expect(deliveredIds(pool)).resolves.toEqual(["ob-1", "ob-2"]);
    });
  });

  it("leaves a failed intent pending, blocks later intents of the same aggregate, and retries on the next run", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, {
        id: "ob-a1",
        aggregateId: "r-a",
        createdAt: "2026-08-23T00:00:01Z",
      });
      await seedIntent(pool, {
        id: "ob-a2",
        aggregateId: "r-a",
        createdAt: "2026-08-23T00:00:02Z",
        eventType: "reception.updated",
      });
      await seedIntent(pool, {
        id: "ob-b1",
        aggregateId: "r-b",
        createdAt: "2026-08-23T00:00:03Z",
      });
      const failing = recordingSink(new Set(["ob-a1"]));

      const first = await new PostgresOutboxDeliveryWorker(
        pool,
        failing,
      ).runOnce();
      expect(first).toEqual({
        delivered: 1,
        failed: 1,
        failures: [
          {
            outboxEventId: "ob-a1",
            eventType: "reception.created",
            aggregateType: "reception",
            aggregateId: "r-a",
            reason: "Error",
            timedOut: false,
          },
        ],
      });
      // 失敗した aggregate の後続(ob-a2)は配送されず、別 aggregate(ob-b1)は進む。
      expect(failing.seen.map((e) => e.outboxEventId)).toEqual([
        "ob-a1",
        "ob-b1",
      ]);
      await expect(deliveredIds(pool)).resolves.toEqual(["ob-b1"]);

      const healthy = recordingSink();
      const second = await new PostgresOutboxDeliveryWorker(
        pool,
        healthy,
      ).runOnce();
      expect(second).toEqual({ delivered: 2, failed: 0, failures: [] });
      expect(healthy.seen.map((e) => e.outboxEventId)).toEqual([
        "ob-a1",
        "ob-a2",
      ]);
      await expect(deliveredIds(pool)).resolves.toEqual([
        "ob-a1",
        "ob-a2",
        "ob-b1",
      ]);

      // 再実行は no-op(冪等)。
      await expect(
        new PostgresOutboxDeliveryWorker(pool, healthy).runOnce(),
      ).resolves.toEqual({
        delivered: 0,
        failed: 0,
        failures: [],
      });
    });
  });

  it("never delivers the same intent twice across concurrent workers", async () => {
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
        const workers = [1, 2, 3].map(
          () => new PostgresOutboxDeliveryWorker(pool, slowSink),
        );

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

  it("orders by database sequence, not by application wall clock (review FND-1)", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      // 後に挿入された行ほど古い wall clock を持つ(時計の遅い API instance を模す)。
      await seedIntent(pool, {
        id: "ob-s1",
        aggregateId: "r-s",
        createdAt: "2026-08-23T00:00:05Z",
      });
      await seedIntent(pool, {
        id: "ob-s2",
        aggregateId: "r-s",
        createdAt: "2026-08-23T00:00:01Z",
        eventType: "reception.updated",
      });
      const sink = recordingSink();
      await new PostgresOutboxDeliveryWorker(pool, sink).runOnce();
      expect(sink.seen.map((e) => e.outboxEventId)).toEqual(["ob-s1", "ob-s2"]);
      expect(sink.seen[0]!.sequenceNumber < sink.seen[1]!.sequenceNumber).toBe(
        true,
      );
    });
  });

  it("keeps per-aggregate order under concurrent workers (review matrix #6)", async () => {
    await withMigratedSchema(
      async (pool) => {
        await seedPatient(pool);
        await seedIntent(pool, {
          id: "ob-o1",
          aggregateId: "r-o",
          createdAt: "2026-08-23T00:00:01Z",
        });
        await seedIntent(pool, {
          id: "ob-o2",
          aggregateId: "r-o",
          createdAt: "2026-08-23T00:00:02Z",
          eventType: "reception.updated",
        });
        const seen: string[] = [];
        const slowSink: OutboxDeliverySink = {
          async deliver(event) {
            seen.push(event.outboxEventId);
            await new Promise((resolve) => setTimeout(resolve, 30));
          },
        };
        await Promise.all(
          [1, 2, 3].map(() =>
            new PostgresOutboxDeliveryWorker(pool, slowSink).runOnce(),
          ),
        );
        expect(seen).toEqual(["ob-o1", "ob-o2"]);
      },
      { poolMax: 4 },
    );
  });

  it("times out a hanging sink, releases the row, and reports the failure (review FND-3/FND-5)", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, {
        id: "ob-h1",
        aggregateId: "r-h",
        createdAt: "2026-08-23T00:00:01Z",
      });
      const hanging: OutboxDeliverySink = {
        deliver: () => new Promise(() => undefined),
      };
      const summary = await new PostgresOutboxDeliveryWorker(pool, hanging, {
        sinkTimeoutMs: 20,
      }).runOnce();
      expect(summary.delivered).toBe(0);
      expect(summary.failures).toEqual([
        expect.objectContaining({
          outboxEventId: "ob-h1",
          reason: "SinkTimeoutError",
          timedOut: true,
        }),
      ]);
      // 行ロックと接続は解放されており、健全な sink が同じ行を配送できる。
      const healthy = recordingSink();
      await expect(
        new PostgresOutboxDeliveryWorker(pool, healthy).runOnce(),
      ).resolves.toMatchObject({
        delivered: 1,
      });
    });
  });

  it("records the delivery completion time, not the claim time (review FND-2)", async () => {
    await withMigratedSchema(
      async (pool) => {
        await seedPatient(pool);
        await seedIntent(pool, {
          id: "ob-t1",
          aggregateId: "r-t",
          createdAt: "2026-08-23T00:00:01Z",
        });
        let sinkCalledAt: Date | undefined;
        const slow: OutboxDeliverySink = {
          async deliver() {
            sinkCalledAt = (
              await pool.query<{ now: Date }>("SELECT clock_timestamp() AS now")
            ).rows[0]!.now;
            await new Promise((resolve) => setTimeout(resolve, 60));
          },
        };
        await new PostgresOutboxDeliveryWorker(pool, slow).runOnce();
        const deliveredAt = (
          await pool.query<{ delivered_at: Date }>(
            "SELECT delivered_at FROM outbox_events WHERE outbox_event_id = 'ob-t1'",
          )
        ).rows[0]!.delivered_at;
        expect(
          deliveredAt.getTime() - sinkCalledAt!.getTime(),
        ).toBeGreaterThanOrEqual(50);
      },
      // sink 内で別接続を使うため(worker が 1 本掴んでいる)。
      { poolMax: 2 },
    );
  });

  it("rejects aggregate types other than reception at the database (review FND-8)", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, {
        id: "ob-x1",
        aggregateId: "r-x",
        createdAt: "2026-08-23T00:00:01Z",
      });
      await expect(
        pool.query(
          `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type,
             aggregate_type, aggregate_id, audit_event_id, payload, created_at)
           SELECT tenant_id, pharmacy_id, 'ob-x2', 'prescription.created', 'prescription',
                  aggregate_id, audit_event_id, payload, created_at
             FROM outbox_events WHERE outbox_event_id = 'ob-x1'`,
        ),
      ).rejects.toThrow(/outbox_events_aggregate_type_reception/);
    });
  });
});
