-- WP-7302 / DOM-002 §4.2b: 処方 draft の Rp 構造化行。
--
-- rp_groups は正規化せず JSONB で保持する(WP-7302 pre-review packet D-3
-- APPROVED — content hash が draft 全体を覆う設計と一致させるため)。
-- 行 shape の検証は contracts 層が担い、DB は配列・件数の下限のみ fail-closed
-- で担保する。
--
-- prescription_draft_rows は旧構造として読み専用で残す(DOM-002 §4.2b
-- 「次版 draft から新構造のみを書く」)。INSERT/UPDATE を trigger で拒否し、
-- DELETE は構造化への移行保存時の掃除として残す。TRUNCATE は拒否。
--
-- Applying it to any environment remains an explicit operational action
-- under DB-002.

ALTER TABLE prescription_drafts
  ADD COLUMN rp_groups JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_rp_groups_shape CHECK (
    jsonb_typeof(rp_groups) = 'array' AND jsonb_array_length(rp_groups) <= 50
  );

CREATE OR REPLACE FUNCTION prescription_draft_rows_block_write()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'prescription_draft_rows is read-only; write rp_groups instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_draft_rows_block_insert
  BEFORE INSERT ON prescription_draft_rows
  FOR EACH ROW EXECUTE FUNCTION prescription_draft_rows_block_write();

CREATE TRIGGER prescription_draft_rows_block_update
  BEFORE UPDATE ON prescription_draft_rows
  FOR EACH ROW EXECUTE FUNCTION prescription_draft_rows_block_write();

CREATE TRIGGER prescription_draft_rows_truncate_guard
  BEFORE TRUNCATE ON prescription_draft_rows
  FOR EACH STATEMENT EXECUTE FUNCTION prescription_draft_rows_block_write();
