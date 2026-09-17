-- WP-7202 / API-001 0.3.0: 患者登録・更新の永続化基盤。
-- version は PUT の If-Match/expectedVersion CAS 対象(更新ごとに単調増加)。
-- identity field(氏名・カナ・生年月日・性別)の変更は patient_identity_history へ
-- 旧値を append-only で記録する(UPDATE/DELETE 経路なし、C-029 の pre-cutover 規律)。
-- patient_create_idempotency は POST /patients の Idempotency-Key 記録
-- (reception_entries の方式と同型 + request fingerprint 保持列)。

ALTER TABLE patients
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN created_at TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ,
  ADD COLUMN created_by TEXT,
  ADD COLUMN updated_by TEXT;

ALTER TABLE patients
  ADD CONSTRAINT patients_version_positive CHECK (version >= 1);

CREATE TABLE patient_identity_history (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL,
  superseded_at TIMESTAMPTZ NOT NULL,
  superseded_by TEXT NOT NULL,
  CONSTRAINT patient_identity_history_pk
    PRIMARY KEY (tenant_id, pharmacy_id, patient_id, version),
  CONSTRAINT patient_identity_history_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT patient_identity_history_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT patient_identity_history_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT patient_identity_history_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT patient_identity_history_version_positive CHECK (version >= 1),
  CONSTRAINT patient_identity_history_sex_check CHECK (sex IN ('male', 'female', 'unknown')),
  CONSTRAINT patient_identity_history_superseded_by_non_empty CHECK (length(superseded_by) > 0)
);

CREATE TABLE patient_create_idempotency (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT patient_create_idempotency_pk
    PRIMARY KEY (tenant_id, pharmacy_id, idempotency_key),
  CONSTRAINT patient_create_idempotency_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT patient_create_idempotency_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT patient_create_idempotency_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT patient_create_idempotency_key_non_empty CHECK (length(idempotency_key) > 0),
  CONSTRAINT patient_create_idempotency_fingerprint_non_empty CHECK (length(request_fingerprint) > 0),
  CONSTRAINT patient_create_idempotency_patient_id_non_empty CHECK (length(patient_id) > 0)
);

-- append-only 強制: eligibility_snapshots の block_mutation と同型。
CREATE OR REPLACE FUNCTION patient_identity_history_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'patient_identity_history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_identity_history_block_update
  BEFORE UPDATE ON patient_identity_history
  FOR EACH ROW EXECUTE FUNCTION patient_identity_history_block_mutation();

CREATE TRIGGER patient_identity_history_block_delete
  BEFORE DELETE ON patient_identity_history
  FOR EACH ROW EXECUTE FUNCTION patient_identity_history_block_mutation();

CREATE TRIGGER patient_identity_history_truncate_guard
  BEFORE TRUNCATE ON patient_identity_history
  FOR EACH STATEMENT EXECUTE FUNCTION patient_identity_history_block_mutation();

CREATE OR REPLACE FUNCTION patient_create_idempotency_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'patient_create_idempotency is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_create_idempotency_block_update
  BEFORE UPDATE ON patient_create_idempotency
  FOR EACH ROW EXECUTE FUNCTION patient_create_idempotency_block_mutation();

CREATE TRIGGER patient_create_idempotency_block_delete
  BEFORE DELETE ON patient_create_idempotency
  FOR EACH ROW EXECUTE FUNCTION patient_create_idempotency_block_mutation();

CREATE TRIGGER patient_create_idempotency_truncate_guard
  BEFORE TRUNCATE ON patient_create_idempotency
  FOR EACH STATEMENT EXECUTE FUNCTION patient_create_idempotency_block_mutation();
