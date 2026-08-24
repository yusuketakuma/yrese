import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import {
  EligibilityTransitionError,
  PostgresEligibilitySnapshotRepository,
} from './eligibility-snapshot-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/** WP-6303/6304: 資格確認スナップショットと受付状態導出の統合テスト(synthetic のみ、外部 IF なし)。 */
const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: 'tenant-elig-int-001',
  pharmacyId: 'pharmacy-elig-int-001',
};
const now = new Date('2026-08-24T01:00:00.000Z');

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  if (testDatabaseUrl === undefined)
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  const schemaName = `yrese_eligibility_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();
  const pool = createDbPool(testDatabaseUrl, {
    max: 2,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: now,
    });
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

async function seedPatientAndReception(
  pool: Pool,
  patientId: string,
  receptionId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO patients (tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
       patient_number, eligibility_status, eligibility_checked_at)
     VALUES ($1, $2, $3, '合成患者', 'ゴウセイカンジャ', '1980-01-01'::date, 'female', $3, 'NOT_CHECKED', NULL)
     ON CONFLICT DO NOTHING`,
    [scope.tenantId, scope.pharmacyId, patientId],
  );
  await pool.query(
    `INSERT INTO reception_entries (tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
       business_date, reception_status, prescription_intake_type, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, '2026-08-24'::date, 'WAITING', 'paper', $3)`,
    [scope.tenantId, scope.pharmacyId, receptionId, patientId, now],
  );
}

type RecordInput = Parameters<PostgresEligibilitySnapshotRepository['record']>[1];

function snapshotInput(
  overrides: Partial<Omit<RecordInput, 'validTo'>> & { readonly validTo?: string | null } = {},
): RecordInput {
  const { validTo, ...rest } = overrides;
  const base = {
    snapshotId: 'snap-001',
    patientId: 'patient-elig-001',
    verifiedMethod: 'MYNA_ONLINE' as const,
    state: 'VERIFIED_MYNA' as const,
    verifiedAt: now,
    validFrom: '2026-08-01',
    rawResponseRef: 'raw/opaque-001',
    recordedBy: 'user-elig-001',
    now,
    ...rest,
  };
  // validTo: undefined = 上書きで「有効期限なし」、省略 = 既定の 2026-09-30。
  return validTo === null || validTo === undefined
    ? 'validTo' in overrides
      ? base
      : { ...base, validTo: '2026-09-30' }
    : { ...base, validTo };
}

describePostgres('PostgresEligibilitySnapshotRepository (PostgreSQL)', () => {
  it('derives UNVERIFIED for a reception without a snapshot and blocks all calculation (fail-closed)', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      await expect(
        repo.receptionEligibility(scope, 'reception-elig-001', '2026-08-24'),
      ).resolves.toEqual({
        state: 'UNVERIFIED',
        snapshotId: null,
        allowsProvisionalCalculation: false,
        allowsFinalCalculation: false,
      });
    });
  });

  it('records a verified snapshot, attaches it to the reception, and allows final calculation within validity', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      const snapshot = await repo.record(scope, snapshotInput());
      expect(snapshot).toMatchObject({
        snapshotId: 'snap-001',
        state: 'VERIFIED_MYNA',
        validTo: '2026-09-30',
      });
      await repo.attachToReception(scope, 'reception-elig-001', 'snap-001');

      await expect(
        repo.receptionEligibility(scope, 'reception-elig-001', '2026-08-24'),
      ).resolves.toMatchObject({
        state: 'VERIFIED_MYNA',
        snapshotId: 'snap-001',
        allowsFinalCalculation: true,
      });
      // 有効期間外の日付で見ると EXPIRED に倒れ、算定は止まる。
      await expect(
        repo.receptionEligibility(scope, 'reception-elig-001', '2026-10-01'),
      ).resolves.toMatchObject({
        state: 'EXPIRED',
        allowsProvisionalCalculation: false,
        allowsFinalCalculation: false,
      });
      // 資格内容は保持しない: raw 参照だけ。
      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'eligibility_snapshots'`,
      );
      const names = columns.rows.map(
        (r: { column_name: string }) => r.column_name,
      );
      expect(names).not.toContain('insurer_number');
      expect(names).toContain('raw_response_ref');
    });
  });

  it('enforces the ADP-004 transition table and append-only storage', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      await repo.record(
        scope,
        snapshotInput({
          snapshotId: 'snap-offline',
          verifiedMethod: 'NONE',
          state: 'OFFLINE_PROVISIONAL',
          validTo: null,
        }),
      );
      // OFFLINE_PROVISIONAL → EXPIRED は許可、→ PROVISIONAL_VISUAL は不可(表にない)。
      await expect(
        repo.record(
          scope,
          snapshotInput({
            snapshotId: 'snap-visual',
            verifiedMethod: 'CARD_VISUAL',
            state: 'PROVISIONAL_VISUAL',
          }),
        ),
      ).rejects.toThrow(EligibilityTransitionError);
      await repo.record(
        scope,
        snapshotInput({
          snapshotId: 'snap-verified',
          state: 'VERIFIED_CARD',
          verifiedMethod: 'CARD_ONLINE',
        }),
      );
      await expect(
        repo.latestForPatient(scope, 'patient-elig-001'),
      ).resolves.toMatchObject({ snapshotId: 'snap-verified' });

      await expect(
        pool.query(
          `UPDATE eligibility_snapshots SET state = 'MISMATCH' WHERE snapshot_id = 'snap-verified'`,
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        pool.query(`DELETE FROM eligibility_snapshots`),
      ).rejects.toThrow(/append-only/);
    });
  });

  it('refuses to attach a snapshot of another patient or from another tenant', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      await seedPatientAndReception(
        pool,
        'patient-elig-002',
        'reception-elig-002',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      await repo.record(scope, snapshotInput({ snapshotId: 'snap-p1' }));
      await expect(
        repo.attachToReception(scope, 'reception-elig-002', 'snap-p1'),
      ).rejects.toThrow(/patient mismatch/);
      await expect(
        repo.attachToReception(
          { tenantId: 'tenant-other', pharmacyId: scope.pharmacyId },
          'reception-elig-001',
          'snap-p1',
        ),
      ).rejects.toThrow(/not found/);
      await expect(
        repo.receptionEligibility(scope, 'reception-elig-002', '2026-08-24'),
      ).resolves.toMatchObject({ state: 'UNVERIFIED' });
    });
  });
});
