import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PatientCreateResponse, PatientUpdateResponse } from '@yrese/contracts';
import type { AuditRepository } from './audit-repository.js';
import { patientId, pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { buildServer, type BuildServerOptions } from './server.js';
import type { PatientRepository } from './patient-repository.js';

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

const writeHeaders = {
  'x-dev-tenant': 'tenant-dev-001',
  'x-dev-pharmacy': 'pharmacy-dev-001',
  'x-dev-actor': 'user-dev-001',
  'x-dev-scopes': 'patient:read,patient:write',
} as const;

const idempotencyKey = 'patient-create-key-0000001';
const createPayload = {
  name: '登録 一郎',
  kana: 'トウロクイチロウ',
  birthDate: '1975-03-15',
  sex: 'male',
} as const;

async function createPatient(
  server: Awaited<ReturnType<typeof buildDevTestServer>>,
  overrides: {
    payload?: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
  } = {},
) {
  const headers: Record<string, string | undefined> = {
    ...writeHeaders,
    'idempotency-key': idempotencyKey,
    ...overrides.headers,
  };
  // undefined の値はヘッダ省略として扱う(light-my-request は undefined を拒否)。
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      delete headers[key];
    }
  }
  return server.inject({
    method: 'POST',
    url: '/patients',
    headers: headers as Record<string, string>,
    payload: overrides.payload ?? createPayload,
  });
}

describe('POST /patients (WP-7202)', () => {
  it('creates a patient: 201, version 1, NOT_CHECKED, no-store, patient.created audit', async () => {
    const auditRepository = new (await import('./audit-repository.js')).InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await createPatient(server);
    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as PatientCreateResponse;
    expect(body.patient.patientNumber).toMatch(/^P-\d{6}$/);
    expect(body.patient.version).toBe(1);
    expect(body.patient.eligibilityStatus).toBe('NOT_CHECKED');
    expect(body.patient.name).toBe(createPayload.name);

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    expect(audits.map((a) => a.auditEventType)).toEqual(['patient.created']);
    // 監査 payload は識別子のみ(氏名・カナ・生年月日を含まない)。
    const serialized = JSON.stringify(audits, (_k, v) =>
      typeof v === 'bigint' ? String(v) : v,
    );
    for (const phi of [createPayload.name, createPayload.kana, createPayload.birthDate]) {
      expect(serialized).not.toContain(phi);
    }
  });

  it('replays the same Idempotency-Key with the same payload as 200 without a second audit', async () => {
    const server = buildDevTestServer();
    const first = await createPatient(server);
    const second = await createPatient(server);
    await server.close();

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect((second.json() as PatientCreateResponse).patient.patientId).toBe(
      (first.json() as PatientCreateResponse).patient.patientId,
    );
  });

  it('returns 409 PAT-0006 for the same key with a different payload', async () => {
    const server = buildDevTestServer();
    await createPatient(server);
    const conflict = await createPatient(server, {
      payload: { ...createPayload, name: '別名 二郎' },
    });
    await server.close();

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ errorCode: 'PAT-0006' });
    expect(conflict.body).not.toContain('別名 二郎');
  });

  it('returns 409 PAT-0003 for an explicit duplicate patientNumber', async () => {
    const server = buildDevTestServer();
    const first = await createPatient(server, {
      payload: { ...createPayload, patientNumber: 'DUP-001' },
    });
    expect(first.statusCode).toBe(201);
    const second = await createPatient(server, {
      headers: { 'idempotency-key': 'patient-create-key-0000002' },
      payload: { ...createPayload, patientNumber: 'DUP-001' },
    });
    await server.close();

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ errorCode: 'PAT-0003' });
    expect(second.body).not.toContain('DUP-001');
  });

  it.each([
    [{ headers: { 'idempotency-key': 'short' } }, 'invalid key format'],
    [{ headers: { 'idempotency-key': undefined as never } }, 'missing key'],
    [{ payload: { ...createPayload, birthDate: '2026-02-30' } }, 'non-existent date'],
    [{ payload: { ...createPayload, sex: 'other' } }, 'sex enum'],
    [{ payload: { name: 'only' } }, 'missing required fields'],
  ])('returns 400 PAT-0007 for %s', async (overrides, _label) => {
    const server = buildDevTestServer();
    const response = await createPatient(server, {
      payload: 'payload' in overrides ? overrides.payload as Record<string, unknown> : createPayload,
      headers: 'headers' in overrides ? overrides.headers as Record<string, string> : {},
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0007' });
  });

  it('returns 403 without patient:write or patient:read scope', async () => {
    const server = buildDevTestServer();
    const noWrite = await createPatient(server, {
      headers: { 'x-dev-scopes': 'patient:read' },
    });
    const noRead = await createPatient(server, {
      headers: { 'x-dev-scopes': 'patient:write', 'idempotency-key': 'patient-create-key-0000099' },
    });
    await server.close();

    expect(noWrite.statusCode).toBe(403);
    expect(noRead.statusCode).toBe(403);
  });

  it('returns POSSIBLE_DUPLICATE warning (<=5) and audits patient.searched + patient.created', async () => {
    const auditRepository = new (await import('./audit-repository.js')).InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    // 既存患者を先に登録(同名)。
    await createPatient(server);
    const response = await createPatient(server, {
      headers: { 'idempotency-key': 'patient-create-key-0000003' },
      payload: { ...createPayload, birthDate: '1990-12-31' },
    });
    await server.close();

    expect(response.statusCode).toBe(201);
    const body = response.json() as PatientCreateResponse;
    expect(body.warnings).toHaveLength(1);
    expect(body.warnings?.[0]?.type).toBe('POSSIBLE_DUPLICATE');
    expect(body.warnings?.[0]?.candidates.length).toBeGreaterThanOrEqual(1);
    expect(body.warnings?.[0]?.candidates.length).toBeLessThanOrEqual(5);

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    const types = audits.map((a) => a.auditEventType);
    expect(types).toEqual(['patient.created', 'patient.searched', 'patient.created']);
  });
});

describe('PUT /patients/:patientId (WP-7202)', () => {
  async function createThenUpdate(
    server: Awaited<ReturnType<typeof buildDevTestServer>>,
    update: {
      payload?: Record<string, unknown>;
      headers?: Record<string, string>;
      patientId?: string;
    } = {},
  ) {
    const created = await createPatient(server);
    const patient = (created.json() as PatientCreateResponse).patient;
    return server.inject({
      method: 'PUT',
      url: `/patients/${update.patientId ?? patient.patientId}`,
      headers: {
        ...writeHeaders,
        'if-match': '"1"',
        ...update.headers,
      },
      payload: update.payload ?? { expectedVersion: 1, name: '更新 花子' },
    });
  }

  it('updates identity fields: 200, version 2, patient.updated audit', async () => {
    const auditRepository = new (await import('./audit-repository.js')).InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await createThenUpdate(server);
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as PatientUpdateResponse;
    expect(body.patient.name).toBe('更新 花子');
    expect(body.patient.version).toBe(2);

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    expect(audits.map((a) => a.auditEventType)).toEqual(['patient.created', 'patient.updated']);
  });

  it('returns 412 PAT-0004 on stale version', async () => {
    const server = buildDevTestServer();
    const response = await createThenUpdate(server, {
      payload: { expectedVersion: 99, name: 'x' },
      headers: { 'if-match': '"99"' },
    });
    await server.close();

    expect(response.statusCode).toBe(412);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0004' });
  });

  it('returns 404 PAT-0002 for unknown or cross-tenant patient', async () => {
    const server = buildDevTestServer();
    const unknown = await createThenUpdate(server, { patientId: 'patient-nonexistent' });
    const crossTenant = await server.inject({
      method: 'PUT',
      url: '/patients/patient-dev-001',
      headers: {
        'x-dev-tenant': 'tenant-attacker',
        'x-dev-pharmacy': 'pharmacy-dev-001',
        'x-dev-actor': 'user-dev-001',
        'x-dev-scopes': 'patient:write',
        'if-match': '"1"',
      },
      payload: { expectedVersion: 1, name: 'x' },
    });
    await server.close();

    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toMatchObject({ errorCode: 'PAT-0002' });
    expect(crossTenant.statusCode).toBe(404);
  });

  it('returns 422 PAT-0005 when patientNumber change is attempted', async () => {
    const server = buildDevTestServer();
    const response = await createThenUpdate(server, {
      payload: { expectedVersion: 1, name: '更新 花子', patientNumber: 'HACK-001' },
    });
    await server.close();

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0005' });
    expect(response.body).not.toContain('HACK-001');
  });

  it.each([
    [{ headers: { 'if-match': undefined as never } }, 'missing If-Match'],
    [{ headers: { 'if-match': '"2"' } }, 'If-Match != expectedVersion'],
    [{ headers: { 'if-match': '1' } }, 'unquoted If-Match'],
    [{ payload: { name: 'x' } }, 'missing expectedVersion'],
    [{ payload: { expectedVersion: 1 } }, 'no updatable field'],
  ])('returns 400 PAT-0007 for %s', async (overrides, _label) => {
    const server = buildDevTestServer();
    const created = await createPatient(server);
    const patient = (created.json() as PatientCreateResponse).patient;
    const putHeaders: Record<string, string | undefined> = {
      ...writeHeaders,
      'if-match': '"1"',
      ...(('headers' in overrides ? overrides.headers : {}) as Record<
        string,
        string | undefined
      >),
    };
    for (const [key, value] of Object.entries(putHeaders)) {
      if (value === undefined) {
        delete putHeaders[key];
      }
    }
    const response = await server.inject({
      method: 'PUT',
      url: `/patients/${patient.patientId}`,
      headers: putHeaders as Record<string, string>,
      payload:
        'payload' in overrides
          ? (overrides.payload as Record<string, unknown>)
          : { expectedVersion: 1, name: '更新 花子' },
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0007' });
  });

  it('rolls back the patient write when audit recording fails (fail-closed)', async () => {
    const failingAudit: AuditRepository = {
      list: async () => [],
      record: async () => {
        throw new Error('audit sink failure sentinel');
      },
    };
    const patientRepository = new (await import('./patient-repository.js')).InMemoryPatientRepository([]);
    const server = buildDevTestServer({ auditRepository: failingAudit, patientRepository });
    const response = await createPatient(server);
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('audit sink failure sentinel');
    expect(response.body).not.toContain(createPayload.name);
    // 補償後に患者は残らない。
    await expect(
      patientRepository.findVersionedById({
        tenantId: tenantId('tenant-dev-001'),
        pharmacyId: pharmacyId('pharmacy-dev-001'),
        patientId: patientId('patient-anything'),
      }),
    ).resolves.toBeUndefined();
    // 同じ key で再送しても idempotency record が残っていないので再作成できる。
    const retryServer = buildDevTestServer({ patientRepository });
    const retry = await createPatient(retryServer);
    await retryServer.close();
    expect(retry.statusCode).toBe(201);
  });

  it('rolls back the update (and identity history) when audit recording fails', async () => {
    const patientRepository = new (await import('./patient-repository.js')).InMemoryPatientRepository([]);
    const setupServer = buildDevTestServer({ patientRepository });
    const created = await createPatient(setupServer);
    const patient = (created.json() as PatientCreateResponse).patient;
    await setupServer.close();

    const failingAudit: AuditRepository = {
      list: async () => [],
      record: async () => {
        throw new Error('audit sink failure sentinel');
      },
    };
    const server = buildDevTestServer({ auditRepository: failingAudit, patientRepository });
    const response = await server.inject({
      method: 'PUT',
      url: `/patients/${patient.patientId}`,
      headers: { ...writeHeaders, 'if-match': '"1"' },
      payload: { expectedVersion: 1, name: '巻戻し 検証' },
    });
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('audit sink failure sentinel');
    expect(response.body).not.toContain('巻戻し 検証');

    // 旧値が復元され、identity history 残骸が残らない。
    const restored = await patientRepository.findVersionedById({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
      patientId: patientId(patient.patientId),
    });
    expect(restored?.name).toBe(createPayload.name);
    expect(restored?.version).toBe(1);
    expect(patientRepository.listIdentityHistory()).toHaveLength(0);
  });

  it.each<[Record<string, unknown>, string]>([
    [{ patientId: 'other-id' }, 'patientId'],
    [{ version: 7 }, 'version'],
    [{ eligibilityStatus: 'VERIFIED' }, 'eligibilityStatus'],
    [{ eligibilityCheckedAt: '2026-09-17T00:00:00.000Z' }, 'eligibilityCheckedAt'],
  ])('returns 422 PAT-0005 when immutable wire field %s is present', async (extra) => {
    const server = buildDevTestServer();
    const response = await createThenUpdate(server, {
      payload: { expectedVersion: 1, name: '更新 花子', ...extra },
    });
    await server.close();

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ errorCode: 'PAT-0005' });
  });
});
