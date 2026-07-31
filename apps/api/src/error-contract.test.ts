import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { errorResponseSchema, frameworkErrorResponseSchema } from '@yrese/contracts';

import { type AuditRepository } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { type PatientRepository } from './patient-repository.js';
import { type ReceptionRepository } from './reception-repository.js';
import {
  auditLogRepositoryReadErrorMessage,
  buildServer,
  patientLookupRepositoryErrorMessage,
  patientSearchRepositoryErrorMessage,
  receptionQueueRepositoryErrorMessage,
  type BuildServerOptions,
} from './server.js';

/**
 * WP-9008: 到達可能なエラー面の producer conformance。
 * 生成 OpenAPI(docs/api/openapi.yaml)が宣言する形 — ドメインエラーは
 * ErrorResponse、パーサ 400 / 未知ルート 404 / 正規化 500 は
 * FrameworkErrorResponse(定数 message・raw 非 echo・PHI 非含有)、
 * PHI ルートは全 status で Cache-Control: no-store — と実応答の一致を検証する。
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

const fullScopeHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'tenant:read,patient:read,reception:read,reception:write,audit-log:read',
} as const;

describe('framework-shaped error surface (WP-9008 conformance)', () => {
  it('normalizes a malformed JSON body to a declared framework 400 with no-store', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: { ...fullScopeHeaders, 'content-type': 'application/json' },
      payload: '{invalid-json',
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = frameworkErrorResponseSchema.parse(response.json());
    expect(parsed.statusCode).toBe(400);
    expect(parsed.code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
  });

  it('coerces a non-JSON content type through validation as declared RCV-0001', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/reception',
      headers: { ...fullScopeHeaders, 'content-type': 'text/plain' },
      payload: 'not json',
    });
    await server.close();

    expect(response.statusCode).toBe(400);
    const parsed = errorResponseSchema.parse(response.json());
    expect(parsed.errorCode).toBe('RCV-0001');
  });

  it('returns a framework-shaped 404 for unknown routes', async () => {
    const server = buildDevTestServer();
    const response = await server.inject({ method: 'GET', url: '/no-such-route' });
    await server.close();

    expect(response.statusCode).toBe(404);
    const parsed = frameworkErrorResponseSchema.parse(response.json());
    expect(parsed.statusCode).toBe(404);
  });
});

describe('authorization denial surface (WP-9008 conformance)', () => {
  it.each([
    ['GET', '/whoami', false],
    ['GET', '/patients/search?q=a', true],
    ['GET', '/patients/patient-syn-001', true],
    ['GET', '/reception/queue?date=2026-07-09', true],
    ['POST', '/reception', true],
    ['GET', '/audit/events', true],
  ] as const)(
    'declares %s %s denial as ErrorResponse AUTH-0003',
    async (method, url, sensitiveNoStore) => {
      const server = buildDevTestServer();
      const response = await server.inject({
        method,
        url,
        headers: { ...fullScopeHeaders, 'x-dev-scopes': '' },
        ...(method === 'POST' ? { payload: {} } : {}),
      });
      await server.close();

      expect(response.statusCode).toBe(403);
      const parsed = errorResponseSchema.parse(response.json());
      expect(parsed.errorCode).toBe('AUTH-0003');
      if (sensitiveNoStore) {
        expect(response.headers['cache-control']).toBe('no-store');
      }
    },
  );
});

describe('normalized 500 surface (WP-9008 conformance)', () => {
  const rawSentinel = 'raw repository failure secret 9008';
  const failingPatientRepository: PatientRepository = {
    search: async () => {
      throw new Error(rawSentinel);
    },
    findById: async () => {
      throw new Error(rawSentinel);
    },
  };
  const failingReceptionRepository: Pick<ReceptionRepository, 'list'> = {
    list: async () => {
      throw new Error(rawSentinel);
    },
  };
  const failingAuditRepository: AuditRepository = {
    record: async () => {
      throw new Error(rawSentinel);
    },
    list: async () => {
      throw new Error(rawSentinel);
    },
  };

  it.each([
    [
      'GET /patients/search',
      '/patients/search?q=a',
      patientSearchRepositoryErrorMessage,
      { patientRepository: failingPatientRepository },
    ],
    [
      'GET /patients/:patientId',
      '/patients/patient-syn-001',
      patientLookupRepositoryErrorMessage,
      { patientRepository: failingPatientRepository },
    ],
    [
      'GET /reception/queue',
      '/reception/queue?date=2026-07-09',
      receptionQueueRepositoryErrorMessage,
      { receptionRepository: failingReceptionRepository as ReceptionRepository },
    ],
    [
      'GET /audit/events',
      '/audit/events',
      auditLogRepositoryReadErrorMessage,
      { auditRepository: failingAuditRepository },
    ],
  ] as const)(
    '%s declares repository failure as constant-message framework 500 with no-store',
    async (_label, url, expectedMessage, options) => {
      const server = buildDevTestServer(options as Partial<BuildServerOptions>);
      const response = await server.inject({
        method: 'GET',
        url,
        headers: fullScopeHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(500);
      expect(response.headers['cache-control']).toBe('no-store');
      const parsed = frameworkErrorResponseSchema.parse(response.json());
      expect(parsed).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: expectedMessage,
      });
      // raw 例外・PHI を一切返さない(定数 message のみ)。
      expect(response.body).not.toContain(rawSentinel);
      expect(response.body).not.toContain('合成患者');
    },
  );
});
