import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PatientSearchResult } from '@yrese/contracts';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { buildServer, type BuildServerOptions } from './server.js';

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
