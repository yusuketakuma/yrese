import {
  ELIGIBILITY_STATUSES,
  RECEPTION_STATUSES,
} from "@yrese/shared-kernel";
import { z } from "zod";

/**
 * 運用状態の読み取り契約(BE-1)。
 *
 * この契約が運ぶのは **件数・時刻・enum・スキーマ版数だけ** である。算定・請求・
 * 薬価・帳票・法令の値は一切含まず、患者識別子・氏名・カナ・生年月日・処方内容も
 * 含まない(PHI 非含有)。したがってこれらの応答は Cache-Control: no-store を
 * 要求しない。
 *
 * 原資料:
 * - outbox サマリ: migrations/000005 + 000007 の `outbox_events`
 *   (payload は識別子のみで PHI 非含有、`delivered_at` の pending→delivered 単一遷移)。
 *   in-memory モードでは apps/api の InMemoryReceptionOutbox が保持する実 intent。
 * - 受付サマリ: `reception_entries` と、受付に紐づく患者の `eligibility_status`。
 * - migration state: migrations/000001 の `schema_migrations` と
 *   apps/api の checkMigrationState / MigrationCheckResult。
 */

export const OPERATIONS_EVENT_TYPE_MAX_LENGTH = 128;
export const OPERATIONS_MIGRATION_NAME_MAX_LENGTH = 128;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function hasNoControlCharacters(value: string): boolean {
  return !controlCharacterPattern.test(value);
}

/** 件数は必ず非負整数。負値・小数・NaN は契約違反として拒否する。 */
const countSchema = z.number().int().min(0);

/** migration の version は 6 桁連番(migrations/NNNNNN_*.sql の NNNNNN)。 */
const migrationVersionSchema = z.string().regex(/^\d{6}$/, {
  message: "migration version must be a six digit sequence",
});

const migrationNameSchema = z
  .string()
  .min(1)
  .max(OPERATIONS_MIGRATION_NAME_MAX_LENGTH)
  .regex(/^[a-z0-9_]+$/, {
    message: "migration name must be lower snake case",
  });

export const outboxEventTypeSchema = z
  .string()
  .min(1)
  .max(OPERATIONS_EVENT_TYPE_MAX_LENGTH)
  .refine(hasNoControlCharacters, {
    message: "eventType must not contain control characters",
  });

export const outboxEventTypeSummarySchema = z.object({
  eventType: outboxEventTypeSchema,
  pendingCount: countSchema,
  deliveredCount: countSchema,
});

/**
 * `legacyOrphanCount` は「outbox intent を持たない既存受付」の件数であり、
 * **導出できた場合にだけ存在する**。in-memory モードのように導出していない場合は
 * 0 ではなくフィールドごと省略する(0 件であるという主張と、導出していないことを
 * 混同させない)。orphan の receptionId 一覧そのものは返さない。
 */
export const outboxSummaryResponseSchema = z.object({
  pendingCount: countSchema,
  deliveredCount: countSchema,
  oldestPendingCreatedAt: z.iso.datetime().optional(),
  byEventType: z.array(outboxEventTypeSummarySchema).refine(
    (rows) =>
      rows.every(
        (row, index) =>
          index === 0 || (rows[index - 1]?.eventType ?? "") < row.eventType,
      ),
    {
      message: "byEventType must be unique and sorted by eventType ascending",
    },
  ),
  legacyOrphanCount: countSchema.optional(),
});

export const receptionSummaryQuerySchema = z.object({
  date: z.iso.date(),
});

export const receptionSummaryReceptionStatusCountSchema = z.object({
  status: z.enum(RECEPTION_STATUSES),
  count: countSchema,
});

export const receptionSummaryEligibilityStatusCountSchema = z.object({
  status: z.enum(ELIGIBILITY_STATUSES),
  count: countSchema,
});

/**
 * 集計配列は enum の宣言順で **全メンバーを必ず含める**。該当なしは count: 0 で
 * あり、これは捏造ではなく「その業務日にその状態の受付が 0 件だった」という実測値
 * である。欠落を許すと「0 件」と「集計していない」を画面が区別できなくなる。
 */
function declaresEveryStatusInOrder<T extends string>(
  statuses: readonly T[],
): (rows: readonly { readonly status: T }[]) => boolean {
  return (rows) =>
    rows.length === statuses.length &&
    statuses.every((status, index) => rows[index]?.status === status);
}

export const receptionSummaryResponseSchema = z.object({
  date: z.iso.date(),
  totalCount: countSchema,
  byReceptionStatus: z
    .array(receptionSummaryReceptionStatusCountSchema)
    .refine(declaresEveryStatusInOrder(RECEPTION_STATUSES), {
      message:
        "byReceptionStatus must list every reception status in declaration order",
    }),
  byEligibilityStatus: z
    .array(receptionSummaryEligibilityStatusCountSchema)
    .refine(declaresEveryStatusInOrder(ELIGIBILITY_STATUSES), {
      message:
        "byEligibilityStatus must list every eligibility status in declaration order",
    }),
});

/**
 * schema_migrations の照合結果。checksum の値そのものは運ばない
 * (一致 / 不一致という result にだけ現れる)。接続文字列・ホスト名も運ばない。
 */
export const MIGRATION_STATE_RESULTS = [
  "up_to_date",
  "db_ahead",
  "version_mismatch",
  "checksum_mismatch",
  "name_mismatch",
  "unapplied_required",
] as const;

export const migrationStateResultSchema = z.enum(MIGRATION_STATE_RESULTS);

export const MIGRATION_STATE_UNAVAILABLE_REASON =
  "PERSISTENT_STORE_NOT_CONFIGURED";

/**
 * `pendingVersions` は照合結果から **導出できた場合にだけ存在する**。
 * up_to_date / db_ahead は「未適用なし」を実測した空配列、unapplied_required は
 * 実際の未適用 version 一覧を運ぶ。version/checksum/name の不一致で照合が途中停止した
 * 結果は未適用件数を確定できないため、0 件と主張せずフィールドごと省略する
 * (`legacyOrphanCount` と同じ規則)。
 */
export const migrationStateAvailableSchema = z.object({
  available: z.literal(true),
  result: migrationStateResultSchema,
  appliedCount: countSchema,
  availableCount: countSchema,
  pendingVersions: z.array(migrationVersionSchema).optional(),
  latestAppliedVersion: migrationVersionSchema.optional(),
  latestAppliedName: migrationNameSchema.optional(),
});

export const migrationStateUnavailableSchema = z.object({
  available: z.literal(false),
  reason: z.literal(MIGRATION_STATE_UNAVAILABLE_REASON),
});

export const migrationStateResponseSchema = z.discriminatedUnion("available", [
  migrationStateAvailableSchema,
  migrationStateUnavailableSchema,
]);

export type OutboxEventTypeSummary = z.infer<typeof outboxEventTypeSummarySchema>;
export type OutboxSummaryResponse = z.infer<typeof outboxSummaryResponseSchema>;
export type ReceptionSummaryQuery = z.infer<typeof receptionSummaryQuerySchema>;
export type ReceptionSummaryReceptionStatusCount = z.infer<
  typeof receptionSummaryReceptionStatusCountSchema
>;
export type ReceptionSummaryEligibilityStatusCount = z.infer<
  typeof receptionSummaryEligibilityStatusCountSchema
>;
export type ReceptionSummaryResponse = z.infer<
  typeof receptionSummaryResponseSchema
>;
export type MigrationStateResult = z.infer<typeof migrationStateResultSchema>;
export type MigrationStateResponse = z.infer<typeof migrationStateResponseSchema>;
