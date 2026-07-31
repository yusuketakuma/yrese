import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import {
  buildServer,
  patientSearchAuditInvariantErrorMessage,
  receptionQueueAuditInvariantErrorMessage,
  type BuildServerOptions,
} from './server.js';

/**
 * WP-4162: 列挙 PHI 読取り(検索・受付キュー)の監査証跡。
 * cardinality は 1 リクエスト = 1 イベント。監査ペイロードはデータ最小化
 * (検索クエリ文字列・氏名・カナ・生年月日・患者番号を入れない — MOD-008 0.2.4)。
 * 記録失敗は 500 で PHI 非返却(fail-closed)。
 */

function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

const patientReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'patient:read',
} as const;

const queueReadHeaders = {
  ...patientReadHeaders,
  'x-dev-scopes': 'reception:read,patient:read',
} as const;

const listScope = { tenantId: 'tenant-001', pharmacyId: 'pharmacy-001' } as never;

function serializeEvents(events: readonly unknown[]): string {
  return JSON.stringify(events, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

describe('GET /patients/search audit evidence (WP-4162 patient.searched)', () => {
  it('records one minimized patient.searched per search without echoing the query', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const now = vi.fn(() => new Date('2026-07-31T02:00:00.000Z'));
    const server = buildDevTestServer({ auditRepository, now });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=%E5%90%88%E6%88%90',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const results = (response.json() as { results: readonly unknown[] }).results;
    expect(results.length).toBeGreaterThan(0);

    const events = await auditRepository.list(listScope);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      auditEventType: 'patient.searched',
      targetRef: { kind: 'patient_search', id: `results:${results.length}` },
      actorId: 'user-001',
      outcome: 'success',
      wallClock: '2026-07-31T02:00:00.000Z',
    });
    // データ最小化: クエリ文字列・患者属性を監査イベントへ入れない。
    const serialized = serializeEvents(events);
    expect(serialized).not.toContain('合成');
    expect(serialized).not.toContain('SYN-001');
    expect(serialized).not.toContain('1980-01-01');
  });

  it('records an empty search as results:0 (the attempt itself is evidence)', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=zzz-no-such-patient',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const events = await auditRepository.list(listScope);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      auditEventType: 'patient.searched',
      targetRef: { kind: 'patient_search', id: 'results:0' },
    });
  });

  it('records one event per search request (two searches, two events)', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });

    for (let search = 0; search < 2; search += 1) {
      const response = await server.inject({
        method: 'GET',
        url: '/patients/search?q=%E5%90%88%E6%88%90',
        headers: patientReadHeaders,
      });
      expect(response.statusCode).toBe(200);
    }
    await server.close();

    await expect(auditRepository.list(listScope)).resolves.toHaveLength(2);
  });

  it('fails closed with 500 and no PHI when the search audit sink rejects', async () => {
    const rawSentinel = 'raw patient search audit rejection secret 4162';
    const record = vi.fn<AuditRepository['record']>(async () => {
      throw new Error(rawSentinel);
    });
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search?q=%E5%90%88%E6%88%90',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      message: patientSearchAuditInvariantErrorMessage,
    });
    expect(record).toHaveBeenCalledOnce();
    expect(response.body).not.toContain(rawSentinel);
    expect(response.body).not.toContain('合成');
    expect(response.body).not.toContain('SYN-001');
  });

  it('does not record for an invalid query (no disclosure, no evidence)', async () => {
    const record = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/search',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('GET /reception/queue audit evidence (WP-4162 reception.queue.viewed)', () => {
  it('records one minimized reception.queue.viewed per read', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const now = vi.fn(() => new Date('2026-07-31T02:10:00.000Z'));
    const server = buildDevTestServer({ auditRepository, now });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: queueReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const entries = (response.json() as { entries: readonly unknown[] }).entries;

    const events = await auditRepository.list(listScope);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      auditEventType: 'reception.queue.viewed',
      targetRef: {
        kind: 'reception_queue',
        id: `2026-07-09:results:${entries.length}`,
      },
      actorId: 'user-001',
      outcome: 'success',
      wallClock: '2026-07-31T02:10:00.000Z',
    });
    // 業務日付+件数のみ: キュー上の患者の氏名等を監査イベントへ入れない。
    const serialized = serializeEvents(events);
    expect(serialized).not.toContain('合成患者');
    expect(serialized).not.toContain('SYN-00');
  });

  it('records an empty queue day as results:0', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2030-01-01',
      headers: queueReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const events = await auditRepository.list(listScope);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      targetRef: { kind: 'reception_queue', id: '2030-01-01:results:0' },
    });
  });

  it('fails closed with 500 and no PHI when the queue audit sink rejects', async () => {
    const rawSentinel = 'raw reception queue audit rejection secret 4162';
    const record = vi.fn<AuditRepository['record']>(async () => {
      throw new Error(rawSentinel);
    });
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: queueReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      message: receptionQueueAuditInvariantErrorMessage,
    });
    expect(record).toHaveBeenCalledOnce();
    expect(response.body).not.toContain(rawSentinel);
    expect(response.body).not.toContain('合成患者');
  });

  it('does not record for an invalid date (no disclosure, no evidence)', async () => {
    const record = vi.fn<AuditRepository['record']>();
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=not-a-date',
      headers: queueReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
});
