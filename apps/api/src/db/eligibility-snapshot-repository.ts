import type { Pool } from 'pg';

import {
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isEligibilityTransitionAllowed,
  type EligibilityVerificationMethod,
  type ReceptionEligibilityState,
} from '@yrese/shared-kernel';

/**
 * 資格確認スナップショット(WP-6303/6304、SSOT: ADP-004 §2-§4、migrations/000009)。
 *
 * - append-only。訂正は新 snapshot。前 snapshot からの遷移は ADP-004 §3 の表で検証する。
 * - 受付の資格状態は snapshot から導出する: 紐づけなし = UNVERIFIED、
 *   有効期限切れ = EXPIRED(記録時 state にかかわらず)。
 * - 外部 IF は未接続(RB-002)。本 repository は「確認した事実」を記録するだけで、
 *   確認そのものは行わない。資格内容(保険者番号等)は保持せず raw_response_ref だけ持つ。
 */
export interface EligibilityScope {
  readonly tenantId: string;
  readonly pharmacyId: string;
}

export interface RecordEligibilitySnapshotInput {
  readonly snapshotId: string;
  readonly patientId: string;
  readonly verifiedMethod: EligibilityVerificationMethod | 'NONE';
  readonly state: Exclude<ReceptionEligibilityState, 'UNVERIFIED'>;
  readonly verifiedAt: Date;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly rawResponseRef?: string;
  readonly recordedBy: string;
  readonly now: Date;
}

export interface EligibilitySnapshot {
  readonly snapshotId: string;
  readonly patientId: string;
  readonly verifiedMethod: string;
  readonly state: Exclude<ReceptionEligibilityState, 'UNVERIFIED'>;
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

interface SnapshotRow {
  readonly snapshot_id: string;
  readonly patient_id: string;
  readonly verified_method: string;
  readonly state: Exclude<ReceptionEligibilityState, 'UNVERIFIED'>;
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
    verifiedAt: row.verified_at.toISOString(),
    validFrom: row.valid_from,
    validTo: row.valid_to,
  });
}

function deriveState(
  snapshot: EligibilitySnapshot | undefined,
  asOfDate: string,
): ReceptionEligibilityState {
  if (snapshot === undefined) return 'UNVERIFIED';
  if (snapshot.validTo !== null && snapshot.validTo < asOfDate)
    return 'EXPIRED';
  if (snapshot.validFrom > asOfDate) return 'EXPIRED';
  return snapshot.state;
}

const selectSnapshotColumns = `snapshot_id, patient_id, verified_method, state, verified_at,
  valid_from::text AS valid_from, valid_to::text AS valid_to`;

export class PostgresEligibilitySnapshotRepository {
  constructor(private readonly pool: Pool) {}

  async latestForPatient(
    scope: EligibilityScope,
    patientId: string,
  ): Promise<EligibilitySnapshot | undefined> {
    const result = await this.pool.query<SnapshotRow>(
      `SELECT ${selectSnapshotColumns}
         FROM eligibility_snapshots
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3
        ORDER BY sequence_number DESC
        LIMIT 1`,
      [scope.tenantId, scope.pharmacyId, patientId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : toSnapshot(row);
  }

  /** 前 snapshot からの遷移を検証して追記する。同一 tx 内で直列化する。 */
  async record(
    scope: EligibilityScope,
    input: RecordEligibilitySnapshotInput,
  ): Promise<EligibilitySnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [
          [
            'eligibility',
            scope.tenantId,
            scope.pharmacyId,
            input.patientId,
          ].join('\u001f'),
        ],
      );
      const latest = await client.query<SnapshotRow>(
        `SELECT ${selectSnapshotColumns}
           FROM eligibility_snapshots
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3
          ORDER BY sequence_number DESC LIMIT 1`,
        [scope.tenantId, scope.pharmacyId, input.patientId],
      );
      const from: ReceptionEligibilityState =
        latest.rows[0]?.state ?? 'UNVERIFIED';
      if (!isEligibilityTransitionAllowed(from, input.state)) {
        await client.query('ROLLBACK');
        throw new EligibilityTransitionError(from, input.state);
      }
      const inserted = await client.query<SnapshotRow>(
        `INSERT INTO eligibility_snapshots
           (tenant_id, pharmacy_id, snapshot_id, patient_id, verified_method, state, verified_at,
            valid_from, valid_to, raw_response_ref, recorded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12)
         RETURNING ${selectSnapshotColumns}`,
        [
          scope.tenantId,
          scope.pharmacyId,
          input.snapshotId,
          input.patientId,
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

  /** 受付を snapshot に紐づける(同一患者の snapshot のみ)。 */
  async attachToReception(
    scope: EligibilityScope,
    receptionId: string,
    snapshotId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `UPDATE reception_entries r
          SET eligibility_snapshot_id = s.snapshot_id
         FROM eligibility_snapshots s
        WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.reception_id = $3
          AND s.tenant_id = r.tenant_id AND s.pharmacy_id = r.pharmacy_id
          AND s.snapshot_id = $4 AND s.patient_id = r.patient_id`,
      [scope.tenantId, scope.pharmacyId, receptionId, snapshotId],
    );
    if (result.rowCount !== 1) {
      throw new RangeError(
        'reception or snapshot not found in scope, or patient mismatch',
      );
    }
  }

  /** 受付の資格状態を導出する(fail-closed: 紐づけなし = UNVERIFIED)。 */
  async receptionEligibility(
    scope: EligibilityScope,
    receptionId: string,
    asOfDate: string,
  ): Promise<ReceptionEligibility> {
    const result = await this.pool.query<
      SnapshotRow & { snapshot_id: string | null }
    >(
      `SELECT s.snapshot_id, s.patient_id, s.verified_method, s.state, s.verified_at,
              s.valid_from::text AS valid_from, s.valid_to::text AS valid_to
         FROM reception_entries r
         LEFT JOIN eligibility_snapshots s
           ON s.tenant_id = r.tenant_id AND s.pharmacy_id = r.pharmacy_id
          AND s.snapshot_id = r.eligibility_snapshot_id
        WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.reception_id = $3`,
      [scope.tenantId, scope.pharmacyId, receptionId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new RangeError('reception not found in scope');
    const snapshot =
      row.snapshot_id === null ? undefined : toSnapshot(row as SnapshotRow);
    const state = deriveState(snapshot, asOfDate);
    return Object.freeze({
      state,
      snapshotId: snapshot?.snapshotId ?? null,
      allowsProvisionalCalculation:
        allowsProvisionalCalculationForEligibility(state),
      allowsFinalCalculation: allowsFinalCalculationForEligibility(state),
    });
  }
}
