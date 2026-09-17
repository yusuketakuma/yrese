-- WP-7203 / API-020 0.1.0: 保険・公費(Coverage)登録の永続化基盤。
-- insurance_cards / public_expense_certificates は append-only(UPDATE/DELETE/
-- TRUNCATE を trigger で拒否 — eligibility_snapshots の block_mutation と同型)。
-- 訂正・失効は supersedes_id を持つ新規行で行い、supersededBy は
-- 「その行を supersede する行の存在」から導出する(旧行の UPDATE は禁止のため)。
-- coverage_create_idempotency は POST の Idempotency-Key 記録。一意性境界は
-- (tenant, pharmacy, patient, key) — API-020 §2。

CREATE TABLE insurance_cards (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  insurance_card_id TEXT NOT NULL,
  insurer_number TEXT NOT NULL,
  insured_symbol TEXT NOT NULL,
  insured_number TEXT NOT NULL,
  branch_number TEXT,
  relationship TEXT NOT NULL,
  copay_ratio NUMERIC NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  supersedes_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  CONSTRAINT insurance_cards_pk
    PRIMARY KEY (tenant_id, pharmacy_id, insurance_card_id),
  CONSTRAINT insurance_cards_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT insurance_cards_supersedes_fk
    FOREIGN KEY (tenant_id, pharmacy_id, supersedes_id)
    REFERENCES insurance_cards (tenant_id, pharmacy_id, insurance_card_id),
  CONSTRAINT insurance_cards_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT insurance_cards_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT insurance_cards_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT insurance_cards_id_non_empty CHECK (length(insurance_card_id) > 0),
  CONSTRAINT insurance_cards_insurer_number_non_empty CHECK (length(insurer_number) > 0),
  CONSTRAINT insurance_cards_insured_symbol_non_empty CHECK (length(insured_symbol) > 0),
  CONSTRAINT insurance_cards_insured_number_non_empty CHECK (length(insured_number) > 0),
  CONSTRAINT insurance_cards_relationship_check CHECK (relationship IN ('self', 'family')),
  CONSTRAINT insurance_cards_copay_ratio_range CHECK (copay_ratio > 0 AND copay_ratio < 1),
  CONSTRAINT insurance_cards_valid_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT insurance_cards_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> insurance_card_id),
  CONSTRAINT insurance_cards_recorded_by_non_empty CHECK (length(recorded_by) > 0)
);

-- 同一 target を 2 行が supersede することを DB 制約でも拒否(INS-0005 の補強)。
CREATE UNIQUE INDEX insurance_cards_supersedes_unique
  ON insurance_cards (tenant_id, pharmacy_id, supersedes_id)
  WHERE supersedes_id IS NOT NULL;

-- GET と overlap 検証の患者 scope 走査を index で支える。
CREATE INDEX insurance_cards_patient_scope_idx
  ON insurance_cards (tenant_id, pharmacy_id, patient_id);

CREATE TABLE public_expense_certificates (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  public_expense_id TEXT NOT NULL,
  payer_number TEXT NOT NULL,
  recipient_number TEXT NOT NULL,
  priority INTEGER NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  supersedes_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  CONSTRAINT public_expense_certificates_pk
    PRIMARY KEY (tenant_id, pharmacy_id, public_expense_id),
  CONSTRAINT public_expense_certificates_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT public_expense_certificates_supersedes_fk
    FOREIGN KEY (tenant_id, pharmacy_id, supersedes_id)
    REFERENCES public_expense_certificates (tenant_id, pharmacy_id, public_expense_id),
  CONSTRAINT public_expense_certificates_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT public_expense_certificates_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT public_expense_certificates_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT public_expense_certificates_id_non_empty CHECK (length(public_expense_id) > 0),
  CONSTRAINT public_expense_certificates_payer_number_non_empty CHECK (length(payer_number) > 0),
  CONSTRAINT public_expense_certificates_recipient_number_non_empty CHECK (length(recipient_number) > 0),
  CONSTRAINT public_expense_certificates_priority_positive CHECK (priority >= 1),
  CONSTRAINT public_expense_certificates_valid_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT public_expense_certificates_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> public_expense_id),
  CONSTRAINT public_expense_certificates_recorded_by_non_empty CHECK (length(recorded_by) > 0)
);

CREATE UNIQUE INDEX public_expense_certificates_supersedes_unique
  ON public_expense_certificates (tenant_id, pharmacy_id, supersedes_id)
  WHERE supersedes_id IS NOT NULL;

CREATE INDEX public_expense_certificates_patient_scope_idx
  ON public_expense_certificates (tenant_id, pharmacy_id, patient_id);

CREATE TABLE coverage_create_idempotency (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_kind TEXT NOT NULL,
  result_row_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT coverage_create_idempotency_pk
    PRIMARY KEY (tenant_id, pharmacy_id, patient_id, idempotency_key),
  CONSTRAINT coverage_create_idempotency_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT coverage_create_idempotency_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT coverage_create_idempotency_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT coverage_create_idempotency_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT coverage_create_idempotency_key_non_empty CHECK (length(idempotency_key) > 0),
  CONSTRAINT coverage_create_idempotency_fingerprint_non_empty CHECK (length(request_fingerprint) > 0),
  CONSTRAINT coverage_create_idempotency_result_kind_check CHECK (result_kind IN ('insurance-card', 'public-expense')),
  CONSTRAINT coverage_create_idempotency_result_row_id_non_empty CHECK (length(result_row_id) > 0)
);

CREATE OR REPLACE FUNCTION coverage_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'coverage tables are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insurance_cards_block_update
  BEFORE UPDATE ON insurance_cards
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER insurance_cards_block_delete
  BEFORE DELETE ON insurance_cards
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER insurance_cards_truncate_guard
  BEFORE TRUNCATE ON insurance_cards
  FOR EACH STATEMENT EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER public_expense_certificates_block_update
  BEFORE UPDATE ON public_expense_certificates
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER public_expense_certificates_block_delete
  BEFORE DELETE ON public_expense_certificates
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER public_expense_certificates_truncate_guard
  BEFORE TRUNCATE ON public_expense_certificates
  FOR EACH STATEMENT EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER coverage_create_idempotency_block_update
  BEFORE UPDATE ON coverage_create_idempotency
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER coverage_create_idempotency_block_delete
  BEFORE DELETE ON coverage_create_idempotency
  FOR EACH ROW EXECUTE FUNCTION coverage_block_mutation();

CREATE TRIGGER coverage_create_idempotency_truncate_guard
  BEFORE TRUNCATE ON coverage_create_idempotency
  FOR EACH STATEMENT EXECUTE FUNCTION coverage_block_mutation();
