import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  PostgresPatientRepository,
  databasePatientEligibilityTimestampInvariantErrorMessage,
  databasePatientRowInvariantErrorMessage,
  databasePatientRowSetInvariantErrorMessage,
  patientRowToSearchResult,
} from './patient-repository.js';
import {
  patientRepositoryCommandSnapshotInvariantErrorMessage,
  patientRepositoryPaginationInvariantErrorMessage,
} from '../patient-repository.js';
import { PostgresReceptionRepository } from './reception-repository.js';

const scope = {
  tenantId: tenantId('tenant-patient-db-4215'),
  pharmacyId: pharmacyId('pharmacy-patient-db-4215'),
} as const;

const patientRow = {
  patient_id: 'patient-db-4215',
  name: '合成DB患者',
  kana: 'ゴウセイディービーカンジャ',
  birth_date: '1980-01-01',
  sex: 'unknown',
  patient_number: 'DB-4215',
  eligibility_status: 'VERIFIED',
  eligibility_checked_at: null,
};

type PatientCoreColumn =
  | 'patient_id'
  | 'name'
  | 'kana'
  | 'birth_date'
  | 'sex'
  | 'patient_number'
  | 'eligibility_status';

const patientCoreColumns: readonly PatientCoreColumn[] = [
  'patient_id',
  'name',
  'kana',
  'birth_date',
  'sex',
  'patient_number',
  'eligibility_status',
];

function rowWithEligibility(
  value: unknown,
): Parameters<typeof patientRowToSearchResult>[0] {
  return { ...patientRow, eligibility_checked_at: value } as unknown as Parameters<
    typeof patientRowToSearchResult
  >[0];
}

describe('Postgres patient eligibility timestamp adapter', () => {
  it('omits a null eligibility timestamp', () => {
    const result = patientRowToSearchResult(patientRow);

    expect(result).not.toHaveProperty('eligibilityCheckedAt');
  });

  it('normalizes genuine Date and primitive string values without own method dispatch', () => {
    const expectedIso = '2026-07-17T00:30:00.000Z';
    const storedDate = new Date(expectedIso);
    let ownMethodReads = 0;
    Object.defineProperty(storedDate, 'toISOString', {
      get() {
        ownMethodReads += 1;
        throw new Error('raw eligibility Date method secret 4215');
      },
    });

    expect(patientRowToSearchResult(rowWithEligibility(storedDate))).toMatchObject({
      eligibilityCheckedAt: expectedIso,
    });
    expect(
      patientRowToSearchResult(rowWithEligibility('2026-07-17T09:30:00+09:00')),
    ).toMatchObject({ eligibilityCheckedAt: expectedIso });
    expect(ownMethodReads).toBe(0);
  });

  it('rejects invalid eligibility timestamp values without coercion or Date Proxy traps', () => {
    let coercions = 0;
    let proxyTraps = 0;
    const fakeInstant = {
      [Symbol.toPrimitive]() {
        coercions += 1;
        return '2026-07-17T00:30:00.000Z';
      },
      toISOString() {
        coercions += 1;
        return '2026-07-17T00:30:00.000Z';
      },
    };
    const hostileDateProxy = new Proxy(new Date('2026-07-17T00:30:00.000Z'), {
      get() {
        proxyTraps += 1;
        throw new Error('raw eligibility Date Proxy secret 4215');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('raw eligibility Date prototype secret 4215');
      },
    });
    const revoked = Proxy.revocable(new Date('2026-07-17T00:30:00.000Z'), {});
    revoked.revoke();
    const invalidValues: readonly unknown[] = [
      undefined,
      0,
      false,
      new String('2026-07-17T00:30:00.000Z'),
      fakeInstant,
      Promise.resolve('2026-07-17T00:30:00.000Z'),
      'not-an-instant',
      new Date(Number.NaN),
      Object.create(Date.prototype),
      hostileDateProxy,
      revoked.proxy,
    ];

    for (const invalidValue of invalidValues) {
      expect(() => patientRowToSearchResult(rowWithEligibility(invalidValue))).toThrow(
        databasePatientEligibilityTimestampInvariantErrorMessage,
      );
    }
    expect(coercions).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('requires one own data descriptor for the eligibility timestamp column', () => {
    let accessorReads = 0;
    let rowProxyTraps = 0;
    const accessorRow = { ...patientRow } as Record<string, unknown>;
    Object.defineProperty(accessorRow, 'eligibility_checked_at', {
      get() {
        accessorReads += 1;
        return accessorReads === 1 ? null : '2026-07-17T00:30:00.000Z';
      },
    });
    const { eligibility_checked_at: _eligibility, ...withoutEligibility } = patientRow;
    const inheritedRow = Object.assign(
      Object.create({ eligibility_checked_at: '2026-07-17T00:30:00.000Z' }),
      withoutEligibility,
    );
    const proxiedRow = new Proxy(patientRow, {
      getOwnPropertyDescriptor() {
        rowProxyTraps += 1;
        throw new Error('raw patient row descriptor secret 4215');
      },
      get() {
        rowProxyTraps += 1;
        throw new Error('raw patient row get secret 4215');
      },
    });

    for (const invalidRow of [accessorRow, withoutEligibility, inheritedRow, proxiedRow]) {
      expect(() => patientRowToSearchResult(invalidRow as typeof patientRow)).toThrow(
        databasePatientEligibilityTimestampInvariantErrorMessage,
      );
    }
    expect(accessorReads).toBe(0);
    expect(rowProxyTraps).toBe(0);
  });

  it('requires one own data descriptor for every core patient column', () => {
    let accessorReads = 0;
    for (const column of patientCoreColumns) {
      for (const authorityKind of ['accessor', 'inherited', 'missing'] as const) {
        const invalidRow = { ...patientRow } as Record<string, unknown>;
        if (authorityKind === 'accessor') {
          Object.defineProperty(invalidRow, column, {
            get() {
              accessorReads += 1;
              throw new Error('raw patient core accessor PHI secret 4219');
            },
          });
        } else {
          const inheritedValue = invalidRow[column];
          delete invalidRow[column];
          if (authorityKind === 'inherited') {
            Object.setPrototypeOf(invalidRow, { [column]: inheritedValue });
          }
        }

        expect(() => patientRowToSearchResult(invalidRow as typeof patientRow)).toThrow(
          databasePatientRowInvariantErrorMessage,
        );
      }
    }
    expect(accessorReads).toBe(0);
  });

  it('normalizes core schema failures to one fixed non-echo patient row error', () => {
    const invalidValues: Readonly<Record<PatientCoreColumn, string>> = {
      patient_id: '',
      name: '',
      kana: '',
      birth_date: '19800101',
      sex: 'not-a-sex',
      patient_number: '',
      eligibility_status: 'NOT-A-STATUS',
    };

    for (const column of patientCoreColumns) {
      const invalidValue = invalidValues[column];
      expect(() =>
        patientRowToSearchResult({ ...patientRow, [column]: invalidValue }),
      ).toThrow(databasePatientRowInvariantErrorMessage);
      try {
        patientRowToSearchResult({ ...patientRow, [column]: invalidValue });
      } catch (error) {
        expect(error).toEqual(new Error(databasePatientRowInvariantErrorMessage));
      }
    }
  });

  it('preserves timestamp error precedence and leaves core patient accessors unread', () => {
    let timestampReads = 0;
    let coreReads = 0;
    const invalidRow = { ...patientRow } as Record<string, unknown>;
    Object.defineProperty(invalidRow, 'eligibility_checked_at', {
      get() {
        timestampReads += 1;
        throw new Error('raw eligibility accessor secret 4219');
      },
    });
    for (const column of patientCoreColumns) {
      Object.defineProperty(invalidRow, column, {
        get() {
          coreReads += 1;
          throw new Error('patient core must remain unread after timestamp failure');
        },
      });
    }

    expect(() => patientRowToSearchResult(invalidRow as typeof patientRow)).toThrow(
      databasePatientEligibilityTimestampInvariantErrorMessage,
    );
    expect(timestampReads).toBe(0);
    expect(coreReads).toBe(0);
  });

  it('accepts non-default own data descriptor flags for core patient columns', () => {
    const validRow = { ...patientRow } as Record<string, unknown>;
    Object.defineProperty(validRow, 'name', {
      value: patientRow.name,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    expect(patientRowToSearchResult(validRow as typeof patientRow)).toMatchObject({
      patientId: patientRow.patient_id,
      name: patientRow.name,
    });
  });

  it('keeps findById absence and fails the whole lookup on an invalid projected timestamp', async () => {
    const absentQuery = vi.fn(async () => ({ rows: [] }));
    const absentRepository = new PostgresPatientRepository({ query: absentQuery } as unknown as Pool);

    await expect(
      absentRepository.findById({ ...scope, patientId: patientId('patient-absent-4215') }),
    ).resolves.toBeUndefined();
    expect(absentQuery).toHaveBeenCalledOnce();

    const invalidQuery = vi.fn(async () => ({
      rows: [rowWithEligibility({ toISOString: () => 'fake instant' })],
    }));
    const invalidRepository = new PostgresPatientRepository({ query: invalidQuery } as unknown as Pool);

    await expect(
      invalidRepository.findById({ ...scope, patientId: patientId(patientRow.patient_id) }),
    ).rejects.toThrow(databasePatientEligibilityTimestampInvariantErrorMessage);
    expect(invalidQuery).toHaveBeenCalledOnce();
  });

  it('requires an own dense query row set for findById without invoking hostile authority', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessorResult = {};
    Object.defineProperty(accessorResult, 'rows', {
      get() {
        getterReads += 1;
        throw new Error('raw patient query rows accessor PHI secret 4224');
      },
    });
    const inheritedResult = Object.create({ rows: [patientRow] });
    const indexAccessorRows = [patientRow];
    Object.defineProperty(indexAccessorRows, '0', {
      get() {
        getterReads += 1;
        throw new Error('raw patient query index accessor PHI secret 4224');
      },
    });
    const sparseRows = new Array(1);
    const inheritedIndexRows = new Array(1);
    Object.setPrototypeOf(inheritedIndexRows, { 0: patientRow });
    const proxiedResult = new Proxy(
      { rows: [patientRow] },
      {
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw patient query result Proxy secret 4224');
        },
      },
    );
    const proxiedRows = new Proxy(
      [patientRow],
      {
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw patient query rows Proxy secret 4224');
        },
      },
    );
    const revokedRows = Proxy.revocable([patientRow], {});
    revokedRows.revoke();
    const invalidResults: readonly unknown[] = [
      {},
      { rows: 'not-an-array' },
      accessorResult,
      inheritedResult,
      { rows: indexAccessorRows },
      { rows: sparseRows },
      { rows: inheritedIndexRows },
      proxiedResult,
      { rows: proxiedRows },
      { rows: revokedRows.proxy },
    ];

    for (const invalidResult of invalidResults) {
      const repository = new PostgresPatientRepository({
        query: vi.fn(async () => invalidResult),
      } as unknown as Pool);
      await expect(
        repository.findById({ ...scope, patientId: patientId(patientRow.patient_id) }),
      ).rejects.toEqual(new Error(databasePatientRowSetInvariantErrorMessage));
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('rejects multiple findById rows before projecting patient fields', async () => {
    let patientFieldReads = 0;
    const firstRow = { ...patientRow };
    Object.defineProperty(firstRow, 'eligibility_checked_at', {
      get() {
        patientFieldReads += 1;
        throw new Error('over-cardinality patient PHI must stay unread 4224');
      },
    });
    const repository = new PostgresPatientRepository({
      query: vi.fn(async () => ({ rows: [firstRow, { ...patientRow }] })),
    } as unknown as Pool);

    await expect(
      repository.findById({ ...scope, patientId: patientId(patientRow.patient_id) }),
    ).rejects.toThrow(databasePatientRowSetInvariantErrorMessage);
    expect(patientFieldReads).toBe(0);
  });

  it('accepts dense row sets with non-default own data descriptor flags', async () => {
    const rows = [patientRow];
    Object.defineProperty(rows, '0', {
      value: patientRow,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    const queryResult = {};
    Object.defineProperty(queryResult, 'rows', {
      value: rows,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    const repository = new PostgresPatientRepository({
      query: vi.fn(async () => queryResult),
    } as unknown as Pool);

    await expect(
      repository.findById({ ...scope, patientId: patientId(patientRow.patient_id) }),
    ).resolves.toMatchObject({ patientId: patientRow.patient_id });
  });

  it('ignores hostile raw row methods and returns the physical empty search page', async () => {
    let methodCalls = 0;
    const rows: unknown[] = [];
    for (const method of ['slice', 'map'] as const) {
      Object.defineProperty(rows, method, {
        value() {
          methodCalls += 1;
          return [patientRow];
        },
      });
    }
    Object.defineProperty(rows, Symbol.iterator, {
      value() {
        methodCalls += 1;
        throw new Error('raw patient rows iterator secret 4224');
      },
    });
    Object.defineProperty(rows, Symbol.toPrimitive, {
      value() {
        methodCalls += 1;
        throw new Error('raw patient rows coercion secret 4224');
      },
    });
    const repository = new PostgresPatientRepository({
      query: vi.fn(async () => ({ rows })),
    } as unknown as Pool);

    await expect(repository.search({ ...scope, q: '合成', limit: 1 })).resolves.toEqual({
      results: [],
    });
    expect(methodCalls).toBe(0);
  });

  it('rejects hostile, sparse, and over-limit search row sets before projection', async () => {
    let indexReads = 0;
    let patientFieldReads = 0;
    const accessorRows = [patientRow];
    Object.defineProperty(accessorRows, '0', {
      get() {
        indexReads += 1;
        return patientRow;
      },
    });
    const overLimitRow = { ...patientRow };
    Object.defineProperty(overLimitRow, 'name', {
      get() {
        patientFieldReads += 1;
        throw new Error('over-limit patient PHI must stay unread 4224');
      },
    });
    const invalidRows = [accessorRows, new Array(1), [overLimitRow, patientRow, patientRow]];

    for (const rows of invalidRows) {
      const repository = new PostgresPatientRepository({
        query: vi.fn(async () => ({ rows })),
      } as unknown as Pool);
      await expect(
        repository.search({ ...scope, q: '合成', limit: 1 }),
      ).rejects.toEqual(new Error(databasePatientRowSetInvariantErrorMessage));
    }
    expect(indexReads).toBe(0);
    expect(patientFieldReads).toBe(0);
  });

  it('fails the whole lookup on an invalid core patient row', async () => {
    let nameReads = 0;
    const invalidRow = { ...patientRow };
    Object.defineProperty(invalidRow, 'name', {
      get() {
        nameReads += 1;
        throw new Error('raw find patient name PHI secret 4219');
      },
    });
    const query = vi.fn(async () => ({ rows: [invalidRow] }));
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);

    await expect(
      repository.findById({ ...scope, patientId: patientId(patientRow.patient_id) }),
    ).rejects.toThrow(databasePatientRowInvariantErrorMessage);
    expect(nameReads).toBe(0);
    expect(query).toHaveBeenCalledOnce();
  });

  it('rejects an invalid projected search row but leaves lookahead-only timestamps unread', async () => {
    const invalidQuery = vi.fn(async () => ({
      rows: [rowWithEligibility('not-an-instant')],
    }));
    const invalidRepository = new PostgresPatientRepository({ query: invalidQuery } as unknown as Pool);

    await expect(
      invalidRepository.search({ ...scope, q: '合成', limit: 1 }),
    ).rejects.toThrow(databasePatientEligibilityTimestampInvariantErrorMessage);

    let lookaheadReads = 0;
    const lookaheadRow = { ...patientRow, patient_id: 'patient-lookahead-4215' };
    Object.defineProperty(lookaheadRow, 'eligibility_checked_at', {
      get() {
        lookaheadReads += 1;
        throw new Error('lookahead eligibility timestamp must stay unread');
      },
    });
    const pageQuery = vi.fn(async () => ({ rows: [patientRow, lookaheadRow] }));
    const pageRepository = new PostgresPatientRepository({ query: pageQuery } as unknown as Pool);

    await expect(pageRepository.search({ ...scope, q: '合成', limit: 1 })).resolves.toEqual({
      results: [expect.objectContaining({ patientId: patientRow.patient_id })],
      nextCursor: { offset: 1 },
    });
    expect(lookaheadReads).toBe(0);
  });

  it('rejects an invalid selected core row but leaves lookahead-only core fields unread', async () => {
    const invalidRepository = new PostgresPatientRepository({
      query: vi.fn(async () => ({ rows: [{ ...patientRow, name: '' }] })),
    } as unknown as Pool);
    await expect(
      invalidRepository.search({ ...scope, q: '合成', limit: 1 }),
    ).rejects.toThrow(databasePatientRowInvariantErrorMessage);

    let lookaheadReads = 0;
    const lookaheadRow = { ...patientRow, patient_id: 'patient-lookahead-core-4219' };
    Object.defineProperty(lookaheadRow, 'name', {
      get() {
        lookaheadReads += 1;
        throw new Error('lookahead core field must stay unread');
      },
    });
    const repository = new PostgresPatientRepository({
      query: vi.fn(async () => ({ rows: [patientRow, lookaheadRow] })),
    } as unknown as Pool);

    await expect(repository.search({ ...scope, q: '合成', limit: 1 })).resolves.toEqual({
      results: [expect.objectContaining({ patientId: patientRow.patient_id })],
      nextCursor: { offset: 1 },
    });
    expect(lookaheadReads).toBe(0);
  });

  it.each(['created', 'existing'] as const)(
    'rolls back a reception %s result with an invalid nested eligibility timestamp',
    async (scenario) => {
      const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
        const normalized = sql.trim();
        if (normalized.startsWith('INSERT')) {
          return {
            rows:
              scenario === 'created'
                ? [{ ...receptionRow('patient-db-4215'), reception_id: values?.[2] }]
                : [],
          };
        }
        if (normalized.startsWith('SELECT')) {
          return { rows: [receptionRow('patient-db-4215')] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const client = { query: query as unknown as PoolClient['query'], release } as unknown as PoolClient;
      const repository = new PostgresReceptionRepository({
        connect: vi.fn(async () => client),
      } as unknown as Pool);

      await expect(repository.create(receptionInput)).rejects.toThrow(
        databasePatientEligibilityTimestampInvariantErrorMessage,
      );
      expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
        'BEGIN',
        expect.stringContaining('INSERT INTO reception_entries'),
        ...(scenario === 'existing' ? [expect.stringContaining('SELECT')] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it.each(['created', 'existing'] as const)(
    'rolls back a reception %s result with an invalid nested core patient row',
    async (scenario) => {
      let nameReads = 0;
      const storedReceptionRow = {
        ...receptionRow('patient-db-4215'),
        eligibility_checked_at: null,
      };
      Object.defineProperty(storedReceptionRow, 'name', {
        get() {
          nameReads += 1;
          throw new Error('raw nested patient name PHI secret 4219');
        },
      });
      const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
        const normalized = sql.trim();
        if (normalized.startsWith('INSERT')) {
          if (scenario === 'created') {
            Object.defineProperty(storedReceptionRow, 'reception_id', {
              value: values?.[2],
              enumerable: true,
              configurable: true,
              writable: true,
            });
          }
          return {
            rows: scenario === 'created' ? [storedReceptionRow] : [],
          };
        }
        if (normalized.startsWith('SELECT')) return { rows: [storedReceptionRow] };
        return { rows: [] };
      });
      const release = vi.fn();
      const client = { query: query as unknown as PoolClient['query'], release } as unknown as PoolClient;
      const repository = new PostgresReceptionRepository({
        connect: vi.fn(async () => client),
      } as unknown as Pool);

      await expect(repository.create(receptionInput)).rejects.toThrow(
        databasePatientRowInvariantErrorMessage,
      );
      expect(nameReads).toBe(0);
      expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
        'BEGIN',
        expect.stringContaining('INSERT INTO reception_entries'),
        ...(scenario === 'existing' ? [expect.stringContaining('SELECT')] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('keeps a different-patient reception conflict free of patient timestamp projection', async () => {
    let eligibilityReads = 0;
    const conflictRow = receptionRow('patient-different-4215');
    Object.defineProperty(conflictRow, 'eligibility_checked_at', {
      get() {
        eligibilityReads += 1;
        throw new Error('conflict eligibility timestamp must stay unread');
      },
    });
    const query = vi.fn(async (sql: string) => {
      const normalized = sql.trim();
      if (normalized.startsWith('INSERT')) return { rows: [] };
      if (normalized.startsWith('SELECT')) return { rows: [conflictRow] };
      return { rows: [] };
    });
    const release = vi.fn();
    const client = { query: query as unknown as PoolClient['query'], release } as unknown as PoolClient;
    const repository = new PostgresReceptionRepository({
      connect: vi.fn(async () => client),
    } as unknown as Pool);

    const result = await repository.create(receptionInput);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(eligibilityReads).toBe(0);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO reception_entries'),
      expect.stringContaining('SELECT'),
      'COMMIT',
    ]);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('keeps a different-patient reception conflict free of core patient projection', async () => {
    let coreReads = 0;
    const conflictRow = receptionRow('patient-different-core-4219');
    for (const column of patientCoreColumns) {
      Object.defineProperty(conflictRow, column, {
        get() {
          coreReads += 1;
          throw new Error('conflict core patient fields must stay unread');
        },
      });
    }
    const query = vi.fn(async (sql: string) => {
      const normalized = sql.trim();
      if (normalized.startsWith('INSERT')) return { rows: [] };
      if (normalized.startsWith('SELECT')) return { rows: [conflictRow] };
      return { rows: [] };
    });
    const release = vi.fn();
    const client = { query: query as unknown as PoolClient['query'], release } as unknown as PoolClient;
    const repository = new PostgresReceptionRepository({
      connect: vi.fn(async () => client),
    } as unknown as Pool);

    const result = await repository.create(receptionInput);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(coreReads).toBe(0);
    expect(query.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO reception_entries'),
      expect.stringContaining('SELECT'),
      'COMMIT',
    ]);
    expect(release.mock.calls).toEqual([[]]);
  });
});

describe('PostgresPatientRepository command authority', () => {
  const lookup = { ...scope, patientId: patientId(patientRow.patient_id) } as const;
  const search = { ...scope, q: '  合成  ', limit: 2 } as const;

  async function expectInvalidWithoutQuery(
    operation: 'lookup' | 'search',
    input: unknown,
  ): Promise<void> {
    const query = vi.fn(async () => ({ rows: [] }));
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);
    const promise =
      operation === 'lookup'
        ? repository.findById(input as never)
        : repository.search(input as never);
    await expect(promise).rejects.toEqual(
      new Error(patientRepositoryCommandSnapshotInvariantErrorMessage),
    );
    expect(query).not.toHaveBeenCalled();
  }

  function withInvalidAuthority(
    valid: Readonly<Record<string, unknown>>,
    property: string,
    kind: 'missing' | 'inherited' | 'accessor',
    onAccessor: () => void,
  ): object {
    const command = { ...valid };
    const value = command[property];
    delete command[property];
    if (kind === 'inherited') {
      Object.setPrototypeOf(command, { [property]: value });
    } else if (kind === 'accessor') {
      Object.defineProperty(command, property, {
        get() {
          onAccessor();
          throw new Error('raw database patient command PHI secret');
        },
      });
    }
    return command;
  }

  it.each([
    ['lookup', lookup, 'tenantId'],
    ['lookup', lookup, 'pharmacyId'],
    ['lookup', lookup, 'patientId'],
    ['search', search, 'tenantId'],
    ['search', search, 'pharmacyId'],
    ['search', search, 'q'],
    ['search', search, 'limit'],
  ] as const)(
    'rejects %s %s missing, inherited, and accessor authority before query',
    async (operation, valid, property) => {
      let accessorReads = 0;
      for (const kind of ['missing', 'inherited', 'accessor'] as const) {
        await expectInvalidWithoutQuery(
          operation,
          withInvalidAuthority(valid, property, kind, () => {
            accessorReads += 1;
          }),
        );
      }
      expect(accessorReads).toBe(0);
    },
  );

  it.each(['lookup', 'search'] as const)(
    'rejects hostile and revoked %s roots without invoking traps or query',
    async (operation) => {
      let traps = 0;
      const valid = operation === 'lookup' ? lookup : search;
      const hostile = new Proxy(valid, {
        get() {
          traps += 1;
          throw new Error('raw database patient command Proxy secret');
        },
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error('raw database patient command descriptor secret');
        },
      });
      const revoked = Proxy.revocable(valid, {});
      revoked.revoke();

      await expectInvalidWithoutQuery(operation, hostile);
      await expectInvalidWithoutQuery(operation, revoked.proxy);
      expect(traps).toBe(0);
    },
  );

  it('rejects invalid semantic values with one fixed non-echo error before query', async () => {
    const cases: readonly [operation: 'lookup' | 'search', input: object][] = [
      ['lookup', { ...lookup, tenantId: '' }],
      ['lookup', { ...lookup, pharmacyId: '\u0000' }],
      ['lookup', { ...lookup, patientId: '' }],
      ['lookup', { ...lookup, patientId: new String(patientRow.patient_id) }],
      ['search', { ...search, tenantId: '' }],
      ['search', { ...search, pharmacyId: '\u0000' }],
      ['search', { ...search, q: '' }],
      ['search', { ...search, q: 'x'.repeat(101) }],
      ['search', { ...search, q: new String('合成') }],
      ['search', { ...search, limit: 0 }],
      ['search', { ...search, limit: 51 }],
      ['search', { ...search, limit: 1.5 }],
      ['search', { ...search, limit: '2' }],
      ['search', { ...search, limit: Number.NaN }],
      ['search', { ...search, cursor: null }],
      ['search', { ...search, cursor: { offset: -1 } }],
      ['search', { ...search, cursor: { offset: 1.5 } }],
      ['search', { ...search, cursor: { offset: '1' } }],
      ['search', { ...search, cursor: { offset: Number.MAX_SAFE_INTEGER } }],
    ];

    for (const [operation, input] of cases) {
      await expectInvalidWithoutQuery(operation, input);
    }
  });

  it('rejects missing, inherited, accessor, Proxy, and revoked cursor authority before query', async () => {
    let accessorReads = 0;
    let proxyTraps = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'offset', {
      get() {
        accessorReads += 1;
        return 0;
      },
    });
    const proxied = new Proxy(
      { offset: 0 },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw database patient cursor Proxy secret');
        },
      },
    );
    const revoked = Proxy.revocable({ offset: 0 }, {});
    revoked.revoke();

    for (const cursor of [
      {},
      Object.create({ offset: 0 }),
      accessor,
      proxied,
      revoked.proxy,
    ]) {
      await expectInvalidWithoutQuery('search', { ...search, cursor });
    }
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('uses detached lookup parameters in the original SQL order', async () => {
    const command = { ...lookup };
    const query = vi.fn(async (_sql: string, values?: readonly unknown[]) => {
      command.tenantId = tenantId('tenant-mutated');
      command.pharmacyId = pharmacyId('pharmacy-mutated');
      command.patientId = patientId('patient-mutated');
      expect(values).toEqual([scope.tenantId, scope.pharmacyId, patientRow.patient_id]);
      return { rows: [] };
    });
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);

    await expect(repository.findById(command)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain(
      'WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3',
    );
  });

  it('preserves search SQL escaping, parameter order, pagination, and detached command values', async () => {
    const command = {
      ...scope,
      q: '  %_\\  ',
      limit: 1,
      cursor: { offset: 4 },
    };
    const lookahead = { ...patientRow, patient_id: 'patient-lookahead-command-4227' };
    const query = vi.fn(async (_sql: string, values?: readonly unknown[]) => {
      command.tenantId = tenantId('tenant-mutated');
      command.pharmacyId = pharmacyId('pharmacy-mutated');
      command.q = 'mutated';
      command.limit = 50;
      command.cursor.offset = 0;
      expect(values).toEqual([scope.tenantId, scope.pharmacyId, '%\\%\\_\\\\%', 2, 4]);
      return { rows: [patientRow, lookahead] };
    });
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);

    await expect(repository.search(command)).resolves.toEqual({
      results: [expect.objectContaining({ patientId: patientRow.patient_id })],
      nextCursor: { offset: 5 },
    });
    expect(String(query.mock.calls[0]?.[0])).toContain('LIMIT $4 OFFSET $5');
  });

  it('accepts absent and explicit undefined cursors and preserves empty/final page semantics', async () => {
    const emptyQuery = vi.fn(
      async (_sql: string, _values?: readonly unknown[]) => ({ rows: [] }),
    );
    const emptyRepository = new PostgresPatientRepository({
      query: emptyQuery,
    } as unknown as Pool);
    await expect(emptyRepository.search(search)).resolves.toEqual({ results: [] });
    await expect(emptyRepository.search({ ...search, cursor: undefined } as never)).resolves.toEqual({
      results: [],
    });
    expect(emptyQuery.mock.calls.map((call) => call[1])).toEqual([
      [scope.tenantId, scope.pharmacyId, '%合成%', 3, 0],
      [scope.tenantId, scope.pharmacyId, '%合成%', 3, 0],
    ]);

    const finalRepository = new PostgresPatientRepository({
      query: vi.fn(async () => ({ rows: [patientRow] })),
    } as unknown as Pool);
    await expect(
      finalRepository.search({ ...search, limit: 1, cursor: { offset: 2 } }),
    ).resolves.toEqual({
      results: [expect.objectContaining({ patientId: patientRow.patient_id })],
    });
  });

  it('rejects an upper-bound lookahead instead of returning a cursor that cannot round-trip', async () => {
    const query = vi.fn(async () => ({ rows: [patientRow, { ...patientRow }] }));
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);

    await expect(
      repository.search({
        ...search,
        limit: 1,
        cursor: { offset: Number.MAX_SAFE_INTEGER - 1 },
      }),
    ).rejects.toEqual(new Error(patientRepositoryPaginationInvariantErrorMessage));
    expect(query).toHaveBeenCalledOnce();
  });

  it('round-trips a normal returned cursor through the same command snapshotter', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [patientRow, { ...patientRow }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new PostgresPatientRepository({ query } as unknown as Pool);

    const first = await repository.search({ ...search, limit: 1 });
    expect(first.nextCursor).toEqual({ offset: 1 });
    if (first.nextCursor === undefined) {
      throw new Error('expected a patient search cursor');
    }
    await expect(
      repository.search({ ...search, limit: 1, cursor: first.nextCursor }),
    ).resolves.toEqual({ results: [] });
    expect(query.mock.calls.map((call) => call[1])).toEqual([
      [scope.tenantId, scope.pharmacyId, '%合成%', 2, 0],
      [scope.tenantId, scope.pharmacyId, '%合成%', 2, 1],
    ]);
  });
});

const receptionInput = {
  ...scope,
  patient: {
    patientId: patientId(patientRow.patient_id),
    name: patientRow.name,
    kana: patientRow.kana,
    birthDate: patientRow.birth_date,
    sex: 'unknown' as const,
    patientNumber: patientRow.patient_number,
    eligibilityStatus: 'VERIFIED' as const,
  },
  idempotencyKey: 'patient-db-reception-4215',
  acceptedAt: new Date('2026-07-17T00:00:00.000Z'),
};

function receptionRow(storedPatientId: string) {
  return {
    stored_tenant_id: scope.tenantId,
    stored_pharmacy_id: scope.pharmacyId,
    stored_idempotency_key: receptionInput.idempotencyKey,
    stored_patient_id: storedPatientId,
    reception_id: 'reception-patient-db-4215',
    accepted_at: receptionInput.acceptedAt,
    reception_status: 'WAITING',
    ...patientRow,
    eligibility_checked_at: { toISOString: () => 'fake eligibility timestamp' },
  };
}
