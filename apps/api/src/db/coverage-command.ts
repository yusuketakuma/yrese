import type { Pool } from 'pg';

import { appendAuditEventWithinTransaction } from './audit-repository.js';
import { runCoverageRecordWithinTransaction } from './coverage-repository.js';
import { runInPooledTransaction } from './pool.js';
import {
  CoverageAuditAppendError,
  coverageCommandAggregateType,
  coverageRowId,
  coverageUpdatedAuditEventType,
  type CoverageRecordCommand,
  type CoverageRecordCommandInput,
  type CoverageRecordCommandResult,
} from '../coverage-command.js';

/**
 * WP-7203: 保険・公費登録コマンド境界の Postgres 実装。
 *
 * 単一トランザクションで coverage 行 INSERT(+ 冪等記録)と監査 hash chain
 * 追記を原子化する。どこで失敗しても ROLLBACK により部分的 durable 書込みは
 * 残らない。
 *
 * ロック順序: patient 単位 advisory xact lock(repository 内)→
 * 監査 advisory xact lock。監査のみのトランザクションは coverage テーブルを
 * 触れないため循環待ちは生じない。
 */
export interface PostgresCoverageRecordCommandFaultInjection {
  /** テスト専用の故障注入点(監査追記直前)。本番構成では未指定。 */
  readonly beforeAuditAppend?: () => void;
}

export class PostgresCoverageRecordCommand implements CoverageRecordCommand {
  constructor(
    private readonly pool: Pool,
    private readonly faultInjection: PostgresCoverageRecordCommandFaultInjection = {},
  ) {}

  async recordCoverage(
    input: CoverageRecordCommandInput,
  ): Promise<CoverageRecordCommandResult> {
    const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runCoverageRecordWithinTransaction(client, {
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
        // 書込みなし。空のまま閉じる。
        await client.query('ROLLBACK');
        return result;
      }

      this.faultInjection.beforeAuditAppend?.();
      let auditEvent;
      try {
        auditEvent = await appendAuditEventWithinTransaction(client, scope, {
          actorId: input.actorId,
          auditEventType: coverageUpdatedAuditEventType,
          targetRef: {
            kind: coverageCommandAggregateType,
            id: `${result.entryKind}:${coverageRowId(result)}`,
          },
          outcome: 'success',
          wallClock: input.auditWallClock(),
        });
      } catch (error) {
        throw new CoverageAuditAppendError(error);
      }

      await client.query('COMMIT');
      return { ...result, auditEvent };
    });
  }
}
