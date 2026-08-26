-- Prescription draft persistence (DOM-002 §4 / DOM-004).
--
-- This is an additive, forward-only migration. It does not backfill or infer
-- prescription history from reception records. Applying it to any environment
-- remains an explicit operational action under DB-002.

ALTER TABLE reception_entries
  ADD CONSTRAINT reception_entries_scope_reception_patient_date_unique
  UNIQUE (tenant_id, pharmacy_id, reception_id, patient_id, business_date);

CREATE TABLE prescription_drafts (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  reception_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  business_date DATE NOT NULL,
  version INTEGER NOT NULL,
  prescription_type TEXT NOT NULL,
  prescription_date DATE,
  default_days INTEGER,
  note TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  CONSTRAINT prescription_drafts_pk
    PRIMARY KEY (tenant_id, pharmacy_id, prescription_id),
  CONSTRAINT prescription_drafts_reception_unique
    UNIQUE (tenant_id, pharmacy_id, reception_id),
  CONSTRAINT prescription_drafts_reception_patient_fk
    FOREIGN KEY (
      tenant_id,
      pharmacy_id,
      reception_id,
      patient_id,
      business_date
    )
    REFERENCES reception_entries (
      tenant_id,
      pharmacy_id,
      reception_id,
      patient_id,
      business_date
    ),
  CONSTRAINT prescription_drafts_tenant_non_empty
    CHECK (length(tenant_id) > 0),
  CONSTRAINT prescription_drafts_pharmacy_non_empty
    CHECK (length(pharmacy_id) > 0),
  CONSTRAINT prescription_drafts_id_non_empty
    CHECK (length(prescription_id) > 0),
  CONSTRAINT prescription_drafts_reception_non_empty
    CHECK (length(reception_id) > 0),
  CONSTRAINT prescription_drafts_patient_non_empty
    CHECK (length(patient_id) > 0),
  CONSTRAINT prescription_drafts_version_positive
    CHECK (version BETWEEN 1 AND 2147483647),
  CONSTRAINT prescription_drafts_type_check
    CHECK (prescription_type IN ('UNSPECIFIED', 'OUTPATIENT', 'HOME')),
  CONSTRAINT prescription_drafts_default_days_check
    CHECK (default_days IS NULL OR default_days BETWEEN 1 AND 999),
  CONSTRAINT prescription_drafts_note_length
    CHECK (char_length(note) <= 2000),
  CONSTRAINT prescription_drafts_hash_check
    CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT prescription_drafts_created_by_non_empty
    CHECK (length(created_by) > 0),
  CONSTRAINT prescription_drafts_updated_by_non_empty
    CHECK (length(updated_by) > 0),
  CONSTRAINT prescription_drafts_time_order
    CHECK (updated_at >= created_at)
);

CREATE TABLE prescription_draft_rows (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  row_sequence INTEGER NOT NULL,
  drug_text TEXT NOT NULL,
  usage_text TEXT NOT NULL,
  days INTEGER,
  quantity_text TEXT NOT NULL,
  CONSTRAINT prescription_draft_rows_pk
    PRIMARY KEY (tenant_id, pharmacy_id, prescription_id, row_sequence),
  CONSTRAINT prescription_draft_rows_draft_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id)
    REFERENCES prescription_drafts (tenant_id, pharmacy_id, prescription_id)
    ON DELETE CASCADE,
  CONSTRAINT prescription_draft_rows_sequence_check
    CHECK (row_sequence BETWEEN 1 AND 100),
  CONSTRAINT prescription_draft_rows_drug_length
    CHECK (char_length(drug_text) <= 256),
  CONSTRAINT prescription_draft_rows_usage_length
    CHECK (char_length(usage_text) <= 256),
  CONSTRAINT prescription_draft_rows_days_check
    CHECK (days IS NULL OR days BETWEEN 1 AND 999),
  CONSTRAINT prescription_draft_rows_quantity_length
    CHECK (char_length(quantity_text) <= 64)
);

CREATE TABLE prescription_draft_flags (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  flag TEXT NOT NULL,
  CONSTRAINT prescription_draft_flags_pk
    PRIMARY KEY (tenant_id, pharmacy_id, prescription_id, flag),
  CONSTRAINT prescription_draft_flags_draft_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id)
    REFERENCES prescription_drafts (tenant_id, pharmacy_id, prescription_id)
    ON DELETE CASCADE,
  CONSTRAINT prescription_draft_flags_value_check
    CHECK (
      flag IN (
        'PACKAGING',
        'HOME_CARE',
        'NARCOTIC',
        'PSYCHOTROPIC',
        'LEFTOVER_ADJUSTMENT'
      )
    )
);
