import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import { appendAuditEventWithinTransaction } from "./audit-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import {
  PostgresOutboxDeliveryWorker,
  type OutboxDeliveryRunSummary,
  type OutboxDeliverySink,
  type OutboxPendingEvent,
} from "./outbox-delivery.js";
import {
  PostgresOutboxDeliveryRunner,
  type OutboxDeliveryRunnerWorker,
} from "./outbox-delivery-runner.js";
import { createDbPool } from "./pool.js";
import { resolveTestDatabaseUrl } from "./test-database-environment.js";
import type {
  RuntimeOperationalEvent,
  RuntimeOperationalEventSink,
} from "../runtime-events.js";

/**
 * WP-7103 outbox 配送 runner の PostgreSQL 統合テスト(synthetic のみ)。
 * worker 本体の規律は outbox-delivery.integration.test.ts が担保し、
 * ここでは常駐 loop / advisory lock 排他 / graceful stop を検証する。
 */
const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: "tenant-obr-int-001",
  pharmacyId: "pharmacy-obr-int-001",
};

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  if (testDatabaseUrl === undefined)
    throw new Error("TEST_DATABASE_URL unexpectedly missing");
  const schemaName = `yrese_outbox_runner_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();
  const pool = createDbPool(testDatabaseUrl, {
    max: 4,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: "vitest",
      appliedAt: new Date("2026-09-16T00:00:00.000Z"),
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
     VALUES ($1, $2, 'patient-obr-001', '合成常駐患者', 'ゴウセイジョウチュウカンジャ', '1985-05-05'::date,
             'female', 'OBR-001', 'VERIFIED', NULL)`,
    [scope.tenantId, scope.pharmacyId],
  );
}

async function seedIntent(
  pool: Pool,
  input: { readonly id: string; readonly aggregateId: string },
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reception_entries (tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
         business_date, reception_status, prescription_intake_type, idempotency_key)
       VALUES ($1, $2, $3, 'patient-obr-001', '2026-09-16T00:00:00Z'::timestamptz,
               '2026-09-16'::date, 'WAITING', 'paper', $4)
       ON CONFLICT DO NOTHING`,
      [scope.tenantId, scope.pharmacyId, input.aggregateId, `idem-${input.id}`],
    );
    const audit = await appendAuditEventWithinTransaction(client, auditScope, {
      actorId: userId("user-obr-001"),
      auditEventType: "reception.created",
      targetRef: { kind: "reception", id: input.aggregateId },
      outcome: "success",
      wallClock: "2026-09-16T00:00:00.000Z",
    });
    await client.query(
      `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type,
         aggregate_type, aggregate_id, audit_event_id, payload, created_at)
       VALUES ($1, $2, $3, 'reception.created', 'reception', $4, $5, $6::jsonb,
               '2026-09-16T00:00:00Z'::timestamptz)`,
      [
        scope.tenantId,
        scope.pharmacyId,
        input.id,
        input.aggregateId,
        audit.eventId,
        JSON.stringify({
          receptionId: input.aggregateId,
          patientId: "patient-obr-001",
        }),
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

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  message: string,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`timed out: ${message}`);
}

function recordingEvents(): RuntimeOperationalEventSink & {
  readonly events: RuntimeOperationalEvent[];
} {
  const events: RuntimeOperationalEvent[] = [];
  return {
    events,
    record(event: RuntimeOperationalEvent) {
      events.push(event);
    },
  };
}

function recordingSink(options: {
  readonly failIds?: ReadonlySet<string>;
  readonly delayMs?: number;
} = {}): OutboxDeliverySink & { readonly seen: OutboxPendingEvent[] } {
  const seen: OutboxPendingEvent[] = [];
  return {
    seen,
    async deliver(event) {
      seen.push(event);
      if (options.delayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      if (options.failIds?.has(event.outboxEventId)) {
        throw new Error("injected sink failure");
      }
    },
  };
}

const lockKeyFor = (name: string) => `yrese.test.outbox_runner.${name}`;

/** DB-less: lock 応答を制御できる fake client/pool で loop 規律を検証する。 */
describe("PostgresOutboxDeliveryRunner (DB-less)", () => {
  function fakePool(acquired: boolean): {
    pool: Pool;
    queries: string[];
    released: boolean[];
  } {
    const queries: string[] = [];
    const released: boolean[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes("pg_try_advisory_lock")) {
          return { rows: [{ acquired }] };
        }
        if (text.includes("pg_advisory_unlock")) {
          return { rows: [{ unlocked: true }] };
        }
        return { rows: [] };
      },
      release: () => {
        released.push(true);
      },
    };
    return {
      pool: { connect: async () => client } as unknown as Pool,
      queries,
      released,
    };
  }

  function countingWorker(): OutboxDeliveryRunnerWorker & {
    readonly calls: number[];
  } {
    const calls: number[] = [];
    return {
      calls,
      async runOnce() {
        calls.push(1);
        return { delivered: 0, failed: 0, failures: [] };
      },
    };
  }

  it("runs ticks serially, then releases the advisory lock on stop", async () => {
    const { pool, queries, released } = fakePool(true);
    const worker = countingWorker();
    const events = recordingEvents();
    const runner = new PostgresOutboxDeliveryRunner(pool, worker, {
      intervalMs: 10,
      lockKey: lockKeyFor("dbless"),
      events,
    });
    runner.start();
    await waitUntil(() => worker.calls.length >= 2, "two serialized ticks");
    await runner.stop();
    expect(queries.some((q) => q.includes("pg_try_advisory_lock"))).toBe(true);
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true);
    expect(released).toHaveLength(1);
    expect(
      events.events.map((e) => e.kind),
    ).toEqual(
      expect.arrayContaining([
        "outbox.runner.started",
        "outbox.runner.lock_acquired",
        "outbox.runner.stopped",
      ]),
    );
    // 二度目の stop は no-op。
    await runner.stop();
    expect(released).toHaveLength(1);
  });

  it("stays a standby without calling the worker while the lock is held elsewhere", async () => {
    const { pool } = fakePool(false);
    const worker = countingWorker();
    const runner = new PostgresOutboxDeliveryRunner(pool, worker, {
      intervalMs: 10,
      lockKey: lockKeyFor("standby"),
    });
    runner.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await runner.stop();
    expect(worker.calls).toHaveLength(0);
  });

  it("rejects a second start and survives a broken lock client", async () => {
    let connectCalls = 0;
    const pool = {
      connect: async () => {
        connectCalls += 1;
        if (connectCalls === 1) throw new Error("synthetic connect failure");
        return {
          query: async () => ({ rows: [{ acquired: true }] }),
          release: () => undefined,
        };
      },
    } as unknown as Pool;
    const worker = countingWorker();
    const events = recordingEvents();
    const runner = new PostgresOutboxDeliveryRunner(pool, worker, {
      intervalMs: 10,
      lockKey: lockKeyFor("broken"),
      events,
    });
    runner.start();
    expect(() => runner.start()).toThrow(/already running/);
    await waitUntil(() => worker.calls.length >= 1, "recovered and ran");
    expect(
      events.events.some((e) => e.kind === "outbox.runner.run_failed"),
    ).toBe(true);
    await runner.stop();
  });
});

describePostgres("PostgresOutboxDeliveryRunner (PostgreSQL)", () => {
  it("delivers pending intents through the resident loop at-least-once", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, { id: "obr-1", aggregateId: "r-obr-1" });
      await seedIntent(pool, { id: "obr-2", aggregateId: "r-obr-2" });
      const sink = recordingSink();
      const runner = new PostgresOutboxDeliveryRunner(
        pool,
        new PostgresOutboxDeliveryWorker(pool, sink),
        { intervalMs: 30, lockKey: lockKeyFor("deliver") },
      );
      try {
        runner.start();
        await waitUntil(
          async () => (await deliveredIds(pool)).length === 2,
          "both intents delivered",
        );
      } finally {
        await runner.stop();
      }
      expect(sink.seen.map((e) => e.outboxEventId).sort()).toEqual([
        "obr-1",
        "obr-2",
      ]);
    });
  });

  it("serializes runOnce invocations even when a run outlasts the interval", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      let depth = 0;
      let maxDepth = 0;
      let runs = 0;
      const worker: OutboxDeliveryRunnerWorker = {
        async runOnce(): Promise<OutboxDeliveryRunSummary> {
          depth += 1;
          maxDepth = Math.max(maxDepth, depth);
          runs += 1;
          await new Promise((resolve) => setTimeout(resolve, 60));
          depth -= 1;
          return { delivered: 0, failed: 0, failures: [] };
        },
      };
      const runner = new PostgresOutboxDeliveryRunner(pool, worker, {
        intervalMs: 10,
        lockKey: lockKeyFor("serialize"),
      });
      try {
        runner.start();
        await waitUntil(() => runs >= 3, "three serialized runs");
      } finally {
        await runner.stop();
      }
      expect(maxDepth).toBe(1);
    });
  });

  it("keeps a second runner as standby and fails over after the holder stops", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      const eventsA = recordingEvents();
      const eventsB = recordingEvents();
      const callsA: OutboxDeliveryRunSummary[] = [];
      const callsB: OutboxDeliveryRunSummary[] = [];
      const workerFor = (
        log: OutboxDeliveryRunSummary[],
        sink: OutboxDeliverySink,
      ): OutboxDeliveryRunnerWorker => ({
        async runOnce(options) {
          const summary = await new PostgresOutboxDeliveryWorker(
            pool,
            sink,
          ).runOnce(options);
          log.push(summary);
          return summary;
        },
      });
      const lockKey = lockKeyFor("failover");
      const runnerA = new PostgresOutboxDeliveryRunner(
        pool,
        workerFor(callsA, recordingSink()),
        { intervalMs: 30, lockKey, events: eventsA },
      );
      const sinkB = recordingSink();
      const runnerB = new PostgresOutboxDeliveryRunner(
        pool,
        workerFor(callsB, sinkB),
        { intervalMs: 30, lockKey, events: eventsB },
      );
      try {
        runnerA.start();
        await waitUntil(
          () =>
            eventsA.events.some((e) => e.kind === "outbox.runner.lock_acquired"),
          "runner A acquired the lock",
        );
        runnerB.start();
        // A が lock を保持する間、B は standby で runOnce を呼ばない。
        await waitUntil(
          () =>
            eventsB.events.some((e) => e.kind === "outbox.runner.lock_waiting"),
          "standby reported lock_waiting",
        );
        expect(callsB).toHaveLength(0);
        expect(callsA.length).toBeGreaterThan(0);

        await runnerA.stop();
        // 保持者の停止後に入った intent は standby が引き継いで配送する。
        await seedIntent(pool, { id: "obr-f1", aggregateId: "r-obr-f1" });
        await waitUntil(
          async () => (await deliveredIds(pool)).length === 1,
          "standby delivered after failover",
        );
      } finally {
        await runnerA.stop();
        await runnerB.stop();
      }
      expect(callsB.length).toBeGreaterThan(0);
      expect(sinkB.seen.map((e) => e.outboxEventId)).toEqual(["obr-f1"]);
      expect(
        eventsB.events.some((e) => e.kind === "outbox.runner.lock_acquired"),
      ).toBe(true);
    });
  });

  it("retries a failed intent on the next tick without losing it", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, { id: "obr-r1", aggregateId: "r-obr-r1" });
      let attempts = 0;
      const sink: OutboxDeliverySink & {
        readonly seen: OutboxPendingEvent[];
      } = {
        seen: [],
        async deliver(event) {
          this.seen.push(event);
          attempts += 1;
          if (attempts === 1) throw new Error("injected first failure");
        },
      };
      const events = recordingEvents();
      const runner = new PostgresOutboxDeliveryRunner(
        pool,
        new PostgresOutboxDeliveryWorker(pool, sink),
        { intervalMs: 30, lockKey: lockKeyFor("retry"), events },
      );
      try {
        runner.start();
        await waitUntil(
          async () => (await deliveredIds(pool)).length === 1,
          "failed intent retried and delivered",
        );
      } finally {
        await runner.stop();
      }
      // at-least-once: 初回失敗 + 再送成功で sink には 2 回到達する。
      expect(sink.seen.map((e) => e.outboxEventId)).toEqual([
        "obr-r1",
        "obr-r1",
      ]);
      expect(
        events.events.some((e) => e.kind === "outbox.delivery.deferred"),
      ).toBe(true);
    });
  });

  it("lets an in-flight delivery finish before stop() resolves", async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool);
      await seedIntent(pool, { id: "obr-s1", aggregateId: "r-obr-s1" });
      let releaseSink: (() => void) | undefined;
      let markSinkEntered!: () => void;
      const sinkEntered = new Promise<void>((resolve) => {
        markSinkEntered = resolve;
      });
      const sink: OutboxDeliverySink = {
        async deliver() {
          markSinkEntered();
          await new Promise<void>((resolve) => {
            releaseSink = resolve;
          });
        },
      };
      const runner = new PostgresOutboxDeliveryRunner(
        pool,
        new PostgresOutboxDeliveryWorker(pool, sink),
        { intervalMs: 30, lockKey: lockKeyFor("stop") },
      );
      runner.start();
      await sinkEntered;
      const stopPromise = runner.stop();
      // in-flight 配送が残っている間は stop が完了しない。
      const stoppedEarly = await Promise.race([
        stopPromise.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
      ]);
      expect(stoppedEarly).toBe(false);
      releaseSink?.();
      await stopPromise;
      await expect(deliveredIds(pool)).resolves.toEqual(["obr-s1"]);
    });
  });
});
