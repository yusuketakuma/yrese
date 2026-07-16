import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  InMemoryReceptionRepository,
  inMemoryReceptionIdempotencyInvariantErrorMessage,
  inMemoryReceptionTimestampInvariantErrorMessage,
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
  readonly rowTransform?: (row: Record<string, unknown>) => Record<string, unknown>;
}) {
  const release = vi.fn();
  const transformRow = (row: Record<string, unknown>) => options.rowTransform?.(row) ?? row;
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT INTO reception_entries')) {
      if (options.operationError !== undefined) throw options.operationError;
      return {
        rows:
          options.scenario === 'created'
            ? [transformRow({ ...storedRow, ...options.provenanceOverride })]
            : [],
      };
    }
    if (normalized.startsWith('SELECT')) {
      return {
        rows: [
          transformRow({
            ...storedRow,
            stored_patient_id:
              options.scenario === 'conflict' ? 'patient-different' : patient.patientId,
            ...options.provenanceOverride,
          }),
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

type InvalidAcceptedAtAuthority = 'accessor' | 'inherited' | 'missing';
type ProvenanceColumn =
  | 'stored_tenant_id'
  | 'stored_pharmacy_id'
  | 'stored_idempotency_key'
  | 'reception_id'
  | 'stored_patient_id';

const provenanceColumns: readonly ProvenanceColumn[] = [
  'stored_tenant_id',
  'stored_pharmacy_id',
  'stored_idempotency_key',
  'reception_id',
  'stored_patient_id',
];

function replaceAcceptedAtAuthority(
  row: Record<string, unknown>,
  authorityKind: InvalidAcceptedAtAuthority,
  onAccessorRead: () => void,
): void {
  if (authorityKind === 'accessor') {
    Object.defineProperty(row, 'accepted_at', {
      get() {
        onAccessorRead();
        throw new Error('raw accepted_at accessor secret 4217');
      },
    });
    return;
  }
  delete row.accepted_at;
  if (authorityKind === 'inherited') {
    Object.setPrototypeOf(row, { accepted_at: storedRow.accepted_at });
  }
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

  it.each(['accessor', 'inherited', 'missing'] as const)(
    'rejects a mixed list with a non-own-data accepted_at %s without invoking it',
    async (authorityKind) => {
      let accessorReads = 0;
      const invalidRow = { ...storedRow, reception_id: `reception-${authorityKind}-4217` } as Record<
        string,
        unknown
      >;
      replaceAcceptedAtAuthority(invalidRow, authorityKind, () => {
        accessorReads += 1;
      });
      const query = vi.fn(async () => ({ rows: [storedRow, invalidRow] }));
      const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

      await expect(
        repository.list({
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          date: '2026-07-13',
        }),
      ).rejects.toThrow(databaseReceptionTimestampInvariantErrorMessage);

      expect(accessorReads).toBe(0);
      expect(query).toHaveBeenCalledOnce();
    },
  );

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

  it.each([
    ['created', 'accessor'],
    ['created', 'inherited'],
    ['created', 'missing'],
    ['existing', 'accessor'],
    ['existing', 'inherited'],
    ['existing', 'missing'],
  ] as const)(
    'rolls back a %s result with a non-own-data accepted_at %s without invoking it',
    async (scenario, authorityKind) => {
      let accessorReads = 0;
      const { repository, query, release } = createRepository({
        scenario,
        rowTransform(row) {
          replaceAcceptedAtAuthority(row, authorityKind, () => {
            accessorReads += 1;
          });
          return row;
        },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionTimestampInvariantErrorMessage,
      );

      expect(accessorReads).toBe(0);
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

  it('does not invoke an accepted_at accessor for a different-patient idempotency conflict', async () => {
    let accessorReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      rowTransform(row) {
        Object.defineProperty(row, 'accepted_at', {
          get() {
            accessorReads += 1;
            throw new Error('raw conflict accepted_at accessor secret 4217');
          },
        });
        return row;
      },
    });

    const result = await repository.create(input);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(accessorReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('rejects missing, inherited, and accessor provenance columns without invoking accessors', async () => {
    let accessorReads = 0;
    for (const column of provenanceColumns) {
      for (const authorityKind of ['accessor', 'inherited', 'missing'] as const) {
        const { repository, query, release } = createRepository({
          scenario: 'created',
          rowTransform(row) {
            if (authorityKind === 'accessor') {
              Object.defineProperty(row, column, {
                get() {
                  accessorReads += 1;
                  throw new Error('raw provenance accessor secret 4218');
                },
              });
            } else {
              const inheritedValue = row[column];
              delete row[column];
              if (authorityKind === 'inherited') {
                Object.setPrototypeOf(row, { [column]: inheritedValue });
              }
            }
            return row;
          },
        });

        await expect(repository.create(input)).rejects.toThrow(
          databaseReceptionProvenanceInvariantErrorMessage,
        );
        expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
        expect(release.mock.calls).toEqual([[]]);
      }
    }
    expect(accessorReads).toBe(0);
  });

  it('rejects hostile and revoked provenance row Proxies without invoking traps', async () => {
    let proxyTraps = 0;
    const hostileRow = new Proxy(
      { ...storedRow },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw provenance row get secret 4218');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw provenance row descriptor secret 4218');
        },
      },
    );
    const revoked = Proxy.revocable({ ...storedRow }, {});
    revoked.revoke();

    for (const proxiedRow of [hostileRow, revoked.proxy]) {
      const { repository, query, release } = createRepository({
        scenario: 'created',
        rowTransform: () => proxiedRow,
      });
      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionProvenanceInvariantErrorMessage,
      );
      expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
      expect(release.mock.calls).toEqual([[]]);
    }
    expect(proxyTraps).toBe(0);
  });

  it('uses captured provenance for existing/conflict branching without reading an accessor', async () => {
    let patientIdReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      rowTransform(row) {
        Object.defineProperty(row, 'stored_patient_id', {
          get() {
            patientIdReads += 1;
            return patientIdReads === 1 ? 'patient-different' : patient.patientId;
          },
        });
        return row;
      },
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(patientIdReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it.each(['created', 'existing', 'conflict'] as const)(
    'accepts non-default own data descriptor flags for a %s result',
    async (scenario) => {
      const { repository, query, release } = createRepository({
        scenario,
        rowTransform(row) {
          Object.defineProperty(row, 'stored_tenant_id', {
            value: input.tenantId,
            enumerable: false,
            configurable: false,
            writable: false,
          });
          return row;
        },
      });

      const result = await repository.create(input);

      expect(result.kind).toBe(
        scenario === 'conflict' ? 'idempotency_conflict' : scenario,
      );
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'created' ? [] : ['SELECT']),
        'COMMIT',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('stops after the first invalid provenance field and leaves later projections unread', async () => {
    let laterReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'created',
      rowTransform(row) {
        Object.defineProperty(row, 'stored_tenant_id', { value: 0 });
        for (const column of provenanceColumns.slice(1)) {
          Object.defineProperty(row, column, {
            get() {
              laterReads += 1;
              throw new Error('later provenance field must remain unread');
            },
          });
        }
        Object.defineProperty(row, 'accepted_at', {
          get() {
            laterReads += 1;
            throw new Error('entry projection must remain unread');
          },
        });
        return row;
      },
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(laterReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after provenance rollback fails without masking the fixed error', async () => {
    const rollbackError = new Error('synthetic provenance rollback failure');
    const { repository, query, release } = createRepository({
      scenario: 'created',
      provenanceOverride: { stored_tenant_id: undefined },
      rollbackError,
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[true]]);
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
  it('snapshots a genuine create Date intrinsically and derives a matching JST business date', async () => {
    const repository = new InMemoryReceptionRepository();
    const acceptedAt = new Date('2026-07-09T14:59:59.999Z');
    let ownMethodReads = 0;
    Object.defineProperty(acceptedAt, 'toISOString', {
      get() {
        ownMethodReads += 1;
        throw new Error('raw in-memory timestamp method secret 4216');
      },
    });

    const result = await repository.create({ ...input, acceptedAt });

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') throw new Error('expected a created reception');
    expect(result.entry).toMatchObject({
      receptionId: 'reception-000004',
      acceptedAt: '2026-07-09T14:59:59.999Z',
    });
    expect(
      await repository.list({
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        date: '2026-07-09',
      }),
    ).toContainEqual(result.entry);
    expect(
      await repository.list({
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        date: '2026-07-10',
      }),
    ).not.toContainEqual(result.entry);
    expect(ownMethodReads).toBe(0);
  });

  it('rejects invalid new-create timestamps without mutation, coercion, or Date Proxy traps', async () => {
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
        throw new Error('raw in-memory timestamp Proxy secret 4216');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('raw in-memory timestamp prototype secret 4216');
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
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };
      const initialRecordCount = internals.records.length;
      const initialSequence = internals.nextSequence;

      await expect(
        repository.create({ ...input, acceptedAt: invalidValue as Date }),
      ).rejects.toThrow(inMemoryReceptionTimestampInvariantErrorMessage);
      expect(internals.records).toHaveLength(initialRecordCount);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(initialSequence);

      const created = await repository.create(input);
      expect(created.kind).toBe('created');
      if (created.kind !== 'created') throw new Error('expected a created reception');
      expect(created.entry.receptionId).toBe('reception-000004');
      expect(internals.records).toHaveLength(initialRecordCount + 1);
      expect(internals.idempotencyRecords.size).toBe(1);
    }

    expect(fakeCoercions).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('binds created, existing, and conflict results to one stored reception identity', async () => {
    const repository = new InMemoryReceptionRepository();
    const created = await repository.create(input);
    let acceptedAtReads = 0;
    const unreadableAcceptedAt = new Proxy(input.acceptedAt, {
      get() {
        acceptedAtReads += 1;
        throw new Error('existing reception must not inspect acceptedAt');
      },
      getPrototypeOf() {
        acceptedAtReads += 1;
        throw new Error('existing reception must not inspect acceptedAt prototype');
      },
    });
    const existing = await repository.create({ ...input, acceptedAt: unreadableAcceptedAt });
    const conflict = await repository.create({
      ...input,
      patient: { ...patient, patientId: patientId('patient-reception-client-conflict') },
      acceptedAt: unreadableAcceptedAt,
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
    expect(acceptedAtReads).toBe(0);
  });

  it('fails closed without creating a duplicate when an index points to a missing record', async () => {
    const repository = new InMemoryReceptionRepository();
    await repository.create(input);
    const internals = repository as unknown as {
      readonly records: unknown[];
      readonly idempotencyRecords: Map<string, unknown>;
    };
    internals.records.splice(0);

    let acceptedAtReads = 0;
    const acceptedAt = new Proxy(input.acceptedAt, {
      get() {
        acceptedAtReads += 1;
        throw new Error('corrupt index must win before acceptedAt');
      },
    });
    await expect(repository.create({ ...input, acceptedAt })).rejects.toThrow(
      inMemoryReceptionIdempotencyInvariantErrorMessage,
    );
    expect(internals.records).toHaveLength(0);
    expect(internals.idempotencyRecords.size).toBe(1);
    expect(acceptedAtReads).toBe(0);
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

    let acceptedAtReads = 0;
    const acceptedAt = new Proxy(input.acceptedAt, {
      get() {
        acceptedAtReads += 1;
        throw new Error('unindexed record must win before acceptedAt');
      },
    });
    await expect(repository.create({ ...input, acceptedAt })).rejects.toThrow(
      inMemoryReceptionIdempotencyInvariantErrorMessage,
    );
    expect(internals.records).toHaveLength(recordCount);
    expect(internals.idempotencyRecords.size).toBe(0);
    expect(acceptedAtReads).toBe(0);
  });
});
