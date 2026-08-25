import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import { createDbPool } from "./pool.js";
import { PostgresPrescriptionDraftService } from "./prescription-draft-service.js";
import { resolveTestDatabaseUrl } from "./test-database-environment.js";

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

function createTestSchemaName(): string {
  return `yrese_prescription_draft_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  poolMax = 2,
): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error("TEST_DATABASE_URL unexpectedly missing");
  }
  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: poolMax,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: "vitest",
      appliedAt: new Date("2026-08-25T00:00:00.000Z"),
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

async function seedReception(
  pool: Pool,
  input: {
    readonly tenantId: string;
    readonly pharmacyId: string;
    readonly patientId: string;
    readonly receptionId: string;
    readonly patientNumber: string;
    readonly idempotencyKey: string;
    readonly businessDate?: string;
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
     ) VALUES (
       $1, $2, $3, '合成処方患者', 'ゴウセイショホウカンジャ',
       '1980-01-01'::date, 'female', $4, 'VERIFIED',
       '2026-08-25T00:00:00.000Z'::timestamptz
     )`,
    [
      input.tenantId,
      input.pharmacyId,
      input.patientId,
      input.patientNumber,
    ],
  );
  await pool.query(
    `INSERT INTO reception_entries (
       tenant_id,
       pharmacy_id,
       reception_id,
       patient_id,
       accepted_at,
       business_date,
       reception_status,
       prescription_intake_type,
       idempotency_key
     ) VALUES (
       $1, $2, $3, $4, '2026-08-25T00:30:00.000Z'::timestamptz,
       $5::date, 'IN_PROGRESS', 'paper', $6
     )`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      input.patientId,
      input.businessDate ?? "2026-08-25",
      input.idempotencyKey,
    ],
  );
}

const scopedInput = {
  tenantId: tenantId("tenant-draft-db"),
  pharmacyId: pharmacyId("pharmacy-draft-db"),
  receptionId: receptionId("reception-draft-db"),
  patientId: patientId("patient-draft-db"),
  businessDate: "2026-08-25",
} as const;

function saveInput(
  expectedVersion: number,
  drugText = "合成薬剤A 5mg",
) {
  return {
    ...scopedInput,
    actorId: userId("actor-draft-db"),
    expectedVersion,
    wallClock: `2026-08-25T01:00:0${Math.min(expectedVersion, 9)}.000Z`,
    draft: {
      prescriptionType: "OUTPATIENT" as const,
      prescriptionDate: "2026-08-25",
      defaultDays: 7,
      flags: ["PACKAGING" as const],
      note: "合成テスト",
      rows: [
        {
          sequence: 1,
          drugText,
          usageText: "1日1回 朝食後",
          days: 7,
          quantityText: "7錠",
        },
      ],
    },
  };
}

describePostgres(
  "PostgresPrescriptionDraftService (set TEST_DATABASE_URL to run)",
  () => {
    it("persists, versions, replays, and reads a scoped draft with atomic audit evidence", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-001",
          idempotencyKey: "draft-db-idempotency-001",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-db"),
        );

        await expect(service.save(saveInput(0))).resolves.toMatchObject({
          kind: "saved",
          draft: {
            prescriptionId: "prescription-draft-db",
            version: 1,
            saveDisposition: "created",
          },
        });
        await expect(service.save(saveInput(0))).resolves.toMatchObject({
          kind: "saved",
          draft: { version: 1, saveDisposition: "replayed" },
        });
        await expect(
          service.save(saveInput(1, "合成薬剤B 10mg")),
        ).resolves.toMatchObject({
          kind: "saved",
          draft: { version: 2, saveDisposition: "updated" },
        });
        await expect(service.get(scopedInput)).resolves.toMatchObject({
          kind: "found",
          draft: {
            version: 2,
            draft: {
              rows: [{ drugText: "合成薬剤B 10mg" }],
            },
          },
        });

        const auditRows = await pool.query<{
          readonly audit_event_type: string;
          readonly aggregate_id: string;
        }>(
          `SELECT
             event_body->>'auditEventType' AS audit_event_type,
             event_body->>'aggregateId' AS aggregate_id
           FROM audit_events
          WHERE tenant_id = $1 AND pharmacy_id = $2
          ORDER BY sequence_number ASC`,
          [scopedInput.tenantId, scopedInput.pharmacyId],
        );
        expect(auditRows.rows).toEqual([
          {
            audit_event_type: "prescription.created",
            aggregate_id: "prescription-draft-db",
          },
          {
            audit_event_type: "prescription.updated",
            aggregate_id: "prescription-draft-db",
          },
        ]);
      });
    });

    it("detects stale concurrent writers and leaves one authoritative version", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-002",
          idempotencyKey: "draft-db-idempotency-002",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-concurrent"),
        );

        const results = await Promise.all([
          service.save(saveInput(0, "同時保存A")),
          service.save(saveInput(0, "同時保存B")),
        ]);

        expect(results.filter((result) => result.kind === "saved")).toHaveLength(
          1,
        );
        expect(
          results.filter((result) => result.kind === "conflict"),
        ).toHaveLength(1);

        const rows = await pool.query<{
          readonly version: number;
          readonly row_count: string;
        }>(
          `SELECT d.version, count(r.*)::text AS row_count
             FROM prescription_drafts d
             JOIN prescription_draft_rows r
               ON r.tenant_id = d.tenant_id
              AND r.pharmacy_id = d.pharmacy_id
              AND r.prescription_id = d.prescription_id
            WHERE d.tenant_id = $1
              AND d.pharmacy_id = $2
              AND d.reception_id = $3
            GROUP BY d.version`,
          [
            scopedInput.tenantId,
            scopedInput.pharmacyId,
            scopedInput.receptionId,
          ],
        );
        expect(rows.rows).toEqual([{ version: 1, row_count: "1" }]);
      });
    });

    it("does not disclose or cross-link another tenant, pharmacy, patient, date, or reception", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-003",
          idempotencyKey: "draft-db-idempotency-003",
        });
        const service = new PostgresPrescriptionDraftService(pool);
        await service.save(saveInput(0));

        for (const invalid of [
          { ...scopedInput, tenantId: tenantId("tenant-other") },
          { ...scopedInput, pharmacyId: pharmacyId("pharmacy-other") },
          { ...scopedInput, patientId: patientId("patient-other") },
          {
            ...scopedInput,
            receptionId: receptionId("reception-other"),
          },
          { ...scopedInput, businessDate: "2026-08-26" },
        ]) {
          await expect(service.get(invalid)).resolves.toEqual({
            kind: "not_found",
          });
          await expect(
            service.save({ ...saveInput(1), ...invalid }),
          ).resolves.toEqual({ kind: "not_found" });
        }
      });
    });

    it("enforces the exact reception-patient relationship at the database boundary", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-004",
          idempotencyKey: "draft-db-idempotency-004",
        });
        await pool.query(
          `INSERT INTO patients (
             tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
             patient_number, eligibility_status
           ) VALUES (
             $1, $2, 'patient-unrelated', '別患者', 'ベツカンジャ',
             '1981-01-01'::date, 'male', 'DRAFT-DB-UNRELATED', 'VERIFIED'
           )`,
          [scopedInput.tenantId, scopedInput.pharmacyId],
        );

        await expect(
          pool.query(
            `INSERT INTO prescription_drafts (
               tenant_id, pharmacy_id, prescription_id, reception_id,
               patient_id, business_date, version, lifecycle_status,
               prescription_type, prescription_date, default_days, note,
               content_hash, created_at, updated_at, created_by, updated_by
             ) VALUES (
               $1, $2, 'prescription-invalid', $3, 'patient-unrelated',
               '2026-08-25'::date, 1, 'SERVER_SAVED', 'UNSPECIFIED', NULL,
               NULL, '', repeat('a', 64), now(), now(), 'actor', 'actor'
             )`,
            [
              scopedInput.tenantId,
              scopedInput.pharmacyId,
              scopedInput.receptionId,
            ],
          ),
        ).rejects.toMatchObject({
          code: "23503",
          constraint: "prescription_drafts_reception_patient_fk",
        });
      });
    });
  },
);
