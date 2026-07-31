import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import { appendAuditEventWithinTransaction } from './audit-repository.js';
import {
  runReceptionCreateWithinTransaction,
  snapshotPostgresReceptionCreate,
} from './reception-repository.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import type { ReceptionCreateProvenance } from '../reception-repository.js';
import {
  ReceptionAuditAppendError,
  ReceptionOutboxAppendError,
  receptionCommandAggregateType,
  receptionCommandAuditEventType,
  type EnsureCreatedEvidenceInput,
  type ReceptionCreateCommand,
  type ReceptionCreateCommandInput,
  type ReceptionCreateCommandResult,
  type ReceptionExistingClassification,
} from '../reception-command.js';

/**
 * WP-4050: 受付コマンド境界の Postgres 実装。
 *
 * 単一トランザクションで reception INSERT → 監査 hash chain 追記 →
 * outbox intent INSERT を原子化する。どこで失敗しても ROLLBACK により
 * 部分的 durable 書込みは残らない(受付だけが残る従来欠陥の解消)。
 *
 * ロック順序: 受付 INSERT(unique index)→ 監査 advisory xact lock。
 * 監査 lock 保持中に reception_entries を待つ経路はなく、監査だけの
 * トランザクション(PostgresAuditRepository.record)は reception_entries に
 * 触れないため、循環待ちは生じない。
 */

export interface PostgresReceptionCommandFaultInjection {
  /** テスト専用の故障注入点(監査追記直前)。本番構成では未指定。 */
  readonly beforeAuditAppend?: () => void;
  /** テスト専用の故障注入点(outbox INSERT 直前)。本番構成では未指定。 */
  readonly beforeOutboxAppend?: () => void;
}

export class PostgresReceptionCreateCommand implements ReceptionCreateCommand {
  constructor(
    private readonly pool: Pool,
    private readonly faultInjection: PostgresReceptionCommandFaultInjection = {},
  ) {}

  async execute(
    input: ReceptionCreateCommandInput,
  ): Promise<ReceptionCreateCommandResult> {
    const snapshot = snapshotPostgresReceptionCreate(input);
    const scope = { tenantId: snapshot.tenantId, pharmacyId: snapshot.pharmacyId };
    const client = await this.pool.connect();
    let destroyClient = false;
    try {
      await client.query('BEGIN');
      const result = await runReceptionCreateWithinTransaction(client, snapshot);

      if (result.kind === 'idempotency_conflict') {
        // 何も書いていない(INSERT は DO NOTHING 済み)。空のまま閉じる。
        await client.query('ROLLBACK');
        return result;
      }

      if (result.kind === 'existing') {
        const intentExists = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM outbox_events
              WHERE tenant_id = $1 AND pharmacy_id = $2
                AND aggregate_type = $3 AND aggregate_id = $4 AND event_type = $5
           ) AS exists`,
          [
            scope.tenantId,
            scope.pharmacyId,
            receptionCommandAggregateType,
            result.provenance.receptionId,
            receptionCommandAuditEventType,
          ],
        );
        await client.query('COMMIT');
        if (intentExists.rows[0]?.exists === true) {
          return {
            kind: 'existing_complete',
            entry: result.entry,
            provenance: result.provenance,
          };
        }
        return {
          kind: 'legacy_orphan',
          entry: result.entry,
          provenance: result.provenance,
          missingOutboxIntent: true,
        };
      }

      const wallClock = input.auditWallClock();

      this.faultInjection.beforeAuditAppend?.();
      let auditEvent;
      try {
        auditEvent = await appendAuditEventWithinTransaction(client, scope, {
          actorId: input.actorId,
          auditEventType: receptionCommandAuditEventType,
          targetRef: {
            kind: receptionCommandAggregateType,
            id: result.provenance.receptionId,
          },
          outcome: 'success',
          wallClock,
        });
      } catch (error) {
        throw new ReceptionAuditAppendError(error);
      }

      const outboxEventId = randomUUID();
      this.faultInjection.beforeOutboxAppend?.();
      try {
        await client.query(
          `INSERT INTO outbox_events (
             tenant_id, pharmacy_id, outbox_event_id, event_type,
             aggregate_type, aggregate_id, audit_event_id, payload, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            scope.tenantId,
            scope.pharmacyId,
            outboxEventId,
            receptionCommandAuditEventType,
            receptionCommandAggregateType,
            result.provenance.receptionId,
            auditEvent.eventId,
            JSON.stringify({
              receptionId: result.provenance.receptionId,
              patientId: result.provenance.patientId,
            }),
            wallClock,
          ],
        );
      } catch (error) {
        throw new ReceptionOutboxAppendError(error);
      }

      await client.query('COMMIT');
      return {
        kind: 'created',
        entry: result.entry,
        provenance: result.provenance,
        auditEvent,
        outboxIntent: {
          outboxEventId,
          tenantId: scope.tenantId,
          pharmacyId: scope.pharmacyId,
          eventType: receptionCommandAuditEventType,
          aggregateType: receptionCommandAggregateType,
          aggregateId: result.provenance.receptionId,
          patientId: result.provenance.patientId,
          createdAt: wallClock,
          auditEventId: auditEvent.eventId,
          deliveredAt: null,
        },
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
      throw error;
    } finally {
      if (destroyClient) {
        client.release(true);
      } else {
        client.release();
      }
    }
  }

  /**
   * created の evidence は execute のトランザクション内で確定済み。
   * ここでは結果へ添付された監査イベントを返すだけで、追加の書込みはしない。
   */
  async ensureCreatedEvidence(input: EnsureCreatedEvidenceInput): Promise<unknown> {
    const readProperty = createOwnDataPropertyReader(
      input.result,
      'Postgres reception command result is missing attached audit evidence',
    );
    const auditEvent = readProperty('auditEvent');
    if (!auditEvent.present) {
      throw new ReceptionAuditAppendError(
        new Error('Postgres reception command result is missing attached audit evidence'),
      );
    }
    return auditEvent.value;
  }

  /**
   * Postgres の evidence は execute のトランザクションで確定済みであり、
   * ここへ来るのは添付 evidence 欠落という自己不変条件違反だけ。
   * 既に commit 済みのため巻き戻すものはない(fail-visible)。
   */
  async rollbackCreatedEvidence(_provenance: ReceptionCreateProvenance): Promise<void> {
    // no-op
  }

  async classifyExisting(
    provenance: ReceptionCreateProvenance,
  ): Promise<ReceptionExistingClassification> {
    const intentExists = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM outbox_events
          WHERE tenant_id = $1 AND pharmacy_id = $2
            AND aggregate_type = $3 AND aggregate_id = $4 AND event_type = $5
       ) AS exists`,
      [
        provenance.tenantId,
        provenance.pharmacyId,
        receptionCommandAggregateType,
        provenance.receptionId,
        receptionCommandAuditEventType,
      ],
    );
    return intentExists.rows[0]?.exists === true ? 'existing_complete' : 'legacy_orphan';
  }
}
