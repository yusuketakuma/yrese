import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { applyPendingMigrations, MigrationStateError } from './migration-runner.js';
import type { MigrationFile } from './migrations.js';

const migrations: readonly MigrationFile[] = [
  {
    version: '000001',
    name: 'first',
    filename: '000001_first.sql',
    sql: 'CREATE TABLE first_migration (id text)',
    checksumSha256: 'checksum-000001',
  },
  {
    version: '000002',
    name: 'second',
    filename: '000002_second.sql',
    sql: 'CREATE TABLE second_migration (id text)',
    checksumSha256: 'checksum-000002',
  },
];

interface FakeClient {
  readonly client: PoolClient;
  readonly query: ReturnType<typeof vi.fn>;
  readonly release: ReturnType<typeof vi.fn>;
}

function createClient(queryImplementation: (sql: string) => Promise<{ rows: readonly unknown[] }>): FakeClient {
  const query = vi.fn(queryImplementation);
  const release = vi.fn();
  return {
    client: { query, release } as unknown as PoolClient,
    query,
    release,
  };
}

function createCheckClient(appliedRows: readonly unknown[]): FakeClient {
  return createClient(async (sql) => {
    expect(sql).toContain('SELECT version, name, checksum_sha256');
    return { rows: appliedRows };
  });
}

function createPool(clients: readonly FakeClient[]): { readonly pool: Pool; readonly connect: ReturnType<typeof vi.fn> } {
  let index = 0;
  const connect = vi.fn(async () => {
    const client = clients[index];
    index += 1;
    if (client === undefined) {
      throw new Error('unexpected pool connection');
    }
    return client.client;
  });
  return { pool: { connect } as unknown as Pool, connect };
}

async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected migration operation to reject');
}

describe('applyPendingMigrations client lifecycle', () => {
  it('rejects migration version drift before acquiring an operation client or running SQL', async () => {
    const initialCheck = createCheckClient([
      {
        version: '000009',
        name: migrations[0]?.name,
        checksum_sha256: migrations[0]?.checksumSha256,
      },
    ]);
    const { pool, connect } = createPool([initialCheck]);

    const error = await captureRejection(() =>
      applyPendingMigrations(pool, migrations.slice(0, 1), {
        appliedBy: 'synthetic-migration-test',
      }),
    );

    expect(error).toBeInstanceOf(MigrationStateError);
    expect((error as MigrationStateError).result).toEqual({
      ok: false,
      status: 'version_mismatch',
      appliedCount: 1,
      availableCount: 1,
      expectedVersion: '000001',
      actualVersion: '000009',
    });
    expect((error as Error).message).toBe(
      'DB migration version mismatch: expected "000001", actual "000009"',
    );
    expect(connect).toHaveBeenCalledOnce();
    expect(initialCheck.query).toHaveBeenCalledOnce();
    expect(initialCheck.release.mock.calls).toEqual([[]]);
  });

  it('rejects migration name drift before acquiring an operation client or running SQL', async () => {
    const initialCheck = createCheckClient([
      {
        version: migrations[0]?.version,
        name: 'renamed_first',
        checksum_sha256: migrations[0]?.checksumSha256,
      },
    ]);
    const { pool, connect } = createPool([initialCheck]);

    const error = await captureRejection(() =>
      applyPendingMigrations(pool, migrations.slice(0, 1), {
        appliedBy: 'synthetic-migration-test',
      }),
    );

    expect(error).toBeInstanceOf(MigrationStateError);
    expect((error as MigrationStateError).result).toEqual({
      ok: false,
      status: 'name_mismatch',
      appliedCount: 1,
      availableCount: 1,
      version: '000001',
      expectedName: 'first',
      actualName: 'renamed_first',
    });
    expect(connect).toHaveBeenCalledOnce();
    expect(initialCheck.query).toHaveBeenCalledOnce();
    expect(initialCheck.release.mock.calls).toEqual([[]]);
  });

  it('applies all migrations and releases operation and check clients for reuse', async () => {
    const initialCheck = createCheckClient([]);
    const operation = createClient(async () => ({ rows: [] }));
    const finalCheck = createCheckClient(
      migrations.map((migration) => ({
        version: migration.version,
        name: migration.name,
        checksum_sha256: migration.checksumSha256,
      })),
    );
    const { pool, connect } = createPool([initialCheck, operation, finalCheck]);

    const result = await applyPendingMigrations(pool, migrations, {
      appliedBy: 'synthetic-migration-test',
      appliedAt: new Date('2026-07-13T00:00:00.000Z'),
    });

    expect(result.appliedVersions).toEqual(['000001', '000002']);
    expect(result.check.ok).toBe(true);
    expect(operation.query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      migrations[0]?.sql,
      expect.stringContaining('INSERT INTO schema_migrations'),
      'COMMIT',
      'BEGIN',
      migrations[1]?.sql,
      expect.stringContaining('INSERT INTO schema_migrations'),
      'COMMIT',
    ]);
    expect(connect).toHaveBeenCalledTimes(3);
    expect(initialCheck.release.mock.calls).toEqual([[]]);
    expect(operation.release.mock.calls).toEqual([[]]);
    expect(finalCheck.release.mock.calls).toEqual([[]]);
  });

  it.each([
    {
      label: 'version drift',
      finalRows: [
        {
          version: '000009',
          name: migrations[0]?.name,
          checksum_sha256: migrations[0]?.checksumSha256,
        },
      ],
      expectedResult: {
        ok: false,
        status: 'version_mismatch',
        appliedCount: 1,
        availableCount: 1,
        expectedVersion: '000001',
        actualVersion: '000009',
      },
    },
    {
      label: 'checksum drift',
      finalRows: [
        {
          version: migrations[0]?.version,
          name: migrations[0]?.name,
          checksum_sha256: 'drifted-checksum',
        },
      ],
      expectedResult: {
        ok: false,
        status: 'checksum_mismatch',
        appliedCount: 1,
        availableCount: 1,
        version: '000001',
        expectedChecksumSha256: 'checksum-000001',
        actualChecksumSha256: 'drifted-checksum',
      },
    },
    {
      label: 'name drift',
      finalRows: [
        {
          version: migrations[0]?.version,
          name: 'renamed_first',
          checksum_sha256: migrations[0]?.checksumSha256,
        },
      ],
      expectedResult: {
        ok: false,
        status: 'name_mismatch',
        appliedCount: 1,
        availableCount: 1,
        version: '000001',
        expectedName: 'first',
        actualName: 'renamed_first',
      },
    },
    {
      label: 'a still-unapplied migration',
      finalRows: [],
      expectedResult: {
        ok: false,
        status: 'unapplied_required',
        appliedCount: 0,
        availableCount: 1,
        pendingVersions: ['000001'],
      },
    },
  ])('rejects final reconciliation with $label without undoing committed work', async ({ finalRows, expectedResult }) => {
    const initialCheck = createCheckClient([]);
    const operation = createClient(async () => ({ rows: [] }));
    const finalCheck = createCheckClient(finalRows);
    const { pool, connect } = createPool([initialCheck, operation, finalCheck]);

    const error = await captureRejection(() =>
      applyPendingMigrations(pool, migrations.slice(0, 1), {
        appliedBy: 'synthetic-migration-test',
      }),
    );

    expect(error).toBeInstanceOf(MigrationStateError);
    expect((error as MigrationStateError).result).toEqual(expectedResult);
    expect(operation.query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      migrations[0]?.sql,
      expect.stringContaining('INSERT INTO schema_migrations'),
      'COMMIT',
    ]);
    expect(connect).toHaveBeenCalledTimes(3);
    expect(initialCheck.release.mock.calls).toEqual([[]]);
    expect(operation.release.mock.calls).toEqual([[]]);
    expect(finalCheck.query).toHaveBeenCalledOnce();
    expect(finalCheck.release.mock.calls).toEqual([[]]);
  });

  it('accepts a final DB-ahead state after applying the repository migration prefix', async () => {
    const initialCheck = createCheckClient([]);
    const operation = createClient(async () => ({ rows: [] }));
    const finalCheck = createCheckClient([
      {
        version: migrations[0]?.version,
        name: migrations[0]?.name,
        checksum_sha256: migrations[0]?.checksumSha256,
      },
      {
        version: '000002',
        name: 'future_migration',
        checksum_sha256: 'future-checksum',
      },
    ]);
    const { pool, connect } = createPool([initialCheck, operation, finalCheck]);

    const result = await applyPendingMigrations(pool, migrations.slice(0, 1), {
      appliedBy: 'synthetic-migration-test',
    });

    expect(result).toEqual({
      appliedVersions: ['000001'],
      check: {
        ok: true,
        status: 'db_ahead',
        appliedCount: 2,
        availableCount: 1,
        extraAppliedVersions: ['000002'],
      },
    });
    expect(connect).toHaveBeenCalledTimes(3);
    expect(operation.release.mock.calls).toEqual([[]]);
    expect(finalCheck.release.mock.calls).toEqual([[]]);
  });

  it('preserves the operation error and reuses the client after rollback succeeds', async () => {
    const operationError = new Error('synthetic migration SQL failure');
    const initialCheck = createCheckClient([]);
    const operation = createClient(async (sql) => {
      if (sql === migrations[0]?.sql) {
        throw operationError;
      }
      return { rows: [] };
    });
    const { pool, connect } = createPool([initialCheck, operation]);

    expect(
      await captureRejection(() => applyPendingMigrations(pool, migrations, { appliedBy: 'synthetic-migration-test' })),
    ).toBe(operationError);
    expect(operation.query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      migrations[0]?.sql,
      'ROLLBACK',
    ]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(initialCheck.release.mock.calls).toEqual([[]]);
    expect(operation.release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after rollback fails without masking the operation error', async () => {
    const operationError = new Error('synthetic migration SQL failure');
    const rollbackError = new Error('synthetic rollback failure');
    const initialCheck = createCheckClient([]);
    const operation = createClient(async (sql) => {
      if (sql === migrations[0]?.sql) {
        throw operationError;
      }
      if (sql === 'ROLLBACK') {
        throw rollbackError;
      }
      return { rows: [] };
    });
    const { pool, connect } = createPool([initialCheck, operation]);

    expect(
      await captureRejection(() => applyPendingMigrations(pool, migrations, { appliedBy: 'synthetic-migration-test' })),
    ).toBe(operationError);
    expect(operation.query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      migrations[0]?.sql,
      'ROLLBACK',
    ]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(initialCheck.release.mock.calls).toEqual([[]]);
    expect(operation.release.mock.calls).toEqual([[true]]);
  });

  it('reuses the client after BEGIN fails without attempting rollback or later work', async () => {
    const beginError = new Error('synthetic BEGIN failure');
    const initialCheck = createCheckClient([]);
    const operation = createClient(async (sql) => {
      if (sql === 'BEGIN') {
        throw beginError;
      }
      return { rows: [] };
    });
    const { pool, connect } = createPool([initialCheck, operation]);

    expect(
      await captureRejection(() => applyPendingMigrations(pool, migrations, { appliedBy: 'synthetic-migration-test' })),
    ).toBe(beginError);
    expect(operation.query.mock.calls.map(([sql]) => String(sql).trim())).toEqual(['BEGIN']);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(initialCheck.release.mock.calls).toEqual([[]]);
    expect(operation.release.mock.calls).toEqual([[]]);
  });
});
