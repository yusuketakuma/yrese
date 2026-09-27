import type { EventEnvelope } from "@yrese/events";
import type { UserId } from "@yrese/shared-kernel";

export const AUDIT_EVENT_TYPES = [
  "patient.viewed",
  "patient.created",
  "patient.updated",
  "patient.deleted",
  "patient.searched",
  "reception.created",
  "reception.cancelled",
  "reception.started",
  "reception.completed",
  "reception.queue.viewed",
  "insurance.viewed",
  "insurance.updated",
  "prescription.draft.viewed",
  "prescription.created",
  "prescription.updated",
  "prescription.confirmed",
  "prescription.finalized",
  "prescription.confirm.denied",
  "prescription.finalize.denied",
  "prescription.amended",
  "prescription.amend.denied",
  "dispensing.recorded",
  "dispensing.confirmed",
  "dispensing.confirm.denied",
  "inquiry.recorded",
  "inquiry.answered",
  "calculation.finalized",
  "calculation.recalculated",
  "report.printed",
  "report.reprinted",
  "claim.checked",
  "claim.closed",
  "claim.locked",
  "claim.receipt_exported",
  "master.approved",
  "master.applied",
  "master.rolled_back",
  "permission.changed",
  "account.issued",
  "account.suspended",
  "auth.login",
  "auth.logout",
  "auth.failed",
  "breakglass.used",
  "breakglass.ended",
  "support.session.started",
  "support.session.ended",
  "support.operation",
  "data.exported",
  "data.returned",
  "config.changed",
  "edge.registered",
  "edge.revoked",
  "sync.conflict.detected",
  "sync.conflict.resolved",
  "system.mode.changed",
  "audit.viewed",
  "audit.exported",
  "retention.disposed",
  "accounting.charge.created",
  "accounting.charge.reversed",
  "accounting.payment.received",
  "accounting.payment.cancelled",
  "accounting.payment.refunded",
  "accounting.allocation.created",
  "accounting.allocation.reversed",
  "accounting.adjustment.created",
  "accounting.receivable.status_changed",
  "receipt.issued",
  "receipt.reissued",
  "receipt.cancelled",
  "receipt.voided",
  "statement.issued",
  "statement.voided",
  "closing.executed",
  "closing.adjusted",
  "facility.invoice.issued",
  "facility.payment.received",
  // 情報連携(MOD-008 0.2.5: API-009〜018、ADP-004、Plans.md §16 Track A/D)
  "partner.registered",
  "partner.suspended",
  "partner.retired",
  "partner.app.issued",
  "partner.app.revoked",
  "partner.grant.changed",
  "partner.endpoint.changed",
  "delivery.sent",
  "delivery.failed",
  "delivery.dead_lettered",
  "delivery.resent",
  "eligibility.verified",
  "eligibility.provisional_recorded",
  "eligibility.expired",
  "eligibility.mismatch_detected",
  "consent.recorded",
  "consent.revoked",
  "external_record.viewed",
  "sandbox.reset",
  "data.imported",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditOutcome = "success" | "denied" | "failed";

export interface AuditTargetRef {
  readonly kind: string;
  readonly id: string;
}

export interface AuditBusinessReason {
  readonly code: string;
}

export interface ParsedAuditEventType {
  readonly domain: string;
  readonly resource?: string;
  readonly action: string;
}

export interface AuditEvent extends EventEnvelope {
  readonly actorId: UserId;
  readonly auditEventType: AuditEventType;
  readonly targetRef: AuditTargetRef;
  readonly outcome: AuditOutcome;
  readonly reasonCode?: string;
  readonly businessReason?: AuditBusinessReason;
  readonly prevHash: string;
  readonly entryHash: string;
}

export type CreateAuditEventInput = Omit<AuditEvent, "auditEventType" | "entryHash"> & {
  readonly auditEventType: string;
};

export type AuditEventHydrationFailureReason = "malformed_event" | "entry_hash_mismatch";

export class AuditEventHydrationError extends Error {
  constructor(readonly reason: AuditEventHydrationFailureReason) {
    super("Stored audit event failed integrity validation");
    this.name = "AuditEventHydrationError";
  }
}

export const AUDIT_GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type AuditHashChainBreakReason =
  | "prev_hash_mismatch"
  | "entry_hash_mismatch"
  | "hash_format_invalid";

export type AuditHashChainVerification =
  | {
      readonly ok: true;
      readonly checkedCount: number;
      readonly lastEntryHash?: string;
    }
  | {
      readonly ok: false;
      readonly checkedCount: number;
      readonly breakIndex: number;
      readonly eventId?: string;
      readonly reason: AuditHashChainBreakReason;
      readonly expectedPrevHash?: string;
      readonly actualPrevHash?: string;
      readonly expectedEntryHash?: string;
      readonly actualEntryHash?: string;
    };

