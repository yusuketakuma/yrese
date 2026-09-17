import { createHash, randomUUID } from "node:crypto";

import {
  PRESCRIPTION_DRAFT_MAX_VERSION,
  prescriptionDraftContentSchema,
  prescriptionDraftEffectiveRpGroups,
  prescriptionDraftFlagSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  prescriptionDraftUnresolvedCounts,
  prescriptionLifecycleViewSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionLifecycleView,
  type PrescriptionStatusWire,
  type ReceptionQueueEntry,
} from "@yrese/contracts";
import {
  prescriptionId,
  receptionId,
  type PatientId,
  type PharmacyId,
  type PrescriptionId,
  type ReceptionId,
  type TenantId,
  type UserId,
} from "@yrese/shared-kernel";

import type { ActorQualificationRepository } from "./actor-qualification-repository.js";
import type { AuditRepository } from "./audit-repository.js";
import type { ReceptionRepository } from "./reception-repository.js";

export interface PrescriptionDraftLookupInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly receptionId: ReceptionId;
  readonly businessDate: string;
  readonly wallClock: string;
}

export interface PrescriptionDraftSaveInput extends PrescriptionDraftLookupInput {
  readonly patientId: PatientId;
  readonly expectedVersion: number;
  readonly draft: PrescriptionDraftContent;
  readonly wallClock: string;
}

export type PrescriptionDraftLookupResult =
  | { readonly kind: "found"; readonly draft: PrescriptionDraftResponse }
  | { readonly kind: "empty" }
  | { readonly kind: "not_found" };

export type PrescriptionDraftSaveResult =
  | { readonly kind: "saved"; readonly draft: PrescriptionDraftSaveResponse }
  | { readonly kind: "not_found" }
  | { readonly kind: "conflict"; readonly currentVersion: number }
  /**
   * DOM-004 §1 / WP-7402: 確認・確定後の draft write 拒否(status 非 NULL)。
   */
  | { readonly kind: "locked" };

/**
 * WP-7402: confirm/finalize command の入力。対象は prescriptionId 直接参照
 * (draft の PK)。冪等性は Idempotency-Key 由来の idempotencyKey。
 */
export interface PrescriptionLifecycleCommandInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly prescriptionId: PrescriptionId;
  readonly idempotencyKey: string;
  readonly wallClock: string;
}

export type PrescriptionLifecycleCommandResult =
  | {
      readonly kind: "transitioned";
      readonly view: PrescriptionLifecycleView;
      /** 同一冪等キー再送で既に遷移済みだった場合 true(冪等 replay)。 */
      readonly replayed: boolean;
    }
  | { readonly kind: "not_found" }
  /** SEC-010: scope は route で判定済み。ACTIVE 資格 evidence なし → 403。 */
  | { readonly kind: "unqualified" }
  /** 現在 status からの不許可遷移・別冪等キー再送 → 409 RX-0002。 */
  | { readonly kind: "invalid_transition" }
  /** UNRESOLVED_TEXT 品目残存 → 409 RX-0001。 */
  | { readonly kind: "unresolved_items" }
  /** 原本 metadata 必須項目欠落 → 409 RX-0003。 */
  | { readonly kind: "metadata_incomplete" }
  /** 受付が IN_PROGRESS でない → 409 RX-0004(confirm のみ)。 */
  | { readonly kind: "reception_not_in_progress" };

export interface PrescriptionDraftService {
  get(input: PrescriptionDraftLookupInput): Promise<PrescriptionDraftLookupResult>;
  save(input: PrescriptionDraftSaveInput): Promise<PrescriptionDraftSaveResult>;
  confirm(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult>;
  finalize(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult>;
}

/**
 * 確定対象の原本 metadata 必須項目(WP-7402 packet §5 + 000017 CHECK の
 * 非 NULL 分岐に対応)。処方区分・処方日・用法日数の header 項目と、
 * sourceMetadata の原本記載項目の両方を要求する。
 */
export function isPrescriptionSourceMetadataComplete(
  draft: PrescriptionDraftContent,
): boolean {
  const metadata = draft.sourceMetadata;
  if (metadata === null) return false;
  return (
    draft.prescriptionType !== "UNSPECIFIED" &&
    draft.prescriptionDate !== null &&
    draft.defaultDays !== null &&
    metadata.issueDate !== null &&
    metadata.validUntil !== null &&
    metadata.prescriberName !== null &&
    metadata.medicalInstitution.name !== null
  );
}

/** confirm 可否の正本 guard: UNRESOLVED_TEXT 品目の残存を数える。 */
export function countUnresolvedPrescriptionItems(
  draft: PrescriptionDraftContent,
): number {
  return prescriptionDraftUnresolvedCounts(draft).unresolvedMedicationItems;
}

const FLAG_ORDER: ReadonlyMap<string, number> = new Map(
  prescriptionDraftFlagSchema.options.map(
    (flag, index) => [flag, index] as const,
  ),
);

export function comparePrescriptionDraftFlags(
  left: string,
  right: string,
): number {
  return (
    (FLAG_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (FLAG_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function normalizePrescriptionDraftContent(
  value: unknown,
): PrescriptionDraftContent {
  // 信頼境界のparseはここで1回だけ。以降はparse済み値の並べ替えとコピーであり、
  // 再parseは値を変えない(trimは冪等、refinementは再構築後も成立)ため行わない。
  const parsed = prescriptionDraftContentSchema.parse(value);
  return {
    ...parsed,
    flags: [...parsed.flags].sort(comparePrescriptionDraftFlags),
    rows: parsed.rows.map((row) => ({ ...row })),
    rpGroups: parsed.rpGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    })),
  };
}

/**
 * DOM-002 §4.2b: 保存時の実効構造。rpGroups が正本であり、rows のみの入力は
 * UNRESOLVED_TEXT へ決定的に読み替える(deriveRpGroupsFromLegacyRows)。
 * prescription_draft_rows 旧構造は次版 draft から書かないため、保存内容の
 * rows は常に空とする。
 */
export function materializePrescriptionDraftContent(
  normalized: PrescriptionDraftContent,
): PrescriptionDraftContent {
  return {
    ...normalized,
    rows: [],
    rpGroups: prescriptionDraftEffectiveRpGroups(normalized).map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    })),
  };
}

function hashJsonDeterministically(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function normalizePrescriptionDraftContentWithHash(value: unknown): {
  readonly normalized: PrescriptionDraftContent;
  readonly contentHash: string;
} {
  const normalized = normalizePrescriptionDraftContent(value);
  return {
    normalized,
    contentHash: hashJsonDeterministically(normalized),
  };
}

/**
 * 保存用の normalize + hash。DOM-002 §4.2b の materialize(rows→UNRESOLVED_TEXT
 * 読み替え・rows 空化)を適用した実効構造に対して hash を計算する。
 */
export function normalizePrescriptionDraftContentForStorage(value: unknown): {
  readonly normalized: PrescriptionDraftContent;
  readonly contentHash: string;
} {
  const materialized = materializePrescriptionDraftContent(
    normalizePrescriptionDraftContent(value),
  );
  return {
    normalized: materialized,
    contentHash: hashJsonDeterministically(materialized),
  };
}

export function prescriptionDraftContentHash(
  value: PrescriptionDraftContent,
): string {
  return hashJsonDeterministically(
    normalizePrescriptionDraftContent(value),
  );
}

/**
 * WP-7205 以前に保存された draft の content hash は `sourceMetadata`/`rpGroups`
 * キーを含まない JSON から計算されている。両者は schema 末尾キーなので
 * 除去後も key order が一致する。
 */
export function prescriptionDraftContentHashWithoutSourceMetadata(
  value: PrescriptionDraftContent,
): string {
  const { sourceMetadata: _sourceMetadata, rpGroups: _rpGroups, ...legacy } =
    normalizePrescriptionDraftContent(value);
  return hashJsonDeterministically(legacy);
}

/**
 * 永続行の content_hash 照合候補。schema 改版で additive に追加された末尾キー
 * (rpGroups → sourceMetadata の順に除去)を段階的に落として旧形式 hash を
 * 再現する。wp-7302 以降の行は先頭候補が一致する。
 */
export function prescriptionDraftContentHashCandidates(
  value: PrescriptionDraftContent,
): readonly string[] {
  const normalized = normalizePrescriptionDraftContent(value);
  const { rpGroups: _rpGroups, ...withoutRpGroups } = normalized;
  const { sourceMetadata: _sourceMetadata, ...legacy } = withoutRpGroups;
  return [
    hashJsonDeterministically(normalized),
    hashJsonDeterministically(withoutRpGroups),
    hashJsonDeterministically(legacy),
  ];
}

function scopeKey(input: PrescriptionDraftLookupInput): string {
  return JSON.stringify([
    "yrese.prescription-draft.v1",
    input.tenantId,
    input.pharmacyId,
    input.receptionId,
  ]);
}

async function receptionMatches(
  repository: ReceptionRepository,
  input: PrescriptionDraftLookupInput,
  requireEditable: boolean,
): Promise<ReceptionQueueEntry | undefined> {
  const entries = await repository.list({
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    date: input.businessDate,
  });
  return entries.find(
    (entry) =>
      entry.receptionId === input.receptionId &&
      (!requireEditable ||
        entry.receptionStatus === "WAITING" ||
        entry.receptionStatus === "IN_PROGRESS"),
  );
}

interface InMemoryPrescriptionLifecycleState {
  status: PrescriptionStatusWire | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  confirmIdempotencyKey: string | null;
  finalizeIdempotencyKey: string | null;
  prescriptionVersion: number | null;
}

interface InMemoryPrescriptionDraftRecord {
  response: PrescriptionDraftResponse;
  readonly contentHash: string;
  readonly lifecycle: InMemoryPrescriptionLifecycleState;
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly lockKey: string;
}

function emptyLifecycle(): InMemoryPrescriptionLifecycleState {
  return {
    status: null,
    confirmedBy: null,
    confirmedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    confirmIdempotencyKey: null,
    finalizeIdempotencyKey: null,
    prescriptionVersion: null,
  };
}

export interface PrescriptionFinalizedOutboxIntent {
  readonly outboxEventId: string;
  readonly eventType: "prescription.finalized";
  readonly aggregateType: "prescription";
  readonly aggregateId: string;
  readonly auditEventId: string;
  readonly version: number;
  readonly createdAt: string;
}

function outboxScopeKey(tenantId: TenantId, pharmacyId: PharmacyId): string {
  return JSON.stringify([tenantId, pharmacyId]);
}

/**
 * dev/test 用の in-memory outbox intent(MOD-009 §6)。永続正本は
 * outbox_events。prescription.finalized 専用。
 */
export class InMemoryPrescriptionFinalizedOutbox {
  private readonly intents = new Map<
    string,
    PrescriptionFinalizedOutboxIntent[]
  >();

  appendFor(
    tenantId: TenantId,
    pharmacyId: PharmacyId,
    intent: PrescriptionFinalizedOutboxIntent,
  ): void {
    const key = outboxScopeKey(tenantId, pharmacyId);
    const scoped = this.intents.get(key) ?? [];
    if (
      scoped.some(
        (existing) =>
          existing.aggregateId === intent.aggregateId &&
          existing.eventType === intent.eventType,
      )
    ) {
      throw new Error(
        "outbox intent already exists for this aggregate/event type",
      );
    }
    scoped.push(intent);
    this.intents.set(key, scoped);
  }

  list(
    tenantId: TenantId,
    pharmacyId: PharmacyId,
  ): readonly PrescriptionFinalizedOutboxIntent[] {
    return [
      ...(this.intents.get(outboxScopeKey(tenantId, pharmacyId)) ?? []),
    ];
  }
}

export interface PrescriptionLifecycleDeps {
  /** 未注入なら confirm/finalize は常に unqualified(fail-closed)。 */
  readonly qualificationRepository?: ActorQualificationRepository;
  readonly finalizedOutbox?: InMemoryPrescriptionFinalizedOutbox;
  readonly nextOutboxEventId?: () => string;
}

export class InMemoryPrescriptionDraftService
  implements PrescriptionDraftService
{
  private readonly records = new Map<string, InMemoryPrescriptionDraftRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly receptionRepository: ReceptionRepository,
    private readonly auditRepository: AuditRepository,
    private readonly nextPrescriptionId: () => PrescriptionId = () =>
      prescriptionId(`prescription-${randomUUID()}`),
    private readonly lifecycleDeps: PrescriptionLifecycleDeps = {},
  ) {}

  private async withKeyLock<T>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T> {
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

  async get(
    input: PrescriptionDraftLookupInput,
  ): Promise<PrescriptionDraftLookupResult> {
    const reception = await receptionMatches(
      this.receptionRepository,
      input,
      false,
    );
    if (reception === undefined) {
      return { kind: "not_found" };
    }
    const record = this.records.get(scopeKey(input));
    if (record === undefined) return { kind: "empty" };
    const draft = prescriptionDraftResponseSchema.parse(record.response);
    if (draft.patientId !== reception.patient.patientId) {
      throw new Error("In-memory prescription draft reception mismatch");
    }
    await this.auditRepository.record(
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      {
        actorId: input.actorId,
        auditEventType: "prescription.draft.viewed",
        targetRef: { kind: "prescription", id: draft.prescriptionId },
        outcome: "success",
        wallClock: input.wallClock,
      },
    );
    return { kind: "found", draft };
  }

  async save(
    input: PrescriptionDraftSaveInput,
  ): Promise<PrescriptionDraftSaveResult> {
    const key = scopeKey(input);
    return this.withKeyLock(key, async () => {
      const reception = await receptionMatches(
        this.receptionRepository,
        input,
        true,
      );
      if (
        reception === undefined ||
        reception.patient.patientId !== input.patientId
      ) {
        return { kind: "not_found" };
      }

      const { normalized, contentHash } =
        normalizePrescriptionDraftContentForStorage(input.draft);
      const existing = this.records.get(key);

      if (existing === undefined) {
        if (input.expectedVersion !== 0) {
          return { kind: "conflict", currentVersion: 0 };
        }
        const id = this.nextPrescriptionId();
        await this.auditRepository.record(
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "prescription.created",
            targetRef: { kind: "prescription", id },
            outcome: "success",
            wallClock: input.wallClock,
          },
        );
        const response = prescriptionDraftResponseSchema.parse({
          prescriptionId: id,
          receptionId: input.receptionId,
          patientId: input.patientId,
          businessDate: input.businessDate,
          version: 1,
          draft: normalized,
          createdAt: input.wallClock,
          updatedAt: input.wallClock,
          createdBy: input.actorId,
          updatedBy: input.actorId,
          status: null,
          confirmedBy: null,
          confirmedAt: null,
          finalizedBy: null,
          finalizedAt: null,
          prescriptionVersion: null,
        });
        this.records.set(key, {
          response,
          contentHash,
          lifecycle: emptyLifecycle(),
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          lockKey: key,
        });
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...response,
            saveDisposition: "created",
          }),
        };
      }

      // DOM-004 §1: 確認・確定後の draft write は内容不変性を壊すため拒否する
      // (逆行経路は存在せず、訂正は WP-7403 の新版のみ)。
      if (existing.lifecycle.status !== null) {
        return { kind: "locked" };
      }

      if (input.expectedVersion !== existing.response.version) {
        return {
          kind: "conflict",
          currentVersion: existing.response.version,
        };
      }

      if (existing.contentHash === contentHash) {
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...existing.response,
            saveDisposition: "unchanged",
          }),
        };
      }

      if (existing.response.version >= PRESCRIPTION_DRAFT_MAX_VERSION) {
        throw new Error("Prescription draft version limit reached");
      }

      await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.updated",
          targetRef: {
            kind: "prescription",
            id: existing.response.prescriptionId,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      const response = prescriptionDraftResponseSchema.parse({
        ...existing.response,
        version: existing.response.version + 1,
        draft: normalized,
        updatedAt: new Date(
          Math.max(
            Date.parse(existing.response.updatedAt),
            Date.parse(input.wallClock),
          ),
        ).toISOString(),
        updatedBy: input.actorId,
      });
      this.records.set(key, { ...existing, response, contentHash });
      return {
        kind: "saved",
        draft: prescriptionDraftSaveResponseSchema.parse({
          ...response,
          saveDisposition: "updated",
        }),
      };
    });
  }

  private findRecordByPrescriptionId(
    input: PrescriptionLifecycleCommandInput,
  ): InMemoryPrescriptionDraftRecord | undefined {
    for (const record of this.records.values()) {
      if (
        record.tenantId === input.tenantId &&
        record.pharmacyId === input.pharmacyId &&
        record.response.prescriptionId === input.prescriptionId
      ) {
        return record;
      }
    }
    return undefined;
  }

  private lifecycleView(
    record: InMemoryPrescriptionDraftRecord,
  ): PrescriptionLifecycleView {
    const { response, lifecycle, contentHash } = record;
    if (
      response.status === null ||
      response.confirmedBy === null ||
      response.confirmedAt === null
    ) {
      throw new Error("Prescription lifecycle view requires confirmed state");
    }
    return prescriptionLifecycleViewSchema.parse({
      prescriptionId: response.prescriptionId,
      receptionId: response.receptionId,
      patientId: response.patientId,
      prescriptionType: response.draft.prescriptionType,
      status: response.status,
      draftVersion: response.version,
      prescriptionVersion: lifecycle.prescriptionVersion,
      contentHash,
      confirmedBy: response.confirmedBy,
      confirmedAt: response.confirmedAt,
      finalizedBy: response.finalizedBy,
      finalizedAt: response.finalizedAt,
    });
  }

  /**
   * F-12/F-4 (R3 review): 資格チェックを存在確認より先に行い scope 内存在を
   * 漏らさない(deny 監査は対象の有無に関わらず残る)。状態遷移は clone を
   * 全検証・監査記録後に一度だけ swap し、監査/outbox 失敗時に
   * transitioned だが証跡欠落の半端な状態を残さない(MOD-009 §4.4)。
   */
  private async checkQualificationOrDeny(
    input: PrescriptionLifecycleCommandInput,
    denyEventType: "prescription.confirm.denied" | "prescription.finalize.denied",
  ): Promise<boolean> {
    const qualified =
      (await this.lifecycleDeps.qualificationRepository?.hasActiveQualification(
        {
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          actorId: input.actorId,
          kind: "PHARMACIST_LICENSE",
        },
      )) === true;
    if (qualified) return true;
    await this.auditRepository.record(
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      {
        actorId: input.actorId,
        auditEventType: denyEventType,
        targetRef: { kind: "prescription", id: input.prescriptionId },
        outcome: "denied",
        wallClock: input.wallClock,
      },
    );
    return false;
  }

  async confirm(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult> {
    if (
      !(await this.checkQualificationOrDeny(input, "prescription.confirm.denied"))
    ) {
      return { kind: "unqualified" };
    }
    const record = this.findRecordByPrescriptionId(input);
    if (record === undefined) return { kind: "not_found" };
    return this.withKeyLock(record.lockKey, async () => {
      // save は map エントリを差し替えるため、lock 取得前に掴んだ record は
      // 古い複製になり得る。lock 内で最新エントリを再読込する。
      const fresh = this.records.get(record.lockKey);
      if (fresh === undefined) return { kind: "not_found" };
      const { lifecycle } = fresh;
      if (lifecycle.status === "PHARMACIST_CONFIRMED") {
        if (lifecycle.confirmIdempotencyKey === input.idempotencyKey) {
          return {
            kind: "transitioned",
            view: this.lifecycleView(fresh),
            replayed: true,
          };
        }
        return { kind: "invalid_transition" };
      }
      if (lifecycle.status !== null) {
        return { kind: "invalid_transition" };
      }

      const reception = await receptionMatches(
        this.receptionRepository,
        {
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          actorId: input.actorId,
          receptionId: receptionId(fresh.response.receptionId),
          businessDate: fresh.response.businessDate,
          wallClock: input.wallClock,
        },
        false,
      );
      if (reception?.receptionStatus !== "IN_PROGRESS") {
        return { kind: "reception_not_in_progress" };
      }
      if (countUnresolvedPrescriptionItems(fresh.response.draft) > 0) {
        return { kind: "unresolved_items" };
      }
      if (!isPrescriptionSourceMetadataComplete(fresh.response.draft)) {
        return { kind: "metadata_incomplete" };
      }

      const nextLifecycle = {
        ...fresh.lifecycle,
        status: "PHARMACIST_CONFIRMED" as const,
        confirmedBy: input.actorId,
        confirmedAt: input.wallClock,
        confirmIdempotencyKey: input.idempotencyKey,
      };
      const nextResponse = {
        ...fresh.response,
        status: "PHARMACIST_CONFIRMED" as const,
        confirmedBy: input.actorId,
        confirmedAt: input.wallClock,
      };
      await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.confirmed",
          targetRef: { kind: "prescription", id: input.prescriptionId },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      Object.assign(fresh.lifecycle, nextLifecycle);
      fresh.response = nextResponse;
      return {
        kind: "transitioned",
        view: this.lifecycleView(fresh),
        replayed: false,
      };
    });
  }

  async finalize(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult> {
    if (
      !(await this.checkQualificationOrDeny(input, "prescription.finalize.denied"))
    ) {
      return { kind: "unqualified" };
    }
    const record = this.findRecordByPrescriptionId(input);
    if (record === undefined) return { kind: "not_found" };
    return this.withKeyLock(record.lockKey, async () => {
      // confirm と同様、lock 内で最新エントリを再読込する。
      const fresh = this.records.get(record.lockKey);
      if (fresh === undefined) return { kind: "not_found" };
      const { lifecycle } = fresh;
      if (lifecycle.status === "PRESCRIPTION_FINALIZED") {
        if (lifecycle.finalizeIdempotencyKey === input.idempotencyKey) {
          return {
            kind: "transitioned",
            view: this.lifecycleView(fresh),
            replayed: true,
          };
        }
        return { kind: "invalid_transition" };
      }
      if (lifecycle.status !== "PHARMACIST_CONFIRMED") {
        return { kind: "invalid_transition" };
      }

      // 確定対象の再検証(confirm 後の内容不変は trigger/locked で保証される
      // が、guard 評価を finalize 時点でも行い fail-closed とする)。
      if (countUnresolvedPrescriptionItems(fresh.response.draft) > 0) {
        return { kind: "unresolved_items" };
      }
      if (!isPrescriptionSourceMetadataComplete(fresh.response.draft)) {
        return { kind: "metadata_incomplete" };
      }

      const nextLifecycle = {
        ...fresh.lifecycle,
        status: "PRESCRIPTION_FINALIZED" as const,
        finalizedBy: input.actorId,
        finalizedAt: input.wallClock,
        finalizeIdempotencyKey: input.idempotencyKey,
        prescriptionVersion: 1,
      };
      const nextResponse = {
        ...fresh.response,
        status: "PRESCRIPTION_FINALIZED" as const,
        finalizedBy: input.actorId,
        finalizedAt: input.wallClock,
        prescriptionVersion: 1,
      };
      const auditEvent = await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.finalized",
          targetRef: { kind: "prescription", id: input.prescriptionId },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      this.lifecycleDeps.finalizedOutbox?.appendFor(input.tenantId, input.pharmacyId, {
        outboxEventId: this.lifecycleDeps.nextOutboxEventId?.() ?? randomUUID(),
        eventType: "prescription.finalized",
        aggregateType: "prescription",
        aggregateId: input.prescriptionId,
        auditEventId: auditEvent.eventId,
        version: 1,
        createdAt: input.wallClock,
      });
      Object.assign(fresh.lifecycle, nextLifecycle);
      fresh.response = nextResponse;
      return {
        kind: "transitioned",
        view: this.lifecycleView(fresh),
        replayed: false,
      };
    });
  }
}
