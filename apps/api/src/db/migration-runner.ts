import type { Pool, PoolClient } from 'pg';

import {
  formatMigrationCheckResult,
  reconcileMigrationState,
  type AppliedMigration,
  type MigrationCheckResult,
} from './migration-state.js';
import type { MigrationFile } from './migrations.js';

interface SchemaMigrationRow {
  readonly version: string;
  readonly name: string;
  readonly checksum_sha256: string;
}

export interface ApplyMigrationsOptions {
  readonly appliedBy: string;
  readonly appliedAt?: Date;
}

export interface ApplyMigrationsResult {
  readonly appliedVersions: readonly string[];
  readonly check: MigrationCheckResult;
}

export class MigrationStateError extends Error {
  constructor(readonly result: Extract<MigrationCheckResult, { ok: false }>) {
    super(formatMigrationCheckResult(result));
    this.name = 'MigrationStateError';
  }
}

function isUndefinedTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01';
}

function toAppliedMigration(row: SchemaMigrationRow): AppliedMigration {
  return {
    version: row.version,
    name: row.name,
    checksumSha256: row.checksum_sha256,
  };
}

async function readAppliedMigrations(client: PoolClient): Promise<readonly AppliedMigration[]> {
  try {
    const result = await client.query<SchemaMigrationRow>(
      'SELECT version, name, checksum_sha256 FROM schema_migrations ORDER BY version ASC',
    );
    return result.rows.map(toAppliedMigration);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function checkMigrationState(pool: Pool, migrations: readonly MigrationFile[]): Promise<MigrationCheckResult> {
  const client = await pool.connect();
  try {
    const appliedMigrations = await readAppliedMigrations(client);
    return reconcileMigrationState({
      availableMigrations: migrations,
      appliedMigrations,
    });
  } finally {
    client.release();
  }
}

export async function assertMigrationStateAllowsStartup(
  pool: Pool,
  migrations: readonly MigrationFile[],
): Promise<MigrationCheckResult> {
  const result = await checkMigrationState(pool, migrations);
  if (!result.ok) {
    throw new MigrationStateError(result);
  }
  return result;
}

async function applyMigration(
  client: PoolClient,
  migration: MigrationFile,
  options: ApplyMigrationsOptions,
  markClientUnusable: () => void,
): Promise<void> {
  const appliedAt = options.appliedAt ?? new Date();
  await client.query('BEGIN');
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO schema_migrations (version, name, checksum_sha256, applied_at, applied_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [migration.version, migration.name, migration.checksumSha256, appliedAt.toISOString(), options.appliedBy],
    );
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      markClientUnusable();
    }
    throw error;
  }
}

export async function applyPendingMigrations(
  pool: Pool,
  migrations: readonly MigrationFile[],
  options: ApplyMigrationsOptions,
): Promise<ApplyMigrationsResult> {
  const initialCheck = await checkMigrationState(pool, migrations);
  if (initialCheck.ok) {
    return {
      appliedVersions: [],
      check: initialCheck,
    };
  }
  if (initialCheck.status !== 'unapplied_required') {
    throw new MigrationStateError(initialCheck);
  }

  const pendingMigrations = migrations.slice(initialCheck.appliedCount);
  const appliedVersions: string[] = [];
  const client = await pool.connect();
  let clientUnusable = false;
  try {
    for (const migration of pendingMigrations) {
      await applyMigration(client, migration, options, () => {
        clientUnusable = true;
      });
      appliedVersions.push(migration.version);
    }
  } finally {
    if (clientUnusable) {
      client.release(true);
    } else {
      client.release();
    }
  }

  return {
    appliedVersions,
    check: await checkMigrationState(pool, migrations),
  };
}
