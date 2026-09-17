import {
  coverageListQuerySchema,
  coverageRecordRequestSchema,
  insuranceCardSchema,
  publicExpenseSchema,
  type InsuranceCard,
  type PublicExpense,
} from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  tenantId,
  userId,
  type PatientId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from './own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from './repository-command.js';
import { compareTextByCodePoints } from './text-order.js';

export const coverageRepositoryCommandSnapshotInvariantErrorMessage =
  'Coverage repository command snapshot is invalid';
export const coverageRepositoryResultInvariantErrorMessage =
  'Coverage repository returned an invalid row snapshot';
export const coverageRepositoryUndoInvariantErrorMessage =
  'Coverage repository rollback token is invalid';

/**
 * WP-7203 / API-020: 保険・公費(Coverage)永続境界。
 *
 * 不変条件:
 * - 両テーブルは append-only。訂正・失効は supersedes_id を持つ新規行。
 * - InsuranceCard は同一患者の非 supersede 済み行同士で有効期間が重ならない
 *   (同時有効な被保険者証は 1 枚)。PublicExpense は優先順位の重複を許さない
 *   (期間重複時のみ 409 — 期間が離れた同一順位は履歴として許容)。
 * - GET は asOf 時点で日付上有効な行だけを返す。supersede 済み行も日付条件を
 *   満たせば supersededBy マーカー付きで返す(API-020 §2 の有効定義は日付条件)。
 * - 監査 payload へ保険者番号・記号番号・受給者番号は載せない(呼出側規律)。
 */

export type CoverageEntryKind = 'insurance-card' | 'public-expense';

export interface CoverageScope {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
}

export interface CoverageViewInput extends CoverageScope {
  readonly asOf: string;
}

export type CoverageViewResult =
  | {
      readonly kind: 'listed';
      readonly insuranceCards: readonly InsuranceCard[];
      readonly publicExpenses: readonly PublicExpense[];
    }
  | { readonly kind: 'patient_not_found' };

export interface CoverageRecordInput extends CoverageScope {
  /** サーバー採番の行 ID(command 実装が生成・検証済みで受け取る)。 */
  readonly rowId: string;
  readonly request: CoverageRequestSnapshot;
  readonly idempotencyKey: string;
  /** 正規化 request の fingerprint(同一 key + 異なる payload の検出用)。 */
  readonly requestFingerprint: string;
  readonly actorId: UserId;
  readonly recordedAt: string;
}

/** zod パース済みの POST ボディ(snapshot 検証で再検査される)。 */
export type CoverageRequestSnapshot =
  | ({ readonly kind: 'insurance-card' } & InsuranceCardRegistrationFields)
  | ({ readonly kind: 'public-expense' } & PublicExpenseRegistrationFields)
  | ({
      readonly kind: 'supersede';
      readonly targetKind: 'insurance-card';
      readonly targetId: string;
    } & InsuranceCardRegistrationFields)
  | ({
      readonly kind: 'supersede';
      readonly targetKind: 'public-expense';
      readonly targetId: string;
    } & PublicExpenseRegistrationFields);

export interface InsuranceCardRegistrationFields {
  readonly insurerNumber: string;
  readonly insuredSymbol: string;
  readonly insuredNumber: string;
  readonly branchNumber?: string | undefined;
  readonly relationship: 'self' | 'family';
  readonly copayRatio: number;
  readonly validFrom: string;
  readonly validTo?: string | null | undefined;
}

export interface PublicExpenseRegistrationFields {
  readonly payerNumber: string;
  readonly recipientNumber: string;
  readonly priority: number;
  readonly validFrom: string;
  readonly validTo?: string | null | undefined;
}

export type CoverageRecordResult =
  | {
      readonly kind: 'recorded';
      readonly entryKind: CoverageEntryKind;
      readonly row: InsuranceCard | PublicExpense;
      /** 補償識別子(in-memory の巻き戻し用。Postgres は tx で巻き戻す)。 */
      readonly undo: unknown;
    }
  | {
      readonly kind: 'existing';
      readonly entryKind: CoverageEntryKind;
      readonly row: InsuranceCard | PublicExpense;
    }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'patient_not_found' }
  | { readonly kind: 'period_overlap' }
  | { readonly kind: 'priority_conflict' }
  | { readonly kind: 'supersede_conflict' };

export interface CoverageRepository {
  viewForPatient(input: CoverageViewInput): Promise<CoverageViewResult>;
  record(input: CoverageRecordInput): Promise<CoverageRecordResult>;
}

/** 患者存在照会(cross-scope は false — 存在非開示)。 */
export type CoveragePatientLookup = (scope: CoverageScope) => Promise<boolean>;

function ownReadValue(read: OwnDataPropertyRead): unknown {
  return read.present ? read.value : undefined;
}

function snapshotScopePatientId(result: OwnDataPropertyRead): PatientId {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  try {
    return patientId(result.value);
  } catch {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
}

function snapshotCoverageActorId(result: OwnDataPropertyRead): UserId {
  if (!result.present || typeof result.value !== 'string' || result.value === '') {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  try {
    return userId(result.value);
  } catch {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
}

function snapshotCoverageRecordedAt(result: OwnDataPropertyRead): string {
  if (!result.present || typeof result.value !== 'string' || result.value === '') {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  if (!Number.isFinite(new Date(result.value).getTime())) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return result.value;
}

function snapshotCoverageRowId(result: OwnDataPropertyRead): string {
  if (!result.present || typeof result.value !== 'string' || result.value === '') {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const parsed = insuranceCardSchema.shape.insuranceCardId.safeParse(result.value);
  if (!parsed.success) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return parsed.data;
}

export function snapshotCoverageViewCommand(input: unknown): CoverageViewInput {
  const readProperty = createOwnDataPropertyReader(
    input,
    coverageRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const asOf = coverageListQuerySchema.shape.asOf.safeParse(
    ownReadValue(readProperty('asOf')),
  );
  if (!asOf.success) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return Object.freeze({
    tenantId: snapshotRepositoryTenantId(
      readProperty('tenantId'),
      coverageRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    pharmacyId: snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      coverageRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    patientId: snapshotScopePatientId(readProperty('patientId')),
    asOf: asOf.data,
  });
}

/** POST /coverage 入力の防御的 snapshot(accessor/継承/Proxy 排除 + 再検証)。 */
export function snapshotCoverageRecordCommand(input: unknown): CoverageRecordInput {
  const readProperty = createOwnDataPropertyReader(
    input,
    coverageRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const requestRead = readProperty('request');
  if (!requestRead.present) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const request = coverageRecordRequestSchema.safeParse(requestRead.value);
  if (!request.success) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const keyRead = readProperty('idempotencyKey');
  if (
    !keyRead.present ||
    typeof keyRead.value !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/u.test(keyRead.value)
  ) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const fingerprintRead = readProperty('requestFingerprint');
  if (
    !fingerprintRead.present ||
    typeof fingerprintRead.value !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(fingerprintRead.value)
  ) {
    throw new Error(coverageRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return Object.freeze({
    tenantId: snapshotRepositoryTenantId(
      readProperty('tenantId'),
      coverageRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    pharmacyId: snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      coverageRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    patientId: snapshotScopePatientId(readProperty('patientId')),
    rowId: snapshotCoverageRowId(readProperty('rowId')),
    request: request.data,
    idempotencyKey: keyRead.value,
    requestFingerprint: fingerprintRead.value,
    actorId: snapshotCoverageActorId(readProperty('actorId')),
    recordedAt: snapshotCoverageRecordedAt(readProperty('recordedAt')),
  });
}

interface StoredInsuranceCardRow extends Omit<InsuranceCard, 'supersededBy'> {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
  readonly supersedesId: string | null;
}

interface StoredPublicExpenseRow extends Omit<PublicExpense, 'supersededBy'> {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
  readonly supersedesId: string | null;
}

interface StoredCoverageIdempotency {
  readonly requestFingerprint: string;
  readonly entryKind: CoverageEntryKind;
  readonly rowId: string;
}

function isDateValidAt(
  row: { readonly validFrom: string; readonly validTo: string | null },
  asOf: string,
): boolean {
  return row.validFrom <= asOf && (row.validTo === null || asOf < row.validTo);
}

function periodsOverlap(
  a: { readonly validFrom: string; readonly validTo: string | null },
  b: { readonly validFrom: string; readonly validTo: string | null },
): boolean {
  // [validFrom, validTo) 半開区間の重なり。validTo null は無期限。
  // '9999-12-31' は wire 上有効な暦日(ドメイン内)なので sentinel には使えず、
  // null を「無限大」として直接扱う(Postgres 'infinity' と同義)。
  return (
    (b.validTo === null || a.validFrom < b.validTo) &&
    (a.validTo === null || b.validFrom < a.validTo)
  );
}

function requestPeriod(request: CoverageRequestSnapshot): {
  readonly validFrom: string;
  readonly validTo: string | null;
} {
  return {
    validFrom: request.validFrom,
    validTo: request.validTo ?? null,
  };
}

function toWireCard(
  row: StoredInsuranceCardRow,
  supersededBy: string | null,
): InsuranceCard {
  return insuranceCardSchema.parse({
    insuranceCardId: row.insuranceCardId,
    insurerNumber: row.insurerNumber,
    insuredSymbol: row.insuredSymbol,
    insuredNumber: row.insuredNumber,
    ...(row.branchNumber === undefined
      ? {}
      : { branchNumber: row.branchNumber }),
    relationship: row.relationship,
    copayRatio: row.copayRatio,
    validFrom: row.validFrom,
    validTo: row.validTo,
    supersededBy,
    recordedAt: row.recordedAt,
  });
}

function toWirePublicExpense(
  row: StoredPublicExpenseRow,
  supersededBy: string | null,
): PublicExpense {
  return publicExpenseSchema.parse({
    publicExpenseId: row.publicExpenseId,
    payerNumber: row.payerNumber,
    recipientNumber: row.recipientNumber,
    priority: row.priority,
    validFrom: row.validFrom,
    validTo: row.validTo,
    supersededBy,
    recordedAt: row.recordedAt,
  });
}

/**
 * in-memory 実装(dev/test)。Postgres 実装(runCoverageRecordWithinTransaction)と
 * 同一の判定順・同一の収束状態を持つ。監査失敗時は rollbackRecorded が
 * 挿入行と冪等記録を同一性ベースで除去する。
 */
export class InMemoryCoverageRepository implements CoverageRepository {
  private readonly cards: StoredInsuranceCardRow[] = [];
  private readonly expenses: StoredPublicExpenseRow[] = [];
  private readonly idempotency = new Map<string, StoredCoverageIdempotency>();
  private readonly patientExists: CoveragePatientLookup;

  constructor(options: {
    readonly patientExists: CoveragePatientLookup;
  }) {
    this.patientExists = options.patientExists;
  }

  private idempotencyStoreKey(scope: CoverageScope, key: string): string {
    // NUL 区切り: branded ID に空白が許容されるため空文字区切りでは衝突する。
    return [
      scope.tenantId,
      scope.pharmacyId,
      scope.patientId,
      key,
    ].join(String.fromCharCode(0));
  }

  private inScope<T extends StoredInsuranceCardRow | StoredPublicExpenseRow>(
    rows: readonly T[],
    scope: CoverageScope,
  ): T[] {
    return rows.filter(
      (row) =>
        row.tenantId === scope.tenantId &&
        row.pharmacyId === scope.pharmacyId &&
        row.patientId === scope.patientId,
    );
  }

  /** supersede された行 → それを supersede した行の ID(導出値)。 */
  private supersededCardBy(scope: CoverageScope): Map<string, string> {
    const map = new Map<string, string>();
    for (const row of this.inScope(this.cards, scope)) {
      if (row.supersedesId !== null) map.set(row.supersedesId, row.insuranceCardId);
    }
    return map;
  }

  private supersededExpenseBy(scope: CoverageScope): Map<string, string> {
    const map = new Map<string, string>();
    for (const row of this.inScope(this.expenses, scope)) {
      if (row.supersedesId !== null) map.set(row.supersedesId, row.publicExpenseId);
    }
    return map;
  }

  async viewForPatient(input: CoverageViewInput): Promise<CoverageViewResult> {
    const command = snapshotCoverageViewCommand(input);
    if (!(await this.patientExists(command))) {
      return { kind: 'patient_not_found' };
    }
    const cardSupersededBy = this.supersededCardBy(command);
    const expenseSupersededBy = this.supersededExpenseBy(command);
    // asOf 時点で日付上有効な行(API-020 §2 の有効定義は日付条件)。
    // supersede 済み行は supersededBy マーカー付きで返す(訂正経路の可視化)。
    const cards = this.inScope(this.cards, command)
      .filter((row) => isDateValidAt(row, command.asOf))
      .sort((a, b) => compareTextByCodePoints(a.insuranceCardId, b.insuranceCardId))
      .map((row) =>
        toWireCard(row, cardSupersededBy.get(row.insuranceCardId) ?? null),
      );
    const expenses = this.inScope(this.expenses, command)
      .filter((row) => isDateValidAt(row, command.asOf))
      .sort((a, b) => compareTextByCodePoints(a.publicExpenseId, b.publicExpenseId))
      .map((row) =>
        toWirePublicExpense(
          row,
          expenseSupersededBy.get(row.publicExpenseId) ?? null,
        ),
      );
    return Object.freeze({
      kind: 'listed',
      insuranceCards: Object.freeze(cards),
      publicExpenses: Object.freeze(expenses),
    });
  }

  async record(input: CoverageRecordInput): Promise<CoverageRecordResult> {
    const command = snapshotCoverageRecordCommand(input);
    if (!(await this.patientExists(command))) {
      return { kind: 'patient_not_found' };
    }

    const recorded = this.idempotency.get(
      this.idempotencyStoreKey(command, command.idempotencyKey),
    );
    if (recorded !== undefined) {
      if (recorded.requestFingerprint !== command.requestFingerprint) {
        return { kind: 'idempotency_conflict' };
      }
      const existingRow =
        recorded.entryKind === 'insurance-card'
          ? this.inScope(this.cards, command).find(
              (row) => row.insuranceCardId === recorded.rowId,
            )
          : this.inScope(this.expenses, command).find(
              (row) => row.publicExpenseId === recorded.rowId,
            );
      if (existingRow === undefined) {
        throw new Error(coverageRepositoryResultInvariantErrorMessage);
      }
      const supersededBy =
        recorded.entryKind === 'insurance-card'
          ? (this.supersededCardBy(command).get(recorded.rowId) ?? null)
          : (this.supersededExpenseBy(command).get(recorded.rowId) ?? null);
      return {
        kind: 'existing',
        entryKind: recorded.entryKind,
        row:
          recorded.entryKind === 'insurance-card'
            ? toWireCard(existingRow as StoredInsuranceCardRow, supersededBy)
            : toWirePublicExpense(
                existingRow as StoredPublicExpenseRow,
                supersededBy,
              ),
      };
    }

    const request = command.request;
    const entryKind: CoverageEntryKind =
      request.kind === 'supersede' ? request.targetKind : request.kind;
    const period = requestPeriod(request);

    let supersedeTargetId: string | null = null;
    if (request.kind === 'supersede') {
      const targetRows =
        request.targetKind === 'insurance-card'
          ? this.inScope(this.cards, command)
          : this.inScope(this.expenses, command);
      const targetIdKey =
        request.targetKind === 'insurance-card'
          ? 'insuranceCardId'
          : 'publicExpenseId';
      const target = targetRows.find(
        (row) => row[targetIdKey as keyof typeof row] === request.targetId,
      );
      const alreadySuperseded =
        request.targetKind === 'insurance-card'
          ? this.supersededCardBy(command).has(request.targetId)
          : this.supersededExpenseBy(command).has(request.targetId);
      if (target === undefined || alreadySuperseded) {
        return { kind: 'supersede_conflict' };
      }
      supersedeTargetId = request.targetId;
    }

    if (entryKind === 'insurance-card') {
      const superseded = this.supersededCardBy(command);
      const overlap = this.inScope(this.cards, command).some(
        (row) =>
          !superseded.has(row.insuranceCardId) &&
          row.insuranceCardId !== supersedeTargetId &&
          periodsOverlap(row, period),
      );
      if (overlap) {
        return { kind: 'period_overlap' };
      }
    } else {
      const superseded = this.supersededExpenseBy(command);
      const fields = request as PublicExpenseRegistrationFields;
      const conflict = this.inScope(this.expenses, command).some(
        (row) =>
          !superseded.has(row.publicExpenseId) &&
          row.publicExpenseId !== supersedeTargetId &&
          row.priority === fields.priority &&
          periodsOverlap(row, period),
      );
      if (conflict) {
        return { kind: 'priority_conflict' };
      }
    }

    if (entryKind === 'insurance-card') {
      const fields = request as InsuranceCardRegistrationFields;
      const row: StoredInsuranceCardRow = {
        tenantId: command.tenantId,
        pharmacyId: command.pharmacyId,
        patientId: command.patientId,
        insuranceCardId: command.rowId,
        insurerNumber: fields.insurerNumber,
        insuredSymbol: fields.insuredSymbol,
        insuredNumber: fields.insuredNumber,
        ...(fields.branchNumber === undefined
          ? {}
          : { branchNumber: fields.branchNumber }),
        relationship: fields.relationship,
        copayRatio: fields.copayRatio,
        validFrom: period.validFrom,
        validTo: period.validTo,
        recordedAt: command.recordedAt,
        supersedesId: supersedeTargetId,
      };
      this.cards.push(Object.freeze(row) as StoredInsuranceCardRow);
      this.idempotency.set(
        this.idempotencyStoreKey(command, command.idempotencyKey),
        Object.freeze({
          requestFingerprint: command.requestFingerprint,
          entryKind,
          rowId: command.rowId,
        }),
      );
      return {
        kind: 'recorded',
        entryKind,
        row: toWireCard(row, null),
        undo: Object.freeze({ entryKind, row, idempotencyKey: command.idempotencyKey, scope: command }),
      };
    }

    const fields = request as PublicExpenseRegistrationFields;
    const row: StoredPublicExpenseRow = {
      tenantId: command.tenantId,
      pharmacyId: command.pharmacyId,
      patientId: command.patientId,
      publicExpenseId: command.rowId,
      payerNumber: fields.payerNumber,
      recipientNumber: fields.recipientNumber,
      priority: fields.priority,
      validFrom: period.validFrom,
      validTo: period.validTo,
      recordedAt: command.recordedAt,
      supersedesId: supersedeTargetId,
    };
    this.expenses.push(Object.freeze(row) as StoredPublicExpenseRow);
    this.idempotency.set(
      this.idempotencyStoreKey(command, command.idempotencyKey),
      Object.freeze({
        requestFingerprint: command.requestFingerprint,
        entryKind,
        rowId: command.rowId,
      }),
    );
    return {
      kind: 'recorded',
      entryKind,
      row: toWirePublicExpense(row, null),
      undo: Object.freeze({ entryKind, row, idempotencyKey: command.idempotencyKey, scope: command }),
    };
  }

  /** 監査失敗時の補償: 挿入行と冪等記録を同一性ベースで除去する。 */
  rollbackRecorded(undo: unknown): void {
    const readProperty = createOwnDataPropertyReader(
      undo,
      coverageRepositoryUndoInvariantErrorMessage,
    );
    const rowRead = readProperty('row');
    const keyRead = readProperty('idempotencyKey');
    const scopeRead = readProperty('scope');
    const kindRead = readProperty('entryKind');
    if (
      !rowRead.present ||
      !keyRead.present ||
      !scopeRead.present ||
      !kindRead.present ||
      typeof keyRead.value !== 'string' ||
      (kindRead.value !== 'insurance-card' && kindRead.value !== 'public-expense')
    ) {
      throw new Error(coverageRepositoryUndoInvariantErrorMessage);
    }
    const store =
      kindRead.value === 'insurance-card' ? this.cards : this.expenses;
    const index = store.lastIndexOf(
      rowRead.value as StoredInsuranceCardRow & StoredPublicExpenseRow,
    );
    if (index < 0) {
      throw new Error(coverageRepositoryUndoInvariantErrorMessage);
    }
    store.splice(index, 1);
    this.idempotency.delete(
      this.idempotencyStoreKey(
        scopeRead.value as CoverageScope,
        keyRead.value,
      ),
    );
  }
}
