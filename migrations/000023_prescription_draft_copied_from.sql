-- WP-7304 / PRD-001 M4: 前回 Do の複製元 provenance。
-- prescription_drafts に copied_from_prescription_id / copied_from_version を
-- 追加し、複製元が確定版(prescription_versions 行)であることを複合 FK と
-- CHECK で強制する。通常 save 経路は両列 NULL のまま。
--
-- This is an additive, forward-only migration. Applying it to any environment
-- remains an explicit operational action under DB-002.

ALTER TABLE prescription_drafts
  ADD COLUMN copied_from_prescription_id TEXT,
  ADD COLUMN copied_from_version INTEGER;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_copied_from_consistent CHECK (
    (copied_from_prescription_id IS NULL AND copied_from_version IS NULL)
    OR (
      copied_from_prescription_id IS NOT NULL
      AND copied_from_version IS NOT NULL
      AND copied_from_version >= 1
    )
  );

-- 複製元は同 scope の確定版のみ(cross-scope 参照を FK で拒否)。
ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_copied_from_version_fk
    FOREIGN KEY (
      tenant_id,
      pharmacy_id,
      copied_from_prescription_id,
      copied_from_version
    )
    REFERENCES prescription_versions (
      tenant_id,
      pharmacy_id,
      prescription_id,
      version
    );
