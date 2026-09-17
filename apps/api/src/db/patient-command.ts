import type { Pool } from 'pg';

import { appendAuditEventWithinTransaction } from './audit-repository.js';
import { runInPooledTransaction } from './pool.js';
import {
  runPatientCreateWithinTransaction,
  runPatientUpdateWithinTransaction,
} from './patient-repository.js';
import {
  PatientAuditAppendError,
  patientCommandAggregateType,
  patientCreateAuditEventType,
  patientDuplicateSearchTargetKind,
  patientSearchedAuditEventType,
  patientUpdateAuditEventType,
  type PatientCreateCommandInput,
  type PatientCreateCommandResult,
  type PatientUpdateCommandInput,
  type PatientUpdateCommandResult,
  type PatientWriteCommand,
} from '../patient-command.js';

/**
 * WP-7202: 患者登録・更新コマンド境界の Postgres 実装。
 *
 * 単一トランザクションで patients INSERT/UPDATE(+ identity history)と
 * 監査 hash chain 追記を原子化する。どこで失敗しても ROLLBACK により
 * 部分的 durable 書込みは残らない。重複候補がある created は
 * patient.searched → patient.created の順に同一 tx で記録する。
 *
 * ロック順序: scope advisory xact lock / 患者行 FOR UPDATE →
 * 監査 advisory xact lock。監査のみのトランザクションは patients を
 * 触れないため循環待ちは生じない。
 */
export interface PostgresPatientWriteCommandFaultInjection {
  /** テスト専用の故障注入点(監査追記直前)。本番構成では未指定。 */
  readonly beforeAuditAppend?: () => void;
}

export class PostgresPatientWriteCommand implements PatientWriteCommand {
  constructor(
    private readonly pool: Pool,
    private readonly faultInjection: PostgresPatientWriteCommandFaultInjection = {},
  ) {}

  async createPatient(
    input: PatientCreateCommandInput,
  ): Promise<PatientCreateCommandResult> {
    const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runPatientCreateWithinTransaction(client, {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        patientId: input.mintPatientId(),
        attributes: input.attributes,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        actorId: input.actorId,
        recordedAt: input.recordedAt,
      });

      if (result.kind !== 'created') {
        // 書込みなし。空のまま閉じる。
        await client.query('ROLLBACK');
        return result;
      }

      const wallClock = input.auditWallClock();
      const auditEvents: unknown[] = [];
      try {
        this.faultInjection.beforeAuditAppend?.();
        if (result.duplicateCandidates.length > 0) {
          auditEvents.push(
            await appendAuditEventWithinTransaction(client, scope, {
              actorId: input.actorId,
              auditEventType: patientSearchedAuditEventType,
              targetRef: {
                kind: patientDuplicateSearchTargetKind,
                id: `duplicates:${result.duplicateCandidates.length}`,
              },
              outcome: 'success',
              wallClock,
            }),
          );
        }
        auditEvents.push(
          await appendAuditEventWithinTransaction(client, scope, {
            actorId: input.actorId,
            auditEventType: patientCreateAuditEventType,
            targetRef: {
              kind: patientCommandAggregateType,
              id: result.patient.patientId,
            },
            outcome: 'success',
            wallClock,
          }),
        );
      } catch (error) {
        throw new PatientAuditAppendError(error);
      }

      await client.query('COMMIT');
      return { ...result, auditEvents: Object.freeze(auditEvents) };
    });
  }

  async updatePatient(
    input: PatientUpdateCommandInput,
  ): Promise<PatientUpdateCommandResult> {
    const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runPatientUpdateWithinTransaction(client, {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        patientId: input.patientId,
        expectedVersion: input.expectedVersion,
        attributes: input.attributes,
        actorId: input.actorId,
        recordedAt: input.recordedAt,
      });

      if (result.kind !== 'updated') {
        await client.query('ROLLBACK');
        return result;
      }

      this.faultInjection.beforeAuditAppend?.();
      let auditEvent;
      try {
        auditEvent = await appendAuditEventWithinTransaction(client, scope, {
          actorId: input.actorId,
          auditEventType: patientUpdateAuditEventType,
          targetRef: {
            kind: patientCommandAggregateType,
            id: result.patient.patientId,
          },
          outcome: 'success',
          wallClock: input.auditWallClock(),
        });
      } catch (error) {
        throw new PatientAuditAppendError(error);
      }

      await client.query('COMMIT');
      return { ...result, auditEvent };
    });
  }
}
