import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import type { PatientSearchResult } from '@yrese/contracts';
import { patientId, pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import {
  receptionCommandAggregateType,
  receptionCommandAuditEventType,
  type ReceptionCreateCommandInput,
} from '../reception-command.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import {
  PostgresReceptionCreateCommand,
  type PostgresReceptionCommandFaultInjection,
} from './reception-command.js';
import {
  databaseReceptionRowInvariantErrorMessage,
  databaseReceptionRowSetInvariantErrorMessage,
  databaseReceptionTimestampInvariantErrorMessage,
  PostgresReceptionRepository,
} from './reception-repository.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/**
 * WP-4050 受入(Postgres 原子コマンド境界):
 * 受付・監査・outbox は単一トランザクションで確定する。注入した監査/outbox
 * 失敗は全効果を巻き戻し(counts 0/0/0)、再送・再起動・並行再送は 1/1/1 へ
 * 収束する。境界導入前の受付は legacy_orphan として明示分類される。
 */

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: tenantId('tenant-cmd-int-001'),
  pharmacyId: pharmacyId('pharmacy-cmd-int-001'),
};

const commandPatient = {
  patientId: patientId('patient-cmd-int-001'),
  name: '合成コマンド患者',
  kana: 'ゴウセイコマンドカンジャ',
  birthDate: '1980-01-01',
  sex: 'female',
  patientNumber: 'CMD-INT-001',
  eligibilityStatus: 'VERIFIED',
} as const satisfies PatientSearchResult;

const otherPatient = {
  ...commandPatient,
  patientId: patientId('patient-cmd-int-002'),
  patientNumber: 'CMD-INT-002',
} as const satisfies PatientSearchResult;

const actorId = userId('user-cmd-int-001');
const acceptedAtIso = '2026-07-30T00:30:00.000Z';
const auditWallClockIso = '2026-07-30T00:30:01.000Z';

function createTestSchemaName(): string {
  return `yrese_reception_command_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
  options: { readonly poolMax?: number } = {},
): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }
  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: options.poolMax ?? 1,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-07-30T00:00:00.000Z'),
    });
    await run(pool);
  } finally {
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await cleanupPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupPool.end();
    }
  }
}

async function seedPatient(pool: Pool, patient: PatientSearchResult): Promise<void> {
  await pool.query(
    `INSERT INTO patients (
       tenant_id, pharmacy_id, patient_id, name, kana,
       birth_date, sex, patient_number, eligibility_status, eligibility_checked_at
     ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, NULL)`,
    [
      scope.tenantId,
      scope.pharmacyId,
      patient.patientId,
      patient.name,
      patient.kana,
      patient.birthDate,
      patient.sex,
      patient.patientNumber,
      patient.eligibilityStatus,
    ],
  );
}

function commandInput(
  overrides: Partial<ReceptionCreateCommandInput> = {},
): ReceptionCreateCommandInput {
  return {
    ...scope,
    patient: commandPatient,
    idempotencyKey: 'cmd-int-key-001',
    acceptedAt: new Date(acceptedAtIso),
    actorId,
    auditWallClock: () => auditWallClockIso,
    ...overrides,
  };
}

async function counts(pool: Pool): Promise<{
  receptions: number;
  auditEvents: number;
  outboxIntents: number;
}> {
  const receptions = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM reception_entries WHERE tenant_id = $1 AND pharmacy_id = $2',
    [scope.tenantId, scope.pharmacyId],
  );
  const auditEvents = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM audit_events WHERE tenant_id = $1 AND pharmacy_id = $2',
    [scope.tenantId, scope.pharmacyId],
  );
  const outboxIntents = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM outbox_events WHERE tenant_id = $1 AND pharmacy_id = $2',
    [scope.tenantId, scope.pharmacyId],
  );
  return {
    receptions: Number(receptions.rows[0]?.count),
    auditEvents: Number(auditEvents.rows[0]?.count),
    outboxIntents: Number(outboxIntents.rows[0]?.count),
  };
}

function buildCommand(
  pool: Pool,
  faultInjection?: PostgresReceptionCommandFaultInjection,
): PostgresReceptionCreateCommand {
  return new PostgresReceptionCreateCommand(pool, faultInjection);
}

const legacyOrphanSql = `SELECT r.reception_id, r.accepted_at
         FROM reception_entries r
        WHERE r.tenant_id = $1 AND r.pharmacy_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM outbox_events o
              JOIN audit_events a
                ON a.tenant_id = o.tenant_id AND a.pharmacy_id = o.pharmacy_id
               AND a.event_id = o.audit_event_id
               AND a.event_body->>'auditEventType' = o.event_type
               AND a.event_body->'targetRef'->>'kind' = o.aggregate_type
               AND a.event_body->'targetRef'->>'id' = o.aggregate_id
             WHERE o.tenant_id = r.tenant_id AND o.pharmacy_id = r.pharmacy_id
               AND o.aggregate_type = $3 AND o.aggregate_id = r.reception_id
               AND o.event_type = $4
          )
        ORDER BY r.accepted_at, r.reception_id`;

function buildLegacyOrphanReader(queryResult: unknown): {
  readonly command: PostgresReceptionCreateCommand;
  readonly query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(async () => queryResult);
  return {
    command: buildCommand({ query } as unknown as Pool),
    query,
  };
}

async function expectLegacyOrphanReadToReject(
  queryResult: unknown,
  errorMessage: string,
): Promise<void> {
  const { command } = buildLegacyOrphanReader(queryResult);
  await expect(command.listLegacyOrphans(scope)).rejects.toEqual(new Error(errorMessage));
}

describe('PostgresReceptionCreateCommand legacy-orphan row projection', () => {
  it('returns an empty snapshot and executes the scoped read exactly once', async () => {
    const { command, query } = buildLegacyOrphanReader({ rows: [] });

    await expect(command.listLegacyOrphans(scope)).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(legacyOrphanSql, [
      scope.tenantId,
      scope.pharmacyId,
      receptionCommandAggregateType,
      receptionCommandAuditEventType,
    ]);
    expect(String(query.mock.calls[0]?.[0])).toMatch(/^SELECT\b/u);
  });

  it('preserves row order without invoking a Date instance override', async () => {
    const firstAcceptedAt = new Date('2026-07-30T00:31:00.000Z');
    const secondAcceptedAt = new Date('2026-07-30T00:32:00.000Z');
    const override = vi.fn(() => {
      throw new Error('raw accepted_at override sentinel');
    });
    Object.defineProperty(firstAcceptedAt, 'toISOString', { value: override });
    const { command, query } = buildLegacyOrphanReader({
      rows: [
        { reception_id: 'reception-orphan-001', accepted_at: firstAcceptedAt },
        { reception_id: 'reception-orphan-002', accepted_at: secondAcceptedAt },
      ],
    });

    await expect(command.listLegacyOrphans(scope)).resolves.toEqual([
      { receptionId: 'reception-orphan-001', acceptedAt: '2026-07-30T00:31:00.000Z' },
      { receptionId: 'reception-orphan-002', acceptedAt: '2026-07-30T00:32:00.000Z' },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(override).not.toHaveBeenCalled();
  });

  it('rejects hostile query result and rows containers without invoking semantic traps', async () => {
    let accessorCalls = 0;
    const rowsAccessor = {};
    Object.defineProperty(rowsAccessor, 'rows', {
      get() {
        accessorCalls += 1;
        throw new Error('raw rows accessor sentinel');
      },
    });

    let semanticProxyCalls = 0;
    const queryResultProxy = new Proxy(
      { rows: [] },
      {
        get(target, property, receiver) {
          if (property === 'then') return undefined;
          semanticProxyCalls += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const rowsProxy = new Proxy([], {
      get(target, property, receiver) {
        semanticProxyCalls += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const revokedRows = Proxy.revocable([], {});
    revokedRows.revoke();
    const indexedAccessor: unknown[] = [];
    Object.defineProperty(indexedAccessor, '0', {
      get() {
        accessorCalls += 1;
        throw new Error('raw row index accessor sentinel');
      },
    });
    Object.defineProperty(indexedAccessor, 'length', { value: 1 });

    for (const queryResult of [
      rowsAccessor,
      queryResultProxy,
      { rows: rowsProxy },
      { rows: revokedRows.proxy },
      { rows: indexedAccessor },
    ]) {
      await expectLegacyOrphanReadToReject(queryResult, databaseReceptionRowSetInvariantErrorMessage);
    }
    expect(accessorCalls).toBe(0);
    expect(semanticProxyCalls).toBe(0);
  });

  it('rejects non-own reception identifiers without invoking coercion or accessors', async () => {
    const validAcceptedAt = new Date('2026-07-30T00:31:00.000Z');
    let trapCalls = 0;
    const inherited = Object.assign(Object.create({ reception_id: 'inherited-id' }), {
      accepted_at: validAcceptedAt,
    });
    const accessor = { accepted_at: validAcceptedAt };
    Object.defineProperty(accessor, 'reception_id', {
      get() {
        trapCalls += 1;
        throw new Error('raw reception_id accessor sentinel');
      },
    });
    const coercible = {
      reception_id: {
        toString() {
          trapCalls += 1;
          return 'coerced-id';
        },
      },
      accepted_at: validAcceptedAt,
    };

    for (const row of [
      { accepted_at: validAcceptedAt },
      inherited,
      accessor,
      coercible,
    ]) {
      await expectLegacyOrphanReadToReject({ rows: [row] }, databaseReceptionRowInvariantErrorMessage);
    }
    expect(trapCalls).toBe(0);
  });

  it('rejects non-own or invalid accepted instants without invoking coercion or accessors', async () => {
    let trapCalls = 0;
    const inherited = Object.assign(Object.create({ accepted_at: '2026-07-30T00:31:00.000Z' }), {
      reception_id: 'reception-orphan-inherited',
    });
    const accessor = { reception_id: 'reception-orphan-accessor' };
    Object.defineProperty(accessor, 'accepted_at', {
      get() {
        trapCalls += 1;
        throw new Error('raw accepted_at accessor sentinel');
      },
    });
    const coercible = {
      reception_id: 'reception-orphan-coercible',
      accepted_at: {
        toISOString() {
          trapCalls += 1;
          throw new Error('raw accepted_at coercion sentinel');
        },
      },
    };

    for (const row of [
      { reception_id: 'reception-orphan-missing' },
      inherited,
      accessor,
      coercible,
      { reception_id: 'reception-orphan-invalid', accepted_at: new Date(Number.NaN) },
    ]) {
      await expectLegacyOrphanReadToReject({ rows: [row] }, databaseReceptionTimestampInvariantErrorMessage);
    }
    expect(trapCalls).toBe(0);
  });
});

describePostgres('PostgresReceptionCreateCommand (WP-4050 atomic boundary)', () => {
  it('commits reception, reception.created audit event, and outbox intent atomically', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const command = buildCommand(pool);

      const result = await command.execute(commandInput());

      expect(result.kind).toBe('created');
      if (result.kind !== 'created') {
        throw new Error('unreachable');
      }
      expect(result.auditEvent.auditEventType).toBe(receptionCommandAuditEventType);
      expect(result.auditEvent.targetRef).toEqual({
        kind: receptionCommandAggregateType,
        id: result.provenance.receptionId,
      });
      expect(result.auditEvent.wallClock).toBe(auditWallClockIso);

      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 1,
        outboxIntents: 1,
      });
      const outboxRow = await pool.query<{
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        audit_event_id: string;
        payload: { receptionId: string; patientId: string };
        delivered_at: Date | null;
      }>(
        'SELECT event_type, aggregate_type, aggregate_id, audit_event_id, payload, delivered_at FROM outbox_events WHERE tenant_id = $1 AND pharmacy_id = $2',
        [scope.tenantId, scope.pharmacyId],
      );
      expect(outboxRow.rows[0]).toMatchObject({
        event_type: receptionCommandAuditEventType,
        aggregate_type: receptionCommandAggregateType,
        aggregate_id: result.provenance.receptionId,
        audit_event_id: result.auditEvent.eventId,
        payload: {
          receptionId: result.provenance.receptionId,
          patientId: commandPatient.patientId,
        },
        delivered_at: null,
      });
    });
  });

  it.each([
    ['audit', { beforeAuditAppend: () => { throw new Error('injected audit failure'); } }],
    ['outbox', { beforeOutboxAppend: () => { throw new Error('injected outbox failure'); } }],
  ] as const)(
    'rolls back every durable effect when the %s append fails',
    async (_label, faultInjection) => {
      await withMigratedSchema(async (pool) => {
        await seedPatient(pool, commandPatient);
        const command = buildCommand(pool, faultInjection);

        await expect(command.execute(commandInput())).rejects.toThrow();

        await expect(counts(pool)).resolves.toEqual({
          receptions: 0,
          auditEvents: 0,
          outboxIntents: 0,
        });
      });
    },
  );

  it('converges a same-key retry (including across command instances) to existing_complete with 1/1/1', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const first = await buildCommand(pool).execute(commandInput());
      expect(first.kind).toBe('created');

      // 別インスタンス = プロセス再起動後の再送を模す。
      const second = await buildCommand(pool).execute(commandInput());

      expect(second.kind).toBe('existing_complete');
      if (second.kind !== 'existing_complete' || first.kind !== 'created') {
        throw new Error('unreachable');
      }
      expect(second.provenance.receptionId).toBe(first.provenance.receptionId);
      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 1,
        outboxIntents: 1,
      });
    });
  });

  it('converges after an injected failure: the same key then succeeds as created', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      let failNext = true;
      const command = buildCommand(pool, {
        beforeAuditAppend: () => {
          if (failNext) {
            failNext = false;
            throw new Error('injected transient audit failure');
          }
        },
      });

      await expect(command.execute(commandInput())).rejects.toThrow(
        'injected transient audit failure',
      );
      const retried = await command.execute(commandInput());

      expect(retried.kind).toBe('created');
      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 1,
        outboxIntents: 1,
      });
    });
  });

  it('keeps concurrent same-key retries at exactly one durable effect each', async () => {
    await withMigratedSchema(
      async (pool) => {
        await seedPatient(pool, commandPatient);
        const command = buildCommand(pool);

        const results = await Promise.all([
          command.execute(commandInput()),
          command.execute(commandInput()),
        ]);

        const kinds = results.map((result) => result.kind).sort();
        expect(kinds).toEqual(['created', 'existing_complete']);
        await expect(counts(pool)).resolves.toEqual({
          receptions: 1,
          auditEvents: 1,
          outboxIntents: 1,
        });
      },
      { poolMax: 2 },
    );
  });

  it('returns idempotency_conflict for the same key with a different patient, with no writes', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      await seedPatient(pool, otherPatient);
      const command = buildCommand(pool);
      await command.execute(commandInput());

      const conflict = await command.execute(commandInput({ patient: otherPatient }));

      expect(conflict.kind).toBe('idempotency_conflict');
      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 1,
        outboxIntents: 1,
      });
    });
  });

  it('classifies a pre-boundary reception as legacy_orphan without inventing audit evidence', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      // 境界導入前の受付を模す: リポジトリ直接 create(監査・outbox なし)。
      const legacy = await new PostgresReceptionRepository(pool).create({
        ...scope,
        patient: commandPatient,
        idempotencyKey: 'cmd-int-key-legacy',
        acceptedAt: new Date(acceptedAtIso),
      });
      expect(legacy.kind).toBe('created');
      if (legacy.kind !== 'created') {
        throw new Error('unreachable');
      }

      const result = await buildCommand(pool).execute(
        commandInput({ idempotencyKey: 'cmd-int-key-legacy' }),
      );

      expect(result.kind).toBe('legacy_orphan');
      if (result.kind !== 'legacy_orphan') {
        throw new Error('unreachable');
      }
      expect(result.missingOutboxIntent).toBe(true);
      expect(result.provenance.receptionId).toBe(legacy.provenance.receptionId);
      // 元の actor / 時刻を捏造した修復をしない: 監査・outbox は増えない。
      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 0,
        outboxIntents: 0,
      });
    });
  });

  it('rejects an outbox intent whose audit event or reception does not exist (WP-4050 HIGH-3 foreign keys)', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const legacy = await new PostgresReceptionRepository(pool).create({
        ...scope,
        patient: commandPatient,
        idempotencyKey: 'cmd-int-key-dangling',
        acceptedAt: new Date(acceptedAtIso),
      });
      if (legacy.kind !== 'created') {
        throw new Error('unreachable');
      }
      const insertIntent = (aggregateId: string, auditEventId: string) =>
        pool.query(
          `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type,
             aggregate_type, aggregate_id, audit_event_id, payload, created_at)
           VALUES ($1, $2, 'dangling-outbox-1', 'reception.created', 'reception', $3, $4,
                   '{}'::jsonb, now())`,
          [scope.tenantId, scope.pharmacyId, aggregateId, auditEventId],
        );

      // 監査行なし → FK 違反。受付なし → FK 違反。どちらも dangling intent を作れない。
      await expect(insertIntent(legacy.provenance.receptionId, 'no-such-audit-event')).rejects.toThrow(
        /outbox_events_audit_event_fk/,
      );
      await expect(insertIntent('no-such-reception', 'no-such-audit-event')).rejects.toThrow(
        /outbox_events_(reception|audit_event)_fk/,
      );
      // 境界導入前の受付は intent も監査も無いまま legacy_orphan として分類される。
      const result = await buildCommand(pool).execute(
        commandInput({ idempotencyKey: 'cmd-int-key-dangling' }),
      );
      expect(result.kind).toBe('legacy_orphan');
      await expect(counts(pool)).resolves.toEqual({
        receptions: 1,
        auditEvents: 0,
        outboxIntents: 0,
      });
    });
  });

  it('does not accept an outbox intent that borrows another reception\'s audit event (checker MEDIUM-1)', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const command = buildCommand(pool);
      const a = await command.execute(commandInput({ idempotencyKey: 'cmd-int-key-a' }));
      if (a.kind !== 'created') {
        throw new Error('unreachable');
      }
      const auditEventId = (
        await pool.query<{ audit_event_id: string }>(
          'SELECT audit_event_id FROM outbox_events WHERE aggregate_id = $1',
          [a.provenance.receptionId],
        )
      ).rows[0]?.audit_event_id;
      const b = await new PostgresReceptionRepository(pool).create({
        ...scope,
        patient: commandPatient,
        idempotencyKey: 'cmd-int-key-b',
        acceptedAt: new Date(acceptedAtIso),
      });
      if (b.kind !== 'created') {
        throw new Error('unreachable');
      }
      await pool.query(
        `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type,
           aggregate_type, aggregate_id, audit_event_id, payload, created_at)
         VALUES ($1, $2, 'borrowed-outbox-1', 'reception.created', 'reception', $3, $4,
                 '{}'::jsonb, now())`,
        [scope.tenantId, scope.pharmacyId, b.provenance.receptionId, auditEventId],
      );

      await expect(command.classifyExisting(b.provenance)).resolves.toBe('legacy_orphan');
      await expect(command.classifyExisting(a.provenance)).resolves.toBe('existing_complete');
    });
  });

  it('lists legacy orphans for operator reconciliation without repairing them (checker MEDIUM-2)', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const command = buildCommand(pool);
      const complete = await command.execute(commandInput({ idempotencyKey: 'cmd-int-key-complete' }));
      const legacy = await new PostgresReceptionRepository(pool).create({
        ...scope,
        patient: commandPatient,
        idempotencyKey: 'cmd-int-key-orphan',
        acceptedAt: new Date('2026-07-30T00:31:00.000Z'),
      });
      if (complete.kind !== 'created' || legacy.kind !== 'created') {
        throw new Error('unreachable');
      }

      await expect(command.listLegacyOrphans(scope)).resolves.toEqual([
        { receptionId: legacy.provenance.receptionId, acceptedAt: '2026-07-30T00:31:00.000Z' },
      ]);
      // 別 tenant からは見えない。
      await expect(
        command.listLegacyOrphans({ tenantId: 'tenant-other', pharmacyId: scope.pharmacyId }),
      ).resolves.toEqual([]);
      await expect(counts(pool)).resolves.toEqual({ receptions: 2, auditEvents: 1, outboxIntents: 1 });
    });
  });

  it('enforces the outbox mutation discipline: no delete, only the single pending -> delivered transition', async () => {
    await withMigratedSchema(async (pool) => {
      await seedPatient(pool, commandPatient);
      const result = await buildCommand(pool).execute(commandInput());
      if (result.kind !== 'created') {
        throw new Error('unreachable');
      }

      await expect(
        pool.query('DELETE FROM outbox_events WHERE tenant_id = $1', [scope.tenantId]),
      ).rejects.toThrow(/must not be deleted/);
      await expect(
        pool.query(
          `UPDATE outbox_events SET payload = '{}'::jsonb WHERE tenant_id = $1`,
          [scope.tenantId],
        ),
      ).rejects.toThrow(/single pending -> delivered transition/);

      // 許可される唯一の遷移: delivered_at NULL → 非 NULL(他列は不変)。
      await pool.query(
        `UPDATE outbox_events SET delivered_at = '2026-07-30T01:00:00.000Z'::timestamptz WHERE tenant_id = $1`,
        [scope.tenantId],
      );
      // 再遷移(値の変更)は拒否される。
      await expect(
        pool.query(
          `UPDATE outbox_events SET delivered_at = '2026-07-30T02:00:00.000Z'::timestamptz WHERE tenant_id = $1`,
          [scope.tenantId],
        ),
      ).rejects.toThrow(/single pending -> delivered transition/);
    });
  });
});
