import {
  masterQuerySchema,
  medicationItemSchema,
  usageItemSchema,
  type MasterKind,
  type MasterVersion,
  type MedicationItem,
  type UsageItem,
} from '@yrese/contracts';
import {
  pharmacyId,
  tenantId,
  type PharmacyId,
  type TenantId,
} from '@yrese/shared-kernel';

import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from './own-data-property.js';
import { snapshotRepositoryPharmacyId } from './repository-command.js';
import { snapshotRepositoryTenantId } from './repository-command.js';
import { compareTextByCodePoints } from './text-order.js';

export const masterRepositoryCommandSnapshotInvariantErrorMessage =
  'Master repository command snapshot is invalid';
export const masterRepositoryResultInvariantErrorMessage =
  'Master repository returned an invalid row snapshot';

/**
 * WP-7301/WP-7303 / MST-003: master 基盤永続境界。non-PHI。
 *
 * 不変条件:
 * - append-only。version 引継ぎは新規 master_versions 行のみ。UPDATE/DELETE
 *   経路は存在しない(Postgres は trigger で拒否)。
 * - 版解決は呼出側が渡す明示 asOf。「今日」等の暗黙解決は行わない(MOD-011)。
 * - asOf に有効な版が無い場合は 200 {masterVersion: null, items: []}
 *   (no_version)。404 は将来の版単位 lookup(MST-0002)用に予約。
 * - q: localCode は prefix match、name/text は substring match。case-sensitive、
 *   code-point 比較(Postgres COLLATE "C" と parity)。上限 100 文字。
 * - seed は repository 経路のみ。既存 version/localCode は skip(冪等)。
 * - synthetic seed の localCode は `SYN-` 接頭辞を必須とする。
 */

export interface MasterScope {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
}

export interface MasterListInput extends MasterScope {
  readonly kind: MasterKind;
  readonly asOf: string;
  readonly q?: string | undefined;
}

export type MasterListResult =
  | {
      readonly kind: 'listed';
      readonly masterVersion: MasterVersion;
      readonly items: readonly (MedicationItem | UsageItem)[];
    }
  | { readonly kind: 'no_version' };

export interface MasterVersionSeedInput extends MasterScope {
  readonly masterVersionId: string;
  readonly masterKind: MasterKind;
  readonly version: string;
  readonly validFrom: string;
  readonly validTo?: string | null | undefined;
  readonly transitionNote?: string | null | undefined;
  readonly recordedAt: string;
}

export interface MedicationItemSeedInput extends MasterScope {
  readonly medicationItemId: string;
  readonly masterVersionId: string;
  readonly localCode: string;
  readonly yjCode?: string | null | undefined;
  readonly receiptCode?: string | null | undefined;
  readonly hotCode?: string | null | undefined;
  readonly name: string;
  readonly unit: string;
  readonly price?: number | null | undefined;
  readonly genericFlag: MedicationItem['genericFlag'];
  readonly genericNameCode?: string | null | undefined;
  readonly controlCategories?: readonly string[] | undefined;
}

export interface UsageItemSeedInput extends MasterScope {
  readonly usageItemId: string;
  readonly masterVersionId: string;
  readonly localCode: string;
  readonly text: string;
  readonly timesPerDay?: number | null | undefined;
  readonly mealTiming?: UsageItem['mealTiming'] | undefined;
  readonly jahisCode?: string | null | undefined;
}

export interface MasterRepository {
  list(input: MasterListInput): Promise<MasterListResult>;
  /** seed 専用 append。同一 (kind, version) 既存時は skip。 */
  seedVersion(input: MasterVersionSeedInput): Promise<'recorded' | 'existing'>;
  /** seed 専用 append。同一 (versionId, localCode) 既存時は skip。 */
  seedMedicationItem(
    input: MedicationItemSeedInput,
  ): Promise<'recorded' | 'existing'>;
  seedUsageItem(input: UsageItemSeedInput): Promise<'recorded' | 'existing'>;
}

function ownReadValue(read: OwnDataPropertyRead): unknown {
  return read.present ? read.value : undefined;
}

export function snapshotMasterListCommand(input: unknown): MasterListInput {
  const readProperty = createOwnDataPropertyReader(
    input,
    masterRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const kindRead = readProperty('kind');
  const kindParsed = (
    (v: unknown): MasterKind => {
      if (v !== 'medication' && v !== 'usage') {
        throw new Error(masterRepositoryCommandSnapshotInvariantErrorMessage);
      }
      return v;
    }
  )(kindRead.present ? kindRead.value : undefined);
  const asOf = masterQuerySchema.shape.asOf.safeParse(
    ownReadValue(readProperty('asOf')),
  );
  if (!asOf.success) {
    throw new Error(masterRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const qRead = readProperty('q');
  let q: string | undefined;
  if (qRead.present && qRead.value !== undefined) {
    const parsed = masterQuerySchema.shape.q.safeParse(qRead.value);
    if (!parsed.success) {
      throw new Error(masterRepositoryCommandSnapshotInvariantErrorMessage);
    }
    q = parsed.data;
  }
  return Object.freeze({
    tenantId: snapshotRepositoryTenantId(
      readProperty('tenantId'),
      masterRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    pharmacyId: snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      masterRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    kind: kindParsed,
    asOf: asOf.data,
    ...(q === undefined ? {} : { q }),
  });
}

interface StoredMasterVersionRow {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly masterVersionId: string;
  readonly masterKind: MasterKind;
  readonly version: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly transitionNote: string | null;
  readonly recordedAt: string;
}

interface StoredMedicationItemRow extends MedicationItem {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly masterVersionId: string;
}

interface StoredUsageItemRow extends UsageItem {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly masterVersionId: string;
}

function toWireVersion(row: StoredMasterVersionRow): MasterVersion {
  return {
    masterVersionId: row.masterVersionId,
    masterKind: row.masterKind,
    version: row.version,
    validFrom: row.validFrom,
    validTo: row.validTo,
    transitionNote: row.transitionNote,
    distributionState: 'synthetic',
  };
}

function toWireMedicationItem(row: StoredMedicationItemRow): MedicationItem {
  return medicationItemSchema.parse({
    medicationItemId: row.medicationItemId,
    localCode: row.localCode,
    yjCode: row.yjCode,
    receiptCode: row.receiptCode,
    hotCode: row.hotCode,
    name: row.name,
    unit: row.unit,
    price: row.price,
    genericFlag: row.genericFlag,
    genericNameCode: row.genericNameCode,
    controlCategories: row.controlCategories,
  });
}

function toWireUsageItem(row: StoredUsageItemRow): UsageItem {
  return usageItemSchema.parse({
    usageItemId: row.usageItemId,
    localCode: row.localCode,
    text: row.text,
    timesPerDay: row.timesPerDay,
    mealTiming: row.mealTiming,
    jahisCode: row.jahisCode,
  });
}

/**
 * in-memory 実装(dev/test)。Postgres 実装と同一の版解決・q マッチ・
 * 順序(localCode code-point)を持つ。
 */
export class InMemoryMasterRepository implements MasterRepository {
  private readonly versions: StoredMasterVersionRow[] = [];
  private readonly medications: StoredMedicationItemRow[] = [];
  private readonly usages: StoredUsageItemRow[] = [];

  private inScopeVersions(scope: MasterScope): StoredMasterVersionRow[] {
    return this.versions.filter(
      (row) =>
        row.tenantId === scope.tenantId && row.pharmacyId === scope.pharmacyId,
    );
  }

  /** asOf 時点で有効な版: valid_from <= asOf AND (valid_to IS NULL OR valid_to > asOf)。複数該当時は valid_from 最大。 */
  private resolveVersion(
    scope: MasterScope,
    kind: MasterKind,
    asOf: string,
  ): StoredMasterVersionRow | undefined {
    const candidates = this.inScopeVersions(scope).filter(
      (row) =>
        row.masterKind === kind &&
        row.validFrom <= asOf &&
        (row.validTo === null || row.validTo > asOf),
    );
    let selected: StoredMasterVersionRow | undefined;
    for (const row of candidates) {
      if (selected === undefined || row.validFrom > selected.validFrom) {
        selected = row;
      }
    }
    return selected;
  }

  async list(input: MasterListInput): Promise<MasterListResult> {
    const command = snapshotMasterListCommand(input);
    const version = this.resolveVersion(command, command.kind, command.asOf);
    if (version === undefined) {
      return { kind: 'no_version' };
    }
    const q = command.q;
    if (command.kind === 'medication') {
      const items = this.medications
        .filter(
          (row) =>
            row.tenantId === command.tenantId &&
            row.pharmacyId === command.pharmacyId &&
            row.masterVersionId === version.masterVersionId,
        )
        .filter(
          (row) =>
            q === undefined ||
            q === '' ||
            row.localCode.startsWith(q) ||
            row.name.includes(q),
        )
        .sort((a, b) => compareTextByCodePoints(a.localCode, b.localCode))
        .map(toWireMedicationItem);
      return {
        kind: 'listed',
        masterVersion: toWireVersion(version),
        items: Object.freeze(items),
      };
    }
    const items = this.usages
      .filter(
        (row) =>
          row.tenantId === command.tenantId &&
          row.pharmacyId === command.pharmacyId &&
          row.masterVersionId === version.masterVersionId,
      )
      .filter(
        (row) =>
          q === undefined ||
          q === '' ||
          row.localCode.startsWith(q) ||
          row.text.includes(q),
      )
      .sort((a, b) => compareTextByCodePoints(a.localCode, b.localCode))
      .map(toWireUsageItem);
    return {
      kind: 'listed',
      masterVersion: toWireVersion(version),
      items: Object.freeze(items),
    };
  }

  async seedVersion(
    input: MasterVersionSeedInput,
  ): Promise<'recorded' | 'existing'> {
    const scope = {
      tenantId: tenantId(input.tenantId),
      pharmacyId: pharmacyId(input.pharmacyId),
    };
    const existing = this.inScopeVersions(scope).find(
      (row) => row.masterKind === input.masterKind && row.version === input.version,
    );
    if (existing !== undefined) {
      return 'existing';
    }
    this.versions.push(
      Object.freeze({
        ...scope,
        masterVersionId: input.masterVersionId,
        masterKind: input.masterKind,
        version: input.version,
        validFrom: input.validFrom,
        validTo: input.validTo ?? null,
        transitionNote: input.transitionNote ?? null,
        recordedAt: input.recordedAt,
      }),
    );
    return 'recorded';
  }

  async seedMedicationItem(
    input: MedicationItemSeedInput,
  ): Promise<'recorded' | 'existing'> {
    const exists = this.medications.some(
      (row) =>
        row.tenantId === input.tenantId &&
        row.pharmacyId === input.pharmacyId &&
        row.masterVersionId === input.masterVersionId &&
        row.localCode === input.localCode,
    );
    if (exists) {
      return 'existing';
    }
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
    this.medications.push(
      Object.freeze({
        ...item,
        tenantId: tenantId(input.tenantId),
        pharmacyId: pharmacyId(input.pharmacyId),
        masterVersionId: input.masterVersionId,
      }),
    );
    return 'recorded';
  }

  async seedUsageItem(
    input: UsageItemSeedInput,
  ): Promise<'recorded' | 'existing'> {
    const exists = this.usages.some(
      (row) =>
        row.tenantId === input.tenantId &&
        row.pharmacyId === input.pharmacyId &&
        row.masterVersionId === input.masterVersionId &&
        row.localCode === input.localCode,
    );
    if (exists) {
      return 'existing';
    }
    this.usages.push(
      Object.freeze({
        tenantId: tenantId(input.tenantId),
        pharmacyId: pharmacyId(input.pharmacyId),
        masterVersionId: input.masterVersionId,
        ...usageItemSchema.parse({
          usageItemId: input.usageItemId,
          localCode: input.localCode,
          text: input.text,
          timesPerDay: input.timesPerDay ?? null,
          mealTiming: input.mealTiming ?? null,
          jahisCode: input.jahisCode ?? null,
        }),
      }),
    );
    return 'recorded';
  }
}
