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

describe('PostgresReceptionRepository conflict/provenance/rollback', () => {
  it.each(['created', 'existing'] as const)(
    'rolls back a %s result with an invalid DB timestamp before commit',
    async (scenario) => {
      const rawTimestamp = { toISOString: () => 'raw timestamp must not run' };
      const { repository, query, release } = createRepository({
        scenario,
        provenanceOverride: { accepted_at: rawTimestamp },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionTimestampInvariantErrorMessage,
      );

      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'existing' ? ['SELECT'] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it.each([
    ['created', 'accessor'],
    ['created', 'inherited'],
    ['created', 'missing'],
    ['existing', 'accessor'],
    ['existing', 'inherited'],
    ['existing', 'missing'],
  ] as const)(
    'rolls back a %s result with a non-own-data accepted_at %s without invoking it',
    async (scenario, authorityKind) => {
      let accessorReads = 0;
      const { repository, query, release } = createRepository({
        scenario,
        rowTransform(row) {
          replaceAcceptedAtAuthority(row, authorityKind, () => {
            accessorReads += 1;
          });
          return row;
        },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionTimestampInvariantErrorMessage,
      );

      expect(accessorReads).toBe(0);
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'existing' ? ['SELECT'] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it.each([
    ['created', 'accessor'],
    ['created', 'inherited'],
    ['created', 'missing'],
    ['existing', 'accessor'],
    ['existing', 'inherited'],
    ['existing', 'missing'],
  ] as const)(
    'rolls back a %s result with a non-own-data reception status %s',
    async (scenario, authorityKind) => {
      let statusReads = 0;
      const { repository, query, release } = createRepository({
        scenario,
        rowTransform(row) {
          if (authorityKind === 'accessor') {
            Object.defineProperty(row, 'reception_status', {
              get() {
                statusReads += 1;
                throw new Error('raw transaction status accessor secret 4220');
              },
            });
          } else {
            const inheritedValue = row.reception_status;
            delete row.reception_status;
            if (authorityKind === 'inherited') {
              Object.setPrototypeOf(row, { reception_status: inheritedValue });
            }
          }
          return row;
        },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionRowInvariantErrorMessage,
      );
      expect(statusReads).toBe(0);
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'existing' ? ['SELECT'] : []),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('does not inspect a DB timestamp for a different-patient idempotency conflict', async () => {
    let timestampTraps = 0;
    const hostileTimestamp = new Proxy(
      {},
      {
        get() {
          timestampTraps += 1;
          throw new Error('raw conflict timestamp secret 4214');
        },
      },
    );
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      provenanceOverride: { accepted_at: hostileTimestamp },
    });

    const result = await repository.create(input);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(timestampTraps).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT', 'SELECT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('does not invoke an accepted_at accessor for a different-patient idempotency conflict', async () => {
    let accessorReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      rowTransform(row) {
        Object.defineProperty(row, 'accepted_at', {
          get() {
            accessorReads += 1;
            throw new Error('raw conflict accepted_at accessor secret 4217');
          },
        });
        return row;
      },
    });

    const result = await repository.create(input);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(accessorReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT', 'SELECT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('does not invoke a reception status accessor for a different-patient conflict', async () => {
    let statusReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      rowTransform(row) {
        Object.defineProperty(row, 'reception_status', {
          get() {
            statusReads += 1;
            throw new Error('conflict status must stay unread');
          },
        });
        return row;
      },
    });

    const result = await repository.create(input);

    expect(result.kind).toBe('idempotency_conflict');
    expect('entry' in result).toBe(false);
    expect(statusReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT', 'SELECT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('rejects missing, inherited, and accessor provenance columns without invoking accessors', async () => {
    let accessorReads = 0;
    for (const column of provenanceColumns) {
      for (const authorityKind of ['accessor', 'inherited', 'missing'] as const) {
        const { repository, query, release } = createRepository({
          scenario: 'created',
          rowTransform(row) {
            if (authorityKind === 'accessor') {
              Object.defineProperty(row, column, {
                get() {
                  accessorReads += 1;
                  throw new Error('raw provenance accessor secret 4218');
                },
              });
            } else {
              const inheritedValue = row[column];
              delete row[column];
              if (authorityKind === 'inherited') {
                Object.setPrototypeOf(row, { [column]: inheritedValue });
              }
            }
            return row;
          },
        });

        await expect(repository.create(input)).rejects.toThrow(
          databaseReceptionProvenanceInvariantErrorMessage,
        );
        expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
        expect(release.mock.calls).toEqual([[]]);
      }
    }
    expect(accessorReads).toBe(0);
  });

  it('rejects hostile and revoked provenance row Proxies without invoking traps', async () => {
    let proxyTraps = 0;
    const hostileRow = new Proxy(
      { ...storedRow },
      {
        get() {
          proxyTraps += 1;
          throw new Error('raw provenance row get secret 4218');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('raw provenance row descriptor secret 4218');
        },
      },
    );
    const revoked = Proxy.revocable({ ...storedRow }, {});
    revoked.revoke();

    for (const proxiedRow of [hostileRow, revoked.proxy]) {
      const { repository, query, release } = createRepository({
        scenario: 'created',
        rowTransform: () => proxiedRow,
      });
      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionProvenanceInvariantErrorMessage,
      );
      expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
      expect(release.mock.calls).toEqual([[]]);
    }
    expect(proxyTraps).toBe(0);
  });

  it('uses captured provenance for existing/conflict branching without reading an accessor', async () => {
    let patientIdReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'conflict',
      rowTransform(row) {
        Object.defineProperty(row, 'stored_patient_id', {
          get() {
            patientIdReads += 1;
            return patientIdReads === 1 ? 'patient-different' : patient.patientId;
          },
        });
        return row;
      },
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(patientIdReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it.each(['created', 'existing', 'conflict'] as const)(
    'accepts non-default own data descriptor flags for a %s result',
    async (scenario) => {
      const { repository, query, release } = createRepository({
        scenario,
        rowTransform(row) {
          Object.defineProperty(row, 'stored_tenant_id', {
            value: input.tenantId,
            enumerable: false,
            configurable: false,
            writable: false,
          });
          return row;
        },
      });

      const result = await repository.create(input);

      expect(result.kind).toBe(
        scenario === 'conflict' ? 'idempotency_conflict' : scenario,
      );
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'created' ? [] : ['SELECT']),
        'COMMIT',
        'SELECT',
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('stops after the first invalid provenance field and leaves later projections unread', async () => {
    let laterReads = 0;
    const { repository, query, release } = createRepository({
      scenario: 'created',
      rowTransform(row) {
        Object.defineProperty(row, 'stored_tenant_id', { value: 0 });
        for (const column of provenanceColumns.slice(1)) {
          Object.defineProperty(row, column, {
            get() {
              laterReads += 1;
              throw new Error('later provenance field must remain unread');
            },
          });
        }
        Object.defineProperty(row, 'accepted_at', {
          get() {
            laterReads += 1;
            throw new Error('entry projection must remain unread');
          },
        });
        return row;
      },
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(laterReads).toBe(0);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after provenance rollback fails without masking the fixed error', async () => {
    const rollbackError = new Error('synthetic provenance rollback failure');
    const { repository, query, release } = createRepository({
      scenario: 'created',
      provenanceOverride: { stored_tenant_id: undefined },
      rollbackError,
    });

    await expect(repository.create(input)).rejects.toThrow(
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[true]]);
  });

  it.each([
    ['created', 'stored_tenant_id'],
    ['created', 'stored_pharmacy_id'],
    ['created', 'stored_idempotency_key'],
    ['created', 'reception_id'],
    ['created', 'stored_patient_id'],
    ['existing', 'stored_tenant_id'],
    ['existing', 'stored_pharmacy_id'],
    ['existing', 'stored_idempotency_key'],
    ['existing', 'reception_id'],
    ['existing', 'stored_patient_id'],
    ['conflict', 'stored_tenant_id'],
    ['conflict', 'stored_pharmacy_id'],
    ['conflict', 'stored_idempotency_key'],
    ['conflict', 'reception_id'],
    ['conflict', 'stored_patient_id'],
  ] as const)(
    'rolls back a %s result with missing stored provenance column %s',
    async (scenario, missingColumn) => {
      const { repository, query, release } = createRepository({
        scenario,
        provenanceOverride: { [missingColumn]: undefined },
      });

      await expect(repository.create(input)).rejects.toThrow(
        databaseReceptionProvenanceInvariantErrorMessage,
      );
      expect(queryLabels(query)).toEqual([
        'BEGIN',
        'INSERT',
        ...(scenario === 'created' ? [] : ['SELECT']),
        'ROLLBACK',
      ]);
      expect(release.mock.calls).toEqual([[]]);
    },
  );

  it('reuses the client after successful rollback and preserves the original error', async () => {
    const operationError = new Error('synthetic reception insert failure');
    const { repository, query, release } = createRepository({
      scenario: 'operation_failure',
      operationError,
    });

    expect(await captureRejection(() => repository.create(input))).toBe(operationError);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('destroys the client after rollback fails without masking the original error', async () => {
    const operationError = new Error('synthetic reception insert failure');
    const rollbackError = new Error('synthetic reception rollback failure');
    const { repository, query, release } = createRepository({
      scenario: 'operation_failure',
      operationError,
      rollbackError,
    });

    expect(await captureRejection(() => repository.create(input))).toBe(operationError);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release.mock.calls).toEqual([[true]]);
  });
});
