/**
 * Tenant context resolution for development and CI/E2E.
 *
 * dev_headers mode reads x-dev-tenant/x-dev-pharmacy/x-dev-actor/x-dev-scopes
 * headers only for local scaffolding and is restricted to in_memory
 * (SEC-009 §6 — resolveTenantContextMode enforces it; never production).
 *
 * test_signed mode (SEC-009 §4) reads a compact HMAC-SHA256 signed credential
 * from the x-test-auth header for CI/E2E against postgres test databases.
 * The signing key is injected via plugin options and must never share a key
 * lineage with any production IdP. Invalid or missing credentials resolve as
 * 'unauthenticated' and yield 401 AUTH-0004 on scope-required routes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyPluginCallback, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { errorResponseSchema } from '@yrese/contracts';
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  AUTH_UNAUTHENTICATED_ERROR_CODE,
  isPermissionScope,
  pharmacyId,
  tenantId,
  userId,
  type PermissionScope,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

export const authorizationErrorCode = AUTH_PERMISSION_DENIED_ERROR_CODE;

export const tenantContextModes = ['disabled', 'dev_headers', 'test_signed'] as const;

export type TenantContextMode = (typeof tenantContextModes)[number];

export interface TenantContextPluginOptions {
  readonly mode: TenantContextMode;
  /** test_signed 必須。HMAC 鍵(test/CI 専用、production 鍵系統と別系統)。 */
  readonly testAuthKey?: string | Buffer;
}

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly scopes: readonly PermissionScope[];
}

/**
 * SEC-009 §2/§5: route 層は provider を区別しない。credential の受理結果は
 * 'resolved' | 'unauthenticated' | 'none'(mode が context を供給しない)
 * で表現し、scope 不足は常に route が 403 AUTH-0003 を返す。
 */
export type TenantContextResolutionKind =
  | 'resolved'
  | 'unauthenticated'
  | 'none';

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext: TenantContext | undefined;
    tenantContextResolution: TenantContextResolutionKind;
  }
}

function getHeaderValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseScopes(headerValue: string | undefined): readonly PermissionScope[] {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    return [];
  }

  return headerValue
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
    .filter(isPermissionScope);
}

function buildTenantContext(request: FastifyRequest): TenantContext | undefined {
  const tenantHeader = getHeaderValue(request, 'x-dev-tenant');
  const pharmacyHeader = getHeaderValue(request, 'x-dev-pharmacy');
  const actorHeader = getHeaderValue(request, 'x-dev-actor');

  if (tenantHeader === undefined || pharmacyHeader === undefined || actorHeader === undefined) {
    return undefined;
  }

  try {
    return {
      tenantId: tenantId(tenantHeader),
      pharmacyId: pharmacyId(pharmacyHeader),
      actorId: userId(actorHeader),
      scopes: parseScopes(getHeaderValue(request, 'x-dev-scopes')),
    };
  } catch {
    return undefined;
  }
}

// --- test_signed (SEC-009 §4) ---

const testAuthPayloadShape = (value: unknown): value is {
  tenant: string;
  pharmacy: string;
  actor: string;
  scopes: readonly string[];
} => {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.tenant === 'string' &&
    typeof record.pharmacy === 'string' &&
    typeof record.actor === 'string' &&
    Array.isArray(record.scopes) &&
    record.scopes.every((scope) => typeof scope === 'string')
  );
};

/**
 * `x-test-auth` credential を検証する。形式は
 * `<base64url(payloadJson)>.<base64url(hmac-sha256)>`。
 * 署名不一致・形式不正・field 不正はすべて unauthenticated(理由非開示)。
 * credential/署名/鍵を log や error 応答に含めない(SEC-009 §3 不変条件)。
 */
function resolveTestSignedContext(
  request: FastifyRequest,
  key: string | Buffer,
): TenantContext | undefined {
  const header = getHeaderValue(request, 'x-test-auth');
  if (header === undefined) {
    return undefined;
  }
  const dotIndex = header.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === header.length - 1) {
    return undefined;
  }
  const payloadPart = header.slice(0, dotIndex);
  const signaturePart = header.slice(dotIndex + 1);
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = createHmac('sha256', key).update(payloadPart).digest();
    actual = Buffer.from(signaturePart, 'base64url');
  } catch {
    return undefined;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return undefined;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (!testAuthPayloadShape(payload)) {
    return undefined;
  }
  // scope 集合外の値は credential 全体を不正にする(部分的受理なし)。
  if (!payload.scopes.every(isPermissionScope)) {
    return undefined;
  }
  try {
    return {
      tenantId: tenantId(payload.tenant),
      pharmacyId: pharmacyId(payload.pharmacy),
      actorId: userId(payload.actor),
      scopes: payload.scopes,
    };
  } catch {
    return undefined;
  }
}

/** test_signed credential を署名する test 専用 helper(production 不使用)。 */
export function signTestAuthCredential(
  key: string | Buffer,
  payload: {
    tenant: string;
    pharmacy: string;
    actor: string;
    scopes: readonly string[];
  },
): string {
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signature = createHmac('sha256', key).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signature}`;
}

const tenantContextPluginCallback: FastifyPluginCallback<TenantContextPluginOptions> = (server, options, done) => {
  server.decorateRequest('tenantContext', undefined);
  server.decorateRequest('tenantContextResolution', 'none');

  if (options.mode === 'dev_headers') {
    server.addHook('preHandler', async (request) => {
      const context = buildTenantContext(request);
      request.tenantContext = context;
      request.tenantContextResolution =
        context === undefined ? 'none' : 'resolved';
    });
  } else if (options.mode === 'test_signed') {
    if (
      options.testAuthKey === undefined ||
      options.testAuthKey.length === 0
    ) {
      // avvio の callback 経路で boot を fail させる(throw は uncaught 化する)。
      // 空鍵も拒否する — 空 HMAC 鍵は公開鍵と同義で全 credential が偽造可能。
      done(new Error('test_signed tenant context mode requires testAuthKey'));
      return;
    }
    const key = options.testAuthKey;
    server.addHook('preHandler', async (request) => {
      const context = resolveTestSignedContext(request, key);
      request.tenantContext = context;
      // credential 欠落/不正は unauthenticated — scope 必須 route は
      // 403 ではなく 401 AUTH-0004 を返す(SEC-009 §5)。
      request.tenantContextResolution =
        context === undefined ? 'unauthenticated' : 'resolved';
    });
  }

  done();
};

export const tenantContextPlugin = fp(tenantContextPluginCallback, {
  name: 'tenant-context',
});

export function requireTenantContext(request: FastifyRequest): TenantContext {
  const tenantContext = request.tenantContext;
  if (tenantContext === undefined) {
    throw new Error('tenantContext is unexpectedly missing after authorization');
  }
  return tenantContext;
}

const authorizationErrorResponse = errorResponseSchema.parse({
  errorCode: authorizationErrorCode,
  message: 'Forbidden',
});

const unauthenticatedErrorResponse = errorResponseSchema.parse({
  errorCode: AUTH_UNAUTHENTICATED_ERROR_CODE,
  message: 'Unauthorized',
});

function sendAuthorizationError(reply: FastifyReply) {
  return reply.code(403).send({ ...authorizationErrorResponse });
}

function sendUnauthenticatedError(reply: FastifyReply) {
  return reply.code(401).send({ ...unauthenticatedErrorResponse });
}

export function requirePermission(scope: PermissionScope): preHandlerHookHandler {
  return async (request, reply) => {
    const tenantContext = request.tenantContext;
    if (tenantContext === undefined) {
      // SEC-009 §5: test_signed で credential が受理不能/欠落なら 401。
      // disabled/dev_headers での不在は現行どおり 403(deny-by-default)。
      if (request.tenantContextResolution === 'unauthenticated') {
        return sendUnauthenticatedError(reply);
      }
      return sendAuthorizationError(reply);
    }
    if (!tenantContext.scopes.includes(scope)) {
      return sendAuthorizationError(reply);
    }
  };
}
