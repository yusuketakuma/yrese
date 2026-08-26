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
import { snapshotDatabaseInstant } from "../instant.js";
import {
  normalizePrescriptionDraftContent,
  prescriptionDraftContentHash,
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
  readonly lifecycle_status: string;
  readonly prescription_type: string;
  readonly prescription_date: string | null;
  readonly default_days: number | null;
  readonly note: string;
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
): Promise<MetadataRow | undefined> {
  const result = await client.query<MetadataRow>(
    `SELECT
       prescription_id,
       reception_id,
       patient_id,
       business_date::text AS business_date,
       version,
       lifecycle_status,
       prescription_type,
       prescription_date::text AS prescription_date,
       default_days,
       note,
       content_hash,
       created_at,
       updated_at,
       created_by,
       updated_by
     FROM prescription_drafts
     WHERE tenant_id = $1
       AND pharmacy_id = $2
       AND reception_id = $3
       AND patient_id = $4
       AND business_date = $5::date
     ${lock ? "FOR UPDATE" : ""}`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      input.patientId,
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
  lock: boolean,
): Promise<boolean> {
  const result = await client.query<{ readonly reception_id: string }>(
    `SELECT reception_id
       FROM reception_entries
      WHERE tenant_id = $1
        AND pharmacy_id = $2
        AND reception_id = $3
        AND patient_id = $4
        AND business_date = $5::date
      ${lock ? "FOR NO KEY UPDATE" : ""}`,
    [
      input.tenantId,
      input.pharmacyId,
      input.receptionId,
      input.patientId,
      input.businessDate,
    ],
  );
  return result.rows.length === 1;
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
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3
      ORDER BY CASE flag
        WHEN 'PACKAGING' THEN 1
        WHEN 'HOME_CARE' THEN 2
        WHEN 'NARCOTIC' THEN 3
        WHEN 'PSYCHOTROPIC' THEN 4
        WHEN 'LEFTOVER_ADJUSTMENT' THEN 5
        ELSE 99
      END`,
    [input.tenantId, input.pharmacyId, row.prescription_id],
  );

  try {
    return prescriptionDraftResponseSchema.parse({
      prescriptionId: row.prescription_id,
      receptionId: row.reception_id,
      patientId: row.patient_id,
      businessDate: row.business_date,
      version: row.version,
      lifecycleStatus: row.lifecycle_status,
      draft: {
        prescriptionType: row.prescription_type,
        prescriptionDate: row.prescription_date,
        defaultDays: row.default_days,
        flags: flagsResult.rows.map((flag) => flag.flag),
        note: row.note,
        rows: rowsResult.rows.map((draftRow) => ({
          sequence: draftRow.row_sequence,
          drugText: draftRow.drug_text,
          usageText: draftRow.usage_text,
          days: draftRow.days,
          quantityText: draftRow.quantity_text,
        })),
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
  } catch {
    throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
  }
}

async function replaceChildren(
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

  for (const row of draft.rows) {
    await client.query(
      `INSERT INTO prescription_draft_rows (
         tenant_id, pharmacy_id, prescription_id, row_sequence,
         drug_text, usage_text, days, quantity_text
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.tenantId,
        input.pharmacyId,
        id,
        row.sequence,
        row.drugText,
        row.usageText,
        row.days,
        row.quantityText,
      ],
    );
  }
  for (const flag of draft.flags) {
    await client.query(
      `INSERT INTO prescription_draft_flags (
         tenant_id, pharmacy_id, prescription_id, flag
       ) VALUES ($1, $2, $3, $4)`,
      [input.tenantId, input.pharmacyId, id, flag],
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
    const client = await this.pool.connect();
    let destroyClient = false;
    try {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      if (!(await receptionMatches(client, input, false))) {
        await client.query("COMMIT");
        return { kind: "not_found" };
      }
      const draft = await readDraft(client, input);
      await client.query("COMMIT");
      return draft === undefined
        ? { kind: "empty" }
        : { kind: "found", draft };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroyClient = true;
      }
      throw error;
    } finally {
      if (destroyClient) client.release(true);
      else client.release();
    }
  }

  async save(
    input: PrescriptionDraftSaveInput,
  ): Promise<PrescriptionDraftSaveResult> {
    const normalized = normalizePrescriptionDraftContent(input.draft);
    const contentHash = prescriptionDraftContentHash(normalized);
    const client = await this.pool.connect();
    let destroyClient = false;

    try {
      await client.query("BEGIN");
      // Serializes all draft writers for the same verified reception row. This closes the
      // create/create race before either transaction decides that no draft exists while still
      // permitting unrelated receptions to proceed concurrently.
      if (!(await receptionMatches(client, input, true))) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      const existing = await selectMetadata(client, input, true);
      if (existing === undefined) {
        if (input.expectedVersion !== 0) {
          await client.query("ROLLBACK");
          return { kind: "conflict", currentVersion: 0 };
        }
        const id = this.nextPrescriptionId();
        await client.query(
          `INSERT INTO prescription_drafts (
             tenant_id, pharmacy_id, prescription_id, reception_id, patient_id,
             business_date, version, lifecycle_status, prescription_type,
             prescription_date, default_days, note, content_hash,
             created_at, updated_at, created_by, updated_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6::date, 1, 'SERVER_SAVED', $7,
             $8::date, $9, $10, $11, $12, $12, $13, $13
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

      if (
        input.expectedVersion + 1 === existing.version &&
        existing.content_hash === contentHash
      ) {
        const response = await readDraft(client, input, existing);
        if (response === undefined) {
          throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
        }
        await client.query("COMMIT");
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...response,
            saveDisposition: "replayed",
          }),
        };
      }

      if (input.expectedVersion !== existing.version) {
        await client.query("ROLLBACK");
        return { kind: "conflict", currentVersion: existing.version };
      }

      if (existing.content_hash === contentHash) {
        const response = await readDraft(client, input, existing);
        if (response === undefined) {
          throw new Error(prescriptionDraftDatabaseInvariantErrorMessage);
        }
        await client.query("COMMIT");
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...response,
            saveDisposition: "unchanged",
          }),
        };
      }

      if (existing.version >= 2_147_483_647) {
        throw new Error(prescriptionDraftVersionExhaustedErrorMessage);
      }
      const nextVersion = existing.version + 1;
      await client.query(
        `UPDATE prescription_drafts
            SET version = $6,
                prescription_type = $7,
                prescription_date = $8::date,
                default_days = $9,
                note = $10,
                content_hash = $11,
                updated_at = $12,
                updated_by = $13
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
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroyClient = true;
      }
      throw error;
    } finally {
      if (destroyClient) client.release(true);
      else client.release();
    }
  }
}
