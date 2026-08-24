-- WP-6303/6304 independent review closure (2026-08-24).
-- * verification method and recorded state must agree (A-2): a visual check can never
--   record an online-verified state, so the final-calculation gate cannot be opened by
--   input alone.
-- * a reception may only point at a snapshot of its own patient (A-7): the FK now
--   includes patient_id, enforced by the database rather than by repository SQL.
-- * raw_response_ref is an opaque handle, never a payload (A-6).
-- * TRUNCATE is refused like UPDATE/DELETE (A-11).

ALTER TABLE eligibility_snapshots
  ADD CONSTRAINT eligibility_snapshots_method_state_consistent CHECK (
    (state = 'VERIFIED_MYNA' AND verified_method = 'MYNA_ONLINE')
    OR (state = 'VERIFIED_CARD' AND verified_method = 'CARD_ONLINE')
    OR (state = 'PROVISIONAL_VISUAL' AND verified_method = 'CARD_VISUAL')
    OR (state = 'OFFLINE_PROVISIONAL' AND verified_method = 'NONE')
    OR state IN ('EXPIRED', 'MISMATCH')
  );

ALTER TABLE eligibility_snapshots
  ADD CONSTRAINT eligibility_snapshots_raw_response_ref_opaque CHECK (
    raw_response_ref IS NULL OR raw_response_ref ~ '^[A-Za-z0-9_./-]{1,128}$'
  );

ALTER TABLE eligibility_snapshots
  ADD CONSTRAINT eligibility_snapshots_patient_snapshot_unique
  UNIQUE (tenant_id, pharmacy_id, patient_id, snapshot_id);

ALTER TABLE reception_entries
  DROP CONSTRAINT reception_entries_eligibility_snapshot_fk;

ALTER TABLE reception_entries
  ADD CONSTRAINT reception_entries_eligibility_snapshot_fk
  FOREIGN KEY (tenant_id, pharmacy_id, patient_id, eligibility_snapshot_id)
  REFERENCES eligibility_snapshots (tenant_id, pharmacy_id, patient_id, snapshot_id);

CREATE TRIGGER eligibility_snapshots_truncate_guard
BEFORE TRUNCATE ON eligibility_snapshots
FOR EACH STATEMENT EXECUTE FUNCTION eligibility_snapshots_block_mutation();
