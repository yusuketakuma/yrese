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
 */
export async function runInPooledTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let destroyClient = false;
  try {
    await client.query('BEGIN');
    return await run(client);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      destroyClient = true;
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
