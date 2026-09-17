-- WP-7205 / DOM-002 §4.2a: 処方箋原本 metadata(手入力値)。
--
-- 全列 nullable で後方互換を維持する。metadata は「全列 NULL」(未入力)か
-- 「必須列がすべて非 NULL」のいずれかのみ許容し、部分入力の半端な永続状態を
-- CHECK で fail-closed にする。valid_until < issue_date は拒否、
-- refill_remaining > refill_total も拒否。有効期限超過(asOf との比較)は
-- DB では拒否せず警告扱いとするため CHECK には含めない。
--
-- Applying it to any environment remains an explicit operational action
-- under DB-002.

ALTER TABLE prescription_drafts
  ADD COLUMN medical_institution_code TEXT,
  ADD COLUMN medical_institution_name TEXT,
  ADD COLUMN prescriber_name TEXT,
  ADD COLUMN issue_date DATE,
  ADD COLUMN valid_until DATE,
  ADD COLUMN refill_total INTEGER,
  ADD COLUMN refill_remaining INTEGER,
  ADD COLUMN split_dispensing TEXT;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_source_metadata_consistent CHECK (
    (
      medical_institution_code IS NULL
      AND medical_institution_name IS NULL
      AND prescriber_name IS NULL
      AND issue_date IS NULL
      AND valid_until IS NULL
      AND refill_total IS NULL
      AND refill_remaining IS NULL
      AND split_dispensing IS NULL
    )
    OR (
      issue_date IS NOT NULL
      AND valid_until IS NOT NULL
      AND valid_until >= issue_date
      AND prescriber_name IS NOT NULL
      AND medical_institution_name IS NOT NULL
      AND (
        refill_total IS NULL
        OR (
          refill_remaining IS NOT NULL
          AND refill_total BETWEEN 0 AND 999
          AND refill_remaining BETWEEN 0 AND refill_total
        )
      )
    )
  );

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_source_metadata_lengths CHECK (
    (medical_institution_code IS NULL OR char_length(medical_institution_code) <= 64)
    AND (medical_institution_name IS NULL OR char_length(medical_institution_name) <= 128)
    AND (prescriber_name IS NULL OR char_length(prescriber_name) <= 128)
    AND (split_dispensing IS NULL OR char_length(split_dispensing) <= 256)
  );
