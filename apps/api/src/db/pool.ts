import { Pool, type PoolConfig } from 'pg';

export function createDbPool(connectionString: string, overrides: Omit<PoolConfig, 'connectionString'> = {}): Pool {
  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ...overrides,
  });
}
