import type { Pool } from 'pg';

import { CalendarDate } from '@yrese/date-time';
import { snapshotDatabaseInstant } from '../instant.js';
import {
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isEligibilityMethodConsistent,
  isEligibilityTransitionAllowed,
  type EligibilityVerificationMethod,
  type ReceptionEligibilityState,
  type RecordedEligibilityState,
} from '@yrese/shared-kernel';

/**
 * 資格確認スナップショット(WP-6303/6304、SSOT: ADP-004 §2-§4、migrations/000009 + 000011)。
 *
 * - 粒度は **受付 1 件**。遷移元は当該受付に現在紐づく snapshot の導出状態(なければ
 *   UNVERIFIED)であり、患者の過去来局の状態ではない(review A-1)。
 * - append-only。記録と受付への紐づけは同一 tx で行い、紐づけの単独張り替え API は持たない
 *   (review A-3)。訂正は遷移表に従う新 snapshot。
 * - 確認方式と状態の整合を code と DB CHECK の両方で強制する(review A-2)。
 * - 暦日比較は MOD-011 の CalendarDate に委ね、asOf は 'YYYY-MM-DD'(薬局ロケール JST の
 *   業務日付)以外を拒否する(review A-5)。
 * - 外部 IF は未接続(RB-002)。本 repository は「確認した事実」を記録するだけ。
 *   資格内容(保険者番号等)は保持せず raw_response_ref(不透明 handle)だけ持つ。
 */
export interface EligibilityScope {
  readonly tenantId: string;
  readonly pharmacyId: string;
}

export interface RecordEligibilitySnapshotInput {
  readonly snapshotId: string;
  readonly verifiedMethod: EligibilityVerificationMethod;
  readonly state: RecordedEligibilityState;
  readonly verifiedAt: Date;
  /** 'YYYY-MM-DD'(業務日付)。 */
  readonly validFrom: string;
  readonly validTo?: string | null;
  readonly rawResponseRef?: string | null;
  readonly recordedBy: string;
  /** 記録時刻。遷移元の導出に使う業務日付は `asOfDate` で明示する(MOD-011)。 */
  readonly now: Date;
  readonly asOfDate: string;
}

export interface EligibilitySnapshot {
  readonly snapshotId: string;
  readonly patientId: string;
  readonly verifiedMethod: string;
  readonly state: RecordedEligibilityState;
  readonly verifiedAt: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface ReceptionEligibility {
  readonly state: ReceptionEligibilityState;
  readonly snapshotId: string | null;
  readonly allowsProvisionalCalculation: boolean;
  readonly allowsFinalCalculation: boolean;
}

export class EligibilityTransitionError extends RangeError {
  constructor(
    readonly from: ReceptionEligibilityState,
    readonly to: ReceptionEligibilityState,
  ) {
    super(`eligibility transition ${from} -> ${to} is not allowed`);
    this.name = 'EligibilityTransitionError';
  }
}

export class EligibilityMethodError extends RangeError {
  constructor(method: string, state: string) {
    super(`verification method ${method} cannot record state ${state}`);
    this.name = 'EligibilityMethodError';
  }
}

interface SnapshotRow {
  readonly snapshot_id: string;
  readonly patient_id: string;
  readonly verified_method: string;
  readonly state: RecordedEligibilityState;
  readonly verified_at: Date;
  readonly valid_from: string;
  readonly valid_to: string | null;
}

function toSnapshot(row: SnapshotRow): EligibilitySnapshot {
  return Object.freeze({
    snapshotId: row.snapshot_id,
    patientId: row.patient_id,
    verifiedMethod: row.verified_method,
    state: row.state,
    verifiedAt: snapshotDatabaseInstant(
      row.verified_at,
      'Eligibility snapshot database returned an invalid verified_at instant',
    ),
    validFrom: row.valid_from,
    validTo: row.valid_to,
  });
}

function businessDate(value: string, label: string): CalendarDate {
  try {
    return CalendarDate.fromString(value);
  } catch {
    throw new RangeError(`${label} must be a calendar date (YYYY-MM-DD)`);
  }
}

/** 有効期間外は EXPIRED(有効開始前も含む。fail-closed)。 */
export function deriveEligibilityState(
  snapshot: EligibilitySnapshot | undefined,
  asOfDate: string,
): ReceptionEligibilityState {
  const asOf = businessDate(asOfDate, 'asOfDate');
  if (snapshot === undefined) return 'UNVERIFIED';
  if (businessDate(snapshot.validFrom, 'validFrom').compare(asOf) > 0)
    return 'EXPIRED';
  if (
    snapshot.validTo !== null &&
    businessDate(snapshot.validTo, 'validTo').compare(asOf) < 0
  ) {
    return 'EXPIRED';
  }
  return snapshot.state;
}

/** DateStyle 非依存の ISO 暦日文字列(L1)。 */
const selectSnapshotColumns = `s.snapshot_id, s.patient_id, s.verified_method, s.state, s.verified_at,
  to_char(s.valid_from, 'YYYY-MM-DD') AS valid_from, to_char(s.valid_to, 'YYYY-MM-DD') AS valid_to`;

const selectReceptionSnapshotSql = `
  SELECT r.patient_id AS reception_patient_id, ${selectSnapshotColumns}
    FROM reception_entries r
    LEFT JOIN eligibility_snapshots s
      ON s.tenant_id = r.tenant_id AND s.pharmacy_id = r.pharmacy_id
     AND s.patient_id = r.patient_id AND s.snapshot_id = r.eligibility_snapshot_id
   WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.reception_id = $3`;

type ReceptionSnapshotRow = Partial<SnapshotRow> & {
  readonly reception_patient_id: string;
  readonly snapshot_id: string | null;
};

const lockKeyDelimiter = '\u001f';

export class PostgresEligibilitySnapshotRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * 受付に対して snapshot を記録し、同一 tx で受付の紐づけを更新する。
   * 遷移元は受付の現在の導出状態。受付単位で直列化する。
   */
  async recordForReception(
    scope: EligibilityScope,
    receptionId: string,
    input: RecordEligibilitySnapshotInput,
  ): Promise<EligibilitySnapshot> {
    if (!isEligibilityMethodConsistent(input.verifiedMethod, input.state)) {
      throw new EligibilityMethodError(input.verifiedMethod, input.state);
    }
    businessDate(input.validFrom, 'validFrom');
    if (input.validTo !== undefined && input.validTo !== null)
      businessDate(input.validTo, 'validTo');
    businessDate(input.asOfDate, 'asOfDate');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [
          ['eligibility', scope.tenantId, scope.pharmacyId, receptionId].join(
            lockKeyDelimiter,
          ),
        ],
      );
      const current = await client.query<ReceptionSnapshotRow>(
        selectReceptionSnapshotSql,
        [scope.tenantId, scope.pharmacyId, receptionId],
      );
      const row = current.rows[0];
      if (row === undefined)
        throw new RangeError('reception not found in scope');
      const currentSnapshot =
        row.snapshot_id === null ? undefined : toSnapshot(row as SnapshotRow);
      // 応答喪失後の同一入力リトライ(M6): 既に当該 snapshot が受付に紐づいていれば成功扱いで返す。
      if (
        currentSnapshot !== undefined &&
        currentSnapshot.snapshotId === input.snapshotId &&
        currentSnapshot.state === input.state &&
        currentSnapshot.verifiedMethod === input.verifiedMethod
      ) {
        await client.query('ROLLBACK');
        return currentSnapshot;
      }
      const from = deriveEligibilityState(currentSnapshot, input.asOfDate);
      if (!isEligibilityTransitionAllowed(from, input.state)) {
        throw new EligibilityTransitionError(from, input.state);
      }
      const inserted = await client.query<SnapshotRow>(
        `INSERT INTO eligibility_snapshots AS s
           (tenant_id, pharmacy_id, snapshot_id, patient_id, verified_method, state, verified_at,
            valid_from, valid_to, raw_response_ref, recorded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12)
         RETURNING ${selectSnapshotColumns}`,
        [
          scope.tenantId,
          scope.pharmacyId,
          input.snapshotId,
          row.reception_patient_id,
          input.verifiedMethod,
          input.state,
          input.verifiedAt,
          input.validFrom,
          input.validTo ?? null,
          input.rawResponseRef ?? null,
          input.recordedBy,
          input.now,
        ],
      );
      const attached = await client.query(
        `UPDATE reception_entries SET eligibility_snapshot_id = $4
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3
            AND eligibility_snapshot_id IS NOT DISTINCT FROM $5`,
        [
          scope.tenantId,
          scope.pharmacyId,
          receptionId,
          input.snapshotId,
          currentSnapshot?.snapshotId ?? null,
        ],
      );
      if (attached.rowCount !== 1)
        throw new RangeError('reception eligibility changed concurrently');
      await client.query('COMMIT');
      return toSnapshot(inserted.rows[0]!);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // already rolled back
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /** 受付の資格状態を導出する(fail-closed: 紐づけなし = UNVERIFIED、期間外 = EXPIRED)。 */
  async receptionEligibility(
    scope: EligibilityScope,
    receptionId: string,
    asOfDate: string,
  ): Promise<ReceptionEligibility> {
    const result = await this.pool.query<ReceptionSnapshotRow>(
      selectReceptionSnapshotSql,
      [scope.tenantId, scope.pharmacyId, receptionId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new RangeError('reception not found in scope');
    const snapshot =
      row.snapshot_id === null ? undefined : toSnapshot(row as SnapshotRow);
    const state = deriveEligibilityState(snapshot, asOfDate);
    return Object.freeze({
      state,
      snapshotId: snapshot?.snapshotId ?? null,
      allowsProvisionalCalculation:
        allowsProvisionalCalculationForEligibility(state),
      allowsFinalCalculation: allowsFinalCalculationForEligibility(state),
    });
  }
}
