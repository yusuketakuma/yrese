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
} from '../patient/patient-search-cursor.js';
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
} from '../server.js';

import {
  buildDevTestServer,
  auditReadHeaders,
  SCOPE,
  receptionCreated,
  rebuildAuditEvent,
  seedEvents,
  createHostileProxy,
} from './audit-log-test-support.js';

describe('InMemoryAuditRepository', () => {
  it('chains entries so verifyAuditHashChain accepts genuine appends', async () => {
    const repository = new InMemoryAuditRepository();
    await seedEvents(repository, 3);
    const events = await repository.list(SCOPE);
    expect(events).toHaveLength(3);
    expect(events[1]?.prevHash).toBe(events[0]?.entryHash);
    expect(events[2]?.prevHash).toBe(events[1]?.entryHash);
  });
});

describe('corrupt persisted audit roots stay fail-visible (WP-4236)', () => {
  // 破損行(JSON null / scalar / array root)は 500 ではなく、構造的
  // hash_format_invalid 破断(CRITICAL 表示)として応答に現れなければならない。
  it.each([
    ['stored JSON null', null],
    ['stored JSON number', 42],
    ['stored JSON string', 'corrupt-row-raw-secret-4236'],
    ['stored JSON array', []],
  ] as const)(
    'surfaces a %s row as a hash_format_invalid break instead of a 500',
    async (_label, corrupt) => {
      const recordBacking = new InMemoryAuditRepository();
      const record = vi.fn<AuditRepository['record']>(async (scope, input) =>
        recordBacking.record(scope, input),
      );
      const server = buildDevTestServer({
        auditRepository: {
          list: vi.fn<AuditRepository['list']>(async () => [corrupt] as never),
          record,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/audit/events',
        headers: auditReadHeaders,
      });
      await server.close();

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = response.json<AuditLogResponse>();
      expect(body.chainVerification).toEqual({
        ok: false,
        checkedCount: 0,
        breakIndex: 0,
        reason: 'hash_format_invalid',
      });
      expect(body.totalCount).toBe(1);
      // 破損 raw は表示投影へ入れず(no-backfill omission)、応答へ echo しない。
      expect(body.entries).toEqual([]);
      expect(response.body).not.toContain('corrupt-row-raw-secret-4236');
      // 閲覧監査は破損 chain でも従来どおり 1 件記録される。
      expect(record).toHaveBeenCalledOnce();
    },
  );

  it('keeps the valid prefix and breaks at the corrupt row', async () => {
    const listBacking = new InMemoryAuditRepository();
    await listBacking.record(SCOPE, receptionCreated('reception-4236', '2026-07-17T00:00:00.000Z'));
    const stored = await listBacking.list(SCOPE);
    const recordBacking = new InMemoryAuditRepository();
    const server = buildDevTestServer({
      auditRepository: {
        list: vi.fn<AuditRepository['list']>(async () => [...stored, null] as never),
        record: vi.fn<AuditRepository['record']>(async (scope, input) =>
          recordBacking.record(scope, input),
        ),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/audit/events',
      headers: auditReadHeaders,
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json<AuditLogResponse>();
    expect(body.chainVerification).toEqual({
      ok: false,
      checkedCount: 1,
      breakIndex: 1,
      reason: 'hash_format_invalid',
    });
    expect(body.totalCount).toBe(2);
    // 破損 chain の表示は raw append window(降順)を維持し、破損行だけを omit する。
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.targetRef.id).toBe('reception-4236');
  });
});

