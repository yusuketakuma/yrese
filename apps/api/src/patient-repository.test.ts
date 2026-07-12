import { describe, expect, it } from 'vitest';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import { InMemoryPatientRepository } from './patient-repository.js';

const SCOPE = {
  tenantId: tenantId('tenant-order-test'),
  pharmacyId: pharmacyId('pharmacy-order-test'),
} as const;

function syntheticRecord(
  id: string,
  patientNumber: string,
  scope: { tenantId: ReturnType<typeof tenantId>; pharmacyId: ReturnType<typeof pharmacyId> } = SCOPE,
) {
  return {
    ...scope,
    patientId: patientId(id),
    name: `合成検索対象${id}`,
    kana: `ゴウセイケンサクタイショウ${id}`,
    birthDate: '1980-01-01',
    sex: 'unknown' as const,
    patientNumber,
    eligibilityStatus: 'NOT_CHECKED' as const,
  };
}

describe('InMemoryPatientRepository search ordering', () => {
  it('orders filtered synthetic ASCII records before pagination without mutating fixtures', async () => {
    const b = syntheticRecord('patient-b', 'B-002');
    const a = syntheticRecord('patient-a', 'A-001');
    const c = syntheticRecord('patient-c', 'C-003');
    const otherTenant = syntheticRecord('patient-other-tenant', '0-000', {
      tenantId: tenantId('tenant-other'),
      pharmacyId: SCOPE.pharmacyId,
    });
    const otherPharmacy = syntheticRecord('patient-other-pharmacy', '0-000', {
      tenantId: SCOPE.tenantId,
      pharmacyId: pharmacyId('pharmacy-other'),
    });
    const records = [b, otherTenant, c, otherPharmacy, a];
    const originalOrder = records.map((record) => record.patientId);
    const repository = new InMemoryPatientRepository(records);

    const first = await repository.search({ ...SCOPE, q: '合成検索対象', limit: 2 });
    const nextCursor = first.nextCursor;
    expect(nextCursor).toEqual({ offset: 2 });
    if (nextCursor === undefined) {
      throw new Error('expected a second page cursor');
    }
    const second = await repository.search({
      ...SCOPE,
      q: '合成検索対象',
      limit: 2,
      cursor: nextCursor,
    });

    expect(first.results.map((result) => result.patientId)).toEqual(['patient-a', 'patient-b']);
    expect(second.results.map((result) => result.patientId)).toEqual(['patient-c']);
    expect(second.nextCursor).toBeUndefined();
    expect([...first.results, ...second.results].map((result) => result.patientId)).toEqual([
      'patient-a',
      'patient-b',
      'patient-c',
    ]);
    expect(records.map((record) => record.patientId)).toEqual(originalOrder);
  });

  it('returns identical pages for different insertion orders of the same records', async () => {
    const records = [
      syntheticRecord('patient-c', 'C-003'),
      syntheticRecord('patient-a', 'A-001'),
      syntheticRecord('patient-b', 'B-002'),
    ];
    const firstRepository = new InMemoryPatientRepository(records);
    const secondRepository = new InMemoryPatientRepository([...records].reverse());

    const search = async (repository: InMemoryPatientRepository) => {
      const page = await repository.search({ ...SCOPE, q: '合成検索対象', limit: 2 });
      return page.results.map((result) => result.patientId);
    };

    expect(await search(firstRepository)).toEqual(['patient-a', 'patient-b']);
    expect(await search(secondRepository)).toEqual(['patient-a', 'patient-b']);
  });

  it('uses patientId as a defensive tie-break for invalid duplicate patient numbers', async () => {
    // DOM-002 forbids duplicate patient numbers in one scope; this corrupt-fixture case
    // keeps pagination deterministic if an invalid adapter fixture crosses that boundary.
    const repository = new InMemoryPatientRepository([
      syntheticRecord('patient-z', 'A-001'),
      syntheticRecord('patient-a', 'A-001'),
    ]);

    const page = await repository.search({ ...SCOPE, q: 'A-001', limit: 2 });

    expect(page.results.map((result) => result.patientId)).toEqual(['patient-a', 'patient-z']);
  });
});
