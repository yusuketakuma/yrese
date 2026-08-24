-- WP-6303 / WP-6304 eligibility snapshots (SSOT: ADP-004 online_qualification_boundary §2-§3,
-- APPROVED 2026-08-23). Synthetic stub: no external interface is connected (RB-002).
--
-- * append-only: a correction is a new snapshot, never an UPDATE/DELETE (ADP-004 §2, §8);
-- * the snapshot carries the verification method, the derived reception state at the time
--   of recording, the validity window, and an opaque reference to the encrypted raw
--   response store — never the insurer number, symbol/number, or copay ratio in clear;
-- * a reception points at the snapshot it was verified against; NULL means UNVERIFIED.

CREATE TABLE eligibility_snapshots (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  verified_method TEXT NOT NULL,
  state TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  raw_response_ref TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  sequence_number BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT eligibility_snapshots_pk PRIMARY KEY (tenant_id, pharmacy_id, snapshot_id),
  CONSTRAINT eligibility_snapshots_patient_fk FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT eligibility_snapshots_sequence_unique UNIQUE (sequence_number),
  CONSTRAINT eligibility_snapshots_method_check CHECK (
    verified_method IN ('MYNA_ONLINE', 'CARD_ONLINE', 'CARD_VISUAL', 'NONE')
  ),
  CONSTRAINT eligibility_snapshots_state_check CHECK (
    state IN ('VERIFIED_MYNA', 'VERIFIED_CARD', 'PROVISIONAL_VISUAL', 'OFFLINE_PROVISIONAL', 'EXPIRED', 'MISMATCH')
  ),
  CONSTRAINT eligibility_snapshots_validity_check CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT eligibility_snapshots_snapshot_id_non_empty CHECK (length(snapshot_id) > 0)
);

CREATE INDEX eligibility_snapshots_patient_idx
  ON eligibility_snapshots (tenant_id, pharmacy_id, patient_id, sequence_number DESC);

CREATE FUNCTION eligibility_snapshots_block_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'eligibility_snapshots are append-only; record a new snapshot instead';
END;
$$;

CREATE TRIGGER eligibility_snapshots_mutation_guard
BEFORE UPDATE OR DELETE ON eligibility_snapshots
FOR EACH ROW EXECUTE FUNCTION eligibility_snapshots_block_mutation();

ALTER TABLE reception_entries
  ADD COLUMN eligibility_snapshot_id TEXT;

ALTER TABLE reception_entries
  ADD CONSTRAINT reception_entries_eligibility_snapshot_fk
  FOREIGN KEY (tenant_id, pharmacy_id, eligibility_snapshot_id)
  REFERENCES eligibility_snapshots (tenant_id, pharmacy_id, snapshot_id);
