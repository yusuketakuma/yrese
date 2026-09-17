import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { patientId, pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { patientCreateRequestFingerprint } from '../patient-command.js';
import { PostgresPatientWriteCommand } from './patient-command.js';
import { PostgresPatientRepository } from './patient-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/**
 * WP-7202 受入(Postgres 原子コマンド境界):
 * 患者登録・更新と監査追記は単一トランザクションで確定する。冪等再送は
 * durable な patient_create_idempotency 記録から既存患者を返し、監査失敗は
 * 全効果を巻き戻す。identity 変更は append-only history へ残る。
 */

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: tenantId('tenant-pat-int-001'),
  pharmacyId: pharmacyId('pharmacy-pat-int-001'),
};
const actorId = userId('user-pat-int-001');
const recordedAt = '2026-09-18T00:00:00.000Z';
const auditWallClockIso = '2026-09-18T00:00:01.000Z';

function createTestSchemaName(): string {
  return `yrese_patient_command_test_${process.pid}_${Date.now()}_${Math.random()
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

function createInput(
  overrides: Partial<Parameters<PostgresPatientWriteCommand['createPatient']>[0]> = {},
) {
  const attributes = {
    name: '統合 患者',
    kana: 'トウゴウカンジャ',
    birthDate: '1970-01-01',
    sex: 'female' as const,
  };
  return {
    ...scope,
    actorId,
    attributes,
    idempotencyKey: 'patient-int-key-000001',
    requestFingerprint: patientCreateRequestFingerprint(attributes),
    recordedAt,
    auditWallClock: () => auditWallClockIso,
    mintPatientId: () => patientId(`patient-int-${crypto.randomUUID()}`),
    ...overrides,
  };
}

async function tableCounts(pool: Pool): Promise<{
  patients: number;
  history: number;
  idempotency: number;
  audit: number;
}> {
  const [p, h, i, a] = await Promise.all([
    pool.query<{ count: string }>('SELECT count(*) AS count FROM patients'),
    pool.query<{ count: string }>('SELECT count(*) AS count FROM patient_identity_history'),
    pool.query<{ count: string }>('SELECT count(*) AS count FROM patient_create_idempotency'),
    pool.query<{ count: string }>('SELECT count(*) AS count FROM audit_events'),
  ]);
  return {
    patients: Number(p.rows[0]?.count),
    history: Number(h.rows[0]?.count),
    idempotency: Number(i.rows[0]?.count),
    audit: Number(a.rows[0]?.count),
  };
}

describePostgres('PostgresPatientWriteCommand (WP-7202 integration)', () => {
  it('creates a patient with server number, durable idempotency record, and audit in one tx', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const input = createInput();
      const result = await command.createPatient(input);

      expect(result.kind).toBe('created');
      if (result.kind !== 'created') return;
      expect(result.patient.version).toBe(1);
      expect(result.patient.patientNumber).toBe('P-000001');
      expect(result.patient.eligibilityStatus).toBe('NOT_CHECKED');
      expect(result.auditEvents).toHaveLength(1);

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ patients: 1, history: 0, idempotency: 1, audit: 1 });
    });
  });

  it('replays identical key+payload as existing (200-equivalent) with no new audit, conflicts on different payload', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const input = createInput();
      const created = await command.createPatient(input);
      if (created.kind !== 'created') throw new Error('expected created');

      const replay = await command.createPatient({
        ...input,
        mintPatientId: () => patientId('patient-int-should-not-be-used'),
      });
      expect(replay).toEqual({ kind: 'existing', patient: created.patient });

      const conflict = await command.createPatient({
        ...input,
        attributes: { ...input.attributes, name: '別名' },
        requestFingerprint: 'f'.repeat(64),
      });
      expect(conflict).toEqual({ kind: 'idempotency_conflict' });

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ patients: 1, history: 0, idempotency: 1, audit: 1 });
    });
  });

  it('returns duplicate candidates and audits patient.searched then patient.created', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      await command.createPatient(createInput());
      const second = await command.createPatient(
        createInput({
          idempotencyKey: 'patient-int-key-000002',
          attributes: {
            name: '統合 患者',
            kana: 'ベツジン',
            birthDate: '1990-06-06',
            sex: 'male',
          },
          requestFingerprint: '1'.repeat(64),
        }),
      );
      expect(second.kind).toBe('created');
      if (second.kind !== 'created') return;
      expect(second.duplicateCandidates).toHaveLength(1);
      expect(second.auditEvents).toHaveLength(2);

      const auditTypes = await pool.query<{ audit_event_type: string }>(
        `SELECT event_body->>'auditEventType' AS audit_event_type
           FROM audit_events ORDER BY sequence_number ASC`,
      );
      expect(auditTypes.rows.map((r) => r.audit_event_type)).toEqual([
        'patient.created',
        'patient.searched',
        'patient.created',
      ]);
    });
  });

  it('returns patient_number_conflict on scope-unique violation', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      await command.createPatient(
        createInput({ attributes: { ...createInput().attributes, patientNumber: 'FIXED-001' } }),
      );
      const conflict = await command.createPatient(
        createInput({
          idempotencyKey: 'patient-int-key-000003',
          attributes: { ...createInput().attributes, patientNumber: 'FIXED-001' },
          requestFingerprint: '2'.repeat(64),
        }),
      );
      expect(conflict).toEqual({ kind: 'patient_number_conflict' });
    });
  });

  it('updates identity fields with CAS, appends identity history, audits once', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const created = await command.createPatient(createInput());
      if (created.kind !== 'created') throw new Error('expected created');

      const updated = await command.updatePatient({
        ...scope,
        patientId: patientId(created.patient.patientId),
        expectedVersion: 1,
        attributes: { name: '更新 患者' },
        actorId,
        recordedAt: '2026-09-18T01:00:00.000Z',
        auditWallClock: () => auditWallClockIso,
      });
      expect(updated.kind).toBe('updated');
      if (updated.kind !== 'updated') return;
      expect(updated.patient.version).toBe(2);
      expect(updated.patient.name).toBe('更新 患者');
      expect(updated.patient.patientNumber).toBe(created.patient.patientNumber);

      const history = await pool.query<{ version: number; name: string }>(
        'SELECT version, name FROM patient_identity_history',
      );
      expect(history.rows).toEqual([{ version: 1, name: '統合 患者' }]);

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ patients: 1, history: 1, idempotency: 1, audit: 2 });
    });
  });

  it('returns version_conflict without mutation on stale expectedVersion', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const created = await command.createPatient(createInput());
      if (created.kind !== 'created') throw new Error('expected created');

      const stale = await command.updatePatient({
        ...scope,
        patientId: patientId(created.patient.patientId),
        expectedVersion: 42,
        attributes: { name: '書換' },
        actorId,
        recordedAt: '2026-09-18T02:00:00.000Z',
        auditWallClock: () => auditWallClockIso,
      });
      expect(stale).toEqual({ kind: 'version_conflict', currentVersion: 1 });

      const row = await pool.query<{ name: string; version: number }>(
        'SELECT name, version FROM patients',
      );
      expect(row.rows[0]).toEqual({ name: '統合 患者', version: 1 });
      const counts = await tableCounts(pool);
      expect(counts).toEqual({ patients: 1, history: 0, idempotency: 1, audit: 1 });
    });
  });

  it('rolls back the entire write when audit append fails', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool, {
        beforeAuditAppend: () => {
          throw new Error('injected audit failure sentinel');
        },
      });
      await expect(command.createPatient(createInput())).rejects.toThrow();

      const counts = await tableCounts(pool);
      expect(counts).toEqual({ patients: 0, history: 0, idempotency: 0, audit: 0 });
    });
  });

  it('enforces append-only history triggers at the database level', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const created = await command.createPatient(createInput());
      if (created.kind !== 'created') throw new Error('expected created');
      await command.updatePatient({
        ...scope,
        patientId: patientId(created.patient.patientId),
        expectedVersion: 1,
        attributes: { name: '変更' },
        actorId,
        recordedAt: '2026-09-18T03:00:00.000Z',
        auditWallClock: () => auditWallClockIso,
      });

      await expect(
        pool.query('UPDATE patient_identity_history SET name = $1', ['改竄']),
      ).rejects.toThrow(/append-only/);
      await expect(
        pool.query('DELETE FROM patient_identity_history'),
      ).rejects.toThrow(/append-only/);
      await expect(
        pool.query('DELETE FROM patient_create_idempotency'),
      ).rejects.toThrow(/append-only/);
    });
  });

  it('does not leak a created patient across tenant scope for update', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const created = await command.createPatient(createInput());
      if (created.kind !== 'created') throw new Error('expected created');

      const crossTenant = await command.updatePatient({
        tenantId: tenantId('tenant-other'),
        pharmacyId: scope.pharmacyId,
        patientId: patientId(created.patient.patientId),
        expectedVersion: 1,
        attributes: { name: '越権' },
        actorId,
        recordedAt: '2026-09-18T04:00:00.000Z',
        auditWallClock: () => auditWallClockIso,
      });
      expect(crossTenant).toEqual({ kind: 'not_found' });
    });
  });

  it('survives auto-numbering after an explicit patientNumber beyond int4 range', async () => {
    await withMigratedSchema(async (pool) => {
      const command = new PostgresPatientWriteCommand(pool);
      const explicit = await command.createPatient(
        createInput({
          attributes: { ...createInput().attributes, patientNumber: 'P-3000000000' },
        }),
      );
      expect(explicit.kind).toBe('created');

      const auto = await command.createPatient(
        createInput({
          idempotencyKey: 'patient-int-key-000004',
          requestFingerprint: '3'.repeat(64),
        }),
      );
      expect(auto.kind).toBe('created');
      if (auto.kind !== 'created') return;
      expect(auto.patient.patientNumber).toBe('P-3000000001');
    });
  });

  it('serializes concurrent creates in one scope via advisory lock (unique numbers)', async () => {
    if (testDatabaseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL unexpectedly missing');
    }
    const schemaName = createTestSchemaName();
    const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    await adminPool.end();
    const pool = createDbPool(testDatabaseUrl, {
      max: 4,
      options: `-c search_path=${schemaName}`,
    });
    try {
      await applyPendingMigrations(pool, await loadMigrationFiles(), {
        appliedBy: 'vitest',
        appliedAt: new Date('2026-09-18T00:00:00.000Z'),
      });
      const command = new PostgresPatientWriteCommand(pool);
      const results = await Promise.all([
        command.createPatient(createInput({ idempotencyKey: 'conc-key-0000000001', requestFingerprint: 'a1'.repeat(32) })),
        command.createPatient(createInput({ idempotencyKey: 'conc-key-0000000002', requestFingerprint: 'a2'.repeat(32) })),
        command.createPatient(createInput({ idempotencyKey: 'conc-key-0000000003', requestFingerprint: 'a3'.repeat(32) })),
      ]);
      const numbers = results
        .map((r) => (r.kind === 'created' ? r.patient.patientNumber : undefined))
        .sort();
      expect(numbers).toEqual(['P-000001', 'P-000002', 'P-000003']);
    } finally {
      await pool.end();
      const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
      try {
        await cleanupPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      } finally {
        await cleanupPool.end();
      }
    }
  });
});
