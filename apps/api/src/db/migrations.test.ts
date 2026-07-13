import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  const scopeError = 'Migration files could not be loaded from the protected repository scope.';

  it('fails closed for missing, file, empty, and ignored-only migration scopes', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'yrese-migration-scopes-'));
    try {
      const missing = resolve(parent, 'missing');
      await expect(loadMigrationFiles(missing)).rejects.toThrow(scopeError);
      await writeFile(resolve(parent, 'scope-file'), 'synthetic marker', 'utf8');
      await expect(loadMigrationFiles(resolve(parent, 'scope-file'))).rejects.toThrow(scopeError);
      await withMigrationDirectory({}, async (directory) => {
        await expect(loadMigrationFiles(directory)).rejects.toThrow(scopeError);
      });
      await withMigrationDirectory({ 'README.md': '# ignored\n' }, async (directory) => {
        await expect(loadMigrationFiles(directory)).rejects.toThrow(scopeError);
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('rejects migration and ignored-name symlinks without reading their targets', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'yrese-migration-symlinks-'));
    const external = resolve(parent, 'external.sql');
    const marker = 'synthetic-out-of-scope-sql-marker';
    await writeFile(external, marker, 'utf8');
    try {
      for (const filename of ['000001_external.sql', 'README.md']) {
        const directory = await mkdtemp(join(parent, 'scope-'));
        await symlink(external, resolve(directory, filename));
        const error = await loadMigrationFiles(directory).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(scopeError);
        expect((error as Error).message).not.toContain(parent);
        expect((error as Error).message).not.toContain(marker);
      }
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('rejects a symlinked migration scope and a validly named directory', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'yrese-migration-entry-kinds-'));
    try {
      const target = resolve(parent, 'target');
      await mkdir(target);
      await writeFile(resolve(target, '000001_first.sql'), 'select 1;\n', 'utf8');
      const linkedScope = resolve(parent, 'linked-scope');
      await symlink(target, linkedScope);
      await expect(loadMigrationFiles(linkedScope)).rejects.toThrow(scopeError);

      const directoryEntryScope = resolve(parent, 'directory-entry-scope');
      await mkdir(resolve(directoryEntryScope, '000001_directory.sql'), { recursive: true });
      await expect(loadMigrationFiles(directoryEntryScope)).rejects.toThrow(scopeError);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
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

  it('escapes control and Unicode separators in invalid filename diagnostics', async () => {
    const nel = String.fromCharCode(0x85);
    const lineSeparator = String.fromCharCode(0x2028);
    const paragraphSeparator = String.fromCharCode(0x2029);
    const filename = `synthetic\nname\t"marker${nel}next${lineSeparator}line${paragraphSeparator}paragraph.sql`;
    const contentMarker = 'synthetic-file-content-must-not-appear';
    await withMigrationDirectory(
      {
        '000001_first.sql': 'select 1;\n',
        [filename]: contentMarker,
      },
      async (directory) => {
        const error = await loadMigrationFiles(directory).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          'invalid migration directory entry "synthetic\\nname\\t\\"marker\\u0085next\\u2028line\\u2029paragraph.sql": expected migration filename NNNNNN_snake_case.sql or an explicitly ignored non-migration file',
        );
        expect((error as Error).message).not.toContain('\n');
        expect((error as Error).message).not.toContain('\t');
        expect((error as Error).message).not.toContain(nel);
        expect((error as Error).message).not.toContain(lineSeparator);
        expect((error as Error).message).not.toContain(paragraphSeparator);
        expect((error as Error).message).not.toContain(directory);
        expect((error as Error).message).not.toContain(contentMarker);
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
          '000003_add_patient_number_scope_unique.sql',
          '000004_create_audit_events.sql',
        ]);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
