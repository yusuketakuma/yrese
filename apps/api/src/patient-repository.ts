import {
  patientCreateRequestSchema,
  patientIdempotencyKeySchema,
  patientSearchQuerySchema,
  patientSearchResultSchema,
  patientUpdateRequestSchema,
  type PatientSearchResult,
  type PatientVersionedSummary,
} from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  tenantId,
  userId,
  type PatientId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from './own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from './repository-command.js';
import { compareTextByCodePoints } from './text-order.js';

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

export interface PatientSearchCursor {
  readonly offset: number;
}

export interface PatientSearchInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
  readonly limit: number;
  readonly cursor?: PatientSearchCursor;
}

export interface PatientSearchPage {
  readonly results: readonly PatientSearchResult[];
  readonly nextCursor?: PatientSearchCursor;
}

export interface PatientRepository {
  search(input: PatientSearchInput): Promise<PatientSearchPage>;
  findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined>;
  /**
   * WP-7202: GET 詳細・write 応答用の version 付き患者要約。
   * 検索結果と同一射影 + version( PUT の CAS 入力を取得する唯一の読取り経路)。
   */
  findVersionedById(
    input: PatientLookupInput,
  ): Promise<PatientVersionedSummary | undefined>;
  create(input: PatientCreateInput): Promise<PatientCreateResult>;
  update(input: PatientUpdateInput): Promise<PatientUpdateResult>;
}

export interface PatientLookupInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
}

/** WP-7202: POST /patients の書込み属性(連絡先・備考は契約対象外)。 */
export interface PatientCreateAttributes {
  readonly name: string;
  readonly kana: string;
  readonly birthDate: string;
  readonly sex: 'male' | 'female' | 'unknown';
  readonly patientNumber?: string;
}

export interface PatientCreateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  /** サーバー採番の patientId(クライアントは指定しない)。 */
  readonly patientId: PatientId;
  readonly attributes: PatientCreateAttributes;
  readonly idempotencyKey: string;
  /** 正規化 request の fingerprint(同一 key + 異なる payload の検出用)。 */
  readonly requestFingerprint: string;
  readonly actorId: UserId;
  /** ISO instant。created_at/updated_at と監査 wallClock の基準。 */
  readonly recordedAt: string;
}

export type PatientCreateResult =
  | {
      readonly kind: 'created';
      readonly patient: PatientVersionedSummary;
      /** 同姓同名または同生年月日の既存患者(最大 PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES 件)。 */
      readonly duplicateCandidates: readonly PatientSearchResult[];
      /** 補償識別子(in-memory の巻き戻し用。Postgres は tx で巻き戻すため使わない)。 */
      readonly undo: unknown;
    }
  | {
      readonly kind: 'existing';
      readonly patient: PatientVersionedSummary;
    }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'patient_number_conflict' };

export interface PatientUpdateAttributes {
  readonly name?: string;
  readonly kana?: string;
  readonly birthDate?: string;
  readonly sex?: 'male' | 'female' | 'unknown';
}

export interface PatientUpdateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
  readonly expectedVersion: number;
  readonly attributes: PatientUpdateAttributes;
  readonly actorId: UserId;
  readonly recordedAt: string;
}

export type PatientUpdateResult =
  | {
      readonly kind: 'updated';
      readonly patient: PatientVersionedSummary;
      readonly undo: unknown;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'version_conflict'; readonly currentVersion: number };

/** サーバー採番の patientNumber 形式(P-<scope内連番6桁>)。 */
export const AUTO_PATIENT_NUMBER_PREFIX = 'P-';
export const AUTO_PATIENT_NUMBER_WIDTH = 6;
export const PATIENT_DUPLICATE_CANDIDATE_LIMIT = 5;

interface SyntheticPatientRecord extends PatientSearchResult {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly version: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

const syntheticPatients = [
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-001'),
    name: '合成患者A',
    kana: 'ゴウセイカンジャエー',
    birthDate: '1980-01-01',
    sex: 'female',
    patientNumber: 'SYN-001',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-09T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-002'),
    name: '合成患者B',
    kana: 'ゴウセイカンジャビー',
    birthDate: '1975-02-02',
    sex: 'male',
    patientNumber: 'SYN-002',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-08T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-003'),
    name: '合成患者C',
    kana: 'ゴウセイカンジャシー',
    birthDate: '1990-03-03',
    sex: 'unknown',
    patientNumber: 'SYN-003',
    version: 1,
    eligibilityStatus: 'LOCAL_ONLY_UNVERIFIED',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-004'),
    name: '合成患者D',
    kana: 'ゴウセイカンジャディー',
    birthDate: '1965-04-04',
    sex: 'female',
    patientNumber: 'SYN-004',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-005'),
    name: '合成患者E',
    kana: 'ゴウセイカンジャイー',
    birthDate: '2001-05-05',
    sex: 'male',
    patientNumber: 'SYN-005',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-07T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-006'),
    name: '合成患者F',
    kana: 'ゴウセイカンジャエフ',
    birthDate: '1988-06-06',
    sex: 'female',
    patientNumber: 'SYN-006',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-06T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-007'),
    name: '合成患者G',
    kana: 'ゴウセイカンジャジー',
    birthDate: '1970-07-07',
    sex: 'unknown',
    patientNumber: 'SYN-007',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
  {
    tenantId: tenantId('t-dev'),
    pharmacyId: pharmacyId('ph-dev'),
    patientId: patientId('patient-dev-001'),
    name: '合成開発患者A',
    kana: 'ゴウセイカイハツカンジャエー',
    birthDate: '1981-11-11',
    sex: 'female',
    patientNumber: 'DEV-001',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-09T08:16:15.000Z',
  },
  {
    tenantId: tenantId('t-dev'),
    pharmacyId: pharmacyId('ph-dev'),
    patientId: patientId('patient-dev-002'),
    name: '合成開発患者B',
    kana: 'ゴウセイカイハツカンジャビー',
    birthDate: '1992-12-12',
    sex: 'male',
    patientNumber: 'DEV-002',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-08T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-002'),
    patientId: patientId('patient-syn-008'),
    name: '合成別薬局H',
    kana: 'ゴウセイベツヤッキョクエイチ',
    birthDate: '1982-08-08',
    sex: 'male',
    patientNumber: 'SYN-008',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-05T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-002'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-009'),
    name: '合成別店I',
    kana: 'ゴウセイベツテンアイ',
    birthDate: '1995-09-09',
    sex: 'female',
    patientNumber: 'SYN-009',
    version: 1,
    eligibilityStatus: 'LOCAL_ONLY_UNVERIFIED',
  },
  {
    tenantId: tenantId('tenant-002'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-010'),
    name: '合成別店J',
    kana: 'ゴウセイベツテンジェイ',
    birthDate: '1977-10-10',
    sex: 'male',
    patientNumber: 'SYN-010',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
] as const satisfies readonly SyntheticPatientRecord[];

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function toSearchResult(record: SyntheticPatientRecord): PatientSearchResult {
  return patientSearchResultSchema.parse({
    patientId: record.patientId,
    name: record.name,
    kana: record.kana,
    birthDate: record.birthDate,
    sex: record.sex,
    patientNumber: record.patientNumber,
    eligibilityStatus: record.eligibilityStatus,
    ...(record.eligibilityCheckedAt === undefined ? {} : { eligibilityCheckedAt: record.eligibilityCheckedAt }),
  });
}

function toVersionedSummary(record: SyntheticPatientRecord): PatientVersionedSummary {
  return { ...toSearchResult(record), version: record.version };
}

function comparePatientSearchOrder(
  left: SyntheticPatientRecord,
  right: SyntheticPatientRecord,
): number {
  const patientNumberOrder = compareTextByCodePoints(
    left.patientNumber,
    right.patientNumber,
  );
  if (patientNumberOrder !== 0) return patientNumberOrder;
  return compareTextByCodePoints(left.patientId, right.patientId);
}

interface PatientIdempotencyRecord {
  readonly requestFingerprint: string;
  readonly patientId: PatientId;
}

interface PatientIdentityHistoryEntry {
  readonly patientId: PatientId;
  readonly version: number;
  readonly name: string;
  readonly kana: string;
  readonly birthDate: string;
  readonly sex: 'male' | 'female' | 'unknown';
  readonly supersededAt: string;
  readonly supersededBy: string;
}

/** update 補償の opaque トークン(旧スナップショット全体を保持)。 */
interface PatientUpdateUndo {
  readonly index: number;
  readonly previous: SyntheticPatientRecord;
  readonly historyEntry?: PatientIdentityHistoryEntry;
}

export class InMemoryPatientRepository implements PatientRepository {
  private readonly seed: readonly SyntheticPatientRecord[];
  private store: SyntheticPatientRecord[] | undefined;
  private readonly idempotencyRecords = new Map<string, PatientIdempotencyRecord>();
  private readonly identityHistory: PatientIdentityHistoryEntry[] = [];

  // WP-7202: write 経路で可変 store が必要だが、seed 配列の要素を構築時に
  // 読むと accessor を持つ hostile fixture が発火する。読取りは command 検証
  // 通過後だけに限定するため、可変コピーは初回 write 時まで遅延する。
  constructor(records: readonly SyntheticPatientRecord[] = syntheticPatients) {
    this.seed = records;
  }

  private recordsForRead(): readonly SyntheticPatientRecord[] {
    return this.store ?? this.seed;
  }

  private recordsForWrite(): SyntheticPatientRecord[] {
    this.store ??= this.seed.slice();
    return this.store;
  }

  async findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined> {
    const command = snapshotPatientLookupCommand(input);
    const record = this.recordsForRead().find(
      (candidate) =>
        candidate.tenantId === command.tenantId &&
        candidate.pharmacyId === command.pharmacyId &&
        candidate.patientId === command.patientId,
    );

    return record === undefined ? undefined : toSearchResult(record);
  }

  async findVersionedById(
    input: PatientLookupInput,
  ): Promise<PatientVersionedSummary | undefined> {
    const command = snapshotPatientLookupCommand(input);
    const record = this.recordsForRead().find(
      (candidate) =>
        candidate.tenantId === command.tenantId &&
        candidate.pharmacyId === command.pharmacyId &&
        candidate.patientId === command.patientId,
    );

    return record === undefined ? undefined : toVersionedSummary(record);
  }

  async search(input: PatientSearchInput): Promise<PatientSearchPage> {
    const command = snapshotPatientSearchCommand(input);
    const normalizedQuery = normalizeSearchText(command.q);
    const matches = this.recordsForRead()
      .filter(
        (record) =>
          record.tenantId === command.tenantId && record.pharmacyId === command.pharmacyId,
      )
      .filter((record) =>
        [record.name, record.kana, record.patientNumber].some((value) =>
          normalizeSearchText(value).includes(normalizedQuery),
        ),
      )
      .sort(comparePatientSearchOrder);
    const results = matches
      .slice(command.offset, command.offset + command.limit)
      .map(toSearchResult);
    const nextCursor = snapshotPatientNextCursor(
      command,
      command.offset + command.limit < matches.length,
    );

    return {
      results,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    };
  }

  private idempotencyScopeKey(input: PatientCreateInput): string {
    // branded ID は制御文字を含められないため NUL を区切りに使い、
    // ('a','b c') と ('a b','c') の scope 衝突を防ぐ。
    return [
      input.tenantId,
      input.pharmacyId,
      input.idempotencyKey,
    ].join(String.fromCharCode(0));
  }

  /** 同姓同名または同生年月日の既存患者(deterministic 順、上限あり)。 */
  private findDuplicateCandidates(input: PatientCreateInput): PatientSearchResult[] {
    const normalizedName = input.attributes.name.trim();
    const birthDate = input.attributes.birthDate;
    return this.recordsForRead()
      .filter(
        (record) =>
          record.tenantId === input.tenantId &&
          record.pharmacyId === input.pharmacyId &&
          (record.name === normalizedName || record.birthDate === birthDate),
      )
      .sort(comparePatientSearchOrder)
      .slice(0, PATIENT_DUPLICATE_CANDIDATE_LIMIT)
      .map(toSearchResult);
  }

  // Postgres 側は scope 内の `P-[0-9]+` 最大値+1 を採番する。件数+1 では
  // 明示 patientNumber が混在した場合に発散するため同じ規則で揃える。
  private nextAutoPatientNumber(input: PatientCreateInput): string {
    // Postgres 側の numeric(任意精度)採番と parity を取るため BigInt で数える。
    let max = 0n;
    for (const record of this.recordsForRead()) {
      if (record.tenantId !== input.tenantId || record.pharmacyId !== input.pharmacyId) {
        continue;
      }
      const match = /^P-([0-9]+)$/u.exec(record.patientNumber);
      if (match === null || match[1] === undefined) {
        continue;
      }
      const value = BigInt(match[1]);
      if (value > max) {
        max = value;
      }
    }
    return `${AUTO_PATIENT_NUMBER_PREFIX}${(max + 1n)
      .toString()
      .padStart(AUTO_PATIENT_NUMBER_WIDTH, '0')}`;
  }

  async create(input: PatientCreateInput): Promise<PatientCreateResult> {
    const command = snapshotPatientCreateCommand(input);
    const scopeKey = this.idempotencyScopeKey(command);
    const idempotency = this.idempotencyRecords.get(scopeKey);
    if (idempotency !== undefined) {
      if (idempotency.requestFingerprint !== command.requestFingerprint) {
        return { kind: 'idempotency_conflict' };
      }
      const existing = this.recordsForRead().find(
        (record) =>
          record.tenantId === command.tenantId &&
          record.pharmacyId === command.pharmacyId &&
          record.patientId === idempotency.patientId,
      );
      if (existing === undefined) {
        throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
      }
      return { kind: 'existing', patient: toVersionedSummary(existing) };
    }

    const patientNumber =
      command.attributes.patientNumber ?? this.nextAutoPatientNumber(command);
    const numberTaken = this.recordsForRead().some(
      (record) =>
        record.tenantId === command.tenantId &&
        record.pharmacyId === command.pharmacyId &&
        record.patientNumber === patientNumber,
    );
    if (numberTaken) {
      return { kind: 'patient_number_conflict' };
    }

    const duplicateCandidates = this.findDuplicateCandidates(command);
    const record: SyntheticPatientRecord = {
      tenantId: command.tenantId,
      pharmacyId: command.pharmacyId,
      patientId: command.patientId,
      name: command.attributes.name,
      kana: command.attributes.kana,
      birthDate: command.attributes.birthDate,
      sex: command.attributes.sex,
      patientNumber,
      eligibilityStatus: 'NOT_CHECKED',
      version: 1,
      createdAt: command.recordedAt,
      updatedAt: command.recordedAt,
      createdBy: command.actorId,
      updatedBy: command.actorId,
    };
    this.recordsForWrite().push(record);
    this.idempotencyRecords.set(scopeKey, {
      requestFingerprint: command.requestFingerprint,
      patientId: command.patientId,
    });
    return {
      kind: 'created',
      patient: toVersionedSummary(record),
      duplicateCandidates,
      undo: Object.freeze({ patientId: command.patientId, scopeKey }),
    };
  }

  async update(input: PatientUpdateInput): Promise<PatientUpdateResult> {
    const command = snapshotPatientUpdateCommand(input);
    const index = this.recordsForWrite().findIndex(
      (record) =>
        record.tenantId === command.tenantId &&
        record.pharmacyId === command.pharmacyId &&
        record.patientId === command.patientId,
    );
    const previous = index === -1 ? undefined : this.recordsForWrite()[index];
    if (previous === undefined) {
      return { kind: 'not_found' };
    }
    if (previous.version !== command.expectedVersion) {
      return { kind: 'version_conflict', currentVersion: previous.version };
    }

    const attributes = command.attributes;
    const identityChanged =
      (attributes.name !== undefined && attributes.name !== previous.name) ||
      (attributes.kana !== undefined && attributes.kana !== previous.kana) ||
      (attributes.birthDate !== undefined &&
        attributes.birthDate !== previous.birthDate) ||
      (attributes.sex !== undefined && attributes.sex !== previous.sex);
    let historyEntry: PatientIdentityHistoryEntry | undefined;
    if (identityChanged) {
      historyEntry = {
        patientId: patientId(previous.patientId),
        version: previous.version,
        name: previous.name,
        kana: previous.kana,
        birthDate: previous.birthDate,
        sex: previous.sex,
        supersededAt: command.recordedAt,
        supersededBy: command.actorId,
      };
      this.identityHistory.push(historyEntry);
    }
    const updated: SyntheticPatientRecord = {
      ...previous,
      ...(attributes.name === undefined ? {} : { name: attributes.name }),
      ...(attributes.kana === undefined ? {} : { kana: attributes.kana }),
      ...(attributes.birthDate === undefined
        ? {}
        : { birthDate: attributes.birthDate }),
      ...(attributes.sex === undefined ? {} : { sex: attributes.sex }),
      version: previous.version + 1,
      updatedAt: command.recordedAt,
      updatedBy: command.actorId,
    };
    this.recordsForWrite()[index] = updated;
    return {
      kind: 'updated',
      patient: toVersionedSummary(updated),
      undo: Object.freeze({
        index,
        previous,
        ...(historyEntry === undefined ? {} : { historyEntry }),
      } satisfies PatientUpdateUndo),
    };
  }

  /** create の補償(監査追記失敗時)。同一 unit of work 内の未確定 create のみ。 */
  rollbackCreated(undo: unknown): void {
    const readProperty = createOwnDataPropertyReader(
      undo,
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    );
    const target = readProperty('patientId');
    const scopeKey = readProperty('scopeKey');
    if (
      !target.present ||
      typeof target.value !== 'string' ||
      !scopeKey.present ||
      typeof scopeKey.value !== 'string'
    ) {
      throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
    }
    const index = this.recordsForWrite().findIndex(
      (record) => record.patientId === target.value,
    );
    if (index === -1) {
      throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
    }
    this.recordsForWrite().splice(index, 1);
    this.idempotencyRecords.delete(scopeKey.value);
  }

  /** update の補償(監査追記失敗時に旧スナップショットを復元)。 */
  rollbackUpdate(undo: unknown): void {
    const readProperty = createOwnDataPropertyReader(
      undo,
      patientRepositoryCommandSnapshotInvariantErrorMessage,
    );
    const indexValue = readProperty('index');
    const previousValue = readProperty('previous');
    const historyValue = readProperty('historyEntry');
    if (
      !indexValue.present ||
      typeof indexValue.value !== 'number' ||
      !previousValue.present ||
      typeof previousValue.value !== 'object' ||
      previousValue.value === null
    ) {
      throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
    }
    const previous = previousValue.value as SyntheticPatientRecord;
    if (this.recordsForWrite()[indexValue.value]?.patientId !== previous.patientId) {
      throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
    }
    this.recordsForWrite()[indexValue.value] = previous;
    // エントリ同一性で除去する — 並行 update が挟まった場合に末尾 pop だと
    // 他操作の履歴を消して自操作の残骸を残す。
    if (historyValue.present && historyValue.value !== undefined) {
      const historyIndex = this.identityHistory.lastIndexOf(
        historyValue.value as PatientIdentityHistoryEntry,
      );
      if (historyIndex === -1) {
        throw new Error(patientRepositoryCommandSnapshotInvariantErrorMessage);
      }
      this.identityHistory.splice(historyIndex, 1);
    }
  }

  /** テスト/検証用の history 参照(変更不可のコピー)。 */
  listIdentityHistory(): readonly PatientIdentityHistoryEntry[] {
    return [...this.identityHistory];
  }
}
