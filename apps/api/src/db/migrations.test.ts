import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { defaultMigrationsDirectory, loadMigrationFiles } from './migrations.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

async function withMigrationDirectory(
  files: Record<string, string>,
  test: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'yrese-migrations-'));
  try {
    await Promise.all(
      Object.entries(files).map(([filename, contents]) =>
        writeFile(resolve(directory, filename), contents, 'utf8'),
      ),
    );
    await test(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('loadMigrationFiles', () => {
  it('loads valid migration files in version order with checksums', async () => {
    await withMigrationDirectory(
      {
        '000002_second.sql': 'select 2;\n',
        '000001_first.sql': 'select 1;\n',
      },
      async (directory) => {
        const migrations = await loadMigrationFiles(directory);

        expect(migrations.map((migration) => migration.filename)).toEqual([
          '000001_first.sql',
          '000002_second.sql',
        ]);
        expect(migrations[0]).toMatchObject({
          version: '000001',
          name: 'first',
          sql: 'select 1;\n',
        });
        expect(migrations[0]?.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      },
    );
  });

  it('ignores explicitly allowed non-migration files', async () => {
    await withMigrationDirectory(
      {
        '000001_first.sql': 'select 1;\n',
        'README.md': '# migrations\n',
        '.gitkeep': '',
        '.DS_Store': 'metadata',
      },
      async (directory) => {
        const migrations = await loadMigrationFiles(directory);

        expect(migrations.map((migration) => migration.filename)).toEqual([
          '000001_first.sql',
        ]);
      },
    );
  });

  it.each([
    '000002_bad-name.sql',
    '000003_UPPERCASE.sql',
    '000004_missing_extension',
    '000005_almost_valid.sql.bak',
  ])('fails closed on invalid migration-like file %s', async (filename) => {
    await withMigrationDirectory(
      {
        '000001_first.sql': 'select 1;\n',
        [filename]: 'select 2;\n',
      },
      async (directory) => {
        await expect(loadMigrationFiles(directory)).rejects.toThrow(
          new RegExp(`invalid migration directory entry.*${filename.replace('.', '\\.')}`),
        );
      },
    );
  });

  it('keeps the default migrations directory independent from process cwd', async () => {
    const originalCwd = process.cwd();
    await withMigrationDirectory({}, async (directory) => {
      try {
        process.chdir(directory);

        expect(defaultMigrationsDirectory()).toBe(resolve(repositoryRoot, 'migrations'));
        const migrations = await loadMigrationFiles();
        expect(migrations.map((migration) => migration.filename)).toEqual([
          '000001_create_schema_migrations.sql',
          '000002_create_patient_and_reception_tables.sql',
        ]);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
