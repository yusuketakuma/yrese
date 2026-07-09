/**
 * Development-only tenant context stub.
 *
 * This plugin reads x-dev-tenant/x-dev-pharmacy/x-dev-actor/x-dev-scopes headers
 * only for local scaffolding. Production authentication such as OIDC/mTLS remains
 * BLOCKED_SECURITY_REVIEW until the auth design SSOT is approved. This stub must
 * never be enabled in production configuration.
 */

import type { FastifyPluginCallback, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { errorResponseSchema } from '@yrese/contracts';
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
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

export const tenantContextModes = ['disabled', 'dev_headers'] as const;

export type TenantContextMode = (typeof tenantContextModes)[number];

export interface TenantContextPluginOptions {
  readonly mode: TenantContextMode;
}

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly scopes: readonly PermissionScope[];
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext: TenantContext | undefined;
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

const tenantContextPluginCallback: FastifyPluginCallback<TenantContextPluginOptions> = (server, options, done) => {
  server.decorateRequest('tenantContext', undefined);

  if (options.mode === 'dev_headers') {
    server.addHook('preHandler', async (request) => {
      request.tenantContext = buildTenantContext(request);
    });
  }

  done();
};

export const tenantContextPlugin = fp(tenantContextPluginCallback, {
  name: 'tenant-context',
});

function sendAuthorizationError(reply: FastifyReply) {
  return reply.code(403).send(
    errorResponseSchema.parse({
      errorCode: authorizationErrorCode,
      message: 'Forbidden',
    }),
  );
}

export function requirePermission(scope: PermissionScope): preHandlerHookHandler {
  return async (request, reply) => {
    const tenantContext = request.tenantContext;
    if (tenantContext === undefined || !tenantContext.scopes.includes(scope)) {
      return sendAuthorizationError(reply);
    }
  };
}
