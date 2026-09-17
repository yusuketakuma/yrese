import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { patientId, pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { PostgresCoverageRecordCommand } from './coverage-command.js';
import { coverageRecordRequestFingerprint } from '../coverage-command.js';
import { patientCreateRequestFingerprint } from '../patient-command.js';
import { PostgresPatientWriteCommand } from './patient-command.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/**
 * WP-7203 受入(Postgres 原子コマンド境界):
 * coverage 行 INSERT・冪等記録・監査追記は単一トランザクションで確定する。
 * 冪等再送は durable な coverage_record_idempotency から既存行を返し、
 * 監査失敗は全効果を巻き戻す。append-only trigger が UPDATE/DELETE を拒否する。
 */

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: tenantId('tenant-cov-int-001'),
  pharmacyId: pharmacyId('pharmacy-cov-int-001'),
};
const actorId = userId('user-cov-int-001');
const recordedAt = '2026-09-18T00:00:00.000Z';
const auditWallClockIso = '2026-09-18T00:00:01.000Z';

function createTestSchemaName(): string {
  return `yrese_coverage_command_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function withMigratedSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }
  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: 1,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-09-18T00:00:00.000Z'),
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

async function seedPatient(pool: Pool): Promise<ReturnType<typeof patientId>> {
  const command = new PostgresPatientWriteCommand(pool);
  const attributes = {
    name: '被保険 統合',
    kana: 'ヒホケントウゴウ',
    birthDate: '1965-05-05',
    sex: 'female' as const,
  };
  const result = await command.createPatient({
    ...scope,
    actorId,
    attributes,
    idempotencyKey: `patient-seed-${crypto.randomUUID()}`,
    requestFingerprint: patientCreateRequestFingerprint(attributes),
    recordedAt,
    auditWallClock: () => auditWallClockIso,
    mintPatientId: () => patientId(`patient-int-${crypto.randomUUID()}`),
  });
  if (result.kind !== 'created') {
    throw new Error(`patient seed failed: ${result.kind}`);
  }
  return patientId(result.patient.patientId);
}

const cardRequest = {
  kind: 'insurance-card' as const,
  insurerNumber: 'SYN12345',
  insuredSymbol: 'G-001',
  insuredNumber: '0001',
  relationship: 'self' as const,
  copayRatio: 0.3,
  validFrom: '2026-04-01',
};

const expenseRequest = {
  kind: 'public-expense' as const,
  payerNumber: 'SYN54321',
  recipientNumber: 'R-0001',
  priority: 1,
  validFrom: '2026-04-01',
  validTo: '2026-12-31',
};

function recordInput(
  patient: ReturnType<typeof patientId>,
  overrides: Partial<Parameters<PostgresCoverageRecordCommand['recordCoverage']>[0]> = {},
) {
  return {
    ...scope,
    patientId: patient,
    request: cardRequest,
    idempotencyKey: `coverage-int-${crypto.randomUUID()}`,
    requestFingerprint: coverageRecordRequestFingerprint(cardRequest),
    actorId,
    recordedAt,
    auditWallClock: () => auditWallClockIso,
    mintRowId: () => `insurance-card-${crypto.randomUUID()}`,
    ...overrides,
  };
}

async function tableCounts(pool: Pool): Promise<{
  cards: number;
  expenses: number;
  idempotency: number;
  audit: number;
}> {
  const [c, e, i, a] = await Promise.all([
    pool.query<{ count: string }>('SELECT count(*) AS count FROM insurance_cards'),
    pool.query<{ count: string }>(
      'SELECT count(*) AS count FROM public_expense_certificates',
    ),
    pool.query<{ count: string }>(
      'SELECT count(*) AS count FROM coverage_create_idempotency',
    ),
    pool.query<{ count: string }>('SELECT count(*) AS count FROM audit_events'),
  ]);
  return {
    cards: Number(c.rows[0]?.count),
    expenses: Number(e.rows[0]?.count),
    idempotency: Number(i.rows[0]?.count),
    audit: Number(a.rows[0]?.count),
  };
}

describePostgres('PostgresCoverageRecordCommand (WP-7203 integration)', () => {
  it('records an insurance card with durable idempotency record and audit in one tx', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool);
      const result = await command.recordCoverage(recordInput(patient));

      expect(result.kind).toBe('recorded');
      if (result.kind !== 'recorded') return;
      expect(result.entryKind).toBe('insurance-card');
      if (!('insuranceCardId' in result.row)) return;
      expect(result.row.insurerNumber).toBe('SYN12345');
      expect(result.row.supersededBy).toBeNull();

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ cards: 1, expenses: 0, idempotency: 1, audit: 2 });
    });
  });

  it('replays identical key+payload as existing with no new row or audit; conflicts on different payload', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool);
      const input = recordInput(patient);
      const created = await command.recordCoverage(input);
      if (created.kind !== 'recorded') throw new Error('expected recorded');

      const replay = await command.recordCoverage({
        ...input,
        mintRowId: () => 'insurance-card-should-not-be-used',
      });
      expect(replay).toEqual({
        kind: 'existing',
        entryKind: 'insurance-card',
        row: created.row,
      });

      const conflict = await command.recordCoverage({
        ...input,
        request: { ...cardRequest, insuredNumber: '9999' },
        requestFingerprint: coverageRecordRequestFingerprint({
          ...cardRequest,
          insuredNumber: '9999',
        }),
      });
      expect(conflict.kind).toBe('idempotency_conflict');

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ cards: 1, expenses: 0, idempotency: 1, audit: 2 });
    });
  });

  it('rejects insurance period overlap and public-expense priority conflict', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool);
      await command.recordCoverage(
        recordInput(patient, {
          request: { ...cardRequest, validTo: '2026-12-31' },
          requestFingerprint: coverageRecordRequestFingerprint({
            ...cardRequest,
            validTo: '2026-12-31',
          }),
        }),
      );
      const overlap = await command.recordCoverage(
        recordInput(patient, {
          request: { ...cardRequest, insuredNumber: '0002' },
          requestFingerprint: coverageRecordRequestFingerprint({
            ...cardRequest,
            insuredNumber: '0002',
          }),
        }),
      );
      expect(overlap.kind).toBe('period_overlap');

      await command.recordCoverage(
        recordInput(patient, {
          request: expenseRequest,
          requestFingerprint: coverageRecordRequestFingerprint(expenseRequest),
          mintRowId: () => `public-expense-${crypto.randomUUID()}`,
        }),
      );
      const priorityConflict = await command.recordCoverage(
        recordInput(patient, {
          request: { ...expenseRequest, recipientNumber: 'R-0002' },
          requestFingerprint: coverageRecordRequestFingerprint({
            ...expenseRequest,
            recipientNumber: 'R-0002',
          }),
          mintRowId: () => `public-expense-${crypto.randomUUID()}`,
        }),
      );
      expect(priorityConflict.kind).toBe('priority_conflict');
    });
  });

  it('supersedes a row and rejects missing/already-superseded targets', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool);
      const created = await command.recordCoverage(recordInput(patient));
      if (created.kind !== 'recorded' || !('insuranceCardId' in created.row)) {
        throw new Error('expected recorded card');
      }
      const cardId = created.row.insuranceCardId;

      const supersedeRequest = {
        kind: 'supersede' as const,
        targetKind: 'insurance-card' as const,
        targetId: cardId,
        insurerNumber: cardRequest.insurerNumber,
        insuredSymbol: cardRequest.insuredSymbol,
        insuredNumber: '0010',
        relationship: 'self' as const,
        copayRatio: 0.3,
        validFrom: '2026-05-01',
      };
      const corrected = await command.recordCoverage(
        recordInput(patient, {
          request: supersedeRequest,
          requestFingerprint: coverageRecordRequestFingerprint(supersedeRequest),
        }),
      );
      expect(corrected.kind).toBe('recorded');

      const again = await command.recordCoverage(
        recordInput(patient, {
          request: supersedeRequest,
          requestFingerprint: coverageRecordRequestFingerprint(supersedeRequest),
        }),
      );
      expect(again.kind).toBe('supersede_conflict');

      const missing = await command.recordCoverage(
        recordInput(patient, {
          request: {
            ...supersedeRequest,
            targetId: 'insurance-card-nonexistent',
          },
          requestFingerprint: coverageRecordRequestFingerprint({
            ...supersedeRequest,
            targetId: 'insurance-card-nonexistent',
          }),
        }),
      );
      expect(missing.kind).toBe('supersede_conflict');
    });
  });

  it('blocks UPDATE/DELETE on coverage tables (append-only trigger)', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool);
      await command.recordCoverage(recordInput(patient));

      await expect(
        pool.query(
          "UPDATE insurance_cards SET insured_number = 'x' WHERE true",
        ),
      ).rejects.toThrow();
      await expect(
        pool.query('DELETE FROM insurance_cards WHERE true'),
      ).rejects.toThrow();
    });
  });

  it('rolls back row + idempotency + audit when audit append fails', async () => {
    await withMigratedSchema(async (pool) => {
      const patient = await seedPatient(pool);
      const command = new PostgresCoverageRecordCommand(pool, {
        beforeAuditAppend: () => {
          throw new Error('injected audit failure — PHI-SENTINEL-SYN12345');
        },
      });
      await expect(
        command.recordCoverage(recordInput(patient)),
      ).rejects.toThrow();

      const counts = await tableCounts(pool);
      // 患者 seed の監査 1 件のみ。coverage の部分書込みは残らない。
      expect(counts).toEqual({ cards: 0, expenses: 0, idempotency: 0, audit: 1 });
    });
  });

  it('returns patient_not_found for out-of-scope patients (existence not disclosed)', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresCoverageRecordCommand(pool);
      const unknown = await command.recordCoverage(
        recordInput(patientId('patient-nonexistent')),
      );
      expect(unknown.kind).toBe('patient_not_found');

      const seeded = await seedPatient(pool);
      const crossTenant = await command.recordCoverage({
        ...recordInput(seeded),
        tenantId: tenantId('tenant-other'),
      });
      expect(crossTenant.kind).toBe('patient_not_found');
    });
  });
});
