import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PatientSearchResult } from '@yrese/contracts';

import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import {
  buildServer,
  patientViewAuditInvariantErrorMessage,
  type BuildServerOptions,
} from './server.js';

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

describe('GET /patients/:patientId (R-PATCTX 再取得契約)', () => {
  it('returns the same projection as search results for an existing patient', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: patientReadHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as PatientSearchResult;
    expect(body.patientId).toBe('patient-syn-001');
    expect(body.patientNumber).toBe('SYN-001');
    expect(body.eligibilityStatus).toBe('VERIFIED');
    // 検索結果と同一射影(契約フィールドのみ)
    expect(Object.keys(body).sort()).toEqual(
      [
        'birthDate',
        'eligibilityCheckedAt',
        'eligibilityStatus',
        'kana',
        'name',
        'patientId',
        'patientNumber',
        'sex',
      ].sort(),
    );
  });

  it('returns 404 PAT-0002 for an unknown patient', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/patients/no-such-patient',
      headers: patientReadHeaders,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0002' });
  });

  it('does not leak patients across tenants (404, not 403 — 存在有無を隠す)', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: { ...patientReadHeaders, 'x-dev-tenant': 'tenant-002' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('denies access without patient:read scope', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: { ...patientReadHeaders, 'x-dev-scopes': 'reception:read' },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('GET /patients/:patientId audit evidence (WP-4162 patient.viewed)', () => {
  // 単一患者の全属性開示は要配慮情報アクセス: durable な patient.viewed なしに
  // PHI を返さない(fail-closed)。cardinality は 1 リクエスト = 1 イベント。
  it('records exactly one identifier-only patient.viewed before returning PHI', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const now = vi.fn(() => new Date('2026-07-31T01:23:45.000Z'));
    const server = buildDevTestServer({ auditRepository, now });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const events = await auditRepository.list({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
    } as never);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      auditEventType: 'patient.viewed',
      targetRef: { kind: 'patient', id: 'patient-syn-001' },
      actorId: 'user-001',
      outcome: 'success',
      wallClock: '2026-07-31T01:23:45.000Z',
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
    });
    // 監査ペイロードは識別子のみ: 氏名・カナ・生年月日・患者番号を運ばない。
    const serialized = JSON.stringify(events[0], (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(serialized).not.toContain('合成患者');
    expect(serialized).not.toContain('SYN-001');
    expect(serialized).not.toContain('1980-01-01');
  });

  it('records one event per read (two reads converge to two events)', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });

    for (let read = 0; read < 2; read += 1) {
      const response = await server.inject({
        method: 'GET',
        url: '/patients/patient-syn-001',
        headers: patientReadHeaders,
      });
      expect(response.statusCode).toBe(200);
    }
    await server.close();

    const events = await auditRepository.list({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
    } as never);
    expect(events).toHaveLength(2);
  });

  it('does not record or read the clock when no PHI is disclosed (404)', async () => {
    const record = vi.fn<AuditRepository['record']>();
    const now = vi.fn(() => new Date('2026-07-31T01:23:45.000Z'));
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
      now,
    });

    const notFound = await server.inject({
      method: 'GET',
      url: '/patients/no-such-patient',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(notFound.statusCode).toBe(404);
    expect(record).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('fails closed with 500 and no PHI when the audit sink rejects', async () => {
    const rawSentinel = 'raw patient view audit rejection secret 4162';
    const record = vi.fn<AuditRepository['record']>(async () => {
      throw new Error(rawSentinel);
    });
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: patientViewAuditInvariantErrorMessage,
    });
    expect(record).toHaveBeenCalledOnce();
    // PHI・raw 失敗詳細を一切返さない。
    expect(response.body).not.toContain(rawSentinel);
    expect(response.body).not.toContain('合成患者');
    expect(response.body).not.toContain('SYN-001');
    expect(response.body).not.toContain('1980-01-01');
  });

  it('rejects mismatched recorded evidence before returning PHI', async () => {
    const record = vi.fn<AuditRepository['record']>(async () => null as never);
    const server = buildDevTestServer({
      auditRepository: { record, list: vi.fn<AuditRepository['list']>(async () => []) },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/patients/patient-syn-001',
      headers: patientReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: patientViewAuditInvariantErrorMessage,
    });
    expect(response.body).not.toContain('合成患者');
  });
});
