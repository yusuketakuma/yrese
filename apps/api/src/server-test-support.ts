import { randomBytes } from 'node:crypto';
import { vi } from 'vitest';

import {
  createAuditEvent,
  type AuditEvent,
  type CreateAuditEventInput,
} from '@yrese/audit';
import { patientId, receptionId } from '@yrese/shared-kernel';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient/patient-search-cursor.js';
import { type ReceptionCreateInput } from './reception/reception-repository.js';
import { buildServer, type BuildServerOptions } from './server.js';

export function receptionProvenance(
  input: ReceptionCreateInput,
  receptionIdentity: string,
  patientIdentity: string = input.patient.patientId,
) {
  return {
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    idempotencyKey: input.idempotencyKey,
    receptionId: receptionId(receptionIdentity),
    patientId: patientId(patientIdentity),
  };
}

export function rebuildAuditEvent(
  event: AuditEvent,
  overrides: Partial<CreateAuditEventInput>,
): AuditEvent {
  const { entryHash: _entryHash, ...input } = event;
  return createAuditEvent({ ...input, ...overrides });
}

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

export function buildDefaultTestServer(options: BuildServerOptions = {}) {
  return buildServer({
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    ...options,
  });
}

// WP-7204: queue entry の資格表示(API-006 0.3.2)。未確認受付の既定値。
export const unverifiedEligibility = {
  state: 'UNVERIFIED' as const,
  snapshotId: null,
  allowsProvisionalCalculation: false,
  allowsFinalCalculation: false,
};

export const tenantOnePatientReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'patient:read',
} as const;

export const tenantTwoPatientReadHeaders = {
  'x-dev-tenant': 'tenant-002',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-002',
  'x-dev-scopes': 'patient:read',
} as const;

export const otherPharmacyPatientReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-002',
  'x-dev-actor': 'user-003',
  'x-dev-scopes': 'patient:read',
} as const;

export const devUiPatientReadHeaders = {
  'x-dev-tenant': 't-dev',
  'x-dev-pharmacy': 'ph-dev',
  'x-dev-actor': 'u-dev',
  'x-dev-scopes': 'patient:read',
} as const;

export const tenantOneTenantReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'tenant:read',
} as const;

export const tenantOneReceptionReadHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'reception:read,patient:read',
} as const;

export const tenantOneReceptionWriteHeaders = {
  'x-dev-tenant': 'tenant-001',
  'x-dev-pharmacy': 'pharmacy-001',
  'x-dev-actor': 'user-001',
  'x-dev-scopes': 'reception:write,patient:read',
} as const;

export const malformedDevIdHeaderCases = [
  ['x-dev-tenant', '   ', 'blank tenant id'],
  ['x-dev-pharmacy', 'pharmacy-001\t', 'control-character pharmacy id'],
  ['x-dev-actor', 'user-001\t', 'control-character actor id'],
  // 複合キーの区切り文字を含む ID。`TENANT#{t}#PHARMACY#{p}` 形式では
  // t='tenant-001#PHARMACY#tenant-002', p='x' と t='tenant-001', p='tenant-002#PHARMACY#x'
  // が同一キー文字列へ衝突する。prefix でスコープを与える認可はこの曖昧性の下で
  // テナント境界を保証できないため、ingress で fail-closed に拒否されなければならない。
  ['x-dev-tenant', ['tenant-001', 'PHARMACY', 'tenant-002'].join('#'), 'key-delimiter tenant id'],
  ['x-dev-pharmacy', 'pharmacy#001', 'key-delimiter pharmacy id'],
  ['x-dev-actor', 'user#001', 'key-delimiter actor id'],
] as const;

export const sensitiveRouteCases = [
  ['GET', '/patients/search?q=synthetic', 'patient search'],
  ['GET', '/patients/patient-syn-001', 'patient get'],
  ['GET', '/reception/queue?date=2026-07-10', 'reception queue'],
  ['POST', '/reception', 'reception create'],
  ['GET', '/audit/events', 'audit events'],
] as const;

