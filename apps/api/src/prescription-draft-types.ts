import type {
  PrescriptionDraftContent,
  PrescriptionDraftResponse,
  PrescriptionDraftSaveResponse,
  PrescriptionInquiryResult,
  PrescriptionInquiryView,
  PrescriptionLifecycleView,
  PrescriptionVersionView,
} from "@yrese/contracts";
import type {
  PatientId,
  PharmacyId,
  PrescriptionId,
  PrescriptionInquiryId,
  ReceptionId,
  TenantId,
  UserId,
} from "@yrese/shared-kernel";

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

/**
 * WP-7304 / PRD-001 M4: 前回 Do — 確定済み処方版からの複製起点。
 * sourceVersion 省略時は最新版(MAX(version))を複製する。
 */
export interface PrescriptionDraftFromPriorInput
  extends PrescriptionDraftLookupInput {
  readonly patientId: PatientId;
  readonly sourcePrescriptionId: PrescriptionId;
  readonly sourceVersion?: number;
}

export type PrescriptionDraftFromPriorResult =
  | { readonly kind: "saved"; readonly draft: PrescriptionDraftSaveResponse }
  /** 受付なし・非 editable・patient 不一致・複製元/指定版なし → 404。 */
  | { readonly kind: "not_found" }
  /** 複製先 reception に draft 既存 → 409。 */
  | { readonly kind: "conflict" };

export interface PrescriptionDraftService {
  get(input: PrescriptionDraftLookupInput): Promise<PrescriptionDraftLookupResult>;
  save(input: PrescriptionDraftSaveInput): Promise<PrescriptionDraftSaveResult>;
  createFromPrior(
    input: PrescriptionDraftFromPriorInput,
  ): Promise<PrescriptionDraftFromPriorResult>;
  confirm(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult>;
  finalize(
    input: PrescriptionLifecycleCommandInput,
  ): Promise<PrescriptionLifecycleCommandResult>;
  createInquiry(
    input: PrescriptionInquiryCreateInput,
  ): Promise<PrescriptionInquiryCreateResult>;
  answerInquiry(
    input: PrescriptionInquiryAnswerInput,
  ): Promise<PrescriptionInquiryAnswerResult>;
  amend(input: PrescriptionAmendInput): Promise<PrescriptionAmendResult>;
  listVersions(
    input: PrescriptionScopedReadInput,
  ): Promise<PrescriptionVersionListResult>;
  getVersion(
    input: PrescriptionVersionReadInput,
  ): Promise<PrescriptionVersionGetResult>;
  listInquiries(
    input: PrescriptionScopedReadInput,
  ): Promise<PrescriptionInquiryListResult>;
}

/**
 * WP-7403: 疑義照会記録の起票入力。対象は prescriptionId 直接参照、
 * 冪等性は Idempotency-Key(起票は同キー+同内容で replay)。
 */
export interface PrescriptionInquiryCreateInput
  extends PrescriptionLifecycleCommandInput {
  readonly directedTo: string;
  readonly content: string;
}

/** WP-7403: 回答記録は write-once。answered_by/at は server 側で採る。 */
export interface PrescriptionInquiryAnswerInput
  extends PrescriptionLifecycleCommandInput {
  readonly inquiryId: PrescriptionInquiryId;
  readonly answer: string;
  readonly result: PrescriptionInquiryResult;
}

/** WP-7403: 訂正 command。content は確定版と同じ draft スキーマ。 */
export interface PrescriptionAmendInput
  extends PrescriptionLifecycleCommandInput {
  readonly inquiryId: PrescriptionInquiryId;
  readonly content: PrescriptionDraftContent;
}

/** versions/inquiries の read 入力(PHI read 監査のため actorId/wallClock を持つ)。 */
export interface PrescriptionScopedReadInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly prescriptionId: PrescriptionId;
  readonly wallClock: string;
}

export interface PrescriptionVersionReadInput
  extends PrescriptionScopedReadInput {
  readonly version: number;
}

export type PrescriptionInquiryCreateResult =
  | {
      readonly kind: "recorded";
      readonly inquiry: PrescriptionInquiryView;
      readonly replayed: boolean;
    }
  /** 対象処方が scope 内に存在しない → 404 RX-0006。 */
  | { readonly kind: "not_found" }
  /** 同一冪等キーで異なる起票内容 → 409 RX-0010。 */
  | { readonly kind: "idempotency_conflict" };

export type PrescriptionInquiryAnswerResult =
  | {
      readonly kind: "answered";
      readonly inquiry: PrescriptionInquiryView;
      readonly replayed: boolean;
    }
  | { readonly kind: "not_found" }
  /** 対象 inquiry が scope 内に存在しない → 404 RX-0009。 */
  | { readonly kind: "inquiry_not_found" }
  /** 回答済みへの再回答(別キー・別内容)→ 409 RX-0002。 */
  | { readonly kind: "invalid_transition" }
  | { readonly kind: "idempotency_conflict" };

export type PrescriptionAmendResult =
  | {
      readonly kind: "amended";
      readonly version: PrescriptionVersionView;
      readonly replayed: boolean;
    }
  | { readonly kind: "not_found" }
  | { readonly kind: "unqualified" }
  /** status ≠ PRESCRIPTION_FINALIZED → 409 RX-0002。 */
  | { readonly kind: "invalid_transition" }
  /** inquiry 未指定・OPEN・UNCHANGED・他処方/他 scope → 422 RX-0007。 */
  | { readonly kind: "inquiry_unresolved" }
  /** 新版 content に UNRESOLVED_TEXT 品目残存 → 409 RX-0001。 */
  | { readonly kind: "unresolved_items" }
  /** 新版 content の原本 metadata 不完全 → 409 RX-0003。 */
  | { readonly kind: "metadata_incomplete" }
  | { readonly kind: "idempotency_conflict" };

export type PrescriptionVersionListResult =
  | {
      readonly kind: "listed";
      readonly versions: readonly PrescriptionVersionView[];
    }
  | { readonly kind: "not_found" };

export type PrescriptionVersionGetResult =
  | { readonly kind: "found"; readonly version: PrescriptionVersionView }
  | { readonly kind: "not_found" };

export type PrescriptionInquiryListResult =
  | {
      readonly kind: "listed";
      readonly inquiries: readonly PrescriptionInquiryView[];
    }
  | { readonly kind: "not_found" };

