import { describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { buildAuditScopeAdvisoryLockKey } from "./audit-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import { createDbPool } from "./pool.js";
import { normalizePrescriptionDraftContent } from "../prescription-draft-service.js";
import {
  PostgresPrescriptionDraftService,
  prescriptionDraftDatabaseInvariantErrorMessage,
  replaceChildren,
} from "./prescription-draft-service.js";
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
    readonly receptionStatus?: "IN_PROGRESS" | "COMPLETED";
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
       $5::date, $6, 'paper', $7
     )`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      input.patientId,
      input.businessDate ?? "2026-08-25",
      input.receptionStatus ?? "IN_PROGRESS",
      input.idempotencyKey,
    ],
  );
}

const scopedInput = {
  tenantId: tenantId("tenant-draft-db"),
  pharmacyId: pharmacyId("pharmacy-draft-db"),
  actorId: userId("actor-draft-db"),
  receptionId: receptionId("reception-draft-db"),
  patientId: patientId("patient-draft-db"),
  businessDate: "2026-08-25",
  wallClock: "2026-08-25T01:00:09.000Z",
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

describe("replaceChildren DML shape (DB-less / WP-5268)", () => {
  function recordingClient(): {
    client: PoolClient;
    calls: { text: string; values: readonly unknown[] }[];
  } {
    const calls: { text: string; values: readonly unknown[] }[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        return { rows: [] };
      },
    } as unknown as PoolClient;
    return { client, calls };
  }

  const dmlLookup = {
    tenantId: tenantId("tenant-dml"),
    pharmacyId: pharmacyId("pharmacy-dml"),
    actorId: userId("actor-dml"),
    receptionId: receptionId("reception-dml"),
    businessDate: "2026-08-25",
    wallClock: "2026-08-25T01:00:00.000Z",
  };

  it("issues exactly one parameterized INSERT per child table regardless of row and flag count", async () => {
    const draft = normalizePrescriptionDraftContent({
      prescriptionType: "OUTPATIENT",
      prescriptionDate: "2026-08-25",
      defaultDays: 7,
      flags: ["NARCOTIC", "PACKAGING"],
      note: "合成バッチ",
      rows: [
        { sequence: 1, drugText: "合成薬剤A 5mg", usageText: "1日1回 朝食後", days: 7, quantityText: "7錠" },
        { sequence: 2, drugText: "合成薬剤B 10mg", usageText: "1日2回 朝夕食後", days: null, quantityText: "14錠" },
        { sequence: 3, drugText: "合成薬剤C 1mg", usageText: "疼痛時 頓服", days: 3, quantityText: "3錠" },
      ],
    });
    const { client, calls } = recordingClient();
    await replaceChildren(
      client,
      dmlLookup,
      prescriptionId("prescription-dml-1"),
      draft,
    );

    const deletes = calls.filter((call) => call.text.includes("DELETE FROM"));
    const rowInserts = calls.filter((call) =>
      call.text.includes("INSERT INTO prescription_draft_rows"),
    );
    const flagInserts = calls.filter((call) =>
      call.text.includes("INSERT INTO prescription_draft_flags"),
    );
    expect(deletes).toHaveLength(2);
    expect(rowInserts).toHaveLength(1);
    expect(flagInserts).toHaveLength(1);
    expect(
      calls.findIndex((call) => call.text.includes("INSERT")),
    ).toBeGreaterThan(1);
    for (const call of [...rowInserts, ...flagInserts]) {
      expect(call.text).not.toContain("合成");
      expect(call.text).not.toContain("NARCOTIC");
    }
    expect(rowInserts[0]?.values).toEqual([
      "tenant-dml",
      "pharmacy-dml",
      "prescription-dml-1",
      [1, 2, 3],
      ["合成薬剤A 5mg", "合成薬剤B 10mg", "合成薬剤C 1mg"],
      ["1日1回 朝食後", "1日2回 朝夕食後", "疼痛時 頓服"],
      [7, null, 3],
      ["7錠", "14錠", "3錠"],
    ]);
    expect(flagInserts[0]?.values).toEqual([
      "tenant-dml",
      "pharmacy-dml",
      "prescription-dml-1",
      ["PACKAGING", "NARCOTIC"],
    ]);
  });

  it("issues zero child INSERTs for empty rows and flags", async () => {
    const { client, calls } = recordingClient();
    await replaceChildren(client, dmlLookup, prescriptionId("prescription-dml-2"), {
      prescriptionType: "UNSPECIFIED",
      prescriptionDate: null,
      defaultDays: null,
      flags: [],
      note: "",
      rows: [],
    });

    expect(calls.filter((call) => call.text.includes("INSERT"))).toHaveLength(0);
    expect(calls.filter((call) => call.text.includes("DELETE FROM"))).toHaveLength(2);
  });
});

describePostgres(
  "PostgresPrescriptionDraftService (set TEST_DATABASE_URL to run)",
  () => {
    it("persists, versions, and reads a scoped draft with atomic audit evidence", async () => {
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
        await expect(service.save(saveInput(0))).resolves.toEqual({
          kind: "conflict",
          currentVersion: 1,
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
          {
            audit_event_type: "prescription.draft.viewed",
            aggregate_id: "prescription-draft-db",
          },
        ]);
      });
    });

    it("round-trips batched multi-row, multi-flag, null-days content exactly", async () => {
      await withMigratedSchema(async (pool) => {
        const batchScope = {
          ...scopedInput,
          receptionId: receptionId("reception-draft-batch"),
          patientId: patientId("patient-draft-batch"),
        };
        await seedReception(pool, {
          tenantId: batchScope.tenantId,
          pharmacyId: batchScope.pharmacyId,
          patientId: batchScope.patientId,
          receptionId: batchScope.receptionId,
          patientNumber: "DRAFT-DB-BATCH",
          idempotencyKey: "draft-db-idempotency-batch",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-batch"),
        );
        const batchDraft = {
          prescriptionType: "OUTPATIENT" as const,
          prescriptionDate: "2026-08-25",
          defaultDays: 7,
          flags: ["PACKAGING" as const, "NARCOTIC" as const],
          note: "合成バッチroundtrip",
          rows: [
            {
              sequence: 1,
              drugText: "合成薬剤A 5mg",
              usageText: "1日1回 朝食後",
              days: 7,
              quantityText: "7錠",
            },
            {
              sequence: 2,
              drugText: "合成薬剤B 10mg",
              usageText: "1日2回 朝夕食後",
              days: null,
              quantityText: "14錠",
            },
            {
              sequence: 3,
              drugText: "合成薬剤C 1mg",
              usageText: "疼痛時 頓服",
              days: 3,
              quantityText: "3錠",
            },
          ],
        };

        await expect(
          service.save({
            ...batchScope,
            actorId: userId("actor-draft-db"),
            expectedVersion: 0,
            wallClock: "2026-08-25T01:10:00.000Z",
            draft: batchDraft,
          }),
        ).resolves.toMatchObject({
          kind: "saved",
          draft: { version: 1, saveDisposition: "created" },
        });

        const read = await service.get(batchScope);
        if (read.kind !== "found") {
          throw new Error(`expected found, got ${read.kind}`);
        }
        expect(read.draft.draft).toEqual(batchDraft);

        const childCounts = await pool.query<{
          readonly row_count: string;
          readonly flag_count: string;
        }>(
          `SELECT
             (SELECT count(*)::text FROM prescription_draft_rows
               WHERE tenant_id = $1 AND pharmacy_id = $2) AS row_count,
             (SELECT count(*)::text FROM prescription_draft_flags
               WHERE tenant_id = $1 AND pharmacy_id = $2) AS flag_count`,
          [batchScope.tenantId, batchScope.pharmacyId],
        );
        expect(childCounts.rows[0]).toEqual({ row_count: "3", flag_count: "2" });
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

    it("records every concurrent successful read without a sequence conflict", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-CONCURRENT-READ",
          idempotencyKey: "draft-db-idempotency-concurrent-read",
        });
        const service = new PostgresPrescriptionDraftService(pool);
        await service.save(saveInput(0));

        const blocker = await pool.connect();
        let blockerReleased = false;
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [
              buildAuditScopeAdvisoryLockKey({
                tenantId: scopedInput.tenantId,
                pharmacyId: scopedInput.pharmacyId,
              }),
            ],
          );
          const reads = Promise.all([
            service.get({
              ...scopedInput,
              wallClock: "2026-08-25T01:01:00.000Z",
            }),
            service.get({
              ...scopedInput,
              actorId: userId("actor-draft-db-second-reader"),
              wallClock: "2026-08-25T01:01:01.000Z",
            }),
          ]);

          let waiterCount = 0;
          for (let attempt = 0; attempt < 100 && waiterCount < 2; attempt += 1) {
            const waiters = await blocker.query<{ readonly waiter_count: number }>(
              `SELECT count(*)::int AS waiter_count
                 FROM pg_locks waiting
                 JOIN pg_locks held
                   ON held.locktype = waiting.locktype
                  AND held.database IS NOT DISTINCT FROM waiting.database
                  AND held.classid IS NOT DISTINCT FROM waiting.classid
                  AND held.objid IS NOT DISTINCT FROM waiting.objid
                  AND held.objsubid IS NOT DISTINCT FROM waiting.objsubid
                WHERE held.pid = pg_backend_pid()
                  AND held.granted
                  AND NOT waiting.granted
                  AND waiting.locktype = 'advisory'`,
            );
            waiterCount = waiters.rows[0]?.waiter_count ?? 0;
            if (waiterCount < 2) {
              await new Promise((resolve) => setTimeout(resolve, 5));
            }
          }
          expect(waiterCount).toBe(2);
          await blocker.query("COMMIT");
          blockerReleased = true;

          await expect(reads).resolves.toMatchObject([
            { kind: "found" },
            { kind: "found" },
          ]);
        } finally {
          if (!blockerReleased) await blocker.query("ROLLBACK");
          blocker.release();
        }

        await expect(
          pool.query<{ readonly audit_count: number }>(
            `SELECT count(*)::int AS audit_count
               FROM audit_events
              WHERE tenant_id = $1
                AND pharmacy_id = $2
                AND event_body->>'auditEventType' = 'prescription.draft.viewed'`,
            [scopedInput.tenantId, scopedInput.pharmacyId],
          ),
        ).resolves.toMatchObject({ rows: [{ audit_count: 2 }] });
      }, 3);
    });

    it("keeps persisted timestamps monotonic when the database writer clock moves backward", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-CLOCK",
          idempotencyKey: "draft-db-idempotency-clock",
        });
        const service = new PostgresPrescriptionDraftService(pool);
        await service.save({
          ...saveInput(0),
          wallClock: "2026-08-25T01:00:05.000Z",
        });

        await expect(
          service.save({
            ...saveInput(1, "時刻逆行後の更新"),
            wallClock: "2026-08-25T01:00:04.000Z",
          }),
        ).resolves.toMatchObject({
          kind: "saved",
          draft: {
            createdAt: "2026-08-25T01:00:05.000Z",
            updatedAt: "2026-08-25T01:00:05.000Z",
          },
        });
      });
    });

    it("rejects writes for a terminal reception without draft or audit rows", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-TERMINAL",
          idempotencyKey: "draft-db-idempotency-terminal",
          receptionStatus: "COMPLETED",
        });
        const service = new PostgresPrescriptionDraftService(pool);

        await expect(service.save(saveInput(0))).resolves.toEqual({
          kind: "not_found",
        });
        await expect(
          pool.query(
            `SELECT
               (SELECT count(*)::int FROM prescription_drafts) AS drafts,
               (SELECT count(*)::int FROM audit_events) AS audits`,
          ),
        ).resolves.toMatchObject({ rows: [{ drafts: 0, audits: 0 }] });
      });
    });

    it("does not disclose or cross-link another tenant, pharmacy, date, or reception", async () => {
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
        await expect(
          service.save({
            ...saveInput(1),
            patientId: patientId("patient-other"),
          }),
        ).resolves.toEqual({ kind: "not_found" });
      });
    });

    it("rejects a draft whose stored content hash does not match its rows", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-HASH",
          idempotencyKey: "draft-db-idempotency-hash",
        });
        const service = new PostgresPrescriptionDraftService(pool);
        await service.save(saveInput(0));
        await pool.query(
          `UPDATE prescription_drafts
              SET content_hash = repeat('a', 64)
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3`,
          [
            scopedInput.tenantId,
            scopedInput.pharmacyId,
            scopedInput.receptionId,
          ],
        );

        await expect(service.get(scopedInput)).rejects.toThrow(
          prescriptionDraftDatabaseInvariantErrorMessage,
        );
        await expect(
          service.save(saveInput(1, "別内容")),
        ).rejects.toThrow(prescriptionDraftDatabaseInvariantErrorMessage);
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
               patient_id, business_date, version,
               prescription_type, prescription_date, default_days, note,
               content_hash, created_at, updated_at, created_by, updated_by
             ) VALUES (
               $1, $2, 'prescription-invalid', $3, 'patient-unrelated',
               '2026-08-25'::date, 1, 'UNSPECIFIED', NULL,
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
