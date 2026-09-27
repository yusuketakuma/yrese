import { pharmacyId, tenantId } from '@yrese/shared-kernel';

import type { MasterRepository } from './master-repository.js';

/**
 * WP-7301/WP-7303 / MST-003 §4: synthetic master seed(MOD-013 合成規則)。
 * - localCode / 各種コードは `SYN-` 接頭辞の架空値。実薬剤名・実コードは
 *   含めない(実マスタ取込は RB-009 で禁止のまま)。
 * - seed は冪等: 同一 (kind, version) の master_versions / 同一
 *   (versionId, localCode) の品目は既存なら skip する。
 * - API route には write 経路を持たない — 投入は本モジュール経由のみ。
 */

export const SYNTHETIC_MEDICATION_VERSION_ID =
  '00000000-0000-4000-8000-00000000a001';
export const SYNTHETIC_USAGE_VERSION_ID = '00000000-0000-4000-8000-00000000a002';

export const SYNTHETIC_MEDICATIONS = [
  {
    medicationItemId: '00000000-0000-4000-8000-000000000001',
    localCode: 'SYN-MED-001',
    yjCode: 'SYN-YJ-0001',
    name: '合成内服薬アルファ錠10mg',
    unit: '錠',
    price: 1000,
    genericFlag: 'originator' as const,
    genericNameCode: 'SYN-GN-0001',
    controlCategories: [] as string[],
  },
  {
    medicationItemId: '00000000-0000-4000-8000-000000000002',
    localCode: 'SYN-MED-002',
    yjCode: 'SYN-YJ-0002',
    name: '合成内服薬ベータ錠5mg',
    unit: '錠',
    price: 500,
    genericFlag: 'generic' as const,
    genericNameCode: 'SYN-GN-0001',
    controlCategories: [] as string[],
  },
  {
    medicationItemId: '00000000-0000-4000-8000-000000000003',
    localCode: 'SYN-MED-003',
    yjCode: null,
    name: '合成外用薬ガンマ軟膏0.1%',
    unit: 'g',
    price: 200,
    genericFlag: 'unclassified' as const,
    genericNameCode: null,
    controlCategories: [] as string[],
  },
  {
    medicationItemId: '00000000-0000-4000-8000-000000000004',
    localCode: 'SYN-MED-004',
    yjCode: 'SYN-YJ-0004',
    name: '合成注射薬デルタ注射液10mL',
    unit: 'mL',
    price: null,
    genericFlag: 'originator' as const,
    genericNameCode: 'SYN-GN-0004',
    controlCategories: ['psychotropic'],
  },
  {
    medicationItemId: '00000000-0000-4000-8000-000000000005',
    localCode: 'SYN-MED-005',
    yjCode: null,
    name: '合成麻薬イプシロン散1%',
    unit: 'g',
    price: 9000,
    genericFlag: 'unclassified' as const,
    genericNameCode: null,
    controlCategories: ['narcotic'],
  },
  {
    medicationItemId: '00000000-0000-4000-8000-000000000006',
    localCode: 'SYN-MED-006',
    yjCode: 'SYN-YJ-0006',
    name: '合成内服薬ゼータ細粒10%',
    unit: 'g',
    price: 800,
    genericFlag: 'generic' as const,
    genericNameCode: 'SYN-GN-0006',
    controlCategories: [] as string[],
  },
];

export const SYNTHETIC_USAGES = [
  {
    usageItemId: '00000000-0000-4000-8000-000000001001',
    localCode: 'SYN-USG-001',
    text: '朝食後',
    timesPerDay: 1,
    mealTiming: 'after' as const,
    jahisCode: null,
  },
  {
    usageItemId: '00000000-0000-4000-8000-000000001002',
    localCode: 'SYN-USG-002',
    text: '朝夕食後',
    timesPerDay: 2,
    mealTiming: 'after' as const,
    jahisCode: null,
  },
  {
    usageItemId: '00000000-0000-4000-8000-000000001003',
    localCode: 'SYN-USG-003',
    text: '朝昼夕食後',
    timesPerDay: 3,
    mealTiming: 'after' as const,
    jahisCode: 'SYN-JAHIS-001',
  },
  {
    usageItemId: '00000000-0000-4000-8000-000000001004',
    localCode: 'SYN-USG-004',
    text: '就寝前',
    timesPerDay: 1,
    mealTiming: 'bedtime' as const,
    jahisCode: null,
  },
  {
    usageItemId: '00000000-0000-4000-8000-000000001005',
    localCode: 'SYN-USG-005',
    text: '疼痛時(頓用)',
    timesPerDay: null,
    mealTiming: 'asNeeded' as const,
    jahisCode: null,
  },
  {
    usageItemId: '00000000-0000-4000-8000-000000001006',
    localCode: 'SYN-USG-006',
    text: '朝食前',
    timesPerDay: 1,
    mealTiming: 'before' as const,
    jahisCode: null,
  },
];

/** synthetic seed を scope へ投入(冪等)。監査対象外(MST-003 §5)。 */
export async function seedSyntheticMasters(
  repository: MasterRepository,
  scope: { readonly tenantId: string; readonly pharmacyId: string },
  recordedAt: string,
): Promise<void> {
  const brandedScope = {
    tenantId: tenantId(scope.tenantId),
    pharmacyId: pharmacyId(scope.pharmacyId),
  };
  const medVersion = await repository.seedVersion({
    ...brandedScope,
    masterVersionId: SYNTHETIC_MEDICATION_VERSION_ID,
    masterKind: 'medication',
    version: 'SYN-2026-001',
    validFrom: '2026-01-01',
    validTo: null,
    transitionNote: 'synthetic 初期版',
    recordedAt,
  });
  const usageVersion = await repository.seedVersion({
    ...brandedScope,
    masterVersionId: SYNTHETIC_USAGE_VERSION_ID,
    masterKind: 'usage',
    version: 'SYN-2026-001',
    validFrom: '2026-01-01',
    validTo: null,
    transitionNote: 'synthetic 初期版',
    recordedAt,
  });
  void medVersion;
  void usageVersion;
  for (const item of SYNTHETIC_MEDICATIONS) {
    await repository.seedMedicationItem({
      ...brandedScope,
      ...item,
      masterVersionId: SYNTHETIC_MEDICATION_VERSION_ID,
    });
  }
  for (const item of SYNTHETIC_USAGES) {
    await repository.seedUsageItem({
      ...brandedScope,
      ...item,
      masterVersionId: SYNTHETIC_USAGE_VERSION_ID,
    });
  }
}
