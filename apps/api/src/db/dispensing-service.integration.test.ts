import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import {
  dispensingId,
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { PostgresActorQualificationRepository } from "./actor-qualification-repository.js";
import { PostgresDispensingService } from "./dispensing-service.js";
import { PostgresMasterRepository } from "./master-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import { createDbPool } from "./pool.js";
import { PostgresPrescriptionDraftService } from "./prescription-draft-service.js";
import { resolveTestDatabaseUrl } from "./test-database-environment.js";
import type { DispensingCreateInput } from "../dispensing-service.js";

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

function createTestSchemaName(): string {
  return `yrese_dispensing_test_${process.pid}_${Date.now()}_${Math.random()
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
    await cleanupPool.query(`DROP SCHEMA ${schemaName} CASCADE`);
    await cleanupPool.end();
  }
}

const SCOPE = {
  tenantId: tenantId("tenant-dispensing-db"),
  pharmacyId: pharmacyId("pharmacy-dispensing-db"),
  actorId: userId("actor-dispensing-db"),
  businessDate: "2026-08-25",
  wallClock: "2026-08-25T02:00:00.000Z",
} as const;

const RP_ITEM_ID = "00000000-0000-4000-8000-0000000000b1";
const RP_ITEM_ID_2 = "00000000-0000-4000-8000-0000000000b2";
const MED_ITEM_ID = "00000000-0000-4000-8000-0000000000d1";
const MED_ITEM_ID_GENERIC = "00000000-0000-4000-8000-0000000000d2";
const MED_ITEM_ID_OTHER = "00000000-0000-4000-8000-0000000000d3";
const MASTER_VERSION_ID = "00000000-0000-4000-8000-0000000000c1";

function entityIds(suffix: string) {
  return {
    patientId: patientId(`patient-dispensing-db-${suffix}`),
    receptionId: receptionId(`reception-dispensing-db-${suffix}`),
    prescriptionId: prescriptionId(`prescription-dispensing-db-${suffix}`),
  };
}

async function seedReception(pool: Pool, suffix: string): Promise<void> {
  const ids = entityIds(suffix);
  await pool.query(
    `INSERT INTO patients (
       tenant_id, pharmacy_id, patient_id, name, kana,
       birth_date, sex, patient_number,
       eligibility_status, eligibility_checked_at
     ) VALUES (
       $1, $2, $3, '合成調剤患者', 'ゴウセイチョウザイカンジャ',
       '1980-01-01'::date, 'female', $4, 'VERIFIED',
       '2026-08-25T00:00:00.000Z'::timestamptz
     )`,
    [SCOPE.tenantId, SCOPE.pharmacyId, ids.patientId, `DISP-DB-${suffix}`],
  );
  await pool.query(
    `INSERT INTO reception_entries (
       tenant_id, pharmacy_id, reception_id, patient_id,
       accepted_at, business_date, reception_status,
       prescription_intake_type, idempotency_key
     ) VALUES (
       $1, $2, $3, $4, '2026-08-25T00:30:00.000Z'::timestamptz,
       $5, 'IN_PROGRESS', 'paper', $6
     )`,
    [
      SCOPE.tenantId,
      SCOPE.pharmacyId,
      ids.receptionId,
      ids.patientId,
      SCOPE.businessDate,
      `dispensing-db-reception-${suffix}`,
    ],
  );
}

async function seedQualification(pool: Pool, status = "ACTIVE"): Promise<void> {
  await pool.query(
    `INSERT INTO actor_qualifications (
       tenant_id, pharmacy_id, qualification_id, actor_id,
       qualification_kind, license_ref, status,
       verified_by, verified_at, created_at
     ) VALUES (
       $1, $2, $3, $4,
       'PHARMACIST_LICENSE', NULL, $5,
       'verifier-dispensing-db', '2026-08-24T00:00:00.000Z'::timestamptz,
       '2026-08-24T00:00:00.000Z'::timestamptz
     )`,
    [
      SCOPE.tenantId,
      SCOPE.pharmacyId,
      `qualification-dispensing-db-${status}`,
      SCOPE.actorId,
      status,
    ],
  );
}

function saveInput(
  suffix: string,
  overrides?: {
    readonly genericSubstitutionPermitted?: boolean | null;
    readonly unresolvedMedication?: boolean;
    readonly secondItem?: boolean;
  },
) {
  const medication = overrides?.unresolvedMedication === true
    ? { kind: "unresolved" as const, text: "未解決薬剤" }
    : {
        kind: "resolved" as const,
        masterVersionId: MASTER_VERSION_ID,
        medicationItemId: MED_ITEM_ID,
      };
  const items = [
    {
      rpItemId: RP_ITEM_ID,
      sequence: 1,
      medication,
      doseOnce: null,
      dosePerDay: null,
      doseTotal: "7錠",
      unit: null,
      genericNamePrescription: false,
      genericSubstitutionPermitted:
        overrides?.genericSubstitutionPermitted ?? null,
    },
  ];
  if (overrides?.secondItem === true) {
    items.push({
      ...items[0]!,
      rpItemId: RP_ITEM_ID_2,
      sequence: 2,
    });
  }
  return {
    ...SCOPE,
    receptionId: entityIds(suffix).receptionId,
    patientId: entityIds(suffix).patientId,
    expectedVersion: 0,
    draft: {
      prescriptionType: "OUTPATIENT" as const,
      sourceMetadata: {
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
          items,
        },
      ],
      prescriptionDate: "2026-08-25",
      defaultDays: 7,
      flags: [],
      note: "",
      rows: [],
    },
  };
}

/** save → confirm → finalize して version 1 の finalized 処方を作る。 */
async function seedFinalizedPrescription(
  pool: Pool,
  suffix: string,
  overrides?: Parameters<typeof saveInput>[1],
): Promise<void> {
  await seedReception(pool, suffix);
  const ids = entityIds(suffix);
  const draftService = new PostgresPrescriptionDraftService(
    pool,
    () => ids.prescriptionId,
    {
      qualificationRepository: new PostgresActorQualificationRepository(pool),
      nextOutboxEventId: () =>
        `outbox-dsp-rx-${suffix}-${Math.random().toString(36).slice(2)}`,
    },
  );
  const saved = await draftService.save(saveInput(suffix, overrides));
  expect(saved).toMatchObject({ kind: "saved" });
  const cmd = (key: string) => ({
    tenantId: SCOPE.tenantId,
    pharmacyId: SCOPE.pharmacyId,
    actorId: SCOPE.actorId,
    prescriptionId: ids.prescriptionId,
    idempotencyKey: `${key}-${suffix}-${Math.random().toString(36).slice(2)}`,
    wallClock: SCOPE.wallClock,
  });
  expect(await draftService.confirm(cmd("confirm"))).toMatchObject({
    kind: "transitioned",
  });
  expect(await draftService.finalize(cmd("finalize"))).toMatchObject({
    kind: "transitioned",
    view: { prescriptionVersion: 1 },
  });
}

let dispensingSeq = 0;
function dispensingService(pool: Pool): PostgresDispensingService {
  dispensingSeq += 1;
  const seq = dispensingSeq;
  return new PostgresDispensingService(pool, {
    qualificationRepository: new PostgresActorQualificationRepository(pool),
    nextOutboxEventId: () =>
      `outbox-dsp-${seq}-${Math.random().toString(36).slice(2)}`,
    nextDispensingId: () =>
      dispensingId(
        `dispensing-dsp-${seq}-${Math.random().toString(36).slice(2)}`,
      ),
  });
}

function createInput(
  suffix: string,
  idempotencyKey: string,
  overrides?: {
    readonly prescriptionVersion?: number;
    readonly items?: DispensingCreateInput["items"];
  },
): DispensingCreateInput {
  return {
    tenantId: SCOPE.tenantId,
    pharmacyId: SCOPE.pharmacyId,
    actorId: SCOPE.actorId,
    prescriptionId: entityIds(suffix).prescriptionId,
    prescriptionVersion: overrides?.prescriptionVersion ?? 1,
    dispensingDate: "2026-08-25",
    idempotencyKey,
    wallClock: "2026-08-25T03:00:00.000Z",
    items: overrides?.items ?? [
      {
        rpItemId: RP_ITEM_ID,
        dispensedMedicationItemId: MED_ITEM_ID,
        dispensedText: null,
        quantity: "7錠",
        remainingStockAdjustment: null,
        note: null,
      },
    ],
  };
}

function confirmInput(idempotencyKey: string, dispensingIdValue: string) {
  return {
    tenantId: SCOPE.tenantId,
    pharmacyId: SCOPE.pharmacyId,
    actorId: SCOPE.actorId,
    dispensingId: dispensingId(dispensingIdValue),
    idempotencyKey,
    wallClock: "2026-08-25T04:00:00.000Z",
  };
}

async function seedMasterItem(
  pool: Pool,
  input: {
    readonly medicationItemId: string;
    readonly localCode: string;
    readonly genericNameCode: string | null;
  },
): Promise<void> {
  const masters = new PostgresMasterRepository(pool);
  await masters.seedVersion({
    tenantId: SCOPE.tenantId,
    pharmacyId: SCOPE.pharmacyId,
    masterVersionId: MASTER_VERSION_ID,
    masterKind: "medication",
    version: "2026-08",
    validFrom: "2026-08-01",
    recordedAt: "2026-08-25T00:00:00.000Z",
  });
  await masters.seedMedicationItem({
    tenantId: SCOPE.tenantId,
    pharmacyId: SCOPE.pharmacyId,
    medicationItemId: input.medicationItemId,
    masterVersionId: MASTER_VERSION_ID,
    localCode: input.localCode,
    name: "合成薬剤",
    unit: "錠",
    genericFlag: "originator",
    genericNameCode: input.genericNameCode,
  });
}

describePostgres(
  "PostgresDispensingService (WP-7404)",
  () => {
    it("creates a dispensing record with items and audit in one transaction", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "a1");
        const service = dispensingService(pool);

        const created = await service.create(createInput("a1", "disp-key-001"));
        expect(created).toMatchObject({
          kind: "created",
          replayed: false,
          record: {
            status: null,
            prescriptionVersion: 1,
            items: [
              {
                rpItemId: RP_ITEM_ID,
                prescribedMedicationItemId: MED_ITEM_ID,
                dispensedMedicationItemId: MED_ITEM_ID,
              },
            ],
          },
        });
        if (created.kind !== "created") throw new Error("unexpected");

        const recordRows = await pool.query(
          `SELECT status, created_by FROM dispensing_records
            WHERE dispensing_id = $1`,
          [created.record.dispensingId],
        );
        expect(recordRows.rows[0]).toMatchObject({
          status: null,
          created_by: SCOPE.actorId,
        });
        const itemRows = await pool.query(
          `SELECT count(*)::int AS n FROM dispensing_items
            WHERE dispensing_id = $1`,
          [created.record.dispensingId],
        );
        expect(itemRows.rows[0]?.n).toBe(1);
        const auditRows = await pool.query(
          `SELECT event_body->>'auditEventType' AS audit_event_type,
                  event_body->>'outcome' AS outcome
             FROM audit_events
            WHERE event_body->>'auditEventType' = 'dispensing.recorded'`,
        );
        expect(auditRows.rows).toHaveLength(1);
        expect(auditRows.rows[0]).toMatchObject({ outcome: "success" });
      });
    });

    it("replays create on same key, conflicts on different payload, blocks duplicate version", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "b1");
        const service = dispensingService(pool);

        const first = await service.create(createInput("b1", "disp-key-002"));
        const replay = await service.create(createInput("b1", "disp-key-002"));
        expect(replay).toMatchObject({ kind: "created", replayed: true });
        if (first.kind === "created" && replay.kind === "created") {
          expect(replay.record.dispensingId).toBe(first.record.dispensingId);
        }

        const conflict = await service.create({
          ...createInput("b1", "disp-key-002"),
          dispensingDate: "2026-08-26",
        });
        expect(conflict).toEqual({ kind: "idempotency_conflict" });

        // 別 key で同一版の二重記録は already_recorded。
        const dup = await service.create(createInput("b1", "disp-key-003"));
        expect(dup).toEqual({ kind: "already_recorded" });
      });
    });

    it("returns not_found for a non-finalized prescription and blocks on unresolved inquiry", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        // save のみ(finalize しない)→ version 行なし。
        await seedReception(pool, "c1");
        const draftService = new PostgresPrescriptionDraftService(
          pool,
          () => entityIds("c1").prescriptionId,
          {
            qualificationRepository:
              new PostgresActorQualificationRepository(pool),
          },
        );
        await draftService.save(saveInput("c1"));
        const service = dispensingService(pool);
        expect(await service.create(createInput("c1", "disp-key-004"))).toEqual({
          kind: "not_found",
        });

        await seedFinalizedPrescription(pool, "c2");
        // 未回答 inquiry を直接 seed。
        await pool.query(
          `INSERT INTO prescription_inquiries (
             tenant_id, pharmacy_id, inquiry_id, prescription_id,
             directed_to, content, created_by, created_at, idempotency_key
           ) VALUES ($1, $2, 'inquiry-dsp-001', $3,
                     'medical_institution', '疑義照会内容',
                     $4, '2026-08-25T02:30:00.000Z'::timestamptz,
                     'inquiry-key-dsp-001')`,
          [
            SCOPE.tenantId,
            SCOPE.pharmacyId,
            entityIds("c2").prescriptionId,
            SCOPE.actorId,
          ],
        );
        expect(await service.create(createInput("c2", "disp-key-005"))).toEqual({
          kind: "inquiry_unresolved",
        });
      });
    });

    it("rejects incomplete or extra item coverage with invalid_items", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "d1", { secondItem: true });
        const service = dispensingService(pool);
        // 2 品目のうち 1 品目のみ → invalid_items。
        expect(
          await service.create(createInput("d1", "disp-key-006")),
        ).toEqual({ kind: "invalid_items" });
        // 存在しない rpItemId → invalid_items。
        expect(
          await service.create(
            createInput("d1", "disp-key-007", {
              items: [
                {
                  rpItemId: RP_ITEM_ID,
                  dispensedMedicationItemId: MED_ITEM_ID,
                  dispensedText: null,
                  quantity: "7錠",
                  remainingStockAdjustment: null,
                  note: null,
                },
                {
                  rpItemId: "00000000-0000-4000-8000-0000000000ff",
                  dispensedMedicationItemId: null,
                  dispensedText: "x",
                  quantity: "1",
                  remainingStockAdjustment: null,
                  note: null,
                },
              ],
            }),
          ),
        ).toEqual({ kind: "invalid_items" });
      });
    });

    it("enforces generic substitution against master data and fails closed", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedMasterItem(pool, {
          medicationItemId: MED_ITEM_ID,
          localCode: "MED-001",
          genericNameCode: "GEN-001",
        });
        await seedMasterItem(pool, {
          medicationItemId: MED_ITEM_ID_GENERIC,
          localCode: "MED-002",
          genericNameCode: "GEN-001",
        });
        await seedMasterItem(pool, {
          medicationItemId: MED_ITEM_ID_OTHER,
          localCode: "MED-003",
          genericNameCode: "GEN-999",
        });
        const service = dispensingService(pool);
        const itemTo = (id: string) => [
          {
            rpItemId: RP_ITEM_ID,
            dispensedMedicationItemId: id,
            dispensedText: null,
            quantity: "7錠",
            remainingStockAdjustment: null,
            note: null,
          },
        ];

        // 変更不可 → generic_mismatch。
        await seedFinalizedPrescription(pool, "e1", {
          genericSubstitutionPermitted: null,
        });
        expect(
          await service.create(
            createInput("e1", "disp-key-008", {
              items: itemTo(MED_ITEM_ID_GENERIC),
            }),
          ),
        ).toEqual({ kind: "generic_mismatch" });

        // 変更可 + 同一一般名 → created。
        await seedFinalizedPrescription(pool, "e2", {
          genericSubstitutionPermitted: true,
        });
        expect(
          await service.create(
            createInput("e2", "disp-key-009", {
              items: itemTo(MED_ITEM_ID_GENERIC),
            }),
          ),
        ).toMatchObject({ kind: "created", replayed: false });

        // 変更可 + 一般名不一致 → generic_mismatch。
        await seedFinalizedPrescription(pool, "e3", {
          genericSubstitutionPermitted: true,
        });
        expect(
          await service.create(
            createInput("e3", "disp-key-010", {
              items: itemTo(MED_ITEM_ID_OTHER),
            }),
          ),
        ).toEqual({ kind: "generic_mismatch" });

        // 変更可 + 未収載 master → fail-closed generic_mismatch。
        await seedFinalizedPrescription(pool, "e4", {
          genericSubstitutionPermitted: true,
        });
        expect(
          await service.create(
            createInput("e4", "disp-key-011", {
              items: itemTo("00000000-0000-4000-8000-0000000000ee"),
            }),
          ),
        ).toEqual({ kind: "generic_mismatch" });
      });
    });

    it("confirms atomically with audit and outbox, replays same-key confirm", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "f1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("f1", "disp-key-012"));
        if (created.kind !== "created") throw new Error("unexpected");
        const id = created.record.dispensingId;

        const confirmed = await service.confirm(confirmInput("cfm-001", id));
        expect(confirmed).toMatchObject({
          kind: "confirmed",
          replayed: false,
          record: {
            status: "DISPENSING_RECORDED",
            confirmedBy: SCOPE.actorId,
          },
        });

        // 同一 tx: status + audit + outbox が揃って永続化。
        const audit = await pool.query(
          `SELECT event_body->>'auditEventType' AS audit_event_type
             FROM audit_events
            WHERE event_body->>'auditEventType' = 'dispensing.confirmed'`,
        );
        expect(audit.rows).toHaveLength(1);
        const outbox = await pool.query<{
          readonly event_type: string;
          readonly aggregate_type: string;
          readonly aggregate_id: string;
          readonly payload: Record<string, unknown>;
        }>(
          `SELECT event_type, aggregate_type, aggregate_id, payload
             FROM outbox_events WHERE event_type = 'dispense.confirmed'`,
        );
        expect(outbox.rows).toHaveLength(1);
        expect(outbox.rows[0]).toMatchObject({
          aggregate_type: "dispensing",
          aggregate_id: id,
          payload: {
            prescriptionId: entityIds("f1").prescriptionId,
            version: 1,
          },
        });

        // 同 key replay → 200 相当の replayed view。
        const replay = await service.confirm(confirmInput("cfm-001", id));
        expect(replay).toMatchObject({ kind: "confirmed", replayed: true });
        // 別 key → 409 DSP-0002(確認済みへの再遷移)。
        expect(await service.confirm(confirmInput("cfm-002", id))).toEqual({
          kind: "invalid_transition",
        });
        // outbox/audit が重複していないこと。
        const outboxCount = await pool.query(
          `SELECT count(*)::int AS n FROM outbox_events
            WHERE event_type = 'dispense.confirmed'`,
        );
        expect(outboxCount.rows[0]?.n).toBe(1);
      });
    });

    it("denies confirm without pharmacist qualification and audits the denial", async () => {
      await withMigratedSchema(async (pool) => {
        // 処方 lifecycle 実行者は資格あり。confirm 実行者は別 actor(資格なし)。
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "g1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("g1", "disp-key-013"));
        if (created.kind !== "created") throw new Error("unexpected");

        const denied = await service.confirm({
          ...confirmInput("cfm-003", created.record.dispensingId),
          actorId: userId("actor-dispensing-unqualified"),
        });
        expect(denied).toEqual({ kind: "unqualified" });
        const audit = await pool.query(
          `SELECT event_body->>'outcome' AS outcome
             FROM audit_events
            WHERE event_body->>'auditEventType' = 'dispensing.confirm.denied'`,
        );
        expect(audit.rows).toHaveLength(1);
        expect(audit.rows[0]).toMatchObject({ outcome: "denied" });
        // status は未確定のまま。
        const row = await pool.query(
          `SELECT status FROM dispensing_records WHERE dispensing_id = $1`,
          [created.record.dispensingId],
        );
        expect(row.rows[0]?.status).toBeNull();

        // 別 scope は資格自体が存在しない → unqualified(存在秘匿の前段)。
        const cross = await service.confirm({
          ...confirmInput("cfm-004", created.record.dispensingId),
          pharmacyId: pharmacyId("pharmacy-other-db"),
        });
        expect(cross).toEqual({ kind: "unqualified" });
      });
    });

    it("serializes concurrent confirm so only one wins", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "h1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("h1", "disp-key-014"));
        if (created.kind !== "created") throw new Error("unexpected");
        const id = created.record.dispensingId;

        const [r1, r2] = await Promise.all([
          service.confirm(confirmInput("cfm-par-1", id)),
          service.confirm(confirmInput("cfm-par-2", id)),
        ]);
        const kinds = [r1.kind, r2.kind].sort();
        // 一方が confirmed、もう一方は invalid_transition(別 key、確認済み)。
        expect(kinds).toEqual(["confirmed", "invalid_transition"]);
        const outbox = await pool.query(
          `SELECT count(*)::int AS n FROM outbox_events
            WHERE event_type = 'dispense.confirmed'`,
        );
        expect(outbox.rows[0]?.n).toBe(1);
      });
    });

    it("serializes concurrent create to exactly one record per version", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "k1");
        const service = dispensingService(pool);

        // 別 key の同時 create → 一意違反側は retry → already_recorded。
        const [r1, r2] = await Promise.all([
          service.create(createInput("k1", "disp-key-par-1")),
          service.create(createInput("k1", "disp-key-par-2")),
        ]);
        const kinds = [r1.kind, r2.kind].sort();
        expect(kinds).toEqual(["already_recorded", "created"]);
        const count = await pool.query(
          `SELECT count(*)::int AS n FROM dispensing_records`,
        );
        expect(count.rows[0]?.n).toBe(1);
      });
    });

    it("resolves concurrent same-key create to replay, not already_recorded", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "k1");
        const service = dispensingService(pool);

        // 同一 key・同一 payload の並行再送: pre-lock snapshot で byKey が
        // miss した敗者も、draft lock 取得後の再評価で winner を replay と
        // 判定しなければならない(already_recorded に倒れない)。
        const [r1, r2] = await Promise.all([
          service.create(createInput("k1", "disp-key-same")),
          service.create(createInput("k1", "disp-key-same")),
        ]);
        expect(r1.kind).toBe("created");
        expect(r2.kind).toBe("created");
        if (r1.kind === "created" && r2.kind === "created") {
          expect(r1.record.dispensingId).toBe(r2.record.dispensingId);
          expect([r1.replayed, r2.replayed].sort()).toEqual([false, true]);
        }
      });
    });

    it("rejects confirm key reuse across records (scope-unique)", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "l1");
        await seedFinalizedPrescription(pool, "l2");
        const service = dispensingService(pool);
        const first = await service.create(createInput("l1", "disp-key-017"));
        const second = await service.create(createInput("l2", "disp-key-018"));
        if (first.kind !== "created" || second.kind !== "created") {
          throw new Error("unexpected");
        }
        await service.confirm(confirmInput("cfm-shared", first.record.dispensingId));
        // 同一 confirm key を別 record で使うと UNIQUE 違反 → conflict。
        const reused = await service.confirm(
          confirmInput("cfm-shared", second.record.dispensingId),
        );
        expect(reused).toEqual({ kind: "idempotency_conflict" });
      });
    });

    it("rejects create_request rewrite during the confirm transition", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "m1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("m1", "disp-key-019"));
        if (created.kind !== "created") throw new Error("unexpected");
        await expect(
          pool.query(
            `UPDATE dispensing_records
                SET create_request = '{}'::jsonb,
                    status = 'DISPENSING_RECORDED',
                    confirm_idempotency_key = 'k',
                    confirmed_by = 'x',
                    confirmed_at = now(), updated_by = 'x', updated_at = now()
              WHERE dispensing_id = $1`,
            [created.record.dispensingId],
          ),
        ).rejects.toThrow();
      });
    });

    it("works with pool.max = 1 (single-client transaction, no pool re-borrow)", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "i1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("i1", "disp-key-015"));
        if (created.kind !== "created") throw new Error("unexpected");
        const confirmed = await service.confirm(
          confirmInput("cfm-005", created.record.dispensingId),
        );
        expect(confirmed).toMatchObject({ kind: "confirmed" });
      }, 1);
    });

    it("enforces append-only and status-transition guards at the database level", async () => {
      await withMigratedSchema(async (pool) => {
        await seedQualification(pool);
        await seedFinalizedPrescription(pool, "j1");
        const service = dispensingService(pool);
        const created = await service.create(createInput("j1", "disp-key-016"));
        if (created.kind !== "created") throw new Error("unexpected");
        const id = created.record.dispensingId;

        // dispensing_items UPDATE/DELETE は拒否。
        await expect(
          pool.query(
            `UPDATE dispensing_items SET quantity = '1' WHERE dispensing_id = $1`,
            [id],
          ),
        ).rejects.toThrow();
        await expect(
          pool.query(`DELETE FROM dispensing_items WHERE dispensing_id = $1`, [
            id,
          ]),
        ).rejects.toThrow();
        // 識別子列の UPDATE は拒否(append-only guard)。
        await expect(
          pool.query(
            `UPDATE dispensing_records SET prescription_id = 'x'
              WHERE dispensing_id = $1`,
            [id],
          ),
        ).rejects.toThrow();
        // status 遷移 guard: 確定後の再遷移は拒否。
        await service.confirm(confirmInput("cfm-006", id));
        await expect(
          pool.query(
            `UPDATE dispensing_records SET status = NULL WHERE dispensing_id = $1`,
            [id],
          ),
        ).rejects.toThrow();
      });
    });
  },
);
