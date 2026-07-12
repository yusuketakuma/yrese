import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import { PostgresReceptionRepository } from './reception-repository.js';

const patient = {
  patientId: patientId('patient-reception-client-test'),
  name: '合成受付患者',
  kana: 'ゴウセイウケツケカンジャ',
  birthDate: '1980-01-01',
  sex: 'unknown' as const,
  patientNumber: 'SYN-RECEPTION-001',
  eligibilityStatus: 'NOT_CHECKED' as const,
};

const input = {
  tenantId: tenantId('tenant-reception-client-test'),
  pharmacyId: pharmacyId('pharmacy-reception-client-test'),
  patient,
  idempotencyKey: 'synthetic-reception-client-test-key',
  acceptedAt: new Date('2026-07-13T01:00:00.000Z'),
};

const storedRow = {
  reception_id: 'reception-stored-001',
  accepted_at: '2026-07-13T00:30:00.000Z',
  reception_status: 'WAITING',
  patient_id: patient.patientId,
  name: patient.name,
  kana: patient.kana,
  birth_date: patient.birthDate,
  sex: patient.sex,
  patient_number: patient.patientNumber,
  eligibility_status: patient.eligibilityStatus,
  eligibility_checked_at: null,
};

type Scenario = 'created' | 'existing' | 'conflict' | 'operation_failure';

function createRepository(options: {
  readonly scenario: Scenario;
  readonly operationError?: Error;
  readonly rollbackError?: Error;
}) {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.trim();
    if (normalized.startsWith('INSERT INTO reception_entries')) {
      if (options.operationError !== undefined) throw options.operationError;
      return { rows: options.scenario === 'created' ? [storedRow] : [] };
    }
    if (normalized.startsWith('SELECT')) {
      return {
        rows: [
          {
            ...storedRow,
            stored_patient_id:
              options.scenario === 'conflict' ? 'patient-different' : patient.patientId,
          },
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
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { repository: new PostgresReceptionRepository(pool), query, release };
}

async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected repository operation to reject');
}

function queryLabels(query: ReturnType<typeof vi.fn>): string[] {
  return query.mock.calls.map(([sql]) => {
    const normalized = String(sql).trim();
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('SELECT')) return 'SELECT';
    return normalized;
  });
}

describe('PostgresReceptionRepository client lifecycle', () => {
  it('commits a created reception and reuses the client', async () => {
    const { repository, query, release } = createRepository({ scenario: 'created' });

    const result = await repository.create(input);

    expect(result.kind).toBe('created');
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('commits and returns the stored reception for a same-patient replay', async () => {
    const { repository, query, release } = createRepository({ scenario: 'existing' });

    const result = await repository.create(input);

    expect(result).toMatchObject({
      kind: 'existing',
      entry: { receptionId: 'reception-stored-001', acceptedAt: storedRow.accepted_at },
    });
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

  it('commits a different-patient idempotency conflict without returning an entry', async () => {
    const { repository, query, release } = createRepository({ scenario: 'conflict' });

    const result = await repository.create(input);

    expect(result).toEqual({ kind: 'idempotency_conflict' });
    expect('entry' in result).toBe(false);
    expect(queryLabels(query)).toEqual(['BEGIN', 'INSERT', 'SELECT', 'COMMIT']);
    expect(release.mock.calls).toEqual([[]]);
  });

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
