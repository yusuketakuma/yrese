import { describe, expect, it, vi } from 'vitest';
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
    version: 1,
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

  it('orders supplementary-plane patient numbers by code point, matching PostgreSQL C collation', async () => {
    // JS の `<` は UTF-16 code unit 順で U+10000(lead surrogate 0xD800)を
    // U+E000 より先に並べる。PostgreSQL `COLLATE "C"`(code point 順)では
    // U+E000 が先 — parity を保つため in-memory 側も code point 順に揃える。
    const bmpPrivateUse = '\uE000'; // U+E000 — UTF-16: 0xE000
    const supplementary = '\u{10000}'; // U+10000 — UTF-16: 0xD800 0xDC00
    expect(bmpPrivateUse < supplementary).toBe(false); // code unit 順との発散を固定
    const repository = new InMemoryPatientRepository([
      syntheticRecord('patient-supplementary', `N-${supplementary}`),
      syntheticRecord('patient-bmp', `N-${bmpPrivateUse}`),
    ]);

    const page = await repository.search({ ...SCOPE, q: 'N-', limit: 2 });

    expect(page.results.map((result) => result.patientId)).toEqual([
      'patient-bmp',
      'patient-supplementary',
    ]);
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

describe('InMemoryPatientRepository write paths (WP-7202)', () => {
  const writeScope = {
    tenantId: tenantId('tenant-write-001'),
    pharmacyId: pharmacyId('pharmacy-write-001'),
  } as const;
  const fingerprint = 'a'.repeat(64);
  const key = 'write-key-0000000001';
  const baseCreateInput = {
    ...writeScope,
    patientId: patientId('patient-new-001'),
    attributes: {
      name: '登録 太郎',
      kana: 'トウロクタロウ',
      birthDate: '1985-05-05',
      sex: 'male' as const,
    },
    idempotencyKey: key,
    requestFingerprint: fingerprint,
    actorId: 'actor-write-001' as never,
    recordedAt: '2026-09-18T00:00:00.000Z',
  };

  it('creates a patient with server-allocated patientNumber, version 1, NOT_CHECKED', async () => {
    const repository = new InMemoryPatientRepository([]);
    const result = await repository.create(baseCreateInput);

    expect(result).toMatchObject({
      kind: 'created',
      patient: {
        patientId: 'patient-new-001',
        patientNumber: 'P-000001',
        eligibilityStatus: 'NOT_CHECKED',
        version: 1,
      },
      duplicateCandidates: [],
    });
  });

  it('allocates the next P-###### suffix above the scope maximum', async () => {
    const repository = new InMemoryPatientRepository([
      { ...syntheticRecord('patient-old', 'P-000009'), ...writeScope },
      // 別 scope と非 P- 番号は採番へ影響しない(Postgres MAX 方式との parity)。
      { ...syntheticRecord('patient-other', 'P-999999'), tenantId: tenantId('tenant-other') },
      { ...syntheticRecord('patient-custom', 'SYN-777'), ...writeScope },
    ]);
    const result = await repository.create(baseCreateInput);
    expect(result).toMatchObject({
      kind: 'created',
      patient: { patientNumber: 'P-000010' },
    });
  });

  it('rejects an explicit duplicate patientNumber in scope', async () => {
    const repository = new InMemoryPatientRepository([
      { ...syntheticRecord('patient-dup', 'K-001'), ...writeScope },
    ]);
    const result = await repository.create({
      ...baseCreateInput,
      attributes: { ...baseCreateInput.attributes, patientNumber: 'K-001' },
    });
    expect(result).toEqual({ kind: 'patient_number_conflict' });
    // 同一番号でも別 scope は許可される。
    const other = await repository.create({
      ...baseCreateInput,
      tenantId: tenantId('tenant-write-002'),
      attributes: { ...baseCreateInput.attributes, patientNumber: 'K-001' },
    });
    expect(other.kind).toBe('created');
  });

  it('replays an identical idempotency key as existing and conflicts on different payload', async () => {
    const repository = new InMemoryPatientRepository([]);
    const created = await repository.create(baseCreateInput);
    expect(created.kind).toBe('created');

    const replay = await repository.create({
      ...baseCreateInput,
      patientId: patientId('patient-should-not-be-minted'),
    });
    expect(replay).toEqual({
      kind: 'existing',
      patient: expect.objectContaining({ patientId: 'patient-new-001' }),
    });

    // 異なる payload は異なる fingerprint を伴う(fingerprint は route が
    // 正規化 request から算出する)。
    const conflict = await repository.create({
      ...baseCreateInput,
      attributes: { ...baseCreateInput.attributes, name: '別名 次郎' },
      requestFingerprint: 'c'.repeat(64),
    });
    expect(conflict).toEqual({ kind: 'idempotency_conflict' });
  });

  it('returns up to 5 duplicate candidates by name or birthDate in deterministic order', async () => {
    const repository = new InMemoryPatientRepository(
      Array.from({ length: 7 }, (_, i) => ({
        ...syntheticRecord(`patient-cand-${i}`, `C-${String(i).padStart(3, '0')}`),
        ...writeScope,
        birthDate: '1985-05-05',
        name: `候補${i}`,
      })),
    );
    const result = await repository.create(baseCreateInput);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.duplicateCandidates).toHaveLength(5);
    // patient_number 昇順(code point)で確定的。
    expect(result.duplicateCandidates.map((c) => c.patientNumber)).toEqual([
      'C-000',
      'C-001',
      'C-002',
      'C-003',
      'C-004',
    ]);
  });

  it('updates identity fields, increments version, and appends identity history', async () => {
    const repository = new InMemoryPatientRepository([]);
    const created = await repository.create(baseCreateInput);
    if (created.kind !== 'created') throw new Error('expected created');

    const updated = await repository.update({
      ...writeScope,
      patientId: patientId('patient-new-001'),
      expectedVersion: 1,
      attributes: { name: '登録 花子', birthDate: '1985-05-05' },
      actorId: 'actor-write-002' as never,
      recordedAt: '2026-09-18T01:00:00.000Z',
    });
    expect(updated).toMatchObject({
      kind: 'updated',
      patient: { name: '登録 花子', version: 2, patientNumber: 'P-000001' },
    });

    const history = repository.listIdentityHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      patientId: 'patient-new-001',
      version: 1,
      name: '登録 太郎',
      supersededBy: 'actor-write-002',
    });

    // 同一値の再送は identity 変更なし → history 追加なし・version は増加。
    const noChange = await repository.update({
      ...writeScope,
      patientId: patientId('patient-new-001'),
      expectedVersion: 2,
      attributes: { name: '登録 花子' },
      actorId: 'actor-write-002' as never,
      recordedAt: '2026-09-18T01:01:00.000Z',
    });
    expect(noChange).toMatchObject({ kind: 'updated', patient: { version: 3 } });
    expect(repository.listIdentityHistory()).toHaveLength(1);
  });

  it('rejects stale expectedVersion and unknown patient without mutation', async () => {
    const repository = new InMemoryPatientRepository([]);
    await repository.create(baseCreateInput);

    const stale = await repository.update({
      ...writeScope,
      patientId: patientId('patient-new-001'),
      expectedVersion: 99,
      attributes: { name: 'x' },
      actorId: 'a' as never,
      recordedAt: '2026-09-18T02:00:00.000Z',
    });
    expect(stale).toEqual({ kind: 'version_conflict', currentVersion: 1 });

    const missing = await repository.update({
      ...writeScope,
      patientId: patientId('patient-missing'),
      expectedVersion: 1,
      attributes: { name: 'x' },
      actorId: 'a' as never,
      recordedAt: '2026-09-18T02:00:00.000Z',
    });
    expect(missing).toEqual({ kind: 'not_found' });
    // 別 tenant の同名 patientId も not_found(cross-scope 非開示)。
    const crossScope = await repository.update({
      tenantId: tenantId('tenant-other'),
      pharmacyId: writeScope.pharmacyId,
      patientId: patientId('patient-new-001'),
      expectedVersion: 1,
      attributes: { name: 'x' },
      actorId: 'a' as never,
      recordedAt: '2026-09-18T02:00:00.000Z',
    });
    expect(crossScope).toEqual({ kind: 'not_found' });
  });

  it('rolls back a created patient and its idempotency record on audit failure', async () => {
    const repository = new InMemoryPatientRepository([]);
    const created = await repository.create(baseCreateInput);
    if (created.kind !== 'created') throw new Error('expected created');

    repository.rollbackCreated(created.undo);

    await expect(
      repository.findVersionedById({ ...writeScope, patientId: patientId('patient-new-001') }),
    ).resolves.toBeUndefined();
    // idempotency 記録も除去され、同じ key で別 payload が再作成できる。
    const retry = await repository.create({
      ...baseCreateInput,
      patientId: patientId('patient-retry-001'),
      requestFingerprint: 'b'.repeat(64),
    });
    expect(retry.kind).toBe('created');
  });

  it('rolls back an update and pops the appended identity history', async () => {
    const repository = new InMemoryPatientRepository([]);
    await repository.create(baseCreateInput);
    const updated = await repository.update({
      ...writeScope,
      patientId: patientId('patient-new-001'),
      expectedVersion: 1,
      attributes: { kana: 'ヘンコウカナ' },
      actorId: 'a' as never,
      recordedAt: '2026-09-18T03:00:00.000Z',
    });
    if (updated.kind !== 'updated') throw new Error('expected updated');
    expect(repository.listIdentityHistory()).toHaveLength(1);

    repository.rollbackUpdate(updated.undo);

    const restored = await repository.findVersionedById({
      ...writeScope,
      patientId: patientId('patient-new-001'),
    });
    expect(restored).toMatchObject({ kana: 'トウロクタロウ', version: 1 });
    expect(repository.listIdentityHistory()).toHaveLength(0);
  });

  it('rejects hostile create/update inputs before scanning records', async () => {
    const recordsRead = vi.fn(() => {
      throw new Error('patient records must remain unread');
    });
    const hostileRecords = new Proxy([] as never[], {
      get(_t, p) {
        if (p === Symbol.iterator || p === 'length' || p === 'slice') {
          return recordsRead();
        }
        return undefined;
      },
    });
    const repository = new InMemoryPatientRepository(hostileRecords as never);

    await expect(
      repository.create({ ...baseCreateInput, attributes: { get name() { throw new Error('x'); } } as never }),
    ).rejects.toThrow(patientRepositoryCommandSnapshotInvariantErrorMessage);
    await expect(
      repository.update({ ...writeScope, patientId: patientId('p'), expectedVersion: 1, attributes: null as never, actorId: 'a' as never, recordedAt: '2026-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(patientRepositoryCommandSnapshotInvariantErrorMessage);
    expect(recordsRead).not.toHaveBeenCalled();
  });
});
