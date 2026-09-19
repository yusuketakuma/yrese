import { randomUUID } from "node:crypto";

import {
  dispensingId,
  type DispensingId,
  type PharmacyId,
  type PrescriptionId,
  type TenantId,
  type UserId,
} from "@yrese/shared-kernel";
import {
  type DispensingItemInput,
  type DispensingRecordView,
  type PrescriptionDraftContent,
} from "@yrese/contracts";

import type { AuditRepository } from "./audit-repository.js";
import type { ActorQualificationRepository } from "./actor-qualification-repository.js";
import type { MasterReadRepository } from "./master-repository.js";
import type { InMemoryPrescriptionFinalizedOutbox } from "./prescription-draft-service.js";

/**
 * WP-7404 / API-021 / DOM-002 §5: 調剤記録(DispensingRecord) service。
 * packet docs/research/wp7404_pre_review_packet_20260919.md §4 が正本。
 *
 * - 対象は確定処方版のみ(version 行は finalize tx でのみ作られる)。
 * - create は dispensing:write、confirm は dispensing:confirm + SEC-010。
 * - 1 版 1 記録、全 rpItem ちょうど 1 回カバー、後発品変更は
 *   genericSubstitutionPermitted + genericNameCode 一致が前提。
 */

/** dispensing guard が必要とする処方側の内部 read(監査を記録しない)。 */
export interface DispensingPrescriptionSource {
  /** (prescription, version) の確定版 content。存在しなければ undefined。 */
  findFinalizedVersionContent(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    prescriptionId: PrescriptionId,
    version: number,
  ): {
    readonly version: number;
    readonly content: PrescriptionDraftContent;
  } | undefined;
  /** 未回答(answer=null)の inquiry が 1 件でもあれば true。 */
  hasOpenInquiry(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    prescriptionId: PrescriptionId,
  ): boolean;
  /**
   * 処方の直列化 lock 下で action を実行する(inquiry 記録との TOCTOU を
   * 防ぐ — PG 側は prescription_drafts FOR UPDATE で等価に直列化)。
   * 処方 record が存在しなければ action を実行せず undefined を返す。
   */
  runWithPrescriptionLock<T>(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    prescriptionId: PrescriptionId,
    action: () => Promise<T>,
  ): Promise<T | undefined>;
}

export interface DispensingCreateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly prescriptionId: PrescriptionId;
  readonly prescriptionVersion: number;
  readonly dispensingDate: string;
  readonly items: readonly DispensingItemInput[];
  readonly idempotencyKey: string;
  readonly wallClock: string;
}

export interface DispensingConfirmInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly dispensingId: DispensingId;
  readonly idempotencyKey: string;
  readonly wallClock: string;
}

export type DispensingCreateResult =
  | {
      readonly kind: "created";
      readonly record: DispensingRecordView;
      readonly replayed: boolean;
    }
  /** 処方/版が scope 内に存在しない → 404 DSP-0003。 */
  | { readonly kind: "not_found" }
  /** 未解決 inquiry 残存 → 409 DSP-0001。 */
  | { readonly kind: "inquiry_unresolved" }
  /** 同一 (prescription, version) の記録既存 → 409 DSP-0007。 */
  | { readonly kind: "already_recorded" }
  /** rpItem 集合不一致・重複 → 400 DSP-0005。 */
  | { readonly kind: "invalid_items" }
  /** 後発品変更不許可・一般名不一致 → 409 DSP-0004。 */
  | { readonly kind: "generic_mismatch" }
  /** 同一 key+別 payload → 409 DSP-0008。 */
  | { readonly kind: "idempotency_conflict" };

export type DispensingConfirmResult =
  | {
      readonly kind: "confirmed";
      readonly record: DispensingRecordView;
      readonly replayed: boolean;
    }
  | { readonly kind: "not_found" }
  /** SEC-010: ACTIVE 資格 evidence なし → 403。 */
  | { readonly kind: "unqualified" }
  /** 確認済みへの別 key 再送 → 409 DSP-0002。 */
  | { readonly kind: "invalid_transition" }
  /** confirm key が別 record で使用済み → 409 DSP-0008。 */
  | { readonly kind: "idempotency_conflict" };

export interface DispensingService {
  create(input: DispensingCreateInput): Promise<DispensingCreateResult>;
  confirm(input: DispensingConfirmInput): Promise<DispensingConfirmResult>;
}

export interface DispensingServiceDeps {
  readonly prescriptionSource: DispensingPrescriptionSource;
  readonly auditRepository: AuditRepository;
  /** 未注入なら confirm は常に unqualified(fail-closed、SEC-010)。 */
  readonly qualificationRepository?: ActorQualificationRepository;
  /** 未注入なら dispensedMedicationItemId 指定の create は fail-closed。 */
  readonly masterRepository?: MasterReadRepository;
  readonly dispensingOutbox?: InMemoryPrescriptionFinalizedOutbox;
  readonly nextOutboxEventId?: () => string;
  readonly nextDispensingId?: () => DispensingId;
}

interface InMemoryDispensingRecord {
  view: DispensingRecordView;
  /** replay 等価比較用の create request 正規化 JSON。 */
  readonly createRequestJson: string;
  readonly idempotencyKey: string;
  confirmIdempotencyKey: string | null;
}

function dispensingScopeKey(
  tenantId: TenantId,
  pharmacyId: PharmacyId,
): string {
  return JSON.stringify([tenantId, pharmacyId]);
}

/**
 * JSONB `=` の等価比較に合わせた canonical JSON 化(キー順正規化)。
 * PG は JSONB が key order を正規化するため、in-memory も同じ正規形で
 * replay 比較する(PG parity)。
 */
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(
          (value as Record<string, unknown>)[key],
        )}`,
    );
  return `{${entries.join(",")}}`;
};

export class InMemoryDispensingService implements DispensingService {
  private readonly records = new Map<string, InMemoryDispensingRecord[]>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly deps: DispensingServiceDeps) {}

  private async withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const predecessor = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = predecessor.then(() => gate);
    this.locks.set(key, tail);
    await predecessor;
    try {
      return await action();
    } finally {
      release();
      if (this.locks.get(key) === tail) this.locks.delete(key);
    }
  }

  /** scope 内 record 配列を get-or-create で返す(新規 scope の detached 配列を共有化)。 */
  private scopedRecords(
    tenantId: TenantId,
    pharmacyId: PharmacyId,
  ): InMemoryDispensingRecord[] {
    const key = dispensingScopeKey(tenantId, pharmacyId);
    const existing = this.records.get(key);
    if (existing !== undefined) return existing;
    const created: InMemoryDispensingRecord[] = [];
    this.records.set(key, created);
    return created;
  }

  async create(input: DispensingCreateInput): Promise<DispensingCreateResult> {
    const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
    // scope 全体で直列化する — key 検索→push / confirm key 検索→設定 の
    // check-then-set を atomic にして PG の scope 内 UNIQUE index と揃える。
    return this.withLock(
      `dispensing:${input.tenantId}:${input.pharmacyId}`,
      async () => {
        const scoped = this.scopedRecords(input.tenantId, input.pharmacyId);
        // JSONB `=` 等価比較に合わせてキー順正規化(PG parity)。
        const requestJson = canonicalJson({
          prescriptionId: input.prescriptionId,
          prescriptionVersion: input.prescriptionVersion,
          dispensingDate: input.dispensingDate,
          items: input.items,
        });
        // 冪等 replay: 同一 key で payload 等価 → stored view、別 payload → 409。
        const byKey = scoped.find(
          (record) => record.idempotencyKey === input.idempotencyKey,
        );
        if (byKey !== undefined) {
          if (byKey.createRequestJson === requestJson) {
            return { kind: "created", record: byKey.view, replayed: true };
          }
          return { kind: "idempotency_conflict" };
        }

        // inquiry 記録との TOCTOU を防ぐため、確定版 read・inquiry guard・
        // record 追加までを処方の直列化 lock 下で行う(PG 側は
        // prescription_drafts FOR UPDATE で等価に直列化)。
        const guarded = await this.deps.prescriptionSource.runWithPrescriptionLock(
          scope,
          input.prescriptionId,
          async () => {
            // guard 3: 確定版の存在(version 行は finalize tx でのみ作られる)。
            const source =
              this.deps.prescriptionSource.findFinalizedVersionContent(
                scope,
                input.prescriptionId,
                input.prescriptionVersion,
              );
            if (source === undefined) {
              return { kind: "not_found" } as const;
            }

            // guard 4: 未解決 inquiry(DOM-004 §1 前提)。
            if (
              this.deps.prescriptionSource.hasOpenInquiry(
                scope,
                input.prescriptionId,
              )
            ) {
              return { kind: "inquiry_unresolved" } as const;
            }

            // guard 5: 1 版 1 記録。
            if (
              scoped.some(
                (record) =>
                  record.view.prescriptionId === input.prescriptionId &&
                  record.view.prescriptionVersion ===
                    input.prescriptionVersion,
              )
            ) {
              return { kind: "already_recorded" } as const;
            }

            // guard 6: items は全 rpItem ちょうど 1 回。
            const sourceItems = new Map(
              source.content.rpGroups.flatMap((group) =>
                group.items.map((item) => [item.rpItemId, item] as const),
              ),
            );
            const seen = new Set<string>();
            for (const item of input.items) {
              if (!sourceItems.has(item.rpItemId) || seen.has(item.rpItemId)) {
                return { kind: "invalid_items" } as const;
              }
              seen.add(item.rpItemId);
            }
            if (seen.size !== sourceItems.size) {
              return { kind: "invalid_items" } as const;
            }

            // guard 7: 後発品変更整合(変更可否 + genericNameCode 一致)。
            // free text 調剤は unresolved 行では許容するが、resolved 行への
            // free text は品目変更(代替)として変更可否を要求する(fail-open
            // にしない)。
            const masters = this.deps.masterRepository;
            for (const item of input.items) {
              const sourceItem = sourceItems.get(item.rpItemId);
              if (sourceItem === undefined) {
                return { kind: "invalid_items" } as const;
              }
              const prescribedId =
                sourceItem.medication.kind === "resolved"
                  ? sourceItem.medication.medicationItemId
                  : null;
              const dispensedId = item.dispensedMedicationItemId;
              if (dispensedId === null) {
                if (
                  prescribedId !== null &&
                  sourceItem.genericSubstitutionPermitted !== true
                ) {
                  return { kind: "generic_mismatch" } as const;
                }
                continue;
              }
              if (dispensedId === prescribedId) continue;
              if (masters === undefined) {
                return { kind: "generic_mismatch" } as const;
              }
              if (sourceItem.genericSubstitutionPermitted !== true) {
                return { kind: "generic_mismatch" } as const;
              }
              const dispensedLookup = await masters.findMedicationItemById(
                scope,
                dispensedId,
              );
              // 処方品目が unresolved、または調剤品目が master 未存在 →
              // 一般名比較不能で fail-closed。
              if (dispensedLookup === undefined || prescribedId === null) {
                return { kind: "generic_mismatch" } as const;
              }
              const prescribedLookup = await masters.findMedicationItemById(
                scope,
                prescribedId,
              );
              // 確定版が参照する master 品目が append-only storage に無いのは
              // 不変条件違反 — fail-closed 500(API-021 §3)。
              if (prescribedLookup === undefined) {
                throw new Error(
                  "dispensing source invariant violated: prescribed master item missing",
                );
              }
              if (
                prescribedLookup.genericNameCode === null ||
                dispensedLookup.genericNameCode === null ||
                prescribedLookup.genericNameCode !==
                  dispensedLookup.genericNameCode
              ) {
                return { kind: "generic_mismatch" } as const;
              }
            }

            const dispensingIdValue =
              this.deps.nextDispensingId?.() ??
              dispensingId(`dispensing-${randomUUID()}`);
            const view: DispensingRecordView = {
              dispensingId: dispensingIdValue,
              prescriptionId: input.prescriptionId,
              prescriptionVersion: input.prescriptionVersion,
              dispensingDate: input.dispensingDate,
              // item 順は rpItemId で正規化(PG replay の ORDER BY と一致)。
              items: input.items
                .map((item) => {
                  const sourceItem = sourceItems.get(item.rpItemId);
                  const prescribedId =
                    sourceItem !== undefined &&
                    sourceItem.medication.kind === "resolved"
                      ? sourceItem.medication.medicationItemId
                      : null;
                  return {
                    rpItemId: item.rpItemId,
                    prescribedMedicationItemId: prescribedId,
                    dispensedMedicationItemId: item.dispensedMedicationItemId,
                    dispensedText: item.dispensedText,
                    quantity: item.quantity,
                    remainingStockAdjustment: item.remainingStockAdjustment,
                    note: item.note,
                    dispensedBy: input.actorId,
                  };
                })
                .sort((a, b) =>
                  a.rpItemId < b.rpItemId
                    ? -1
                    : a.rpItemId > b.rpItemId
                      ? 1
                      : 0,
                ),
              status: null,
              confirmedBy: null,
              confirmedAt: null,
              createdBy: input.actorId,
              createdAt: input.wallClock,
            };
            // 監査を状態確定前に失敗させないため、record 追加は監査成功後に行う
            // (WP-7403 F-5 教訓: 監 audit-only 残存を避ける)。
            await this.deps.auditRepository.record(
              { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
              {
                actorId: input.actorId,
                auditEventType: "dispensing.recorded",
                targetRef: {
                  kind: "dispensing_record",
                  id: `${input.prescriptionId}/${dispensingIdValue}`,
                },
                outcome: "success",
                wallClock: input.wallClock,
              },
            );
            scoped.push({
              view,
              createRequestJson: requestJson,
              idempotencyKey: input.idempotencyKey,
              confirmIdempotencyKey: null,
            });
            return { kind: "created" as const, record: view, replayed: false };
          },
        );
        return guarded ?? ({ kind: "not_found" } as const);
      },
    );
  }

  async confirm(
    input: DispensingConfirmInput,
  ): Promise<DispensingConfirmResult> {
    return this.withLock(
      `dispensing:${input.tenantId}:${input.pharmacyId}`,
      async () => {
        // SEC-010: 資格判定を存在判定より先に評価(WP-7403 順序)。
        const qualified =
          (await this.deps.qualificationRepository?.hasActiveQualification({
            tenantId: input.tenantId,
            pharmacyId: input.pharmacyId,
            actorId: input.actorId,
            kind: "PHARMACIST_LICENSE",
          })) === true;
        if (!qualified) {
          await this.deps.auditRepository.record(
            { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
            {
              actorId: input.actorId,
              auditEventType: "dispensing.confirm.denied",
              targetRef: {
                kind: "dispensing_record",
                id: input.dispensingId,
              },
              outcome: "denied",
              wallClock: input.wallClock,
            },
          );
          return { kind: "unqualified" };
        }

        const record = this.scopedRecords(
          input.tenantId,
          input.pharmacyId,
        ).find((entry) => entry.view.dispensingId === input.dispensingId);
        if (record === undefined) return { kind: "not_found" };
        if (record.view.status !== null) {
          if (record.confirmIdempotencyKey === input.idempotencyKey) {
            return {
              kind: "confirmed",
              record: record.view,
              replayed: true,
            };
          }
          // 確認済みへの別 key 再送は冪等衝突ではなく lifecycle 遷移不可
          // (DSP-0002、WP-7402/7403 の規則と同一)。
          return { kind: "invalid_transition" };
        }
        // confirm key の scope 内一意(PG の UNIQUE index と同規則)。
        if (
          this.scopedRecords(input.tenantId, input.pharmacyId).some(
            (entry) =>
              entry.view.dispensingId !== input.dispensingId &&
              entry.confirmIdempotencyKey === input.idempotencyKey,
          )
        ) {
          return { kind: "idempotency_conflict" };
        }

        const confirmedView: DispensingRecordView = {
          ...record.view,
          status: "DISPENSING_RECORDED",
          confirmedBy: input.actorId,
          confirmedAt: input.wallClock,
        };
        const auditEvent = await this.deps.auditRepository.record(
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "dispensing.confirmed",
            targetRef: {
              kind: "dispensing_record",
              id: `${record.view.prescriptionId}/${input.dispensingId}`,
            },
            outcome: "success",
            wallClock: input.wallClock,
          },
        );
        // outbox intent は監 audit 成功後に揃える(失敗時の孤立を防ぐ)。
        this.deps.dispensingOutbox?.appendFor(input.tenantId, input.pharmacyId, {
          outboxEventId: this.deps.nextOutboxEventId?.() ?? randomUUID(),
          eventType: "dispense.confirmed",
          aggregateType: "dispensing",
          aggregateId: input.dispensingId,
          auditEventId: auditEvent.eventId,
          version: record.view.prescriptionVersion,
          prescriptionId: record.view.prescriptionId,
          createdAt: input.wallClock,
        });
        record.confirmIdempotencyKey = input.idempotencyKey;
        record.view = confirmedView;
        return { kind: "confirmed", record: confirmedView, replayed: false };
      },
    );
  }
}
