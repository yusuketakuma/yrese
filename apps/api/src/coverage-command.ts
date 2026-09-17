import { createHash } from 'node:crypto';

import type { AuditEvent } from '@yrese/audit';
import type { InsuranceCard, PublicExpense } from '@yrese/contracts';
import type { TenantId, PharmacyId, UserId, PatientId } from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import {
  InMemoryCoverageRepository,
  type CoverageEntryKind,
  type CoverageRecordInput,
  type CoverageRepository,
} from './coverage-repository.js';

/**
 * WP-7203: 保険・公費(Coverage)登録のコマンド境界(unit of work)。
 *
 * 不変条件:
 * - 「記録された coverage 行は、正確に 1 件の durable な insurance.updated
 *   監査なしには durable であってはならない」。
 * - Postgres 実装は単一トランザクションで原子化し、in-memory は監査失敗時に
 *   補償(rollbackRecorded)で同じ収束状態へ戻す。
 * - 監査 payload は識別子と kind のみ。保険者番号・記号番号・受給者番号等の
 *   資格内容は監査・ログ・エラー応答へ出さない(API-020 §2)。
 * - GET の insurance.viewed 監査は route 層が担う(WP-7204 と同型)。
 */

export const coverageUpdatedAuditEventType = 'insurance.updated';
export const coverageCommandAggregateType = 'coverage';

const coverageAuditAppendErrorInstances = new WeakSet<object>();

/** 監査追記失敗。hostile な失敗値を検査しない WeakSet 恒等判定。 */
export class CoverageAuditAppendError extends Error {
  constructor(cause: unknown) {
    super('coverage audit append failed', { cause });
    this.name = 'CoverageAuditAppendError';
    coverageAuditAppendErrorInstances.add(this);
  }
}

export function isCoverageAuditAppendError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    coverageAuditAppendErrorInstances.has(value)
  );
}

/** POST /coverage の冪等判定 fingerprint(正規化 request の sha256)。 */
export function coverageRecordRequestFingerprint(
  request: CoverageRecordInput['request'],
): string {
  return createHash('sha256')
    .update(JSON.stringify(request), 'utf8')
    .digest('hex');
}

export interface CoverageRecordCommandInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
  readonly request: CoverageRecordInput['request'];
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly actorId: UserId;
  /** ISO instant。recorded_at と監査 wallClock の基準。 */
  readonly recordedAt: string;
  readonly auditWallClock: () => string;
  /** サーバー採番の行 ID(recorded 経路でだけ読まれる)。 */
  readonly mintRowId: () => string;
}

export type CoverageRecordCommandResult =
  | {
      readonly kind: 'recorded';
      readonly entryKind: CoverageEntryKind;
      readonly row: InsuranceCard | PublicExpense;
      readonly undo: unknown;
      readonly auditEvent: unknown;
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

export interface CoverageRecordCommand {
  recordCoverage(
    input: CoverageRecordCommandInput,
  ): Promise<CoverageRecordCommandResult>;
}

export interface ComposedCoverageRecordCommandOptions {
  readonly coverageRepository: CoverageRepository;
  readonly auditRepository: AuditRepository;
  /** 監査失敗時の補償(in-memory unit of work 用)。 */
  readonly compensateRecorded?: (undo: unknown) => void | Promise<void>;
}

/**
 * 既存リポジトリ合成のコマンド実装(in-memory / dev / test)。
 * repo.record → insurance.updated 監査。監査失敗は補償で行を巻き戻す。
 */
export class ComposedCoverageRecordCommand implements CoverageRecordCommand {
  private readonly coverageRepository: CoverageRepository;
  private readonly auditRepository: AuditRepository;
  private readonly compensateRecorded:
    | ((undo: unknown) => void | Promise<void>)
    | undefined;

  constructor(options: ComposedCoverageRecordCommandOptions) {
    this.coverageRepository = options.coverageRepository;
    this.auditRepository = options.auditRepository;
    this.compensateRecorded = options.compensateRecorded;
  }

  async recordCoverage(
    input: CoverageRecordCommandInput,
  ): Promise<CoverageRecordCommandResult> {
    const scope = Object.freeze({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
    });
    const result = await this.coverageRepository.record({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      patientId: input.patientId,
      rowId: input.mintRowId(),
      request: input.request,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      actorId: input.actorId,
      recordedAt: input.recordedAt,
    });
    if (result.kind !== 'recorded') {
      return result;
    }

    let auditEvent: AuditEvent;
    try {
      auditEvent = (await this.auditRepository.record(scope, {
        actorId: input.actorId,
        auditEventType: coverageUpdatedAuditEventType,
        targetRef: Object.freeze({
          kind: coverageCommandAggregateType,
          id: `${result.entryKind}:${coverageRowId(result)}`,
        }),
        outcome: 'success',
        wallClock: input.auditWallClock(),
      })) as AuditEvent;
    } catch (error) {
      try {
        await this.compensateRecorded?.(result.undo);
      } catch {
        // 補償自体の失敗も同じ 500 に吸収(状態は fail-visible)。
      }
      throw new CoverageAuditAppendError(error);
    }
    return { ...result, auditEvent };
  }
}

/** recorded 行の wire ID(PHI なしの識別子)。 */
export function coverageRowId(result: {
  readonly entryKind: CoverageEntryKind;
  readonly row: InsuranceCard | PublicExpense;
}): string {
  return 'insuranceCardId' in result.row
    ? result.row.insuranceCardId
    : result.row.publicExpenseId;
}

/** buildServer の既定合成: InMemoryCoverageRepository のみ補償を結線する。 */
export function composeDefaultCoverageRecordCommand(options: {
  readonly coverageRepository: CoverageRepository;
  readonly auditRepository: AuditRepository;
}): ComposedCoverageRecordCommand {
  const { coverageRepository } = options;
  if (!(coverageRepository instanceof InMemoryCoverageRepository)) {
    // 補償手段を持たない repository を合成コマンドへ渡すと、監査失敗時に
    // 「監査なしの durable 行」が残る(append-only で除去も不能)。合成時に
    // fail-closed で拒否する。Postgres 経路は PostgresCoverageRecordCommand
    // (単一 tx)を使うためこの分岐には来ない。
    throw new Error(
      'coverage record command requires a compensatable repository',
    );
  }
  return new ComposedCoverageRecordCommand({
    ...options,
    compensateRecorded: (undo: unknown) =>
      coverageRepository.rollbackRecorded(undo),
  });
}
