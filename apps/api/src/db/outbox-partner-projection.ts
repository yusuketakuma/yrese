import {
  PARTNER_EVENT_SCHEMA_VERSION,
  partnerEventSchema,
  type PartnerEvent,
} from '@yrese/contracts';

import type { OutboxDeliverySink, OutboxPendingEvent } from './outbox-delivery.js';

/**
 * outbox 行 → Event Catalog v0 公開 event への投影(WP-6004、API-012)。
 * 内部 payload(identifiers)は公開 event に転記しない。投影結果は contract schema で
 * 再検証し、catalog 未登録の event_type は fail-closed で配送しない。
 */
export class PartnerEventProjectionError extends Error {
  constructor(
    readonly outboxEventId: string,
    cause: unknown,
  ) {
    super('outbox event cannot be projected to a partner event');
    this.name = 'PartnerEventProjectionError';
    this.cause = cause;
  }
}

/**
 * `prescription.finalized` / `prescription.amended` / `dispense.confirmed`
 * の内部 payload 契約(WP-7402 / WP-7403 / WP-7404)。確定版・訂正後の新版・
 * 調剤確定の識別子だけを転記し、それ以外の内部 payload key は公開 event に
 * 載せない。payload が欠損・不正なら投影失敗(fail-closed)とする。
 */
function projectPayloadFields(
  event: OutboxPendingEvent,
): { version?: number; prescriptionId?: string } {
  const projected =
    event.eventType === 'prescription.finalized' ||
    event.eventType === 'prescription.amended' ||
    event.eventType === 'dispense.confirmed';
  if (!projected) {
    return {};
  }
  const payload = event.payload;
  const fields =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const version = fields.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new PartnerEventProjectionError(
      event.outboxEventId,
      new Error(`${event.eventType} payload lacks integer version`),
    );
  }
  if (event.eventType === 'dispense.confirmed') {
    const prescriptionId = fields.prescriptionId;
    if (typeof prescriptionId !== 'string' || prescriptionId.length === 0) {
      throw new PartnerEventProjectionError(
        event.outboxEventId,
        new Error('dispense.confirmed payload lacks prescriptionId'),
      );
    }
    return { version, prescriptionId };
  }
  return { version };
}

export function projectOutboxEventToPartnerEvent(event: OutboxPendingEvent): PartnerEvent {
  const candidate = {
    eventId: event.outboxEventId,
    eventType: event.eventType,
    schemaVersion: PARTNER_EVENT_SCHEMA_VERSION,
    occurredAt: event.createdAt,
    auditEventId: event.auditEventId,
    aggregate: { type: event.aggregateType, id: event.aggregateId },
    ...projectPayloadFields(event),
  };
  const parsed = partnerEventSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PartnerEventProjectionError(event.outboxEventId, parsed.error);
  }
  return parsed.data;
}

export interface PartnerEventSink {
  publish(event: PartnerEvent, signal?: AbortSignal): Promise<void>;
}

/** 投影を挟む OutboxDeliverySink。投影失敗は配送失敗(pending のまま)として扱われる。 */
export function projectingSink(target: PartnerEventSink): OutboxDeliverySink {
  return {
    async deliver(event, signal) {
      await target.publish(projectOutboxEventToPartnerEvent(event), signal);
    },
  };
}
