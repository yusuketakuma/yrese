import { describe, expect, it } from 'vitest';

import type { OutboxPendingEvent } from './outbox-delivery.js';
import {
  PartnerEventProjectionError,
  projectOutboxEventToPartnerEvent,
  projectingSink,
} from './outbox-partner-projection.js';

const row: OutboxPendingEvent = Object.freeze({
  tenantId: 'tenant-001',
  pharmacyId: 'pharmacy-001',
  outboxEventId: 'outbox-0001',
  eventType: 'reception.created',
  aggregateType: 'reception',
  aggregateId: 'reception-000001',
  auditEventId: 'audit-0001',
  payload: { receptionId: 'reception-000001', patientId: 'patient-syn-004' },
  createdAt: '2026-08-23T00:00:00.000Z',
});

describe('projectOutboxEventToPartnerEvent', () => {
  it('projects identifiers only and drops the internal payload', () => {
    const projected = projectOutboxEventToPartnerEvent(row);
    expect(projected).toEqual({
      eventId: 'outbox-0001',
      eventType: 'reception.created',
      schemaVersion: 1,
      occurredAt: '2026-08-23T00:00:00.000Z',
      auditEventId: 'audit-0001',
      aggregate: { type: 'reception', id: 'reception-000001' },
    });
    expect(JSON.stringify(projected)).not.toContain('patient-syn-004');
  });

  it('fails closed for an event type that is not in the catalog', () => {
    expect(() =>
      projectOutboxEventToPartnerEvent({ ...row, eventType: 'reception.deleted' }),
    ).toThrow(PartnerEventProjectionError);
  });

  it('projectingSink publishes the projected event and surfaces projection failure as delivery failure', async () => {
    const published: unknown[] = [];
    const sink = projectingSink({
      publish: async (event) => {
        published.push(event);
      },
    });
    await sink.deliver(row);
    expect(published).toHaveLength(1);
    await expect(sink.deliver({ ...row, eventType: 'unknown.event' })).rejects.toThrow(
      PartnerEventProjectionError,
    );
    expect(published).toHaveLength(1);
  });
});
