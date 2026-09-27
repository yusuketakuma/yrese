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
} from '../reception/reception-repository.js';
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
} from './database-row.js';

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

describe('Reception list command authority parity', () => {
  async function expectInvalidListWithoutAccess(command: unknown): Promise<void> {
    let recordReads = 0;
    const records = new Proxy([], {
      get() {
        recordReads += 1;
        throw new Error('reception records must remain unread');
      },
    });
    const inMemoryRepository = new InMemoryReceptionRepository();
    Object.defineProperty(inMemoryRepository, 'records', { value: records });

    await expect(inMemoryRepository.list(command as never)).rejects.toEqual(
      new Error(receptionListCommandSnapshotInvariantErrorMessage),
    );
    expect(recordReads).toBe(0);

    const query = vi.fn(
      async (_sql: string, _values?: readonly unknown[]) => ({ rows: [] }),
    );
    const postgresRepository = new PostgresReceptionRepository({
      query,
    } as unknown as Pool);
    await expect(postgresRepository.list(command as never)).rejects.toEqual(
      new Error(receptionListCommandSnapshotInvariantErrorMessage),
    );
    expect(query).not.toHaveBeenCalled();
  }

  function listCommandWithInvalidAuthority(
    property: keyof typeof listInput,
    authority: InvalidCommandAuthority,
    onAccessorRead: () => void,
  ): object {
    const command: Record<string, unknown> = { ...listInput };
    const value = command[property];
    delete command[property];
    if (authority === 'inherited') {
      Object.setPrototypeOf(command, { [property]: value });
    } else if (authority === 'accessor') {
      Object.defineProperty(command, property, {
        get() {
          onAccessorRead();
          throw new Error('raw reception list command secret');
        },
      });
    }
    return command;
  }

  it.each(['tenantId', 'pharmacyId', 'date'] as const)(
    'requires own data authority for %s before either provider accesses data',
    async (property) => {
      let accessorReads = 0;
      for (const authority of ['missing', 'inherited', 'accessor'] as const) {
        await expectInvalidListWithoutAccess(
          listCommandWithInvalidAuthority(property, authority, () => {
            accessorReads += 1;
          }),
        );
      }
      expect(accessorReads).toBe(0);
    },
  );

  it('rejects hostile roots without invoking traps or accessing either provider', async () => {
    let proxyTraps = 0;
    const hostile = new Proxy(listInput, {
      get() {
        proxyTraps += 1;
        throw new Error('raw reception list root secret');
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error('raw reception list root descriptor secret');
      },
    });
    const revoked = Proxy.revocable(listInput, {});
    revoked.revoke();

    for (const command of [null, 1, hostile, revoked.proxy]) {
      await expectInvalidListWithoutAccess(command);
    }
    expect(proxyTraps).toBe(0);
  });

  it('rejects invalid primitive semantics with one fixed error before data access', async () => {
    const invalidCommands: readonly object[] = [
      { ...listInput, tenantId: undefined },
      { ...listInput, tenantId: null },
      { ...listInput, tenantId: '' },
      { ...listInput, tenantId: 'tenant\u0000invalid' },
      { ...listInput, tenantId: new String(listInput.tenantId) },
      { ...listInput, pharmacyId: undefined },
      { ...listInput, pharmacyId: null },
      { ...listInput, pharmacyId: '' },
      { ...listInput, pharmacyId: 'pharmacy\u007finvalid' },
      { ...listInput, pharmacyId: new String(listInput.pharmacyId) },
      { ...listInput, date: undefined },
      { ...listInput, date: null },
      { ...listInput, date: '' },
      { ...listInput, date: '2026-02-31' },
      { ...listInput, date: '20260713' },
      { ...listInput, date: '2026-07-13\u0000' },
      { ...listInput, date: '2'.repeat(1024) },
      { ...listInput, date: new String(listInput.date) },
    ];

    for (const command of invalidCommands) {
      await expectInvalidListWithoutAccess(command);
    }
  });

  it('accepts non-default own data descriptor flags for every list field', async () => {
    const command = {};
    for (const [property, value] of Object.entries(listInput)) {
      Object.defineProperty(command, property, {
        value,
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }

    const inMemoryRepository = new InMemoryReceptionRepository();
    await expect(inMemoryRepository.list(command as never)).resolves.toEqual([]);

    const query = vi.fn(
      async (_sql: string, _values?: readonly unknown[]) => ({ rows: [] }),
    );
    const postgresRepository = new PostgresReceptionRepository({
      query,
    } as unknown as Pool);
    await expect(postgresRepository.list(command as never)).resolves.toEqual([]);
    expect(query.mock.calls[0]?.[1]).toEqual([
      listInput.tenantId,
      listInput.pharmacyId,
      listInput.date,
      RECEPTION_QUEUE_MAX_ENTRIES + 1,
    ]);
  });

  it('requires the exact tenant, pharmacy, and date tuple in a mixed in-memory collection', async () => {
    const makeRecord = (
      receptionIdValue: string,
      tenantIdValue: string,
      pharmacyIdValue: string,
      date: string,
    ) => ({
      tenantId: tenantId(tenantIdValue),
      pharmacyId: pharmacyId(pharmacyIdValue),
      receptionId: receptionIdValue,
      patientId: patient.patientId,
      patient,
      acceptedAt: `${date}T01:00:00.000Z`,
      date,
      receptionStatus: 'WAITING',
      version: 1,
      statusChangedAt: `${date}T01:00:00.000Z`,
    });
    const repository = new InMemoryReceptionRepository();
    Object.defineProperty(repository, 'records', {
      value: [
        makeRecord(
          'reception-list-target-4228',
          listInput.tenantId,
          listInput.pharmacyId,
          listInput.date,
        ),
        makeRecord(
          'reception-list-other-pharmacy-4228',
          listInput.tenantId,
          'pharmacy-other-4228',
          listInput.date,
        ),
        makeRecord(
          'reception-list-other-tenant-4228',
          'tenant-other-4228',
          listInput.pharmacyId,
          listInput.date,
        ),
        makeRecord(
          'reception-list-sibling-date-4228',
          listInput.tenantId,
          listInput.pharmacyId,
          '2026-07-14',
        ),
      ],
    });

    const entries = await repository.list(listInput);
    expect(entries.map((entry) => entry.receptionId)).toEqual([
      'reception-list-target-4228',
    ]);
  });

  it('uses one detached command for every in-memory record comparison', async () => {
    const command = { ...listInput };
    const record = {
      pharmacyId: listInput.pharmacyId,
      receptionId: 'reception-list-command-4228',
      patientId: patient.patientId,
      patient,
      acceptedAt: '2026-07-13T01:00:00.000Z',
      date: listInput.date,
      receptionStatus: 'WAITING',
      version: 1,
      statusChangedAt: '2026-07-13T01:00:00.000Z',
    } as Record<string, unknown>;
    Object.defineProperty(record, 'tenantId', {
      get() {
        command.tenantId = tenantId('tenant-mutated');
        command.pharmacyId = pharmacyId('pharmacy-mutated');
        command.date = '2026-07-14';
        return listInput.tenantId;
      },
    });
    const repository = new InMemoryReceptionRepository();
    Object.defineProperty(repository, 'records', { value: [record] });

    await expect(repository.list(command)).resolves.toEqual([
      expect.objectContaining({ receptionId: 'reception-list-command-4228' }),
    ]);
  });

  it('uses detached PostgreSQL parameters in the existing order', async () => {
    const command = { ...listInput };
    const query = vi.fn(async (_sql: string, values?: readonly unknown[]) => {
      command.tenantId = tenantId('tenant-mutated');
      command.pharmacyId = pharmacyId('pharmacy-mutated');
      command.date = '2026-07-14';
      expect(values).toEqual([
        listInput.tenantId,
        listInput.pharmacyId,
        listInput.date,
        RECEPTION_QUEUE_MAX_ENTRIES + 1,
      ]);
      return { rows: [] };
    });
    const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

    await expect(repository.list(command)).resolves.toEqual([]);
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain(
      'WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.business_date = $3::date',
    );
  });
});

