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


export const patient = {
  patientId: patientId('patient-reception-client-test'),
  name: '合成受付患者',
  kana: 'ゴウセイウケツケカンジャ',
  birthDate: '1980-01-01',
  sex: 'unknown' as const,
  patientNumber: 'SYN-RECEPTION-001',
  eligibilityStatus: 'NOT_CHECKED' as const,
};

export const input = {
  tenantId: tenantId('tenant-reception-client-test'),
  pharmacyId: pharmacyId('pharmacy-reception-client-test'),
  patient,
  idempotencyKey: 'synthetic-reception-client-test-key',
  acceptedAt: new Date('2026-07-13T01:00:00.000Z'),
};

export const listInput = {
  tenantId: input.tenantId,
  pharmacyId: input.pharmacyId,
  date: '2026-07-13',
};

export type ReceptionCommandField = keyof typeof input;
export type InvalidCommandAuthority = 'missing' | 'inherited' | 'accessor';

export const invalidReceptionScopeValues = [
  ['tenantId', ''],
  ['tenantId', '   '],
  ['tenantId', 'tenant\u0000invalid'],
  ['pharmacyId', ''],
  ['pharmacyId', '   '],
  ['pharmacyId', 'pharmacy\u007finvalid'],
  ['idempotencyKey', ''],
  ['idempotencyKey', '   '],
  ['idempotencyKey', 'key\tinvalid'],
  ['idempotencyKey', 'x'.repeat(RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH + 1)],
] as const satisfies readonly (readonly [
  'tenantId' | 'pharmacyId' | 'idempotencyKey',
  string,
])[];

export function commandWithInvalidAuthority(
  field: ReceptionCommandField,
  authority: InvalidCommandAuthority,
  onAccessorRead: () => void,
): typeof input {
  const command: Record<string, unknown> = { ...input };
  const originalValue = command[field];
  delete command[field];
  if (authority === 'inherited') {
    Object.setPrototypeOf(command, { [field]: originalValue });
  } else if (authority === 'accessor') {
    Object.defineProperty(command, field, {
      get() {
        onAccessorRead();
        throw new Error('raw reception command accessor secret 4225');
      },
    });
  }
  return command as typeof input;
}

export const storedRow = {
  stored_tenant_id: input.tenantId,
  stored_pharmacy_id: input.pharmacyId,
  stored_idempotency_key: input.idempotencyKey,
  stored_patient_id: patient.patientId,
  reception_id: 'reception-stored-001',
  accepted_at: '2026-07-13T00:30:00.000Z',
  reception_status: 'WAITING',
  version: 1,
  patient_id: patient.patientId,
  name: patient.name,
  kana: patient.kana,
  birth_date: patient.birthDate,
  sex: patient.sex,
  patient_number: patient.patientNumber,
  eligibility_status: patient.eligibilityStatus,
  eligibility_checked_at: null,
  business_date: '2026-07-13',
  elig_snapshot_id: null,
  elig_state: null,
  elig_valid_from: null,
  elig_valid_to: null,
};

export function createdRowFromInsertValues(values: readonly unknown[] | undefined) {
  return {
    ...storedRow,
    stored_tenant_id: values?.[0],
    stored_pharmacy_id: values?.[1],
    reception_id: values?.[2],
    stored_patient_id: values?.[3],
    accepted_at: values?.[4],
    stored_idempotency_key: values?.[6],
    patient_id: values?.[3],
    name: values?.[7],
    kana: values?.[8],
    birth_date: values?.[9],
    sex: values?.[10],
    patient_number: values?.[11],
    eligibility_status: values?.[12],
    eligibility_checked_at: values?.[13],
  };
}

export type Scenario = 'created' | 'existing' | 'conflict' | 'operation_failure';

export function createRepository(options: {
  readonly scenario: Scenario;
  readonly operationError?: Error;
  readonly rollbackError?: Error;
  readonly provenanceOverride?: Readonly<Record<string, unknown>>;
  readonly rowTransform?: (row: Record<string, unknown>) => Record<string, unknown>;
}): {
  readonly repository: PostgresReceptionRepository;
  readonly connect: ReturnType<typeof vi.fn>;
  readonly query: ReturnType<typeof vi.fn>;
  readonly release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn();
  const transformRow = (row: Record<string, unknown>) => options.rowTransform?.(row) ?? row;
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT INTO reception_entries')) {
      if (options.operationError !== undefined) throw options.operationError;
      return {
        rows:
          options.scenario === 'created'
            ? [
                transformRow({
                  ...createdRowFromInsertValues(values),
                  ...options.provenanceOverride,
                }),
              ]
            : [],
      };
    }
    if (normalized.startsWith('SELECT')) {
      return {
        rows: [
          transformRow({
            ...storedRow,
            stored_patient_id:
              options.scenario === 'conflict' ? 'patient-different' : patient.patientId,
            ...options.provenanceOverride,
          }),
        ],
      };
    }
    if (normalized === 'ROLLBACK' && options.rollbackError !== undefined) {
      throw options.rollbackError;
    }
    return { rows: [] };
  });
  const client = {
    query: query as unknown as PoolClient['query'],
    release,
  } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { connect } as unknown as Pool;
  return { repository: new PostgresReceptionRepository(pool), connect, query, release };
}

export function createRepositoryWithQueryResults(options: {
  readonly insertResult: unknown | ((values?: readonly unknown[]) => unknown);
  readonly selectResult?: unknown;
  readonly rollbackError?: Error;
}): {
  readonly repository: PostgresReceptionRepository;
  readonly connect: ReturnType<typeof vi.fn>;
  readonly query: ReturnType<typeof vi.fn>;
  readonly release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn();
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT INTO reception_entries')) {
      return typeof options.insertResult === 'function'
        ? options.insertResult(values)
        : options.insertResult;
    }
    if (normalized.startsWith('SELECT')) {
      return options.selectResult ?? { rows: [] };
    }
    if (normalized === 'ROLLBACK' && options.rollbackError !== undefined) {
      throw options.rollbackError;
    }
    return { rows: [] };
  });
  const client = {
    query: query as unknown as PoolClient['query'],
    release,
  } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { connect } as unknown as Pool;
  return { repository: new PostgresReceptionRepository(pool), connect, query, release };
}

export async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected repository operation to reject');
}

export function queryLabels(query: ReturnType<typeof vi.fn>): string[] {
  return query.mock.calls.map(([sql]) => {
    const normalized = String(sql).trim();
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('SELECT')) return 'SELECT';
    return normalized;
  });
}

export type InvalidAcceptedAtAuthority = 'accessor' | 'inherited' | 'missing';
export type ProvenanceColumn =
  | 'stored_tenant_id'
  | 'stored_pharmacy_id'
  | 'stored_idempotency_key'
  | 'reception_id'
  | 'stored_patient_id';

export const provenanceColumns: readonly ProvenanceColumn[] = [
  'stored_tenant_id',
  'stored_pharmacy_id',
  'stored_idempotency_key',
  'reception_id',
  'stored_patient_id',
];

export function replaceAcceptedAtAuthority(
  row: Record<string, unknown>,
  authorityKind: InvalidAcceptedAtAuthority,
  onAccessorRead: () => void,
): void {
  if (authorityKind === 'accessor') {
    Object.defineProperty(row, 'accepted_at', {
      get() {
        onAccessorRead();
        throw new Error('raw accepted_at accessor secret 4217');
      },
    });
    return;
  }
  delete row.accepted_at;
  if (authorityKind === 'inherited') {
    Object.setPrototypeOf(row, { accepted_at: storedRow.accepted_at });
  }
}

