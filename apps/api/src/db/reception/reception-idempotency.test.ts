import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import {
  RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH,
  RECEPTION_QUEUE_MAX_ENTRIES,
  type PatientSearchResult,
} from '@yrese/contracts';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  businessDateFromAcceptedAt,
  InMemoryReceptionRepository,
  inMemoryReceptionCommandSnapshotInvariantErrorMessage,
  inMemoryReceptionIdempotencyInvariantErrorMessage,
  inMemoryReceptionPatientSnapshotInvariantErrorMessage,
  inMemoryReceptionTimestampInvariantErrorMessage,
  receptionListCommandSnapshotInvariantErrorMessage,
} from '../../reception/reception-repository.js';
import {
  PostgresReceptionRepository,
  databaseReceptionCommandSnapshotInvariantErrorMessage,
  databaseReceptionCommandProvenanceInvariantErrorMessage,
  databaseReceptionCreatedAcceptedAtInvariantErrorMessage,
  databaseReceptionCreatedPatientSnapshotInvariantErrorMessage,
  databaseReceptionCreatedStatusInvariantErrorMessage,
  databaseReceptionEntryIdentityInvariantErrorMessage,
  databaseReceptionProvenanceInvariantErrorMessage,
  databaseReceptionRowInvariantErrorMessage,
  databaseReceptionRowSetInvariantErrorMessage,
  databaseReceptionTimestampInvariantErrorMessage,
} from './reception-repository.js';
import {
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from '../database-row.js';

import {
  patient,
  input,
  listInput,
  invalidReceptionScopeValues,
  commandWithInvalidAuthority,
  storedRow,
  createdRowFromInsertValues,
  createRepository,
  createRepositoryWithQueryResults,
  captureRejection,
  queryLabels,
  provenanceColumns,
  replaceAcceptedAtAuthority,
} from './reception-repository-test-support.js';
import type {
  ReceptionCommandField,
  InvalidCommandAuthority,
  Scenario,
  InvalidAcceptedAtAuthority,
  ProvenanceColumn,
} from './reception-repository-test-support.js';

describe('InMemoryReceptionRepository idempotency index integrity', () => {
  it.each([
    'tenantId',
    'pharmacyId',
    'idempotencyKey',
    'patient',
    'acceptedAt',
  ] as const)('requires own data authority for outer command field %s without mutation', async (field) => {
    let accessorReads = 0;
    for (const authority of ['missing', 'inherited', 'accessor'] as const) {
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };
      const command = commandWithInvalidAuthority(field, authority, () => {
        accessorReads += 1;
      });

      await expect(repository.create(command)).rejects.toThrow(
        inMemoryReceptionCommandSnapshotInvariantErrorMessage,
      );
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    }
    expect(accessorReads).toBe(0);
  });

  it('rejects root and revoked command Proxies without traps or mutation', async () => {
    let proxyTraps = 0;
    const hostile = new Proxy(
      { ...input },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw in-memory command Proxy secret 4225');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw in-memory command descriptor secret 4225');
        },
      },
    );
    const revoked = Proxy.revocable({ ...input }, {});
    revoked.revoke();

    for (const invalidCommand of [hostile, revoked.proxy]) {
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };
      await expect(repository.create(invalidCommand)).rejects.toThrow(
        inMemoryReceptionCommandSnapshotInvariantErrorMessage,
      );
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    }
    expect(proxyTraps).toBe(0);
  });

  it('accepts non-default own data descriptors for every outer command field', async () => {
    const command = {} as typeof input;
    for (const field of Object.keys(input) as ReceptionCommandField[]) {
      Object.defineProperty(command, field, {
        value: input[field],
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
    const repository = new InMemoryReceptionRepository();

    await expect(repository.create(command)).resolves.toMatchObject({ kind: 'created' });
  });

  it('reads patient identity before tenant and leaves later outer fields unread', async () => {
    let laterReads = 0;
    const command = { ...input, patient: { ...patient, patientId: 0 } } as Record<
      string,
      unknown
    >;
    for (const field of ['tenantId', 'pharmacyId', 'idempotencyKey', 'acceptedAt'] as const) {
      Object.defineProperty(command, field, {
        get() {
          laterReads += 1;
          throw new Error('outer field after patient identity must remain unread');
        },
      });
    }
    const repository = new InMemoryReceptionRepository();

    await expect(repository.create(command as typeof input)).rejects.toThrow(
      inMemoryReceptionPatientSnapshotInvariantErrorMessage,
    );
    expect(laterReads).toBe(0);
  });

  it.each([
    ['tenantId', ['pharmacyId', 'idempotencyKey', 'acceptedAt']],
    ['pharmacyId', ['idempotencyKey', 'acceptedAt']],
    ['idempotencyKey', ['acceptedAt']],
  ] as const)(
    'stops InMemory command reads at invalid %s after patient identity without mutation',
    async (invalidField, unreadOuterFields) => {
      let laterReads = 0;
      const patientWithUnreadNonIdentity = { ...patient };
      Object.defineProperty(patientWithUnreadNonIdentity, 'name', {
        get() {
          laterReads += 1;
          throw new Error('non-identity patient field must remain unread');
        },
      });
      const command = {
        ...input,
        patient: patientWithUnreadNonIdentity,
      } as Record<string, unknown>;
      Object.defineProperty(command, invalidField, { value: '   ' });
      for (const field of unreadOuterFields) {
        Object.defineProperty(command, field, {
          get() {
            laterReads += 1;
            throw new Error('later InMemory command field must remain unread');
          },
        });
      }
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };

      await expect(repository.create(command as typeof input)).rejects.toThrow(
        inMemoryReceptionCommandSnapshotInvariantErrorMessage,
      );
      expect(laterReads).toBe(0);
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    },
  );

  it.each(invalidReceptionScopeValues)(
    'rejects invalid command scope %s=%j without mutation',
    async (field, value) => {
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };

      await expect(repository.create({ ...input, [field]: value })).rejects.toThrow(
        inMemoryReceptionCommandSnapshotInvariantErrorMessage,
      );
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    },
  );

  it('stores a detached patient snapshot across caller mutation, list, and existing replay', async () => {
    const repository = new InMemoryReceptionRepository();
    const mutablePatient: PatientSearchResult = {
      ...patient,
      eligibilityCheckedAt: '2026-07-13T00:00:00.000Z',
    };
    const created = await repository.create({ ...input, patient: mutablePatient });
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') throw new Error('expected a created reception');

    mutablePatient.patientId = patientId('patient-mutated-after-create-4223');
    mutablePatient.name = '作成後に変更された合成患者';
    mutablePatient.kana = 'サクセイゴニヘンコウサレタゴウセイカンジャ';
    mutablePatient.birthDate = '1999-12-31';
    mutablePatient.sex = 'female';
    mutablePatient.patientNumber = 'MUTATED-4223';
    mutablePatient.eligibilityStatus = 'VERIFIED';
    mutablePatient.eligibilityCheckedAt = '2026-07-13T00:00:00.001Z';

    const listed = await repository.list({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      date: '2026-07-13',
    });
    const existing = await repository.create({
      ...input,
      patient: {
        ...mutablePatient,
        patientId: patient.patientId,
      },
    });

    expect(listed).toContainEqual(created.entry);
    expect(existing).toEqual({
      kind: 'existing',
      entry: created.entry,
      provenance: created.provenance,
    });
    expect(existing.kind === 'existing' && existing.entry.patient).toEqual({
      ...patient,
      eligibilityCheckedAt: '2026-07-13T00:00:00.000Z',
    });
    expect(existing.provenance.patientId).toBe(patient.patientId);

    const conflict = await repository.create({ ...input, patient: mutablePatient });
    expect(conflict).toEqual({
      kind: 'idempotency_conflict',
      provenance: created.provenance,
    });
  });

  it('keeps optional eligibility timestamp presence detached from caller changes', async () => {
    const repository = new InMemoryReceptionRepository();
    const mutablePatient: Record<string, unknown> = { ...patient };
    const created = await repository.create({
      ...input,
      patient: mutablePatient as typeof patient,
    });
    delete mutablePatient.eligibilityCheckedAt;
    mutablePatient.eligibilityCheckedAt = '2026-07-13T00:00:00.000Z';

    const existing = await repository.create(input);
    expect(existing.kind).toBe('existing');
    if (existing.kind !== 'existing') throw new Error('expected an existing reception');
    expect(Object.hasOwn(existing.entry.patient, 'eligibilityCheckedAt')).toBe(false);
    expect(existing.entry.patient.eligibilityCheckedAt).toBeUndefined();
    expect(created.kind === 'created' && created.entry).toEqual(existing.entry);

    const explicitUndefinedRepository = new InMemoryReceptionRepository();
    const explicitUndefinedPatient = { ...patient, eligibilityCheckedAt: undefined };
    const explicitUndefined = await explicitUndefinedRepository.create({
      ...input,
      patient: explicitUndefinedPatient,
    });
    expect(explicitUndefined.kind).toBe('created');
    if (explicitUndefined.kind !== 'created') throw new Error('expected a created reception');
    expect(Object.hasOwn(explicitUndefined.entry.patient, 'eligibilityCheckedAt')).toBe(true);
    expect(explicitUndefined.entry.patient.eligibilityCheckedAt).toBeUndefined();
  });

  it('does not retain mutable created or list result projections', async () => {
    const repository = new InMemoryReceptionRepository();
    const created = await repository.create(input);
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') throw new Error('expected a created reception');
    (created.entry.patient as { name: string }).name = '変更された返却患者';

    const listed = await repository.list({
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      date: '2026-07-13',
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.patient.name).toBe(patient.name);
    (listed[0]?.patient as { name: string }).name = '変更された一覧患者';

    const existing = await repository.create(input);
    expect(existing.kind).toBe('existing');
    if (existing.kind !== 'existing') throw new Error('expected an existing reception');
    expect(existing.entry.patient.name).toBe(patient.name);
  });

  it.each([
    ['name', undefined],
    ['kana', undefined],
    ['birthDate', '2026-02-30'],
    ['sex', 'invalid'],
    ['patientNumber', ''],
    ['eligibilityStatus', 'invalid'],
    ['eligibilityCheckedAt', 'not-an-instant'],
  ] as const)('rejects an invalid new patient snapshot in %s without mutation', async (field, value) => {
    const repository = new InMemoryReceptionRepository();
    const internals = repository as unknown as {
      readonly records: unknown[];
      readonly idempotencyRecords: Map<string, unknown>;
      readonly nextSequence: number;
    };
    const initialRecordCount = internals.records.length;

    await expect(
      repository.create({
        ...input,
        patient: { ...patient, [field]: value },
      }),
    ).rejects.toThrow(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
    expect(internals.records).toHaveLength(initialRecordCount);
    expect(internals.idempotencyRecords.size).toBe(0);
    expect(internals.nextSequence).toBe(4);

    const created = await repository.create(input);
    expect(created.kind === 'created' && created.entry.receptionId).toBe('reception-000004');
  });

  it('rejects inherited, accessor, Proxy, and stateful patient authority without mutation', async () => {
    let accessorReads = 0;
    let proxyTraps = 0;
    const inherited = Object.assign(Object.create({ name: patient.name }), patient);
    delete inherited.name;
    const accessor = { ...patient };
    Object.defineProperty(accessor, 'name', {
      get() {
        accessorReads += 1;
        throw new Error('raw in-memory patient PHI accessor secret 4223');
      },
    });
    const statefulIdentity = { ...patient };
    Object.defineProperty(statefulIdentity, 'patientId', {
      get() {
        accessorReads += 1;
        return accessorReads === 1 ? patient.patientId : patientId('patient-stateful-4223');
      },
    });
    const proxied = new Proxy(
      { ...patient },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw in-memory patient Proxy PHI secret 4223');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw in-memory patient descriptor PHI secret 4223');
        },
      },
    );

    for (const invalidPatient of [inherited, accessor, statefulIdentity, proxied]) {
      const repository = new InMemoryReceptionRepository();
      await expect(
        repository.create({ ...input, patient: invalidPatient }),
      ).rejects.toThrow(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    }
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('validates acceptedAt before reading non-identity patient fields for a new create', async () => {
    let patientNameReads = 0;
    const patientWithUnreadName = { ...patient };
    Object.defineProperty(patientWithUnreadName, 'name', {
      get() {
        patientNameReads += 1;
        throw new Error('patient name must remain unread after invalid acceptedAt');
      },
    });
    const repository = new InMemoryReceptionRepository();

    await expect(
      repository.create({
        ...input,
        patient: patientWithUnreadName,
        acceptedAt: new Date(Number.NaN),
      }),
    ).rejects.toThrow(inMemoryReceptionTimestampInvariantErrorMessage);
    expect(patientNameReads).toBe(0);
  });

  it('rejects an acceptedAt command accessor for new create without invoking it', async () => {
    let acceptedAtReads = 0;
    const command = { ...input };
    Object.defineProperty(command, 'acceptedAt', {
      get() {
        acceptedAtReads += 1;
        throw new Error('raw in-memory acceptedAt command secret 4223');
      },
    });
    const repository = new InMemoryReceptionRepository();
    const internals = repository as unknown as {
      readonly records: unknown[];
      readonly idempotencyRecords: Map<string, unknown>;
      readonly nextSequence: number;
    };

    await expect(repository.create(command)).rejects.toThrow(
      inMemoryReceptionCommandSnapshotInvariantErrorMessage,
    );
    expect(acceptedAtReads).toBe(0);
    expect(internals.records).toHaveLength(3);
    expect(internals.idempotencyRecords.size).toBe(0);
    expect(internals.nextSequence).toBe(4);
  });

  it('keeps an acceptedAt command accessor unread for existing and conflict', async () => {
    const repository = new InMemoryReceptionRepository();
    const created = await repository.create(input);
    let acceptedAtReads = 0;
    const withUnreadAcceptedAt = (patientValue: PatientSearchResult) => {
      const command = { ...input, patient: patientValue };
      Object.defineProperty(command, 'acceptedAt', {
        get() {
          acceptedAtReads += 1;
          throw new Error('existing and conflict must not read acceptedAt command');
        },
      });
      return command;
    };

    const existing = await repository.create(withUnreadAcceptedAt(patient));
    const conflict = await repository.create(
      withUnreadAcceptedAt({
        ...patient,
        patientId: patientId('patient-accepted-at-command-conflict-4223'),
      }),
    );

    expect(existing.kind).toBe('existing');
    expect(conflict).toEqual({
      kind: 'idempotency_conflict',
      provenance: created.provenance,
    });
    expect(acceptedAtReads).toBe(0);
  });

  it('keeps non-identity patient fields unread for existing and conflict results', async () => {
    const repository = new InMemoryReceptionRepository();
    const created = await repository.create(input);
    let nonIdentityReads = 0;
    const replayPatient = { ...patient };
    Object.defineProperty(replayPatient, 'name', {
      get() {
        nonIdentityReads += 1;
        throw new Error('existing patient field must stay unread');
      },
    });

    const existing = await repository.create({ ...input, patient: replayPatient });
    const conflictPatient = {
      ...patient,
      patientId: patientId('patient-conflict-unread-4223'),
    };
    Object.defineProperty(conflictPatient, 'name', {
      get() {
        nonIdentityReads += 1;
        throw new Error('conflict patient field must stay unread');
      },
    });
    const conflict = await repository.create({ ...input, patient: conflictPatient });

    expect(existing.kind).toBe('existing');
    expect(conflict).toEqual({
      kind: 'idempotency_conflict',
      provenance: created.provenance,
    });
    expect(nonIdentityReads).toBe(0);
  });

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

  it.each([
    ['0001-01-01T00:00:00.000Z', '0001-01-01'],
    ['0099-12-31T14:59:59.999Z', '0099-12-31'],
    ['0099-12-31T15:00:00.000Z', '0100-01-01'],
    ['9999-12-31T14:59:59.999Z', '9999-12-31'],
  ] as const)(
    'stores and lists the canonical in-memory JST date %s -> %s',
    async (instant, expectedDate) => {
      const repository = new InMemoryReceptionRepository();
      const result = await repository.create({
        ...input,
        idempotencyKey: `in-memory-canonical-date-${instant}`,
        acceptedAt: new Date(instant),
      });

      expect(result.kind).toBe('created');
      if (result.kind !== 'created') throw new Error('expected a created reception');
      await expect(
        repository.list({ ...listInput, date: expectedDate }),
      ).resolves.toContainEqual(result.entry);
    },
  );

  it.each([
    ['local BCE', '0000-01-01T00:00:00.000Z'],
    ['JST year 10000', '9999-12-31T15:00:00.000Z'],
  ] as const)(
    'rejects %s before mutating in-memory reception state',
    async (_label, instant) => {
      const repository = new InMemoryReceptionRepository();
      const internals = repository as unknown as {
        readonly records: unknown[];
        readonly idempotencyRecords: Map<string, unknown>;
        readonly nextSequence: number;
      };

      await expect(
        repository.create({ ...input, acceptedAt: new Date(instant) }),
      ).rejects.toThrow(inMemoryReceptionTimestampInvariantErrorMessage);
      expect(internals.records).toHaveLength(3);
      expect(internals.idempotencyRecords.size).toBe(0);
      expect(internals.nextSequence).toBe(4);
    },
  );

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
