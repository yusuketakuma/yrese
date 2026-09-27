import { CalendarDate } from '@yrese/date-time';
import {
  RECEPTION_BUSINESS_REASON_CODE_PATTERN,
  type ReceptionTransitionTarget,
} from '@yrese/contracts';
import {
  isReceptionTransitionAllowed,
  receptionId,
  type PharmacyId,
  type ReceptionId,
  type TenantId,
} from '@yrese/shared-kernel';

import { snapshotDateInstant } from '../instant.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from '../repository-command.js';
import {
  inMemoryReceptionTimestampInvariantErrorMessage,
  readReceptionScopeString,
  receptionTransitionCommandSnapshotInvariantErrorMessage,
} from './reception-repository-fixtures.js';

const japanStandardTimeOffsetMilliseconds = 9 * 60 * 60 * 1_000;

export function businessDateFromAcceptedAt(
  acceptedAt: unknown,
  invariantErrorMessage: string,
): string {
  try {
    const epochMilliseconds = Date.prototype.getTime.call(acceptedAt);
    if (!Number.isFinite(epochMilliseconds)) {
      throw new Error(invariantErrorMessage);
    }
    const jstWallClock = new Date(
      epochMilliseconds + japanStandardTimeOffsetMilliseconds,
    );
    const year = Date.prototype.getUTCFullYear.call(jstWallClock);
    const month = Date.prototype.getUTCMonth.call(jstWallClock) + 1;
    const day = Date.prototype.getUTCDate.call(jstWallClock);
    if (![year, month, day].every(Number.isSafeInteger)) {
      throw new Error(invariantErrorMessage);
    }
    return CalendarDate.fromParts({
      year,
      month,
      day,
    }).toString();
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export function snapshotReceptionTransitionTarget(value: unknown): ReceptionTransitionTarget {
  switch (value) {
    case 'IN_PROGRESS':
    case 'COMPLETED':
    case 'CANCELLED':
      return value;
    default:
      throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
}

export function snapshotReceptionTransitionExpectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  return value;
}

export interface ReceptionTransitionCommandSnapshot {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly to: ReceptionTransitionTarget;
  readonly expectedVersion: number;
  readonly businessReason?: string;
  readonly statusChangedAt: string;
}

/**
 * transition 入力の検証済みスナップショット(in-memory / Postgres で共用する
 * 規律: own-property 単一読取り、businessReason は CANCELLED でだけ必須の
 * 構造化コード — 監査層の MOD-008 規律と同じ形をここでも fail-closed で要求)。
 */
export function snapshotReceptionTransitionCommand(
  input: unknown,
): ReceptionTransitionCommandSnapshot {
  const readProperty = createOwnDataPropertyReader(
    input,
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readProperty('tenantId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readProperty('pharmacyId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const receptionIdValue = readReceptionScopeString(
    readProperty('receptionId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  let commandReceptionId: ReceptionId;
  try {
    commandReceptionId = receptionId(receptionIdValue);
  } catch {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const toProperty = readProperty('to');
  const to = snapshotReceptionTransitionTarget(
    toProperty.present ? toProperty.value : undefined,
  );
  const expectedVersionProperty = readProperty('expectedVersion');
  const expectedVersion = snapshotReceptionTransitionExpectedVersion(
    expectedVersionProperty.present ? expectedVersionProperty.value : undefined,
  );
  const businessReasonProperty = readProperty('businessReason');
  let businessReason: string | undefined;
  if (businessReasonProperty.present && businessReasonProperty.value !== undefined) {
    const candidate = businessReasonProperty.value;
    if (
      typeof candidate !== 'string' ||
      !RECEPTION_BUSINESS_REASON_CODE_PATTERN.test(candidate)
    ) {
      throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
    }
    businessReason = candidate;
  }
  if (to === 'CANCELLED' && businessReason === undefined) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  if (to !== 'CANCELLED' && businessReason !== undefined) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const statusChangedAtProperty = readProperty('statusChangedAt');
  if (!statusChangedAtProperty.present) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const statusChangedAt = snapshotDateInstant(
    statusChangedAtProperty.value,
    inMemoryReceptionTimestampInvariantErrorMessage,
  );
  return Object.freeze({
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    receptionId: commandReceptionId,
    to,
    expectedVersion,
    ...(businessReason === undefined ? {} : { businessReason }),
    statusChangedAt,
  });
}


