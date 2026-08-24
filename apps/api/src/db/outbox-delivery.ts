import type { Pool, PoolClient } from 'pg';

/**
 * Transactional outbox 配送 worker(WP-6003、Plans.md §16 Track A)。
 *
 * 規律:
 * - at-least-once。sink 成功 → `delivered_at` 更新 → COMMIT の順なので、COMMIT 前の
 *   プロセス停止は再配送になる。sink 側(API-013)は outbox_event_id を冪等鍵とする。
 * - aggregate 単位の順序保証。順序キーは DB 割当ての単調 `sequence_number`
 *   (migrations/000007)であり、application wall clock や UUID ではない。
 *   同一 aggregate の最古 pending だけを候補にし、候補行を `FOR UPDATE SKIP LOCKED`
 *   で掴む。最古が失敗すれば同 aggregate の後続は自然に止まる。別 worker が同
 *   aggregate の次行を先に掴めないのは、候補が常に「最古 pending」だけであり、
 *   その行がロック中なら SKIP されるためである。
 * - 1 行 1 トランザクション。batch 全体を 1 tx にしない(クラッシュ時の再配送を最小化)。
 * - sink には timeout を課す。hang した sink が行ロック・接続・tx を握り続けない。
 * - payload は識別子のみ(migrations/000005)。本 worker は内容を解釈・加工しない。
 *   公開 event への投影は outbox-partner-projection.ts が担う。
 *
 * ponytail: retry 回数・backoff・DLQ は持たない(列がなく DDL は human gate、API-012)。
 * 失敗行は pending のまま次回 run で再試行される。失敗 aggregate の除外は worker
 * instance 内に限られ、並行 worker は同じ失敗行を各自 1 回ずつ試す(N 倍の負荷上限)。
 * 恒久失敗の可視化と共有 backoff は API-012 の delivery state table 後。
 */
export interface OutboxPendingEvent {
  readonly tenantId: string;
  readonly pharmacyId: string;
  readonly outboxEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly auditEventId: string;
  readonly payload: unknown;
  readonly createdAt: string;
  readonly sequenceNumber: bigint;
}

export interface OutboxDeliverySink {
  /** `signal` は worker の timeout で abort される。sink は外部 I/O に伝播させ、孤児 fan-out を残さない。 */
  deliver(event: OutboxPendingEvent, signal?: AbortSignal): Promise<void>;
}

export interface OutboxDeliveryFailure {
  readonly outboxEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  /** sink が投げた値の name/constructor 名。message は PHI 混入を避けるため載せない。 */
  readonly reason: string;
  readonly timedOut: boolean;
}

export interface OutboxDeliveryRunSummary {
  readonly delivered: number;
  readonly failed: number;
  readonly failures: readonly OutboxDeliveryFailure[];
}

export interface OutboxDeliveryWorkerOptions {
  /** sink 1 回あたりの上限。超過は配送失敗(pending 維持)。 */
  readonly sinkTimeoutMs?: number;
}

interface OutboxRow {
  readonly tenant_id: string;
  readonly pharmacy_id: string;
  readonly outbox_event_id: string;
  readonly event_type: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly audit_event_id: string;
  readonly payload: unknown;
  readonly created_at: Date;
  readonly sequence_number: string;
}

/** 複合 aggregate key の区切り(branded id は制御文字を拒否するため衝突しない)。 */
const aggregateKeyDelimiter = '\u001f';

/**
 * 同一 aggregate の最古 pending のみを候補にする。失敗 aggregate を同一 run 内で
 * 再び掴まないよう、呼び出し側が除外 key を渡す。
 */
const claimOldestPendingSql = `
  SELECT o.tenant_id, o.pharmacy_id, o.outbox_event_id, o.event_type, o.aggregate_type,
         o.aggregate_id, o.audit_event_id, o.payload, o.created_at, o.sequence_number::text
    FROM outbox_events o
   WHERE o.delivered_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM outbox_events p
        WHERE p.tenant_id = o.tenant_id AND p.pharmacy_id = o.pharmacy_id
          AND p.aggregate_type = o.aggregate_type AND p.aggregate_id = o.aggregate_id
          AND p.delivered_at IS NULL
          AND p.sequence_number < o.sequence_number
     )
     AND NOT (concat_ws($2::text, o.tenant_id, o.pharmacy_id, o.aggregate_type, o.aggregate_id) = ANY($1::text[]))
   ORDER BY o.sequence_number
   LIMIT 1
   FOR UPDATE OF o SKIP LOCKED`;

/** clock_timestamp(): 配送完了時刻。transaction_timestamp(now()) は claim 時刻になるため使わない。 */
const markDeliveredSql = `
  UPDATE outbox_events
     SET delivered_at = clock_timestamp()
   WHERE tenant_id = $1 AND pharmacy_id = $2 AND outbox_event_id = $3
     AND delivered_at IS NULL`;

function aggregateKey(row: OutboxRow): string {
  return [row.tenant_id, row.pharmacy_id, row.aggregate_type, row.aggregate_id].join(
    aggregateKeyDelimiter,
  );
}

function toPendingEvent(row: OutboxRow): OutboxPendingEvent {
  return Object.freeze({
    tenantId: row.tenant_id,
    pharmacyId: row.pharmacy_id,
    outboxEventId: row.outbox_event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    auditEventId: row.audit_event_id,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
    sequenceNumber: BigInt(row.sequence_number),
  });
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (error !== null && typeof error === 'object') return error.constructor?.name ?? 'object';
  return typeof error;
}

class SinkTimeoutError extends Error {
  constructor() {
    super('outbox sink timed out');
    this.name = 'SinkTimeoutError';
  }
}

function withTimeout(
  run: (signal: AbortSignal) => Promise<void>,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SinkTimeoutError());
    }, timeoutMs);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export class PostgresOutboxDeliveryWorker {
  private readonly sinkTimeoutMs: number;

  constructor(
    private readonly pool: Pool,
    private readonly sink: OutboxDeliverySink,
    options: OutboxDeliveryWorkerOptions = {},
  ) {
    this.sinkTimeoutMs = options.sinkTimeoutMs ?? 30_000;
  }

  /** 最大 `limit` 行を 1 行ずつ配送する。候補が尽きるか limit で止まる。 */
  async runOnce(options: { readonly limit?: number } = {}): Promise<OutboxDeliveryRunSummary> {
    const limit = options.limit ?? 100;
    const failedAggregates: string[] = [];
    const failures: OutboxDeliveryFailure[] = [];
    let delivered = 0;
    for (let i = 0; i < limit; i += 1) {
      const outcome = await this.deliverOne(failedAggregates, failures);
      if (outcome === 'none') break;
      if (outcome === 'delivered') delivered += 1;
    }
    return { delivered, failed: failures.length, failures };
  }

  private async deliverOne(
    failedAggregates: string[],
    failures: OutboxDeliveryFailure[],
  ): Promise<'delivered' | 'failed' | 'none'> {
    const client: PoolClient = await this.pool.connect();
    let destroyClient = false;
    try {
      await client.query('BEGIN');
      const claimed = await client.query<OutboxRow>(claimOldestPendingSql, [
        failedAggregates,
        aggregateKeyDelimiter,
      ]);
      const row = claimed.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        return 'none';
      }
      try {
        const pending = toPendingEvent(row);
        await withTimeout((signal) => this.sink.deliver(pending, signal), this.sinkTimeoutMs);
      } catch (error) {
        // 失敗は pending のまま残す(at-least-once)。同 aggregate は本 run で再試行しない。
        await client.query('ROLLBACK');
        failedAggregates.push(aggregateKey(row));
        failures.push({
          outboxEventId: row.outbox_event_id,
          eventType: row.event_type,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          reason: describeFailure(error),
          timedOut: error instanceof SinkTimeoutError,
        });
        return 'failed';
      }
      const marked = await client.query(markDeliveredSql, [
        row.tenant_id,
        row.pharmacy_id,
        row.outbox_event_id,
      ]);
      if (marked.rowCount !== 1) {
        // FOR UPDATE 下では起きないはず。起きたら二重 claim の痕跡として fail-visible にする。
        throw new Error('outbox delivered transition affected an unexpected row count');
      }
      await client.query('COMMIT');
      return 'delivered';
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
      throw error;
    } finally {
      client.release(destroyClient);
    }
  }
}
