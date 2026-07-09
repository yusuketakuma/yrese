import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface MigrationFile {
  readonly version: string;
  readonly name: string;
  readonly filename: string;
  readonly sql: string;
  readonly checksumSha256: string;
}

const migrationFilenamePattern = /^(\d{6})_([a-z0-9_]+)\.sql$/;

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

export function defaultMigrationsDirectory(): string {
  return resolve(process.cwd(), 'migrations');
}

export async function loadMigrationFiles(migrationsDirectory = defaultMigrationsDirectory()): Promise<readonly MigrationFile[]> {
  const filenames = (await readdir(migrationsDirectory)).filter((filename) => parseMigrationFilename(filename) !== undefined);
  const migrations = await Promise.all(
    filenames.map(async (filename): Promise<MigrationFile> => {
      const parsed = parseMigrationFilename(filename);
      if (parsed === undefined) {
        throw new Error(`invalid migration filename: ${filename}`);
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
