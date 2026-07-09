import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELIGIBILITY_STATUSES, RECEPTION_STATUSES } from '@yrese/shared-kernel';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function extractCheckValues(sql: string, constraintName: string): readonly string[] {
  const pattern = new RegExp(`CONSTRAINT\\s+${constraintName}\\s+CHECK\\s*\\([\\s\\S]*?IN\\s*\\(([^)]*)\\)`, 'm');
  const match = pattern.exec(sql);
  const values = match?.[1];
  if (values === undefined) {
    throw new Error(`missing CHECK constraint values for ${constraintName}`);
  }
  return values
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter((value) => value.length > 0);
}

describe('patient/reception migration enum values', () => {
  it('keeps DB CHECK lists aligned with shared-kernel const tuples', async () => {
    const sql = await readFile(resolve(repositoryRoot, 'migrations/000002_create_patient_and_reception_tables.sql'), 'utf8');

    expect(extractCheckValues(sql, 'patients_eligibility_status_check')).toEqual([...ELIGIBILITY_STATUSES]);
    expect(extractCheckValues(sql, 'reception_entries_reception_status_check')).toEqual([...RECEPTION_STATUSES]);
  });
});
