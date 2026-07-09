import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
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
  return JSON.stringify(filename);
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
  const entries = (await readdir(migrationsDirectory)).map((filename) => ({
    filename,
    parsed: parseMigrationDirectoryEntry(filename),
  }));
  const filenames = entries
    .filter((entry): entry is { filename: string; parsed: Pick<MigrationFile, 'version' | 'name' | 'filename'> } => entry.parsed !== undefined)
    .map((entry) => entry.filename);
  const migrations = await Promise.all(
    filenames.map(async (filename): Promise<MigrationFile> => {
      const parsed = parseMigrationFilename(filename);
      if (parsed === undefined) {
        throw new Error(`invalid migration filename ${formatFilenameForError(filename)}: expected NNNNNN_snake_case.sql`);
      }
      const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8');
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
