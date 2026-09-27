import {
  patientCreateRequestSchema,
  patientIdempotencyKeySchema,
  patientSearchQuerySchema,
  patientUpdateRequestSchema,
} from '@yrese/contracts';
import {
  patientId,
  userId,
  type PatientId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from '../own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from '../repository-command.js';
import type {
  PatientCreateInput,
  PatientSearchCursor,
  PatientUpdateAttributes,
  PatientUpdateInput,
} from './patient-repository-support.js';

export const patientRepositoryCommandSnapshotInvariantErrorMessage =
  'Patient repository command snapshot is invalid';
export const patientRepositoryPaginationInvariantErrorMessage =
  'Patient repository pagination snapshot is invalid';

interface PatientLookupCommandSnapshot {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
}

interface PatientSearchCommandSnapshot {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
  readonly limit: number;
  readonly offset: number;
}

export function snapshotPatientNextCursor(
  command: Readonly<Pick<PatientSearchCommandSnapshot, 'limit' | 'offset'>>,
  hasNext: boolean,
): PatientSearchCursor | undefined {
  if (!hasNext) return undefined;
  const nextOffset = command.offset + command.limit;
  if (nextOffset > Number.MAX_SAFE_INTEGER - command.limit) {
    throw new Error(patientRepositoryPaginationInvariantErrorMessage);
  }
  return Object.freeze({ offset: nextOffset });
}

function snapshotPatientId(result: OwnDataPropertyRead): PatientId {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  try {
    return patientId(result.value);
  } catch {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
}

export function snapshotPatientLookupCommand(input: unknown): PatientLookupCommandSnapshot {
  const readProperty = createOwnDataPropertyReader(
    input,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readProperty('tenantId'),
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readProperty('pharmacyId'),
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const commandPatientId = snapshotPatientId(readProperty('patientId'));
  return Object.freeze({
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    patientId: commandPatientId,
  });
}

function snapshotSearchQuery(result: OwnDataPropertyRead): string {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const parsed = patientSearchQuerySchema.shape.q.safeParse(result.value);
  if (!parsed.success) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return parsed.data;
}

function snapshotSearchLimit(result: OwnDataPropertyRead): number {
  if (!result.present || typeof result.value !== 'number') {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const parsed = patientSearchQuerySchema.shape.limit.safeParse(result.value);
  if (!parsed.success) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return parsed.data;
}

function snapshotSearchOffset(result: OwnDataPropertyRead, limit: number): number {
  if (!result.present || typeof result.value !== 'number') {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const offset = result.value;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > Number.MAX_SAFE_INTEGER - limit
  ) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return offset;
}

export function snapshotPatientSearchCommand(input: unknown): PatientSearchCommandSnapshot {
  const readProperty = createOwnDataPropertyReader(
    input,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readProperty('tenantId'),
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readProperty('pharmacyId'),
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const q = snapshotSearchQuery(readProperty('q'));
  const limit = snapshotSearchLimit(readProperty('limit'));
  const cursor = readProperty('cursor');
  let offset = 0;
  if (cursor.present && cursor.value !== undefined) {
    const readCursorProperty = createOwnDataPropertyReader(
      cursor.value,
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    );
    offset = snapshotSearchOffset(readCursorProperty('offset'), limit);
  }
  return Object.freeze({
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    q,
    limit,
    offset,
  });
}

function snapshotRequiredString(result: OwnDataPropertyRead): string {
  if (!result.present || typeof result.value !== 'string' || result.value === '') {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return result.value;
}

function snapshotActorId(result: OwnDataPropertyRead): UserId {
  try {
    return userId(snapshotRequiredString(result));
  } catch {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
}

function snapshotRecordedAt(result: OwnDataPropertyRead): string {
  const value = snapshotRequiredString(result);
  // ISO instant 形状のみ受理(具体的な瞬間の正しさは呼出側の clock 責務)。
  if (!Number.isFinite(new Date(value).getTime())) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  return value;
}

function ownReadValue(read: OwnDataPropertyRead): unknown {
  return read.present ? read.value : undefined;
}

/** POST /patients 入力の防御的 snapshot(accessor/継承/Proxy 排除 + 型検査)。 */
export function snapshotPatientCreateCommand(input: unknown): PatientCreateInput {
  const readProperty = createOwnDataPropertyReader(
    input,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const attributesRead = readProperty('attributes');
  if (!attributesRead.present || attributesRead.value === null) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const readAttribute = createOwnDataPropertyReader(
    attributesRead.value,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const patientNumberAttr = readAttribute('patientNumber');
  const attributes = patientCreateRequestSchema.safeParse({
    name: ownReadValue(readAttribute('name')),
    kana: ownReadValue(readAttribute('kana')),
    birthDate: ownReadValue(readAttribute('birthDate')),
    sex: ownReadValue(readAttribute('sex')),
    ...(patientNumberAttr.present ? { patientNumber: patientNumberAttr.value } : {}),
  });
  if (!attributes.success) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const idempotencyKey = patientIdempotencyKeySchema.safeParse(
    ownReadValue(readProperty('idempotencyKey')),
  );
  if (!idempotencyKey.success) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const requestFingerprint = readProperty('requestFingerprint');
  if (
    !requestFingerprint.present ||
    typeof requestFingerprint.value !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(requestFingerprint.value)
  ) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const patientIdValue = readProperty('patientId');
  return Object.freeze({
    tenantId: snapshotRepositoryTenantId(
      readProperty('tenantId'),
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    pharmacyId: snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    patientId: snapshotPatientId(patientIdValue),
    attributes:
      attributes.data.patientNumber === undefined
        ? {
            name: attributes.data.name,
            kana: attributes.data.kana,
            birthDate: attributes.data.birthDate,
            sex: attributes.data.sex,
          }
        : {
            name: attributes.data.name,
            kana: attributes.data.kana,
            birthDate: attributes.data.birthDate,
            sex: attributes.data.sex,
            patientNumber: attributes.data.patientNumber,
          },
    idempotencyKey: idempotencyKey.data,
    requestFingerprint: requestFingerprint.value,
    actorId: snapshotActorId(readProperty('actorId')),
    recordedAt: snapshotRecordedAt(readProperty('recordedAt')),
  });
}

/** PUT /patients/{id} 入力の防御的 snapshot。patientNumber は型に存在しない。 */
export function snapshotPatientUpdateCommand(input: unknown): PatientUpdateInput {
  const readProperty = createOwnDataPropertyReader(
    input,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const attributesRead = readProperty('attributes');
  if (!attributesRead.present || attributesRead.value === null) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const readAttribute = createOwnDataPropertyReader(
    attributesRead.value,
    patientRepositoryCommandSnapshotInvariantErrorMessage,
  );
  const nameAttr = readAttribute('name');
  const kanaAttr = readAttribute('kana');
  const birthDateAttr = readAttribute('birthDate');
  const sexAttr = readAttribute('sex');
  // 不変 field の混入は route で 422 に写像済み。ここでは契約フィールドへ
  // 限定した update schema で受理する。
  const attributes = patientUpdateRequestSchema.safeParse({
    expectedVersion: ownReadValue(readProperty('expectedVersion')),
    ...(nameAttr.present ? { name: nameAttr.value } : {}),
    ...(kanaAttr.present ? { kana: kanaAttr.value } : {}),
    ...(birthDateAttr.present ? { birthDate: birthDateAttr.value } : {}),
    ...(sexAttr.present ? { sex: sexAttr.value } : {}),
  });
  if (!attributes.success) {
    throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
  }
  const { expectedVersion, ...rawUpdatable } = attributes.data;
  const updatable: PatientUpdateAttributes = {
    ...(rawUpdatable.name === undefined ? {} : { name: rawUpdatable.name }),
    ...(rawUpdatable.kana === undefined ? {} : { kana: rawUpdatable.kana }),
    ...(rawUpdatable.birthDate === undefined
      ? {}
      : { birthDate: rawUpdatable.birthDate }),
    ...(rawUpdatable.sex === undefined ? {} : { sex: rawUpdatable.sex }),
  };
  return Object.freeze({
    tenantId: snapshotRepositoryTenantId(
      readProperty('tenantId'),
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    pharmacyId: snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    ),
    patientId: snapshotPatientId(readProperty('patientId')),
    expectedVersion,
    attributes: updatable,
    actorId: snapshotActorId(readProperty('actorId')),
    recordedAt: snapshotRecordedAt(readProperty('recordedAt')),
  });
}

