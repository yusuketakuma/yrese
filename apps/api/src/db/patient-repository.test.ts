import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  PostgresPatientRepository,
  databasePatientEligibilityTimestampInvariantErrorMessage,
  databasePatientRowInvariantErrorMessage,
  patientRowToSearchResult,
} from './patient-repository.js';
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
      const query = vi.fn(async (sql: string) => {
        const normalized = sql.trim();
        if (normalized.startsWith('INSERT')) {
          return { rows: scenario === 'created' ? [receptionRow('patient-db-4215')] : [] };
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
      const query = vi.fn(async (sql: string) => {
        const normalized = sql.trim();
        if (normalized.startsWith('INSERT')) {
          return { rows: scenario === 'created' ? [storedReceptionRow] : [] };
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
