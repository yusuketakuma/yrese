ALTER TABLE patients
  ADD CONSTRAINT patients_tenant_pharmacy_patient_number_unique
  UNIQUE (tenant_id, pharmacy_id, patient_number);
