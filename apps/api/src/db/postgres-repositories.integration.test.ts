import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { PostgresPatientRepository } from './patient-repository.js';
import { createDbPool } from './pool.js';
import { PostgresReceptionRepository } from './reception-repository.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';
import type { ReceptionCreateResult } from '../reception-repository.js';

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

type ReceptionEntryResult = Extract<ReceptionCreateResult, { readonly entry: unknown }>;

function createTestSchemaName(): string {
  return `yrese_repository_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function withMigratedSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }

  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, { max: 1, options: `-c search_path=${schemaName}` });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-07-09T00:00:00.000Z'),
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

async function seedPatient(
  pool: Pool,
  input: {
    readonly tenantId: string;
    readonly pharmacyId: string;
    readonly patientId: string;
    readonly name: string;
    readonly kana: string;
    readonly patientNumber: string;
    readonly eligibilityStatus?: string;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO patients (
       tenant_id,
       pharmacy_id,
       patient_id,
       name,
       kana,
       birth_date,
       sex,
       patient_number,
       eligibility_status,
       eligibility_checked_at
     )
     VALUES ($1, $2, $3, $4, $5, '1980-01-01'::date, 'female', $6, $7, '2026-07-09T08:16:15.000Z'::timestamptz)`,
    [
      input.tenantId,
      input.pharmacyId,
      input.patientId,
      input.name,
      input.kana,
      input.patientNumber,
      input.eligibilityStatus ?? 'VERIFIED',
    ],
  );
}

function expectReceptionEntryResult(result: ReceptionCreateResult, expectedKind: ReceptionEntryResult['kind']): ReceptionEntryResult {
  if (result.kind === 'idempotency_conflict') {
    throw new Error(`expected ${expectedKind} reception result, got idempotency_conflict`);
  }
  if (result.kind !== expectedKind) {
    throw new Error(`expected ${expectedKind} reception result, got ${result.kind}`);
  }
  return result;
}

describePostgres('PostgreSQL patient/reception repositories (set TEST_DATABASE_URL to run)', () => {
  it('searches and looks up patients only within the requested tenant and pharmacy', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, {
        tenantId: 'tenant-001',
        pharmacyId: 'pharmacy-001',
        patientId: 'patient-db-001',
        name: '合成患者DBA',
        kana: 'ゴウセイカンジャディービーエー',
        patientNumber: 'DB-001',
      });
      await seedPatient(pool, {
        tenantId: 'tenant-002',
        pharmacyId: 'pharmacy-001',
        patientId: 'patient-db-002',
        name: '合成患者DBB',
        kana: 'ゴウセイカンジャディービービー',
        patientNumber: 'DB-002',
      });
      await seedPatient(pool, {
        tenantId: 'tenant-001',
        pharmacyId: 'pharmacy-002',
        patientId: 'patient-db-003',
        name: '合成患者DBC',
        kana: 'ゴウセイカンジャディービーシー',
        patientNumber: 'DB-003',
      });

      const repository = new PostgresPatientRepository(pool);
      const page = await repository.search({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        q: '合成患者DB',
        limit: 20,
      });

      expect(page.results.map((patient) => patient.patientId)).toEqual(['patient-db-001']);
      await expect(
        repository.findById({
          tenantId: tenantId('tenant-001'),
          pharmacyId: pharmacyId('pharmacy-001'),
          patientId: patientId('patient-db-002'),
        }),
      ).resolves.toBeUndefined();
    });
  });

  it('enforces exact patient-number uniqueness per tenant and pharmacy while preserving scoped search', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, {
        tenantId: 'tenant-unique-001',
        pharmacyId: 'pharmacy-unique-001',
        patientId: 'patient-unique-001',
        name: '合成患者一',
        kana: 'ゴウセイカンジャイチ',
        patientNumber: 'EXACT-001',
      });

      await expect(
        seedPatient(pool, {
          tenantId: 'tenant-unique-001',
          pharmacyId: 'pharmacy-unique-001',
          patientId: 'patient-unique-duplicate',
          name: '合成患者重複',
          kana: 'ゴウセイカンジャチョウフク',
          patientNumber: 'EXACT-001',
        }),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'patients_tenant_pharmacy_patient_number_unique',
      });

      await seedPatient(pool, {
        tenantId: 'tenant-unique-001',
        pharmacyId: 'pharmacy-unique-002',
        patientId: 'patient-unique-002',
        name: '合成患者二',
        kana: 'ゴウセイカンジャニ',
        patientNumber: 'EXACT-001',
      });
      await seedPatient(pool, {
        tenantId: 'tenant-unique-002',
        pharmacyId: 'pharmacy-unique-001',
        patientId: 'patient-unique-003',
        name: '合成患者三',
        kana: 'ゴウセイカンジャサン',
        patientNumber: 'EXACT-001',
      });

      const repository = new PostgresPatientRepository(pool);
      const firstScope = await repository.search({
        tenantId: tenantId('tenant-unique-001'),
        pharmacyId: pharmacyId('pharmacy-unique-001'),
        q: 'EXACT-001',
        limit: 20,
      });
      const otherPharmacy = await repository.search({
        tenantId: tenantId('tenant-unique-001'),
        pharmacyId: pharmacyId('pharmacy-unique-002'),
        q: 'EXACT-001',
        limit: 20,
      });
      const otherTenant = await repository.search({
        tenantId: tenantId('tenant-unique-002'),
        pharmacyId: pharmacyId('pharmacy-unique-001'),
        q: 'EXACT-001',
        limit: 20,
      });

      expect(firstScope.results.map((patient) => patient.patientId)).toEqual(['patient-unique-001']);
      expect(otherPharmacy.results.map((patient) => patient.patientId)).toEqual(['patient-unique-002']);
      expect(otherTenant.results.map((patient) => patient.patientId)).toEqual(['patient-unique-003']);

      await seedPatient(pool, {
        tenantId: 'tenant-unique-001',
        pharmacyId: 'pharmacy-unique-001',
        patientId: 'patient-unique-case-variant',
        name: '合成患者大小文字差',
        kana: 'ゴウセイカンジャダイショウモジサ',
        patientNumber: 'exact-001',
      });
      await seedPatient(pool, {
        tenantId: 'tenant-unique-001',
        pharmacyId: 'pharmacy-unique-001',
        patientId: 'patient-unique-space-variant',
        name: '合成患者空白差',
        kana: 'ゴウセイカンジャクウハクサ',
        patientNumber: ' EXACT-001 ',
      });

      const exactVariants = await pool.query(
        `SELECT patient_number
         FROM patients
         WHERE tenant_id = 'tenant-unique-001'
           AND pharmacy_id = 'pharmacy-unique-001'`,
      );
      expect(exactVariants.rows.map((row) => row.patient_number).sort()).toEqual(
        [' EXACT-001 ', 'EXACT-001', 'exact-001'].sort(),
      );
    });
  });

  it('creates reception entries with idempotency, tenant isolation, stable order, and JST business dates', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, {
        tenantId: 'tenant-001',
        pharmacyId: 'pharmacy-001',
        patientId: 'patient-db-001',
        name: '合成患者DBA',
        kana: 'ゴウセイカンジャディービーエー',
        patientNumber: 'DB-001',
      });
      await seedPatient(pool, {
        tenantId: 'tenant-001',
        pharmacyId: 'pharmacy-001',
        patientId: 'patient-db-002',
        name: '合成患者DBB',
        kana: 'ゴウセイカンジャディービービー',
        patientNumber: 'DB-002',
        eligibilityStatus: 'PENDING_REVERIFY',
      });

      const patientRepository = new PostgresPatientRepository(pool);
      const receptionRepository = new PostgresReceptionRepository(pool);
      const firstPatient = await patientRepository.findById({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        patientId: patientId('patient-db-001'),
      });
      const secondPatient = await patientRepository.findById({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        patientId: patientId('patient-db-002'),
      });
      if (firstPatient === undefined || secondPatient === undefined) {
        throw new Error('seeded patients were not found');
      }

      const acceptedAt = new Date('2026-07-09T20:00:00.000Z'); // JST 2026-07-10 05:00
      const created = expectReceptionEntryResult(
        await receptionRepository.create({
          tenantId: tenantId('tenant-001'),
          pharmacyId: pharmacyId('pharmacy-001'),
          patient: firstPatient,
          idempotencyKey: 'db-idempotency-001',
          acceptedAt,
        }),
        'created',
      );
      expect(created.entry.patient.patientId).toBe(firstPatient.patientId);

      const resent = expectReceptionEntryResult(
        await receptionRepository.create({
          tenantId: tenantId('tenant-001'),
          pharmacyId: pharmacyId('pharmacy-001'),
          patient: firstPatient,
          idempotencyKey: 'db-idempotency-001',
          acceptedAt,
        }),
        'existing',
      );
      expect(resent.entry.receptionId).toBe(created.entry.receptionId);

      const conflict = await receptionRepository.create({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        patient: secondPatient,
        idempotencyKey: 'db-idempotency-001',
        acceptedAt,
      });
      expect(conflict.kind).toBe('idempotency_conflict');

      const secondCreated = expectReceptionEntryResult(
        await receptionRepository.create({
          tenantId: tenantId('tenant-001'),
          pharmacyId: pharmacyId('pharmacy-001'),
          patient: secondPatient,
          idempotencyKey: 'db-idempotency-002',
          acceptedAt,
        }),
        'created',
      );

      const jstQueue = await receptionRepository.list({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        date: '2026-07-10',
      });
      const utcQueue = await receptionRepository.list({
        tenantId: tenantId('tenant-001'),
        pharmacyId: pharmacyId('pharmacy-001'),
        date: '2026-07-09',
      });
      const otherTenantQueue = await receptionRepository.list({
        tenantId: tenantId('tenant-002'),
        pharmacyId: pharmacyId('pharmacy-001'),
        date: '2026-07-10',
      });

      expect(jstQueue.map((entry) => entry.receptionId)).toEqual(
        [...jstQueue].map((entry) => entry.receptionId).sort((left, right) => left.localeCompare(right)),
      );
      expect(jstQueue).toHaveLength(2);
      expect(utcQueue).toHaveLength(0);
      expect(otherTenantQueue).toHaveLength(0);
    });
  });
});
