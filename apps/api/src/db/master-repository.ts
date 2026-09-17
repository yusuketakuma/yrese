import type { Pool } from 'pg';
import {
  medicationItemSchema,
  usageItemSchema,
  type MasterVersion,
  type MedicationItem,
  type UsageItem,
} from '@yrese/contracts';
import { pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  snapshotMasterListCommand,
  type MasterListInput,
  type MasterListResult,
  type MasterRepository,
  type MasterVersionSeedInput,
  type MedicationItemSeedInput,
  type UsageItemSeedInput,
} from '../master-repository.js';
import { snapshotDatabaseInstant } from '../instant.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from './database-row.js';
import { runInPooledTransaction } from './pool.js';

export const databaseMasterRowInvariantErrorMessage =
  'Master database returned an invalid row';
export const databaseMasterRowSetInvariantErrorMessage =
  'Master database returned an invalid row set';

interface MasterVersionRow {
  readonly master_version_id: string;
  readonly master_kind: string;
  readonly version: string;
  readonly valid_from: string;
  readonly valid_to: string | null;
  readonly transition_note: string | null;
  readonly distribution_state: string;
}

interface MedicationItemRow {
  readonly medication_item_id: string;
  readonly local_code: string;
  readonly yj_code: string | null;
  readonly receipt_code: string | null;
  readonly hot_code: string | null;
  readonly name: string;
  readonly unit: string;
  readonly price: string | number | null;
  readonly generic_flag: string;
  readonly generic_name_code: string | null;
  readonly control_categories: string[];
}

interface UsageItemRow {
  readonly usage_item_id: string;
  readonly local_code: string;
  readonly text: string;
  readonly times_per_day: number | null;
  readonly meal_timing: string | null;
  readonly jahis_code: string | null;
}

const MASTER_VERSION_SELECT = `SELECT master_version_id, master_kind, version,
       valid_from::text AS valid_from, valid_to::text AS valid_to,
       transition_note, distribution_state
  FROM master_versions`;

const MEDICATION_ITEM_SELECT = `SELECT medication_item_id, local_code,
       yj_code, receipt_code, hot_code, name, unit, price, generic_flag,
       generic_name_code, control_categories
  FROM medication_items`;

const USAGE_ITEM_SELECT = `SELECT usage_item_id, local_code, text,
       times_per_day, meal_timing, jahis_code
  FROM usage_items`;

function readRowString(row: object, property: string): string {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    databaseMasterRowInvariantErrorMessage,
  );
  if (typeof value !== 'string') {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  return value;
}

function readRowNullableString(row: object, property: string): string | null {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    databaseMasterRowInvariantErrorMessage,
  );
  if (value !== null && typeof value !== 'string') {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  return value;
}

function readRowNullableNumber(row: object, property: string): number | null {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    databaseMasterRowInvariantErrorMessage,
  );
  if (value === null) return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric)) {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  return numeric;
}

function masterVersionRowToWire(row: MasterVersionRow): MasterVersion {
  const kind = readRowString(row, 'master_kind');
  if (kind !== 'medication' && kind !== 'usage') {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  const distributionState = readRowString(row, 'distribution_state');
  if (distributionState !== 'synthetic') {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  return {
    masterVersionId: readRowString(row, 'master_version_id'),
    masterKind: kind,
    version: readRowString(row, 'version'),
    validFrom: readRowString(row, 'valid_from'),
    validTo: readRowNullableString(row, 'valid_to'),
    transitionNote: readRowNullableString(row, 'transition_note'),
    distributionState,
  };
}

function medicationItemRowToWire(row: MedicationItemRow): MedicationItem {
  const rawCategories = readDatabaseRowOwnDataProperty(
    row,
    'control_categories',
    databaseMasterRowInvariantErrorMessage,
  );
  if (!Array.isArray(rawCategories)) {
    throw new Error(databaseMasterRowInvariantErrorMessage);
  }
  const priceRaw = readDatabaseRowOwnDataProperty(
    row,
    'price',
    databaseMasterRowInvariantErrorMessage,
  );
  const price =
    priceRaw === null
      ? null
      : typeof priceRaw === 'string' && /^-?\d+$/u.test(priceRaw)
        ? Number.parseInt(priceRaw, 10)
        : typeof priceRaw === 'number' && Number.isSafeInteger(priceRaw)
          ? priceRaw
          : (() => {
              throw new Error(databaseMasterRowInvariantErrorMessage);
            })();
  return medicationItemSchema.parse({
    medicationItemId: readRowString(row, 'medication_item_id'),
    localCode: readRowString(row, 'local_code'),
    yjCode: readRowNullableString(row, 'yj_code'),
    receiptCode: readRowNullableString(row, 'receipt_code'),
    hotCode: readRowNullableString(row, 'hot_code'),
    name: readRowString(row, 'name'),
    unit: readRowString(row, 'unit'),
    price,
    genericFlag: readRowString(row, 'generic_flag'),
    genericNameCode: readRowNullableString(row, 'generic_name_code'),
    controlCategories: rawCategories,
  });
}

function usageItemRowToWire(row: UsageItemRow): UsageItem {
  return usageItemSchema.parse({
    usageItemId: readRowString(row, 'usage_item_id'),
    localCode: readRowString(row, 'local_code'),
    text: readRowString(row, 'text'),
    timesPerDay: readRowNullableNumber(row, 'times_per_day'),
    mealTiming: readRowNullableString(row, 'meal_timing'),
    jahisCode: readRowNullableString(row, 'jahis_code'),
  });
}

/**
 * WP-7301/WP-7303: master の Postgres リポジトリ。GET は版解決 + 品目 SELECT を
 * 同一 REPEATABLE READ snapshot で読み、並行 seed/版追加によるずれを防ぐ
 * (coverage-repository の viewForPatient と同型)。
 */
export class PostgresMasterRepository implements MasterRepository {
  constructor(private readonly pool: Pool) {}

  async list(input: MasterListInput): Promise<MasterListResult> {
    const command = snapshotMasterListCommand(input);
    return runInPooledTransaction(this.pool, async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const versions = await client.query<MasterVersionRow>(
        `${MASTER_VERSION_SELECT}
         WHERE tenant_id = $1 AND pharmacy_id = $2 AND master_kind = $3
           AND valid_from <= $4::date
           AND (valid_to IS NULL OR $4::date < valid_to)
         ORDER BY valid_from DESC
         LIMIT 2`,
        [command.tenantId, command.pharmacyId, command.kind, command.asOf],
      );
      const versionRows = snapshotDatabaseQueryRows<MasterVersionRow>(
        versions,
        2,
        databaseMasterRowSetInvariantErrorMessage,
      );
      if (versionRows.length === 0) {
        await client.query('COMMIT');
        return { kind: 'no_version' };
      }
      // 有効期間の重複は append-only モデルで自然に起きる(旧版の valid_to を
      // 更新できないため)。解決は valid_from 最大の版で決定的
      // (in-memory の resolveVersion と同一規則)。
      const versionRow = versionRows[0];
      if (versionRow === undefined) {
        throw new Error(databaseMasterRowSetInvariantErrorMessage);
      }
      const version = masterVersionRowToWire(versionRow);
      if (command.kind === 'medication') {
        // q: localCode prefix / name substring。COLLATE "C" で code-point 比較
        // (in-memory の compareTextByCodePoints と parity)。
        const rows = await client.query<MedicationItemRow>(
          `${MEDICATION_ITEM_SELECT}
           WHERE tenant_id = $1 AND pharmacy_id = $2 AND master_version_id = $3
             AND ($4::text IS NULL OR $4 = ''
                  OR local_code LIKE ($4 || '%') COLLATE "C"
                  OR name LIKE ('%' || $4 || '%') COLLATE "C")
           ORDER BY local_code COLLATE "C" ASC`,
          [
            command.tenantId,
            command.pharmacyId,
            version.masterVersionId,
            command.q ?? null,
          ],
        );
        await client.query('COMMIT');
        return {
          kind: 'listed',
          masterVersion: version,
          items: Object.freeze(
            snapshotUnboundedDatabaseQueryRows<MedicationItemRow>(
              rows,
              databaseMasterRowSetInvariantErrorMessage,
            ).map(medicationItemRowToWire),
          ),
        };
      }
      const rows = await client.query<UsageItemRow>(
        `${USAGE_ITEM_SELECT}
         WHERE tenant_id = $1 AND pharmacy_id = $2 AND master_version_id = $3
           AND ($4::text IS NULL OR $4 = ''
                OR local_code LIKE ($4 || '%') COLLATE "C"
                OR text LIKE ('%' || $4 || '%') COLLATE "C")
         ORDER BY local_code COLLATE "C" ASC`,
        [
          command.tenantId,
          command.pharmacyId,
          version.masterVersionId,
          command.q ?? null,
        ],
      );
      await client.query('COMMIT');
      return {
        kind: 'listed',
        masterVersion: version,
        items: Object.freeze(
          snapshotUnboundedDatabaseQueryRows<UsageItemRow>(
            rows,
            databaseMasterRowSetInvariantErrorMessage,
          ).map(usageItemRowToWire),
        ),
      };
    });
  }

  async seedVersion(
    input: MasterVersionSeedInput,
  ): Promise<'recorded' | 'existing'> {
    // (tenant, pharmacy, kind, version) の一意性で冪等。既存時は skip。
    const result = await this.pool.query(
      `INSERT INTO master_versions
         (tenant_id, pharmacy_id, master_version_id, master_kind, version,
          valid_from, valid_to, transition_note, distribution_state,
          recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, 'synthetic', $9)
       ON CONFLICT ON CONSTRAINT master_versions_kind_version_uk
         DO NOTHING`,
      [
        input.tenantId,
        input.pharmacyId,
        input.masterVersionId,
        input.masterKind,
        input.version,
        input.validFrom,
        input.validTo ?? null,
        input.transitionNote ?? null,
        snapshotDatabaseInstant(
          input.recordedAt,
          databaseMasterRowInvariantErrorMessage,
        ),
      ],
    );
    return result.rowCount === 0 ? 'existing' : 'recorded';
  }

  async seedMedicationItem(
    input: MedicationItemSeedInput,
  ): Promise<'recorded' | 'existing'> {
    const item = medicationItemSchema.parse({
      medicationItemId: input.medicationItemId,
      localCode: input.localCode,
      yjCode: input.yjCode ?? null,
      receiptCode: input.receiptCode ?? null,
      hotCode: input.hotCode ?? null,
      name: input.name,
      unit: input.unit,
      price: input.price ?? null,
      genericFlag: input.genericFlag,
      genericNameCode: input.genericNameCode ?? null,
      controlCategories: input.controlCategories ?? [],
    });
    const result = await this.pool.query(
      `INSERT INTO medication_items
         (tenant_id, pharmacy_id, medication_item_id, master_version_id,
          local_code, yj_code, receipt_code, hot_code, name, unit, price,
          generic_flag, generic_name_code, control_categories)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT ON CONSTRAINT medication_items_local_code_uk DO NOTHING`,
      [
        input.tenantId,
        input.pharmacyId,
        item.medicationItemId,
        input.masterVersionId,
        item.localCode,
        item.yjCode,
        item.receiptCode,
        item.hotCode,
        item.name,
        item.unit,
        item.price,
        item.genericFlag,
        item.genericNameCode,
        item.controlCategories,
      ],
    );
    return result.rowCount === 0 ? 'existing' : 'recorded';
  }

  async seedUsageItem(
    input: UsageItemSeedInput,
  ): Promise<'recorded' | 'existing'> {
    const item = usageItemSchema.parse({
      usageItemId: input.usageItemId,
      localCode: input.localCode,
      text: input.text,
      timesPerDay: input.timesPerDay ?? null,
      mealTiming: input.mealTiming ?? null,
      jahisCode: input.jahisCode ?? null,
    });
    const result = await this.pool.query(
      `INSERT INTO usage_items
         (tenant_id, pharmacy_id, usage_item_id, master_version_id,
          local_code, text, times_per_day, meal_timing, jahis_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ON CONSTRAINT usage_items_local_code_uk DO NOTHING`,
      [
        input.tenantId,
        input.pharmacyId,
        item.usageItemId,
        input.masterVersionId,
        item.localCode,
        item.text,
        item.timesPerDay,
        item.mealTiming,
        item.jahisCode,
      ],
    );
    return result.rowCount === 0 ? 'existing' : 'recorded';
  }
}

export function createPostgresMasterRepository(pool: Pool): MasterRepository {
  return new PostgresMasterRepository(pool);
}

/** seed 入力の scope 文字列を brand する小ヘルパー(seed コード用)。 */
export function masterSeedScope(scope: {
  readonly tenantId: string;
  readonly pharmacyId: string;
}): { readonly tenantId: ReturnType<typeof tenantId>; readonly pharmacyId: ReturnType<typeof pharmacyId> } {
  return {
    tenantId: tenantId(scope.tenantId),
    pharmacyId: pharmacyId(scope.pharmacyId),
  };
}
