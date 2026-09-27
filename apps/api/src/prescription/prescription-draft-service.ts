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
  type PrescriptionInquiryResult,
  type PrescriptionInquiryView,
  type PrescriptionLifecycleView,
  type PrescriptionRpGroup,
  type PrescriptionRpMedicationRef,
  type PrescriptionRpUsageRef,
  type PrescriptionStatusWire,
  type PrescriptionVersionView,
  type ReceptionQueueEntry,
  prescriptionInquiryViewSchema,
  prescriptionVersionViewSchema,
} from "@yrese/contracts";
import {
  prescriptionId,
  prescriptionInquiryId,
  receptionId,
  type PatientId,
  type PharmacyId,
  type PrescriptionId,
  type PrescriptionInquiryId,
  type ReceptionId,
  type TenantId,
  type UserId,
} from "@yrese/shared-kernel";

import type { ActorQualificationRepository } from '../actor-qualification-repository.js';
import type { AuditRepository } from '../audit/audit-repository.js';
import type {
  MasterReadRepository,
  MasterRepository,
} from '../master/master-repository.js';
import type { ReceptionRepository } from '../reception/reception-repository.js';
import {
  copiedContentFromPriorVersion,
  receptionMatches,
  scopeKey,
} from './prescription-draft-copy.js';
import {
  emptyLifecycle,
  InMemoryPrescriptionFinalizedOutbox,
  type InMemoryPrescriptionDraftRecord,
  type InMemoryPrescriptionInquiryRecord,
  type InMemoryPrescriptionLifecycleState,
  type InMemoryPrescriptionVersionRecord,
  type PrescriptionFinalizedOutboxIntent,
} from './prescription-draft-records.js';
import {
  isPrescriptionSourceMetadataComplete,
  countUnresolvedPrescriptionItems,
  normalizePrescriptionDraftContentForStorage,
} from './prescription-draft-content.js';

export {
  comparePrescriptionDraftFlags,
  countUnresolvedPrescriptionItems,
  isPrescriptionSourceMetadataComplete,
  normalizePrescriptionDraftContent,
  normalizePrescriptionDraftContentForStorage,
  normalizePrescriptionDraftContentWithHash,
  prescriptionDraftContentHash,
  prescriptionDraftContentHashCandidates,
  prescriptionDraftContentHashWithoutSourceMetadata,
} from './prescription-draft-content.js';


import type {
  PrescriptionDraftLookupInput,
  PrescriptionDraftSaveInput,
  PrescriptionDraftLookupResult,
  PrescriptionDraftSaveResult,
  PrescriptionLifecycleCommandInput,
  PrescriptionLifecycleCommandResult,
  PrescriptionDraftFromPriorInput,
  PrescriptionDraftFromPriorResult,
  PrescriptionDraftService,
  PrescriptionInquiryCreateInput,
  PrescriptionInquiryAnswerInput,
  PrescriptionAmendInput,
  PrescriptionScopedReadInput,
  PrescriptionVersionReadInput,
  PrescriptionInquiryCreateResult,
  PrescriptionInquiryAnswerResult,
  PrescriptionAmendResult,
  PrescriptionVersionListResult,
  PrescriptionVersionGetResult,
  PrescriptionInquiryListResult,
} from './prescription-draft-types.js';
export * from './prescription-draft-types.js';
export { copiedContentFromPriorVersion } from './prescription-draft-copy.js';
export { InMemoryPrescriptionFinalizedOutbox } from './prescription-draft-records.js';
export type {
  InMemoryPrescriptionInquiryRecord,
  InMemoryPrescriptionVersionRecord,
  PrescriptionFinalizedOutboxIntent,
} from './prescription-draft-records.js';

export interface PrescriptionLifecycleDeps {
  /** 未注入なら confirm/finalize/amend は常に unqualified(fail-closed)。 */
  readonly qualificationRepository?: ActorQualificationRepository;
  readonly finalizedOutbox?: InMemoryPrescriptionFinalizedOutbox;
  readonly nextOutboxEventId?: () => string;
  /** WP-7403: inquiry ID 生成器。未注入なら UUID 生成。 */
  readonly nextInquiryId?: () => PrescriptionInquiryId;
  /**
   * WP-7304: 前回 Do の master 再解決。未注入なら createFromPrior は
   * 複製元の resolved ref を安全に変換できないため fail する。
   */
  readonly masterRepository?: MasterRepository;
}

export class InMemoryPrescriptionDraftService
  implements PrescriptionDraftService
{
  private readonly records = new Map<string, InMemoryPrescriptionDraftRecord>();
  private readonly locks = new Map<string, Promise<void>>();
  private inquiryRecordedSeq = 0;

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
          copiedFrom: null,
        });
        this.records.set(key, {
          response,
          contentHash,
          lifecycle: emptyLifecycle(),
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          lockKey: key,
          versions: [],
          inquiries: [],
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

  /**
   * WP-7304 / PRD-001 M4: 前回 Do。確定版 content を再解決付きで複製し、
   * 受付の新規 draft として保存する。複製元の PHI read と新規作成の監査を
   * 状態適用より先に記録する(WP-7402 と同じ evidence-first 規則)。
   */
  async createFromPrior(
    input: PrescriptionDraftFromPriorInput,
  ): Promise<PrescriptionDraftFromPriorResult> {
    const masters = this.lifecycleDeps.masterRepository;
    if (masters === undefined) {
      throw new Error("Master repository is required for from-prior copies");
    }
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
      if (this.records.has(key)) {
        return { kind: "conflict" };
      }
      const source = this.findRecordByPrescriptionId({
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        prescriptionId: input.sourcePrescriptionId,
      });
      const sourceVersion =
        source === undefined
          ? undefined
          : input.sourceVersion === undefined
            ? source.versions.at(-1)
            : source.versions.find(
                (entry) => entry.version === input.sourceVersion,
              );
      if (source === undefined || sourceVersion === undefined) {
        return { kind: "not_found" };
      }
      const copied = await copiedContentFromPriorVersion(
        masters,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        sourceVersion.content,
        input.businessDate,
      );
      const { normalized, contentHash } =
        normalizePrescriptionDraftContentForStorage(copied);
      const id = this.nextPrescriptionId();
      const auditScope = {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
      };
      await this.auditRepository.record(auditScope, {
        actorId: input.actorId,
        auditEventType: "prescription.draft.viewed",
        targetRef: { kind: "prescription", id: input.sourcePrescriptionId },
        outcome: "success",
        wallClock: input.wallClock,
      });
      await this.auditRepository.record(auditScope, {
        actorId: input.actorId,
        auditEventType: "prescription.created",
        targetRef: { kind: "prescription", id },
        outcome: "success",
        wallClock: input.wallClock,
      });
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
        copiedFrom: {
          prescriptionId: input.sourcePrescriptionId,
          version: sourceVersion.version,
        },
      });
      this.records.set(key, {
        response,
        contentHash,
        lifecycle: emptyLifecycle(),
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        lockKey: key,
        versions: [],
        inquiries: [],
      });
      return {
        kind: "saved",
        draft: prescriptionDraftSaveResponseSchema.parse({
          ...response,
          saveDisposition: "created",
        }),
      };
    });
  }

  private findRecordByPrescriptionId(
    input: {
      readonly tenantId: TenantId;
      readonly pharmacyId: PharmacyId;
      readonly prescriptionId: PrescriptionId;
    },
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
    denyEventType:
      | "prescription.confirm.denied"
      | "prescription.finalize.denied"
      | "prescription.amend.denied",
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
      // v1 immutable snapshot。確定時点の materialized content を保持する。
      const versionRecord: InMemoryPrescriptionVersionRecord = {
        version: 1,
        content: fresh.response.draft,
        contentHash: fresh.contentHash,
        supersedesVersion: null,
        inquiryId: null,
        amendedBy: null,
        amendedAt: null,
        amendIdempotencyKey: null,
        confirmedBy: fresh.lifecycle.confirmedBy ?? input.actorId,
        confirmedAt: fresh.lifecycle.confirmedAt ?? input.wallClock,
        finalizedBy: input.actorId,
        finalizedAt: input.wallClock,
        createdAt: input.wallClock,
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
      fresh.versions.push(versionRecord);
      return {
        kind: "transitioned",
        view: this.lifecycleView(fresh),
        replayed: false,
      };
    });
  }

  private findInquiryRecord(
    fresh: InMemoryPrescriptionDraftRecord,
    inquiryId: PrescriptionInquiryId,
  ): InMemoryPrescriptionInquiryRecord | undefined {
    return fresh.inquiries.find((entry) => entry.inquiryId === inquiryId);
  }

  private inquiryView(
    record: InMemoryPrescriptionInquiryRecord,
  ): PrescriptionInquiryView {
    return prescriptionInquiryViewSchema.parse({
      inquiryId: record.inquiryId,
      prescriptionId: record.prescriptionId,
      directedTo: record.directedTo,
      content: record.content,
      answer: record.answer,
      answeredBy: record.answeredBy,
      answeredAt: record.answeredAt,
      result: record.result,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      status: record.answer === null ? "OPEN" : "RESOLVED",
    });
  }

  private versionView(
    record: InMemoryPrescriptionVersionRecord,
    prescriptionIdValue: PrescriptionId,
  ): PrescriptionVersionView {
    return prescriptionVersionViewSchema.parse({
      prescriptionId: prescriptionIdValue,
      version: record.version,
      content: record.content,
      contentHash: record.contentHash,
      supersedesVersion: record.supersedesVersion,
      inquiryId: record.inquiryId,
      amendedBy: record.amendedBy,
      amendedAt: record.amendedAt,
      confirmedBy: record.confirmedBy,
      confirmedAt: record.confirmedAt,
      finalizedBy: record.finalizedBy,
      finalizedAt: record.finalizedAt,
      createdAt: record.createdAt,
    });
  }

  /**
   * WP-7403: 疑義照会の起票。append-only、同一冪等キー+同一内容は replay、
   * 同一キー+別内容は RX-0010。監査 payload に本文は含めない(MOD-008)。
   */
  async createInquiry(
    input: PrescriptionInquiryCreateInput,
  ): Promise<PrescriptionInquiryCreateResult> {
    const record = this.findRecordByPrescriptionId(input);
    if (record === undefined) return { kind: "not_found" };
    return this.withKeyLock(record.lockKey, async () => {
      const fresh = this.records.get(record.lockKey);
      if (fresh === undefined) return { kind: "not_found" };

      const prior = fresh.inquiries.find(
        (entry) => entry.idempotencyKey === input.idempotencyKey,
      );
      if (prior !== undefined) {
        if (
          prior.directedTo === input.directedTo &&
          prior.content === input.content
        ) {
          return {
            kind: "recorded",
            inquiry: this.inquiryView(prior),
            replayed: true,
          };
        }
        return { kind: "idempotency_conflict" };
      }

      const inquiry: InMemoryPrescriptionInquiryRecord = {
        inquiryId:
          this.lifecycleDeps.nextInquiryId?.() ??
          prescriptionInquiryId(`inquiry-${randomUUID()}`),
        prescriptionId: input.prescriptionId,
        directedTo: input.directedTo,
        content: input.content,
        answer: null,
        answeredBy: null,
        answeredAt: null,
        result: null,
        createdBy: input.actorId,
        createdAt: input.wallClock,
        idempotencyKey: input.idempotencyKey,
        answerIdempotencyKey: null,
        recordedSeq: ++this.inquiryRecordedSeq,
      };
      await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "inquiry.recorded",
          // MOD-008: payload は inquiry ID + prescription ID + actorId のみ。
          targetRef: {
            kind: "prescription_inquiry",
            id: `${input.prescriptionId}/${inquiry.inquiryId}`,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      fresh.inquiries.push(inquiry);
      return {
        kind: "recorded",
        inquiry: this.inquiryView(inquiry),
        replayed: false,
      };
    });
  }

  /**
   * WP-7403: 回答の write-once 記録。回答済みへの再回答は
   * 同一キー+同一内容の replay のみ受理、別キー/別内容は拒否。
   */
  async answerInquiry(
    input: PrescriptionInquiryAnswerInput,
  ): Promise<PrescriptionInquiryAnswerResult> {
    const record = this.findRecordByPrescriptionId(input);
    if (record === undefined) return { kind: "not_found" };
    return this.withKeyLock(record.lockKey, async () => {
      const fresh = this.records.get(record.lockKey);
      if (fresh === undefined) return { kind: "not_found" };
      const inquiry = this.findInquiryRecord(fresh, input.inquiryId);
      if (inquiry === undefined) return { kind: "inquiry_not_found" };

      if (inquiry.answer !== null) {
        if (inquiry.answerIdempotencyKey === input.idempotencyKey) {
          if (inquiry.answer === input.answer && inquiry.result === input.result) {
            return {
              kind: "answered",
              inquiry: this.inquiryView(inquiry),
              replayed: true,
            };
          }
          return { kind: "idempotency_conflict" };
        }
        return { kind: "invalid_transition" };
      }

      await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "inquiry.answered",
          // MOD-008: payload は inquiry ID + result + actorId のみ。
          // 回答本文は載せない(result は構造化 code で表現)。
          targetRef: {
            kind: "prescription_inquiry",
            id: `${input.prescriptionId}/${input.inquiryId}`,
          },
          businessReason: { code: `INQUIRY_RESULT_${input.result}` },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      inquiry.answer = input.answer;
      inquiry.answeredBy = input.actorId;
      inquiry.answeredAt = input.wallClock;
      inquiry.result = input.result;
      inquiry.answerIdempotencyKey = input.idempotencyKey;
      return {
        kind: "answered",
        inquiry: this.inquiryView(inquiry),
        replayed: false,
      };
    });
  }

  /**
   * WP-7403: 確定処方の訂正。RESOLVED+CHANGED の inquiry を根拠に
   * version N+1 を append し、status は PRESCRIPTION_FINALIZED のまま。
   * amend denied 監査は対象の有無に関わらず残す(資格→存在の順)。
   */
  async amend(input: PrescriptionAmendInput): Promise<PrescriptionAmendResult> {
    if (
      !(await this.checkQualificationOrDeny(input, "prescription.amend.denied"))
    ) {
      return { kind: "unqualified" };
    }
    const record = this.findRecordByPrescriptionId(input);
    if (record === undefined) return { kind: "not_found" };
    return this.withKeyLock(record.lockKey, async () => {
      const fresh = this.records.get(record.lockKey);
      if (fresh === undefined) return { kind: "not_found" };

      if (fresh.lifecycle.status !== "PRESCRIPTION_FINALIZED") {
        return { kind: "invalid_transition" };
      }
      const inquiry = this.findInquiryRecord(fresh, input.inquiryId);
      if (
        inquiry === undefined ||
        inquiry.answer === null ||
        inquiry.result !== "CHANGED"
      ) {
        return { kind: "inquiry_unresolved" };
      }
      const { normalized, contentHash } =
        normalizePrescriptionDraftContentForStorage(input.content);
      if (countUnresolvedPrescriptionItems(normalized) > 0) {
        return { kind: "unresolved_items" };
      }
      if (!isPrescriptionSourceMetadataComplete(normalized)) {
        return { kind: "metadata_incomplete" };
      }

      // 冪等 replay は packet §4 guard 6(最後)。command payload は
      // {inquiryId, content} のため両者の一致を要求する。
      const prior = fresh.versions.find(
        (entry) => entry.amendIdempotencyKey === input.idempotencyKey,
      );
      if (prior !== undefined) {
        if (
          prior.contentHash === contentHash &&
          prior.inquiryId === input.inquiryId
        ) {
          return {
            kind: "amended",
            version: this.versionView(prior, input.prescriptionId),
            replayed: true,
          };
        }
        return { kind: "idempotency_conflict" };
      }

      const latest = fresh.versions[fresh.versions.length - 1];
      const nextVersion = (latest?.version ?? 0) + 1;
      // packet §4: amend は新版の confirm+finalize を兼ねるため、
      // confirmed/finalized_* にも amend 実行者・時刻を設定する。
      const versionRecord: InMemoryPrescriptionVersionRecord = {
        version: nextVersion,
        content: normalized,
        contentHash,
        supersedesVersion: nextVersion - 1,
        inquiryId: input.inquiryId,
        amendedBy: input.actorId,
        amendedAt: input.wallClock,
        amendIdempotencyKey: input.idempotencyKey,
        confirmedBy: input.actorId,
        confirmedAt: input.wallClock,
        finalizedBy: input.actorId,
        finalizedAt: input.wallClock,
        createdAt: input.wallClock,
      };
      const auditEvent = await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.amended",
          // MOD-008: payload は prescription ID + version + actorId +
          // inquiryId のみ(識別子のみ、本文は載せない)。
          targetRef: {
            kind: "prescription_version",
            id: `${input.prescriptionId}/${nextVersion}/${input.inquiryId}`,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      this.lifecycleDeps.finalizedOutbox?.appendFor(
        input.tenantId,
        input.pharmacyId,
        {
          outboxEventId:
            this.lifecycleDeps.nextOutboxEventId?.() ?? randomUUID(),
          eventType: "prescription.amended",
          aggregateType: "prescription",
          aggregateId: input.prescriptionId,
          auditEventId: auditEvent.eventId,
          version: nextVersion,
          createdAt: input.wallClock,
        },
      );
      fresh.versions.push(versionRecord);
      Object.assign(fresh.lifecycle, { prescriptionVersion: nextVersion });
      fresh.response = {
        ...fresh.response,
        prescriptionVersion: nextVersion,
      };
      return {
        kind: "amended",
        version: this.versionView(versionRecord, input.prescriptionId),
        replayed: false,
      };
    });
  }

  private findRecordByPrescriptionScopedRead(
    input: PrescriptionScopedReadInput,
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

  /** PHI read 監査は draft GET と同じ prescription.draft.viewed を使う。 */
  private async auditPrescriptionRead(
    input: PrescriptionScopedReadInput,
  ): Promise<void> {
    await this.auditRepository.record(
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      {
        actorId: input.actorId,
        auditEventType: "prescription.draft.viewed",
        targetRef: { kind: "prescription", id: input.prescriptionId },
        outcome: "success",
        wallClock: input.wallClock,
      },
    );
  }

  async listVersions(
    input: PrescriptionScopedReadInput,
  ): Promise<PrescriptionVersionListResult> {
    const record = this.findRecordByPrescriptionScopedRead(input);
    if (record === undefined) return { kind: "not_found" };
    await this.auditPrescriptionRead(input);
    return {
      kind: "listed",
      versions: record.versions.map((entry) =>
        this.versionView(entry, input.prescriptionId),
      ),
    };
  }

  async getVersion(
    input: PrescriptionVersionReadInput,
  ): Promise<PrescriptionVersionGetResult> {
    const record = this.findRecordByPrescriptionScopedRead(input);
    const version = record?.versions.find(
      (entry) => entry.version === input.version,
    );
    if (record === undefined || version === undefined) {
      return { kind: "not_found" };
    }
    await this.auditPrescriptionRead(input);
    return {
      kind: "found",
      version: this.versionView(version, input.prescriptionId),
    };
  }

  async listInquiries(
    input: PrescriptionScopedReadInput,
  ): Promise<PrescriptionInquiryListResult> {
    const record = this.findRecordByPrescriptionScopedRead(input);
    if (record === undefined) return { kind: "not_found" };
    await this.auditPrescriptionRead(input);
    return {
      kind: "listed",
      inquiries: [...record.inquiries]
        .sort((a, b) => a.recordedSeq - b.recordedSeq)
        .map((entry) => this.inquiryView(entry)),
    };
  }

  /**
   * WP-7404: dispensing guard 用の内部 read(監査を記録しない)。
   * versions 行は finalize/amend でのみ追加されるため、存在=確定の証明。
   */
  findFinalizedVersionContent(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    targetPrescriptionId: PrescriptionId,
    version: number,
  ):
    | {
        readonly version: number;
        readonly content: PrescriptionDraftContent;
      }
    | undefined {
    const record = this.findRecordByPrescriptionId({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      prescriptionId: targetPrescriptionId,
    });
    const found = record?.versions.find((entry) => entry.version === version);
    return found === undefined
      ? undefined
      : { version: found.version, content: found.content };
  }

  /** WP-7404: 未回答 inquiry が 1 件でもあれば true(監査を記録しない)。 */
  hasOpenInquiry(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    targetPrescriptionId: PrescriptionId,
  ): boolean {
    const record = this.findRecordByPrescriptionId({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      prescriptionId: targetPrescriptionId,
    });
    return record?.inquiries.some((entry) => entry.answer === null) ?? false;
  }

  /**
   * WP-7404: 処方の直列化 lock 下で action を実行する。
   * dispensing create の guard 評価が inquiry 記録と TOCTOU で競合しない
   * ようにする(PG 側は prescription_drafts FOR UPDATE が等価の役割)。
   * 処方 record が存在しなければ action を実行せず undefined を返す。
   */
  async runWithPrescriptionLock<T>(
    scope: { tenantId: TenantId; pharmacyId: PharmacyId },
    targetPrescriptionId: PrescriptionId,
    action: () => Promise<T>,
  ): Promise<T | undefined> {
    const record = this.findRecordByPrescriptionId({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      prescriptionId: targetPrescriptionId,
    });
    if (record === undefined) return undefined;
    return this.withKeyLock(record.lockKey, action);
  }
}


