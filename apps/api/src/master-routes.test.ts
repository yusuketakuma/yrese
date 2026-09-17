import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  MasterMedicationsResponse,
  MasterUsagesResponse,
} from '@yrese/contracts';
import { pharmacyId, tenantId } from '@yrese/shared-kernel';

import { InMemoryMasterRepository } from './master-repository.js';
import {
  seedSyntheticMasters,
  SYNTHETIC_MEDICATIONS,
  SYNTHETIC_USAGES,
} from './master-seed.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { buildServer, type BuildServerOptions } from './server.js';

const SEED_SCOPE = {
  tenantId: 'tenant-dev-001',
  pharmacyId: 'pharmacy-dev-001',
};
const SEED_SCOPE_BRANDED = {
  tenantId: tenantId(SEED_SCOPE.tenantId),
  pharmacyId: pharmacyId(SEED_SCOPE.pharmacyId),
};

async function buildDevTestServer(
  options: Omit<BuildServerOptions, 'repositoryMode' | 'tenantContextMode'> = {},
) {
  const masterRepository =
    options.masterRepository ?? new InMemoryMasterRepository();
  if (options.masterRepository === undefined) {
    await seedSyntheticMasters(masterRepository, SEED_SCOPE, '2026-09-01T00:00:00.000Z');
  }
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
    masterRepository,
    repositoryMode: 'in_memory',
    tenantContextMode: 'dev_headers',
  });
}

const headers = {
  'x-dev-tenant': SEED_SCOPE.tenantId,
  'x-dev-pharmacy': SEED_SCOPE.pharmacyId,
  'x-dev-actor': 'user-dev-001',
  'x-dev-scopes': 'master:read',
} as const;

describe('GET /masters/medications', () => {
  it('returns seeded synthetic items for a valid asOf', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01',
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as MasterMedicationsResponse;
    expect(body.masterVersion?.masterKind).toBe('medication');
    expect(body.masterVersion?.distributionState).toBe('synthetic');
    expect(body.items).toHaveLength(SYNTHETIC_MEDICATIONS.length);
    for (const item of body.items) {
      expect(item.localCode).toMatch(/^SYN-/u);
    }
  });

  it('returns empty items with null masterVersion when no version covers asOf', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2020-01-01',
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as MasterMedicationsResponse;
    expect(body.masterVersion).toBeNull();
    expect(body.items).toEqual([]);
  });

  it('returns 400 MST-0001 when asOf is missing or invalid', async () => {
    const server = await buildDevTestServer();
    for (const url of [
      '/masters/medications',
      '/masters/medications?asOf=not-a-date',
      '/masters/medications?asOf=2026-02-30',
    ]) {
      const response = await server.inject({ method: 'GET', url, headers });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ errorCode: 'MST-0001' });
    }
  });

  it('filters by q: localCode prefix match', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01&q=SYN-MED-00',
      headers,
    });
    const body = response.json() as MasterMedicationsResponse;
    expect(body.items.length).toBe(SYNTHETIC_MEDICATIONS.length);
    const narrow = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01&q=SYN-MED-001',
      headers,
    });
    const narrowBody = narrow.json() as MasterMedicationsResponse;
    expect(narrowBody.items).toHaveLength(1);
    expect(narrowBody.items[0]?.localCode).toBe('SYN-MED-001');
  });

  it('filters by q: name substring match, case-sensitive', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: `/masters/medications?asOf=2026-06-01&q=${encodeURIComponent('麻薬')}`,
      headers,
    });
    const body = response.json() as MasterMedicationsResponse;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toContain('麻薬');
    // case-sensitive: 'syn-med' 小文字は localCode prefix に一致しない。
    const lower = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01&q=syn-med-001',
      headers,
    });
    expect((lower.json() as MasterMedicationsResponse).items).toHaveLength(0);
  });

  it('returns 400 MST-0001 when q exceeds 100 characters', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: `/masters/medications?asOf=2026-06-01&q=${'x'.repeat(101)}`,
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errorCode: 'MST-0001' });
  });

  it('returns 403 without master:read scope', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01',
      headers: { ...headers, 'x-dev-scopes': 'patient:read' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns an empty set for cross-tenant/cross-pharmacy access (existence not disclosed)', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/medications?asOf=2026-06-01',
      headers: { ...headers, 'x-dev-tenant': 'tenant-other' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as MasterMedicationsResponse;
    expect(body.masterVersion).toBeNull();
    expect(body.items).toEqual([]);
  });
});

describe('GET /masters/usages', () => {
  it('returns seeded synthetic usage items for a valid asOf', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/usages?asOf=2026-06-01',
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as MasterUsagesResponse;
    expect(body.masterVersion?.masterKind).toBe('usage');
    expect(body.items).toHaveLength(SYNTHETIC_USAGES.length);
    for (const item of body.items) {
      expect(item.localCode).toMatch(/^SYN-/u);
    }
  });

  it('filters usages by q: localCode prefix or text substring', async () => {
    const server = await buildDevTestServer();
    const byText = await server.inject({
      method: 'GET',
      url: `/masters/usages?asOf=2026-06-01&q=${encodeURIComponent('頓用')}`,
      headers,
    });
    const body = byText.json() as MasterUsagesResponse;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.text).toContain('頓用');
    expect(body.items[0]?.mealTiming).toBe('asNeeded');
  });

  it('returns 403 without master:read scope', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/usages?asOf=2026-06-01',
      headers: { ...headers, 'x-dev-scopes': 'patient:read' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 400 MST-0001 when asOf is missing', async () => {
    const server = await buildDevTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/masters/usages',
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errorCode: 'MST-0001' });
  });
});

describe('master seed invariants', () => {
  it('seed is idempotent: re-seeding the same scope records nothing new', async () => {
    const repository = new InMemoryMasterRepository();
    await seedSyntheticMasters(repository, SEED_SCOPE, '2026-09-01T00:00:00.000Z');
    const before = await repository.list({
      ...SEED_SCOPE_BRANDED,
      kind: 'medication',
      asOf: '2026-06-01',
    });
    await seedSyntheticMasters(repository, SEED_SCOPE, '2026-09-02T00:00:00.000Z');
    const after = await repository.list({
      ...SEED_SCOPE_BRANDED,
      kind: 'medication',
      asOf: '2026-06-01',
    });
    expect(after).toEqual(before);
  });
});
