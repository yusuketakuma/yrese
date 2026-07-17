import { describe, expect, it } from 'vitest';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import { InMemoryPatientRepository } from './patient-repository.js';
import {
  patientRepositoryCommandSnapshotInvariantErrorMessage,
  patientRepositoryPaginationInvariantErrorMessage,
  snapshotPatientNextCursor,
} from './patient-repository.js';

const SCOPE = {
  tenantId: tenantId('tenant-order-test'),
  pharmacyId: pharmacyId('pharmacy-order-test'),
} as const;

function syntheticRecord(
  id: string,
  patientNumber: string,
  scope: { tenantId: ReturnType<typeof tenantId>; pharmacyId: ReturnType<typeof pharmacyId> } = SCOPE,
) {
  return {
    ...scope,
    patientId: patientId(id),
    name: `合成検索対象${id}`,
    kana: `ゴウセイケンサクタイショウ${id}`,
    birthDate: '1980-01-01',
    sex: 'unknown' as const,
    patientNumber,
    eligibilityStatus: 'NOT_CHECKED' as const,
  };
}

describe('InMemoryPatientRepository search ordering', () => {
  it('orders filtered synthetic ASCII records before pagination without mutating fixtures', async () => {
    const b = syntheticRecord('patient-b', 'B-002');
    const a = syntheticRecord('patient-a', 'A-001');
    const c = syntheticRecord('patient-c', 'C-003');
    const otherTenant = syntheticRecord('patient-other-tenant', '0-000', {
      tenantId: tenantId('tenant-other'),
      pharmacyId: SCOPE.pharmacyId,
    });
    const otherPharmacy = syntheticRecord('patient-other-pharmacy', '0-000', {
      tenantId: SCOPE.tenantId,
      pharmacyId: pharmacyId('pharmacy-other'),
    });
    const records = [b, otherTenant, c, otherPharmacy, a];
    const originalOrder = records.map((record) => record.patientId);
    const repository = new InMemoryPatientRepository(records);

    const first = await repository.search({ ...SCOPE, q: '合成検索対象', limit: 2 });
    const nextCursor = first.nextCursor;
    expect(nextCursor).toEqual({ offset: 2 });
    if (nextCursor === undefined) {
      throw new Error('expected a second page cursor');
    }
    const second = await repository.search({
      ...SCOPE,
      q: '合成検索対象',
      limit: 2,
      cursor: nextCursor,
    });

    expect(first.results.map((result) => result.patientId)).toEqual(['patient-a', 'patient-b']);
    expect(second.results.map((result) => result.patientId)).toEqual(['patient-c']);
    expect(second.nextCursor).toBeUndefined();
    expect([...first.results, ...second.results].map((result) => result.patientId)).toEqual([
      'patient-a',
      'patient-b',
      'patient-c',
    ]);
    expect(records.map((record) => record.patientId)).toEqual(originalOrder);
  });

  it('returns identical pages for different insertion orders of the same records', async () => {
    const records = [
      syntheticRecord('patient-c', 'C-003'),
      syntheticRecord('patient-a', 'A-001'),
      syntheticRecord('patient-b', 'B-002'),
    ];
    const firstRepository = new InMemoryPatientRepository(records);
    const secondRepository = new InMemoryPatientRepository([...records].reverse());

    const search = async (repository: InMemoryPatientRepository) => {
      const page = await repository.search({ ...SCOPE, q: '合成検索対象', limit: 2 });
      return page.results.map((result) => result.patientId);
    };

    expect(await search(firstRepository)).toEqual(['patient-a', 'patient-b']);
    expect(await search(secondRepository)).toEqual(['patient-a', 'patient-b']);
  });

  it('uses patientId as a defensive tie-break for invalid duplicate patient numbers', async () => {
    // DOM-002 forbids duplicate patient numbers in one scope; this corrupt-fixture case
    // keeps pagination deterministic if an invalid adapter fixture crosses that boundary.
    const repository = new InMemoryPatientRepository([
      syntheticRecord('patient-z', 'A-001'),
      syntheticRecord('patient-a', 'A-001'),
    ]);

    const page = await repository.search({ ...SCOPE, q: 'A-001', limit: 2 });

    expect(page.results.map((result) => result.patientId)).toEqual(['patient-a', 'patient-z']);
  });
});

describe('InMemoryPatientRepository command authority', () => {
  const lookup = { ...SCOPE, patientId: patientId('patient-a') } as const;
  const search = { ...SCOPE, q: '  合成検索対象  ', limit: 2 } as const;

  function repositoryWithHostileRecords() {
    let recordReads = 0;
    const records = new Proxy([], {
      get() {
        recordReads += 1;
        throw new Error('patient records must remain unread');
      },
    });
    return {
      repository: new InMemoryPatientRepository(records as never),
      recordReads: () => recordReads,
    };
  }

  async function expectInvalidWithoutScan(
    operation: 'lookup' | 'search',
    input: unknown,
  ): Promise<void> {
    const { repository, recordReads } = repositoryWithHostileRecords();
    const promise =
      operation === 'lookup'
        ? repository.findById(input as never)
        : repository.search(input as never);
    await expect(promise).rejects.toEqual(
      new Error(patientRepositoryCommandSnapshotInvariantErrorMessage),
    );
    expect(recordReads()).toBe(0);
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
          throw new Error('raw patient command secret');
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
    'rejects %s %s missing, inherited, and accessor authority before scanning',
    async (operation, valid, property) => {
      let accessorReads = 0;
      for (const kind of ['missing', 'inherited', 'accessor'] as const) {
        await expectInvalidWithoutScan(
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
    'rejects hostile and revoked %s roots without invoking traps or scanning',
    async (operation) => {
      let traps = 0;
      const valid = operation === 'lookup' ? lookup : search;
      const hostile = new Proxy(valid, {
        get() {
          traps += 1;
          throw new Error('raw patient command Proxy secret');
        },
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error('raw patient command descriptor secret');
        },
      });
      const revoked = Proxy.revocable(valid, {});
      revoked.revoke();

      await expectInvalidWithoutScan(operation, hostile);
      await expectInvalidWithoutScan(operation, revoked.proxy);
      expect(traps).toBe(0);
    },
  );

  it('rejects invalid lookup and search primitives with one fixed non-echo error before scanning', async () => {
    const cases: readonly [operation: 'lookup' | 'search', input: object][] = [
      ['lookup', { ...lookup, tenantId: '' }],
      ['lookup', { ...lookup, pharmacyId: '\u0000' }],
      ['lookup', { ...lookup, patientId: '' }],
      ['lookup', { ...lookup, patientId: new String('patient-a') }],
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
      await expectInvalidWithoutScan(operation, input);
    }
  });

  it('rejects missing, inherited, accessor, Proxy, and revoked cursor authority before scanning', async () => {
    let accessorReads = 0;
    let proxyTraps = 0;
    const missing = {};
    const inherited = Object.create({ offset: 0 });
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
          throw new Error('raw patient cursor Proxy secret');
        },
      },
    );
    const revoked = Proxy.revocable({ offset: 0 }, {});
    revoked.revoke();

    for (const cursor of [missing, inherited, accessor, proxied, revoked.proxy]) {
      await expectInvalidWithoutScan('search', { ...search, cursor });
    }
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('accepts absent, explicit undefined, empty, and final-page cursors with canonical trimming', async () => {
    const repository = new InMemoryPatientRepository([
      syntheticRecord('patient-b', 'B-002'),
      syntheticRecord('patient-a', 'A-001'),
    ]);

    await expect(repository.findById({ ...SCOPE, patientId: patientId('patient-a') })).resolves
      .toMatchObject({ patientId: 'patient-a' });
    await expect(repository.search(search)).resolves.toMatchObject({
      results: [{ patientId: 'patient-a' }, { patientId: 'patient-b' }],
    });
    await expect(
      repository.search({ ...search, cursor: undefined } as never),
    ).resolves.toMatchObject({
      results: [{ patientId: 'patient-a' }, { patientId: 'patient-b' }],
    });
    await expect(repository.search({ ...search, cursor: { offset: 2 } })).resolves.toEqual({
      results: [],
    });
  });

  it('keeps a no-lookahead boundary cursor terminal and rejects an unusable lookahead cursor', () => {
    const limit = 1;
    const offset = Number.MAX_SAFE_INTEGER - limit;

    expect(snapshotPatientNextCursor({ limit, offset }, false)).toBeUndefined();
    expect(() => snapshotPatientNextCursor({ limit, offset }, true)).toThrow(
      patientRepositoryPaginationInvariantErrorMessage,
    );
  });

  it('snapshots stateful command values once before scanning records', async () => {
    const mutableLookup = { ...lookup };
    const mutableSearch = { ...search, cursor: { offset: 0 } };
    const record = syntheticRecord('patient-a', 'A-001');
    const statefulRecord = { ...record } as typeof record;
    Object.defineProperty(statefulRecord, 'tenantId', {
      get() {
        mutableLookup.tenantId = tenantId('tenant-mutated');
        mutableSearch.tenantId = tenantId('tenant-mutated');
        mutableSearch.cursor.offset = 999;
        return SCOPE.tenantId;
      },
    });
    const repository = new InMemoryPatientRepository([statefulRecord]);

    await expect(repository.findById(mutableLookup)).resolves.toMatchObject({ patientId: 'patient-a' });
    mutableSearch.tenantId = SCOPE.tenantId;
    mutableSearch.cursor.offset = 0;
    await expect(repository.search(mutableSearch)).resolves.toMatchObject({
      results: [{ patientId: 'patient-a' }],
    });
  });
});
