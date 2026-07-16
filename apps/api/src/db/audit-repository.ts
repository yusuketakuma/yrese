import type { Pool, PoolClient } from 'pg';
import { hydrateAuditEvent, type AuditEvent } from '@yrese/audit';

import {
  buildChainedAuditEvent,
  type AuditRepository,
  type AuditScope,
  type RecordAuditInput,
} from '../audit-repository.js';

/**
 * 監査ログの Postgres 永続実装(SCR-028 / R-AUDIT 永続層 — migrations/000004)。
 *
 * - イベント構築・整合性検証の正本は @yrese/audit(buildChainedAuditEvent / hydrateAuditEvent)。
 * - chain 連続性: (tenant, pharmacy) 単位の advisory transaction lock で追記を直列化し、
 *   直前 entry_hash → prev_hash を保証する。sequence_number が chain 順。
 * - テーブルは append-only(migration の trigger が UPDATE/DELETE を拒否 — 真正性)。
 * - event_body は canonical イベント JSON(bigint フィールドは文字列)。読み出し時は
 *   hydrateAuditEvent で entry_hash を再検証し、破損行は隠さず raw のまま返して
 *   verifyAuditHashChain(閲覧エンドポイント)に破断として報告させる(fail-visible)。
 */

interface AuditEventRow {
  readonly event_body: unknown;
}

/** JSON 直列化(bigint → 文字列)。hydrate 側が文字列→BigInt を受けないため読みで復元する。 */
function serializeEvent(event: AuditEvent): string {
  return JSON.stringify(event, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

/** 保存 JSON の bigint フィールドを復元する(sequenceNumber / logicalClock)。 */
function reviveStoredEvent(body: unknown): unknown {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  const record = { ...(body as Record<string, unknown>) };
  for (const field of ['sequenceNumber', 'logicalClock']) {
    const value = record[field];
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      record[field] = BigInt(value);
    }
  }
  return record;
}

function rowToEvent(row: AuditEventRow): AuditEvent {
  const revived = reviveStoredEvent(row.event_body);
  try {
    return hydrateAuditEvent(revived);
  } catch {
    // 破損・改ざんの疑いがある行は隠さない: raw を返し、閲覧側の
    // verifyAuditHashChain が chain 破断(CRITICAL 表示)として報告する。
    return revived as AuditEvent;
  }
}

export function buildAuditScopeAdvisoryLockKey(scope: AuditScope): string {
  return JSON.stringify(['yrese.audit.scope.v1', scope.tenantId, scope.pharmacyId]);
}

async function lockScope(client: PoolClient, scope: AuditScope): Promise<void> {
  // (tenant, pharmacy) 単位で追記を直列化(hashtextextended は bigint を返す)
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    buildAuditScopeAdvisoryLockKey(scope),
  ]);
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly pool: Pool) {}

  async record(scope: AuditScope, input: RecordAuditInput): Promise<AuditEvent> {
    const client = await this.pool.connect();
    let destroyClient = false;
    try {
      await client.query('BEGIN');
      await lockScope(client, scope);

      const last = await client.query<{ entry_hash: string; sequence_number: string }>(
        `SELECT entry_hash, sequence_number
           FROM audit_events
          WHERE tenant_id = $1 AND pharmacy_id = $2
          ORDER BY sequence_number DESC
          LIMIT 1`,
        [scope.tenantId, scope.pharmacyId],
      );
      const previous = last.rows[0];
      const sequenceNumber =
        previous === undefined ? 1n : BigInt(previous.sequence_number) + 1n;

      const event = buildChainedAuditEvent(scope, input, previous?.entry_hash, sequenceNumber);

      await client.query(
        `INSERT INTO audit_events
           (tenant_id, pharmacy_id, sequence_number, event_id, prev_hash, entry_hash, wall_clock, event_body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          scope.tenantId,
          scope.pharmacyId,
          sequenceNumber.toString(),
          event.eventId,
          event.prevHash,
          event.entryHash,
          event.wallClock,
          serializeEvent(event),
        ],
      );

      await client.query('COMMIT');
      return event;
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

  async list(scope: AuditScope): Promise<readonly AuditEvent[]> {
    const result = await this.pool.query<AuditEventRow>(
      `SELECT event_body
         FROM audit_events
        WHERE tenant_id = $1 AND pharmacy_id = $2
        ORDER BY sequence_number ASC`,
      [scope.tenantId, scope.pharmacyId],
    );
    return result.rows.map(rowToEvent);
  }
}
