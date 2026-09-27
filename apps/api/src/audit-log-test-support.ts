import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createAuditEvent,
  verifyAuditHashChain,
  type AuditEvent,
  type CreateAuditEventInput,
} from '@yrese/audit';
import type { AuditLogResponse } from '@yrese/contracts';
import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { InMemoryAuditRepository, type AuditRepository, type AuditScope } from './audit-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import {
  auditLogDuplicateIdentityInvariantErrorMessage,
  auditLogListSchemaInvariantErrorMessage,
  auditLogRepositoryReadErrorMessage,
  auditLogSequenceInvariantErrorMessage,
  auditLogScopeInvariantErrorMessage,
  auditLogViewAuditInvariantErrorMessage,
  auditLogViewClockInvariantErrorMessage,
  auditLogViewClockReadErrorMessage,
  buildServer,
  type BuildServerOptions,
} from './server.js';


export function buildDevTestServer(
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

export const auditReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'audit-log:read',
} as const;

export const SCOPE: AuditScope = {
  tenantId: tenantId('tenant-001'),
  pharmacyId: pharmacyId('pharmacy-001'),
};

export function receptionCreated(id: string, wallClock: string) {
  return {
    actorId: userId('user-001'),
    auditEventType: 'reception.created' as const,
    targetRef: { kind: 'reception', id },
    outcome: 'success' as const,
    wallClock,
  };
}

export function rebuildAuditEvent(
  event: AuditEvent,
  overrides: Partial<CreateAuditEventInput>,
): AuditEvent {
  const { entryHash: _entryHash, ...input } = event;
  return createAuditEvent({ ...input, ...overrides });
}

export async function seedEvents(repository: InMemoryAuditRepository, count: number): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await repository.record(SCOPE, {
      actorId: userId('user-001'),
      auditEventType: 'reception.created',
      targetRef: { kind: 'reception', id: `reception-${String(i).padStart(3, '0')}` },
      outcome: 'success',
      wallClock: `2026-07-11T0${Math.min(i, 9)}:00:00.000Z`,
    });
  }
}

export function createHostileProxy(propertyRead: ReturnType<typeof vi.fn>): object {
  const read = propertyRead as unknown as () => never;
  return new Proxy(
    {},
    {
      get: read,
      has: read,
      getPrototypeOf: read,
    },
  );
}

