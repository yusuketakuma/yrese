-- eligibility_status and reception_status CHECK value lists were generated from
-- @yrese/shared-kernel const tuples at migration creation time. Migrations are
-- immutable; future tuple changes require a new forward migration.

CREATE TABLE patients (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL,
  patient_number TEXT NOT NULL,
  eligibility_status TEXT NOT NULL,
  eligibility_checked_at TIMESTAMPTZ,
  CONSTRAINT patients_pk PRIMARY KEY (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT patients_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT patients_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT patients_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT patients_name_non_empty CHECK (length(name) > 0),
  CONSTRAINT patients_kana_non_empty CHECK (length(kana) > 0),
  CONSTRAINT patients_patient_number_non_empty CHECK (length(patient_number) > 0),
  CONSTRAINT patients_sex_check CHECK (sex IN ('male', 'female', 'unknown')),
  CONSTRAINT patients_eligibility_status_check CHECK (
    eligibility_status IN ('VERIFIED', 'PENDING_REVERIFY', 'LOCAL_ONLY_UNVERIFIED', 'NOT_CHECKED')
  )
);

CREATE INDEX patients_search_idx ON patients (tenant_id, pharmacy_id, patient_number);

CREATE TABLE reception_entries (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  reception_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL,
  business_date DATE NOT NULL,
  reception_status TEXT NOT NULL,
  prescription_intake_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  CONSTRAINT reception_entries_pk PRIMARY KEY (tenant_id, pharmacy_id, reception_id),
  CONSTRAINT reception_entries_patient_fk
    FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
    REFERENCES patients (tenant_id, pharmacy_id, patient_id),
  CONSTRAINT reception_entries_idempotency_unique UNIQUE (tenant_id, pharmacy_id, idempotency_key),
  CONSTRAINT reception_entries_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT reception_entries_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT reception_entries_reception_id_non_empty CHECK (length(reception_id) > 0),
  CONSTRAINT reception_entries_patient_id_non_empty CHECK (length(patient_id) > 0),
  CONSTRAINT reception_entries_idempotency_key_non_empty CHECK (length(idempotency_key) > 0),
  CONSTRAINT reception_entries_reception_status_check CHECK (
    reception_status IN ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT reception_entries_prescription_intake_type_check CHECK (prescription_intake_type IN ('paper'))
);

CREATE INDEX reception_entries_queue_idx
  ON reception_entries (tenant_id, pharmacy_id, business_date, accepted_at, reception_id);
