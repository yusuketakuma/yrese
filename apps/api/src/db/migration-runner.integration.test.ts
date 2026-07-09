import { describe, expect, it } from 'vitest';

import { applyPendingMigrations, assertMigrationStateAllowsStartup, MigrationStateError } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

describePostgres('PostgreSQL migration runner integration (set TEST_DATABASE_URL to run)', () => {
  it('applies the history-table migration explicitly and then allows startup check', async () => {
    if (testDatabaseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL unexpectedly missing');
    }

    const pool = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await pool.query('DROP TABLE IF EXISTS schema_migrations');
      const migrations = await loadMigrationFiles();

      await expect(assertMigrationStateAllowsStartup(pool, migrations)).rejects.toBeInstanceOf(MigrationStateError);

      const applied = await applyPendingMigrations(pool, migrations, {
        appliedBy: 'vitest',
        appliedAt: new Date('2026-07-09T00:00:00.000Z'),
      });
      expect(applied.appliedVersions).toEqual(['000001']);

      const startupCheck = await assertMigrationStateAllowsStartup(pool, migrations);
      expect(startupCheck).toMatchObject({
        ok: true,
        status: 'up_to_date',
      });

      const rows = await pool.query('SELECT version, applied_by FROM schema_migrations ORDER BY version ASC');
      expect(rows.rows).toEqual([{ version: '000001', applied_by: 'vitest' }]);
    } finally {
      await pool.query('DROP TABLE IF EXISTS schema_migrations');
      await pool.end();
    }
  });
});
