import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { applyPendingMigrations, assertMigrationStateAllowsStartup, MigrationStateError } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

function createTestSchemaName(): string {
  return `yrese_migration_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function withTestSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }

  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, { max: 1, options: `-c search_path=${schemaName}` });
  try {
    await run(pool);
  } finally {
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await cleanupPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupPool.end();
    }
  }
}

describePostgres('PostgreSQL migration runner integration (set TEST_DATABASE_URL to run)', () => {
  it('applies the history-table migration explicitly and then allows startup check', async () => {
    await withTestSchema(async (pool) => {
      const migrations = await loadMigrationFiles();

      await expect(assertMigrationStateAllowsStartup(pool, migrations)).rejects.toBeInstanceOf(MigrationStateError);

      const applied = await applyPendingMigrations(pool, migrations, {
        appliedBy: 'vitest',
        appliedAt: new Date('2026-07-09T00:00:00.000Z'),
      });
      expect(applied.appliedVersions).toEqual(['000001', '000002', '000003']);

      const startupCheck = await assertMigrationStateAllowsStartup(pool, migrations);
      expect(startupCheck).toMatchObject({
        ok: true,
        status: 'up_to_date',
      });

      const rows = await pool.query('SELECT version, applied_by FROM schema_migrations ORDER BY version ASC');
      expect(rows.rows).toEqual([
        { version: '000001', applied_by: 'vitest' },
        { version: '000002', applied_by: 'vitest' },
        { version: '000003', applied_by: 'vitest' },
      ]);
    });
  });

  it('rolls back the uniqueness migration when legacy patient numbers conflict', async () => {
    await withTestSchema(async (pool) => {
      const migrations = await loadMigrationFiles();
      const migrationsBeforeUniqueness = migrations.filter((migration) => migration.version.localeCompare('000003') < 0);
      await applyPendingMigrations(pool, migrationsBeforeUniqueness, {
        appliedBy: 'vitest',
        appliedAt: new Date('2026-07-09T00:00:00.000Z'),
      });

      await pool.query(
        `INSERT INTO patients (
           tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
           patient_number, eligibility_status, eligibility_checked_at
         ) VALUES
           ('tenant-legacy', 'pharmacy-legacy', 'patient-legacy-001', '合成患者一', 'ゴウセイカンジャイチ', '1980-01-01', 'female', 'LEGACY-001', 'VERIFIED', NULL),
           ('tenant-legacy', 'pharmacy-legacy', 'patient-legacy-002', '合成患者二', 'ゴウセイカンジャニ', '1980-01-02', 'female', 'LEGACY-001', 'VERIFIED', NULL)`,
      );

      await expect(
        applyPendingMigrations(pool, migrations, {
          appliedBy: 'vitest',
          appliedAt: new Date('2026-07-10T00:00:00.000Z'),
        }),
      ).rejects.toMatchObject({ code: '23505' });

      const history = await pool.query('SELECT version FROM schema_migrations ORDER BY version ASC');
      expect(history.rows).toEqual([{ version: '000001' }, { version: '000002' }]);
      const constraint = await pool.query(
        `SELECT conname
         FROM pg_constraint
         WHERE conrelid = 'patients'::regclass
           AND conname = 'patients_tenant_pharmacy_patient_number_unique'`,
      );
      expect(constraint.rows).toEqual([]);
      const legacyPatients = await pool.query(
        `SELECT patient_id, patient_number
         FROM patients
         WHERE tenant_id = 'tenant-legacy' AND pharmacy_id = 'pharmacy-legacy'
         ORDER BY patient_id ASC`,
      );
      expect(legacyPatients.rows).toEqual([
        { patient_id: 'patient-legacy-001', patient_number: 'LEGACY-001' },
        { patient_id: 'patient-legacy-002', patient_number: 'LEGACY-001' },
      ]);
    });
  });
});
