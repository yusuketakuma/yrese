import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MigrationFile {
  readonly version: string;
  readonly name: string;
  readonly filename: string;
  readonly sql: string;
  readonly checksumSha256: string;
}

const migrationFilenamePattern = /^(\d{6})_([a-z0-9_]+)\.sql$/;
const ignoredMigrationDirectoryEntries = new Set(['README.md', '.gitkeep', '.DS_Store']);
const migrationScopeError = 'Migration files could not be loaded from the protected repository scope.';

function checksumSha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function parseMigrationFilename(filename: string): Pick<MigrationFile, 'version' | 'name' | 'filename'> | undefined {
  const match = migrationFilenamePattern.exec(filename);
  if (match === null) {
    return undefined;
  }
  const version = match[1];
  const name = match[2];
  if (version === undefined || name === undefined) {
    return undefined;
  }
  return { version, name, filename };
}

function repositoryRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function formatFilenameForError(filename: string): string {
  return JSON.stringify(filename).replace(/[\u0085\u2028\u2029]/gu, (separator) =>
    `\\u${separator.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function parseMigrationDirectoryEntry(filename: string): Pick<MigrationFile, 'version' | 'name' | 'filename'> | undefined {
  const parsed = parseMigrationFilename(filename);
  if (parsed !== undefined) {
    return parsed;
  }
  if (ignoredMigrationDirectoryEntries.has(filename)) {
    return undefined;
  }
  throw new Error(
    `invalid migration directory entry ${formatFilenameForError(filename)}: expected migration filename NNNNNN_snake_case.sql or an explicitly ignored non-migration file`,
  );
}

export function defaultMigrationsDirectory(): string {
  return resolve(repositoryRoot(), 'migrations');
}

export async function loadMigrationFiles(migrationsDirectory = defaultMigrationsDirectory()): Promise<readonly MigrationFile[]> {
  let directoryEntries;
  try {
    const directory = await lstat(migrationsDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error(migrationScopeError);
    }
    directoryEntries = await readdir(migrationsDirectory, { withFileTypes: true });
  } catch {
    throw new Error(migrationScopeError);
  }
  const entries = directoryEntries.map((entry) => ({
    entry,
    filename: entry.name,
    parsed: parseMigrationDirectoryEntry(entry.name),
  }));
  for (const { entry } of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(migrationScopeError);
    }
  }
  const filenames = entries
    .filter((entry): entry is typeof entry & { parsed: Pick<MigrationFile, 'version' | 'name' | 'filename'> } => entry.parsed !== undefined)
    .map((entry) => entry.filename);
  if (filenames.length === 0) {
    throw new Error(migrationScopeError);
  }
  const migrations = await Promise.all(
    filenames.map(async (filename): Promise<MigrationFile> => {
      const parsed = parseMigrationFilename(filename);
      if (parsed === undefined) {
        throw new Error(`invalid migration filename ${formatFilenameForError(filename)}: expected NNNNNN_snake_case.sql`);
      }
      let sql: string;
      try {
        sql = await readFile(resolve(migrationsDirectory, filename), 'utf8');
      } catch {
        throw new Error(migrationScopeError);
      }
      return {
        ...parsed,
        sql,
        checksumSha256: checksumSha256(sql),
      };
    }),
  );

  const sorted = [...migrations].sort((left, right) => left.version.localeCompare(right.version));
  const seen = new Set<string>();
  for (const migration of sorted) {
    if (seen.has(migration.version)) {
      throw new Error(`duplicate migration version: ${migration.version}`);
    }
    seen.add(migration.version);
  }

  return sorted;
}
