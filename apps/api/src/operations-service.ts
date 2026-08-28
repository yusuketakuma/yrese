import {
  MIGRATION_STATE_UNAVAILABLE_REASON,
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryResponseSchema,
  type MigrationStateResponse,
  type OutboxSummaryResponse,
  type ReceptionSummaryResponse,
} from "@yrese/contracts";
import {
  ELIGIBILITY_STATUSES,
  RECEPTION_STATUSES,
  isReceptionStatus,
  type EligibilityStatus,
  type PharmacyId,
  type ReceptionStatus,
  type TenantId,
} from "@yrese/shared-kernel";

import type { InMemoryReceptionOutbox } from "./reception-command.js";
import type { ReceptionRepository } from "./reception-repository.js";

/**
 * BE-1: 実在する永続状態に対する読み取りサービス。
 *
 * 返すのは件数・時刻・enum・スキーマ版数だけであり、算定・請求・薬価・帳票・法令の
 * 計算は一切行わない。受付サマリは **サービス内で件数へ畳み込んでから** route へ
 * 返し、患者データを route 層へ渡さない(データ最小化)。
 */

export const operationsSummaryInvariantErrorMessage =
  "Operations summary derivation is invalid";

export interface OperationsScope {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
}

export interface ReceptionSummaryInput extends OperationsScope {
  readonly date: string;
}

export interface OperationsReadService {
  outboxSummary(scope: OperationsScope): Promise<OutboxSummaryResponse>;
  receptionSummary(
    input: ReceptionSummaryInput,
  ): Promise<ReceptionSummaryResponse>;
  migrationState(): Promise<MigrationStateResponse>;
}

/** 1 event type ぶんの実測集計。永続実装は SQL 集計、in-memory 実装は intent 走査で作る。 */
export interface OutboxEventTypeTally {
  readonly eventType: string;
  readonly pendingCount: number;
  readonly deliveredCount: number;
  /** pending が 0 件のときは存在しない。 */
  readonly oldestPendingCreatedAt?: string;
}

export interface ReceptionStatusTally {
  readonly receptionStatus: string;
  readonly eligibilityStatus: string;
  readonly count: number;
}

function assertOperationsInvariant(condition: boolean): void {
  if (!condition) {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
}

function compareEventType(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * event type ごとの実測集計から応答を組み立てる。合計は集計値の総和であり、
 * 別経路の推定値ではない。`legacyOrphanCount` は **導出できた場合にだけ** 渡すこと
 * (未指定ならフィールドごと省略され、UI は「導出不能」として描画できる)。
 */
export function buildOutboxSummary(
  tallies: readonly OutboxEventTypeTally[],
  options: { readonly legacyOrphanCount?: number } = {},
): OutboxSummaryResponse {
  const byEventType = [...tallies].sort((left, right) =>
    compareEventType(left.eventType, right.eventType),
  );

  let pendingCount = 0;
  let deliveredCount = 0;
  let oldestPendingCreatedAt: string | undefined;
  for (const tally of byEventType) {
    pendingCount += tally.pendingCount;
    deliveredCount += tally.deliveredCount;
    const candidate = tally.oldestPendingCreatedAt;
    if (candidate === undefined) continue;
    if (oldestPendingCreatedAt === undefined || candidate < oldestPendingCreatedAt) {
      oldestPendingCreatedAt = candidate;
    }
  }

  const parsed = outboxSummaryResponseSchema.safeParse({
    pendingCount,
    deliveredCount,
    ...(oldestPendingCreatedAt === undefined ? {} : { oldestPendingCreatedAt }),
    byEventType: byEventType.map((tally) => ({
      eventType: tally.eventType,
      pendingCount: tally.pendingCount,
      deliveredCount: tally.deliveredCount,
    })),
    ...(options.legacyOrphanCount === undefined
      ? {}
      : { legacyOrphanCount: options.legacyOrphanCount }),
  });
  if (!parsed.success) {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
  return parsed.data;
}

function tallyIntoDeclaredOrder<T extends string>(
  statuses: readonly T[],
  counts: ReadonlyMap<string, number>,
): readonly { readonly status: T; readonly count: number }[] {
  return statuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

/**
 * 受付の実測集計から応答を組み立てる。両配列は enum の宣言順で全メンバーを含み、
 * 該当なしは count: 0 になる(実測 0 件であり、欠測ではない)。
 * 未知の status 値は不変条件違反として拒否し、黙って捨てない。
 */
export function buildReceptionSummary(
  date: string,
  tallies: readonly ReceptionStatusTally[],
): ReceptionSummaryResponse {
  const receptionCounts = new Map<string, number>();
  const eligibilityCounts = new Map<string, number>();
  let totalCount = 0;

  for (const tally of tallies) {
    assertOperationsInvariant(
      Number.isSafeInteger(tally.count) &&
        tally.count >= 0 &&
        isReceptionStatus(tally.receptionStatus) &&
        (ELIGIBILITY_STATUSES as readonly string[]).includes(tally.eligibilityStatus),
    );
    totalCount += tally.count;
    receptionCounts.set(
      tally.receptionStatus,
      (receptionCounts.get(tally.receptionStatus) ?? 0) + tally.count,
    );
    eligibilityCounts.set(
      tally.eligibilityStatus,
      (eligibilityCounts.get(tally.eligibilityStatus) ?? 0) + tally.count,
    );
  }

  const parsed = receptionSummaryResponseSchema.safeParse({
    date,
    totalCount,
    byReceptionStatus: tallyIntoDeclaredOrder<ReceptionStatus>(
      RECEPTION_STATUSES,
      receptionCounts,
    ),
    byEligibilityStatus: tallyIntoDeclaredOrder<EligibilityStatus>(
      ELIGIBILITY_STATUSES,
      eligibilityCounts,
    ),
  });
  if (!parsed.success) {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
  return parsed.data;
}

/** 走査中の可変バケット(集計中だけ存在し、応答へはそのまま出さない)。 */
interface OutboxTallyBucket {
  pending: number;
  delivered: number;
  oldest?: string;
}

export function persistentStoreNotConfiguredMigrationState(): MigrationStateResponse {
  return migrationStateResponseSchema.parse({
    available: false,
    reason: MIGRATION_STATE_UNAVAILABLE_REASON,
  });
}

/**
 * in-memory モードの実装(dev/test)。
 *
 * outbox は InMemoryReceptionOutbox が保持する実 intent を数える。配送 worker が
 * 存在しないため delivered は構造的に 0 件であり、これは「配送済みが 0 件だった」と
 * いう実測である。`legacyOrphanCount` は in-memory では導出していないため
 * **フィールドごと省略する**(0 と主張しない)。
 * migration state は永続 store が無いので `available: false` を返す。
 */
export class InMemoryOperationsReadService implements OperationsReadService {
  private readonly outbox: InMemoryReceptionOutbox;
  private readonly receptionRepository: ReceptionRepository;

  constructor(
    outbox: InMemoryReceptionOutbox,
    receptionRepository: ReceptionRepository,
  ) {
    this.outbox = outbox;
    this.receptionRepository = receptionRepository;
  }

  async outboxSummary(scope: OperationsScope): Promise<OutboxSummaryResponse> {
    const intents = this.outbox.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });

    const tallies = new Map<string, OutboxTallyBucket>();
    for (const intent of intents) {
      const bucket: OutboxTallyBucket = tallies.get(intent.eventType) ?? {
        pending: 0,
        delivered: 0,
      };
      if (intent.deliveredAt === null) {
        bucket.pending += 1;
        if (bucket.oldest === undefined || intent.createdAt < bucket.oldest) {
          bucket.oldest = intent.createdAt;
        }
      } else {
        bucket.delivered += 1;
      }
      tallies.set(intent.eventType, bucket);
    }

    return buildOutboxSummary(
      [...tallies].map(([eventType, bucket]) => ({
        eventType,
        pendingCount: bucket.pending,
        deliveredCount: bucket.delivered,
        ...(bucket.oldest === undefined ? {} : { oldestPendingCreatedAt: bucket.oldest }),
      })),
    );
  }

  async receptionSummary(
    input: ReceptionSummaryInput,
  ): Promise<ReceptionSummaryResponse> {
    const entries = await this.receptionRepository.list({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      date: input.date,
    });

    // 患者データはこのスコープから外に出さない。status の組だけを取り出して畳み込む。
    const tallies = entries.map((entry) => ({
      receptionStatus: entry.receptionStatus,
      eligibilityStatus: entry.patient.eligibilityStatus,
      count: 1,
    }));

    return buildReceptionSummary(input.date, tallies);
  }

  async migrationState(): Promise<MigrationStateResponse> {
    return persistentStoreNotConfiguredMigrationState();
  }
}
