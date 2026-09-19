import Fastify, { type FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  AUTH_UNAUTHENTICATED_ERROR_CODE,
  pharmacyId,
  tenantId,
  userId,
} from '@yrese/shared-kernel';

import {
  requirePermission,
  requireTenantContext,
  signTestAuthCredential,
  tenantContextPlugin,
  type TenantContext,
} from './tenant-context.js';

describe('requireTenantContext', () => {
  it('returns the authorized context unchanged and fails closed when it is missing', () => {
    const tenantContext: TenantContext = Object.freeze({
      tenantId: tenantId('tenant-001'),
      pharmacyId: pharmacyId('pharmacy-001'),
      actorId: userId('user-001'),
      scopes: Object.freeze([]),
    });

    expect(requireTenantContext({ tenantContext } as FastifyRequest)).toBe(tenantContext);
    expect(() =>
      requireTenantContext({ tenantContext: undefined } as FastifyRequest),
    ).toThrowError(new Error('tenantContext is unexpectedly missing after authorization'));
  });
});

// WP-7405 / SEC-009 §4-§5: test_signed mode の route-level 契約。
// credential は HMAC-SHA256 署名付き compact token。不正/欠落は
// unauthenticated → scope 必須 route は 401 AUTH-0004、scope 不足は
// 403 AUTH-0003(理由非開示)。
const TEST_AUTH_KEY = 'wp7405-test-auth-key';

const testSignedPayload = {
  tenant: 'tenant-001',
  pharmacy: 'pharmacy-001',
  actor: 'pharmacist-e2e-001',
  scopes: ['tenant:read', 'patient:read'],
} as const;

function buildTestSignedServer() {
  const server = Fastify({ logger: false });
  server.register(tenantContextPlugin, {
    mode: 'test_signed',
    testAuthKey: TEST_AUTH_KEY,
  });
  server.get(
    '/probe',
    { preHandler: requirePermission('tenant:read') },
    async (request) => {
      const context = requireTenantContext(request);
      return {
        tenantId: context.tenantId,
        pharmacyId: context.pharmacyId,
        actorId: context.actorId,
        scopes: context.scopes,
      };
    },
  );
  return server;
}

describe('tenantContextPlugin test_signed (WP-7405 / SEC-009 §4)', () => {
  it('resolves a valid signed credential to the tenant context', async () => {
    const server = buildTestSignedServer();
    const response = await server.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-test-auth': signTestAuthCredential(TEST_AUTH_KEY, testSignedPayload) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant-001',
      pharmacyId: 'pharmacy-001',
      actorId: 'pharmacist-e2e-001',
      scopes: ['tenant:read', 'patient:read'],
    });
    await server.close();
  });

  it('returns 401 AUTH-0004 when the credential is missing or malformed', async () => {
    const server = buildTestSignedServer();
    for (const headers of [
      {},
      { 'x-test-auth': 'not-a-credential' },
      { 'x-test-auth': `${'x'.repeat(8)}.` },
      // 別鍵で署名 → 署名不一致。
      {
        'x-test-auth': signTestAuthCredential('different-key', testSignedPayload),
      },
    ]) {
      const response = await server.inject({
        method: 'GET',
        url: '/probe',
        headers,
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().errorCode).toBe(AUTH_UNAUTHENTICATED_ERROR_CODE);
    }
    await server.close();
  });

  it('returns 401 when the payload or signature is tampered with', async () => {
    const server = buildTestSignedServer();
    const valid = signTestAuthCredential(TEST_AUTH_KEY, testSignedPayload);
    const [payloadPart, signaturePart] = valid.split('.') as [string, string];
    // payload 改竄(署名そのまま)→ 401。
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...testSignedPayload, scopes: ['admin:all'] }),
      'utf8',
    ).toString('base64url');
    for (const credential of [
      `${tamperedPayload}.${signaturePart}`,
      `${payloadPart}.${signaturePart.slice(0, -2)}aa`,
    ]) {
      const response = await server.inject({
        method: 'GET',
        url: '/probe',
        headers: { 'x-test-auth': credential },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().errorCode).toBe(AUTH_UNAUTHENTICATED_ERROR_CODE);
    }
    await server.close();
  });

  it('rejects credentials carrying scopes outside the permission set', async () => {
    const server = buildTestSignedServer();
    const response = await server.inject({
      method: 'GET',
      url: '/probe',
      headers: {
        'x-test-auth': signTestAuthCredential(TEST_AUTH_KEY, {
          ...testSignedPayload,
          scopes: ['tenant:read', 'not-a-scope'],
        }),
      },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().errorCode).toBe(AUTH_UNAUTHENTICATED_ERROR_CODE);
    await server.close();
  });

  it('returns 403 AUTH-0003 when the credential lacks the required scope', async () => {
    const server = buildTestSignedServer();
    const response = await server.inject({
      method: 'GET',
      url: '/probe',
      headers: {
        'x-test-auth': signTestAuthCredential(TEST_AUTH_KEY, {
          ...testSignedPayload,
          scopes: ['patient:read'],
        }),
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
    await server.close();
  });

  it('fails closed when test_signed is configured without a key', async () => {
    const server = Fastify({ logger: false });
    server.register(tenantContextPlugin, { mode: 'test_signed' });
    await expect(server.ready()).rejects.toThrowError(
      'test_signed tenant context mode requires testAuthKey',
    );
  });
});
