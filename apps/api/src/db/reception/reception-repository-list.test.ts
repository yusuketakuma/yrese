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

describe('PostgresReceptionRepository list projection', () => {
  it('preserves list SQL, parameter order, physical row order, and cardinality', async () => {
    const rows = [
      { ...storedRow, reception_id: 'reception-first-4233' },
      { ...storedRow, reception_id: 'reception-second-4233' },
    ];
    const query = vi.fn(async () => ({ rows }));
    const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

    await expect(repository.list(listInput)).resolves.toEqual([
      expect.objectContaining({ receptionId: 'reception-first-4233' }),
      expect.objectContaining({ receptionId: 'reception-second-4233' }),
    ]);
    expect(query).toHaveBeenCalledOnce();
    const firstCall = query.mock.calls[0] as unknown[] | undefined;
    const sql = firstCall?.[0];
    const values = firstCall?.[1];
    expect(values).toEqual([
      listInput.tenantId,
      listInput.pharmacyId,
      listInput.date,
      RECEPTION_QUEUE_MAX_ENTRIES + 1,
    ]);
    expect(String(sql)).toContain(
      'WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.business_date = $3::date',
    );
    expect(String(sql)).toContain(
      'ORDER BY r.accepted_at ASC, r.reception_id COLLATE "C" ASC',
    );
    // C-021(選択肢 b): cap+1 件まで読み、route が超過を検出する防御的 LIMIT。
    expect(String(sql)).toContain('LIMIT $4');
    expect(String(sql)).not.toMatch(/\bOFFSET\b/i);
  });

  it('requires own data authority for reception ID and status in list projection', async () => {
    let accessorReads = 0;
    for (const column of ['reception_id', 'reception_status'] as const) {
      for (const authorityKind of ['accessor', 'inherited', 'missing'] as const) {
        const invalidRow = { ...storedRow } as Record<string, unknown>;
        if (authorityKind === 'accessor') {
          Object.defineProperty(invalidRow, column, {
            get() {
              accessorReads += 1;
              throw new Error('raw reception core accessor secret 4220');
            },
          });
        } else {
          const inheritedValue = invalidRow[column];
          delete invalidRow[column];
          if (authorityKind === 'inherited') {
            Object.setPrototypeOf(invalidRow, { [column]: inheritedValue });
          }
        }
        const query = vi.fn(async () => ({ rows: [storedRow, invalidRow] }));
        const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

        await expect(
          repository.list({
            tenantId: input.tenantId,
            pharmacyId: input.pharmacyId,
            date: '2026-07-13',
          }),
        ).rejects.toThrow(databaseReceptionRowInvariantErrorMessage);
        expect(query).toHaveBeenCalledOnce();
      }
    }
    expect(accessorReads).toBe(0);
  });

  it.each([
    ['reception_id', ''],
    ['reception_status', 'NOT-A-STATUS'],
  ] as const)('normalizes an invalid own-data %s schema value to the fixed row error', async (column, value) => {
    const query = vi.fn(async () => ({ rows: [{ ...storedRow, [column]: value }] }));
    const repository = new PostgresReceptionRepository({ query } as unknown as Pool);

    await expect(
      repository.list({
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        date: '2026-07-13',
      }),
    ).rejects.toEqual(new Error(databaseReceptionRowInvariantErrorMessage));
  });

  it('accepts non-default own data descriptor flags for reception core columns', async () => {
    const validRow = { ...storedRow } as Record<string, unknown>;
    Object.defineProperty(validRow, 'reception_status', {
      value: storedRow.reception_status,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    const repository = new PostgresReceptionRepository({
      query: vi.fn(async () => ({ rows: [validRow] })),
    } as unknown as Pool);

    await expect(
      repository.list({
        tenantId: input.tenantId,
        pharmacyId: input.pharmacyId,
        date: '2026-07-13',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        receptionId: storedRow.reception_id,
        receptionStatus: storedRow.reception_status,
      }),
    ]);
  });

  it('rejects hostile and revoked list row Proxies before invoking traps', async () => {
    let proxyTraps = 0;
    const hostileRow = new Proxy(
      { ...storedRow },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw reception row get secret 4220');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw reception row descriptor secret 4220');
        },
      },
    );
    const revoked = Proxy.revocable({ ...storedRow }, {});
    revoked.revoke();

    for (const row of [hostileRow, revoked.proxy]) {
      const repository = new PostgresReceptionRepository({
        query: vi.fn(async () => ({ rows: [row] })),
      } as unknown as Pool);
      await expect(
        repository.list({ ...input, date: '2026-07-13' }),
      ).rejects.toThrow(databaseReceptionRowInvariantErrorMessage);
    }
    expect(proxyTraps).toBe(0);
  });

  it('preserves reception entry field error precedence and leaves later fields unread', async () => {
    let laterReads = 0;
    const invalidIdRow = { ...storedRow } as Record<string, unknown>;
    Object.defineProperty(invalidIdRow, 'reception_id', {
      get() {
        laterReads += 1;
        throw new Error('raw reception ID accessor secret 4220');
      },
    });
    for (const column of ['eligibility_checked_at', 'accepted_at', 'reception_status']) {
      Object.defineProperty(invalidIdRow, column, {
        get() {
          laterReads += 1;
          throw new Error('later reception entry field must remain unread');
        },
      });
    }
    const idRepository = new PostgresReceptionRepository({
      query: vi.fn(async () => ({ rows: [invalidIdRow] })),
    } as unknown as Pool);
    await expect(
      idRepository.list({ ...input, date: '2026-07-13' }),
    ).rejects.toThrow(databaseReceptionRowInvariantErrorMessage);
    expect(laterReads).toBe(0);

    const invalidTimestampRow = { ...storedRow } as Record<string, unknown>;
    Object.defineProperty(invalidTimestampRow, 'accepted_at', {
      get() {
        laterReads += 1;
        throw new Error('raw accepted_at accessor secret 4220');
      },
    });
    Object.defineProperty(invalidTimestampRow, 'reception_status', {
      get() {
        laterReads += 1;
        throw new Error('status must remain unread after accepted_at failure');
      },
    });
    const timestampRepository = new PostgresReceptionRepository({
      query: vi.fn(async () => ({ rows: [invalidTimestampRow] })),
    } as unknown as Pool);
    await expect(
      timestampRepository.list({ ...input, date: '2026-07-13' }),
    ).rejects.toThrow(databaseReceptionTimestampInvariantErrorMessage);
    expect(laterReads).toBe(0);
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

});
