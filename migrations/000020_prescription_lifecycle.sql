-- WP-7402 / DOM-004 §1 / MOD-005 §2.3 / SEC-010: 処方確認・確定ライフサイクル。
--
-- prescription_drafts.status はライフサイクル遷移先のみを保持する
-- (NULL = draft = ライフサイクル未開始)。遷移は NULL → PHARMACIST_CONFIRMED →
-- PRESCRIPTION_FINALIZED の単方向のみで、trigger で逆行・スキップを拒否する。
-- status 非 NULL の行は content 列の変更を拒否し、確認・確定対象の不変性を
-- DB 層でも保証する(draft PUT 拒否の fail-closed 裏付け)。
--
-- prescription_versions は確定時点の immutable snapshot(append-only)。
-- actor_qualifications は SEC-010 の資格 evidence 参照表。登録・取消の
-- 管理経路は本 WP に含めず、read 側ガードのみが参照する(append-only)。
--
-- Applying it to any environment remains an explicit operational action
-- under DB-002.

ALTER TABLE prescription_drafts
  ADD COLUMN status TEXT,
  ADD COLUMN confirmed_by TEXT,
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN finalized_by TEXT,
  ADD COLUMN finalized_at TIMESTAMPTZ,
  ADD COLUMN confirm_idempotency_key TEXT,
  ADD COLUMN finalize_idempotency_key TEXT;

ALTER TABLE prescription_drafts
  ADD CONSTRAINT prescription_drafts_lifecycle_consistent CHECK (
    (
      status IS NULL
      AND confirmed_by IS NULL
      AND confirmed_at IS NULL
      AND finalized_by IS NULL
      AND finalized_at IS NULL
    )
    OR (
      status = 'PHARMACIST_CONFIRMED'
      AND confirmed_by IS NOT NULL
      AND confirmed_at IS NOT NULL
      AND finalized_by IS NULL
      AND finalized_at IS NULL
    )
    OR (
      status = 'PRESCRIPTION_FINALIZED'
      AND confirmed_by IS NOT NULL
      AND confirmed_at IS NOT NULL
      AND finalized_by IS NOT NULL
      AND finalized_at IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION prescription_drafts_lifecycle_guard()
RETURNS trigger AS $$
BEGIN
  -- 逆行・スキップ・終端超過の拒否(DOM-004 §1 単方向)。
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status IS NULL AND NEW.status = 'PHARMACIST_CONFIRMED')
      OR (OLD.status = 'PHARMACIST_CONFIRMED' AND NEW.status = 'PRESCRIPTION_FINALIZED')
    ) THEN
      RAISE EXCEPTION 'invalid prescription lifecycle transition: % -> %',
        COALESCE(OLD.status, 'DRAFT'), COALESCE(NEW.status, 'NULL');
    END IF;
  END IF;

  -- 確認・確定後の content 改変禁止(確定対象の不変性)。
  IF OLD.status IS NOT NULL AND (
    NEW.version IS DISTINCT FROM OLD.version
    OR NEW.prescription_type IS DISTINCT FROM OLD.prescription_type
    OR NEW.prescription_date IS DISTINCT FROM OLD.prescription_date
    OR NEW.default_days IS DISTINCT FROM OLD.default_days
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.rp_groups IS DISTINCT FROM OLD.rp_groups
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.medical_institution_code IS DISTINCT FROM OLD.medical_institution_code
    OR NEW.medical_institution_name IS DISTINCT FROM OLD.medical_institution_name
    OR NEW.prescriber_name IS DISTINCT FROM OLD.prescriber_name
    OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.refill_total IS DISTINCT FROM OLD.refill_total
    OR NEW.refill_remaining IS DISTINCT FROM OLD.refill_remaining
    OR NEW.split_dispensing IS DISTINCT FROM OLD.split_dispensing
  ) THEN
    RAISE EXCEPTION 'prescription content is immutable after pharmacist confirmation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_drafts_lifecycle_guard
  BEFORE UPDATE ON prescription_drafts
  FOR EACH ROW EXECUTE FUNCTION prescription_drafts_lifecycle_guard();

CREATE TABLE prescription_versions (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  content_hash CHAR(64) NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  finalized_by TEXT NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT prescription_versions_pk
    PRIMARY KEY (tenant_id, pharmacy_id, prescription_id, version),
  CONSTRAINT prescription_versions_draft_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id)
    REFERENCES prescription_drafts (tenant_id, pharmacy_id, prescription_id),
  CONSTRAINT prescription_versions_version_positive CHECK (version >= 1),
  CONSTRAINT prescription_versions_tenant_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT prescription_versions_pharmacy_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT prescription_versions_content_shape CHECK (jsonb_typeof(content) = 'object')
);

CREATE INDEX prescription_versions_scope_idx
  ON prescription_versions (tenant_id, pharmacy_id, prescription_id);

CREATE TABLE actor_qualifications (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  qualification_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  qualification_kind TEXT NOT NULL,
  license_ref TEXT,
  status TEXT NOT NULL,
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT actor_qualifications_pk
    PRIMARY KEY (tenant_id, pharmacy_id, qualification_id),
  CONSTRAINT actor_qualifications_kind CHECK (
    qualification_kind = 'PHARMACIST_LICENSE'
  ),
  CONSTRAINT actor_qualifications_status CHECK (
    status IN ('ACTIVE', 'REVOKED')
  ),
  CONSTRAINT actor_qualifications_tenant_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT actor_qualifications_pharmacy_non_empty CHECK (length(pharmacy_id) > 0)
);

CREATE INDEX actor_qualifications_actor_idx
  ON actor_qualifications (tenant_id, pharmacy_id, actor_id, qualification_kind);

CREATE OR REPLACE FUNCTION lifecycle_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_versions_block_update
  BEFORE UPDATE ON prescription_versions
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER prescription_versions_block_delete
  BEFORE DELETE ON prescription_versions
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER prescription_versions_truncate_guard
  BEFORE TRUNCATE ON prescription_versions
  FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_append_only_guard();

CREATE TRIGGER actor_qualifications_block_update
  BEFORE UPDATE ON actor_qualifications
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER actor_qualifications_block_delete
  BEFORE DELETE ON actor_qualifications
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER actor_qualifications_truncate_guard
  BEFORE TRUNCATE ON actor_qualifications
  FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_append_only_guard();

-- outbox intent の aggregate 拡張(000007 §2 の規定どおり CHECK と FK を一体で
-- 置き換える): prescription.finalized は aggregate_type='prescription' で
-- aggregate_id は prescription_drafts を指す。FK は aggregate_type ごとに参照先が
-- 異なるため trigger ベースの存在検証へ置き換える(INSERT 時のみ・append-only の
-- ため UPDATE は発生しない)。
ALTER TABLE outbox_events
  DROP CONSTRAINT outbox_events_reception_fk;
ALTER TABLE outbox_events
  DROP CONSTRAINT outbox_events_aggregate_type_reception;
ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_aggregate_type_allowed
  CHECK (aggregate_type IN ('reception', 'prescription'));

CREATE OR REPLACE FUNCTION outbox_events_aggregate_exists()
RETURNS trigger AS $$
BEGIN
  IF NEW.aggregate_type = 'reception' THEN
    IF NOT EXISTS (
      SELECT 1 FROM reception_entries
       WHERE tenant_id = NEW.tenant_id
         AND pharmacy_id = NEW.pharmacy_id
         AND reception_id = NEW.aggregate_id
    ) THEN
      RAISE EXCEPTION 'outbox_events aggregate does not exist: reception %',
        NEW.aggregate_id;
    END IF;
  ELSIF NEW.aggregate_type = 'prescription' THEN
    IF NOT EXISTS (
      SELECT 1 FROM prescription_drafts
       WHERE tenant_id = NEW.tenant_id
         AND pharmacy_id = NEW.pharmacy_id
         AND prescription_id = NEW.aggregate_id
    ) THEN
      RAISE EXCEPTION 'outbox_events aggregate does not exist: prescription %',
        NEW.aggregate_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'outbox_events aggregate type not allowed: %',
      NEW.aggregate_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER outbox_events_aggregate_guard
  BEFORE INSERT ON outbox_events
  FOR EACH ROW EXECUTE FUNCTION outbox_events_aggregate_exists();
