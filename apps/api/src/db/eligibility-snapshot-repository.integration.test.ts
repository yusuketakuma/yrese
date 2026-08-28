import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import {
  EligibilityMethodError,
  EligibilityTransitionError,
  PostgresEligibilitySnapshotRepository,
  type RecordEligibilitySnapshotInput,
} from './eligibility-snapshot-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/** WP-6303/6304: 受付単位の資格確認スナップショットの統合テスト(synthetic のみ、外部 IF なし)。 */
describe('eligibility snapshot instant mapping (DB-less / WP-5274)', () => {
  function poolReturning(row: Record<string, unknown>): Pool {
    return {
      query: async () => ({ rows: [row] }),
    } as unknown as Pool;
  }

  const baseRow = {
    snapshot_id: 'snap-dbless-1',
    patient_id: 'patient-dbless-1',
    verified_method: 'MYNA_ONLINE',
    state: 'VERIFIED_MYNA',
    valid_from: '2026-08-24',
    valid_to: null,
  };

  it('maps verified_at without reading an own Date method', async () => {
    const clock = new Date('2026-08-24T01:00:00.000Z');
    const ownToISOStringRead = vi.fn(() => {
      throw new Error('raw eligibility clock secret');
    });
    Object.defineProperty(clock, 'toISOString', {
      configurable: true,
      get: ownToISOStringRead,
    });
    const repository = new PostgresEligibilitySnapshotRepository(
      poolReturning({ ...baseRow, verified_at: clock }),
    );

    const eligibility = await repository.receptionEligibility(
      { tenantId: 'tenant-dbless', pharmacyId: 'pharmacy-dbless' },
      'reception-dbless-1',
      '2026-08-24',
    );

    expect(eligibility.state).toBe('VERIFIED_MYNA');
    expect(ownToISOStringRead).not.toHaveBeenCalled();
  });

  it('normalizes a string driver instant instead of throwing raw', async () => {
    const repository = new PostgresEligibilitySnapshotRepository(
      poolReturning({ ...baseRow, verified_at: '2026-08-24T01:00:00.000Z' }),
    );

    const eligibility = await repository.receptionEligibility(
      { tenantId: 'tenant-dbless', pharmacyId: 'pharmacy-dbless' },
      'reception-dbless-1',
      '2026-08-24',
    );

    expect(eligibility.state).toBe('VERIFIED_MYNA');
  });
});

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: 'tenant-elig-int-001',
  pharmacyId: 'pharmacy-elig-int-001',
};
const now = new Date('2026-08-24T01:00:00.000Z');
const today = '2026-08-24';

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
    max: 3,
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
     VALUES ($1, $2, $3, $4, $5, $6::date, 'WAITING', 'paper', $3)`,
    [scope.tenantId, scope.pharmacyId, receptionId, patientId, now, today],
  );
}

function input(
  overrides: Partial<RecordEligibilitySnapshotInput> = {},
): RecordEligibilitySnapshotInput {
  return {
    snapshotId: 'snap-001',
    verifiedMethod: 'MYNA_ONLINE',
    state: 'VERIFIED_MYNA',
    verifiedAt: now,
    validFrom: '2026-08-01',
    validTo: '2026-09-30',
    rawResponseRef: 'raw/0123456789abcdef',
    recordedBy: 'user-elig-001',
    now,
    asOfDate: today,
    ...overrides,
  };
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
        repo.receptionEligibility(scope, 'reception-elig-001', today),
      ).resolves.toEqual({
        state: 'UNVERIFIED',
        snapshotId: null,
        allowsProvisionalCalculation: false,
        allowsFinalCalculation: false,
      });
      await expect(
        repo.receptionEligibility(
          scope,
          'reception-elig-001',
          '2026-08-24T00:00:00Z',
        ),
      ).rejects.toThrow(/calendar date/);
    });
  });

  it('records a verified snapshot for the reception and allows final calculation only inside the validity window', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      const snapshot = await repo.recordForReception(
        scope,
        'reception-elig-001',
        input(),
      );
      expect(snapshot).toMatchObject({
        snapshotId: 'snap-001',
        patientId: 'patient-elig-001',
        state: 'VERIFIED_MYNA',
      });

      await expect(
        repo.receptionEligibility(scope, 'reception-elig-001', today),
      ).resolves.toMatchObject({
        state: 'VERIFIED_MYNA',
        snapshotId: 'snap-001',
        allowsFinalCalculation: true,
      });
      for (const outside of ['2026-07-31', '2026-10-01']) {
        await expect(
          repo.receptionEligibility(scope, 'reception-elig-001', outside),
        ).resolves.toMatchObject({
          state: 'EXPIRED',
          allowsProvisionalCalculation: false,
          allowsFinalCalculation: false,
        });
      }
      const columns = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'eligibility_snapshots'`,
      );
      const names = columns.rows.map((r) => r.column_name);
      expect(names).not.toContain('insurer_number');
      expect(names).toContain('raw_response_ref');
    });
  });

  it('keeps the state machine per reception: a verified patient can still be received offline-provisional today', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(pool, 'patient-elig-001', 'reception-past');
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-today',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      await repo.recordForReception(
        scope,
        'reception-past',
        input({ snapshotId: 'snap-past' }),
      );
      // EXTERNAL_DEGRADED 下の新規受付は OFFLINE_PROVISIONAL から始められる(review A-1)。
      await expect(
        repo.recordForReception(
          scope,
          'reception-today',
          input({
            snapshotId: 'snap-offline',
            verifiedMethod: 'NONE',
            state: 'OFFLINE_PROVISIONAL',
            validTo: null,
          }),
        ),
      ).resolves.toMatchObject({ state: 'OFFLINE_PROVISIONAL' });
      await expect(
        repo.receptionEligibility(scope, 'reception-today', today),
      ).resolves.toMatchObject({
        state: 'OFFLINE_PROVISIONAL',
        allowsProvisionalCalculation: true,
        allowsFinalCalculation: false,
      });
      // RECOVERY_SYNC で再確認成功 → VERIFIED_CARD。受付の紐づけは同一 tx で更新される。
      await repo.recordForReception(
        scope,
        'reception-today',
        input({
          snapshotId: 'snap-recovered',
          verifiedMethod: 'CARD_ONLINE',
          state: 'VERIFIED_CARD',
        }),
      );
      await expect(
        repo.receptionEligibility(scope, 'reception-today', today),
      ).resolves.toMatchObject({
        state: 'VERIFIED_CARD',
        snapshotId: 'snap-recovered',
      });
      await expect(
        repo.receptionEligibility(scope, 'reception-past', today),
      ).resolves.toMatchObject({ snapshotId: 'snap-past' });
    });
  });

  it('rejects method/state mismatches at the code and the database, and follows the ADP-004 table exactly', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      // 目視確認で VERIFIED_* は記録できない(review A-2)。
      await expect(
        repo.recordForReception(
          scope,
          'reception-elig-001',
          input({ verifiedMethod: 'CARD_VISUAL', state: 'VERIFIED_MYNA' }),
        ),
      ).rejects.toThrow(EligibilityMethodError);
      await expect(
        pool.query(
          `INSERT INTO eligibility_snapshots (tenant_id, pharmacy_id, snapshot_id, patient_id, verified_method, state,
             verified_at, valid_from, valid_to, raw_response_ref, recorded_by, created_at)
           VALUES ($1, $2, 'snap-raw', 'patient-elig-001', 'CARD_VISUAL', 'VERIFIED_MYNA', $3, '2026-08-01', NULL, NULL, 'x', $3)`,
          [scope.tenantId, scope.pharmacyId, now],
        ),
      ).rejects.toThrow(/method_state_consistent/);

      await repo.recordForReception(scope, 'reception-elig-001', input());
      // VERIFIED_* からの遷移は EXPIRED / MISMATCH のみ。方式変更・再確認は表にない(review A-4)。
      await expect(
        repo.recordForReception(
          scope,
          'reception-elig-001',
          input({
            snapshotId: 'snap-2',
            verifiedMethod: 'CARD_ONLINE',
            state: 'VERIFIED_CARD',
          }),
        ),
      ).rejects.toThrow(EligibilityTransitionError);
      await repo.recordForReception(
        scope,
        'reception-elig-001',
        input({ snapshotId: 'snap-mismatch', state: 'MISMATCH' }),
      );
      // MISMATCH は終端。新 VERIFIED を足しても復帰しない(復帰は人間 gate)。
      await expect(
        repo.recordForReception(
          scope,
          'reception-elig-001',
          input({ snapshotId: 'snap-3' }),
        ),
      ).rejects.toThrow(EligibilityTransitionError);
      await expect(
        repo.receptionEligibility(scope, 'reception-elig-001', today),
      ).resolves.toMatchObject({
        state: 'MISMATCH',
        snapshotId: 'snap-mismatch',
        allowsProvisionalCalculation: false,
      });
    });
  });

  it('is append-only, refuses raw payloads in raw_response_ref, and never lets a reception point at another patient', async () => {
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
      await repo.recordForReception(
        scope,
        'reception-elig-001',
        input({ snapshotId: 'snap-p1' }),
      );

      await expect(
        pool.query(`UPDATE eligibility_snapshots SET state = 'MISMATCH'`),
      ).rejects.toThrow(/append-only/);
      await expect(
        pool.query(`DELETE FROM eligibility_snapshots`),
      ).rejects.toThrow(/append-only/);
      // TRUNCATE は FK 参照(reception_entries)と trigger の双方で拒否される。
      await expect(
        pool.query(`TRUNCATE eligibility_snapshots`),
      ).rejects.toThrow(/append-only|cannot truncate/);
      await expect(
        repo.recordForReception(
          scope,
          'reception-elig-002',
          input({ snapshotId: 'snap-p2', rawResponseRef: '{"insurer":"x"}' }),
        ),
      ).rejects.toThrow(/raw_response_ref_opaque/);
      // base64url で encode した payload も hex-only の id 部に合わず拒否される(M4)。
      await expect(
        repo.recordForReception(
          scope,
          'reception-elig-002',
          input({
            snapshotId: 'snap-p2',
            rawResponseRef: 'raw/eyJpbnN1cmVyIjoiMTIzNDU2NzgifQ',
          }),
        ),
      ).rejects.toThrow(/raw_response_ref_opaque/);
      // 生 SQL でも他患者の snapshot を受付に付けられない(複合 FK、review A-7)。
      await expect(
        pool.query(
          `UPDATE reception_entries SET eligibility_snapshot_id = 'snap-p1' WHERE reception_id = 'reception-elig-002'`,
        ),
      ).rejects.toThrow(/reception_entries_eligibility_snapshot_fk/);
      await expect(
        repo.receptionEligibility(scope, 'reception-elig-002', today),
      ).resolves.toMatchObject({ state: 'UNVERIFIED' });
      await expect(
        repo.recordForReception(
          { tenantId: 'tenant-other', pharmacyId: scope.pharmacyId },
          'reception-elig-001',
          input({ snapshotId: 'x' }),
        ),
      ).rejects.toThrow(/not found/);
    });
  });

  it('treats an identical retry after a lost response as success, not as an invalid transition (M6)', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      const first = await repo.recordForReception(
        scope,
        'reception-elig-001',
        input(),
      );
      const retry = await repo.recordForReception(
        scope,
        'reception-elig-001',
        input(),
      );
      expect(retry).toEqual(first);
      const count = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM eligibility_snapshots',
      );
      expect(count.rows[0]?.count).toBe('1');
    });
  });

  it('serializes concurrent records for the same reception', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatientAndReception(
        pool,
        'patient-elig-001',
        'reception-elig-001',
      );
      const repo = new PostgresEligibilitySnapshotRepository(pool);
      const results = await Promise.allSettled([
        repo.recordForReception(
          scope,
          'reception-elig-001',
          input({ snapshotId: 'snap-a' }),
        ),
        repo.recordForReception(
          scope,
          'reception-elig-001',
          input({
            snapshotId: 'snap-b',
            verifiedMethod: 'CARD_ONLINE',
            state: 'VERIFIED_CARD',
          }),
        ),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        EligibilityTransitionError,
      );
    });
  });
});
