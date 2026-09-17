import { createHash } from 'node:crypto';

import type { AuditEvent } from '@yrese/audit';
import type { PatientSearchResult, PatientVersionedSummary } from '@yrese/contracts';
import type { TenantId, PharmacyId, UserId } from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import {
  InMemoryPatientRepository,
  type PatientCreateAttributes,
  type PatientCreateInput,
  type PatientCreateResult,
  type PatientRepository,
  type PatientUpdateAttributes,
  type PatientUpdateInput,
  type PatientUpdateResult,
} from './patient-repository.js';

export type { PatientCreateAttributes } from './patient-repository.js';

/**
 * WP-7202: 患者登録・更新のコマンド境界(unit of work)。
 *
 * 不変条件:
 * - 「作成された患者は、正確に1件の durable な patient.created 監査なしには
 *   durable であってはならない」。更新は patient.updated に同じ。
 * - 重複候補 warnings を応答へ返す場合、候補列挙(PHI アクセス)は
 *   patient.searched 監査も永続化される。記録順は searched → created とし、
 *   created 失敗時に searched だけが残っても「実際に起きた列挙アクセス」の
 *   誠実な記録として整合する(逆順では列挙なしの患者が残りうる)。
 * - Postgres 実装は単一トランザクションで原子化し、in-memory は監査失敗時に
 *   補償(rollbackCreated / rollbackUpdate)で同じ収束状態へ戻す。
 * - 監査 payload は識別子と件数のみ。氏名・カナ・生年月日・保険者番号等の
 *   PHI は監査・ログ・エラー応答へ出さない。
 */

export const patientCreateAuditEventType = 'patient.created';
export const patientUpdateAuditEventType = 'patient.updated';
export const patientSearchedAuditEventType = 'patient.searched';
export const patientCommandAggregateType = 'patient';
export const patientDuplicateSearchTargetKind = 'patient_search';

const patientAuditAppendErrorInstances = new WeakSet<object>();

/** 監査追記失敗。hostile な失敗値を検査しない WeakSet 恒等判定。 */
export class PatientAuditAppendError extends Error {
  constructor(cause: unknown) {
    super('patient audit append failed', { cause });
    this.name = 'PatientAuditAppendError';
    patientAuditAppendErrorInstances.add(this);
  }
}

export function isPatientAuditAppendError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    patientAuditAppendErrorInstances.has(value)
  );
}

/** POST /patients の冪等判定 fingerprint(正規化 request の sha256)。 */
export function patientCreateRequestFingerprint(
  attributes: PatientCreateAttributes,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        name: attributes.name,
        kana: attributes.kana,
        birthDate: attributes.birthDate,
        sex: attributes.sex,
        patientNumber: attributes.patientNumber ?? null,
      }),
      'utf8',
    )
    .digest('hex');
}

export interface PatientCreateCommandInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly attributes: PatientCreateAttributes;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  /** ISO instant。created_at/updated_at と監査 wallClock の基準。 */
  readonly recordedAt: string;
  /** 監査 wallClock 供給者。created 経路でだけ読まれる。 */
  readonly auditWallClock: () => string;
  /** サーバー採番の patientId(command 実装が生成・検証済みで受け取る)。 */
  readonly mintPatientId: () => PatientCreateInput['patientId'];
}

export type PatientCreateCommandResult =
  | {
      readonly kind: 'created';
      readonly patient: PatientVersionedSummary;
      readonly duplicateCandidates: readonly PatientSearchResult[];
      readonly undo: unknown;
      /** [searched?, created] の順で記録済みの監査イベント。 */
      readonly auditEvents: readonly unknown[];
    }
  | { readonly kind: 'existing'; readonly patient: PatientVersionedSummary }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'patient_number_conflict' };

export interface PatientUpdateCommandInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientUpdateInput['patientId'];
  readonly expectedVersion: number;
  readonly attributes: PatientUpdateAttributes;
  readonly actorId: UserId;
  readonly recordedAt: string;
  readonly auditWallClock: () => string;
}

export type PatientUpdateCommandResult =
  | {
      readonly kind: 'updated';
      readonly patient: PatientVersionedSummary;
      readonly undo: unknown;
      readonly auditEvent: unknown;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'version_conflict'; readonly currentVersion: number };

export interface PatientWriteCommand {
  createPatient(
    input: PatientCreateCommandInput,
  ): Promise<PatientCreateCommandResult>;
  updatePatient(
    input: PatientUpdateCommandInput,
  ): Promise<PatientUpdateCommandResult>;
}

export interface ComposedPatientWriteCommandOptions {
  readonly patientRepository: PatientRepository;
  readonly auditRepository: AuditRepository;
  /**
   * 監査失敗時の補償(in-memory unit of work 用)。Postgres 実装は
   * トランザクションで巻き戻すため使わない。未指定なら補償しない
   * (注入モックのような無状態リポジトリ向け)。
   */
  readonly compensateCreated?: (undo: unknown) => void | Promise<void>;
  readonly compensateUpdated?: (undo: unknown) => void | Promise<void>;
}

async function recordAudit(
  auditRepository: AuditRepository,
  scope: { readonly tenantId: TenantId; readonly pharmacyId: PharmacyId },
  intent: {
    readonly actorId: UserId;
    readonly auditEventType: string;
    readonly targetRef: { readonly kind: string; readonly id: string };
    readonly outcome: 'success';
    readonly wallClock: string;
  },
): Promise<AuditEvent> {
  try {
    return (await auditRepository.record(
      Object.freeze(scope),
      Object.freeze(intent),
    )) as AuditEvent;
  } catch (error) {
    throw new PatientAuditAppendError(error);
  }
}

/**
 * 既存リポジトリ合成のコマンド実装(in-memory / dev / test)。
 * create: repo.create → (候補あれば) patient.searched → patient.created。
 * いずれの監査失敗でも補償で患者を巻き戻す。
 */
export class ComposedPatientWriteCommand implements PatientWriteCommand {
  private readonly patientRepository: PatientRepository;
  private readonly auditRepository: AuditRepository;
  private readonly compensateCreated:
    | ((undo: unknown) => void | Promise<void>)
    | undefined;
  private readonly compensateUpdated:
    | ((undo: unknown) => void | Promise<void>)
    | undefined;

  constructor(options: ComposedPatientWriteCommandOptions) {
    this.patientRepository = options.patientRepository;
    this.auditRepository = options.auditRepository;
    this.compensateCreated = options.compensateCreated;
    this.compensateUpdated = options.compensateUpdated;
  }

  async createPatient(
    input: PatientCreateCommandInput,
  ): Promise<PatientCreateCommandResult> {
    const scope = Object.freeze({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
    });
    const result: PatientCreateResult = await this.patientRepository.create({
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
      return result;
    }

    const wallClock = input.auditWallClock();
    const auditEvents: unknown[] = [];
    try {
      if (result.duplicateCandidates.length > 0) {
        auditEvents.push(
          await recordAudit(this.auditRepository, scope, {
            actorId: input.actorId,
            auditEventType: patientSearchedAuditEventType,
            targetRef: Object.freeze({
              kind: patientDuplicateSearchTargetKind,
              id: `duplicates:${result.duplicateCandidates.length}`,
            }),
            outcome: 'success',
            wallClock,
          }),
        );
      }
      auditEvents.push(
        await recordAudit(this.auditRepository, scope, {
          actorId: input.actorId,
          auditEventType: patientCreateAuditEventType,
          targetRef: Object.freeze({
            kind: patientCommandAggregateType,
            id: result.patient.patientId,
          }),
          outcome: 'success',
          wallClock,
        }),
      );
    } catch (error) {
      try {
        await this.compensateCreated?.(result.undo);
      } catch {
        // 補償自体の失敗も同じ 500 に吸収(状態は fail-visible)。
      }
      throw error;
    }
    return { ...result, auditEvents: Object.freeze(auditEvents) };
  }

  async updatePatient(
    input: PatientUpdateCommandInput,
  ): Promise<PatientUpdateCommandResult> {
    const scope = Object.freeze({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
    });
    const result: PatientUpdateResult = await this.patientRepository.update({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      patientId: input.patientId,
      expectedVersion: input.expectedVersion,
      attributes: input.attributes,
      actorId: input.actorId,
      recordedAt: input.recordedAt,
    });
    if (result.kind !== 'updated') {
      return result;
    }

    let auditEvent: AuditEvent;
    try {
      auditEvent = await recordAudit(this.auditRepository, scope, {
        actorId: input.actorId,
        auditEventType: patientUpdateAuditEventType,
        targetRef: Object.freeze({
          kind: patientCommandAggregateType,
          id: result.patient.patientId,
        }),
        outcome: 'success',
        wallClock: input.auditWallClock(),
      });
    } catch (error) {
      try {
        await this.compensateUpdated?.(result.undo);
      } catch {
        // 補償自体の失敗も同じ 500 に吸収。
      }
      throw error;
    }
    return { ...result, auditEvent };
  }
}

/**
 * buildServer の既定合成: 既定の InMemoryPatientRepository を使う場合だけ
 * 補償を結線する(注入リポジトリには勝手な補償をしない)。
 */
export function composeDefaultPatientWriteCommand(options: {
  readonly patientRepository: PatientRepository;
  readonly auditRepository: AuditRepository;
}): ComposedPatientWriteCommand {
  const { patientRepository } = options;
  return new ComposedPatientWriteCommand({
    ...options,
    ...(patientRepository instanceof InMemoryPatientRepository
      ? {
          compensateCreated: (undo: unknown) =>
            patientRepository.rollbackCreated(undo),
          compensateUpdated: (undo: unknown) =>
            patientRepository.rollbackUpdate(undo),
        }
      : {}),
  });
}
