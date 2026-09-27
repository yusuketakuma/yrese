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

describe('reception Asia/Tokyo business-date authority', () => {
  const invariantMessage = 'Synthetic reception business date invariant';

  it.each([
    ['0001-01-01T00:00:00.000Z', '0001-01-01'],
    ['0004-02-28T15:00:00.000Z', '0004-02-29'],
    ['0099-12-31T14:59:59.999Z', '0099-12-31'],
    ['0099-12-31T15:00:00.000Z', '0100-01-01'],
    ['9999-12-31T14:59:59.999Z', '9999-12-31'],
    ['0000-12-31T15:00:00.000Z', '0001-01-01'],
  ] as const)('canonicalizes %s to the JST CalendarDate %s', (instant, expected) => {
    expect(
      businessDateFromAcceptedAt(new Date(instant), invariantMessage),
    ).toBe(expected);
  });

  it.each([
    ['local BCE', new Date('0000-01-01T00:00:00.000Z')],
    ['JST year 10000', new Date('9999-12-31T15:00:00.000Z')],
    ['invalid Date', new Date(Number.NaN)],
  ] as const)('rejects %s with one fixed non-echo error', (_label, value) => {
    expect(() => businessDateFromAcceptedAt(value, invariantMessage)).toThrow(
      invariantMessage,
    );
  });

  it('rejects non-Date authorities without coercion or Proxy traps', () => {
    let coercions = 0;
    let traps = 0;
    const coercible = {
      valueOf() {
        coercions += 1;
        return input.acceptedAt.getTime();
      },
      [Symbol.toPrimitive]() {
        coercions += 1;
        return input.acceptedAt.getTime();
      },
    };
    const hostileProxy = new Proxy(input.acceptedAt, {
      get() {
        traps += 1;
        throw new Error('raw business-date Proxy secret 4232');
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error('raw business-date prototype secret 4232');
      },
    });
    const revoked = Proxy.revocable(input.acceptedAt, {});
    revoked.revoke();

    for (const value of [
      undefined,
      null,
      input.acceptedAt.getTime(),
      input.acceptedAt.toISOString(),
      new String(input.acceptedAt.toISOString()),
      coercible,
      Object.create(Date.prototype),
      hostileProxy,
      revoked.proxy,
    ]) {
      expect(() => businessDateFromAcceptedAt(value, invariantMessage)).toThrow(
        invariantMessage,
      );
    }
    expect(coercions).toBe(0);
    expect(traps).toBe(0);
  });

  it('ignores poisoned own Date methods after intrinsic snapshot', () => {
    const acceptedAt = new Date('0099-12-31T15:00:00.000Z');
    let ownMethodReads = 0;
    for (const property of ['getTime', 'valueOf', 'toISOString'] as const) {
      Object.defineProperty(acceptedAt, property, {
        get() {
          ownMethodReads += 1;
          throw new Error(`raw own Date ${property} secret 4232`);
        },
      });
    }

    expect(businessDateFromAcceptedAt(acceptedAt, invariantMessage)).toBe(
      '0100-01-01',
    );
    expect(ownMethodReads).toBe(0);
  });
});

