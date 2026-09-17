import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftResponse,
} from "@yrese/contracts";
import {
  prescriptionId,
  type PrescriptionId,
} from "@yrese/shared-kernel";

import { appendAuditEventWithinTransaction } from "./audit-repository.js";
import { runInPooledTransaction } from "./pool.js";
import { snapshotDatabaseInstant } from "../instant.js";
import {
  comparePrescriptionDraftFlags,
  normalizePrescriptionDraftContentWithHash,
  prescriptionDraftContentHash,
  prescriptionDraftContentHashWithoutSourceMetadata,
  type PrescriptionDraftLookupInput,
  type PrescriptionDraftLookupResult,
  type PrescriptionDraftSaveInput,
  type PrescriptionDraftSaveResult,
  type PrescriptionDraftService,
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
  readonly content_hash: string;
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
       content_hash,
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

/** 行が WP-7205 以前の hash 形式(sourceMetadata キーなし)で保存されているか。 */
function isLegacySourceMetadataRow(row: MetadataRow): boolean {
  return row.issue_date === null;
}

function storedHashMatches(
  row: MetadataRow,
  draft: PrescriptionDraftContent,
): boolean {
  if (prescriptionDraftContentHash(draft) === row.content_hash) return true;
  if (!isLegacySourceMetadataRow(row) || draft.sourceMetadata !== null) {
    return false;
  }
  return (
    prescriptionDraftContentHashWithoutSourceMetadata(draft) ===
    row.content_hash
  );
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
        rows: rowsResult.rows.map((draftRow) => ({
          sequence: draftRow.row_sequence,
          drugText: draftRow.drug_text,
          usageText: draftRow.usage_text,
          days: draftRow.days,
          quantityText: draftRow.quantity_text,
        })),
        sourceMetadata: sourceMetadataFromRow(row),
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

  // One INSERT per child table; explicit array casts preserve nullable days.
  if (draft.rows.length > 0) {
    await client.query(
      `INSERT INTO prescription_draft_rows (
         tenant_id, pharmacy_id, prescription_id, row_sequence,
         drug_text, usage_text, days, quantity_text
       )
       SELECT $1, $2, $3, row_sequence, drug_text, usage_text, days, quantity_text
         FROM unnest(
           $4::int[], $5::text[], $6::text[], $7::int[], $8::text[]
         ) AS row_values(row_sequence, drug_text, usage_text, days, quantity_text)`,
      [
        input.tenantId,
        input.pharmacyId,
        id,
        draft.rows.map((row) => row.sequence),
        draft.rows.map((row) => row.drugText),
        draft.rows.map((row) => row.usageText),
        draft.rows.map((row) => row.days),
        draft.rows.map((row) => row.quantityText),
      ],
    );
  }
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

export class PostgresPrescriptionDraftService
  implements PrescriptionDraftService
{
  constructor(
    private readonly pool: Pool,
    private readonly nextPrescriptionId: () => PrescriptionId = () =>
      prescriptionId(`prescription-${randomUUID()}`),
  ) {}

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
      normalizePrescriptionDraftContentWithHash(input.draft);
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
             split_dispensing,
             created_at, updated_at, created_by, updated_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6::date, 1, $7,
             $8::date, $9, $10, $11,
             $14, $15, $16, $17::date, $18::date, $19, $20, $21,
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
                split_dispensing = $21
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
