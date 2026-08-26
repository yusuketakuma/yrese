import type { PoolConfig } from 'pg';
import { describe, expect, it } from 'vitest';

import {
  defaultDbPoolConfiguration,
  resolveDbPoolConfiguration,
} from '../config.js';
import { createJsonRuntimeOperationalEventSink } from '../runtime-events.js';
import {
  createDbPool,
  observeDatabasePoolBackgroundErrors,
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
});
