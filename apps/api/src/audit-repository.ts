import { createHash, randomUUID } from 'node:crypto';

import {
  AUDIT_GENESIS_PREV_HASH,
  createAuditEvent,
  type AuditBusinessReason,
  type AuditEvent,
  type AuditOutcome,
} from '@yrese/audit';
import {
  eventId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

/**
 * 監査ログリポジトリ(SCR-028 / R-AUDIT)。
 *
 * hash chain の連続性(prevHash → entryHash)はリポジトリが保証する。イベントの
 * 構築・検証の正本は @yrese/audit(createAuditEvent / verifyAuditHashChain)。
 * targetRef.id は識別子のみを入れ、氏名等の PHI を入れてはならない(phiClassification=none)。
 *
 * InMemory 実装は他リポジトリ(patient/reception)と同じ dev/test 用。
 * 永続実装(DynamoDB — audit-persistence-key-codec 参照)への置換は別WP。
 */

export interface AuditScope {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
}

export interface RecordAuditInput {
  readonly actorId: UserId;
  readonly auditEventType: string;
  readonly targetRef: { readonly kind: string; readonly id: string };
  readonly outcome: AuditOutcome;
  /** ISO 8601。時刻の注入はサーバの now() に従う(テスト決定性)。 */
  readonly wallClock: string;
  /**
   * MOD-008 構造化理由コード。cancellation 系イベント(reception.cancelled 等)
   * では必須、それ以外では省略。自由記述は監査層が拒否する。
   */
  readonly businessReason?: AuditBusinessReason;
}

export interface AuditRepository {
  record(scope: AuditScope, input: RecordAuditInput): Promise<AuditEvent>;
  /** 追記順(= hash chain 順)で返す。 */
  list(scope: AuditScope): Promise<readonly AuditEvent[]>;
}

function scopeKey(scope: AuditScope): string {
  return `${scope.tenantId}\u0000${scope.pharmacyId}`;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * hash chain へ追記する監査イベントを構築する(InMemory / Postgres 実装で共用)。
 * 直前イベントの entryHash と次の sequenceNumber は保存層が(排他制御下で)決定する。
 */
export function buildChainedAuditEvent(
  scope: AuditScope,
  input: RecordAuditInput,
  previousEntryHash: string | undefined,
  sequenceNumber: bigint,
): AuditEvent {
  const id = randomUUID();
  return createAuditEvent({
    eventId: eventId(id),
    aggregateId: input.targetRef.id,
    aggregateType: input.targetRef.kind,
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: input.actorId,
    sequenceNumber,
    logicalClock: sequenceNumber,
    wallClock: input.wallClock,
    idempotencyKey: `${id}:1`,
    correlationId: eventId(id),
    schemaVersion: 1,
    payloadHash: sha256Hex(
      `${input.auditEventType}\u0000${input.targetRef.kind}\u0000${input.targetRef.id}\u0000${input.outcome}`,
    ),
    phiClassification: 'none',
    encryptionStatus: 'plaintext_forbidden',
    syncStatus: 'pending',
    retryCount: 0,
    auditEventType: input.auditEventType,
    targetRef: input.targetRef,
    outcome: input.outcome,
    ...(input.businessReason === undefined
      ? {}
      : { businessReason: input.businessReason }),
    prevHash: previousEntryHash ?? AUDIT_GENESIS_PREV_HASH,
  });
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly chains = new Map<string, AuditEvent[]>();

  async record(scope: AuditScope, input: RecordAuditInput): Promise<AuditEvent> {
    const key = scopeKey(scope);
    const chain = this.chains.get(key) ?? [];
    const previous = chain[chain.length - 1];
    const event = buildChainedAuditEvent(
      scope,
      input,
      previous?.entryHash,
      BigInt(chain.length + 1),
    );

    chain.push(event);
    this.chains.set(key, chain);
    return event;
  }

  async list(scope: AuditScope): Promise<readonly AuditEvent[]> {
    return [...(this.chains.get(scopeKey(scope)) ?? [])];
  }
}
