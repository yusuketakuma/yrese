-- WP-7402 R3 review hardening (F-7/F-13/F-14): ライフサイクル不変条件の
-- 強化。000020 は identity・lifecycle-metadata 列を不変チェックに含めて
-- いなかった — 確認/確定後に直接 UPDATE で患者・受付・営業日を付け替え
-- られたり、確認者・確定者・冪等キーを書き換えられた。本 migration は
-- trigger を拡張し、child table と行削除にも post-confirm ガードを足す。
--
-- actor_qualifications.recorded_seq は created_at 同値時の決定的
-- tiebreak(F-13)。latest 判定が挿入順と一致することを保証する。
--
-- Applying it to any environment remains an explicit operational action
-- under DB-002.

-- F-7: lifecycle guard 拡張。identity 列は status 非 NULL で不変、
-- lifecycle-metadata は一度記録されたら不変(遷移 UPDATE は
-- status と metadata を同一文で立てるため、OLD 側が NULL のままの
-- 列のみ書き込み可能 — 逆行ブロックと両立する)。
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

  -- F-7: 確認・確定後の identity 付け替え禁止(患者・受付・営業日)。
  IF OLD.status IS NOT NULL AND (
    NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.reception_id IS DISTINCT FROM OLD.reception_id
    OR NEW.business_date IS DISTINCT FROM OLD.business_date
  ) THEN
    RAISE EXCEPTION 'prescription identity is immutable after pharmacist confirmation';
  END IF;

  -- F-7: ライフサイクル metadata は一度記録したら書き換え不可。
  IF OLD.confirmed_at IS NOT NULL AND (
    NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    OR NEW.confirm_idempotency_key IS DISTINCT FROM OLD.confirm_idempotency_key
  ) THEN
    RAISE EXCEPTION 'prescription confirmation record is immutable';
  END IF;
  IF OLD.finalized_at IS NOT NULL AND (
    NEW.finalized_by IS DISTINCT FROM OLD.finalized_by
    OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
    OR NEW.finalize_idempotency_key IS DISTINCT FROM OLD.finalize_idempotency_key
  ) THEN
    RAISE EXCEPTION 'prescription finalization record is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- F-14: 確認済み draft の行削除禁止(draft 自体の PUT 409 の裏付け)。
CREATE OR REPLACE FUNCTION prescription_drafts_delete_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS NOT NULL THEN
    RAISE EXCEPTION 'confirmed or finalized prescriptions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_drafts_delete_guard
  BEFORE DELETE ON prescription_drafts
  FOR EACH ROW EXECUTE FUNCTION prescription_drafts_delete_guard();

-- F-14: child table は親 status 非 NULL で全 DML 拒否。rows の DELETE は
-- 000019 で migration-on-write 掃除用に許可していたが、確認後は不可。
CREATE OR REPLACE FUNCTION prescription_draft_children_guard()
RETURNS trigger AS $$
DECLARE
  parent_status TEXT;
  parent_tenant TEXT;
  parent_pharmacy TEXT;
  parent_rx TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_tenant := OLD.tenant_id;
    parent_pharmacy := OLD.pharmacy_id;
    parent_rx := OLD.prescription_id;
  ELSE
    parent_tenant := NEW.tenant_id;
    parent_pharmacy := NEW.pharmacy_id;
    parent_rx := NEW.prescription_id;
  END IF;
  SELECT status INTO parent_status
    FROM prescription_drafts
   WHERE tenant_id = parent_tenant
     AND pharmacy_id = parent_pharmacy
     AND prescription_id = parent_rx;
  IF parent_status IS NOT NULL THEN
    RAISE EXCEPTION '% cannot be modified after pharmacist confirmation', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_draft_rows_postconfirm_guard
  BEFORE DELETE ON prescription_draft_rows
  FOR EACH ROW EXECUTE FUNCTION prescription_draft_children_guard();

CREATE TRIGGER prescription_draft_flags_postconfirm_guard
  BEFORE INSERT OR UPDATE OR DELETE ON prescription_draft_flags
  FOR EACH ROW EXECUTE FUNCTION prescription_draft_children_guard();

-- F-13: created_at 同値時の決定的 tiebreak。recorded_seq は挿入順に
-- 単調増加するため latest 判定が挿入順と必ず一致する。
ALTER TABLE actor_qualifications
  ADD COLUMN recorded_seq BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE INDEX actor_qualifications_latest_idx
  ON actor_qualifications (tenant_id, pharmacy_id, actor_id, qualification_kind, recorded_seq DESC);
