import type { PoolClient } from "pg";

import {
  deriveRpGroupsFromLegacyRows,
  prescriptionDraftResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftResponse,
} from "@yrese/contracts";

import { snapshotDatabaseInstant } from '../../instant.js';
import {
  comparePrescriptionDraftFlags,
  prescriptionDraftContentHashCandidates,
  type PrescriptionDraftLookupInput,
} from '../../prescription/prescription-draft-service.js';

export interface MetadataRow {
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
  readonly copied_from_prescription_id: string | null;
  readonly copied_from_version: number | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly created_by: string;
  readonly updated_by: string;
}

export interface DraftRowRecord {
  readonly row_sequence: number;
  readonly drug_text: string;
  readonly usage_text: string;
  readonly days: number | null;
  readonly quantity_text: string;
}

export interface DraftFlagRecord {
  readonly flag: string;
}

export const prescriptionDraftDatabaseInvariantErrorMessage =
  "Prescription draft database returned an invalid record";
export async function selectMetadata(
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
       copied_from_prescription_id,
       copied_from_version,
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

export async function receptionMatches(
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
export function sourceMetadataFromRow(row: MetadataRow) {
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

export function storedHashMatches(
  row: MetadataRow,
  draft: PrescriptionDraftContent,
): boolean {
  return prescriptionDraftContentHashCandidates(draft).includes(
    row.content_hash,
  );
}

/**
 * WP-7304: copied_from_* 列を wire へ戻す。000023 の CHECK が
 * 「両方 NULL または両方非 NULL」のみ許容するため、片方のみ NULL の
 * 行は不変条件違反として fail-closed にする。
 */
export function copiedFromFromRow(row: MetadataRow) {
  if (
    row.copied_from_prescription_id === null &&
    row.copied_from_version === null
  ) {
    return null;
  }
  if (
    row.copied_from_prescription_id === null ||
    row.copied_from_version === null
  ) {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }
  return {
    prescriptionId: row.copied_from_prescription_id,
    version: row.copied_from_version,
  };
}

/**
 * 永続化済み rp_groups があればそれを返し、無ければ legacy free-text 行から
 * UNRESOLVED_TEXT へ読み替える(DOM-002 §4.2b。永続行は書き換えない)。
 */
export function effectiveRpGroupsFromRow(
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

export async function readDraft(
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
      copiedFrom: copiedFromFromRow(row),
    });
    if (!storedHashMatches(row, response.draft)) {
      throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
    }
    return response;
  } catch {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }
}
