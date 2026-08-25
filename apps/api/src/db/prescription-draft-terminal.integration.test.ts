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

function schemaName(): string {
  return `yrese_prescription_terminal_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function withMigratedSchema(run: (pool: Pool) => Promise<void>) {
  if (testDatabaseUrl === undefined) {
    throw new Error("TEST_DATABASE_URL unexpectedly missing");
  }
  const schema = schemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: 2,
    options: `-c search_path=${schema}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: "vitest",
      appliedAt: new Date("2026-08-25T00:00:00.000Z"),
    });
    await run(pool);
  } finally {
    await pool.end();
    const cleanup = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await cleanup.end();
    }
  }
}

const scope = {
  tenantId: tenantId("tenant-draft-terminal"),
  pharmacyId: pharmacyId("pharmacy-draft-terminal"),
  receptionId: receptionId("reception-draft-terminal"),
  patientId: patientId("patient-draft-terminal"),
  businessDate: "2026-08-25",
} as const;

function saveInput(expectedVersion: number, note: string) {
  return {
    ...scope,
    actorId: userId("actor-draft-terminal"),
    expectedVersion,
    wallClock: `2026-08-25T01:00:0${expectedVersion}.000Z`,
    draft: {
      prescriptionType: "OUTPATIENT" as const,
      prescriptionDate: "2026-08-25",
      defaultDays: 7,
      flags: [] as const,
      note,
      rows: [
        {
          sequence: 1,
          drugText: "合成終端境界薬 5mg",
          usageText: "1日1回 朝",
          days: 7,
          quantityText: "7錠",
        },
      ],
    },
  };
}

describePostgres("prescription draft terminal reception boundary", () => {
  it("keeps an existing draft readable but rejects further writes after completion", async () => {
    await withMigratedSchema(async (pool) => {
      await pool.query(
        `INSERT INTO patients (
           tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
           patient_number, eligibility_status
         ) VALUES (
           $1, $2, $3, '合成終端患者', 'ゴウセイシュウタンカンジャ',
           '1980-01-01'::date, 'female', 'DRAFT-TERMINAL-001', 'VERIFIED'
         )`,
        [scope.tenantId, scope.pharmacyId, scope.patientId],
      );
      await pool.query(
        `INSERT INTO reception_entries (
           tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
           business_date, reception_status, prescription_intake_type,
           idempotency_key
         ) VALUES (
           $1, $2, $3, $4, '2026-08-25T00:30:00.000Z'::timestamptz,
           $5::date, 'IN_PROGRESS', 'paper', 'draft-terminal-idempotency'
         )`,
        [
          scope.tenantId,
          scope.pharmacyId,
          scope.receptionId,
          scope.patientId,
          scope.businessDate,
        ],
      );

      const service = new PostgresPrescriptionDraftService(
        pool,
        () => prescriptionId("prescription-draft-terminal"),
      );
      await expect(service.save(saveInput(0, "作成時"))).resolves.toMatchObject({
        kind: "saved",
        draft: { version: 1, saveDisposition: "created" },
      });

      await pool.query(
        `UPDATE reception_entries
            SET reception_status = 'COMPLETED'
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3`,
        [scope.tenantId, scope.pharmacyId, scope.receptionId],
      );

      await expect(service.get(scope)).resolves.toMatchObject({
        kind: "found",
        draft: { version: 1, draft: { note: "作成時" } },
      });
      await expect(service.save(saveInput(1, "完了後の変更"))).resolves.toEqual({
        kind: "not_found",
      });

      const auditCount = await pool.query<{ readonly count: string }>(
        `SELECT count(*)::text AS count
           FROM audit_events
          WHERE tenant_id = $1 AND pharmacy_id = $2`,
        [scope.tenantId, scope.pharmacyId],
      );
      expect(auditCount.rows).toEqual([{ count: "1" }]);
    });
  });
});
