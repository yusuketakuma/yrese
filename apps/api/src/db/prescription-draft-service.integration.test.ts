import { describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";

import { deriveRpGroupsFromLegacyRows } from "@yrese/contracts";
import {
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { PostgresActorQualificationRepository } from "./actor-qualification-repository.js";
import { buildAuditScopeAdvisoryLockKey } from "./audit-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import { createDbPool } from "./pool.js";
import {
  normalizePrescriptionDraftContent,
  prescriptionDraftContentHashCandidates,
  prescriptionDraftContentHashWithoutSourceMetadata,
} from "../prescription-draft-service.js";
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
      sourceMetadata: null,
      rpGroups: [],
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

  it("issues only a flags INSERT — prescription_draft_rows stays read-only", async () => {
    const draft = normalizePrescriptionDraftContent({
      prescriptionType: "OUTPATIENT",
      sourceMetadata: null,
      rpGroups: [],
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
    // DOM-002 §4.2b: 旧構造は読み専用。DELETE(移行掃除)は許すが INSERT しない。
    expect(deletes).toHaveLength(2);
    expect(rowInserts).toHaveLength(0);
    expect(flagInserts).toHaveLength(1);
    for (const call of flagInserts) {
      expect(call.text).not.toContain("合成");
      expect(call.text).not.toContain("NARCOTIC");
    }
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
      sourceMetadata: null,
      rpGroups: [],
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
              rows: [],
              rpGroups: [
                {
                  items: [
                    {
                      medication: {
                        kind: "unresolved",
                        text: "合成薬剤B 10mg",
                      },
                    },
                  ],
                },
              ],
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
          sourceMetadata: null,
          rpGroups: [],
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
        // rows 入力は UNRESOLVED_TEXT へ読み替えて rp_groups に永続化される
        // (次版 draft から新構造のみを書く — DOM-002 §4.2b)。
        expect(read.draft.draft).toEqual(
          normalizePrescriptionDraftContent({
            ...batchDraft,
            rows: [],
            rpGroups: deriveRpGroupsFromLegacyRows(batchDraft.rows),
          }),
        );

        const childCounts = await pool.query<{
          readonly row_count: string;
          readonly flag_count: string;
          readonly group_count: number;
        }>(
          `SELECT
             (SELECT count(*)::text FROM prescription_draft_rows
               WHERE tenant_id = $1 AND pharmacy_id = $2) AS row_count,
             (SELECT count(*)::text FROM prescription_draft_flags
               WHERE tenant_id = $1 AND pharmacy_id = $2) AS flag_count,
             (SELECT jsonb_array_length(rp_groups) FROM prescription_drafts
               WHERE tenant_id = $1 AND pharmacy_id = $2) AS group_count`,
          [batchScope.tenantId, batchScope.pharmacyId],
        );
        expect(childCounts.rows[0]).toEqual({
          row_count: "0",
          flag_count: "2",
          group_count: 3,
        });
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
          readonly group_count: number;
        }>(
          `SELECT d.version, jsonb_array_length(d.rp_groups) AS group_count
             FROM prescription_drafts d
            WHERE d.tenant_id = $1
              AND d.pharmacy_id = $2
              AND d.reception_id = $3`,
          [
            scopedInput.tenantId,
            scopedInput.pharmacyId,
            scopedInput.receptionId,
          ],
        );
        expect(rows.rows).toEqual([{ version: 1, group_count: 1 }]);
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

    it("persists and reads back source metadata (WP-7205 / DOM-002 §4.2a)", async () => {
      await withMigratedSchema(async (pool) => {
        const metadataScope = {
          ...scopedInput,
          receptionId: receptionId("reception-draft-metadata"),
          patientId: patientId("patient-draft-metadata"),
        };
        await seedReception(pool, {
          tenantId: metadataScope.tenantId,
          pharmacyId: metadataScope.pharmacyId,
          patientId: metadataScope.patientId,
          receptionId: metadataScope.receptionId,
          patientNumber: "DRAFT-DB-META",
          idempotencyKey: "draft-db-idempotency-meta",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-metadata"),
        );
        const sourceMetadata = {
          medicalInstitution: { code: "1312345", name: "合成クリニック" },
          prescriberName: "合成 医師",
          issueDate: "2026-08-20",
          validUntil: "2026-08-24",
          refill: { total: 3, remaining: 2 },
          splitDispensing: "分割指示あり",
        } as const;

        const saved = await service.save({
          ...saveInput(0),
          receptionId: metadataScope.receptionId,
          patientId: metadataScope.patientId,
          draft: {
            ...saveInput(0).draft,
            sourceMetadata,
          },
        });
        expect(saved).toMatchObject({
          kind: "saved",
          draft: { saveDisposition: "created" },
        });

        const fetched = await service.get({
          ...scopedInput,
          receptionId: metadataScope.receptionId,
        });
        expect(fetched).toMatchObject({
          kind: "found",
          draft: { draft: { sourceMetadata } },
        });

        // 同一内容の再保存は unchanged(metadata 差分なし)。
        const unchanged = await service.save({
          ...saveInput(1),
          receptionId: metadataScope.receptionId,
          patientId: metadataScope.patientId,
          draft: {
            ...saveInput(1).draft,
            sourceMetadata,
          },
        });
        expect(unchanged).toMatchObject({
          kind: "saved",
          draft: { saveDisposition: "unchanged", version: 1 },
        });

        // metadata 変更は content hash 差分として updated になる。
        const updated = await service.save({
          ...saveInput(1),
          receptionId: metadataScope.receptionId,
          patientId: metadataScope.patientId,
          draft: {
            ...saveInput(1).draft,
            sourceMetadata: { ...sourceMetadata, prescriberName: "別 医師" },
          },
        });
        expect(updated).toMatchObject({
          kind: "saved",
          draft: { saveDisposition: "updated", version: 2 },
        });
      });
    });

    it("rejects inconsistent metadata columns at the database boundary (WP-7205 CHECK)", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-METACHECK",
          idempotencyKey: "draft-db-idempotency-metacheck",
        });
        // issue_date NULL だが他列が埋まっている半端な行は CHECK で拒否。
        await expect(
          pool.query(
            `INSERT INTO prescription_drafts (
               tenant_id, pharmacy_id, prescription_id, reception_id,
               patient_id, business_date, version,
               prescription_type, prescription_date, default_days, note,
               prescriber_name,
               content_hash, created_at, updated_at, created_by, updated_by
             ) VALUES (
               $1, $2, 'prescription-meta-partial', $3, $4,
               '2026-08-25'::date, 1, 'UNSPECIFIED', NULL,
               NULL, '', '合成 医師',
               repeat('a', 64), now(), now(), 'actor', 'actor'
             )`,
            [
              scopedInput.tenantId,
              scopedInput.pharmacyId,
              scopedInput.receptionId,
              scopedInput.patientId,
            ],
          ),
        ).rejects.toMatchObject({ code: "23514" });
        // valid_until < issue_date も拒否。
        await expect(
          pool.query(
            `INSERT INTO prescription_drafts (
               tenant_id, pharmacy_id, prescription_id, reception_id,
               patient_id, business_date, version,
               prescription_type, prescription_date, default_days, note,
               medical_institution_name, prescriber_name,
               issue_date, valid_until,
               content_hash, created_at, updated_at, created_by, updated_by
             ) VALUES (
               $1, $2, 'prescription-meta-inverted', $3, $4,
               '2026-08-25'::date, 1, 'UNSPECIFIED', NULL,
               NULL, '', '合成機関', '合成 医師',
               '2026-08-25'::date, '2026-08-24'::date,
               repeat('a', 64), now(), now(), 'actor', 'actor'
             )`,
            [
              scopedInput.tenantId,
              scopedInput.pharmacyId,
              scopedInput.receptionId,
              scopedInput.patientId,
            ],
          ),
        ).rejects.toMatchObject({ code: "23514" });
      });
    });

    it("rejects INSERT/UPDATE on read-only prescription_draft_rows (WP-7302)", async () => {
      await withMigratedSchema(async (pool) => {
        await seedReception(pool, {
          tenantId: scopedInput.tenantId,
          pharmacyId: scopedInput.pharmacyId,
          patientId: scopedInput.patientId,
          receptionId: scopedInput.receptionId,
          patientNumber: "DRAFT-DB-RO",
          idempotencyKey: "draft-db-idempotency-ro",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-db"),
        );
        await service.save(saveInput(0));

        // 旧構造への直接 INSERT は trigger で拒否される。
        await expect(
          pool.query(
            `INSERT INTO prescription_draft_rows (
               tenant_id, pharmacy_id, prescription_id, row_sequence,
               drug_text, usage_text, days, quantity_text
             ) VALUES ($1, $2, 'prescription-draft-db', 1,
               'legacy', 'legacy', 1, '1')`,
            [scopedInput.tenantId, scopedInput.pharmacyId],
          ),
        ).rejects.toMatchObject({
          message: expect.stringContaining("read-only"),
        });
        // UPDATE も実行レベルで拒否される。対象行は INSERT trigger を
        // 一時解除して seed する(pre-migration 行の再現)。
        await pool.query(
          `ALTER TABLE prescription_draft_rows
             DISABLE TRIGGER prescription_draft_rows_block_insert`,
        );
        try {
          await pool.query(
            `INSERT INTO prescription_draft_rows (
               tenant_id, pharmacy_id, prescription_id, row_sequence,
               drug_text, usage_text, days, quantity_text
             ) VALUES ($1, $2, 'prescription-draft-db', 1,
               'legacy', 'legacy', 1, '1')`,
            [scopedInput.tenantId, scopedInput.pharmacyId],
          );
        } finally {
          await pool.query(
            `ALTER TABLE prescription_draft_rows
               ENABLE TRIGGER prescription_draft_rows_block_insert`,
          );
        }
        await expect(
          pool.query(
            `UPDATE prescription_draft_rows
               SET drug_text = 'changed'
             WHERE tenant_id = $1 AND pharmacy_id = $2`,
            [scopedInput.tenantId, scopedInput.pharmacyId],
          ),
        ).rejects.toMatchObject({
          message: expect.stringContaining("read-only"),
        });
        // TRUNCATE も trigger で拒否される(スキーマは使い捨て)。
        await expect(
          pool.query(`TRUNCATE prescription_draft_rows`),
        ).rejects.toMatchObject({
          message: expect.stringContaining("read-only"),
        });
        // DELETE は migration-on-write 掃除のため許可される。
        await expect(
          pool.query(
            `DELETE FROM prescription_draft_rows
             WHERE tenant_id = $1 AND pharmacy_id = $2`,
            [scopedInput.tenantId, scopedInput.pharmacyId],
          ),
        ).resolves.toBeDefined();
        const triggers = await pool.query(
          `SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'prescription_draft_rows'::regclass
              AND tgname IN (
                'prescription_draft_rows_block_insert',
                'prescription_draft_rows_block_update',
                'prescription_draft_rows_truncate_guard'
              )`,
        );
        expect(triggers.rows).toHaveLength(3);
      });
    });

    it("reads WP-7205 以前の legacy hash 行(sourceMetadata キーなし)を後方互換で受理する", async () => {
      await withMigratedSchema(async (pool) => {
        const legacyScope = {
          ...scopedInput,
          receptionId: receptionId("reception-draft-legacy"),
          patientId: patientId("patient-draft-legacy"),
        };
        await seedReception(pool, {
          tenantId: legacyScope.tenantId,
          pharmacyId: legacyScope.pharmacyId,
          patientId: legacyScope.patientId,
          receptionId: legacyScope.receptionId,
          patientNumber: "DRAFT-DB-LEGACY",
          idempotencyKey: "draft-db-idempotency-legacy",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-legacy"),
        );

        const legacyContent = normalizePrescriptionDraftContent({
          prescriptionType: "OUTPATIENT",
          sourceMetadata: null,
          prescriptionDate: "2026-08-25",
          defaultDays: 7,
          flags: [],
          note: "",
          rows: [
            {
              sequence: 1,
              drugText: "合成薬剤A 5mg",
              usageText: "1日1回 朝食後",
              days: 7,
              quantityText: "7錠",
            },
          ],
        });
        const legacyHash =
          prescriptionDraftContentHashWithoutSourceMetadata(legacyContent);
        await pool.query(
          `INSERT INTO prescription_drafts (
             tenant_id, pharmacy_id, prescription_id, reception_id,
             patient_id, business_date, version,
             prescription_type, prescription_date, default_days, note,
             content_hash, created_at, updated_at, created_by, updated_by
           ) VALUES (
             $1, $2, 'prescription-draft-legacy', $3, $4,
             '2026-08-25'::date, 1, 'OUTPATIENT', '2026-08-25'::date,
             7, '', $5, now(), now(), 'actor', 'actor'
           )`,
          [
            legacyScope.tenantId,
            legacyScope.pharmacyId,
            legacyScope.receptionId,
            legacyScope.patientId,
            legacyHash,
          ],
        );
        // legacy 行の seed は migration 000019 の read-only trigger を
        // fixture 内でのみ一時解除して行う(pre-migration 状態の再現)。
        await pool.query(
          `ALTER TABLE prescription_draft_rows
             DISABLE TRIGGER prescription_draft_rows_block_insert`,
        );
        try {
          await pool.query(
            `INSERT INTO prescription_draft_rows (
               tenant_id, pharmacy_id, prescription_id, row_sequence,
               drug_text, usage_text, days, quantity_text
             ) VALUES ($1, $2, 'prescription-draft-legacy', 1,
               '合成薬剤A 5mg', '1日1回 朝食後', 7, '7錠')`,
            [legacyScope.tenantId, legacyScope.pharmacyId],
          );
        } finally {
          await pool.query(
            `ALTER TABLE prescription_draft_rows
               ENABLE TRIGGER prescription_draft_rows_block_insert`,
          );
        }

        // legacy 行は sourceMetadata=null で読み出せ、hash は旧形式で受理され、
        // rpGroups は free-text 行から UNRESOLVED_TEXT へ読み替えられる。
        const fetched = await service.get({
          ...scopedInput,
          receptionId: legacyScope.receptionId,
        });
        expect(fetched).toMatchObject({
          kind: "found",
          draft: {
            version: 1,
            draft: {
              sourceMetadata: null,
              rpGroups: [
                {
                  sequence: 1,
                  dosageForm: "UNSPECIFIED",
                  usage: { kind: "unresolved", text: "1日1回 朝食後" },
                  daysOrCount: 7,
                  items: [
                    {
                      sequence: 1,
                      medication: {
                        kind: "unresolved",
                        text: "合成薬剤A 5mg",
                      },
                      doseTotal: "7錠",
                    },
                  ],
                },
              ],
            },
          },
        });

        // 同一内容の再保存は構造移行を伴うため updated となり、
        // rp_groups へ永続化・旧 rows は掃除される(次版から新構造のみを書く)。
        const migrated = await service.save({
          ...saveInput(1),
          receptionId: legacyScope.receptionId,
          patientId: legacyScope.patientId,
          draft: legacyContent,
        });
        expect(migrated).toMatchObject({
          kind: "saved",
          draft: {
            saveDisposition: "updated",
            version: 2,
            draft: { rows: [] },
          },
        });
        const persistedRows = await pool.query(
          `SELECT count(*)::int AS count
             FROM prescription_draft_rows
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [legacyScope.tenantId, legacyScope.pharmacyId],
        );
        expect(persistedRows.rows[0]?.count).toBe(0);
        const persistedGroups = await pool.query(
          `SELECT jsonb_array_length(rp_groups) AS count
             FROM prescription_drafts
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [legacyScope.tenantId, legacyScope.pharmacyId],
        );
        expect(persistedGroups.rows[0]?.count).toBe(1);
      });
    });

    it("reads WP-7205 期の中間 hash 行(sourceMetadata あり・rpGroups キーなし)を受理する", async () => {
      await withMigratedSchema(async (pool) => {
        const middleScope = {
          ...scopedInput,
          receptionId: receptionId("reception-draft-middle"),
          patientId: patientId("patient-draft-middle"),
        };
        await seedReception(pool, {
          tenantId: middleScope.tenantId,
          pharmacyId: middleScope.pharmacyId,
          patientId: middleScope.patientId,
          receptionId: middleScope.receptionId,
          patientNumber: "DRAFT-DB-MIDDLE",
          idempotencyKey: "draft-db-idempotency-middle",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId("prescription-draft-middle"),
        );

        const middleContent = normalizePrescriptionDraftContent({
          prescriptionType: "OUTPATIENT",
          sourceMetadata: {
            medicalInstitution: { code: "1234567", name: "合成病院" },
            prescriberName: "合成 医師",
            issueDate: "2026-08-20",
            validUntil: "2026-08-24",
            refill: null,
            splitDispensing: null,
          },
          prescriptionDate: "2026-08-25",
          defaultDays: 7,
          flags: [],
          note: "",
          rows: [
            {
              sequence: 1,
              drugText: "合成薬剤B 10mg",
              usageText: "1日2回 朝夕食後",
              days: 5,
              quantityText: "10錠",
            },
          ],
        });
        // WP-7205 期の hash は sourceMetadata 込み・rpGroups キーなし。
        const middleHash =
          prescriptionDraftContentHashCandidates(middleContent)[1];
        expect(middleHash).toBeDefined();
        await pool.query(
          `INSERT INTO prescription_drafts (
             tenant_id, pharmacy_id, prescription_id, reception_id,
             patient_id, business_date, version,
             prescription_type, prescription_date, default_days, note,
             content_hash,
             medical_institution_code, medical_institution_name,
             prescriber_name, issue_date, valid_until,
             refill_total, refill_remaining, split_dispensing,
             created_at, updated_at, created_by, updated_by
           ) VALUES (
             $1, $2, 'prescription-draft-middle', $3, $4,
             '2026-08-25'::date, 1, 'OUTPATIENT', '2026-08-25'::date,
             7, '', $5,
             '1234567', '合成病院', '合成 医師',
             '2026-08-20'::date, '2026-08-24'::date,
             NULL, NULL, NULL,
             now(), now(), 'actor', 'actor'
           )`,
          [
            middleScope.tenantId,
            middleScope.pharmacyId,
            middleScope.receptionId,
            middleScope.patientId,
            middleHash,
          ],
        );
        await pool.query(
          `ALTER TABLE prescription_draft_rows
             DISABLE TRIGGER prescription_draft_rows_block_insert`,
        );
        try {
          await pool.query(
            `INSERT INTO prescription_draft_rows (
               tenant_id, pharmacy_id, prescription_id, row_sequence,
               drug_text, usage_text, days, quantity_text
             ) VALUES ($1, $2, 'prescription-draft-middle', 1,
               '合成薬剤B 10mg', '1日2回 朝夕食後', 5, '10錠')`,
            [middleScope.tenantId, middleScope.pharmacyId],
          );
        } finally {
          await pool.query(
            `ALTER TABLE prescription_draft_rows
               ENABLE TRIGGER prescription_draft_rows_block_insert`,
          );
        }

        // 中間 hash で受理され、sourceMetadata と導出 rpGroups を返す。
        const fetched = await service.get({
          ...scopedInput,
          receptionId: middleScope.receptionId,
        });
        expect(fetched).toMatchObject({
          kind: "found",
          draft: {
            version: 1,
            draft: {
              sourceMetadata: {
                medicalInstitution: { code: "1234567" },
              },
              rpGroups: [
                {
                  usage: { kind: "unresolved", text: "1日2回 朝夕食後" },
                  daysOrCount: 5,
                },
              ],
            },
          },
        });
      });
    });
  },
);

const LIFECYCLE_SCOPE = {
  tenantId: tenantId("tenant-lifecycle-db"),
  pharmacyId: pharmacyId("pharmacy-lifecycle-db"),
  actorId: userId("actor-lifecycle-db"),
  receptionId: receptionId("reception-lifecycle-db"),
  patientId: patientId("patient-lifecycle-db"),
  businessDate: "2026-08-25",
  wallClock: "2026-08-25T02:00:00.000Z",
} as const;

const LIFECYCLE_PRESCRIPTION_ID = "prescription-lifecycle-db-001";

function lifecycleSaveInput(
  overrides?: {
    readonly unresolvedMedication?: boolean;
    readonly dropMetadata?: boolean;
    readonly flags?: (
      | "PACKAGING"
      | "HOME_CARE"
      | "NARCOTIC"
      | "PSYCHOTROPIC"
      | "LEFTOVER_ADJUSTMENT"
    )[];
  },
) {
  const medication = overrides?.unresolvedMedication === true
    ? { kind: "unresolved" as const, text: "未解決薬剤" }
    : {
        kind: "resolved" as const,
        masterVersionId: "00000000-0000-4000-8000-0000000000c1",
        medicationItemId: "00000000-0000-4000-8000-0000000000d1",
      };
  return {
    ...LIFECYCLE_SCOPE,
    expectedVersion: 0,
    draft: {
      prescriptionType: "OUTPATIENT" as const,
      sourceMetadata: overrides?.dropMetadata === true
        ? null
        : {
            medicalInstitution: { code: "1234567", name: "合成病院" },
            prescriberName: "合成 医師",
            issueDate: "2026-08-20",
            validUntil: "2026-08-24",
            refill: null,
            splitDispensing: null,
          },
      rpGroups: [
        {
          rpGroupId: "00000000-0000-4000-8000-0000000000a1",
          sequence: 1,
          dosageForm: "ORAL" as const,
          usage: { kind: "unresolved" as const, text: "1日1回 朝食後" },
          daysOrCount: 7,
          items: [
            {
              rpItemId: "00000000-0000-4000-8000-0000000000b1",
              sequence: 1,
              medication,
              doseOnce: null,
              dosePerDay: null,
              doseTotal: "7錠",
              unit: null,
              genericNamePrescription: false,
              genericSubstitutionPermitted: null,
            },
          ],
        },
      ],
      prescriptionDate: "2026-08-25",
      defaultDays: 7,
      flags: overrides?.flags ?? [],
      note: "",
      rows: [],
    },
  };
}

async function seedQualification(
  pool: Pool,
  input: {
    readonly tenantId: string;
    readonly pharmacyId: string;
    readonly actorId: string;
    readonly status: "ACTIVE" | "REVOKED";
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO actor_qualifications (
       tenant_id, pharmacy_id, qualification_id, actor_id,
       qualification_kind, license_ref, status,
       verified_by, verified_at, created_at
     ) VALUES (
       $1, $2, $3, $4,
       'PHARMACIST_LICENSE', NULL, $5,
       'verifier-lifecycle-db', '2026-08-24T00:00:00.000Z'::timestamptz,
       '2026-08-24T00:00:00.000Z'::timestamptz
     )`,
    [
      input.tenantId,
      input.pharmacyId,
      `qualification-${input.actorId}-${input.status}`,
      input.actorId,
      input.status,
    ],
  );
}

function lifecycleCommand(idempotencyKey: string) {
  return {
    tenantId: LIFECYCLE_SCOPE.tenantId,
    pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
    actorId: LIFECYCLE_SCOPE.actorId,
    prescriptionId: prescriptionId(LIFECYCLE_PRESCRIPTION_ID),
    idempotencyKey,
    wallClock: LIFECYCLE_SCOPE.wallClock,
  };
}

describePostgres(
  "PostgresPrescriptionDraftService lifecycle (WP-7402)",
  () => {
    async function seedAndSave(
      pool: Pool,
      overrides?: Parameters<typeof lifecycleSaveInput>[0],
    ): Promise<PostgresPrescriptionDraftService> {
      await seedReception(pool, {
        tenantId: LIFECYCLE_SCOPE.tenantId,
        pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
        patientId: LIFECYCLE_SCOPE.patientId,
        receptionId: LIFECYCLE_SCOPE.receptionId,
        patientNumber: "LIFECYCLE-DB-001",
        idempotencyKey: "lifecycle-db-idempotency-001",
      });
      const service = new PostgresPrescriptionDraftService(
        pool,
        () => prescriptionId(LIFECYCLE_PRESCRIPTION_ID),
        {
          qualificationRepository:
            new PostgresActorQualificationRepository(pool),
          nextOutboxEventId: () => "outbox-lifecycle-db-001",
        },
      );
      const saved = await service.save(lifecycleSaveInput(overrides));
      expect(saved).toMatchObject({ kind: "saved" });
      return service;
    }

    it("confirms and finalizes with version snapshot, audit, and outbox in one transaction", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool);

        const confirmed = await service.confirm(
          lifecycleCommand("confirm-key-lifecycle-01"),
        );
        expect(confirmed).toMatchObject({
          kind: "transitioned",
          replayed: false,
          view: {
            status: "PHARMACIST_CONFIRMED",
            confirmedBy: "actor-lifecycle-db",
            prescriptionVersion: null,
          },
        });

        const finalized = await service.finalize(
          lifecycleCommand("finalize-key-lifecycle-1"),
        );
        expect(finalized).toMatchObject({
          kind: "transitioned",
          replayed: false,
          view: {
            status: "PRESCRIPTION_FINALIZED",
            finalizedBy: "actor-lifecycle-db",
            prescriptionVersion: 1,
          },
        });

        const versionRows = await pool.query<{
          readonly version: number;
          readonly content_hash: string;
          readonly finalized_by: string;
        }>(
          `SELECT version, content_hash, finalized_by
             FROM prescription_versions
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_PRESCRIPTION_ID,
          ],
        );
        expect(versionRows.rows).toHaveLength(1);
        expect(versionRows.rows[0]?.version).toBe(1);
        expect(versionRows.rows[0]?.finalized_by).toBe("actor-lifecycle-db");

        const draftRows = await pool.query<{ readonly content_hash: string }>(
          `SELECT content_hash FROM prescription_drafts
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_PRESCRIPTION_ID,
          ],
        );
        expect(versionRows.rows[0]?.content_hash).toBe(
          draftRows.rows[0]?.content_hash,
        );

        const auditRows = await pool.query<{
          readonly audit_event_type: string;
        }>(
          `SELECT event_body->>'auditEventType' AS audit_event_type
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(
          auditRows.rows.map((row) => row.audit_event_type),
        ).toEqual([
          "prescription.created",
          "prescription.confirmed",
          "prescription.finalized",
        ]);

        const outboxRows = await pool.query<{
          readonly event_type: string;
          readonly aggregate_type: string;
          readonly payload: { readonly prescriptionId?: string; readonly version?: number };
          readonly audit_event_id: string;
        }>(
          `SELECT event_type, aggregate_type, payload, audit_event_id
             FROM outbox_events
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(outboxRows.rows).toHaveLength(1);
        expect(outboxRows.rows[0]?.event_type).toBe("prescription.finalized");
        expect(outboxRows.rows[0]?.aggregate_type).toBe("prescription");
        expect(outboxRows.rows[0]?.payload).toEqual({
          prescriptionId: LIFECYCLE_PRESCRIPTION_ID,
          version: 1,
        });

        // F-15: 監査 envelope 項目 + outbox.audit_event_id ↔ audit_events 連結。
        const envelopeRows = await pool.query<{
          readonly event_id: string;
          readonly audit_event_type: string;
          readonly idempotency_key: string;
          readonly correlation_id: string;
          readonly payload_hash: string;
          readonly schema_version: string;
          readonly prev_hash: string;
        }>(
          `SELECT
             event_id,
             event_body->>'auditEventType' AS audit_event_type,
             event_body->>'idempotencyKey' AS idempotency_key,
             event_body->>'correlationId' AS correlation_id,
             event_body->>'payloadHash' AS payload_hash,
             event_body->>'schemaVersion' AS schema_version,
             prev_hash
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(envelopeRows.rows).toHaveLength(3);
        for (const row of envelopeRows.rows) {
          expect(row.idempotency_key).toMatch(/^.+:1$/u);
          expect(row.correlation_id).toBe(row.event_id);
          expect(row.payload_hash).toMatch(/^[0-9a-f]{64}$/u);
          expect(row.schema_version).toBe("1");
          expect(row.prev_hash).toMatch(/^[0-9a-f]{64}$/u);
        }
        // hash chain: 各イベントの prevHash が直前 entryHash を指す。
        const chainRows = await pool.query<{ readonly entry_hash: string }>(
          `SELECT entry_hash
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(envelopeRows.rows[1]?.prev_hash).toBe(
          chainRows.rows[0]?.entry_hash,
        );
        expect(envelopeRows.rows[2]?.prev_hash).toBe(
          chainRows.rows[1]?.entry_hash,
        );
        // outbox の audit_event_id は finalized 監査イベントを指す。
        expect(outboxRows.rows[0]?.audit_event_id).toBe(
          envelopeRows.rows[2]?.event_id,
        );
      });
    });

    it("denies unqualified actors and records the denial audit in the same transaction", async () => {
      await withMigratedSchema(async (pool) => {
        const service = await seedAndSave(pool);
        const result = await service.confirm(
          lifecycleCommand("denied-key-lifecycle-01"),
        );
        expect(result).toEqual({ kind: "unqualified" });
        const auditRows = await pool.query<{
          readonly audit_event_type: string;
          readonly outcome: string;
        }>(
          `SELECT
             event_body->>'auditEventType' AS audit_event_type,
             event_body->>'outcome' AS outcome
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(
          auditRows.rows.map((row) => row.audit_event_type),
        ).toEqual(["prescription.created", "prescription.confirm.denied"]);
        expect(auditRows.rows[1]?.outcome).toBe("denied");
      });
    });

    it("replays the same idempotency key and rejects a different key", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool);
        const first = await service.confirm(
          lifecycleCommand("confirm-key-lifecycle-01"),
        );
        const replay = await service.confirm(
          lifecycleCommand("confirm-key-lifecycle-01"),
        );
        expect(first).toMatchObject({ kind: "transitioned", replayed: false });
        expect(replay).toMatchObject({ kind: "transitioned", replayed: true });
        await expect(
          service.confirm(lifecycleCommand("confirm-key-lifecycle-02")),
        ).resolves.toEqual({ kind: "invalid_transition" });
      });
    });

    it("replays the same key even after the reception leaves IN_PROGRESS", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool);
        await service.confirm(lifecycleCommand("confirm-key-lifecycle-01"));

        // 受付は独立 state machine で COMPLETED へ進み得る。
        await pool.query(
          `UPDATE reception_entries
              SET reception_status = 'COMPLETED'
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_SCOPE.receptionId,
          ],
        );

        // 同一 key の retry は受付状態に依らず stored view を返す(遷移済み
        // 操作の冪等 replay を受付 409 で潰さない)。
        const replay = await service.confirm(
          lifecycleCommand("confirm-key-lifecycle-01"),
        );
        expect(replay).toMatchObject({ kind: "transitioned", replayed: true });
        // 別 key は遷移 conflict(受付状態ではなく lifecycle 遷移の拒否)。
        await expect(
          service.confirm(lifecycleCommand("confirm-key-lifecycle-99")),
        ).resolves.toEqual({ kind: "invalid_transition" });
      });
    });

    it("rejects confirm for unresolved items, incomplete metadata, and non-IN_PROGRESS receptions", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool, {
          unresolvedMedication: true,
        });
        await expect(
          service.confirm(lifecycleCommand("unresolved-key-0000001")),
        ).resolves.toEqual({ kind: "unresolved_items" });
      });
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool, { dropMetadata: true });
        await expect(
          service.confirm(lifecycleCommand("metadata-key-00000001")),
        ).resolves.toEqual({ kind: "metadata_incomplete" });
      });
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        await seedReception(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          patientId: LIFECYCLE_SCOPE.patientId,
          receptionId: LIFECYCLE_SCOPE.receptionId,
          patientNumber: "LIFECYCLE-DB-001",
          idempotencyKey: "lifecycle-db-idempotency-001",
          receptionStatus: "COMPLETED",
        });
        const service = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId(LIFECYCLE_PRESCRIPTION_ID),
          {
            qualificationRepository:
              new PostgresActorQualificationRepository(pool),
          },
        );
        // COMPLETED 受付は save も不可 — draft を直接 seed する。
        await pool.query(
          `INSERT INTO prescription_drafts (
             tenant_id, pharmacy_id, prescription_id, reception_id, patient_id,
             business_date, version, prescription_type, prescription_date,
             default_days, note, medical_institution_code,
             medical_institution_name, prescriber_name, issue_date,
             valid_until, refill_total, refill_remaining, split_dispensing,
             rp_groups, content_hash, created_at, updated_at,
             created_by, updated_by
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6::date, 1, 'OUTPATIENT', '2026-08-25'::date,
             7, '', '1234567',
             '合成病院', '合成 医師', '2026-08-20'::date,
             '2026-08-24'::date, NULL, NULL, NULL,
             '[]'::jsonb, repeat('0', 64), '2026-08-25T01:00:00.000Z'::timestamptz,
             '2026-08-25T01:00:00.000Z'::timestamptz,
             'actor-lifecycle-db', 'actor-lifecycle-db'
           )`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_PRESCRIPTION_ID,
            LIFECYCLE_SCOPE.receptionId,
            LIFECYCLE_SCOPE.patientId,
            LIFECYCLE_SCOPE.businessDate,
          ],
        );
        await expect(
          service.confirm(lifecycleCommand("reception-key-00000001")),
        ).resolves.toEqual({ kind: "reception_not_in_progress" });
      });
    });

    it("blocks draft writes after confirmation and enforces append-only versions", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool, { flags: ["NARCOTIC"] });
        await service.confirm(lifecycleCommand("confirm-key-lifecycle-01"));
        await service.finalize(lifecycleCommand("finalize-key-lifecycle-1"));

        // サービス層: locked。
        await expect(
          service.save({
            ...lifecycleSaveInput(),
            expectedVersion: 1,
          }),
        ).resolves.toEqual({ kind: "locked" });

        // DB 層: trigger が content 改変を拒否。
        await expect(
          pool.query(
            `UPDATE prescription_drafts SET note = '確定後の改訂'
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/immutable after pharmacist confirmation/u);

        // 逆行遷移も trigger が拒否。
        await expect(
          pool.query(
            `UPDATE prescription_drafts SET status = 'PHARMACIST_CONFIRMED'
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/invalid prescription lifecycle transition/u);

        // prescription_versions は append-only。
        await expect(
          pool.query(
            `UPDATE prescription_versions SET content_hash = 'x'
              WHERE tenant_id = $1 AND pharmacy_id = $2`,
            [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
          ),
        ).rejects.toThrow(/append-only/u);
        await expect(
          pool.query(
            `DELETE FROM prescription_versions
              WHERE tenant_id = $1 AND pharmacy_id = $2`,
            [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
          ),
        ).rejects.toThrow(/append-only/u);

        // F-7: identity 付け替えは trigger が拒否。
        await expect(
          pool.query(
            `UPDATE prescription_drafts SET patient_id = 'patient-other'
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/identity is immutable/u);

        // F-7: 確定記録の書き換えも trigger が拒否。
        await expect(
          pool.query(
            `UPDATE prescription_drafts SET finalized_by = 'actor-other'
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/finalization record is immutable/u);

        // F-14: 確定済み draft の行削除は拒否。
        await expect(
          pool.query(
            `DELETE FROM prescription_drafts
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/cannot be deleted/u);

        // F-14: child table は post-confirm で全 DML 拒否(draft_rows は
        // 000019 時点で INSERT 自体が常時拒否のため、行を持てる flags で
        // DELETE ガードを実検証する)。
        await expect(
          pool.query(
            `DELETE FROM prescription_draft_flags
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              LIFECYCLE_PRESCRIPTION_ID,
            ],
          ),
        ).rejects.toThrow(/cannot be modified after pharmacist confirmation/u);
      });
    });

    it("treats REVOKED evidence as unqualified and audits finalize.denied", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "REVOKED",
        });
        const service = await seedAndSave(pool);
        await expect(
          service.confirm(lifecycleCommand("revoked-key-00000001")),
        ).resolves.toEqual({ kind: "unqualified" });
        await expect(
          service.finalize(lifecycleCommand("revoked-fin-00000001")),
        ).resolves.toEqual({ kind: "unqualified" });
        const auditRows = await pool.query<{
          readonly audit_event_type: string;
        }>(
          `SELECT event_body->>'auditEventType' AS audit_event_type
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(auditRows.rows.map((row) => row.audit_event_type)).toEqual([
          "prescription.created",
          "prescription.confirm.denied",
          "prescription.finalize.denied",
        ]);
      });
    });

    it("uses recorded_seq as the deterministic latest tiebreak", async () => {
      await withMigratedSchema(async (pool) => {
        // 同一 created_at で ACTIVE → REVOKED を連続 insert。latest は
        // recorded_seq 大きい方(REVOKED)= unqualified。
        for (const status of ["ACTIVE", "REVOKED"] as const) {
          await pool.query(
            `INSERT INTO actor_qualifications (
               tenant_id, pharmacy_id, qualification_id, actor_id,
               qualification_kind, license_ref, status,
               verified_by, verified_at, created_at
             ) VALUES ($1, $2, $3, $4, 'PHARMACIST_LICENSE', NULL, $5,
               'verifier', '2026-08-24T00:00:00.000Z'::timestamptz,
               '2026-08-24T00:00:00.000Z'::timestamptz)`,
            [
              LIFECYCLE_SCOPE.tenantId,
              LIFECYCLE_SCOPE.pharmacyId,
              `qual-tie-${status}`,
              LIFECYCLE_SCOPE.actorId,
              status,
            ],
          );
        }
        const repo = new PostgresActorQualificationRepository(pool);
        await expect(
          repo.hasActiveQualification({
            tenantId: LIFECYCLE_SCOPE.tenantId,
            pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
            actorId: LIFECYCLE_SCOPE.actorId,
            kind: "PHARMACIST_LICENSE",
          }),
        ).resolves.toBe(false);
      });
    });

    it("rolls back the whole transaction when the outbox insert fails", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool);
        await service.confirm(lifecycleCommand("confirm-key-lifecycle-01"));

        const failingService = new PostgresPrescriptionDraftService(
          pool,
          () => prescriptionId(LIFECYCLE_PRESCRIPTION_ID),
          {
            qualificationRepository:
              new PostgresActorQualificationRepository(pool),
            nextOutboxEventId: () => {
              throw new Error("injected outbox id failure");
            },
          },
        );
        await expect(
          failingService.finalize(lifecycleCommand("finalize-key-fail-001")),
        ).rejects.toThrow("injected outbox id failure");

        // 状態は PHARMACIST_CONFIRMED のまま、evidence は残らない。
        const draftRows = await pool.query<{ readonly status: string | null }>(
          `SELECT status FROM prescription_drafts
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_PRESCRIPTION_ID,
          ],
        );
        expect(draftRows.rows[0]?.status).toBe("PHARMACIST_CONFIRMED");

        const auditRows = await pool.query<{
          readonly audit_event_type: string;
        }>(
          `SELECT event_body->>'auditEventType' AS audit_event_type
             FROM audit_events
            WHERE tenant_id = $1 AND pharmacy_id = $2
            ORDER BY sequence_number ASC`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(auditRows.rows.map((row) => row.audit_event_type)).toEqual([
          "prescription.created",
          "prescription.confirmed",
        ]);

        const versionRows = await pool.query(
          `SELECT 1 FROM prescription_versions
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(versionRows.rows).toHaveLength(0);

        const outboxRows = await pool.query(
          `SELECT 1 FROM outbox_events
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [LIFECYCLE_SCOPE.tenantId, LIFECYCLE_SCOPE.pharmacyId],
        );
        expect(outboxRows.rows).toHaveLength(0);

        // finalize key も記録されず、別 key で正規に再試行できる。
        const retried = await service.finalize(
          lifecycleCommand("finalize-key-retry-01"),
        );
        expect(retried).toMatchObject({ kind: "transitioned", replayed: false });
      });
    });

    it("serializes concurrent save and confirm without deadlock", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool, {
          tenantId: LIFECYCLE_SCOPE.tenantId,
          pharmacyId: LIFECYCLE_SCOPE.pharmacyId,
          actorId: LIFECYCLE_SCOPE.actorId,
          status: "ACTIVE",
        });
        const service = await seedAndSave(pool);

        // save は reception → draft、confirm も reception → draft の順に
        // lock するため並行実行しても deadlock にならず直列化される。
        const [saveResult, confirmResult] = await Promise.all([
          service.save({ ...lifecycleSaveInput(), expectedVersion: 1 }),
          service.confirm(lifecycleCommand("confirm-key-concurrent")),
        ]);

        // 直列化結果は2通りのみ: save 先着 → confirm 成功、または
        // confirm 先着 → save は locked。部分状態の混在は許されない。
        if (saveResult.kind === "saved") {
          expect(confirmResult).toMatchObject({ kind: "transitioned" });
        } else {
          expect(saveResult).toEqual({ kind: "locked" });
          expect(confirmResult).toMatchObject({ kind: "transitioned" });
        }
        const draftRows = await pool.query<{ readonly status: string | null }>(
          `SELECT status FROM prescription_drafts
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
          [
            LIFECYCLE_SCOPE.tenantId,
            LIFECYCLE_SCOPE.pharmacyId,
            LIFECYCLE_PRESCRIPTION_ID,
          ],
        );
        expect(draftRows.rows[0]?.status).toBe("PHARMACIST_CONFIRMED");
      });
    });
  },
);
