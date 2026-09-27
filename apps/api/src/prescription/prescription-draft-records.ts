import type {
  PrescriptionDraftContent,
  PrescriptionDraftResponse,
  PrescriptionInquiryResult,
  PrescriptionStatusWire,
} from '@yrese/contracts';
import type {
  PharmacyId,
  PrescriptionId,
  PrescriptionInquiryId,
  TenantId,
} from '@yrese/shared-kernel';

export interface InMemoryPrescriptionLifecycleState {
  status: PrescriptionStatusWire | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  confirmIdempotencyKey: string | null;
  finalizeIdempotencyKey: string | null;
  prescriptionVersion: number | null;
}

export interface InMemoryPrescriptionDraftRecord {
  response: PrescriptionDraftResponse;
  readonly contentHash: string;
  readonly lifecycle: InMemoryPrescriptionLifecycleState;
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly lockKey: string;
  /** WP-7403: prescription_versions の in-memory 相当(append-only)。 */
  readonly versions: InMemoryPrescriptionVersionRecord[];
  /** WP-7403: prescription_inquiries の in-memory 相当。 */
  readonly inquiries: InMemoryPrescriptionInquiryRecord[];
}

export interface InMemoryPrescriptionVersionRecord {
  readonly version: number;
  readonly content: PrescriptionDraftContent;
  readonly contentHash: string;
  readonly supersedesVersion: number | null;
  readonly inquiryId: PrescriptionInquiryId | null;
  readonly amendedBy: string | null;
  readonly amendedAt: string | null;
  readonly amendIdempotencyKey: string | null;
  readonly confirmedBy: string;
  readonly confirmedAt: string;
  readonly finalizedBy: string;
  readonly finalizedAt: string;
  readonly createdAt: string;
}

export interface InMemoryPrescriptionInquiryRecord {
  inquiryId: PrescriptionInquiryId;
  readonly prescriptionId: PrescriptionId;
  readonly directedTo: string;
  readonly content: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  result: PrescriptionInquiryResult | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly idempotencyKey: string;
  answerIdempotencyKey: string | null;
  readonly recordedSeq: number;
}

export function emptyLifecycle(): InMemoryPrescriptionLifecycleState {
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
  readonly eventType:
    | "prescription.finalized"
    | "prescription.amended"
    | "dispense.confirmed";
  readonly aggregateType: "prescription" | "dispensing";
  readonly aggregateId: string;
  readonly auditEventId: string;
  readonly version: number;
  /** WP-7404 dispense.confirmed のみ(API-012 最小 payload の prescription_id)。 */
  readonly prescriptionId?: string;
  readonly createdAt: string;
}

export function outboxScopeKey(tenantId: TenantId, pharmacyId: PharmacyId): string {
  return JSON.stringify([tenantId, pharmacyId]);
}

/**
 * dev/test 用の in-memory outbox intent(MOD-009 §6)。永続正本は
 * outbox_events。prescription.finalized / prescription.amended /
 * dispense.confirmed(WP-7404)。一意性は outbox_events の
 * aggregate+eventType+version 相当に揃える。
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
          existing.eventType === intent.eventType &&
          existing.version === intent.version,
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
