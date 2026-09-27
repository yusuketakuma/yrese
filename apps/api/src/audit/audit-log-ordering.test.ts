import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createAuditEvent,
  verifyAuditHashChain,
  type AuditEvent,
  type CreateAuditEventInput,
} from '@yrese/audit';
import type { AuditLogResponse } from '@yrese/contracts';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { InMemoryAuditRepository, type AuditRepository, type AuditScope } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from '../patient/patient-search-cursor.js';
import {
  auditLogDuplicateIdentityInvariantErrorMessage,
  auditLogListSchemaInvariantErrorMessage,
  auditLogRepositoryReadErrorMessage,
  auditLogSequenceInvariantErrorMessage,
  auditLogScopeInvariantErrorMessage,
  auditLogViewAuditInvariantErrorMessage,
  auditLogViewClockInvariantErrorMessage,
  auditLogViewClockReadErrorMessage,
  buildServer,
  type BuildServerOptions,
} from '../server.js';

import {
  buildDevTestServer,
  auditReadHeaders,
  SCOPE,
  receptionCreated,
  rebuildAuditEvent,
  seedEvents,
  createHostileProxy,
} from './audit-log-test-support.js';

describe('GET /audit/events ordering and display window', () => {
  it('returns events newest-first, applies limit, and verifies the full chain', async () => {
    const repository = new InMemoryAuditRepository();
    await seedEvents(repository, 3);
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=2',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.totalCount).toBe(3);
    expect(body.entries).toHaveLength(2);
    // 新しい順(最後に追記された reception-003 が先頭)
    expect(body.entries[0]?.targetRef.id).toBe('reception-003');
    expect(body.entries[1]?.targetRef.id).toBe('reception-002');
    // chain 検証は limit に関わらず全保存イベントに対して行う
    expect(body.chainVerification).toEqual({ ok: true, checkedCount: 3 });
    // 表示投影に hash・envelope 内部を漏らさない
    expect(JSON.stringify(body.entries)).not.toMatch(/entryHash|prevHash|payloadHash/);
  });

  it('orders a verified display window by wallClock before applying limit', async () => {
    const repository = new InMemoryAuditRepository();
    await repository.record(
      SCOPE,
      receptionCreated('reception-late', '2026-07-11T03:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-early', '2026-07-11T01:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-middle', '2026-07-11T02:00:00.000Z'),
    );
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events?limit=2',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as AuditLogResponse;
    expect(body.entries.map((entry) => entry.targetRef.id)).toEqual([
      'reception-late',
      'reception-middle',
    ]);
    expect(body.chainVerification).toEqual({ ok: true, checkedCount: 3 });
    expect(body.totalCount).toBe(3);
  });

  it('uses later append order as the deterministic tie-break for equal wallClock', async () => {
    const repository = new InMemoryAuditRepository();
    await repository.record(
      SCOPE,
      receptionCreated('reception-equal-a', '2026-07-11T03:00:00.000Z'),
    );
    await repository.record(
      SCOPE,
      receptionCreated('reception-equal-b', '2026-07-11T03:00:00.000Z'),
    );
    const server = buildDevTestServer({ auditRepository: repository });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as AuditLogResponse).entries.map((entry) => entry.targetRef.id)).toEqual([
      'reception-equal-b',
      'reception-equal-a',
    ]);
  });

  it.each([
    ['same logical payload', false],
    ['conflicting logical payload', true],
  ] as const)(
    'rejects a verified full chain that reuses one EventId with %s',
    async (_label, conflicting) => {
      const base = new InMemoryAuditRepository();
      await seedEvents(base, 2);
      const seeded = await base.list(SCOPE);
      const first = seeded[0]!;
      const duplicate = createAuditEvent(
        conflicting
          ? {
              ...seeded[1]!,
              eventId: first.eventId,
              prevHash: first.entryHash,
            }
          : {
              ...first,
              sequenceNumber: 2n,
              logicalClock: 2n,
              prevHash: first.entryHash,
            },
      );
      expect(verifyAuditHashChain([first, duplicate])).toMatchObject({
        ok: true,
        checkedCount: 2,
      });
      const record = vi.fn<AuditRepository['record']>(async () => first);
      const now = vi.fn(() => new Date('2026-07-17T00:00:00.000Z'));
      const server = buildDevTestServer({
        now,
        auditRepository: {
          list: vi.fn(async () => [first, duplicate]),
          record,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events?limit=1',
        headers: auditReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(now).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: auditLogDuplicateIdentityInvariantErrorMessage,
      });
      for (const sensitiveValue of [
        first.eventId,
        first.actorId,
        first.targetRef.id,
        first.correlationId,
        first.idempotencyKey,
        duplicate.targetRef.id,
        duplicate.entryHash,
      ]) {
        expect(response.body).not.toContain(sensitiveValue);
      }
    },
  );

  it.each([
    ['starts after genesis', [2n]],
    ['contains a gap', [1n, 3n]],
    ['reuses a sequence', [1n, 1n]],
    ['moves backwards after a valid prefix', [1n, 2n, 1n]],
  ] as const)(
    'rejects a verified full chain that %s',
    async (_label, sequenceNumbers) => {
      const base = new InMemoryAuditRepository();
      await seedEvents(base, sequenceNumbers.length);
      const seeded = await base.list(SCOPE);
      let previousEntryHash: string | undefined;
      const events = sequenceNumbers.map((sequenceNumber, index) => {
        const event = createAuditEvent({
          ...seeded[index]!,
          sequenceNumber,
          logicalClock: sequenceNumber,
          ...(previousEntryHash === undefined
            ? {}
            : { prevHash: previousEntryHash }),
        });
        previousEntryHash = event.entryHash;
        return event;
      });
      expect(verifyAuditHashChain(events)).toMatchObject({
        ok: true,
        checkedCount: events.length,
      });
      const record = vi.fn<AuditRepository['record']>(async () => events[0]!);
      const now = vi.fn(() => new Date('2026-07-17T00:00:00.000Z'));
      const server = buildDevTestServer({
        now,
        auditRepository: {
          list: vi.fn(async () => events),
          record,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events?limit=1',
        headers: auditReadHeaders,
      });

      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(now).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      expect(response.json()).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: auditLogSequenceInvariantErrorMessage,
      });
      for (const event of events) {
        for (const sensitiveValue of [
          event.eventId,
          event.actorId,
          event.targetRef.id,
          event.correlationId,
          event.idempotencyKey,
          event.entryHash,
        ]) {
          expect(response.body).not.toContain(sensitiveValue);
        }
      }
    },
  );
});
