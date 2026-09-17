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
 * `prescription.finalized` の内部 payload 契約(WP-7402)。確定版だけを転記し、
 * 識別子以外の内部 payload key は公開 event に載せない。payload が欠損・
 * 不正なら投影失敗(fail-closed)とする。
 */
function projectPayloadFields(event: OutboxPendingEvent): Record<string, number> {
  if (event.eventType !== 'prescription.finalized') {
    return {};
  }
  const payload = event.payload;
  const version =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).version
      : undefined;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new PartnerEventProjectionError(
      event.outboxEventId,
      new Error('prescription.finalized payload lacks integer version'),
    );
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
