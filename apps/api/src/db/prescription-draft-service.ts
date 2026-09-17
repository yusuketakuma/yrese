import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  deriveRpGroupsFromLegacyRows,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  prescriptionLifecycleViewSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftResponse,
  type PrescriptionLifecycleView,
} from "@yrese/contracts";
import {
  prescriptionId,
  receptionId,
  type PrescriptionId,
} from "@yrese/shared-kernel";

import { appendAuditEventWithinTransaction } from "./audit-repository.js";
import type { PostgresActorQualificationRepository } from "./actor-qualification-repository.js";
import { runInPooledTransaction } from "./pool.js";
import { snapshotDatabaseInstant } from "../instant.js";
import {
  comparePrescriptionDraftFlags,
  countUnresolvedPrescriptionItems,
  isPrescriptionSourceMetadataComplete,
  normalizePrescriptionDraftContentForStorage,
  prescriptionDraftContentHashCandidates,
  type PrescriptionDraftLookupInput,
  type PrescriptionDraftLookupResult,
  type PrescriptionDraftSaveInput,
  type PrescriptionDraftSaveResult,
  type PrescriptionDraftService,
  type PrescriptionLifecycleCommandInput,
  type PrescriptionLifecycleCommandResult,
} from "../prescription-draft-service.js";

interface MetadataRow {
  readonly prescription_id: string;
  readonly reception_id: string;
  readonly patient_id: string;
  readonly business_date: string;
  readonly version: number;
  readonly prescription_type: string;
  readonly prescription_date: string | null;
  readonly default_days: number | null;
  readonly note: string;
  readonly medical_institution_code: string | null;
  readonly medical_institution_name: string | null;
  readonly prescriber_name: string | null;
  readonly issue_date: string | null;
  readonly valid_until: string | null;
  readonly refill_total: number | null;
  readonly refill_remaining: number | null;
  readonly split_dispensing: string | null;
  readonly rp_groups: unknown;
  readonly content_hash: string;
  readonly status: string | null;
  readonly confirmed_by: string | null;
  readonly confirmed_at: Date | string | null;
  readonly finalized_by: string | null;
  readonly finalized_at: Date | string | null;
  readonly confirm_idempotency_key: string | null;
  readonly finalize_idempotency_key: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly created_by: string;
  readonly updated_by: string;
}

interface DraftRowRecord {
  readonly row_sequence: number;
  readonly drug_text: string;
  readonly usage_text: string;
  readonly days: number | null;
  readonly quantity_text: string;
}

interface DraftFlagRecord {
  readonly flag: string;
}

export const prescriptionDraftDatabaseInvariantErrorMessage =
  "Prescription draft database returned an invalid record";
export const prescriptionDraftVersionExhaustedErrorMessage =
  "Prescription draft version limit reached";

async function selectMetadata(
  client: PoolClient,
  input: PrescriptionDraftLookupInput,
  lock: boolean,
  expectedPatientId?: string,
): Promise<MetadataRow | undefined> {
  const result = await client.query<MetadataRow>(
    `SELECT
       prescription_id,
       reception_id,
       patient_id,
       business_date::text AS business_date,
       version,
       prescription_type,
       prescription_date::text AS prescription_date,
       default_days,
       note,
       medical_institution_code,
       medical_institution_name,
       prescriber_name,
       issue_date::text AS issue_date,
       valid_until::text AS valid_until,
       refill_total,
       refill_remaining,
       split_dispensing,
       rp_groups,
       content_hash,
       status,
       confirmed_by,
       confirmed_at,
       finalized_by,
       finalized_at,
       confirm_idempotency_key,
       finalize_idempotency_key,
       created_at,
       updated_at,
       created_by,
       updated_by
     FROM prescription_drafts
     WHERE tenant_id = $1
       AND pharmacy_id = $2
       AND reception_id = $3
       AND ($4::text IS NULL OR patient_id = $4)
       AND business_date = $5::date
     ${lock ? "FOR UPDATE" : ""}`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      expectedPatientId ?? null,
      input.businessDate,
    ],
  );
  if (result.rows.length > 1) {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }
  return result.rows[0];
}

async function receptionMatches(
  client: PoolClient,
  input: PrescriptionDraftLookupInput,
  requireEditable: boolean,
  expectedPatientId?: string,
): Promise<{ readonly patientId: string } | undefined> {
  const result = await client.query<{ readonly patient_id: string }>(
    `SELECT patient_id
       FROM reception_entries
      WHERE tenant_id = $1
        AND pharmacy_id = $2
        AND reception_id = $3
        AND business_date = $4::date
        AND ($5::text IS NULL OR patient_id = $5)
        AND ($6::boolean = false OR reception_status IN ('WAITING', 'IN_PROGRESS'))
      ${requireEditable ? "FOR NO KEY UPDATE" : ""}`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      input.businessDate,
      expectedPatientId ?? null,
      requireEditable,
    ],
  );
  const [row] = result.rows;
  if (row === undefined || result.rows.length !== 1) return undefined;
  return { patientId: row.patient_id };
}

/**
 * 行の sourceMetadata 列を wire 形状へ戻す。migration 000017 の CHECK が
 * 「全列 NULL または必須列すべて非 NULL」のみ許容するため、issue_date NULL の
 * 行で他列が残っている状態は不変条件違反として fail-closed にする。
 */
function sourceMetadataFromRow(row: MetadataRow) {
  const hasAnyMetadataColumn =
    row.medical_institution_code !== null ||
    row.medical_institution_name !== null ||
    row.prescriber_name !== null ||
    row.valid_until !== null ||
    row.refill_total !== null ||
    row.refill_remaining !== null ||
    row.split_dispensing !== null;
  if (row.issue_date === null) {
    if (hasAnyMetadataColumn) {
      throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
    }
    return null;
  }
  return {
    medicalInstitution: {
      code: row.medical_institution_code,
      name: row.medical_institution_name,
    },
    prescriberName: row.prescriber_name,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    refill:
      row.refill_total === null
        ? null
        : { total: row.refill_total, remaining: row.refill_remaining },
    splitDispensing: row.split_dispensing,
  };
}

function storedHashMatches(
  row: MetadataRow,
  draft: PrescriptionDraftContent,
): boolean {
  return prescriptionDraftContentHashCandidates(draft).includes(
    row.content_hash,
  );
}

/**
 * 永続化済み rp_groups があればそれを返し、無ければ legacy free-text 行から
 * UNRESOLVED_TEXT へ読み替える(DOM-002 §4.2b。永続行は書き換えない)。
 */
function effectiveRpGroupsFromRow(
  row: MetadataRow,
  rows: readonly {
    sequence: number;
    drugText: string;
    usageText: string;
    days: number | null;
    quantityText: string;
  }[],
): unknown {
  if (Array.isArray(row.rp_groups) && row.rp_groups.length > 0) {
    return row.rp_groups;
  }
  return deriveRpGroupsFromLegacyRows(rows);
}

async function readDraft(
  client: PoolClient,
  input: PrescriptionDraftLookupInput,
  metadata?: MetadataRow,
): Promise<PrescriptionDraftResponse | undefined> {
  const row = metadata ?? (await selectMetadata(client, input, false));
  if (row === undefined) return undefined;
  if (!/^[a-f0-9]{64}$/u.test(row.content_hash)) {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }

  const rowsResult = await client.query<DraftRowRecord>(
    `SELECT row_sequence, drug_text, usage_text, days, quantity_text
       FROM prescription_draft_rows
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3
      ORDER BY row_sequence ASC`,
    [input.tenantId, input.pharmacyId, row.prescription_id],
  );
  const flagsResult = await client.query<DraftFlagRecord>(
    `SELECT flag
       FROM prescription_draft_flags
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
    [input.tenantId, input.pharmacyId, row.prescription_id],
  );

  try {
    const legacyRows = rowsResult.rows.map((draftRow) => ({
      sequence: draftRow.row_sequence,
      drugText: draftRow.drug_text,
      usageText: draftRow.usage_text,
      days: draftRow.days,
      quantityText: draftRow.quantity_text,
    }));
    const versionResult = await client.query<{ readonly max: number | null }>(
      `SELECT MAX(version) AS max
         FROM prescription_versions
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
      [input.tenantId, input.pharmacyId, row.prescription_id],
    );
    const response = prescriptionDraftResponseSchema.parse({
      prescriptionId: row.prescription_id,
      receptionId: row.reception_id,
      patientId: row.patient_id,
      businessDate: row.business_date,
      version: row.version,
      draft: {
        prescriptionType: row.prescription_type,
        prescriptionDate: row.prescription_date,
        defaultDays: row.default_days,
        flags: flagsResult.rows
          .map((flag) => flag.flag)
          .sort(comparePrescriptionDraftFlags),
        note: row.note,
        rows: legacyRows,
        sourceMetadata: sourceMetadataFromRow(row),
        rpGroups: effectiveRpGroupsFromRow(row, legacyRows),
      },
      createdAt: snapshotDatabaseInstant(
        row.created_at,
        prescriptionDraftDatabaseInvariantErrorMessage,
      ),
      updatedAt: snapshotDatabaseInstant(
        row.updated_at,
        prescriptionDraftDatabaseInvariantErrorMessage,
      ),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      status: row.status,
      confirmedBy: row.confirmed_by,
      confirmedAt:
        row.confirmed_at === null
          ? null
          : snapshotDatabaseInstant(
              row.confirmed_at,
              prescriptionDraftDatabaseInvariantErrorMessage,
            ),
      finalizedBy: row.finalized_by,
      finalizedAt:
        row.finalized_at === null
          ? null
          : snapshotDatabaseInstant(
              row.finalized_at,
              prescriptionDraftDatabaseInvariantErrorMessage,
            ),
      prescriptionVersion: versionResult.rows[0]?.max ?? null,
    });
    if (!storedHashMatches(row, response.draft)) {
      throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
    }
    return response;
  } catch {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }
}

// Internal; exported only for the DB-less DML-shape regression test.
export async function replaceChildren(
  client: PoolClient,
  input: PrescriptionDraftLookupInput,
  id: PrescriptionId,
  draft: PrescriptionDraftContent,
): Promise<void> {
  // DOM-002 §4.2b: prescription_draft_rows は読み専用。構造化移行済み draft の
  // 旧行は DELETE で掃除し、INSERT は行わない(migration 000019 が DB 側でも拒否)。
  await client.query(
    `DELETE FROM prescription_draft_rows
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
    [input.tenantId, input.pharmacyId, id],
  );
  await client.query(
    `DELETE FROM prescription_draft_flags
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3`,
    [input.tenantId, input.pharmacyId, id],
  );

  if (draft.flags.length > 0) {
    await client.query(
      `INSERT INTO prescription_draft_flags (
         tenant_id, pharmacy_id, prescription_id, flag
       )
       SELECT $1, $2, $3, flag FROM unnest($4::text[]) AS flag_values(flag)`,
      [input.tenantId, input.pharmacyId, id, [...draft.flags]],
    );
  }
}

export interface PostgresPrescriptionLifecycleDeps {
  /** 未注入なら confirm/finalize は常に unqualified(fail-closed)。 */
  readonly qualificationRepository?: PostgresActorQualificationRepository;
  readonly nextOutboxEventId?: () => string;
}

export class PostgresPrescriptionDraftService
  implements PrescriptionDraftService
{
  constructor(
    private readonly pool: Pool,
    private readonly nextPrescriptionId: () => PrescriptionId = () =>
      prescriptionId(`prescription-${randomUUID()}`),
    private readonly lifecycleDeps: PostgresPrescriptionLifecycleDeps = {},
  ) {}

  private async selectLifecycleRow(
    client: PoolClient,
    input: PrescriptionLifecycleCommandInput,
    forUpdate = true,
  ): Promise<MetadataRow | undefined> {
    const result = await client.query<MetadataRow>(
      `SELECT
         prescription_id,
         reception_id,
         patient_id,
         business_date::text AS business_date,
         version,
         prescription_type,
         prescription_date::text AS prescription_date,
         default_days,
         note,
         medical_institution_code,
         medical_institution_name,
         prescriber_name,
         issue_date::text AS issue_date,
         valid_until::text AS valid_until,
         refill_total,
         refill_remaining,
         split_dispensing,
         rp_groups,
         content_hash,
         status,
         confirmed_by,
         confirmed_at,
         finalized_by,
         finalized_at,
         confirm_idempotency_key,
         finalize_idempotency_key,
         created_at,
         updated_at,
         created_by,
         updated_by
       FROM prescription_drafts
       WHERE tenant_id = $1
         AND pharmacy_id = $2
         AND prescription_id = $3
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [input.tenantId, input.pharmacyId, input.prescriptionId],
    );
    if (result.rows.length > 1) {
      throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
    }
    return result.rows[0];
  }

  private lifecycleViewFromRow(
    row: MetadataRow,
    prescriptionVersion: number | null,
  ): PrescriptionLifecycleView {
    if (
      row.status === null ||
      row.confirmed_by === null ||
      row.confirmed_at === null
    ) {
      throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
    }
    return prescriptionLifecycleViewSchema.parse({
      prescriptionId: row.prescription_id,
      receptionId: row.reception_id,
      patientId: row.patient_id,
      prescriptionType: row.prescription_type,
      status: row.status,
      draftVersion: row.version,
      prescriptionVersion,
      contentHash: row.content_hash,
      confirmedBy: row.confirmed_by,
      confirmedAt: snapshotDatabaseInstant(
        row.confirmed_at,
        prescriptionDraftDatabaseInvariantErrorMessage,
      ),
      finalizedBy: row.finalized_by,
      finalizedAt:
        row.finalized_at === null
          ? null
          : snapshotDatabaseInstant(
              row.finalized_at,
              prescriptionDraftDatabaseInvariantErrorMessage,
            ),
    });
  }

  private async checkQualificationOrDeny(
    client: PoolClient,
    input: PrescriptionLifecycleCommandInput,
    denyEventType: "prescription.confirm.denied" | "prescription.finalize.denied",
  ): Promise<boolean> {
    const qualified =
      (await this.lifecycleDeps.qualificationRepository?.hasActiveQualificationWithinTransaction(
        client,
        {
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          actorId: input.actorId,
          kind: "PHARMACIST_LICENSE",
        },
      )) === true;
    if (qualified) return true;
    // SEC-010 §4: deny と監査は同一 tx。targetRef は prescription ID のみで、
    // 理由内訳・免許情報は payload に入れない。
    await appendAuditEventWithinTransaction(
      client,
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      {
        actorId: input.actorId,
        auditEventType: denyEventType,
        targetRef: { kind: "prescription", id: input.prescriptionId },
        outcome: "denied",
        wallClock: input.wallClock,
      },
    );
    return false;
  }

  /**
   * F-3/F-12 (R3 review): confirm は資格 → 受付 → draft の順でロックする
   * (finalize は draft 単一ロックのみで受付は掴まない)。save は
   * reception FOR NO KEY UPDATE → draft FOR UPDATE の順なので、confirm も
   * 受付を先に掴み逆行 deadlock を避ける。資格チェックを存在確認より先に
   * 行い、非資格 actor に scope 内存在を漏らさない(deny 監査は対象行の
   * 有無に関わらず同一 tx で残る)。
   */
  private async lockReceptionForLifecycle(
    client: PoolClient,
    input: PrescriptionLifecycleCommandInput,
    row: MetadataRow,
  ): Promise<string | undefined> {
    const reception = await client.query<{
      readonly reception_status: string;
    }>(
      `SELECT reception_status
         FROM reception_entries
        WHERE tenant_id = $1
          AND pharmacy_id = $2
          AND reception_id = $3
          AND business_date = $4::date
        FOR NO KEY UPDATE`,
      [
        input.tenantId,
        input.pharmacyId,
        row.reception_id,
        row.business_date,
      ],
    );
    return reception.rows[0]?.reception_status;
  }

  async confirm(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      if (
        !(await this.checkQualificationOrDeny(
          client,
          input,
          "prescription.confirm.denied",
        ))
      ) {
        await client.query("COMMIT");
        return { kind: "unqualified" };
      }

      // ロック対象(reception)を知るため無ロックで読み、直後に正順ロックする。
      const probe = await this.selectLifecycleRow(client, input, false);
      if (probe === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      // DOM-004 §2: confirm は受付 IN_PROGRESS のみ。lock 順は save と
      // 同じ reception→draft だが、status/replay 判定は draft lock 後に
      // 行う(packet guard 順: 遷移/replay → 受付状態 → 未解決 → metadata)。
      const receptionStatus = await this.lockReceptionForLifecycle(
        client,
        input,
        probe,
      );

      const row = await this.selectLifecycleRow(client, input);
      if (row === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      if (row.status === "PHARMACIST_CONFIRMED") {
        if (row.confirm_idempotency_key === input.idempotencyKey) {
          const view = this.lifecycleViewFromRow(row, null);
          await client.query("COMMIT");
          return { kind: "transitioned", view, replayed: true };
        }
        await client.query("ROLLBACK");
        return { kind: "invalid_transition" };
      }
      if (row.status !== null) {
        await client.query("ROLLBACK");
        return { kind: "invalid_transition" };
      }
      if (receptionStatus !== "IN_PROGRESS") {
        await client.query("ROLLBACK");
        return { kind: "reception_not_in_progress" };
      }

      const draft = await readDraft(client, {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        actorId: input.actorId,
        receptionId: receptionId(row.reception_id),
        businessDate: row.business_date,
        wallClock: input.wallClock,
      });
      if (draft === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      if (countUnresolvedPrescriptionItems(draft.draft) > 0) {
        await client.query("ROLLBACK");
        return { kind: "unresolved_items" };
      }
      if (!isPrescriptionSourceMetadataComplete(draft.draft)) {
        await client.query("ROLLBACK");
        return { kind: "metadata_incomplete" };
      }

      await client.query(
        `UPDATE prescription_drafts
            SET status = 'PHARMACIST_CONFIRMED',
                confirmed_by = $4,
                confirmed_at = $5::timestamptz,
                confirm_idempotency_key = $6,
                updated_at = GREATEST(updated_at, $5::timestamptz),
                updated_by = $4
          WHERE tenant_id = $1
            AND pharmacy_id = $2
            AND prescription_id = $3`,
        [
          input.tenantId,
          input.pharmacyId,
          input.prescriptionId,
          input.actorId,
          input.wallClock,
          input.idempotencyKey,
        ],
      );
      await appendAuditEventWithinTransaction(
        client,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.confirmed",
          targetRef: { kind: "prescription", id: input.prescriptionId },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      const updated = await this.selectLifecycleRow(client, input);
      if (updated === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      const view = this.lifecycleViewFromRow(updated, null);
      await client.query("COMMIT");
      return { kind: "transitioned", view, replayed: false };
    });
  }

  async finalize(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      if (
        !(await this.checkQualificationOrDeny(
          client,
          input,
          "prescription.finalize.denied",
        ))
      ) {
        await client.query("COMMIT");
        return { kind: "unqualified" };
      }

      const row = await this.selectLifecycleRow(client, input);
      if (row === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      if (row.status === "PRESCRIPTION_FINALIZED") {
        if (row.finalize_idempotency_key === input.idempotencyKey) {
          const versionResult = await client.query<{
            readonly version: number;
          }>(
            `SELECT version
               FROM prescription_versions
              WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3
              ORDER BY version DESC
              LIMIT 1`,
            [input.tenantId, input.pharmacyId, input.prescriptionId],
          );
          const view = this.lifecycleViewFromRow(
            row,
            versionResult.rows[0]?.version ?? null,
          );
          await client.query("COMMIT");
          return { kind: "transitioned", view, replayed: true };
        }
        await client.query("ROLLBACK");
        return { kind: "invalid_transition" };
      }
      if (row.status !== "PHARMACIST_CONFIRMED") {
        await client.query("ROLLBACK");
        return { kind: "invalid_transition" };
      }

      // 確定対象の再検証(trigger が内容不変を保証するが fail-closed で再評価)。
      const draft = await readDraft(client, {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        actorId: input.actorId,
        receptionId: receptionId(row.reception_id),
        businessDate: row.business_date,
        wallClock: input.wallClock,
      });
      if (draft === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      if (countUnresolvedPrescriptionItems(draft.draft) > 0) {
        await client.query("ROLLBACK");
        return { kind: "unresolved_items" };
      }
      if (!isPrescriptionSourceMetadataComplete(draft.draft)) {
        await client.query("ROLLBACK");
        return { kind: "metadata_incomplete" };
      }

      // version=1 immutable snapshot。content_hash は draft の確定対象 hash と
      // 一致(再計算せず永続値を採用 — readDraft で hash 照合済み)。
      await client.query(
        `INSERT INTO prescription_versions (
           tenant_id, pharmacy_id, prescription_id, version,
           content, content_hash,
           confirmed_by, confirmed_at, finalized_by, finalized_at, created_at
         ) VALUES (
           $1, $2, $3, 1,
           $4::jsonb, $5,
           $6, $7::timestamptz, $8, $9::timestamptz, $9
         )`,
        [
          input.tenantId,
          input.pharmacyId,
          input.prescriptionId,
          JSON.stringify(draft.draft),
          row.content_hash,
          row.confirmed_by,
          row.confirmed_at,
          input.actorId,
          input.wallClock,
        ],
      );
      await client.query(
        `UPDATE prescription_drafts
            SET status = 'PRESCRIPTION_FINALIZED',
                finalized_by = $4,
                finalized_at = $5::timestamptz,
                finalize_idempotency_key = $6,
                updated_at = GREATEST(updated_at, $5::timestamptz),
                updated_by = $4
          WHERE tenant_id = $1
            AND pharmacy_id = $2
            AND prescription_id = $3`,
        [
          input.tenantId,
          input.pharmacyId,
          input.prescriptionId,
          input.actorId,
          input.wallClock,
          input.idempotencyKey,
        ],
      );
      const auditEvent = await appendAuditEventWithinTransaction(
        client,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.finalized",
          targetRef: { kind: "prescription", id: input.prescriptionId },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      // MOD-009 §6: outbox intent は監査と同一 eventId 系・同一 tx。
      // payload は識別子+版のみ(patient_ref・本文禁止)。
      await client.query(
        `INSERT INTO outbox_events (
           tenant_id, pharmacy_id, outbox_event_id, event_type,
           aggregate_type, aggregate_id, audit_event_id, payload, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          input.tenantId,
          input.pharmacyId,
          this.lifecycleDeps.nextOutboxEventId?.() ?? randomUUID(),
          "prescription.finalized",
          "prescription",
          input.prescriptionId,
          auditEvent.eventId,
          JSON.stringify({ prescriptionId: input.prescriptionId, version: 1 }),
          input.wallClock,
        ],
      );
      const updated = await this.selectLifecycleRow(client, input);
      if (updated === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      const view = this.lifecycleViewFromRow(updated, 1);
      await client.query("COMMIT");
      return { kind: "transitioned", view, replayed: false };
    });
  }

  async get(
    input: PrescriptionDraftLookupInput,
  ): Promise<PrescriptionDraftLookupResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      // Audit append serializes by scope and must read the post-lock chain head.
      // READ COMMITTED gives that statement a fresh snapshot; REPEATABLE READ does not.
      const reception = await receptionMatches(client, input, false);
      if (reception === undefined) {
        await client.query("COMMIT");
        return { kind: "not_found" };
      }
      const draft = await readDraft(client, input);
      if (draft !== undefined && draft.patientId !== reception.patientId) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      if (draft !== undefined) {
        await appendAuditEventWithinTransaction(
          client,
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "prescription.draft.viewed",
            targetRef: { kind: "prescription", id: draft.prescriptionId },
            outcome: "success",
            wallClock: input.wallClock,
          },
        );
      }
      await client.query("COMMIT");
      return draft === undefined
        ? { kind: "empty" }
        : { kind: "found", draft };
    });
  }

  async save(
    input: PrescriptionDraftSaveInput,
  ): Promise<PrescriptionDraftSaveResult> {
    const { normalized, contentHash } =
      normalizePrescriptionDraftContentForStorage(input.draft);
    return runInPooledTransaction(this.pool, async (client) => {
      // Serializes all draft writers for the same verified reception row. This closes the
      // create/create race before either transaction decides that no draft exists while still
      // permitting unrelated receptions to proceed concurrently.
      if (
        (await receptionMatches(client, input, true, input.patientId)) ===
        undefined
      ) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      const existing = await selectMetadata(
        client,
        input,
        true,
        input.patientId,
      );
      if (existing === undefined) {
        if (input.expectedVersion !== 0) {
          await client.query("ROLLBACK");
          return { kind: "conflict", currentVersion: 0 };
        }
        const id = this.nextPrescriptionId();
        const sourceMetadata = normalized.sourceMetadata;
        await client.query(
          `INSERT INTO prescription_drafts (
             tenant_id, pharmacy_id, prescription_id, reception_id, patient_id,
             business_date, version, prescription_type,
             prescription_date, default_days, note, content_hash,
             medical_institution_code, medical_institution_name, prescriber_name,
             issue_date, valid_until, refill_total, refill_remaining,
             split_dispensing, rp_groups,
             created_at, updated_at, created_by, updated_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6::date, 1, $7,
             $8::date, $9, $10, $11,
             $14, $15, $16, $17::date, $18::date, $19, $20, $21, $22::jsonb,
             $12, $12, $13, $13
           )`,
          [
            input.tenantId,
            input.pharmacyId,
            id,
            input.receptionId,
            input.patientId,
            input.businessDate,
            normalized.prescriptionType,
            normalized.prescriptionDate,
            normalized.defaultDays,
            normalized.note,
            contentHash,
            input.wallClock,
            input.actorId,
            sourceMetadata?.medicalInstitution.code ?? null,
            sourceMetadata?.medicalInstitution.name ?? null,
            sourceMetadata?.prescriberName ?? null,
            sourceMetadata?.issueDate ?? null,
            sourceMetadata?.validUntil ?? null,
            sourceMetadata?.refill?.total ?? null,
            sourceMetadata?.refill?.remaining ?? null,
            sourceMetadata?.splitDispensing ?? null,
            JSON.stringify(normalized.rpGroups),
          ],
        );
        await replaceChildren(client, input, id, normalized);
        await appendAuditEventWithinTransaction(
          client,
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "prescription.created",
            targetRef: { kind: "prescription", id },
            outcome: "success",
            wallClock: input.wallClock,
          },
        );
        const response = await readDraft(client, input);
        if (response === undefined) {
          throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
        }
        await client.query("COMMIT");
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...response,
            saveDisposition: "created",
          }),
        };
      }

      const existingResponse = await readDraft(client, input, existing);
      if (existingResponse === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }

      // DOM-004 §1: 確認・確定後の content 改変は trigger でも拒否されるが、
      // route が 409 を返せるよう tx 内で先に明示判定する。
      if (existing.status !== null) {
        await client.query("ROLLBACK");
        return { kind: "locked" };
      }

      if (input.expectedVersion !== existing.version) {
        await client.query("ROLLBACK");
        return { kind: "conflict", currentVersion: existing.version };
      }

      if (storedHashMatches(existing, normalized)) {
        await client.query("COMMIT");
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...existingResponse,
            saveDisposition: "unchanged",
          }),
        };
      }

      if (existing.version >= 2_147_483_647) {
        throw new Error(prescriptionDraftVersionExhaustedErrorMessage);
      }
      const nextVersion = existing.version + 1;
      const nextSourceMetadata = normalized.sourceMetadata;
      await client.query(
        `UPDATE prescription_drafts
            SET version = $6,
                prescription_type = $7,
                prescription_date = $8::date,
                default_days = $9,
                note = $10,
                content_hash = $11,
                updated_at = GREATEST(updated_at, $12::timestamptz),
                updated_by = $13,
                medical_institution_code = $14,
                medical_institution_name = $15,
                prescriber_name = $16,
                issue_date = $17::date,
                valid_until = $18::date,
                refill_total = $19,
                refill_remaining = $20,
                split_dispensing = $21,
                rp_groups = $22::jsonb
          WHERE tenant_id = $1
            AND pharmacy_id = $2
            AND reception_id = $3
            AND patient_id = $4
            AND business_date = $5::date`,
        [
          input.tenantId,
          input.pharmacyId,
          input.receptionId,
          input.patientId,
          input.businessDate,
          nextVersion,
          normalized.prescriptionType,
          normalized.prescriptionDate,
          normalized.defaultDays,
          normalized.note,
          contentHash,
          input.wallClock,
          input.actorId,
          nextSourceMetadata?.medicalInstitution.code ?? null,
          nextSourceMetadata?.medicalInstitution.name ?? null,
          nextSourceMetadata?.prescriberName ?? null,
          nextSourceMetadata?.issueDate ?? null,
          nextSourceMetadata?.validUntil ?? null,
          nextSourceMetadata?.refill?.total ?? null,
          nextSourceMetadata?.refill?.remaining ?? null,
          nextSourceMetadata?.splitDispensing ?? null,
          JSON.stringify(normalized.rpGroups),
        ],
      );
      const id = prescriptionId(existing.prescription_id);
      await replaceChildren(client, input, id, normalized);
      await appendAuditEventWithinTransaction(
        client,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.updated",
          targetRef: { kind: "prescription", id },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      const response = await readDraft(client, input);
      if (response === undefined) {
        throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
      }
      await client.query("COMMIT");
      return {
        kind: "saved",
        draft: prescriptionDraftSaveResponseSchema.parse({
          ...response,
          saveDisposition: "updated",
        }),
      };
    });
  }
}
