import { randomUUID } from 'node:crypto';

import type { ReceptionQueueEntry } from '@yrese/contracts';
import type { AuditEvent } from '@yrese/audit';
import type {
  PatientId,
  PharmacyId,
  ReceptionId,
  TenantId,
  UserId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import {
  InMemoryReceptionRepository,
  type ReceptionCreateInput,
  type ReceptionCreateProvenance,
  type ReceptionCreateResult,
  type ReceptionRepository,
} from './reception-repository.js';

/**
 * WP-4050: 受付コマンド境界(unit of work)。
 *
 * 「成功した受付は、正確に1件の durable な reception.created 監査イベントと
 * 1件の outbox intent なしには存在できない」を境界の不変条件とする。
 *
 * 二相構成:
 * 1. `execute` — リポジトリ create。**結果オブジェクトには一切触れず**素通しする
 *    (HTTP 層の own-property 単一読取り・hostile 入力正規化の規律を保存する)。
 * 2. HTTP 層が結果を検証した後、検証済み provenance だけを渡して
 *    `ensureCreatedEvidence`(created)/ `classifyExisting`(existing)を呼ぶ。
 *
 * Postgres 実装(db/reception-command.ts)は `execute` 内の単一トランザクションで
 * 受付・監査・outbox を原子化し、evidence を結果へ添付して返す(真の原子性)。
 * in-memory 実装は evidence 失敗時の補償(rollback)で同じ収束状態へ戻す
 * (dev/test 用の意味論的パリティ。トランザクションではないため、途中クラッシュは
 * Postgres と異なり orphan を残しうる — それは再送時に legacy_orphan として
 * 明示分類される)。
 *
 * legacy_orphan は「outbox intent を持たない既存受付」(境界導入前の行を含む)の
 * 明示的な照合結果であり、元の actor / 時刻を捏造する修復は行わない。
 */

export const receptionCommandAuditEventType = 'reception.created';
export const receptionCommandAggregateType = 'reception';

export interface ReceptionCreateCommandInput extends ReceptionCreateInput {
  readonly actorId: UserId;
  /**
   * 監査 wallClock 供給者。created 経路でだけ、正確に1回読まれる
   * (existing / conflict 経路で時計を読まない)。Postgres 実装がトランザクション内
   * 監査追記に使う。in-memory 実装は使わず、HTTP 層が検証後に読んだ値を
   * `ensureCreatedEvidence` へ渡す(従来の時計読取り位置を保存)。
   */
  readonly auditWallClock: () => string;
}

export interface ReceptionOutboxIntent {
  readonly outboxEventId: string;
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly eventType: typeof receptionCommandAuditEventType;
  readonly aggregateType: typeof receptionCommandAggregateType;
  readonly aggregateId: ReceptionId;
  /** 識別子のみ(PHI 非含有)。 */
  readonly patientId: PatientId;
  readonly createdAt: string;
  /** 監査イベントとの紐づけ。永続実装は同一トランザクションで確定する。 */
  readonly auditEventId?: string;
  readonly deliveredAt: null;
}

export type ReceptionCreateCommandResult =
  | {
      readonly kind: 'created';
      readonly entry: ReceptionQueueEntry;
      readonly provenance: ReceptionCreateProvenance;
      readonly auditEvent: AuditEvent;
      readonly outboxIntent: ReceptionOutboxIntent;
    }
  | {
      readonly kind: 'existing_complete';
      readonly entry: ReceptionQueueEntry;
      readonly provenance: ReceptionCreateProvenance;
    }
  | {
      readonly kind: 'legacy_orphan';
      readonly entry: ReceptionQueueEntry;
      readonly provenance: ReceptionCreateProvenance;
      /** 照合根拠: この受付に対する outbox intent が存在しない。 */
      readonly missingOutboxIntent: true;
    }
  | {
      readonly kind: 'idempotency_conflict';
      readonly provenance: ReceptionCreateProvenance;
    };

/** execute が返しうる形: リポジトリ素通し形、または evidence 添付済み形。 */
export type ReceptionCreateExecuteResult =
  | ReceptionCreateResult
  | ReceptionCreateCommandResult;

export type ReceptionExistingClassification = 'existing_complete' | 'legacy_orphan';

export interface EnsureCreatedEvidenceInput {
  /** execute が返した結果オブジェクト(Postgres 実装が添付 evidence を読む)。 */
  readonly result: unknown;
  /** HTTP 層で検証済みの provenance。 */
  readonly provenance: ReceptionCreateProvenance;
  readonly actorId: UserId;
  readonly wallClock: string;
}

export interface ReceptionCreateCommand {
  /**
   * リポジトリ結果(または evidence 添付済み結果)の promise をそのまま返す。
   * 実装は結果値へ一切触れてはならず、async ラッパで再同化してもならない
   * (HTTP 層の単一 await・単一読取り規律を保存する)。
   */
  execute(input: ReceptionCreateCommandInput): Promise<ReceptionCreateExecuteResult>;
  /**
   * created 結果の監査/outbox evidence を確定し、監査結果の promise を
   * **加工せずに**返す(返り値へ触れる・再同化することは規律違反)。
   * outbox 追記失敗は補償の上 ReceptionOutboxAppendError を投げる。
   * 監査追記失敗は raw のまま reject させ、呼び出し側が
   * rollbackCreatedEvidence で巻き戻す(hostile な失敗値を検査しないため)。
   */
  ensureCreatedEvidence(input: EnsureCreatedEvidenceInput): Promise<unknown>;
  /** 監査追記失敗後の巻き戻し(outbox intent と受付の補償)。 */
  rollbackCreatedEvidence(provenance: ReceptionCreateProvenance): Promise<void>;
  /** existing 結果を outbox intent の有無で分類する。 */
  classifyExisting(
    provenance: ReceptionCreateProvenance,
  ): Promise<ReceptionExistingClassification>;
}

const auditAppendErrorInstances = new WeakSet<object>();
const outboxAppendErrorInstances = new WeakSet<object>();

/** 監査追記失敗。 */
export class ReceptionAuditAppendError extends Error {
  constructor(cause: unknown) {
    super('reception audit append failed', { cause });
    this.name = 'ReceptionAuditAppendError';
    auditAppendErrorInstances.add(this);
  }
}

/** outbox intent 追記失敗(unit of work を巻き戻した上で投げる)。 */
export class ReceptionOutboxAppendError extends Error {
  constructor(cause: unknown) {
    super('reception outbox append failed', { cause });
    this.name = 'ReceptionOutboxAppendError';
    outboxAppendErrorInstances.add(this);
  }
}

/**
 * WeakSet 恒等判定。instanceof は hostile な例外値の prototype trap を
 * 起動しうるため使わない(値へ一切触れない判定)。
 */
export function isReceptionAuditAppendError(value: unknown): boolean {
  return typeof value === 'object' && value !== null && auditAppendErrorInstances.has(value);
}

export function isReceptionOutboxAppendError(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && outboxAppendErrorInstances.has(value)
  );
}

interface OutboxScope {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
}

function outboxScopeKey(scope: OutboxScope): string {
  return `${scope.tenantId} ${scope.pharmacyId}`;
}

/**
 * in-memory outbox intent 保存(dev/test)。永続 outbox は migrations/000005 の
 * outbox_events が正本。配送 worker は本スライスに存在せず、intent は pending のまま。
 * in-memory intent は auditEventId を保持しない(監査結果オブジェクトへ触れると
 * HTTP 層の単一読取り規律を壊すため)。永続実装は audit_event_id を同一
 * トランザクションで確定する。
 */
export class InMemoryReceptionOutbox {
  private readonly intents = new Map<string, ReceptionOutboxIntent[]>();

  append(intent: ReceptionOutboxIntent): void {
    const key = outboxScopeKey(intent);
    const scoped = this.intents.get(key) ?? [];
    const duplicate = scoped.some(
      (existing) =>
        existing.aggregateType === intent.aggregateType &&
        existing.aggregateId === intent.aggregateId &&
        existing.eventType === intent.eventType,
    );
    if (duplicate) {
      throw new Error('outbox intent already exists for this aggregate/event type');
    }
    scoped.push(intent);
    this.intents.set(key, scoped);
  }

  /** 補償: まだ確定していない同一 unit of work 内の intent の巻き戻し専用。 */
  rollbackUncommittedByAggregate(scope: OutboxScope, aggregateId: ReceptionId): void {
    const key = outboxScopeKey(scope);
    const scoped = this.intents.get(key) ?? [];
    const index = scoped.findIndex(
      (intent) =>
        intent.aggregateType === receptionCommandAggregateType &&
        intent.aggregateId === aggregateId &&
        intent.eventType === receptionCommandAuditEventType,
    );
    if (index === -1) {
      throw new Error('outbox intent to roll back was not found');
    }
    scoped.splice(index, 1);
    this.intents.set(key, scoped);
  }

  hasIntent(scope: OutboxScope, aggregateId: ReceptionId): boolean {
    return (this.intents.get(outboxScopeKey(scope)) ?? []).some(
      (intent) =>
        intent.aggregateType === receptionCommandAggregateType &&
        intent.aggregateId === aggregateId &&
        intent.eventType === receptionCommandAuditEventType,
    );
  }

  list(scope: OutboxScope): readonly ReceptionOutboxIntent[] {
    return [...(this.intents.get(outboxScopeKey(scope)) ?? [])];
  }
}

export interface ComposedReceptionCreateCommandOptions {
  readonly receptionRepository: ReceptionRepository;
  readonly auditRepository: AuditRepository;
  readonly outbox?: InMemoryReceptionOutbox;
  /**
   * created 済み受付の補償(in-memory unit of work 用)。Postgres 実装は
   * トランザクションで巻き戻すため使わない。未指定なら補償は行われない
   * (注入モックのような無状態リポジトリ向け)。
   */
  readonly compensateCreated?: (
    provenance: ReceptionCreateProvenance,
  ) => void | Promise<void>;
}

/**
 * 既存リポジトリ合成のコマンド実装(in-memory / dev / test)。
 * execute はリポジトリ結果へ一切触れない素通し。evidence 確定は
 * outbox append → audit record の順(監査チェーンは append-only で補償不能な
 * ため最後に置き、それ以前の失敗は outbox / reception の補償で巻き戻す)。
 */
export class ComposedReceptionCreateCommand implements ReceptionCreateCommand {
  readonly outbox: InMemoryReceptionOutbox;
  private readonly receptionRepository: ReceptionRepository;
  private readonly auditRepository: AuditRepository;
  private readonly compensateCreated:
    | ((provenance: ReceptionCreateProvenance) => void | Promise<void>)
    | undefined;

  constructor(options: ComposedReceptionCreateCommandOptions) {
    this.receptionRepository = options.receptionRepository;
    this.auditRepository = options.auditRepository;
    this.outbox = options.outbox ?? new InMemoryReceptionOutbox();
    this.compensateCreated = options.compensateCreated;
  }

  execute(input: ReceptionCreateCommandInput): Promise<ReceptionCreateExecuteResult> {
    // リポジトリ入力は従来の5フィールドへ絞る(actorId / auditWallClock を渡さない)。
    // 非 async・素通し: 返り値の promise/値に一切触れず再同化もしない
    // (hostile 入力の単一 await・単一読取り規律は HTTP 層が所有する)。
    return this.receptionRepository.create({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      patient: input.patient,
      idempotencyKey: input.idempotencyKey,
      acceptedAt: input.acceptedAt,
    });
  }

  ensureCreatedEvidence(input: EnsureCreatedEvidenceInput): Promise<unknown> {
    const { provenance, actorId, wallClock } = input;
    const scope = { tenantId: provenance.tenantId, pharmacyId: provenance.pharmacyId };
    const outboxIntent: ReceptionOutboxIntent = {
      outboxEventId: randomUUID(),
      tenantId: provenance.tenantId,
      pharmacyId: provenance.pharmacyId,
      eventType: receptionCommandAuditEventType,
      aggregateType: receptionCommandAggregateType,
      aggregateId: provenance.receptionId,
      patientId: provenance.patientId,
      createdAt: wallClock,
      deliveredAt: null,
    };

    try {
      this.outbox.append(outboxIntent);
    } catch (error) {
      const compensation = Promise.resolve(this.compensateCreated?.(provenance));
      return compensation.then(() => {
        throw new ReceptionOutboxAppendError(error);
      });
    }

    // 監査結果の promise を加工せずに返す(async/await/then で挟むと thenable な
    // hostile 値が再同化され、HTTP 層の trap 回数規律が壊れる)。失敗時の巻き戻しは
    // 呼び出し側が rollbackCreatedEvidence で行う。
    // scope / intent / targetRef は凍結して渡す(監査側での改変を防ぐ既存規律)。
    return this.auditRepository.record(
      Object.freeze(scope),
      Object.freeze({
        actorId,
        auditEventType: receptionCommandAuditEventType,
        targetRef: Object.freeze({
          kind: receptionCommandAggregateType,
          id: provenance.receptionId,
        }),
        outcome: 'success' as const,
        wallClock,
      }),
    );
  }

  async rollbackCreatedEvidence(provenance: ReceptionCreateProvenance): Promise<void> {
    const scope = { tenantId: provenance.tenantId, pharmacyId: provenance.pharmacyId };
    this.outbox.rollbackUncommittedByAggregate(scope, provenance.receptionId);
    await this.compensateCreated?.(provenance);
  }

  async classifyExisting(
    provenance: ReceptionCreateProvenance,
  ): Promise<ReceptionExistingClassification> {
    const scope = { tenantId: provenance.tenantId, pharmacyId: provenance.pharmacyId };
    return this.outbox.hasIntent(scope, provenance.receptionId)
      ? 'existing_complete'
      : 'legacy_orphan';
  }
}

/**
 * buildServer の既定合成: 既定の InMemoryReceptionRepository を使う場合だけ
 * 補償を結線する(注入リポジトリには勝手な補償をしない)。
 */
export function composeDefaultReceptionCreateCommand(options: {
  readonly receptionRepository: ReceptionRepository;
  readonly auditRepository: AuditRepository;
  readonly outbox: InMemoryReceptionOutbox;
}): ComposedReceptionCreateCommand {
  const { receptionRepository } = options;
  return new ComposedReceptionCreateCommand({
    ...options,
    ...(receptionRepository instanceof InMemoryReceptionRepository
      ? {
          compensateCreated: (provenance: ReceptionCreateProvenance) =>
            receptionRepository.rollbackCreated(provenance),
        }
      : {}),
  });
}
