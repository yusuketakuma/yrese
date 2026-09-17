import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  InMemoryAuditRepository,
  type AuditRepository,
} from './audit-repository.js';
import {
  buildServer,
  type BuildServerOptions,
} from './server.js';
import {
  eligibilityInvalidRequestErrorCode,
  eligibilityReceptionNotFoundErrorCode,
  eligibilitySnapshotConflictErrorCode,
  eligibilityTransitionErrorCode,
} from './eligibility-snapshot-routes.js';
import { authorizationErrorCode } from './plugins/tenant-context.js';

/**
 * WP-7204: POST/GET /reception/{receptionId}/eligibility-snapshots の契約テスト。
 * API-019 0.1.0: POST は insurance:write + reception:read、GET は
 * insurance:read + reception:read。append-only、冪等再送、ADP-004 遷移表、
 * 監査(eligibility.verified / eligibility.provisional_recorded /
 * insurance.viewed)の 1操作=1イベント。
 */

const fixedNow = new Date('2026-07-09T10:00:00.000Z');

function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    now: () => new Date(fixedNow),
    ...options,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

const writeHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'insurance:write,reception:read',
} as const;

const readHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'insurance:read,reception:read',
} as const;

const otherTenantWriteHeaders = {
  ...writeHeaders,
  'x-dev-tenant': 'tenant-002',
  'x-dev-actor': 'user-002',
} as const;

const otherPharmacyWriteHeaders = {
  ...writeHeaders,
  'x-dev-pharmacy': 'pharmacy-002',
  'x-dev-actor': 'user-003',
} as const;

const validBody = {
  snapshotId: 'snap-test-0001',
  verifiedMethod: 'CARD_ONLINE',
  state: 'VERIFIED_CARD',
  verifiedAt: '2026-07-09T09:30:00.000Z',
  asOfDate: '2026-07-09',
  validFrom: '2026-07-09',
  validTo: '2027-03-31',
} as const;

function recordRequest(
  receptionIdValue: string,
  overrides: {
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
) {
  return {
    method: 'POST' as const,
    url: `/reception/${receptionIdValue}/eligibility-snapshots`,
    headers: { ...writeHeaders, ...overrides.headers },
    payload: overrides.body ?? { ...validBody },
  };
}

function listRequest(
  receptionIdValue: string,
  overrides: { readonly headers?: Record<string, string> } = {},
) {
  return {
    method: 'GET' as const,
    url: `/reception/${receptionIdValue}/eligibility-snapshots`,
    headers: { ...readHeaders, ...overrides.headers },
  };
}

async function auditEvents(auditRepository: InMemoryAuditRepository) {
  return auditRepository.list({
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
  });
}

describe('POST /reception/:receptionId/eligibility-snapshots', () => {
  it('records VERIFIED_CARD with 201, no-store, and eligibility.verified audit', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(
      recordRequest('reception-syn-002'),
    );
    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json();
    expect(body).toEqual({
      snapshotId: 'snap-test-0001',
      receptionId: 'reception-syn-002',
      state: 'VERIFIED_CARD',
      verifiedMethod: 'CARD_ONLINE',
      verifiedAt: '2026-07-09T09:30:00.000Z',
      validFrom: '2026-07-09',
      validTo: '2027-03-31',
      derivedState: 'VERIFIED_CARD',
    });
    // PHI / 資格内容・opaque ref は応答に含めない
    expect(response.body).not.toContain('rawResponseRef');

    const events = await auditEvents(auditRepository);
    const event = events.find(
      (entry) => entry.auditEventType === 'eligibility.verified',
    );
    expect(event).toBeDefined();
    expect(event?.targetRef).toEqual({
      kind: 'eligibility_snapshot',
      id: 'snap-test-0001',
    });
    expect(event?.actorId).toBe('user-001');
    expect(event?.outcome).toBe('success');
    await server.close();
  });

  it('records PROVISIONAL_VISUAL with eligibility.provisional_recorded audit', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(
      recordRequest('reception-syn-002', {
        body: {
          ...validBody,
          verifiedMethod: 'CARD_VISUAL',
          state: 'PROVISIONAL_VISUAL',
        },
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().derivedState).toBe('PROVISIONAL_VISUAL');

    const events = await auditEvents(auditRepository);
    const event = events.find(
      (entry) => entry.auditEventType === 'eligibility.provisional_recorded',
    );
    expect(event).toBeDefined();
    expect(event?.targetRef).toEqual({
      kind: 'eligibility_snapshot',
      id: 'snap-test-0001',
    });
    await server.close();
  });

  it('returns the same snapshot with 200 and no second audit on identical retry', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const first = await server.inject(recordRequest('reception-syn-002'));
    expect(first.statusCode).toBe(201);

    const retry = await server.inject(recordRequest('reception-syn-002'));
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());

    const events = await auditEvents(auditRepository);
    expect(
      events.filter(
        (entry) => entry.auditEventType === 'eligibility.verified',
      ),
    ).toHaveLength(1);
    await server.close();
  });

  it('returns 409 INS-0009 when the same snapshotId is resent with different content', async () => {
    const server = buildDevTestServer();
    const first = await server.inject(recordRequest('reception-syn-002'));
    expect(first.statusCode).toBe(201);

    const conflict = await server.inject(
      recordRequest('reception-syn-002', {
        body: { ...validBody, validTo: '2027-06-30' },
      }),
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().errorCode).toBe(eligibilitySnapshotConflictErrorCode);
    await server.close();
  });

  it('returns 400 INS-0007 for a method/state mismatch (CARD_VISUAL cannot yield VERIFIED_CARD)', async () => {
    const server = buildDevTestServer();
    const response = await server.inject(
      recordRequest('reception-syn-002', {
        body: {
          ...validBody,
          verifiedMethod: 'CARD_VISUAL',
          state: 'VERIFIED_CARD',
        },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe(eligibilityInvalidRequestErrorCode);
    await server.close();
  });

  it('returns 422 INS-0010 for pairs that are not manually recordable (MYNA_ONLINE / NONE / terminal states)', async () => {
    const server = buildDevTestServer();
    for (const [verifiedMethod, state] of [
      ['MYNA_ONLINE', 'VERIFIED_MYNA'],
      ['NONE', 'OFFLINE_PROVISIONAL'],
      ['CARD_ONLINE', 'EXPIRED'],
      ['CARD_VISUAL', 'MISMATCH'],
    ] as const) {
      const response = await server.inject(
        recordRequest('reception-syn-002', {
          body: { ...validBody, verifiedMethod, state },
        }),
      );
      expect(response.statusCode).toBe(422);
      expect(response.json().errorCode).toBe(eligibilityTransitionErrorCode);
    }
    await server.close();
  });

  it('returns 422 INS-0010 for transitions outside the ADP-004 table (VERIFIED_CARD -> PROVISIONAL_VISUAL)', async () => {
    const server = buildDevTestServer();
    const first = await server.inject(recordRequest('reception-syn-002'));
    expect(first.statusCode).toBe(201);

    const second = await server.inject(
      recordRequest('reception-syn-002', {
        body: {
          ...validBody,
          snapshotId: 'snap-test-0002',
          verifiedMethod: 'CARD_VISUAL',
          state: 'PROVISIONAL_VISUAL',
        },
      }),
    );
    expect(second.statusCode).toBe(422);
    expect(second.json().errorCode).toBe(eligibilityTransitionErrorCode);
    await server.close();
  });

  it.each([
    [{}, 'empty body'],
    [{ ...validBody, asOfDate: '2026-02-30' }, 'nonexistent calendar date'],
    [{ ...validBody, asOfDate: '07/09/2026' }, 'non-ISO asOfDate'],
    [{ ...validBody, validTo: '2026-01-01' }, 'validTo before validFrom'],
    [{ ...validBody, snapshotId: 'snap\t0001' }, 'control character snapshotId'],
    [
      { ...validBody, snapshotId: 'x'.repeat(129) },
      'snapshotId over the wire limit',
    ],
  ])('returns 400 INS-0007 for %s', async (body, _label) => {
    const server = buildDevTestServer();
    const response = await server.inject(
      recordRequest('reception-syn-002', { body }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe(eligibilityInvalidRequestErrorCode);
    await server.close();
  });

  it('returns 404 INS-0008 for an absent reception and for cross-tenant / cross-pharmacy probes', async () => {
    const server = buildDevTestServer();
    const absent = await server.inject(
      recordRequest('reception-syn-999'),
    );
    expect(absent.statusCode).toBe(404);
    expect(absent.json().errorCode).toBe(
      eligibilityReceptionNotFoundErrorCode,
    );

    const crossTenant = await server.inject(
      recordRequest('reception-syn-002', { headers: otherTenantWriteHeaders }),
    );
    expect(crossTenant.statusCode).toBe(404);
    expect(crossTenant.json().errorCode).toBe(
      eligibilityReceptionNotFoundErrorCode,
    );

    const crossPharmacy = await server.inject(
      recordRequest('reception-syn-002', {
        headers: otherPharmacyWriteHeaders,
      }),
    );
    expect(crossPharmacy.statusCode).toBe(404);
    await server.close();
  });

  it.each([
    ['insurance:read,reception:read', 'missing insurance:write'],
    ['insurance:write', 'missing reception:read'],
    ['reception:write', 'missing both insurance scopes'],
  ])('denies POST with 403 when scope set is %s', async (scopes) => {
    const server = buildDevTestServer();
    const response = await server.inject(
      recordRequest('reception-syn-002', {
        headers: { 'x-dev-scopes': scopes },
      }),
    );
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(authorizationErrorCode);
    await server.close();
  });

  it('projects the recorded snapshot into the reception queue entry eligibility', async () => {
    const server = buildDevTestServer();
    const record = await server.inject(recordRequest('reception-syn-002'));
    expect(record.statusCode).toBe(201);

    const queue = await server.inject({
      method: 'GET',
      url: '/reception/queue?date=2026-07-09',
      headers: {
        'x-dev-tenant': 'tenant-001',
        'x-dev-pharmacy': 'pharmacy-001',
        'x-dev-actor': 'user-001',
        'x-dev-scopes': 'reception:read,patient:read',
      },
    });
    expect(queue.statusCode).toBe(200);
    const entry = queue
      .json()
      .entries.find(
        (candidate: { receptionId: string }) =>
          candidate.receptionId === 'reception-syn-002',
      );
    expect(entry.eligibility).toEqual({
      state: 'VERIFIED_CARD',
      snapshotId: 'snap-test-0001',
      allowsProvisionalCalculation: true,
      allowsFinalCalculation: true,
    });
    await server.close();
  });

  it('rolls back the snapshot when the audit append fails (fail-closed, no durable record)', async () => {
    // 記録系監査(eligibility.*)だけを失敗させ、読取監査(insurance.viewed)は
    // 通す条件付き sink — 巻き戻し後の GET 検証を可能にする。
    const inner = new InMemoryAuditRepository();
    const failingAudit: AuditRepository = {
      async record(scope, input) {
        if (input.auditEventType.startsWith('eligibility.')) {
          throw new Error('audit sink unavailable');
        }
        return inner.record(scope, input);
      },
      list: (scope) => inner.list(scope),
    };
    const server = buildDevTestServer({ auditRepository: failingAudit });

    const record = await server.inject(recordRequest('reception-syn-002'));
    expect(record.statusCode).toBe(500);
    // 正規化 500 で内部メッセージ・PHI を漏らさない
    expect(record.body).not.toContain('audit sink unavailable');

    // 補償巻戻しの検証: durable な snapshot が残っていれば GET は
    // VERIFIED_CARD を返すはず。UNVERIFIED + 空履歴なら巻き戻し成功。
    const view = await server.inject(listRequest('reception-syn-002'));
    expect(view.statusCode).toBe(200);
    expect(view.json().current.state).toBe('UNVERIFIED');
    expect(view.json().snapshots).toHaveLength(0);
    await server.close();
  });
});

describe('GET /reception/:receptionId/eligibility-snapshots', () => {
  it('returns UNVERIFIED with empty history for a reception without a snapshot and records insurance.viewed', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const server = buildDevTestServer({ auditRepository });
    const response = await server.inject(listRequest('reception-syn-002'));
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      receptionId: 'reception-syn-002',
      current: {
        state: 'UNVERIFIED',
        snapshotId: null,
        allowsProvisionalCalculation: false,
        allowsFinalCalculation: false,
      },
      snapshots: [],
    });

    const events = await auditEvents(auditRepository);
    const viewed = events.find(
      (entry) => entry.auditEventType === 'insurance.viewed',
    );
    expect(viewed).toBeDefined();
    expect(viewed?.targetRef).toEqual({
      kind: 'reception',
      id: 'reception-syn-002',
    });
    expect(viewed?.outcome).toBe('success');
    await server.close();
  });

  it('returns the current state and newest-first history after recording', async () => {
    const server = buildDevTestServer();
    const record = await server.inject(recordRequest('reception-syn-002'));
    expect(record.statusCode).toBe(201);

    const response = await server.inject(listRequest('reception-syn-002'));
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.current).toEqual({
      state: 'VERIFIED_CARD',
      snapshotId: 'snap-test-0001',
      allowsProvisionalCalculation: true,
      allowsFinalCalculation: true,
    });
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0].snapshotId).toBe('snap-test-0001');
    expect(body.snapshots[0]).not.toHaveProperty('rawResponseRef');
    expect(body.snapshots[0]).not.toHaveProperty('recordedBy');
    await server.close();
  });

  it('returns 404 INS-0008 for absent and cross-scope receptions', async () => {
    const server = buildDevTestServer();
    const absent = await server.inject(listRequest('reception-syn-999'));
    expect(absent.statusCode).toBe(404);
    expect(absent.json().errorCode).toBe(
      eligibilityReceptionNotFoundErrorCode,
    );

    const crossTenant = await server.inject(
      listRequest('reception-syn-002', {
        headers: { ...readHeaders, 'x-dev-tenant': 'tenant-002' },
      }),
    );
    expect(crossTenant.statusCode).toBe(404);
    await server.close();
  });

  it.each([
    ['reception:read', 'missing insurance:read'],
    ['insurance:read', 'missing reception:read'],
  ])('denies GET with 403 when scope set is %s', async (scopes) => {
    const server = buildDevTestServer();
    const response = await server.inject(
      listRequest('reception-syn-002', {
        headers: { 'x-dev-scopes': scopes },
      }),
    );
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(authorizationErrorCode);
    await server.close();
  });
});
