import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import type { PatientSearchResult } from '@yrese/contracts';
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

interface StoredReceptionRow {
  readonly tenant_id: string;
  readonly pharmacy_id: string;
  readonly reception_id: string;
  readonly patient_id: string;
  readonly accepted_at: Date | string;
}

interface MigratedSchemaOptions {
  readonly poolMax?: number;
}

function createTestSchemaName(): string {
  return `yrese_repository_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  options: MigratedSchemaOptions = {},
): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }

  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: options.poolMax ?? 1,
    options: `-c search_path=${schemaName}`,
  });
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

function normalizeInstant(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

  it('durably converges concurrent same-patient creates to one created and one existing result', async () => {
    await withMigratedSchema(
      async (pool) => {
        const scope = {
          tenantId: tenantId('tenant-concurrent-same-001'),
          pharmacyId: pharmacyId('pharmacy-concurrent-same-001'),
        };
        await seedPatient(pool, {
          ...scope,
          patientId: 'patient-concurrent-same-001',
          name: '合成患者並行同一',
          kana: 'ゴウセイカンジャヘイコウドウイツ',
          patientNumber: 'CONCURRENT-SAME-001',
        });

        const patientRepository = new PostgresPatientRepository(pool);
        const receptionRepository = new PostgresReceptionRepository(pool);
        const patient = await patientRepository.findById({
          ...scope,
          patientId: patientId('patient-concurrent-same-001'),
        });
        if (patient === undefined) {
          throw new Error('seeded concurrent same-patient fixture was not found');
        }

        const idempotencyKey = 'opaque-concurrent-same-patient-001';
        const acceptedAtA = new Date('2026-07-10T01:00:00.000Z');
        const acceptedAtB = new Date('2026-07-10T01:00:01.000Z');
        const results = await Promise.all([
          receptionRepository.create({ ...scope, patient, idempotencyKey, acceptedAt: acceptedAtA }),
          receptionRepository.create({ ...scope, patient, idempotencyKey, acceptedAt: acceptedAtB }),
        ]);

        expect(results.map((result) => result.kind).sort()).toEqual(['created', 'existing']);
        const entries = results.map((result) => {
          if (result.kind === 'idempotency_conflict') {
            throw new Error('same-patient concurrent create unexpectedly conflicted');
          }
          return result.entry;
        });
        expect(new Set(entries.map((entry) => entry.receptionId)).size).toBe(1);

        const stored = await pool.query<StoredReceptionRow>(
          `SELECT tenant_id, pharmacy_id, reception_id, patient_id, accepted_at
           FROM reception_entries
           WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
          [scope.tenantId, scope.pharmacyId, idempotencyKey],
        );
        expect(stored.rows).toHaveLength(1);
        const storedRow = stored.rows[0];
        if (storedRow === undefined) {
          throw new Error('concurrent same-patient reception row was not stored');
        }
        const storedAcceptedAt = normalizeInstant(storedRow.accepted_at);
        expect(entries.map((entry) => entry.receptionId)).toEqual([
          storedRow.reception_id,
          storedRow.reception_id,
        ]);
        expect(entries.map((entry) => entry.acceptedAt)).toEqual([storedAcceptedAt, storedAcceptedAt]);
        expect([acceptedAtA.toISOString(), acceptedAtB.toISOString()]).toContain(storedAcceptedAt);
      },
      { poolMax: 2 },
    );
  });

  it('durably rejects one of two concurrent different-patient creates for the same scoped key', async () => {
    await withMigratedSchema(
      async (pool) => {
        const scope = {
          tenantId: tenantId('tenant-concurrent-conflict-001'),
          pharmacyId: pharmacyId('pharmacy-concurrent-conflict-001'),
        };
        await seedPatient(pool, {
          ...scope,
          patientId: 'patient-concurrent-conflict-a',
          name: '合成患者並行競合甲',
          kana: 'ゴウセイカンジャヘイコウキョウゴウコウ',
          patientNumber: 'CONCURRENT-CONFLICT-A',
        });
        await seedPatient(pool, {
          ...scope,
          patientId: 'patient-concurrent-conflict-b',
          name: '合成患者並行競合乙',
          kana: 'ゴウセイカンジャヘイコウキョウゴウオツ',
          patientNumber: 'CONCURRENT-CONFLICT-B',
        });

        const patientRepository = new PostgresPatientRepository(pool);
        const receptionRepository = new PostgresReceptionRepository(pool);
        const firstPatient = await patientRepository.findById({
          ...scope,
          patientId: patientId('patient-concurrent-conflict-a'),
        });
        const secondPatient = await patientRepository.findById({
          ...scope,
          patientId: patientId('patient-concurrent-conflict-b'),
        });
        if (firstPatient === undefined || secondPatient === undefined) {
          throw new Error('seeded concurrent different-patient fixtures were not found');
        }

        const idempotencyKey = 'opaque-concurrent-different-patient-001';
        const results = await Promise.all([
          receptionRepository.create({
            ...scope,
            patient: firstPatient,
            idempotencyKey,
            acceptedAt: new Date('2026-07-10T02:00:00.000Z'),
          }),
          receptionRepository.create({
            ...scope,
            patient: secondPatient,
            idempotencyKey,
            acceptedAt: new Date('2026-07-10T02:00:01.000Z'),
          }),
        ]);

        expect(results.map((result) => result.kind).sort()).toEqual(['created', 'idempotency_conflict']);
        const createdResult = results.find((result) => result.kind === 'created');
        const conflict = results.find((result) => result.kind === 'idempotency_conflict');
        if (createdResult === undefined || conflict === undefined) {
          throw new Error('concurrent different-patient results did not contain both expected outcomes');
        }
        const created = expectReceptionEntryResult(createdResult, 'created');
        expect(conflict).toEqual({ kind: 'idempotency_conflict' });
        expect('entry' in conflict).toBe(false);

        const stored = await pool.query<StoredReceptionRow>(
          `SELECT tenant_id, pharmacy_id, reception_id, patient_id, accepted_at
           FROM reception_entries
           WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
          [scope.tenantId, scope.pharmacyId, idempotencyKey],
        );
        expect(stored.rows).toHaveLength(1);
        expect(stored.rows[0]?.patient_id).toBe(created.entry.patient.patientId);
      },
      { poolMax: 2 },
    );
  });

  it('returns the original reception after repository re-instantiation', async () => {
    await withMigratedSchema(async (pool) => {
      const scope = {
        tenantId: tenantId('tenant-reinstantiated-001'),
        pharmacyId: pharmacyId('pharmacy-reinstantiated-001'),
      };
      await seedPatient(pool, {
        ...scope,
        patientId: 'patient-reinstantiated-001',
        name: '合成患者再生成',
        kana: 'ゴウセイカンジャサイセイセイ',
        patientNumber: 'REINSTANTIATED-001',
      });

      const patientRepository = new PostgresPatientRepository(pool);
      const patient = await patientRepository.findById({
        ...scope,
        patientId: patientId('patient-reinstantiated-001'),
      });
      if (patient === undefined) {
        throw new Error('seeded repository re-instantiation fixture was not found');
      }

      const idempotencyKey = 'opaque-repository-reinstantiation-001';
      const firstRepository = new PostgresReceptionRepository(pool);
      const created = expectReceptionEntryResult(
        await firstRepository.create({
          ...scope,
          patient,
          idempotencyKey,
          acceptedAt: new Date('2026-07-10T03:00:00.000Z'),
        }),
        'created',
      );

      const reinstantiatedRepository = new PostgresReceptionRepository(pool);
      const existing = expectReceptionEntryResult(
        await reinstantiatedRepository.create({
          ...scope,
          patient,
          idempotencyKey,
          acceptedAt: new Date('2026-07-11T03:30:00.000Z'),
        }),
        'existing',
      );
      expect(existing.entry.receptionId).toBe(created.entry.receptionId);
      expect(existing.entry.acceptedAt).toBe(created.entry.acceptedAt);

      const stored = await pool.query<{ readonly row_count: string }>(
        `SELECT COUNT(*)::text AS row_count
         FROM reception_entries
         WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
        [scope.tenantId, scope.pharmacyId, idempotencyKey],
      );
      expect(stored.rows[0]?.row_count).toBe('1');
    });
  });

  it('isolates the same idempotency key across tenant and pharmacy scopes after repository re-instantiation', async () => {
    await withMigratedSchema(async (pool) => {
      const scopes = [
        {
          tenantId: tenantId('tenant-scope-a'),
          pharmacyId: pharmacyId('pharmacy-scope-a'),
          patientId: patientId('patient-scope-aa'),
          patientNumber: 'SCOPE-AA',
          name: '合成患者範囲甲甲',
          kana: 'ゴウセイカンジャハンイコウコウ',
        },
        {
          tenantId: tenantId('tenant-scope-a'),
          pharmacyId: pharmacyId('pharmacy-scope-b'),
          patientId: patientId('patient-scope-ab'),
          patientNumber: 'SCOPE-AB',
          name: '合成患者範囲甲乙',
          kana: 'ゴウセイカンジャハンイコウオツ',
        },
        {
          tenantId: tenantId('tenant-scope-b'),
          pharmacyId: pharmacyId('pharmacy-scope-a'),
          patientId: patientId('patient-scope-ba'),
          patientNumber: 'SCOPE-BA',
          name: '合成患者範囲乙甲',
          kana: 'ゴウセイカンジャハンイオツコウ',
        },
      ] as const;
      const preparedScopes: Array<{
        readonly scope: (typeof scopes)[number];
        readonly patient: PatientSearchResult;
      }> = [];
      const patientRepository = new PostgresPatientRepository(pool);
      for (const scope of scopes) {
        await seedPatient(pool, {
          ...scope,
          patientId: scope.patientId,
        });
        const patient = await patientRepository.findById({
          tenantId: scope.tenantId,
          pharmacyId: scope.pharmacyId,
          patientId: scope.patientId,
        });
        if (patient === undefined) {
          throw new Error('seeded scope-isolation fixture was not found');
        }
        preparedScopes.push({ scope, patient });
      }

      const idempotencyKey = 'opaque-shared-across-three-scopes-001';
      const repository = new PostgresReceptionRepository(pool);
      const createdByScope = new Map<string, ReceptionEntryResult['entry']>();
      for (const [index, prepared] of preparedScopes.entries()) {
        const created = expectReceptionEntryResult(
          await repository.create({
            tenantId: prepared.scope.tenantId,
            pharmacyId: prepared.scope.pharmacyId,
            patient: prepared.patient,
            idempotencyKey,
            acceptedAt: new Date(`2026-07-10T04:00:0${index}.000Z`),
          }),
          'created',
        );
        createdByScope.set(`${prepared.scope.tenantId}/${prepared.scope.pharmacyId}`, created.entry);
      }

      const stored = await pool.query<StoredReceptionRow>(
        `SELECT tenant_id, pharmacy_id, reception_id, patient_id, accepted_at
         FROM reception_entries
         WHERE idempotency_key = $1
         ORDER BY tenant_id, pharmacy_id`,
        [idempotencyKey],
      );
      expect(stored.rows).toHaveLength(3);
      for (const storedRow of stored.rows) {
        const scopeKey = `${storedRow.tenant_id}/${storedRow.pharmacy_id}`;
        const original = createdByScope.get(scopeKey);
        const prepared = preparedScopes.find(
          ({ scope }) => scope.tenantId === storedRow.tenant_id && scope.pharmacyId === storedRow.pharmacy_id,
        );
        if (original === undefined || prepared === undefined) {
          throw new Error('stored reception row mixed or introduced an unexpected scope');
        }
        expect(storedRow.reception_id).toBe(original.receptionId);
        expect(storedRow.patient_id).toBe(prepared.patient.patientId);
      }

      const reinstantiatedRepository = new PostgresReceptionRepository(pool);
      for (const prepared of preparedScopes) {
        const scopeKey = `${prepared.scope.tenantId}/${prepared.scope.pharmacyId}`;
        const original = createdByScope.get(scopeKey);
        if (original === undefined) {
          throw new Error('created scope-isolation result was not recorded');
        }
        const existing = expectReceptionEntryResult(
          await reinstantiatedRepository.create({
            tenantId: prepared.scope.tenantId,
            pharmacyId: prepared.scope.pharmacyId,
            patient: prepared.patient,
            idempotencyKey,
            acceptedAt: new Date('2026-07-10T05:00:00.000Z'),
          }),
          'existing',
        );
        expect(existing.entry.receptionId).toBe(original.receptionId);
        expect(existing.entry.patient.patientId).toBe(prepared.patient.patientId);
        expect(existing.entry.acceptedAt).toBe(original.acceptedAt);
      }
      expect(new Set(Array.from(createdByScope.values(), (entry) => entry.receptionId)).size).toBe(3);
    });
  });
});
