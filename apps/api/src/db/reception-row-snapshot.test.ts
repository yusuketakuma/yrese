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
} from '../reception-repository.js';
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

describe('unbounded database query row-set snapshot authority', () => {
  const invariantMessage = 'Synthetic unbounded row-set invariant';

  it('preserves bounded invalid-maximum precedence before query-result inspection', () => {
    let proxyTraps = 0;
    const hostileResult = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('bounded query-result Proxy secret 4233');
        },
      },
    );

    expect(() =>
      snapshotDatabaseQueryRows(
        hostileResult,
        undefined as unknown as number,
        invariantMessage,
      ),
    ).toThrow(invariantMessage);
    expect(proxyTraps).toBe(0);
  });

  it('returns a frozen dense container detached from raw indices without invoking raw methods', () => {
    let methodCalls = 0;
    const first = { id: 'first' };
    const second = { id: 'second' };
    const rows = [first, second];
    Object.defineProperty(rows, '0', {
      value: first,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    for (const property of ['slice', 'map'] as const) {
      Object.defineProperty(rows, property, {
        value() {
          methodCalls += 1;
          return [];
        },
      });
    }
    Object.defineProperty(rows, Symbol.iterator, {
      value() {
        methodCalls += 1;
        throw new Error('raw row-set iterator secret 4233');
      },
    });
    Object.defineProperty(rows, Symbol.toPrimitive, {
      value() {
        methodCalls += 1;
        throw new Error('raw row-set coercion secret 4233');
      },
    });
    const queryResult = {};
    Object.defineProperty(queryResult, 'rows', {
      value: rows,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    const snapshot = snapshotUnboundedDatabaseQueryRows<{ readonly id: string }>(
      queryResult,
      invariantMessage,
    );
    rows[0] = { id: 'replaced' };
    rows.pop();

    expect(snapshot).toEqual([first, second]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(rows)).toBe(false);
    expect(() => (snapshot as { id: string }[]).push({ id: 'third' })).toThrow();
    expect(methodCalls).toBe(0);
  });

  it('rejects hostile row-set structure without invoking accessors or Proxy traps', () => {
    let accessorReads = 0;
    let proxyTraps = 0;
    const accessorResult = {};
    Object.defineProperty(accessorResult, 'rows', {
      get() {
        accessorReads += 1;
        throw new Error('raw query rows accessor secret 4233');
      },
    });
    const inheritedResult = Object.create({ rows: [] });
    const accessorRows = [{}];
    Object.defineProperty(accessorRows, '0', {
      get() {
        accessorReads += 1;
        throw new Error('raw query index accessor secret 4233');
      },
    });
    const inheritedRows = Array(1);
    Object.setPrototypeOf(inheritedRows, { 0: {} });
    const proxiedResult = new Proxy(
      { rows: [] },
      {
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw query result Proxy secret 4233');
        },
      },
    );
    const proxiedRows = new Proxy(
      [{}],
      {
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw query rows Proxy secret 4233');
        },
      },
    );
    const revokedRows = Proxy.revocable([{}], {});
    revokedRows.revoke();
    const invalidResults: readonly unknown[] = [
      {},
      { rows: 'not-an-array' },
      accessorResult,
      inheritedResult,
      proxiedResult,
      { rows: proxiedRows },
      { rows: revokedRows.proxy },
      { rows: Array(1) },
      { rows: inheritedRows },
      { rows: accessorRows },
    ];

    for (const invalidResult of invalidResults) {
      expect(() =>
        snapshotUnboundedDatabaseQueryRows(invalidResult, invariantMessage),
      ).toThrow(invariantMessage);
    }
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });
});

