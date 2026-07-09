import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELIGIBILITY_STATUSES, RECEPTION_STATUSES } from '@yrese/shared-kernel';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const immutablePatientReceptionMigrationChecksum = '2910b460d2b9733904937093b399784089dbda9a444af75ac5fd498a1ae4b599';

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

  it('keeps the applied patient/reception migration immutable', async () => {
    const sql = await readFile(resolve(repositoryRoot, 'migrations/000002_create_patient_and_reception_tables.sql'), 'utf8');

    expect(createHash('sha256').update(sql).digest('hex')).toBe(immutablePatientReceptionMigrationChecksum);
  });

  it('adds exact tenant/pharmacy patient-number uniqueness without rewriting data or existing indexes', async () => {
    const sql = await readFile(resolve(repositoryRoot, 'migrations/000003_add_patient_number_scope_unique.sql'), 'utf8');
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    expect(normalizedSql).toBe(
      'ALTER TABLE patients ADD CONSTRAINT patients_tenant_pharmacy_patient_number_unique UNIQUE (tenant_id, pharmacy_id, patient_number);',
    );
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(?:INDEX|CONSTRAINT|TABLE)\b/i);
    expect(sql).not.toMatch(/\b(?:LOWER|UPPER|TRIM|BTRIM|LTRIM|RTRIM)\s*\(/i);
  });
});
