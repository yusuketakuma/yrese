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
} from '../../patient/patient-repository.js';
import { PostgresReceptionRepository } from '../reception/reception-repository.js';


import {
  scope,
  patientRow,
  patientCoreColumns,
  rowWithEligibility,
} from './patient-repository-test-support.js';

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
