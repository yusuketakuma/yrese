import type { Pool, PoolClient } from 'pg';
import {
  insuranceCardSchema,
  publicExpenseSchema,
  type InsuranceCard,
  type PublicExpense,
} from '@yrese/contracts';

import {
  snapshotCoverageRecordCommand,
  snapshotCoverageViewCommand,
  type CoverageRecordInput,
  type CoverageRecordResult,
  type CoverageRepository,
  type CoverageViewInput,
  type CoverageViewResult,
  type InsuranceCardRegistrationFields,
  type PublicExpenseRegistrationFields,
} from '../coverage-repository.js';
import { snapshotDatabaseInstant } from '../instant.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from './database-row.js';
import { runInPooledTransaction } from './pool.js';

export const databaseCoverageRowInvariantErrorMessage =
  'Coverage database returned an invalid row';
export const databaseCoverageRowSetInvariantErrorMessage =
  'Coverage database returned an invalid row set';

interface InsuranceCardRow {
  readonly insurance_card_id: string;
  readonly insurer_number: string;
  readonly insured_symbol: string;
  readonly insured_number: string;
  readonly branch_number: string | null;
  readonly relationship: string;
  readonly copay_ratio: string | number;
  readonly valid_from: string;
  readonly valid_to: string | null;
  readonly superseded_by: string | null;
  readonly recorded_at: Date | string;
}

interface PublicExpenseRow {
  readonly public_expense_id: string;
  readonly payer_number: string;
  readonly recipient_number: string;
  readonly priority: number;
  readonly valid_from: string;
  readonly valid_to: string | null;
  readonly superseded_by: string | null;
  readonly recorded_at: Date | string;
}

function readRowString(
  row: object,
  property: string,
): string {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    databaseCoverageRowInvariantErrorMessage,
  );
  if (typeof value !== 'string') {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
  return value;
}

function readRowNullableString(row: object, property: string): string | null {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    databaseCoverageRowInvariantErrorMessage,
  );
  if (value !== null && typeof value !== 'string') {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
  return value;
}

function readCopayRatio(row: InsuranceCardRow): number {
  const value = readDatabaseRowOwnDataProperty(
    row,
    'copay_ratio',
    databaseCoverageRowInvariantErrorMessage,
  );
  // NUMERIC は string で返る。有限数へ変換し、schema が範囲を再検査する。
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
  return parsed;
}

function readRecordedAt(row: { readonly recorded_at: Date | string }): string {
  return snapshotDatabaseInstant(
    readDatabaseRowOwnDataProperty(
      row,
      'recorded_at',
      databaseCoverageRowInvariantErrorMessage,
    ),
    databaseCoverageRowInvariantErrorMessage,
  );
}

function insuranceCardRowToWire(row: InsuranceCardRow): InsuranceCard {
  try {
    return insuranceCardSchema.parse({
      insuranceCardId: readRowString(row, 'insurance_card_id'),
      insurerNumber: readRowString(row, 'insurer_number'),
      insuredSymbol: readRowString(row, 'insured_symbol'),
      insuredNumber: readRowString(row, 'insured_number'),
      ...(readRowNullableString(row, 'branch_number') === null
        ? {}
        : { branchNumber: readRowNullableString(row, 'branch_number') }),
      relationship: readRowString(row, 'relationship'),
      copayRatio: readCopayRatio(row),
      validFrom: readRowString(row, 'valid_from'),
      validTo: readRowNullableString(row, 'valid_to'),
      supersededBy: readRowNullableString(row, 'superseded_by'),
      recordedAt: readRecordedAt(row),
    });
  } catch {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
}

function publicExpenseRowToWire(row: PublicExpenseRow): PublicExpense {
  try {
    return publicExpenseSchema.parse({
      publicExpenseId: readRowString(row, 'public_expense_id'),
      payerNumber: readRowString(row, 'payer_number'),
      recipientNumber: readRowString(row, 'recipient_number'),
      priority: readDatabaseRowOwnDataProperty(
        row,
        'priority',
        databaseCoverageRowInvariantErrorMessage,
      ),
      validFrom: readRowString(row, 'valid_from'),
      validTo: readRowNullableString(row, 'valid_to'),
      supersededBy: readRowNullableString(row, 'superseded_by'),
      recordedAt: readRecordedAt(row),
    });
  } catch {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
}

const INSURANCE_CARD_SELECT = `
  SELECT c.insurance_card_id, c.insurer_number, c.insured_symbol,
         c.insured_number, c.branch_number, c.relationship, c.copay_ratio,
         c.valid_from::text AS valid_from, c.valid_to::text AS valid_to,
         (SELECT s.insurance_card_id FROM insurance_cards s
           WHERE s.tenant_id = c.tenant_id AND s.pharmacy_id = c.pharmacy_id
             AND s.supersedes_id = c.insurance_card_id) AS superseded_by,
         c.recorded_at
    FROM insurance_cards c`;

const PUBLIC_EXPENSE_SELECT = `
  SELECT e.public_expense_id, e.payer_number, e.recipient_number, e.priority,
         e.valid_from::text AS valid_from, e.valid_to::text AS valid_to,
         (SELECT s.public_expense_id FROM public_expense_certificates s
           WHERE s.tenant_id = e.tenant_id AND s.pharmacy_id = e.pharmacy_id
             AND s.supersedes_id = e.public_expense_id) AS superseded_by,
         e.recorded_at
    FROM public_expense_certificates e`;

async function patientExistsWithinTransaction(
  client: PoolClient,
  scope: { readonly tenantId: string; readonly pharmacyId: string; readonly patientId: string },
): Promise<boolean> {
  const result = await client.query(
    `SELECT patient_id FROM patients
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3`,
    [scope.tenantId, scope.pharmacyId, scope.patientId],
  );
  return snapshotDatabaseQueryRows<{ readonly patient_id: string }>(
    result,
    1,
    databaseCoverageRowSetInvariantErrorMessage,
  ).length === 1;
}

/**
 * WP-7203: POST /patients/{id}/coverage の永続化(監査は command 層が同一 tx)。
 *
 * ロック順序: patient 単位の advisory xact lock → patient 存在確認 →
 * 冪等参照 → supersede/overlap/priority 判定 → INSERT + 冪等記録。
 * append-only のため行ロックは不要(更新経路が存在しない)。
 */
export async function runCoverageRecordWithinTransaction(
  client: PoolClient,
  input: CoverageRecordInput,
): Promise<CoverageRecordResult> {
  const command = snapshotCoverageRecordCommand(input);
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3, 7203))`,
    [command.tenantId, command.pharmacyId, command.patientId],
  );

  if (!(await patientExistsWithinTransaction(client, command))) {
    return { kind: 'patient_not_found' };
  }

  const idempotency = await client.query<{
    request_fingerprint: string;
    result_kind: string;
    result_row_id: string;
  }>(
    `SELECT request_fingerprint, result_kind, result_row_id
       FROM coverage_create_idempotency
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3
        AND idempotency_key = $4`,
    [command.tenantId, command.pharmacyId, command.patientId, command.idempotencyKey],
  );
  const idempotencyRows = snapshotDatabaseQueryRows<{
    readonly request_fingerprint: string;
    readonly result_kind: string;
    readonly result_row_id: string;
  }>(
    idempotency,
    1,
    databaseCoverageRowSetInvariantErrorMessage,
  );
  const recorded = idempotencyRows[0];
  if (recorded !== undefined) {
    if (recorded.request_fingerprint !== command.requestFingerprint) {
      return { kind: 'idempotency_conflict' };
    }
    if (recorded.result_kind === 'insurance-card') {
      const result = await client.query<InsuranceCardRow>(
        `${INSURANCE_CARD_SELECT}
         WHERE c.tenant_id = $1 AND c.pharmacy_id = $2 AND c.patient_id = $3
           AND c.insurance_card_id = $4`,
        [command.tenantId, command.pharmacyId, command.patientId, recorded.result_row_id],
      );
      const rows = snapshotDatabaseQueryRows<InsuranceCardRow>(result, 1, databaseCoverageRowSetInvariantErrorMessage);
      const row = rows[0];
      if (row === undefined) {
        throw new Error(databaseCoverageRowInvariantErrorMessage);
      }
      return {
        kind: 'existing',
        entryKind: 'insurance-card',
        row: insuranceCardRowToWire(row),
      };
    }
    const result = await client.query<PublicExpenseRow>(
      `${PUBLIC_EXPENSE_SELECT}
       WHERE e.tenant_id = $1 AND e.pharmacy_id = $2 AND e.patient_id = $3
         AND e.public_expense_id = $4`,
      [command.tenantId, command.pharmacyId, command.patientId, recorded.result_row_id],
    );
    const rows = snapshotDatabaseQueryRows<PublicExpenseRow>(result, 1, databaseCoverageRowSetInvariantErrorMessage);
    const row = rows[0];
    if (row === undefined) {
      throw new Error(databaseCoverageRowInvariantErrorMessage);
    }
    return {
      kind: 'existing',
      entryKind: 'public-expense',
      row: publicExpenseRowToWire(row),
    };
  }

  const request = command.request;
  const entryKind = request.kind === 'supersede' ? request.targetKind : request.kind;
  const newValidFrom = request.validFrom;
  const newValidTo = request.validTo ?? null;

  let supersedeTargetId: string | null = null;
  if (request.kind === 'supersede') {
    const table =
      request.targetKind === 'insurance-card'
        ? 'insurance_cards'
        : 'public_expense_certificates';
    const idColumn =
      request.targetKind === 'insurance-card' ? 'insurance_card_id' : 'public_expense_id';
    const target = await client.query(
      `SELECT t.${idColumn} AS target_id,
              EXISTS (
                SELECT 1 FROM ${table} s
                 WHERE s.tenant_id = t.tenant_id AND s.pharmacy_id = t.pharmacy_id
                   AND s.supersedes_id = t.${idColumn}
              ) AS already_superseded
         FROM ${table} t
        WHERE t.tenant_id = $1 AND t.pharmacy_id = $2 AND t.patient_id = $3
          AND t.${idColumn} = $4`,
      [command.tenantId, command.pharmacyId, command.patientId, request.targetId],
    );
    const targetRows = snapshotDatabaseQueryRows<{
      readonly target_id: string;
      readonly already_superseded: boolean;
    }>(target, 1, databaseCoverageRowSetInvariantErrorMessage);
    const targetRow = targetRows[0];
    if (targetRow === undefined || targetRow.already_superseded) {
      return { kind: 'supersede_conflict' };
    }
    supersedeTargetId = request.targetId;
  }

  if (entryKind === 'insurance-card') {
    // 非 supersede 済み・supersede 対象行を除く既存行との期間重複(INS-0003)。
    const overlap = await client.query(
      `SELECT c.insurance_card_id
         FROM insurance_cards c
        WHERE c.tenant_id = $1 AND c.pharmacy_id = $2 AND c.patient_id = $3
          AND c.insurance_card_id <> COALESCE($6, '')
          AND c.valid_from < COALESCE($5::date, 'infinity'::date)
          AND $4::date < COALESCE(c.valid_to, 'infinity'::date)
          AND NOT EXISTS (
            SELECT 1 FROM insurance_cards s
             WHERE s.tenant_id = c.tenant_id AND s.pharmacy_id = c.pharmacy_id
               AND s.supersedes_id = c.insurance_card_id
          )
        LIMIT 1`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        newValidFrom,
        newValidTo,
        supersedeTargetId,
      ],
    );
    if (
      snapshotUnboundedDatabaseQueryRows<{ insurance_card_id: string }>(overlap, databaseCoverageRowSetInvariantErrorMessage)
        .length > 0
    ) {
      return { kind: 'period_overlap' };
    }
  } else {
    const fields = request as PublicExpenseRegistrationFields;
    const conflict = await client.query(
      `SELECT e.public_expense_id
         FROM public_expense_certificates e
        WHERE e.tenant_id = $1 AND e.pharmacy_id = $2 AND e.patient_id = $3
          AND e.public_expense_id <> COALESCE($6, '')
          AND e.priority = $7
          AND e.valid_from < COALESCE($5::date, 'infinity'::date)
          AND $4::date < COALESCE(e.valid_to, 'infinity'::date)
          AND NOT EXISTS (
            SELECT 1 FROM public_expense_certificates s
             WHERE s.tenant_id = e.tenant_id AND s.pharmacy_id = e.pharmacy_id
               AND s.supersedes_id = e.public_expense_id
          )
        LIMIT 1`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        newValidFrom,
        newValidTo,
        supersedeTargetId,
        fields.priority,
      ],
    );
    if (
      snapshotUnboundedDatabaseQueryRows<{ public_expense_id: string }>(conflict, databaseCoverageRowSetInvariantErrorMessage)
        .length > 0
    ) {
      return { kind: 'priority_conflict' };
    }
  }

  if (entryKind === 'insurance-card') {
    const fields = request as InsuranceCardRegistrationFields;
    const inserted = await client.query<InsuranceCardRow>(
      `INSERT INTO insurance_cards (
         tenant_id, pharmacy_id, patient_id, insurance_card_id,
         insurer_number, insured_symbol, insured_number, branch_number,
         relationship, copay_ratio, valid_from, valid_to, supersedes_id,
         recorded_at, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12::date, $13, $14, $15)
       RETURNING insurance_card_id, insurer_number, insured_symbol,
                 insured_number, branch_number, relationship, copay_ratio,
                 valid_from::text AS valid_from, valid_to::text AS valid_to,
                 NULL::text AS superseded_by, recorded_at`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        command.rowId,
        fields.insurerNumber,
        fields.insuredSymbol,
        fields.insuredNumber,
        fields.branchNumber ?? null,
        fields.relationship,
        fields.copayRatio,
        newValidFrom,
        newValidTo,
        supersedeTargetId,
        command.recordedAt,
        command.actorId,
      ],
    );
    const rows = snapshotDatabaseQueryRows<InsuranceCardRow>(inserted, 1, databaseCoverageRowSetInvariantErrorMessage);
    const row = rows[0];
    if (row === undefined) {
      throw new Error(databaseCoverageRowInvariantErrorMessage);
    }
    await client.query(
      `INSERT INTO coverage_create_idempotency (
         tenant_id, pharmacy_id, patient_id, idempotency_key,
         request_fingerprint, result_kind, result_row_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'insurance-card', $6, $7)`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        command.idempotencyKey,
        command.requestFingerprint,
        command.rowId,
        command.recordedAt,
      ],
    );
    return {
      kind: 'recorded',
      entryKind: 'insurance-card',
      row: insuranceCardRowToWire(row),
      undo: null,
    };
  }

  const fields = request as PublicExpenseRegistrationFields;
  const inserted = await client.query<PublicExpenseRow>(
    `INSERT INTO public_expense_certificates (
       tenant_id, pharmacy_id, patient_id, public_expense_id,
       payer_number, recipient_number, priority, valid_from, valid_to,
       supersedes_id, recorded_at, recorded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12)
     RETURNING public_expense_id, payer_number, recipient_number, priority,
               valid_from::text AS valid_from, valid_to::text AS valid_to,
               NULL::text AS superseded_by, recorded_at`,
    [
      command.tenantId,
      command.pharmacyId,
      command.patientId,
      command.rowId,
      fields.payerNumber,
      fields.recipientNumber,
      fields.priority,
      newValidFrom,
      newValidTo,
      supersedeTargetId,
      command.recordedAt,
      command.actorId,
    ],
  );
  const rows = snapshotDatabaseQueryRows<PublicExpenseRow>(inserted, 1, databaseCoverageRowSetInvariantErrorMessage);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(databaseCoverageRowInvariantErrorMessage);
  }
  await client.query(
    `INSERT INTO coverage_create_idempotency (
       tenant_id, pharmacy_id, patient_id, idempotency_key,
       request_fingerprint, result_kind, result_row_id, created_at
     ) VALUES ($1, $2, $3, $4, $5, 'public-expense', $6, $7)`,
    [
      command.tenantId,
      command.pharmacyId,
      command.patientId,
      command.idempotencyKey,
      command.requestFingerprint,
      command.rowId,
      command.recordedAt,
    ],
  );
  return {
    kind: 'recorded',
    entryKind: 'public-expense',
    row: publicExpenseRowToWire(row),
    undo: null,
  };
}

/**
 * WP-7203: coverage の Postgres リポジトリ。GET(asOf 時点の有効行)と
 * 裸の record(監査なし — 永続経路は PostgresCoverageCommand が束ねる)。
 */
export class PostgresCoverageRepository implements CoverageRepository {
  constructor(private readonly pool: Pool) {}

  async viewForPatient(input: CoverageViewInput): Promise<CoverageViewResult> {
    const command = snapshotCoverageViewCommand(input);
    // 存在確認と両表の SELECT を同一 REPEATABLE READ snapshot から読み、
    // 並行コミットによるテーブル間の時点ずれを防ぐ(in-memory の単一
    // snapshot との parity)。READ COMMITTED では文ごとに snapshot が
    // 更新されるため、tx に入った直後に分離レベルを引き上げる
    // (partner-registry の BEGIN ISOLATION LEVEL REPEATABLE READ と同義)。
    return runInPooledTransaction(this.pool, async (client) => {
      await client.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
      );
      const exists = await client.query(
        `SELECT patient_id FROM patients
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3`,
        [command.tenantId, command.pharmacyId, command.patientId],
      );
      if (
        snapshotDatabaseQueryRows<{ patient_id: string }>(exists, 1, databaseCoverageRowSetInvariantErrorMessage)
          .length === 0
      ) {
        await client.query('ROLLBACK');
        return { kind: 'patient_not_found' };
      }
      const cards = await client.query<InsuranceCardRow>(
        `${INSURANCE_CARD_SELECT}
         WHERE c.tenant_id = $1 AND c.pharmacy_id = $2 AND c.patient_id = $3
           AND c.valid_from <= $4::date
           AND (c.valid_to IS NULL OR $4::date < c.valid_to)
         ORDER BY c.insurance_card_id COLLATE "C" ASC`,
        [command.tenantId, command.pharmacyId, command.patientId, command.asOf],
      );
      const expenses = await client.query<PublicExpenseRow>(
        `${PUBLIC_EXPENSE_SELECT}
         WHERE e.tenant_id = $1 AND e.pharmacy_id = $2 AND e.patient_id = $3
           AND e.valid_from <= $4::date
           AND (e.valid_to IS NULL OR $4::date < e.valid_to)
         ORDER BY e.public_expense_id COLLATE "C" ASC`,
        [command.tenantId, command.pharmacyId, command.patientId, command.asOf],
      );
      await client.query('COMMIT');
      return {
        kind: 'listed',
        insuranceCards: Object.freeze(
          snapshotUnboundedDatabaseQueryRows<InsuranceCardRow>(cards, databaseCoverageRowSetInvariantErrorMessage).map(
            insuranceCardRowToWire,
          ),
        ),
        publicExpenses: Object.freeze(
          snapshotUnboundedDatabaseQueryRows<PublicExpenseRow>(expenses, databaseCoverageRowSetInvariantErrorMessage).map(
            publicExpenseRowToWire,
          ),
        ),
      };
    });
  }

  /** 裸の record(監査なし)。永続経路は PostgresCoverageCommand が束ねる。 */
  async record(input: CoverageRecordInput): Promise<CoverageRecordResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runCoverageRecordWithinTransaction(client, input);
      await client.query('COMMIT');
      return result;
    });
  }
}
