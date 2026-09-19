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
  sequenceNumber: 1n,
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

  it('projects prescription.finalized with the version from the internal payload', () => {
    const finalized: OutboxPendingEvent = Object.freeze({
      ...row,
      outboxEventId: 'outbox-rx-1',
      eventType: 'prescription.finalized',
      aggregateType: 'prescription',
      aggregateId: 'prescription-000001',
      payload: { prescriptionId: 'prescription-000001', version: 1 },
    });
    const projected = projectOutboxEventToPartnerEvent(finalized);
    expect(projected).toEqual({
      eventId: 'outbox-rx-1',
      eventType: 'prescription.finalized',
      schemaVersion: 1,
      occurredAt: '2026-08-23T00:00:00.000Z',
      auditEventId: 'audit-0001',
      aggregate: { type: 'prescription', id: 'prescription-000001' },
      version: 1,
    });
  });

  it('projects prescription.amended with the amended version from the internal payload', () => {
    const amended: OutboxPendingEvent = Object.freeze({
      ...row,
      outboxEventId: 'outbox-rx-2',
      eventType: 'prescription.amended',
      aggregateType: 'prescription',
      aggregateId: 'prescription-000001',
      payload: { prescriptionId: 'prescription-000001', version: 2 },
    });
    const projected = projectOutboxEventToPartnerEvent(amended);
    expect(projected).toEqual({
      eventId: 'outbox-rx-2',
      eventType: 'prescription.amended',
      schemaVersion: 1,
      occurredAt: '2026-08-23T00:00:00.000Z',
      auditEventId: 'audit-0001',
      aggregate: { type: 'prescription', id: 'prescription-000001' },
      version: 2,
    });
    // inquiryId・本文は公開 event に載せない(MOD-009 §7)。
    expect(JSON.stringify(projected)).not.toContain('inquiry');
  });

  it('fails closed when prescription.amended payload lacks a valid version', () => {
    for (const payload of [
      { prescriptionId: 'prescription-000001' },
      { version: 'two' },
      { version: 0 },
      null,
      'x',
    ]) {
      expect(() =>
        projectOutboxEventToPartnerEvent({
          ...row,
          eventType: 'prescription.amended',
          aggregateType: 'prescription',
          aggregateId: 'prescription-000001',
          payload,
        }),
      ).toThrow(PartnerEventProjectionError);
    }
  });

  it('projects dispense.confirmed with prescriptionId and version only', () => {
    const confirmed: OutboxPendingEvent = Object.freeze({
      ...row,
      outboxEventId: 'outbox-dsp-1',
      eventType: 'dispense.confirmed',
      aggregateType: 'dispensing',
      aggregateId: 'dispensing-000001',
      payload: {
        prescriptionId: 'prescription-000001',
        version: 2,
        // 内部 payload の調剤内容・患者識別子は公開 event へ転記しない。
        note: 'internal only',
      },
    });
    const projected = projectOutboxEventToPartnerEvent(confirmed);
    expect(projected).toEqual({
      eventId: 'outbox-dsp-1',
      eventType: 'dispense.confirmed',
      schemaVersion: 1,
      occurredAt: '2026-08-23T00:00:00.000Z',
      auditEventId: 'audit-0001',
      aggregate: { type: 'dispensing', id: 'dispensing-000001' },
      prescriptionId: 'prescription-000001',
      version: 2,
    });
    expect(JSON.stringify(projected)).not.toContain('internal only');
  });

  it('fails closed when dispense.confirmed payload lacks prescriptionId or version', () => {
    for (const payload of [
      { version: 1 },
      { prescriptionId: 'prescription-000001' },
      { prescriptionId: 'prescription-000001', version: 'one' },
      { prescriptionId: '', version: 1 },
      { prescriptionId: 'prescription-000001', version: 0 },
      null,
      'x',
    ]) {
      expect(() =>
        projectOutboxEventToPartnerEvent({
          ...row,
          eventType: 'dispense.confirmed',
          aggregateType: 'dispensing',
          aggregateId: 'dispensing-000001',
          payload,
        }),
      ).toThrow(PartnerEventProjectionError);
    }
  });

  it('fails closed when prescription.finalized payload lacks a valid version', () => {
    for (const payload of [
      { prescriptionId: 'prescription-000001' },
      { version: 'one' },
      { version: 0 },
      null,
      'x',
    ]) {
      expect(() =>
        projectOutboxEventToPartnerEvent({
          ...row,
          eventType: 'prescription.finalized',
          aggregateType: 'prescription',
          aggregateId: 'prescription-000001',
          payload,
        }),
      ).toThrow(PartnerEventProjectionError);
    }
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
