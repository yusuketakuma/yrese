import { CalendarDate } from "@yrese/date-time";
import {
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isEligibilityMethodConsistent,
  isEligibilityTransitionAllowed,
  pharmacyId as parsePharmacyId,
  receptionId as parseReceptionId,
  tenantId as parseTenantId,
  type ReceptionEligibilityState,
} from "@yrese/shared-kernel";

import {
  deriveEligibilityState,
  EligibilityMethodError,
  EligibilityReceptionNotFoundError,
  EligibilitySnapshotConflictError,
  EligibilityTransitionError,
  type EligibilityScope,
  type EligibilitySnapshot,
  type EligibilitySnapshotRecordResult,
  type EligibilitySnapshotView,
  type ReceptionEligibility,
  type RecordEligibilitySnapshotInput,
} from "./db/eligibility-snapshot-repository.js";
import type { InMemoryReceptionRepository } from "./reception-repository.js";

export {
  deriveEligibilityState,
  EligibilityMethodError,
  EligibilityReceptionNotFoundError,
  EligibilitySnapshotConflictError,
  EligibilityTransitionError,
};
export type {
  EligibilityScope,
  EligibilitySnapshot,
  EligibilitySnapshotRecordResult,
  EligibilitySnapshotView,
  ReceptionEligibility,
  RecordEligibilitySnapshotInput,
};

/**
 * 資格スナップショット永続境界(API-019 / WP-7204)。
 * append-only。冪等再送は同一内容なら existing、snapshot_id の別内容衝突は
 * EligibilitySnapshotConflictError。受付不在は EligibilityReceptionNotFoundError
 * (route は 404 INS-0008 へ正規化する)。
 */
export interface EligibilitySnapshotRepository {
  recordForReception(
    scope: EligibilityScope,
    receptionId: string,
    input: RecordEligibilitySnapshotInput,
  ): Promise<EligibilitySnapshotRecordResult>;
  /**
   * GET 用の一括読出し: 受付の業務日付(business_date)で導出した現在状態と、
   * 同一患者の snapshot 履歴(sequence 降順)を返す。受付不在は not found。
   */
  viewForReception(
    scope: EligibilityScope,
    receptionId: string,
  ): Promise<EligibilitySnapshotView>;
  /** in-memory のみ。監査失敗時の補償(undo は record が発行した opaque 値)。 */
  rollbackEligibilityRecord?(undo: unknown): Promise<void> | void;
}

export function toReceptionEligibility(
  snapshot: EligibilitySnapshot | undefined,
  asOfDate: string,
): ReceptionEligibility {
  const state = deriveEligibilityState(snapshot, asOfDate);
  return Object.freeze({
    state,
    snapshotId: snapshot?.snapshotId ?? null,
    allowsProvisionalCalculation:
      allowsProvisionalCalculationForEligibility(state),
    allowsFinalCalculation: allowsFinalCalculationForEligibility(state),
  });
}

/**
 * in-memory reception repository との共有 store。reception 側は list/create の
 * queue entry 射影(API-006 0.3.2 の `eligibility`)導出に、eligibility 側は
 * 記録・履歴に使う。同じインスタンスを両リポジトリへ渡すこと。
 */
export interface InMemoryEligibilityStore {
  readonly snapshots: InMemoryEligibilitySnapshotRecord[];
  sequence: number;
}

export interface InMemoryEligibilitySnapshotRecord extends EligibilitySnapshot {
  readonly sequence: number;
}

export function createInMemoryEligibilityStore(): InMemoryEligibilityStore {
  return { snapshots: [], sequence: 0 };
}

/** queue entry 射影が参照する snapshot(紐づけ ID で検索)。 */
export function findLinkedSnapshot(
  store: InMemoryEligibilityStore,
  snapshotId: string | null | undefined,
): InMemoryEligibilitySnapshotRecord | undefined {
  if (snapshotId === null || snapshotId === undefined) {
    return undefined;
  }
  return store.snapshots.find(
    (snapshot) => snapshot.snapshotId === snapshotId,
  );
}

function businessDate(value: string, label: string): CalendarDate {
  try {
    return CalendarDate.fromString(value);
  } catch {
    throw new RangeError(`${label} must be a calendar date (YYYY-MM-DD)`);
  }
}

function cloneSnapshot(
  snapshot: InMemoryEligibilitySnapshotRecord,
): EligibilitySnapshot {
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    patientId: snapshot.patientId,
    verifiedMethod: snapshot.verifiedMethod,
    state: snapshot.state,
    verifiedAt: snapshot.verifiedAt,
    validFrom: snapshot.validFrom,
    validTo: snapshot.validTo,
  });
}

function snapshotEqualsInput(
  existing: InMemoryEligibilitySnapshotRecordInternal,
  input: RecordEligibilitySnapshotInput,
  patientId: string,
): boolean {
  return (
    existing.patientId === patientId &&
    existing.verifiedMethod === input.verifiedMethod &&
    existing.state === input.state &&
    existing.verifiedAt === input.verifiedAt.toISOString() &&
    existing.validFrom === input.validFrom &&
    existing.validTo === (input.validTo ?? null) &&
    existing.recordedBy === input.recordedBy &&
    existing.rawResponseRef === (input.rawResponseRef ?? null)
  );
}

/** undo の最小構造検証用(hostile 値を捨てるための形状)。 */
interface InMemoryEligibilityUndo {
  readonly snapshotId: string;
  readonly tenantId: string;
  readonly pharmacyId: string;
  readonly receptionId: string;
  readonly priorSnapshotId: string | null;
}

interface InMemoryEligibilitySnapshotRecordInternal
  extends InMemoryEligibilitySnapshotRecord {
  readonly recordedBy: string;
  readonly rawResponseRef: string | null;
}

/**
 * In-memory eligibility repository(WP-7204)。dev_headers 経路と route test で
 * Postgres 版と同じ append-only・冪等再送・遷移表検査・スコープ分離を再現する。
 * 受付の存在検査と eligibility link は InMemoryReceptionRepository の
 * 内部境界(eligibilityLink* メソッド)を通じて行い、監査失敗時は
 * rollbackEligibilityRecord で補償巻戻しする(Postgres は tx で原子化)。
 */
export class InMemoryEligibilitySnapshotRepository
  implements EligibilitySnapshotRepository
{
  constructor(
    private readonly receptions: InMemoryReceptionRepository,
    private readonly store: InMemoryEligibilityStore,
  ) {}

  recordForReception(
    scope: EligibilityScope,
    receptionIdValue: string,
    input: RecordEligibilitySnapshotInput,
  ): Promise<EligibilitySnapshotRecordResult> {
    if (!isEligibilityMethodConsistent(input.verifiedMethod, input.state)) {
      throw new EligibilityMethodError(input.verifiedMethod, input.state);
    }
    businessDate(input.validFrom, "validFrom");
    if (input.validTo !== undefined && input.validTo !== null) {
      if (businessDate(input.validTo, "validTo").compare(businessDate(input.validFrom, "validFrom")) < 0) {
        throw new RangeError("validTo must be on or after validFrom");
      }
    }
    businessDate(input.asOfDate, "asOfDate");

    const tenantIdValue = parseTenantId(scope.tenantId);
    const pharmacyIdValue = parsePharmacyId(scope.pharmacyId);
    const receptionId = parseReceptionId(receptionIdValue);

    const link = this.receptions.eligibilityLinkTarget({
      tenantId: tenantIdValue,
      pharmacyId: pharmacyIdValue,
      receptionId,
    });
    if (link === undefined) {
      throw new EligibilityReceptionNotFoundError();
    }

    // 冪等 retry: 当該受付に同一 snapshotId が紐づいていれば内容一致を確認して
    // existing で返す(Postgres 版と同じく全入力フィールド一致を要求)。
    const linked = findLinkedSnapshot(this.store, link.snapshotId) as
      | InMemoryEligibilitySnapshotRecordInternal
      | undefined;
    if (linked !== undefined && linked.snapshotId === input.snapshotId) {
      if (!snapshotEqualsInput(linked, input, link.patientId)) {
        throw new EligibilitySnapshotConflictError(input.snapshotId);
      }
      return Promise.resolve({
        kind: "existing",
        snapshot: cloneSnapshot(linked),
        undo: null,
      });
    }

    const from = deriveEligibilityState(linked, input.asOfDate);
    if (!isEligibilityTransitionAllowed(from, input.state)) {
      throw new EligibilityTransitionError(from, input.state);
    }

    const duplicate = this.store.snapshots.find(
      (snapshot) => snapshot.snapshotId === input.snapshotId,
    );
    if (duplicate !== undefined) {
      // 別受付(または未リンク)へ既に存在する snapshotId の別内容/同内容衝突。
      if (!snapshotEqualsInput(duplicate as InMemoryEligibilitySnapshotRecordInternal, input, link.patientId)) {
        throw new EligibilitySnapshotConflictError(input.snapshotId);
      }
      return Promise.resolve({
        kind: "existing",
        snapshot: cloneSnapshot(duplicate),
        undo: null,
      });
    }

    this.store.sequence += 1;
    const row: InMemoryEligibilitySnapshotRecordInternal = {
      snapshotId: input.snapshotId,
      patientId: link.patientId,
      verifiedMethod: input.verifiedMethod,
      state: input.state,
      verifiedAt: input.verifiedAt.toISOString(),
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      recordedBy: input.recordedBy,
      rawResponseRef: input.rawResponseRef ?? null,
      sequence: this.store.sequence,
    };
    this.store.snapshots.push(row);
    this.receptions.linkEligibilitySnapshot({
      tenantId: tenantIdValue,
      pharmacyId: pharmacyIdValue,
      receptionId,
      snapshotId: input.snapshotId,
    });

    const undo: InMemoryEligibilityUndo = {
      snapshotId: input.snapshotId,
      tenantId: tenantIdValue,
      pharmacyId: pharmacyIdValue,
      receptionId,
      priorSnapshotId: link.snapshotId,
    };
    return Promise.resolve({
      kind: "recorded",
      snapshot: cloneSnapshot(row),
      undo,
    });
  }

  rollbackEligibilityRecord(undo: unknown): void {
    if (undo === null || typeof undo !== "object") {
      return;
    }
    const data = undo as Partial<InMemoryEligibilityUndo>;
    if (
      typeof data.snapshotId !== "string" ||
      typeof data.tenantId !== "string" ||
      typeof data.pharmacyId !== "string" ||
      typeof data.receptionId !== "string" ||
      (data.priorSnapshotId !== null && typeof data.priorSnapshotId !== "string")
    ) {
      throw new RangeError("invalid eligibility undo data");
    }
    const index = this.store.snapshots.findIndex(
      (snapshot) => snapshot.snapshotId === data.snapshotId,
    );
    if (index >= 0) {
      this.store.snapshots.splice(index, 1);
    }
    this.receptions.restoreEligibilityLink({
      tenantId: parseTenantId(data.tenantId),
      pharmacyId: parsePharmacyId(data.pharmacyId),
      receptionId: parseReceptionId(data.receptionId),
      snapshotId: data.snapshotId,
      priorSnapshotId: data.priorSnapshotId ?? null,
    });
  }

  viewForReception(
    scope: EligibilityScope,
    receptionIdValue: string,
  ): Promise<EligibilitySnapshotView> {
    const link = this.receptions.eligibilityLinkTarget({
      tenantId: parseTenantId(scope.tenantId),
      pharmacyId: parsePharmacyId(scope.pharmacyId),
      receptionId: parseReceptionId(receptionIdValue),
    });
    if (link === undefined) {
      throw new EligibilityReceptionNotFoundError();
    }
    const snapshots = this.store.snapshots
      .filter((snapshot) => snapshot.patientId === link.patientId)
      .slice()
      .sort((a, b) => b.sequence - a.sequence)
      .map(cloneSnapshot);
    const current = toReceptionEligibility(
      findLinkedSnapshot(this.store, link.snapshotId),
      link.businessDate,
    );
    return Promise.resolve(
      Object.freeze({
        businessDate: link.businessDate,
        current,
        snapshots,
      }),
    );
  }
}
