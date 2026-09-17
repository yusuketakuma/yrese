import type { Pool } from 'pg';

import { appendAuditEventWithinTransaction } from './audit-repository.js';
import { runEligibilityRecordWithinTransaction } from './eligibility-snapshot-repository.js';
import { runInPooledTransaction } from './pool.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import {
  EligibilityAuditAppendError,
  eligibilityRecordAuditEventType,
  eligibilitySnapshotAggregateType,
  type EligibilityRecordCommand,
  type EligibilityRecordCommandInput,
  type EligibilityRecordCommandResult,
  type EnsureEligibilityRecordEvidenceInput,
} from '../eligibility-snapshot-command.js';

export interface PostgresEligibilityCommandFaultInjection {
  /** テスト専用の故障注入点(監査追記直前)。本番構成では未指定。 */
  readonly beforeAuditAppend?: () => void;
}

/**
 * WP-7204: 資格確認スナップショット記録の Postgres コマンド境界。
 *
 * 単一トランザクションで advisory lock → 遷移表・method-state・冪等検査 →
 * snapshot INSERT + 受付紐づけ → 監査 hash chain 追記を原子化する
 * (runEligibilityRecordWithinTransaction + appendAuditEventWithinTransaction)。
 * 監査追記失敗を含むどの失敗でも ROLLBACK により snapshot だけが durable に
 * 残らない(API-019 §4 の 1操作=1監査不変条件)。
 *
 * 冪等再送(existing)は新たな監査を発火せず ROLLBACK で閉じる。
 *
 * ロック順序: eligibility advisory lock → audit advisory lock。
 * 監査だけのトランザクション(PostgresAuditRepository.record)は
 * eligibility_snapshots / reception_entries に触れないため循環待ちは生じない。
 */
export class PostgresEligibilityRecordCommand
  implements EligibilityRecordCommand
{
  constructor(
    private readonly pool: Pool,
    private readonly faultInjection: PostgresEligibilityCommandFaultInjection = {},
  ) {}

  async execute(
    input: EligibilityRecordCommandInput,
  ): Promise<EligibilityRecordCommandResult> {
    const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runEligibilityRecordWithinTransaction(
        client,
        scope,
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

      if (result.kind !== 'recorded') {
        // 冪等再送(書込みなし、advisory lock のみ)。監査は発火しない。
        await client.query('ROLLBACK');
        return result;
      }

      const wallClock = input.auditWallClock();
      this.faultInjection.beforeAuditAppend?.();
      let auditEvent;
      try {
        auditEvent = await appendAuditEventWithinTransaction(client, scope, {
          actorId: input.recordedBy,
          auditEventType: eligibilityRecordAuditEventType(result.snapshot.state),
          targetRef: {
            kind: eligibilitySnapshotAggregateType,
            id: result.snapshot.snapshotId,
          },
          outcome: 'success',
          wallClock,
        });
      } catch (error) {
        throw new EligibilityAuditAppendError(error);
      }

      await client.query('COMMIT');
      return { ...result, auditEvent };
    });
  }

  /**
   * recorded の evidence は execute のトランザクション内で確定済み。
   * ここでは結果へ添付された監査イベントを返すだけで、追加の書込みはしない。
   */
  async ensureRecordEvidence(
    input: EnsureEligibilityRecordEvidenceInput,
  ): Promise<unknown> {
    const readProperty = createOwnDataPropertyReader(
      input.result,
      'Postgres eligibility command result is missing attached audit evidence',
    );
    const auditEvent = readProperty('auditEvent');
    if (!auditEvent.present) {
      throw new EligibilityAuditAppendError(
        new Error(
          'Postgres eligibility command result is missing attached audit evidence',
        ),
      );
    }
    return auditEvent.value;
  }

  /**
   * Postgres の evidence は execute のトランザクションで確定済みであり、
   * ここへ来るのは添付 evidence 欠落という自己不変条件違反だけ。
   * 既に commit 済みのため巻き戻すものはない(fail-visible)。
   */
  async rollbackRecordEvidence(_undo: unknown): Promise<void> {
    // no-op
  }
}
