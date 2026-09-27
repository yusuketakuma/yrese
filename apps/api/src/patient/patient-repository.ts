import {
  patientSearchResultSchema,
  type PatientSearchResult,
  type PatientVersionedSummary,
} from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  tenantId,
  type PatientId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

import {
  patientRepositoryCommandSnapshotInvariantErrorMessage,
  patientRepositoryPaginationInvariantErrorMessage,
  snapshotPatientCreateCommand,
  snapshotPatientLookupCommand,
  snapshotPatientNextCursor,
  snapshotPatientSearchCommand,
  snapshotPatientUpdateCommand,
} from './patient-snapshots.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import { compareTextByCodePoints } from '../text-order.js';
import {
  AUTO_PATIENT_NUMBER_PREFIX,
  AUTO_PATIENT_NUMBER_WIDTH,
  type PatientCreateAttributes,
  type PatientCreateInput,
  type PatientCreateResult,
  type PatientLookupInput,
  type PatientRepository,
  type PatientSearchInput,
  type PatientSearchPage,
  type PatientUpdateAttributes,
  type PatientUpdateInput,
  type PatientUpdateResult,
  comparePatientSearchOrder,
  normalizeSearchText,
  PATIENT_DUPLICATE_CANDIDATE_LIMIT,
  type SyntheticPatientRecord,
  syntheticPatients,
  toSearchResult,
  toVersionedSummary,
} from './patient-repository-support.js';

export * from './patient-repository-support.js';
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

export * from './patient-snapshots.js';

