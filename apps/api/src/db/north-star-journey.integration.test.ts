/**
 * WP-7405 / SEC-009 §4: North Star 全行程 E2E(postgres + test_signed)。
 *
 * dev_headers は postgres 構成で拒否されるため、CI/E2E では HMAC-SHA256
 * 署名 credential(`x-test-auth`)で tenant context を解決する。
 * 受付 → IN_PROGRESS → Rp 構造化(resolved)→ 薬剤師確認 → 確定 →
 * 調剤記録 create/confirm → audit/outbox evidence を実 route/実 PG で貫通し、
 * 401 AUTH-0004 の fail-closed 経路も検証する。
 *
 * TEST_DATABASE_URL 未設定なら skip(schema 単位で隔離・後始末する)。
 */
import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import {
  AUTH_UNAUTHENTICATED_ERROR_CODE,
  pharmacyId,
  tenantId,
} from "@yrese/shared-kernel";
import {
  auditLogResponseSchema,
  outboxSummaryResponseSchema,
  receptionQueueEntrySchema,
} from "@yrese/contracts";

import { dispensingRoutes } from "../dispensing-routes.js";
import { operationsRoutes } from "../operations-routes.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "../patient-search-cursor.js";
import { signTestAuthCredential } from "../plugins/tenant-context.js";
import { prescriptionDraftRoutes } from "../prescription-draft-routes.js";
import { prescriptionLifecycleRoutes } from "../prescription-lifecycle-routes.js";
import { buildServer } from "../server.js";
import { PostgresActorQualificationRepository } from "./actor-qualification-repository.js";
import { PostgresAuditRepository } from "./audit-repository.js";
import { PostgresCoverageRecordCommand } from "./coverage-command.js";
import { PostgresCoverageRepository } from "./coverage-repository.js";
import { PostgresDispensingService } from "./dispensing-service.js";
import { PostgresEligibilityRecordCommand } from "./eligibility-snapshot-command.js";
import { PostgresEligibilitySnapshotRepository } from "./eligibility-snapshot-repository.js";
import { PostgresMasterRepository } from "./master-repository.js";
import { applyPendingMigrations } from "./migration-runner.js";
import { loadMigrationFiles } from "./migrations.js";
import { PostgresOperationsReadService } from "./operations-read.js";
import { PostgresPatientRepository } from "./patient-repository.js";
import { PostgresPatientWriteCommand } from "./patient-command.js";
import { createDbPool } from "./pool.js";
import { PostgresPrescriptionDraftService } from "./prescription-draft-service.js";
import {
  PostgresReceptionCreateCommand,
  PostgresReceptionTransitionCommand,
} from "./reception-command.js";
import { PostgresReceptionRepository } from "./reception-repository.js";
import { resolveTestDatabaseUrl } from "./test-database-environment.js";

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const TEST_AUTH_KEY = "wp7405-journey-test-auth-key";
const SCOPE = {
  tenant: "tenant-journey-pg",
  pharmacy: "pharmacy-journey-pg",
  actor: "pharmacist-journey-pg",
} as const;

const JOURNEY_SCOPES = [
  "tenant:read",
  "patient:read",
  "patient:write",
  "reception:read",
  "reception:write",
  "prescription:read",
  "prescription:write",
  "prescription:confirm",
  "dispensing:write",
  "dispensing:confirm",
  "master:read",
  "audit-log:read",
  "sync:read",
] as const;

const signedHeaders = (scopes: readonly string[] = JOURNEY_SCOPES) => ({
  "x-test-auth": signTestAuthCredential(TEST_AUTH_KEY, {
    ...SCOPE,
    scopes,
  }),
});

const businessDate = "2026-09-16";
const now = () => new Date("2026-09-16T02:00:00.000Z");

const MED_VERSION_ID = "00000000-0000-4000-8000-00000000e001";
const USAGE_VERSION_ID = "00000000-0000-4000-8000-00000000e002";
const MED_ITEM_ID = "00000000-0000-4000-8000-00000000e011";
const USAGE_ITEM_ID = "00000000-0000-4000-8000-00000000e021";
const RP_GROUP_ID = "00000000-0000-4000-8000-00000000e031";
const RP_ITEM_ID = "00000000-0000-4000-8000-00000000e041";
const PATIENT_ID = "00000000-0000-4000-8000-00000000e051";

async function seedFixtures(pool: Pool): Promise<void> {
  const masters = new PostgresMasterRepository(pool);
  const scope = {
    tenantId: tenantId(SCOPE.tenant),
    pharmacyId: pharmacyId(SCOPE.pharmacy),
  };
  const recordedAt = "2026-09-16T00:00:00.000Z";
  await masters.seedVersion({
    ...scope,
    masterVersionId: MED_VERSION_ID,
    masterKind: "medication",
    version: "2026-09",
    validFrom: "2026-01-01",
    recordedAt,
  });
  await masters.seedVersion({
    ...scope,
    masterVersionId: USAGE_VERSION_ID,
    masterKind: "usage",
    version: "2026-09",
    validFrom: "2026-01-01",
    recordedAt,
  });
  await masters.seedMedicationItem({
    ...scope,
    masterVersionId: MED_VERSION_ID,
    medicationItemId: MED_ITEM_ID,
    localCode: "JRN-PG-MED",
    name: "合成薬剤PG 5mg",
    unit: "錠",
    genericFlag: "originator",
    genericNameCode: "GN-JRN-PG-001",
    controlCategories: [],
  });
  await masters.seedUsageItem({
    ...scope,
    masterVersionId: USAGE_VERSION_ID,
    usageItemId: USAGE_ITEM_ID,
    localCode: "JRN-PG-USG",
    text: "1日1回 朝食後",
  });
  // 患者(受付 FK)と journey actor の薬剤師資格(SEC-010)。
  await pool.query(
    `INSERT INTO patients (
       tenant_id, pharmacy_id, patient_id, name, kana,
       birth_date, sex, patient_number,
       eligibility_status, eligibility_checked_at
     ) VALUES (
       $1, $2, $3, '合成旅程患者', 'ゴウセイリョテイカンジャ',
       '1980-01-01'::date, 'female', 'JRN-PG-001', 'VERIFIED',
       '2026-09-16T00:00:00.000Z'::timestamptz
     )`,
    [SCOPE.tenant, SCOPE.pharmacy, PATIENT_ID],
  );
  await pool.query(
    `INSERT INTO actor_qualifications (
       tenant_id, pharmacy_id, qualification_id, actor_id,
       qualification_kind, license_ref, status,
       verified_by, verified_at, created_at
     ) VALUES (
       $1, $2, 'qualification-journey-pg', $3,
       'PHARMACIST_LICENSE', NULL, 'ACTIVE',
       'verifier-journey-pg', '2026-09-15T00:00:00.000Z'::timestamptz,
       '2026-09-15T00:00:00.000Z'::timestamptz
     )`,
    [SCOPE.tenant, SCOPE.pharmacy, SCOPE.actor],
  );
}

async function withJourneyServer(
  run: (server: ReturnType<typeof buildServer>, pool: Pool) => Promise<void>,
): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error("TEST_DATABASE_URL unexpectedly missing");
  }
  const schemaName = `yrese_journey_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: 4,
    options: `-c search_path=${schemaName}`,
  });
  let server: ReturnType<typeof buildServer> | undefined;
  try {
    const migrations = await loadMigrationFiles();
    await applyPendingMigrations(pool, migrations, {
      appliedBy: "vitest",
      appliedAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    await seedFixtures(pool);

    const masterRepository = new PostgresMasterRepository(pool);
    const auditRepository = new PostgresAuditRepository(pool);
    const qualificationRepository =
      new PostgresActorQualificationRepository(pool);
    server = buildServer({
      patientRepository: new PostgresPatientRepository(pool),
      receptionRepository: new PostgresReceptionRepository(pool),
      auditRepository,
      receptionCreateCommand: new PostgresReceptionCreateCommand(pool),
      receptionTransitionCommand: new PostgresReceptionTransitionCommand(pool),
      eligibilitySnapshotRepository:
        new PostgresEligibilitySnapshotRepository(pool),
      eligibilityRecordCommand: new PostgresEligibilityRecordCommand(pool),
      patientWriteCommand: new PostgresPatientWriteCommand(pool),
      coverageRepository: new PostgresCoverageRepository(pool),
      coverageRecordCommand: new PostgresCoverageRecordCommand(pool),
      masterRepository,
      repositoryMode: "postgres",
      tenantContextMode: "test_signed",
      tenantContextTestAuthKey: TEST_AUTH_KEY,
      patientSearchCursorCodec: createPatientSearchCursorCodec(
        randomBytes(patientSearchCursorHmacKeyByteLength),
      ),
      now,
    });
    const prescriptionDraftService = new PostgresPrescriptionDraftService(
      pool,
      undefined,
      { qualificationRepository, masterRepository },
    );
    server.register(prescriptionDraftRoutes, {
      service: prescriptionDraftService,
      now,
    });
    server.register(prescriptionLifecycleRoutes, {
      service: prescriptionDraftService,
      now,
    });
    server.register(dispensingRoutes, {
      service: new PostgresDispensingService(pool, {
        qualificationRepository,
      }),
    });
    server.register(operationsRoutes, {
      service: new PostgresOperationsReadService({ pool, migrations }),
    });
    await run(server, pool);
  } finally {
    await server?.close();
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    await cleanupPool.query(`DROP SCHEMA ${schemaName} CASCADE`);
    await cleanupPool.end();
  }
}

describePostgres("North Star full journey on postgres (WP-7405)", () => {
  it("reception → structured draft → confirm → finalize → dispensing → evidence", async () => {
    await withJourneyServer(async (server, pool) => {
      const reception = await server.inject({
        method: "POST",
        url: "/reception",
        headers: signedHeaders(),
        payload: {
          patientId: PATIENT_ID,
          idempotencyKey: "ns-pg-journey-001",
        },
      });
      expect(reception.statusCode).toBe(201);
      const { receptionId: receptionIdValue } = receptionQueueEntrySchema.parse(
        reception.json(),
      );

      const started = await server.inject({
        method: "POST",
        url: `/reception/${receptionIdValue}/transitions`,
        headers: { ...signedHeaders(), "if-match": '"1"' },
        payload: { to: "IN_PROGRESS", expectedVersion: 1 },
      });
      expect(started.statusCode).toBe(200);

      const saved = await server.inject({
        method: "PUT",
        url: `/prescription-drafts/by-reception/${receptionIdValue}`,
        headers: signedHeaders(),
        payload: {
          patientId: PATIENT_ID,
          businessDate,
          expectedVersion: 0,
          draft: {
            prescriptionType: "OUTPATIENT",
            prescriptionDate: "2026-09-15",
            defaultDays: 7,
            flags: [],
            note: "",
            rows: [],
            sourceMetadata: {
              medicalInstitution: { code: "1234567", name: "合成病院" },
              prescriberName: "合成 医師",
              issueDate: "2026-09-15",
              validUntil: "2026-09-19",
              refill: null,
              splitDispensing: null,
            },
            rpGroups: [
              {
                rpGroupId: RP_GROUP_ID,
                sequence: 1,
                dosageForm: "ORAL",
                usage: { kind: "resolved", usageItemId: USAGE_ITEM_ID },
                daysOrCount: 7,
                items: [
                  {
                    rpItemId: RP_ITEM_ID,
                    sequence: 1,
                    medication: {
                      kind: "resolved",
                      masterVersionId: MED_VERSION_ID,
                      medicationItemId: MED_ITEM_ID,
                    },
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
          },
        },
      });
      expect(saved.statusCode).toBe(201);
      const prescriptionIdValue = saved.json().prescriptionId as string;

      const confirmed = await server.inject({
        method: "POST",
        url: `/prescriptions/${prescriptionIdValue}/confirm`,
        headers: {
          ...signedHeaders(),
          "idempotency-key": "ns-pg-journey-confirm-001",
        },
        payload: {},
      });
      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json().status).toBe("PHARMACIST_CONFIRMED");

      const finalized = await server.inject({
        method: "POST",
        url: `/prescriptions/${prescriptionIdValue}/finalize`,
        headers: {
          ...signedHeaders(),
          "idempotency-key": "ns-pg-journey-finalize-01",
        },
        payload: {},
      });
      expect(finalized.statusCode).toBe(200);
      expect(finalized.json().status).toBe("PRESCRIPTION_FINALIZED");

      const dispensed = await server.inject({
        method: "POST",
        url: "/dispensings",
        headers: {
          ...signedHeaders(),
          "idempotency-key": "ns-pg-journey-disp-0001",
        },
        payload: {
          prescriptionId: prescriptionIdValue,
          prescriptionVersion: 1,
          dispensingDate: businessDate,
          items: [
            {
              rpItemId: RP_ITEM_ID,
              dispensedMedicationItemId: MED_ITEM_ID,
              dispensedText: null,
              quantity: "7錠",
              remainingStockAdjustment: null,
              note: null,
            },
          ],
        },
      });
      expect(dispensed.statusCode).toBe(201);
      const dispensingIdValue = dispensed.json().dispensingId as string;

      const dispensingConfirmed = await server.inject({
        method: "POST",
        url: `/dispensings/${dispensingIdValue}/confirm`,
        headers: {
          ...signedHeaders(),
          "idempotency-key": "ns-pg-journey-dcfm-0001",
        },
        payload: {},
      });
      expect(dispensingConfirmed.statusCode).toBe(200);
      expect(dispensingConfirmed.json().status).toBe("DISPENSING_RECORDED");

      // audit evidence(実 route 経由)。
      const audit = await server.inject({
        method: "GET",
        url: "/audit/events?limit=200",
        headers: signedHeaders(),
      });
      expect(audit.statusCode).toBe(200);
      const auditBody = auditLogResponseSchema.parse(audit.json());
      expect(
        auditBody.entries.map((entry) => entry.auditEventType),
      ).toEqual(
        expect.arrayContaining([
          "reception.created",
          "reception.started",
          "prescription.created",
          "prescription.confirmed",
          "prescription.finalized",
          "dispensing.recorded",
          "dispensing.confirmed",
        ]),
      );
      expect(auditBody.chainVerification.ok).toBe(true);

      // outbox evidence(実 route 経由)。
      const outbox = await server.inject({
        method: "GET",
        url: "/operations/outbox-summary",
        headers: signedHeaders(),
      });
      expect(outbox.statusCode).toBe(200);
      expect(
        outboxSummaryResponseSchema
          .parse(outbox.json())
          .byEventType.map((entry) => entry.eventType),
      ).toEqual(
        expect.arrayContaining([
          "reception.created",
          "prescription.finalized",
          "dispense.confirmed",
        ]),
      );

      // dispense.confirmed payload は識別子/版のみ(PHI 非含有)。
      const outboxRows = await pool.query<{
        aggregate_id: string;
        payload: unknown;
      }>(
        `SELECT aggregate_id, payload FROM outbox_events
         WHERE event_type = 'dispense.confirmed'`,
      );
      expect(outboxRows.rows).toHaveLength(1);
      expect(outboxRows.rows[0]?.aggregate_id).toBe(dispensingIdValue);
      const payloadJson = JSON.stringify(outboxRows.rows[0]?.payload);
      expect(payloadJson).toContain(prescriptionIdValue);
      expect(payloadJson).not.toContain("合成薬剤PG");
      expect(payloadJson).not.toContain("合成旅程患者");
    });
  });

  it("missing/invalid x-test-auth resolves to 401 AUTH-0004 on protected routes", async () => {
    await withJourneyServer(async (server) => {
      for (const headers of [
        {},
        { "x-test-auth": "malformed" },
        {
          "x-test-auth": signTestAuthCredential("wrong-key", {
            ...SCOPE,
            scopes: JOURNEY_SCOPES,
          }),
        },
      ]) {
        const response = await server.inject({
          method: "GET",
          url: "/whoami",
          headers,
        });
        expect(response.statusCode).toBe(401);
        expect(response.json().errorCode).toBe(
          AUTH_UNAUTHENTICATED_ERROR_CODE,
        );
      }
      // 有効 credential + scope 不足 → 403。
      const insufficient = await server.inject({
        method: "GET",
        url: "/whoami",
        headers: signedHeaders(["patient:read"]),
      });
      expect(insufficient.statusCode).toBe(403);
    });
  });
});
