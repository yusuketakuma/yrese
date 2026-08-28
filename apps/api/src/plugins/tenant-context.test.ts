import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { requireTenantContext, type TenantContext } from './tenant-context.js';

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
