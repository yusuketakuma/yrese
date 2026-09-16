import type { Pool, PoolClient } from 'pg';

import type { RuntimeOperationalEventSink } from '../runtime-events.js';
import type {
  OutboxDeliveryRunSummary,
  OutboxDeliverySink,
  OutboxPendingEvent,
} from './outbox-delivery.js';

/**
 * Transactional outbox の常駐配送 runner(WP-7103、Plans.md §18 R0)。
 *
 * 規律:
 * - `PostgresOutboxDeliveryWorker.runOnce` を interval ごとに直列実行する。
 *   次回 tick は前回完了後にだけスケジュールするため run が重ならない。
 * - 複数 process 間の単一 runner 排他は session 級 advisory lock
 *   (`pg_try_advisory_lock`)で行う。lock は専用の pooled client を保持して
 *   維持する。獲得できない間は standby として待機し、保持者の停止・切断
 *   (session 断で自動解放)後の tick で引き継ぐ。
 * - `stop()` は新規 tick を止め、in-flight の `runOnce` 完了を待ってから lock を
 *   解放する。配送中 event は sink 成功 → delivered_at → COMMIT の順で確定する
 *   ため、待機することで「sink 成功したのに delivered 未記録」の窓を閉じる。
 * - sink は注入専用。composition(main.ts)は local/CI 用の runtime event 記録
 *   sink だけを結線し、外部 egress 向け sink は結線しない
 *   (production 配送は BLOCKED_SECURITY_REVIEW egress gate のまま)。
 * - runOnce / lock 取得の失敗は runner を落とさない。lock 経路の失敗では client を
 *   破棄して次 tick で再接続し、run の失敗では lock を保持したまま次 tick で
 *   再試行する(at-least-once、永続失敗の可視化は API-012 後)。
 */
export interface OutboxDeliveryRunnerWorker {
  runOnce(options?: {
    readonly limit?: number;
  }): Promise<OutboxDeliveryRunSummary>;
}

export interface PostgresOutboxDeliveryRunnerOptions {
  /** tick 間隔(前回完了から次回開始までの待機)。既定 5000ms。 */
  readonly intervalMs?: number;
  /** 1 run で配送する最大件数。既定 100。 */
  readonly runLimit?: number;
  /**
   * advisory lock キー(hashtext で bigint 化)。同一 DB の runner 群は同じキーを
   * 使う。integration test は schema を共有しない DB 全体 lock のため、
   * test ごとに別キーを渡すこと。
   */
  readonly lockKey?: string;
  readonly events?: RuntimeOperationalEventSink;
}

export const outboxDeliveryRunnerDefaultLockKey = 'yrese.outbox_delivery.runner';

const tryLockSql =
  'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS acquired';
const unlockSql = 'SELECT pg_advisory_unlock(hashtext($1)::bigint) AS unlocked';

function recordSafely(
  events: RuntimeOperationalEventSink | undefined,
  event: Parameters<RuntimeOperationalEventSink['record']>[0],
): void {
  try {
    events?.record(event);
  } catch {
    // 運用イベント記録の失敗は runner の配送結果を置き換えない。
  }
}

export class PostgresOutboxDeliveryRunner {
  private readonly intervalMs: number;
  private readonly runLimit: number;
  private readonly lockKey: string;
  private readonly events: RuntimeOperationalEventSink | undefined;

  private running = false;
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;
  private lockClient: PoolClient | undefined;
  private lockHeld = false;
  private lockWaitingReported = false;

  constructor(
    private readonly pool: Pool,
    private readonly worker: OutboxDeliveryRunnerWorker,
    options: PostgresOutboxDeliveryRunnerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 5_000;
    this.runLimit = options.runLimit ?? 100;
    this.lockKey = options.lockKey ?? outboxDeliveryRunnerDefaultLockKey;
    this.events = options.events;
  }

  /**
   * loop を開始する。最初の tick は即時にスケジュールされるが、start 自体は
   * 配送を待たない(backlog や遅い sink が呼び出し側を block しない)。
   * lock 未獲得の standby は interval ごとに獲得を再試行する。
   */
  start(): void {
    if (this.running) {
      throw new Error('outbox delivery runner is already running');
    }
    this.running = true;
    recordSafely(this.events, {
      kind: 'outbox.runner.started',
      intervalMs: this.intervalMs,
    });
    this.timer = setTimeout(() => {
      void this.tick();
    }, 0);
    this.timer.unref();
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const work = this.tickOnce();
    this.inFlight = work;
    try {
      await work;
    } finally {
      if (this.inFlight === work) this.inFlight = undefined;
    }
    if (this.running) this.scheduleNext();
  }

  private async tickOnce(): Promise<void> {
    try {
      if (this.lockClient === undefined) {
        this.lockClient = await this.pool.connect();
      }
      if (!this.lockHeld) {
        const result = await this.lockClient.query<{ acquired: boolean }>(
          tryLockSql,
          [this.lockKey],
        );
        if (result.rows[0]?.acquired === true) {
          this.lockHeld = true;
          this.lockWaitingReported = false;
          recordSafely(this.events, { kind: 'outbox.runner.lock_acquired' });
        } else {
          if (!this.lockWaitingReported) {
            this.lockWaitingReported = true;
            recordSafely(this.events, { kind: 'outbox.runner.lock_waiting' });
          }
          return;
        }
      }
    } catch {
      // connect / lock 取得経路の失敗: client は信頼できないので破棄し、
      // 次 tick で再接続する。lock は session 断で自動解放済み。
      recordSafely(this.events, { kind: 'outbox.runner.run_failed' });
      this.discardLockClient();
      return;
    }

    try {
      const summary = await this.worker.runOnce({ limit: this.runLimit });
      if (summary.failed > 0) {
        recordSafely(this.events, {
          kind: 'outbox.delivery.deferred',
          delivered: summary.delivered,
          failed: summary.failed,
        });
      }
    } catch {
      // runOnce が投げるのは pool/driver 級の失敗のみ(行単位の sink 失敗は
      // summary.failures で報告される)。lock client は別 session のため保持し、
      // 次 tick で再試行する。
      recordSafely(this.events, { kind: 'outbox.runner.run_failed' });
    }
  }

  /** 壊れた可能性のある lock client を破棄する(次 tick で再接続)。 */
  private discardLockClient(): void {
    const client = this.lockClient;
    this.lockClient = undefined;
    this.lockHeld = false;
    if (client === undefined) return;
    try {
      client.release(new Error('outbox delivery runner lock client reset'));
    } catch {
      // release 失敗でも client 参照は既に切り離している。
    }
  }

  private async releaseLock(): Promise<void> {
    const client = this.lockClient;
    const held = this.lockHeld;
    this.lockClient = undefined;
    this.lockHeld = false;
    if (client === undefined) return;
    try {
      if (held) {
        await client.query(unlockSql, [this.lockKey]);
      }
    } catch {
      // unlock の失敗は接続解放で必ず lock も解放されるため致命ではない。
    }
    try {
      client.release();
    } catch {
      // 同上。
    }
  }

  /**
   * 新規 tick を停止し、in-flight の runOnce 完了を待ってから advisory lock を
   * 解放する。冪等(二度目以降は no-op)。
   */
  async stop(): Promise<void> {
    if (!this.running && this.timer === undefined && this.inFlight === undefined) {
      return;
    }
    this.running = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.inFlight;
    await this.releaseLock();
    recordSafely(this.events, { kind: 'outbox.runner.stopped' });
  }
}

/**
 * local/CI 専用の配送 sink: 配送を運用イベントとして記録するだけで外部送信しない。
 * payload は参照しない(識別子のみ)。production の外部配送は egress gate
 * (BLOCKED_SECURITY_REVIEW)下のため、この sink 以外は composition されない。
 */
export function createRuntimeEventOutboxDeliverySink(
  events: RuntimeOperationalEventSink,
): OutboxDeliverySink {
  return Object.freeze({
    async deliver(event: OutboxPendingEvent): Promise<void> {
      events.record({
        kind: 'outbox.delivery.delivered',
        outboxEventId: event.outboxEventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      });
    },
  });
}
