import { describe, expect, it } from 'vitest';

import {
  formatMigrationCheckResult,
  reconcileMigrationState,
  type AppliedMigration,
} from './migration-state.js';
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

  it('fails closed when an applied migration name differs from immutable repository history', () => {
    const available = migration('000001', 'a'.repeat(64));
    const result = reconcileMigrationState({
      availableMigrations: [available],
      appliedMigrations: [
        {
          ...applied('000001', 'a'.repeat(64)),
          name: 'renamed_migration_000001',
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      status: 'name_mismatch',
      appliedCount: 1,
      availableCount: 1,
      version: '000001',
      expectedName: available.name,
      actualName: 'renamed_migration_000001',
    });
    expect(formatMigrationCheckResult(result)).toBe(
      'DB migration name mismatch at 000001: expected "migration_000001", actual "renamed_migration_000001"',
    );
  });

  it('escapes control characters from DB-sourced migration names in diagnostics', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [
        {
          ...applied('000001', 'a'.repeat(64)),
          name: 'renamed\nforged\tmigration',
        },
      ],
    });

    expect(result).toMatchObject({ ok: false, status: 'name_mismatch' });
    const message = formatMigrationCheckResult(result);
    expect(message).toContain('actual "renamed\\nforged\\tmigration"');
    expect(message).not.toContain('\n');
    expect(message).not.toContain('\t');
  });

  it('keeps checksum mismatch authoritative when both checksum and name differ', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [
        {
          ...applied('000001', 'b'.repeat(64)),
          name: 'renamed_migration_000001',
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'checksum_mismatch',
      version: '000001',
    });
  });

  it('rejects a name mismatch in the comparable prefix before reporting DB ahead', () => {
    const result = reconcileMigrationState({
      availableMigrations: [migration('000001', 'a'.repeat(64))],
      appliedMigrations: [
        { ...applied('000001', 'a'.repeat(64)), name: 'renamed_migration_000001' },
        applied('000002', 'b'.repeat(64)),
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'name_mismatch',
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
