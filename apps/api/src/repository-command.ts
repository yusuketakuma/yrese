import {
  pharmacyId,
  tenantId,
  type PharmacyId,
  type TenantId,
} from '@yrese/shared-kernel';

import type { OwnDataPropertyRead } from './own-data-property.js';

function readRepositoryScopeString(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): string {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(invariantErrorMessage);
  }
  return result.value;
}

export function snapshotRepositoryTenantId(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): TenantId {
  try {
    return tenantId(readRepositoryScopeString(result, invariantErrorMessage));
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export function snapshotRepositoryPharmacyId(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): PharmacyId {
  try {
    return pharmacyId(readRepositoryScopeString(result, invariantErrorMessage));
  } catch {
    throw new Error(invariantErrorMessage);
  }
}
