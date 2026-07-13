import type { MigrationFile } from './migrations.js';

export interface AppliedMigration {
  readonly version: string;
  readonly name: string;
  readonly checksumSha256: string;
}

export type MigrationCheckResult =
  | {
      readonly ok: true;
      readonly status: 'up_to_date' | 'db_ahead';
      readonly appliedCount: number;
      readonly availableCount: number;
      readonly extraAppliedVersions: readonly string[];
    }
  | {
      readonly ok: false;
      readonly status: 'version_mismatch';
      readonly appliedCount: number;
      readonly availableCount: number;
      readonly expectedVersion: string;
      readonly actualVersion: string;
    }
  | {
      readonly ok: false;
      readonly status: 'checksum_mismatch';
      readonly appliedCount: number;
      readonly availableCount: number;
      readonly version: string;
      readonly expectedChecksumSha256: string;
      readonly actualChecksumSha256: string;
    }
  | {
      readonly ok: false;
      readonly status: 'name_mismatch';
      readonly appliedCount: number;
      readonly availableCount: number;
      readonly version: string;
      readonly expectedName: string;
      readonly actualName: string;
    }
  | {
      readonly ok: false;
      readonly status: 'unapplied_required';
      readonly appliedCount: number;
      readonly availableCount: number;
      readonly pendingVersions: readonly string[];
    };

export function reconcileMigrationState(input: {
  readonly availableMigrations: readonly MigrationFile[];
  readonly appliedMigrations: readonly AppliedMigration[];
}): MigrationCheckResult {
  const { availableMigrations, appliedMigrations } = input;
  const comparableCount = Math.min(availableMigrations.length, appliedMigrations.length);

  for (let index = 0; index < comparableCount; index += 1) {
    const available = availableMigrations[index];
    const applied = appliedMigrations[index];
    if (available === undefined || applied === undefined) {
      throw new Error('migration reconciliation index is unexpectedly out of range');
    }

    if (applied.version !== available.version) {
      return {
        ok: false,
        status: 'version_mismatch',
        appliedCount: appliedMigrations.length,
        availableCount: availableMigrations.length,
        expectedVersion: available.version,
        actualVersion: applied.version,
      };
    }
    if (applied.checksumSha256 !== available.checksumSha256) {
      return {
        ok: false,
        status: 'checksum_mismatch',
        appliedCount: appliedMigrations.length,
        availableCount: availableMigrations.length,
        version: available.version,
        expectedChecksumSha256: available.checksumSha256,
        actualChecksumSha256: applied.checksumSha256,
      };
    }
    if (applied.name !== available.name) {
      return {
        ok: false,
        status: 'name_mismatch',
        appliedCount: appliedMigrations.length,
        availableCount: availableMigrations.length,
        version: available.version,
        expectedName: available.name,
        actualName: applied.name,
      };
    }
  }

  if (appliedMigrations.length > availableMigrations.length) {
    return {
      ok: true,
      status: 'db_ahead',
      appliedCount: appliedMigrations.length,
      availableCount: availableMigrations.length,
      extraAppliedVersions: appliedMigrations.slice(availableMigrations.length).map((migration) => migration.version),
    };
  }

  if (appliedMigrations.length < availableMigrations.length) {
    return {
      ok: false,
      status: 'unapplied_required',
      appliedCount: appliedMigrations.length,
      availableCount: availableMigrations.length,
      pendingVersions: availableMigrations.slice(appliedMigrations.length).map((migration) => migration.version),
    };
  }

  return {
    ok: true,
    status: 'up_to_date',
    appliedCount: appliedMigrations.length,
    availableCount: availableMigrations.length,
    extraAppliedVersions: [],
  };
}

function quoteMigrationDiagnosticValue(value: string): string {
  return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/gu, (separator) =>
    `\\u${separator.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export function formatMigrationCheckResult(result: MigrationCheckResult): string {
  if (result.ok) {
    if (result.status === 'db_ahead') {
      return `DB schema is ahead but prefix-compatible: ${result.extraAppliedVersions.join(', ')}`;
    }
    return `DB schema is up to date (${result.appliedCount}/${result.availableCount}).`;
  }

  if (result.status === 'version_mismatch') {
    return `DB migration version mismatch: expected ${quoteMigrationDiagnosticValue(result.expectedVersion)}, actual ${quoteMigrationDiagnosticValue(result.actualVersion)}`;
  }

  if (result.status === 'checksum_mismatch') {
    return `DB schema checksum mismatch at ${result.version}: expected ${result.expectedChecksumSha256}, actual ${result.actualChecksumSha256}`;
  }

  if (result.status === 'name_mismatch') {
    return `DB migration name mismatch at ${result.version}: expected ${quoteMigrationDiagnosticValue(result.expectedName)}, actual ${quoteMigrationDiagnosticValue(result.actualName)}`;
  }

  return `DB schema requires explicit migration apply before startup: ${result.pendingVersions.join(', ')}`;
}
