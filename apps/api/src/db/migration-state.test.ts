import { describe, expect, it } from 'vitest';

import { reconcileMigrationState, type AppliedMigration } from './migration-state.js';
import type { MigrationFile } from './migrations.js';

function migration(version: string, checksumSha256: string): MigrationFile {
  return {
    version,
    name: `migration_${version}`,
    filename: `${version}_migration.sql`,
    sql: '-- migration',
    checksumSha256,
  };
}

function applied(version: string, checksumSha256: string): AppliedMigration {
  return {
    version,
    name: `migration_${version}`,
    checksumSha256,
  };
}

describe('reconcileMigrationState', () => {
  it('allows startup when DB schema is up to date', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [applied('000001', 'a'.repeat(64))],
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'up_to_date',
      appliedCount: 1,
      availableCount: 1,
    });
  });

  it('allows startup when DB is ahead but prefix-compatible', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [applied('000001', 'a'.repeat(64)), applied('000002', 'b'.repeat(64))],
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'db_ahead',
      extraAppliedVersions: ['000002'],
    });
  });

  it('fails closed on checksum mismatch', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [applied('000001', 'b'.repeat(64))],
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'checksum_mismatch',
      version: '000001',
    });
  });

  it('fails closed when app requires unapplied migrations', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64)), migration('000002', 'b'.repeat(64))],
      appliedMigrations: [applied('000001', 'a'.repeat(64))],
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'unapplied_required',
      pendingVersions: ['000002'],
    });
  });
});
