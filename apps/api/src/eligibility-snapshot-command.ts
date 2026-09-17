import type { AuditEvent } from '@yrese/audit';
import type {
  PharmacyId,
  RecordedEligibilityState,
  ReceptionId,
  TenantId,
  UserId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import type {
  EligibilitySnapshotRecordResult,
  EligibilitySnapshotRepository,
  RecordEligibilitySnapshotInput,
} from './eligibility-snapshot-repository.js';

/**
 * WP-7204: 資格確認スナップショット記録のコマンド境界(unit of work)。
 *
 * 「成功した記録は、正確に1件の durable な監査イベント(eligibility.verified /
 * eligibility.provisional_recorded)なしには durable であってはならない」を
 * 境界の不変条件とする(API-019 §4)。二相構成と補償の規律は受付遷移経路と同じ:
 * Postgres は execute 内の単一トランザクションで原子化し、in-memory は
 * evidence 失敗時に記録を巻き戻す。
 *
 * 冪等再送(existing)は監査を発火しない — 成功した新規記録と監査イベントの
 * 1:1 を守る(API-019 §2 / WP-4050 系の規律と同じ)。
 */

export const eligibilitySnapshotAggregateType = 'eligibility_snapshot';
export const insuranceViewedAuditEventType = 'insurance.viewed';

export type EligibilityRecordAuditEventType =
  | 'eligibility.verified'
  | 'eligibility.provisional_recorded';

/**
 * 記録状態 → 監査イベント種別の唯一の写像(API-019 §4 / MOD-008)。
 * route が手動記録不可の状態を 422 で排除するため、ここに到達するのは
 * VERIFIED_*(eligibility.verified)と PROVISIONAL_VISUAL
 * (eligibility.provisional_recorded)だけ — それでも写像は全状態で定義する。
 */
export function eligibilityRecordAuditEventType(
  state: RecordedEligibilityState,
): EligibilityRecordAuditEventType {
  return state === 'PROVISIONAL_VISUAL'
    ? 'eligibility.provisional_recorded'
    : 'eligibility.verified';
}

export interface EligibilityRecordCommandInput
  extends Omit<RecordEligibilitySnapshotInput, 'recordedBy'> {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  /** 認証 actor(API-019 §2: recorded_by は request body ではなく認証由来)。 */
  readonly recordedBy: UserId;
  /**
   * 監査 wallClock 供給者。recorded 経路でだけ、正確に1回読まれる
   * (existing / エラー経路で時計を読まない — 受付経路と同じ規律)。
   */
  readonly auditWallClock: () => string;
}

/** recorded 結果に監査証跡を添付した形(Postgres 原子経路の返り値)。 */
export type EligibilityRecordCommandResult =
  EligibilitySnapshotRecordResult & { readonly auditEvent?: AuditEvent };

export interface EnsureEligibilityRecordEvidenceInput {
  /** execute が返した結果オブジェクト(Postgres 実装が添付 evidence を読む)。 */
  readonly result: unknown;
  /** HTTP 層で検証済みの provenance(識別子のみ、PHI 非含有)。 */
  readonly provenance: {
    readonly tenantId: TenantId;
    readonly pharmacyId: PharmacyId;
    readonly snapshotId: string;
  };
  readonly auditEventType: EligibilityRecordAuditEventType;
  readonly actorId: UserId;
  readonly wallClock: string;
}

export interface EligibilityRecordCommand {
  /**
   * リポジトリ結果(または evidence 添付済み結果)の promise をそのまま返す。
   * 実装は結果値へ一切触れてはならず、async ラッパで再同化してもならない
   * (HTTP 層の単一 await・単一読取り規律を保存する)。
   */
  execute(
    input: EligibilityRecordCommandInput,
  ): Promise<EligibilityRecordCommandResult>;
  /**
   * recorded 結果の監査 evidence を確定し、監査結果の promise を
   * **加工せずに**返す。監査追記失敗は raw のまま reject させ、呼び出し側が
   * rollbackRecordEvidence で巻き戻す。
   */
  ensureRecordEvidence(
    input: EnsureEligibilityRecordEvidenceInput,
  ): Promise<unknown>;
  /** 監査追記失敗後の巻き戻し(in-memory のみ記録を復元)。 */
  rollbackRecordEvidence(undo: unknown): Promise<void> | void;
}

const eligibilityAuditAppendErrorInstances = new WeakSet<object>();

/** 監査追記失敗。 */
export class EligibilityAuditAppendError extends Error {
  constructor(cause: unknown) {
    super('eligibility audit append failed', { cause });
    this.name = 'EligibilityAuditAppendError';
    eligibilityAuditAppendErrorInstances.add(this);
  }
}

/** WeakSet 恒等判定(hostile な例外値へ触れない)。 */
export function isEligibilityAuditAppendError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    eligibilityAuditAppendErrorInstances.has(value)
  );
}

export interface ComposedEligibilityRecordCommandOptions {
  readonly eligibilitySnapshotRepository: EligibilitySnapshotRepository;
  readonly auditRepository: AuditRepository;
}

/**
 * 既存リポジトリ合成のコマンド実装(in-memory / dev / test)。
 * execute はリポジトリ結果へ一切触れない素通し。監査追記失敗時の巻き戻しは
 * repository の rollbackEligibilityRecord(あれば)に委譲する。
 */
export class ComposedEligibilityRecordCommand
  implements EligibilityRecordCommand
{
  private readonly repository: EligibilitySnapshotRepository;
  private readonly auditRepository: AuditRepository;

  constructor(options: ComposedEligibilityRecordCommandOptions) {
    this.repository = options.eligibilitySnapshotRepository;
    this.auditRepository = options.auditRepository;
  }

  execute(
    input: EligibilityRecordCommandInput,
  ): Promise<EligibilityRecordCommandResult> {
    return this.repository.recordForReception(
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      input.receptionId,
      {
        snapshotId: input.snapshotId,
        verifiedMethod: input.verifiedMethod,
        state: input.state,
        verifiedAt: input.verifiedAt,
        validFrom: input.validFrom,
        ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
        ...(input.rawResponseRef === undefined
          ? {}
          : { rawResponseRef: input.rawResponseRef }),
        recordedBy: input.recordedBy,
        now: input.now,
        asOfDate: input.asOfDate,
      },
    );
  }

  ensureRecordEvidence(
    input: EnsureEligibilityRecordEvidenceInput,
  ): Promise<unknown> {
    const scope = Object.freeze({
      tenantId: input.provenance.tenantId,
      pharmacyId: input.provenance.pharmacyId,
    });
    // 監査結果の promise を加工せずに返す(失敗時の巻き戻しは呼び出し側)。
    return this.auditRepository.record(
      scope,
      Object.freeze({
        actorId: input.actorId,
        auditEventType: input.auditEventType,
        targetRef: Object.freeze({
          kind: eligibilitySnapshotAggregateType,
          id: input.provenance.snapshotId,
        }),
        outcome: 'success' as const,
        wallClock: input.wallClock,
      }),
    );
  }

  rollbackRecordEvidence(undo: unknown): Promise<void> | void {
    return this.repository.rollbackEligibilityRecord?.(undo);
  }
}
