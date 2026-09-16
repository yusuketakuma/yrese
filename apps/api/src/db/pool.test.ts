import type { Pool, PoolClient, PoolConfig } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultDbPoolConfiguration,
  resolveDbPoolConfiguration,
} from '../config.js';
import { createJsonRuntimeOperationalEventSink } from '../runtime-events.js';
import {
  closeObservedDatabasePool,
  createDbPool,
  observeDatabasePoolBackgroundErrors,
  runInPooledTransaction,
  snapshotDatabasePool,
} from './pool.js';

function absentPoolConfigurationInput() {
  return {
    max: undefined,
    idleTimeoutMillis: undefined,
    connectionTimeoutMillis: undefined,
    maxLifetimeSeconds: undefined,
  };
}

describe('resolveDbPoolConfiguration', () => {
  it('uses the bounded operational defaults when no override is present', () => {
    expect(resolveDbPoolConfiguration(absentPoolConfigurationInput())).toEqual(
      defaultDbPoolConfiguration,
    );
  });

  it('accepts trimmed decimal overrides at the supported boundaries', () => {
    expect(
      resolveDbPoolConfiguration({
        max: ' 100 ',
        idleTimeoutMillis: '1000',
        connectionTimeoutMillis: '60000',
        maxLifetimeSeconds: '0',
      }),
    ).toEqual({
      max: 100,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 60_000,
      maxLifetimeSeconds: 0,
    });
  });

  it('rejects blank, signed, fractional, and out-of-range values without echoing them', () => {
    const cases = [
      {
        input: { ...absentPoolConfigurationInput(), max: '0' },
        variableName: 'YRESE_DB_POOL_MAX',
        rawValue: '0',
      },
      {
        input: { ...absentPoolConfigurationInput(), max: '101' },
        variableName: 'YRESE_DB_POOL_MAX',
        rawValue: '101',
      },
      {
        input: { ...absentPoolConfigurationInput(), idleTimeoutMillis: '' },
        variableName: 'YRESE_DB_POOL_IDLE_TIMEOUT_MS',
        rawValue: '',
      },
      {
        input: { ...absentPoolConfigurationInput(), idleTimeoutMillis: '+1000' },
        variableName: 'YRESE_DB_POOL_IDLE_TIMEOUT_MS',
        rawValue: '+1000',
      },
      {
        input: { ...absentPoolConfigurationInput(), connectionTimeoutMillis: '249' },
        variableName: 'YRESE_DB_POOL_CONNECTION_TIMEOUT_MS',
        rawValue: '249',
      },
      {
        input: { ...absentPoolConfigurationInput(), connectionTimeoutMillis: '1.5' },
        variableName: 'YRESE_DB_POOL_CONNECTION_TIMEOUT_MS',
        rawValue: '1.5',
      },
      {
        input: { ...absentPoolConfigurationInput(), maxLifetimeSeconds: '86401' },
        variableName: 'YRESE_DB_POOL_MAX_LIFETIME_SECONDS',
        rawValue: '86401',
      },
      {
        input: {
          ...absentPoolConfigurationInput(),
          maxLifetimeSeconds: '999999999999999999999',
        },
        variableName: 'YRESE_DB_POOL_MAX_LIFETIME_SECONDS',
        rawValue: '999999999999999999999',
      },
    ];

    for (const testCase of cases) {
      try {
        resolveDbPoolConfiguration(testCase.input);
        throw new Error('expected database pool configuration to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toContain(testCase.variableName);
        if (testCase.rawValue.length > 4) {
          expect((error as Error).message).not.toContain(testCase.rawValue);
        }
      }
    }
  });
});

describe('createDbPool', () => {
  it('wires the resolved limits into node-postgres without connecting eagerly', async () => {
    const configuration = {
      max: 7,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 6_000,
      maxLifetimeSeconds: 600,
    };
    const pool = createDbPool(
      'postgresql://synthetic.invalid/yrese',
      {},
      configuration,
    );
    const options = (pool as unknown as { readonly options: PoolConfig }).options;

    expect(options.max).toBe(configuration.max);
    expect(options.idleTimeoutMillis).toBe(configuration.idleTimeoutMillis);
    expect(options.connectionTimeoutMillis).toBe(
      configuration.connectionTimeoutMillis,
    );
    expect(options.maxLifetimeSeconds).toBe(configuration.maxLifetimeSeconds);
    expect(snapshotDatabasePool(pool)).toEqual({
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    });

    await pool.end();
  });

  it('captures idle-client background failures without logging raw error detail', async () => {
    const pool = createDbPool('postgresql://synthetic.invalid/yrese');
    const errorLines: string[] = [];
    const events = createJsonRuntimeOperationalEventSink({
      now: () => new Date('2026-08-27T00:00:00.000Z'),
      writeError: (line) => errorLines.push(line),
    });
    const initialListeners = pool.listenerCount('error');
    const stopObserving = observeDatabasePoolBackgroundErrors(pool, events);

    expect(pool.listenerCount('error')).toBe(initialListeners + 1);
    pool.emit(
      'error',
      new Error('postgres://user:secret@db/patient-private'),
    );

    expect(errorLines).toHaveLength(1);
    expect(JSON.parse(errorLines[0] ?? '')).toEqual({
      timestamp: '2026-08-27T00:00:00.000Z',
      level: 'ERROR',
      event: 'database.pool.background_error',
      databasePool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
    });
    expect(errorLines.join('\n')).not.toContain('postgres://');
    expect(errorLines.join('\n')).not.toContain('secret');
    expect(errorLines.join('\n')).not.toContain('patient-private');

    stopObserving();
    stopObserving();
    expect(pool.listenerCount('error')).toBe(initialListeners);
    await pool.end();
  });

  it('does not rethrow a pool error when the operational sink itself fails', async () => {
    const pool = createDbPool('postgresql://synthetic.invalid/yrese');
    const stopObserving = observeDatabasePoolBackgroundErrors(pool, {
      record() {
        throw new Error('synthetic reporter detail');
      },
    });

    expect(() => pool.emit('error', new Error('synthetic pool detail'))).not.toThrow();

    stopObserving();
    await pool.end();
  });
});

describe('runInPooledTransaction', () => {
  function createClient(options: { readonly rollbackError?: Error } = {}) {
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.trim() === 'ROLLBACK' && options.rollbackError !== undefined) {
        throw options.rollbackError;
      }
      return { rows: [] };
    });
    const client = {
      query: query as unknown as PoolClient['query'],
      release,
    } as unknown as PoolClient;
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    return { pool, query, release };
  }

  it('begins before run and leaves commit or rollback to the caller', async () => {
    const { pool, query, release } = createClient();

    const result = await runInPooledTransaction(pool, async (client) => {
      await client.query('SELECT 1');
      await client.query('COMMIT');
      return 'done';
    });

    expect(result).toBe('done');
    // COMMIT 済みなら xact id は採番されていない → safety ROLLBACK は no-op。
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      'SELECT 1',
      'COMMIT',
      'SELECT pg_current_xact_id_if_assigned() AS xid',
      'ROLLBACK',
    ]);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('discards a forgotten open transaction instead of returning the client to the pool', async () => {
    // callback が COMMIT を発行しないまま正常 return しても、open transaction の
    // client を pool へ戻さない。無書込みの open tx は ROLLBACK で閉じて result を返す。
    const { pool, query, release } = createClient();

    const result = await runInPooledTransaction(pool, async (client) => {
      await client.query('SELECT 1');
      return 'done';
    });

    expect(result).toBe('done');
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      'SELECT 1',
      'SELECT pg_current_xact_id_if_assigned() AS xid',
      'ROLLBACK',
    ]);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('fails visibly when a successful callback leaves uncommitted writes behind', async () => {
    // 採番済み xact id が残る = 書込みが commit されていない。成功と誤認させず
    // 契約違反として throw し、open transaction は破棄する。
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_current_xact_id_if_assigned')) {
        return { rows: [{ xid: '42' }] };
      }
      return { rows: [] };
    });
    const client = {
      query: query as unknown as PoolClient['query'],
      release,
    } as unknown as PoolClient;
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await expect(
      runInPooledTransaction(pool, async (client) => {
        await client.query('INSERT INTO synthetic VALUES (1)');
        return 'phantom-write';
      }),
    ).rejects.toThrowError(/uncommitted transaction/);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      'INSERT INTO synthetic VALUES (1)',
      'SELECT pg_current_xact_id_if_assigned() AS xid',
      'ROLLBACK',
    ]);
    // 契約違反の caller は session 状態を残し得るため client は破棄する
    expect(release.mock.calls).toEqual([[true]]);
  });

  it('fails visibly when a swallowed statement error leaves the transaction aborted', async () => {
    // callback 内で SQL error を握り潰すと tx は aborted (25P02) になり、
    // 終了状態 probe 自体が失敗する。書込みが commit されたか不明なまま
    // 成功を返すと fail-open になるため reject し client を破棄する。
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_current_xact_id_if_assigned')) {
        throw Object.assign(new Error('current transaction is aborted'), {
          code: '25P02',
        });
      }
      return { rows: [] };
    });
    const client = {
      query: query as unknown as PoolClient['query'],
      release,
    } as unknown as PoolClient;
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await expect(
      runInPooledTransaction(pool, async (client) => {
        try {
          await client.query('INSERT INTO synthetic VALUES (1)');
        } catch {
          // caller が内部で握り潰した SQL error
        }
        return 'phantom-success';
      }),
    ).rejects.toThrowError(/transaction state could not be verified/);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      'INSERT INTO synthetic VALUES (1)',
      'SELECT pg_current_xact_id_if_assigned() AS xid',
      'ROLLBACK',
    ]);
    expect(release.mock.calls).toEqual([[true]]);
  });

  it('rolls back and reuses the client when run throws', async () => {
    const { pool, query, release } = createClient();
    const operationError = new Error('synthetic operation failure');

    await expect(
      runInPooledTransaction(pool, async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client when rollback fails without masking the original error', async () => {
    const operationError = new Error('synthetic operation failure');
    const rollbackError = new Error('synthetic rollback failure');
    const { pool, release } = createClient({ rollbackError });

    await expect(
      runInPooledTransaction(pool, async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);
    expect(release.mock.calls).toEqual([[true]]);
  });

  it('propagates a connect failure without touching release', async () => {
    const connectError = new Error('synthetic connect failure');
    const pool = {
      connect: vi.fn(async () => {
        throw connectError;
      }),
    } as unknown as Pool;

    await expect(
      runInPooledTransaction(pool, async () => 'unreachable'),
    ).rejects.toBe(connectError);
  });
});

describe('closeObservedDatabasePool', () => {
  it('keeps the observer installed until pool.end settles', async () => {
    let resolveEnd: (() => void) | undefined;
    const end = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveEnd = resolve;
        }),
    );
    const stopObserving = vi.fn();

    const closing = closeObservedDatabasePool({ end }, stopObserving);

    expect(end).toHaveBeenCalledOnce();
    expect(stopObserving).not.toHaveBeenCalled();
    resolveEnd?.();
    await closing;
    expect(stopObserving).toHaveBeenCalledOnce();
  });

  it('removes the observer after a pool.end failure without hiding that failure', async () => {
    const endError = new Error('synthetic pool end detail');
    const stopObserving = vi.fn();

    await expect(
      closeObservedDatabasePool(
        { end: vi.fn().mockRejectedValue(endError) },
        stopObserving,
      ),
    ).rejects.toBe(endError);
    expect(stopObserving).toHaveBeenCalledOnce();
  });
});
