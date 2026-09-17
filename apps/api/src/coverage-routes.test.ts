import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  CoverageListResponse,
  InsuranceCard,
  PublicExpense,
} from '@yrese/contracts';
import type { AuditRepository } from './audit-repository.js';
import { InMemoryAuditRepository } from './audit-repository.js';
import { pharmacyId, tenantId } from '@yrese/shared-kernel';

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

const allScopes = [
  'patient:read',
  'patient:write',
  'insurance:read',
  'insurance:write',
  'public-expense:read',
  'public-expense:write',
].join(',');

const headers = {
  'x-dev-tenant': 'tenant-dev-001',
  'x-dev-pharmacy': 'pharmacy-dev-001',
  'x-dev-actor': 'user-dev-001',
  'x-dev-scopes': allScopes,
} as const;

function headersWithScopes(scopes: string) {
  return { ...headers, 'x-dev-scopes': scopes };
}

const cardPayload = {
  kind: 'insurance-card',
  insurerNumber: 'SYN12345',
  insuredSymbol: 'G-001',
  insuredNumber: '0001',
  relationship: 'self',
  copayRatio: 0.3,
  validFrom: '2026-04-01',
} as const;

const expensePayload = {
  kind: 'public-expense',
  payerNumber: 'SYN54321',
  recipientNumber: 'R-0001',
  priority: 1,
  validFrom: '2026-04-01',
} as const;

const key = 'coverage-key-00000000001';

async function registerPatient(
  server: Awaited<ReturnType<typeof buildDevTestServer>>,
): Promise<string> {
  const response = await server.inject({
    method: 'POST',
    url: '/patients',
    headers: {
      ...headers,
      'idempotency-key': 'patient-seed-key-000001',
    },
    payload: {
      name: '被保険 太郎',
      kana: 'ヒホケンタロウ',
      birthDate: '1980-01-01',
      sex: 'male',
    },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { patient: { patientId: string } }).patient
    .patientId;
}

async function postCoverage(
  server: Awaited<ReturnType<typeof buildDevTestServer>>,
  patient: string,
  overrides: {
    payload?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const requestHeaders: Record<string, string> = {
    ...headers,
    'idempotency-key': key,
    ...overrides.headers,
  };
  return server.inject({
    method: 'POST',
    url: `/patients/${patient}/coverage`,
    headers: requestHeaders,
    payload: overrides.payload ?? cardPayload,
  });
}

async function getCoverage(
  server: Awaited<ReturnType<typeof buildDevTestServer>>,
  patient: string,
  asOf = '2026-09-18',
  requestHeaders: Record<string, string> = headers,
) {
  return server.inject({
    method: 'GET',
    url: `/patients/${patient}/coverage?asOf=${asOf}`,
    headers: requestHeaders,
  });
}

describe('POST /patients/{id}/coverage (WP-7203)', () => {
  it('records an insurance card: 201, insurance.updated audit, no-store', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const patient = await registerPatient(server);
    const response = await postCoverage(server, patient);
    await server.close();

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as InsuranceCard;
    expect(body.insuranceCardId).toMatch(/^insurance-card-/);
    expect(body.insurerNumber).toBe('SYN12345');
    expect(body.supersededBy).toBeNull();

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    const coverageAudits = audits.filter(
      (a) => a.auditEventType === 'insurance.updated',
    );
    expect(coverageAudits).toHaveLength(1);
    // 監査 payload は識別子+kind のみ(保険者番号・記号番号を含まない)。
    const serialized = JSON.stringify(coverageAudits, (_k, v) =>
      typeof v === 'bigint' ? String(v) : v,
    );
    expect(serialized).not.toContain('SYN12345');
    expect(serialized).not.toContain('G-001');
  });

  it('records a public expense row', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const response = await postCoverage(server, patient, {
      payload: expensePayload,
    });
    await server.close();
    expect(response.statusCode).toBe(201);
    const body = response.json() as PublicExpense;
    expect(body.publicExpenseId).toMatch(/^public-expense-/);
    expect(body.priority).toBe(1);
  });

  it('replays the same idempotency key + payload as 200 and conflicts on different payload', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const patient = await registerPatient(server);
    const first = await postCoverage(server, patient);
    const replay = await postCoverage(server, patient);
    const conflict = await postCoverage(server, patient, {
      payload: { ...cardPayload, insuredNumber: '9999' },
    });
    await server.close();

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(
      (replay.json() as InsuranceCard)
        .insuranceCardId,
    ).toBe(
      (first.json() as InsuranceCard)
        .insuranceCardId,
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().errorCode).toBe('INS-0006');

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    // replay/conflict は監査を増やさない。
    expect(
      audits.filter((a) => a.auditEventType === 'insurance.updated'),
    ).toHaveLength(1);
  });

  it('rejects overlapping insurance-card periods with 409 INS-0003', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    // 先行行は有限期間(validTo なしだと無期限になり後続すべてと重複する)。
    await postCoverage(server, patient, {
      payload: { ...cardPayload, validTo: '2026-12-31' },
    });
    const overlapping = await postCoverage(server, patient, {
      payload: { ...cardPayload, insuredNumber: '0002' },
      headers: { 'idempotency-key': 'coverage-key-00000000002' },
    });
    const disjoint = await postCoverage(server, patient, {
      payload: {
        ...cardPayload,
        insuredNumber: '0003',
        validFrom: '2027-01-01',
      },
      headers: { 'idempotency-key': 'coverage-key-00000000003' },
    });
    await server.close();
    expect(overlapping.statusCode).toBe(409);
    expect(overlapping.json().errorCode).toBe('INS-0003');
    // 期間が離れた 2 枚目は受理される(先行行を閉じるのは supersede の責務)。
    expect(disjoint.statusCode).toBe(201);
  });

  it('rejects duplicate public-expense priority with overlapping period (INS-0004)', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    await postCoverage(server, patient, {
      payload: { ...expensePayload, validTo: '2026-12-31' },
    });
    const dup = await postCoverage(server, patient, {
      payload: { ...expensePayload, recipientNumber: 'R-0002' },
      headers: { 'idempotency-key': 'coverage-key-00000000004' },
    });
    // 期間が離れた同一 priority は許容(履歴)。
    const later = await postCoverage(server, patient, {
      payload: { ...expensePayload, recipientNumber: 'R-0003', validFrom: '2027-01-01', validTo: '2027-12-31' },
      headers: { 'idempotency-key': 'coverage-key-00000000005' },
    });
    await server.close();
    expect(dup.statusCode).toBe(409);
    expect(dup.json().errorCode).toBe('INS-0004');
    expect(later.statusCode).toBe(201);
  });

  it('supersede creates a linked correction and rejects double/missing supersede (INS-0005)', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const created = await postCoverage(server, patient);
    const cardId = (
      created.json() as InsuranceCard
    ).insuranceCardId;

    const superseded = await postCoverage(server, patient, {
      payload: {
        kind: 'supersede',
        targetKind: 'insurance-card',
        targetId: cardId,
        insurerNumber: cardPayload.insurerNumber,
        insuredSymbol: cardPayload.insuredSymbol,
        insuredNumber: '0010',
        relationship: 'self',
        copayRatio: 0.3,
        validFrom: '2026-05-01',
      },
      headers: { 'idempotency-key': 'coverage-key-00000000006' },
    });
    const doubleSupersede = await postCoverage(server, patient, {
      payload: {
        kind: 'supersede',
        targetKind: 'insurance-card',
        targetId: cardId,
        insurerNumber: cardPayload.insurerNumber,
        insuredSymbol: cardPayload.insuredSymbol,
        insuredNumber: '0011',
        relationship: 'self',
        copayRatio: 0.3,
        validFrom: '2026-06-01',
      },
      headers: { 'idempotency-key': 'coverage-key-00000000007' },
    });
    const missingTarget = await postCoverage(server, patient, {
      payload: {
        kind: 'supersede',
        targetKind: 'insurance-card',
        targetId: 'insurance-card-nonexistent',
        insurerNumber: cardPayload.insurerNumber,
        insuredSymbol: cardPayload.insuredSymbol,
        insuredNumber: '0012',
        relationship: 'self',
        copayRatio: 0.3,
        validFrom: '2026-06-01',
      },
      headers: { 'idempotency-key': 'coverage-key-00000000008' },
    });
    await server.close();

    expect(superseded.statusCode).toBe(201);
    expect(doubleSupersede.statusCode).toBe(409);
    expect(doubleSupersede.json().errorCode).toBe('INS-0005');
    expect(missingTarget.statusCode).toBe(409);
    expect(missingTarget.json().errorCode).toBe('INS-0005');
  });

  it('enforces kind-scoped write permission and patient:read', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    // patient:read なし
    const noRead = await server.inject({
      method: 'POST',
      url: `/patients/${patient}/coverage`,
      headers: headersWithScopes('insurance:write'),
      payload: cardPayload,
    });
    // insurance:write なし(insurance-card)
    const noInsuranceWrite = await server.inject({
      method: 'POST',
      url: `/patients/${patient}/coverage`,
      headers: {
        ...headersWithScopes('patient:read,public-expense:write'),
        'idempotency-key': key,
      },
      payload: cardPayload,
    });
    // public-expense:write なし(public-expense)
    const noExpenseWrite = await server.inject({
      method: 'POST',
      url: `/patients/${patient}/coverage`,
      headers: {
        ...headersWithScopes('patient:read,insurance:write'),
        'idempotency-key': key,
      },
      payload: expensePayload,
    });
    await server.close();
    expect(noRead.statusCode).toBe(403);
    expect(noInsuranceWrite.statusCode).toBe(403);
    expect(noExpenseWrite.statusCode).toBe(403);
  });

  it('returns 400 for missing/invalid Idempotency-Key and body (INS-0001)', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const noKey = await server.inject({
      method: 'POST',
      url: `/patients/${patient}/coverage`,
      headers,
      payload: cardPayload,
    });
    const badKey = await postCoverage(server, patient, {
      headers: { 'idempotency-key': 'short' },
    });
    const badBody = await postCoverage(server, patient, {
      payload: { kind: 'insurance-card' },
    });
    await server.close();
    for (const response of [noKey, badKey, badBody]) {
      expect(response.statusCode).toBe(400);
      expect(response.json().errorCode).toBe('INS-0001');
    }
  });

  it('returns 404 INS-0002 for unknown/cross-scope patients', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const unknown = await postCoverage(server, 'patient-nonexistent');
    const crossTenant = await server.inject({
      method: 'POST',
      url: `/patients/${patient}/coverage`,
      headers: {
        ...headersWithScopes(allScopes),
        'x-dev-tenant': 'tenant-other',
        'idempotency-key': key,
      },
      payload: cardPayload,
    });
    await server.close();
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().errorCode).toBe('INS-0002');
    expect(crossTenant.statusCode).toBe(404);
    expect(crossTenant.json().errorCode).toBe('INS-0002');
  });

  it('rolls back the row when audit persistence fails (no durable write, no raw error)', async () => {
    const base = new InMemoryAuditRepository();
    const failing: AuditRepository = {
      record: (scope, intent) =>
        intent.auditEventType === 'insurance.updated'
          ? Promise.reject(new Error('audit store down — SENTINEL-PHI-SYN12345'))
          : base.record(scope, intent),
      list: (scope) => base.list(scope),
    };
    const server = buildDevTestServer({ auditRepository: failing });
    const patient = await registerPatient(server);
    const response = await postCoverage(server, patient);
    const view = await getCoverage(server, patient);
    await server.close();

    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.json())).not.toContain('SYN12345');
    expect(JSON.stringify(response.json())).not.toContain('SENTINEL');
    // 監査失敗で行は残らない(補償 rollback)。
    const body = view.json() as CoverageListResponse;
    expect(body.insuranceCards).toHaveLength(0);
  });
});

describe('GET /patients/{id}/coverage (WP-7203)', () => {
  it('lists date-valid rows only and records insurance.viewed', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const patient = await registerPatient(server);
    await postCoverage(server, patient);
    await postCoverage(server, patient, {
      payload: expensePayload,
      headers: { 'idempotency-key': 'coverage-key-00000000009' },
    });
    // 期間外の行(2027)は含まれない。
    await postCoverage(server, patient, {
      payload: { ...expensePayload, recipientNumber: 'R-0007', priority: 2, validFrom: '2027-01-01' },
      headers: { 'idempotency-key': 'coverage-key-00000000010' },
    });
    const response = await getCoverage(server, patient);
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as CoverageListResponse;
    expect(body.insuranceCards).toHaveLength(1);
    expect(body.publicExpenses).toHaveLength(1);
    expect(body.publicExpenses[0]?.recipientNumber).toBe('R-0001');

    const audits = await auditRepository.list({
      tenantId: tenantId('tenant-dev-001'),
      pharmacyId: pharmacyId('pharmacy-dev-001'),
    });
    expect(
      audits.filter((a) => a.auditEventType === 'insurance.viewed'),
    ).toHaveLength(1);
  });

  it('returns superseded rows with the supersededBy marker', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const created = await postCoverage(server, patient);
    const cardId = (
      created.json() as InsuranceCard
    ).insuranceCardId;
    const corrected = await postCoverage(server, patient, {
      payload: {
        kind: 'supersede',
        targetKind: 'insurance-card',
        targetId: cardId,
        insurerNumber: cardPayload.insurerNumber,
        insuredSymbol: cardPayload.insuredSymbol,
        insuredNumber: '0010',
        relationship: 'self',
        copayRatio: 0.3,
        validFrom: '2026-05-01',
      },
      headers: { 'idempotency-key': 'coverage-key-00000000011' },
    });
    expect(corrected.statusCode).toBe(201);
    const newId = (
      corrected.json() as InsuranceCard
    ).insuranceCardId;

    const view = await getCoverage(server, patient);
    await server.close();
    const body = view.json() as CoverageListResponse;
    // 旧行は supersededBy マーカー付きで返る(日付上有効なため)。
    const old = body.insuranceCards.find(
      (c) => c.insuranceCardId === cardId,
    );
    expect(old?.supersededBy).toBe(newId);
  });

  it('requires asOf and rejects non-real dates (INS-0001)', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    const missing = await server.inject({
      method: 'GET',
      url: `/patients/${patient}/coverage`,
      headers,
    });
    const invalid = await getCoverage(server, patient, '2026-02-30');
    await server.close();
    for (const response of [missing, invalid]) {
      expect(response.statusCode).toBe(400);
      expect(response.json().errorCode).toBe('INS-0001');
    }
  });

  it('requires all three read scopes', async () => {
    const server = buildDevTestServer();
    const patient = await registerPatient(server);
    for (const scopes of [
      'patient:read,insurance:read',
      'patient:read,public-expense:read',
      'insurance:read,public-expense:read',
    ]) {
      const response = await getCoverage(
        server,
        patient,
        '2026-09-18',
        headersWithScopes(scopes),
      );
      expect(response.statusCode).toBe(403);
    }
    await server.close();
  });

  it('returns 404 INS-0002 for unknown patient (existence not disclosed)', async () => {
    const server = buildDevTestServer();
    const response = await getCoverage(server, 'patient-nonexistent');
    await server.close();
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe('INS-0002');
  });
});
