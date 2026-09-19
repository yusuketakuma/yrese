-- WP-7404 / API-021 / DOM-002 §5: 調剤記録(DispensingRecord)。
--
-- dispensing_records は確定処方版(prescription_versions)を複合 FK で参照し、
-- 1 版 1 記録を一意制約で強制する。status は NULL → 'DISPENSING_RECORDED' の
-- 単方向のみ。dispensing_items は常時 append-only(実施記録の改変・削除を
-- DB 層で拒否する)。

CREATE TABLE dispensing_records (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  dispensing_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  prescription_version INTEGER NOT NULL,
  dispensing_date DATE NOT NULL,
  status TEXT,
  idempotency_key TEXT NOT NULL,
  confirm_idempotency_key TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  -- replay 等価比較用の create request 正規化 JSON(RX-0010 規則)。
  create_request JSONB NOT NULL,
  CONSTRAINT dispensing_records_pk
    PRIMARY KEY (tenant_id, pharmacy_id, dispensing_id),
  CONSTRAINT dispensing_records_version_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id, prescription_version)
    REFERENCES prescription_versions
      (tenant_id, pharmacy_id, prescription_id, version),
  CONSTRAINT dispensing_records_version_positive
    CHECK (prescription_version >= 1),
  CONSTRAINT dispensing_records_status_allowed
    CHECK (status IS NULL OR status = 'DISPENSING_RECORDED'),
  CONSTRAINT dispensing_records_confirmed_consistency
    CHECK (
      (status IS NULL AND confirmed_by IS NULL AND confirmed_at IS NULL
        AND confirm_idempotency_key IS NULL)
      OR (status = 'DISPENSING_RECORDED' AND confirmed_by IS NOT NULL
        AND confirmed_at IS NOT NULL AND confirm_idempotency_key IS NOT NULL)
    ),
  CONSTRAINT dispensing_records_tenant_non_empty
    CHECK (length(tenant_id) > 0),
  CONSTRAINT dispensing_records_pharmacy_non_empty
    CHECK (length(pharmacy_id) > 0),
  CONSTRAINT dispensing_records_idempotency_key_non_empty
    CHECK (length(idempotency_key) > 0),
  CONSTRAINT dispensing_records_created_by_non_empty
    CHECK (length(created_by) > 0),
  CONSTRAINT dispensing_records_updated_by_non_empty
    CHECK (length(updated_by) > 0),
  CONSTRAINT dispensing_records_updated_at_order
    CHECK (updated_at >= created_at)
);

-- 1 版 1 調剤記録(D-2)。訂正後の再調剤は amend 新版(v>=2)へ行う。
CREATE UNIQUE INDEX dispensing_records_version_unique
  ON dispensing_records (tenant_id, pharmacy_id, prescription_id, prescription_version);

-- create 冪等 key は scope 内一意(WP-7402/7403 と同規則)。
CREATE UNIQUE INDEX dispensing_records_idempotency_unique
  ON dispensing_records (tenant_id, pharmacy_id, idempotency_key);

-- confirm 冪等 key も scope 内一意(API-021 §5)。NULL(未確認)は重複を許す。
CREATE UNIQUE INDEX dispensing_records_confirm_idempotency_unique
  ON dispensing_records (tenant_id, pharmacy_id, confirm_idempotency_key);

CREATE INDEX dispensing_records_prescription_idx
  ON dispensing_records (tenant_id, pharmacy_id, prescription_id);

CREATE TABLE dispensing_items (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  dispensing_id TEXT NOT NULL,
  rp_item_id TEXT NOT NULL,
  prescribed_medication_item_id TEXT,
  dispensed_medication_item_id TEXT,
  dispensed_text TEXT,
  quantity TEXT NOT NULL,
  remaining_stock_adjustment TEXT,
  note TEXT,
  dispensed_by TEXT NOT NULL,
  CONSTRAINT dispensing_items_pk
    PRIMARY KEY (tenant_id, pharmacy_id, dispensing_id, rp_item_id),
  CONSTRAINT dispensing_items_record_fk
    FOREIGN KEY (tenant_id, pharmacy_id, dispensing_id)
    REFERENCES dispensing_records (tenant_id, pharmacy_id, dispensing_id),
  CONSTRAINT dispensing_items_dispensed_xor
    CHECK (
      (dispensed_medication_item_id IS NOT NULL AND dispensed_text IS NULL)
      OR (dispensed_medication_item_id IS NULL AND dispensed_text IS NOT NULL)
    ),
  CONSTRAINT dispensing_items_quantity_non_empty
    CHECK (length(quantity) > 0)
);

CREATE INDEX dispensing_items_record_idx
  ON dispensing_items (tenant_id, pharmacy_id, dispensing_id);

-- 不変条件: record の status は NULL → 'DISPENSING_RECORDED' 単方向のみ、
-- identity/参照列は不変。items は常時 append-only。
-- lifecycle_append_only_guard は 000020 で定義済みだが、dev DB で改名済みの
-- 環境(append_only_block_write)が観測されたため、本 migration が依存する
-- 名前を同一本体で再定義して自己完結させる。
CREATE OR REPLACE FUNCTION lifecycle_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dispensing_records_transition_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS NOT NULL THEN
    RAISE EXCEPTION 'dispensing_records is immutable after confirmation';
  END IF;
  IF NEW.status IS DISTINCT FROM 'DISPENSING_RECORDED' THEN
    RAISE EXCEPTION 'dispensing_records status may only transition to DISPENSING_RECORDED';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id
     OR NEW.dispensing_id IS DISTINCT FROM OLD.dispensing_id
     OR NEW.prescription_id IS DISTINCT FROM OLD.prescription_id
     OR NEW.prescription_version IS DISTINCT FROM OLD.prescription_version
     OR NEW.dispensing_date IS DISTINCT FROM OLD.dispensing_date
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.create_request IS DISTINCT FROM OLD.create_request
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'dispensing_records identity columns are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispensing_records_transition
  BEFORE UPDATE ON dispensing_records
  FOR EACH ROW EXECUTE FUNCTION dispensing_records_transition_guard();

CREATE TRIGGER dispensing_records_block_delete
  BEFORE DELETE ON dispensing_records
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER dispensing_records_truncate_guard
  BEFORE TRUNCATE ON dispensing_records
  FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_append_only_guard();

CREATE TRIGGER dispensing_items_block_update
  BEFORE UPDATE ON dispensing_items
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER dispensing_items_block_delete
  BEFORE DELETE ON dispensing_items
  FOR EACH ROW EXECUTE FUNCTION lifecycle_append_only_guard();
CREATE TRIGGER dispensing_items_truncate_guard
  BEFORE TRUNCATE ON dispensing_items
  FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_append_only_guard();

-- outbox intent の aggregate 拡張(000020 の規則に従い CHECK と trigger を
-- 一体で置き換える): dispense.confirmed は aggregate_type='dispensing' で
-- aggregate_id は dispensing_records を指す。
ALTER TABLE outbox_events
  DROP CONSTRAINT outbox_events_aggregate_type_allowed;
ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_aggregate_type_allowed
  CHECK (aggregate_type IN ('reception', 'prescription', 'dispensing'));

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
  ELSIF NEW.aggregate_type = 'dispensing' THEN
    IF NOT EXISTS (
      SELECT 1 FROM dispensing_records
       WHERE tenant_id = NEW.tenant_id
         AND pharmacy_id = NEW.pharmacy_id
         AND dispensing_id = NEW.aggregate_id
    ) THEN
      RAISE EXCEPTION 'outbox_events aggregate does not exist: dispensing %',
        NEW.aggregate_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'outbox_events aggregate type not allowed: %',
      NEW.aggregate_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
