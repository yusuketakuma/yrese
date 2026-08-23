import type { Pool, PoolClient } from 'pg';

/**
 * Transactional outbox 配送 worker(WP-6003、Plans.md §16 Track A)。
 *
 * 規律:
 * - at-least-once。sink 成功 → `delivered_at` 更新 → COMMIT の順なので、COMMIT 前の
 *   プロセス停止は再配送になる。sink 側(API-013)は outbox_event_id を冪等鍵とする。
 * - aggregate 単位の順序保証。同一 aggregate の最古 pending だけを候補にし、候補行を
 *   `FOR UPDATE SKIP LOCKED` で掴む。最古が失敗すれば同 aggregate の後続は自然に止まる。
 *   別 worker が同 aggregate の次行を先に掴めないのは、候補が常に「最古 pending」だけで
 *   あり、その行がロック中なら SKIP されるためである。
 * - 1 行 1 トランザクション。batch 全体を 1 tx にしない(クラッシュ時の再配送を最小化)。
 * - payload は識別子のみ(migrations/000005)。本 worker は内容を解釈・加工しない。
 *
 * ponytail: retry 回数・backoff・DLQ は持たない(列がなく DDL は human gate、API-012)。
 * 失敗行は pending のまま次回 run で再試行される。恒久失敗の可視化は API-012 の migration 後。
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
}

export interface OutboxDeliverySink {
  deliver(event: OutboxPendingEvent): Promise<void>;
}

export interface OutboxDeliveryRunSummary {
  readonly delivered: number;
  readonly failed: number;
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
}

/** 複合 aggregate key の区切り(branded id は制御文字を拒否するため衝突しない)。 */
const aggregateKeyDelimiter = '\u001f';

/**
 * 同一 aggregate の最古 pending のみを候補にする。失敗 aggregate を同一 run 内で
 * 再び掴まないよう、呼び出し側が除外 key を渡す。
 */
const claimOldestPendingSql = `
  SELECT o.tenant_id, o.pharmacy_id, o.outbox_event_id, o.event_type, o.aggregate_type,
         o.aggregate_id, o.audit_event_id, o.payload, o.created_at
    FROM outbox_events o
   WHERE o.delivered_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM outbox_events p
        WHERE p.tenant_id = o.tenant_id AND p.pharmacy_id = o.pharmacy_id
          AND p.aggregate_type = o.aggregate_type AND p.aggregate_id = o.aggregate_id
          AND p.delivered_at IS NULL
          AND (p.created_at, p.outbox_event_id) < (o.created_at, o.outbox_event_id)
     )
     AND NOT (concat_ws($2::text, o.tenant_id, o.pharmacy_id, o.aggregate_type, o.aggregate_id) = ANY($1::text[]))
   ORDER BY o.created_at, o.outbox_event_id
   LIMIT 1
   FOR UPDATE OF o SKIP LOCKED`;

const markDeliveredSql = `
  UPDATE outbox_events
     SET delivered_at = now()
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
  });
}

export class PostgresOutboxDeliveryWorker {
  constructor(
    private readonly pool: Pool,
    private readonly sink: OutboxDeliverySink,
  ) {}

  /** 最大 `limit` 行を 1 行ずつ配送する。候補が尽きるか limit で止まる。 */
  async runOnce(options: { readonly limit?: number } = {}): Promise<OutboxDeliveryRunSummary> {
    const limit = options.limit ?? 100;
    const failedAggregates: string[] = [];
    let delivered = 0;
    for (let i = 0; i < limit; i += 1) {
      const outcome = await this.deliverOne(failedAggregates);
      if (outcome === 'none') break;
      if (outcome === 'delivered') delivered += 1;
    }
    return { delivered, failed: failedAggregates.length };
  }

  private async deliverOne(
    failedAggregates: string[],
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
        await this.sink.deliver(toPendingEvent(row));
      } catch {
        // 失敗は pending のまま残す(at-least-once)。同 aggregate は本 run で再試行しない。
        await client.query('ROLLBACK');
        failedAggregates.push(aggregateKey(row));
        return 'failed';
      }
      await client.query(markDeliveredSql, [row.tenant_id, row.pharmacy_id, row.outbox_event_id]);
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
