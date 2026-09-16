import { Pool, type PoolClient, type PoolConfig } from 'pg';

import {
  defaultDbPoolConfiguration,
  type DbPoolConfiguration,
} from '../config.js';
import type {
  DatabasePoolSnapshot,
  RuntimeOperationalEventSink,
} from '../runtime-events.js';

export function createDbPool(
  connectionString: string,
  overrides: Omit<PoolConfig, 'connectionString'> = {},
  configuration: DbPoolConfiguration = defaultDbPoolConfiguration,
): Pool {
  return new Pool({
    connectionString,
    max: configuration.max,
    idleTimeoutMillis: configuration.idleTimeoutMillis,
    connectionTimeoutMillis: configuration.connectionTimeoutMillis,
    maxLifetimeSeconds: configuration.maxLifetimeSeconds,
    ...overrides,
  });
}

export function snapshotDatabasePool(pool: Pool): DatabasePoolSnapshot {
  return Object.freeze({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  });
}

export function observeDatabasePoolBackgroundErrors(
  pool: Pool,
  events: RuntimeOperationalEventSink,
): () => void {
  const onBackgroundError = (): void => {
    try {
      events.record({
        kind: 'database.pool.background_error',
        databasePool: snapshotDatabasePool(pool),
      });
    } catch {
      // A reporter failure must not turn an already-handled pool error into an uncaught error.
    }
  };

  pool.on('error', onBackgroundError);
  let observing = true;
  return () => {
    if (!observing) return;
    observing = false;
    pool.off('error', onBackgroundError);
  };
}

/**
 * pool から client を借りて BEGIN し `run` を実行する。helper は COMMIT しない:
 * `run` は正常系の early exit も含めて自身で COMMIT / ROLLBACK を発行する。
 * `run` が投げた場合は ROLLBACK を試み、ROLLBACK 自体が失敗した client は
 * pool へ戻さず破棄する(release(true))。
 * `run` が正常 return したのに transaction を閉じていない場合は、未確定の
 * 書込み(xact id 採番済み)があれば契約違反として throw し、無書込みの
 * open transaction も ROLLBACK で閉じる。open transaction のままの client を
 * pool へ戻さない(次の借用者が未確定状態や advisory lock を引き継ぐのを防ぐ)。
 * 終了状態を検証する probe 自体が失敗した場合(callback が SQL error を握り
 * 潰して tx を aborted のまま残したケースを含む)は、commit 成否を判定できない
 * ため成功を報告せず throw し、client は破棄する。
 */
export async function runInPooledTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let destroyClient = false;
  let transactionSettled = false;
  try {
    await client.query('BEGIN');
    const result = await run(client);
    let leakedWrites = false;
    try {
      const { rows } = await client.query<{ readonly xid: string | null }>(
        'SELECT pg_current_xact_id_if_assigned() AS xid',
      );
      leakedWrites = rows[0]?.xid != null;
      // 既に COMMIT/ROLLBACK 済みなら no-op(「no transaction in progress」は
      // WARNING で error にならない)。閉じ忘れた open transaction は commit
      // せず破棄する。
      await client.query('ROLLBACK');
      transactionSettled = true;
    } catch (probeError) {
      destroyClient = true;
      // callback が内部で SQL error を握り潰して正常 return した場合、tx は
      // aborted (25P02) のままで probe 自体が失敗する。書込みが commit されたか
      // 判定できないまま成功を返すと fail-open になるため fail-visible にする。
      throw new Error(
        'runInPooledTransaction callback returned but its transaction state could not be verified',
        { cause: probeError },
      );
    }
    if (leakedWrites) {
      // 契約違反の caller は session レベルの状態(例: pg_advisory_lock)を
      // 残し得るため、ROLLBACK 済みでも client は pool へ戻さず破棄する。
      destroyClient = true;
      throw new Error('runInPooledTransaction callback returned with an uncommitted transaction');
    }
    return result;
  } catch (error) {
    if (!transactionSettled) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
    }
    throw error;
  } finally {
    if (destroyClient) {
      client.release(true);
    } else {
      client.release();
    }
  }
}

export async function closeObservedDatabasePool(
  pool: Pick<Pool, 'end'>,
  stopObserving: () => void,
): Promise<void> {
  try {
    await pool.end();
  } finally {
    // Keep the error listener installed until every client has been drained or destroyed.
    stopObserving();
  }
}
