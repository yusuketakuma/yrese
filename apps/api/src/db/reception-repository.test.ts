import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  InMemoryReceptionRepository,
  inMemoryReceptionIdempotencyInvariantErrorMessage,
} from '../reception-repository.js';
import {
  PostgresReceptionRepository,
  databaseReceptionProvenanceInvariantErrorMessage,
  databaseReceptionTimestampInvariantErrorMessage,
} from './reception-repository.js';

const patient = {
  patientId: patientId('patient-reception-client-test'),
  name: '合成受付患者',
  kana: 'ゴウセイウケツケカンジャ',
  birthDate: '1980-01-01',
  sex: 'unknown' as const,
  patientNumber: 'SYN-RECEPTION-001',
  eligibilityStatus: 'NOT_CHECKED' as const,
};

const input = {
  tenantId: tenantId('tenant-reception-client-test'),
  pharmacyId: pharmacyId('pharmacy-reception-client-test'),
  patient,
  idempotencyKey: 'synthetic-reception-client-test-key',
  acceptedAt: new Date('2026-07-13T01:00:00.000Z'),
};

const storedRow = {
  stored_tenant_id: input.tenantId,
  stored_pharmacy_id: input.pharmacyId,
  stored_idempotency_key: input.idempotencyKey,
  stored_patient_id: patient.patientId,
  reception_id: 'reception-stored-001',
  accepted_at: '2026-07-13T00:30:00.000Z',
  reception_status: 'WAITING',
  patient_id: patient.patientId,
  name: patient.name,
  kana: patient.kana,
  birth_date: patient.birthDate,
  sex: patient.sex,
  patient_number: patient.patientNumber,
  eligibility_status: patient.eligibilityStatus,
  eligibility_checked_at: null,
};

type Scenario = 'created' | 'existing' | 'conflict' | 'operation_failure';

function createRepository(options: {
  readonly scenario: Scenario;
  readonly operationError?: Error;
  readonly rollbackError?: Error;
  readonly provenanceOverride?: Readonly<Record<string, unknown>>;
}) {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT INTO reception_entries')) {
      if (options.operationError !== undefined) throw options.operationError;
      return {
        rows:
          options.scenario === 'created'
            ? [{ ...storedRow, ...options.provenanceOverride }]
            : [],
      };
    }
    if (normalized.startsWith('SELECT')) {
      return {
        rows: [
          {
            ...storedRow,
            stored_patient_id:
              options.scenario === 'conflict' ? 'patient-different' : patient.patientId,
            ...options.provenanceOverride,
          },
        ],
      };
    }
    if (normalized === 'ROLLBACK' && options.rollbackError !== undefined) {
      throw options.rollbackError;
    }
    return { rows: [] };
  });
  const client = {
    query: query as unknown as PoolClient['query'],
    release,
  } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { connect } as unknown as Pool;
  return { repository: new PostgresReceptionRepository(pool), connect, query, release };
}

async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected repository operation to reject');
}

function queryLabels(query: ReturnType<typeof vi.fn>): string[] {
  return query.mock.calls.map(([sql]) => {
    const normalized = String(sql).trim();
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('SELECT')) return 'SELECT';
    return normalized;
  });
}

describe('PostgresReceptionRepository client lifecycle', () => {
  it('commits a created reception and reuses the client', async () => {
    const { repository, query, release } = createRepository({ scenario: 'created' });

    const result = await repository.create(input);

    expect(result.kind).toBe('created');
    expect(result).toMatchObject({
      provenance: {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        idempotencyKey: input.idempotencyKey,
        receptionId: storedRow.reception_id,
        patientId: patient.patientId,
      },
    });
    const insertSql = String(
      query.mock.calls.find(([sql]) => String(sql).includes('INSERT'))?.[0],
    );
    expect(insertSql).toContain('tenant_id AS stored_tenant_id');
    expect(insertSql).toContain('pharmacy_id AS stored_pharmacy_id');
    expect(insertSql).toContain('idempotency_key AS stored_idempotency_key');
    expect(insertSql).toContain('patient_id AS stored_patient_id');
    expect(insertSql).not.toMatch(/\$[1247]\s*(?:::text)?\s+AS stored_/);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('commits and returns the stored reception for a same-patient replay', async () => {
    const { repository, query, release } = createRepository({ scenario: 'existing' });

    const result = await repository.create(input);

    expect(result).toMatchObject({
      kind: 'existing',
      entry: { receptionId: 'reception-stored-001', acceptedAt: storedRow.accepted_at },
      provenance: {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        idempotencyKey: input.idempotencyKey,
        receptionId: storedRow.reception_id,
        patientId: patient.patientId,
      },
    });
    const selectSql = String(
      query.mock.calls.find(([sql]) => String(sql).trim().startsWith('SELECT'))?.[0],
    );
    expect(selectSql).toContain('r.tenant_id AS stored_tenant_id');
    expect(selectSql).toContain('r.pharmacy_id AS stored_pharmacy_id');
    expect(selectSql).toContain('r.idempotency_key AS stored_idempotency_key');
    expect(selectSql).toContain('r.patient_id AS stored_patient_id');
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('commits a different-patient idempotency conflict without returning an entry', async () => {
    const { repository, query, release } = createRepository({ scenario: 'conflict' });

    const result = await repository.create(input);

    expect(result).toEqual({
      kind: 'idempotency_conflict',
      provenance: {
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        idempotencyKey: input.idempotencyKey,
        receptionId: storedRow.reception_id,
        patientId: 'patient-different',
      },
    });
    expect('entry' in result).toBe(false);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('snapshots the create instant before connection and derives one matching JST business date', async () => {
    const capturedIso = '2026-07-09T14:59:59.999Z';
    const acceptedAt = new Date(capturedIso);
    let ownMethodReads = 0;
    Object.defineProperty(acceptedAt, 'toISOString', {
      get() {
        ownMethodReads += 1;
        throw new Error('raw create timestamp method secret 4214');
      },
    });
    const operationQuery = vi.fn(async (sql: string, _values?: readonly unknown[]) => ({
      rows: sql.trim().startsWith('INSERT') ? [{ ...storedRow, accepted_at: capturedIso }] : [],
    }));
    const operationRelease = vi.fn();
    const operationClient = {
      query: operationQuery as unknown as PoolClient['query'],
      release: operationRelease,
    } as unknown as PoolClient;
    let resolveConnect: ((client: PoolClient) => void) | undefined;
    const connect = vi.fn(
      () =>
        new Promise<PoolClient>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const repository = new PostgresReceptionRepository({ connect } as unknown as Pool);

    const resultPromise = repository.create({ ...input, acceptedAt });
    acceptedAt.setTime(new Date('2026-07-09T15:00:00.000Z').getTime());
    resolveConnect?.(operationClient);
    const result = await resultPromise;

    expect(result.kind).toBe('created');
    expect(ownMethodReads).toBe(0);
    expect(connect).toHaveBeenCalledOnce();
    const insertCall = operationQuery.mock.calls.find(([sql]) =>
      String(sql).trim().startsWith('INSERT'),
    );
    expect(insertCall?.[1]?.[4]).toBe(capturedIso);
    expect(insertCall?.[1]?.[5]).toBe('2026-07-09');
    expect(operationRelease.mock.calls).toEqual([[]]);
  });

  it('rejects invalid create timestamp authorities before acquiring a DB client', async () => {
    let fakeCoercions = 0;
    let proxyTraps = 0;
    const fakeInstant = {
      toISOString() {
        fakeCoercions += 1;
        return input.acceptedAt.toISOString();
      },
      [Symbol.toPrimitive]() {
        fakeCoercions += 1;
        return input.acceptedAt.toISOString();
      },
    };
    const hostileDateProxy = new Proxy(input.acceptedAt, {
      get() {
        proxyTraps += 1;
        throw new Error('raw create timestamp Proxy secret 4214');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('raw create timestamp prototype secret 4214');
      },
    });
    const revoked = Proxy.revocable(input.acceptedAt, {});
    revoked.revoke();
    const invalidValues: readonly unknown[] = [
      undefined,
      null,
      input.acceptedAt.toISOString(),
      fakeInstant,
      Promise.resolve(input.acceptedAt),
      new Date(Number.NaN),
      Object.create(Date.prototype),
      hostileDateProxy,
      revoked.proxy,
    ];

    for (const invalidValue of invalidValues) {
      const { repository, connect, query, release } = createRepository({ scenario: 'created' });

      await expect(
        repository.create({ ...input, acceptedAt: invalidValue as Date }),
      ).rejects.toThrow(databaseReceptionTimestampInvariantErrorMessage);

      expect(connect).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(release).not.toHaveBeenCalled();
    }

    expect(fakeCoercions).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('normalizes genuine Date and primitive string DB timestamps without own method dispatch', async () => {
    const dateIso = '2026-07-13T00:30:00.000Z';
    const storedDate = new Date(dateIso);
    let ownMethodReads = 0;
    Object.defineProperty(storedDate, 'toISOString', {
      get() {
        ownMethodReads += 1;
        throw new Error('raw stored timestamp method secret 4214');
      },
    });
    const query = vi.fn(async () => ({
      rows: [
        { ...storedRow, reception_id: 'reception-date-4214', accepted_at: storedDate },
        {
          ...storedRow,
          reception_id: 'reception-string-4214',
          accepted_at: '2026-07-13T09:30:00+09:00',
        },
      ],
    }));
    const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

    const result = await repository.list({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      date: '2026-07-13',
    });

    expect(result.map((entry) => entry.acceptedAt)).toEqual([dateIso, dateIso]);
    expect(ownMethodReads).toBe(0);
    expect(query).toHaveBeenCalledOnce();
  });

  it('rejects a mixed list when any DB timestamp authority is invalid', async () => {
    let fakeCoercions = 0;
    let proxyTraps = 0;
    const fakeInstant = {
      [Symbol.toPrimitive]() {
        fakeCoercions += 1;
        return storedRow.accepted_at;
      },
    };
    const hostileDateProxy = new Proxy(new Date(storedRow.accepted_at), {
      get() {
        proxyTraps += 1;
        throw new Error('raw stored timestamp Proxy secret 4214');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('raw stored timestamp prototype secret 4214');
      },
    });
    const revoked = Proxy.revocable(new Date(storedRow.accepted_at), {});
    revoked.revoke();
    const invalidValues: readonly unknown[] = [
      undefined,
      null,
      0,
      false,
      fakeInstant,
      new String(storedRow.accepted_at),
      Promise.resolve(storedRow.accepted_at),
      'not-an-instant',
      new Date(Number.NaN),
      Object.create(Date.prototype),
      hostileDateProxy,
      revoked.proxy,
    ];

    for (const invalidValue of invalidValues) {
      const query = vi.fn(async () => ({
        rows: [storedRow, { ...storedRow, reception_id: 'reception-invalid-4214', accepted_at: invalidValue }],
      }));
      const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

      await expect(
        repository.list({
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          date: '2026-07-13',
        }),
      ).rejects.toThrow(databaseReceptionTimestampInvariantErrorMessage);
      expect(query).toHaveBeenCalledOnce();
    }

    expect(fakeCoercions).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it.each(['created', 'existing'] as const)(
    'rolls back a %s result with an invalid DB timestamp before commit',
    async (scenario) => {
      const rawTimestamp = { toISOString: () => 'raw timestamp must not run' };
      const { repository, query, release } = createRepository({
        scenario,
        provenanceOverride: { accepted_at: rawTimestamp },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionTimestampInvariantErrorMessage,
      );

      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'existing' ? ['SELECT'] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('does not inspect a DB timestamp for a different-patient idempotency conflict', async () => {
    let timestampTraps = 0;
    const hostileTimestamp = new Proxy(
      {},
      {
        get() {
          timestampTraps += 1;
          throw new Error('raw conflict timestamp secret 4214');
        },
      },
    );
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      provenanceOverride: { accepted_at: hostileTimestamp },
    });

    const result = await repository.create(input);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(timestampTraps).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it.each([
    ['created', 'stored_tenant_id'],
    ['created', 'stored_pharmacy_id'],
    ['created', 'stored_idempotency_key'],
    ['created', 'reception_id'],
    ['created', 'stored_patient_id'],
    ['existing', 'stored_tenant_id'],
    ['existing', 'stored_pharmacy_id'],
    ['existing', 'stored_idempotency_key'],
    ['existing', 'reception_id'],
    ['existing', 'stored_patient_id'],
    ['conflict', 'stored_tenant_id'],
    ['conflict', 'stored_pharmacy_id'],
    ['conflict', 'stored_idempotency_key'],
    ['conflict', 'reception_id'],
    ['conflict', 'stored_patient_id'],
  ] as const)(
    'rolls back a %s result with missing stored provenance column %s',
    async (scenario, missingColumn) => {
      const { repository, query, release } = createRepository({
        scenario,
        provenanceOverride: { [missingColumn]: undefined },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionProvenanceInvariantErrorMessage,
      );
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'created' ? [] : ['SELECT']),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('reuses the client after successful rollback and preserves the original error', async () => {
    const operationError = new Error('synthetic reception insert failure');
    const { repository, query, release } = createRepository({
      scenario: 'operation_failure',
      operationError,
    });

    expect(await captureRejection(() => repository.create(input))).toBe(operationError);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after rollback fails without masking the original error', async () => {
    const operationError = new Error('synthetic reception insert failure');
    const rollbackError = new Error('synthetic reception rollback failure');
    const { repository, query, release } = createRepository({
      scenario: 'operation_failure',
      operationError,
      rollbackError,
    });

    expect(await captureRejection(() => repository.create(input))).toBe(operationError);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[true]]);
  });
});

describe('InMemoryReceptionRepository idempotency index integrity', () => {
  it('binds created, existing, and conflict results to one stored reception identity', async () => {
    const repository = new InMemoryReceptionRepository();
    const created = await repository.create(input);
    const existing = await repository.create(input);
    const conflict = await repository.create({
      ...input,
      patient: { ...patient, patientId: patientId('patient-reception-client-conflict') },
    });

    expect(created.kind).toBe('created');
    expect(existing.kind).toBe('existing');
    expect(conflict.kind).toBe('idempotency_conflict');
    if (created.kind !== 'created' || existing.kind !== 'existing') {
      throw new Error('expected created and existing reception results');
    }
    expect(created.provenance).toEqual({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      idempotencyKey: input.idempotencyKey,
      receptionId: created.entry.receptionId,
      patientId: created.entry.patient.patientId,
    });
    expect(existing.provenance).toEqual(created.provenance);
    expect(existing.entry).toEqual(created.entry);
    expect(conflict.provenance).toEqual(created.provenance);
  });

  it('fails closed without creating a duplicate when an index points to a missing record', async () => {
    const repository = new InMemoryReceptionRepository();
    await repository.create(input);
    const internals = repository as unknown as {
      readonly records: unknown[];
      readonly idempotencyRecords: Map<string, unknown>;
    };
    internals.records.splice(0);

    await expect(repository.create(input)).rejects.toThrow(
      inMemoryReceptionIdempotencyInvariantErrorMessage,
    );
    expect(internals.records).toHaveLength(0);
    expect(internals.idempotencyRecords.size).toBe(1);
  });

  it('fails closed without creating a duplicate when a stored record is missing its index', async () => {
    const repository = new InMemoryReceptionRepository();
    await repository.create(input);
    const internals = repository as unknown as {
      readonly records: unknown[];
      readonly idempotencyRecords: Map<string, unknown>;
    };
    const recordCount = internals.records.length;
    internals.idempotencyRecords.clear();

    await expect(repository.create(input)).rejects.toThrow(
      inMemoryReceptionIdempotencyInvariantErrorMessage,
    );
    expect(internals.records).toHaveLength(recordCount);
    expect(internals.idempotencyRecords.size).toBe(0);
  });
});
