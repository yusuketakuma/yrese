import type { Pool } from "pg";

import {
  migrationStateAvailableSchema,
  type MigrationStateResponse,
  type MigrationStateResult,
  type OutboxSummaryResponse,
  type ReceptionSummaryResponse,
} from "@yrese/contracts";

import {
  buildOutboxSummary,
  buildReceptionSummary,
  operationsSummaryInvariantErrorMessage,
  type OperationsReadService,
  type OperationsScope,
  type OutboxEventTypeTally,
  type ReceptionSummaryInput,
} from "../operations-service.js";
import { snapshotDatabaseInstant } from "../instant.js";
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from "./database-row.js";
import { checkMigrationState } from "./migration-runner.js";
import { derivedPendingVersions } from "./migration-state.js";
import type { MigrationFile } from "./migrations.js";
import { PostgresReceptionCreateCommand } from "./reception-command.js";

/**
 * BE-1 の永続実装。実在するテーブル(`outbox_events`、`reception_entries` +
 * `patients`、`schema_migrations`)だけを読む。
 *
 * データ最小化: 受付サマリは SQL 側で status の組に畳み込むので、患者識別子・氏名・
 * カナ・生年月日は一切アプリケーションへ運ばれない。outbox も payload を読まない。
 * migration state は接続文字列・ホスト名・checksum 値を運ばない。
 */

interface OutboxSummaryRow {
  readonly event_type: string;
  readonly pending_count: string | number;
  readonly delivered_count: string | number;
  readonly oldest_pending_created_at: Date | string | null;
}

interface ReceptionSummaryRow {
  readonly reception_status: string;
  readonly eligibility_status: string;
  readonly entry_count: string | number;
}

interface LatestAppliedMigrationRow {
  readonly version: string;
  readonly name: string;
}

/** `listLegacyOrphans` だけを要求する最小の依存(orphan 一覧そのものは応答へ出さない)。 */
export interface ReceptionLegacyOrphanSource {
  listLegacyOrphans(scope: {
    readonly tenantId: string;
    readonly pharmacyId: string;
  }): Promise<readonly unknown[]>;
}

export interface PostgresOperationsReadServiceOptions {
  readonly pool: Pool;
  readonly migrations: readonly MigrationFile[];
  readonly legacyOrphanSource?: ReceptionLegacyOrphanSource;
}

/** COUNT(*) は bigint なので driver から10進文字列で届きうる。非負整数以外は不変条件違反。 */
function readCount(value: unknown): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^\d+$/.test(value))
  ) {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
  return parsed;
}

function readInstant(value: unknown): string | undefined {
  if (value === null) return undefined;
  return snapshotDatabaseInstant(value, operationsSummaryInvariantErrorMessage);
}

function readRowString(row: unknown, property: PropertyKey): string {
  const value = readDatabaseRowOwnDataProperty(
    row,
    property,
    operationsSummaryInvariantErrorMessage,
  );
  if (typeof value !== "string") {
    throw new Error(operationsSummaryInvariantErrorMessage);
  }
  return value;
}

function readRowCount(row: unknown, property: PropertyKey): number {
  return readCount(
    readDatabaseRowOwnDataProperty(
      row,
      property,
      operationsSummaryInvariantErrorMessage,
    ),
  );
}

function readRowInstant(row: unknown, property: PropertyKey): string | undefined {
  return readInstant(
    readDatabaseRowOwnDataProperty(
      row,
      property,
      operationsSummaryInvariantErrorMessage,
    ),
  );
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

export class PostgresOperationsReadService implements OperationsReadService {
  private readonly pool: Pool;
  private readonly migrations: readonly MigrationFile[];
  private readonly legacyOrphanSource: ReceptionLegacyOrphanSource;

  constructor(options: PostgresOperationsReadServiceOptions) {
    this.pool = options.pool;
    this.migrations = options.migrations;
    this.legacyOrphanSource =
      options.legacyOrphanSource ?? new PostgresReceptionCreateCommand(options.pool);
  }

  async outboxSummary(scope: OperationsScope): Promise<OutboxSummaryResponse> {
    const result = await this.pool.query<OutboxSummaryRow>(
      `SELECT
         event_type,
         COUNT(*) FILTER (WHERE delivered_at IS NULL) AS pending_count,
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered_count,
         MIN(created_at) FILTER (WHERE delivered_at IS NULL) AS oldest_pending_created_at
       FROM outbox_events
       WHERE tenant_id = $1 AND pharmacy_id = $2
       GROUP BY event_type
       ORDER BY event_type ASC`,
      [scope.tenantId, scope.pharmacyId],
    );

    const rows = snapshotUnboundedDatabaseQueryRows<OutboxSummaryRow>(
      result,
      operationsSummaryInvariantErrorMessage,
    );
    const tallies: OutboxEventTypeTally[] = rows.map((row) => {
      const oldestPendingCreatedAt = readRowInstant(
        row,
        "oldest_pending_created_at",
      );
      return {
        eventType: readRowString(row, "event_type"),
        pendingCount: readRowCount(row, "pending_count"),
        deliveredCount: readRowCount(row, "delivered_count"),
        ...(oldestPendingCreatedAt === undefined ? {} : { oldestPendingCreatedAt }),
      };
    });

    // 永続実装でだけ導出できる値。orphan の receptionId 一覧は応答へ出さず件数だけ運ぶ。
    const legacyOrphans = await this.legacyOrphanSource.listLegacyOrphans({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });

    return buildOutboxSummary(tallies, {
      legacyOrphanCount: legacyOrphans.length,
    });
  }

  async receptionSummary(
    input: ReceptionSummaryInput,
  ): Promise<ReceptionSummaryResponse> {
    const result = await this.pool.query<ReceptionSummaryRow>(
      `SELECT
         r.reception_status,
         p.eligibility_status,
         COUNT(*) AS entry_count
       FROM reception_entries r
       INNER JOIN patients p
         ON p.tenant_id = r.tenant_id
        AND p.pharmacy_id = r.pharmacy_id
        AND p.patient_id = r.patient_id
       WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.business_date = $3::date
       GROUP BY r.reception_status, p.eligibility_status`,
      [input.tenantId, input.pharmacyId, input.date],
    );

    const rows = snapshotUnboundedDatabaseQueryRows<ReceptionSummaryRow>(
      result,
      operationsSummaryInvariantErrorMessage,
    );
    return buildReceptionSummary(
      input.date,
      rows.map((row) => ({
        receptionStatus: readRowString(row, "reception_status"),
        eligibilityStatus: readRowString(row, "eligibility_status"),
        count: readRowCount(row, "entry_count"),
      })),
    );
  }

  async migrationState(): Promise<MigrationStateResponse> {
    const check = await checkMigrationState(this.pool, this.migrations);
    // 契約 enum が MigrationCheckResult の status を網羅していることのコンパイル時検査。
    // migration-state.ts に新しい status が増えたらここで型エラーになる。
    const result: MigrationStateResult = check.status;
    const latest = await this.readLatestAppliedMigration();

    // DB 由来の version / name は契約の形に合致しなければ不変条件違反として止める
    // (推測で整形して見せない)。
    const parsed = migrationStateAvailableSchema.safeParse({
      available: true,
      result,
      appliedCount: check.appliedCount,
      availableCount: check.availableCount,
      // 導出できた結果にだけ pendingVersions を載せる。省略は「導出していない」であり
      // 0 件ではない(admin 画面は省略を「—」として描画する)。
      ...derivedPendingVersions(check),
      ...(latest === undefined
        ? {}
        : {
            latestAppliedVersion: latest.version,
            latestAppliedName: latest.name,
          }),
    });
    if (!parsed.success) {
      throw new Error(operationsSummaryInvariantErrorMessage);
    }
    return parsed.data;
  }

  private async readLatestAppliedMigration(): Promise<
    LatestAppliedMigrationRow | undefined
  > {
    try {
      const result = await this.pool.query<LatestAppliedMigrationRow>(
        "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1",
      );
      const rows = snapshotDatabaseQueryRows<LatestAppliedMigrationRow>(
        result,
        1,
        operationsSummaryInvariantErrorMessage,
      );
      const row = rows[0];
      return row === undefined
        ? undefined
        : {
            version: readRowString(row, "version"),
            name: readRowString(row, "name"),
          };
    } catch (error) {
      // schema_migrations 未作成は「まだ何も適用されていない」であって障害ではない。
      if (isUndefinedTableError(error)) {
        return undefined;
      }
      throw error;
    }
  }
}
