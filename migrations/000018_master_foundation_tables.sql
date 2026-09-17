-- WP-7301/WP-7303 / MST-003: master 基盤の永続化。
-- master_versions / medication_items / usage_items は append-only
-- (UPDATE/DELETE/TRUNCATE を trigger で拒否 — coverage_block_mutation と同型)。
-- tenant_id・pharmacy_id は scope 由来(信頼済み context)。master データは
-- non-PHI だが scope 分離は保持する。synthetic 配布のみ —
-- distribution_state は 'synthetic' のみ許容し、実マスタ取込は RB-009 で
-- 引き続き禁止(別 gate)。

CREATE TABLE master_versions (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  master_version_id TEXT NOT NULL,
  master_kind TEXT NOT NULL
    CHECK (master_kind IN ('medication', 'usage')),
  version TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  transition_note TEXT,
  distribution_state TEXT NOT NULL
    CHECK (distribution_state = 'synthetic'),
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT master_versions_pk
    PRIMARY KEY (tenant_id, pharmacy_id, master_version_id),
  CONSTRAINT master_versions_kind_version_uk
    UNIQUE (tenant_id, pharmacy_id, master_kind, version),
  CONSTRAINT master_versions_validity_ck
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- asOf 版解決用: (tenant, pharmacy, kind) で valid_from が最大の行を引く。
CREATE INDEX master_versions_asof_idx
  ON master_versions (tenant_id, pharmacy_id, master_kind, valid_from DESC);

CREATE TABLE medication_items (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  medication_item_id TEXT NOT NULL,
  master_version_id TEXT NOT NULL,
  local_code TEXT NOT NULL,
  yj_code TEXT,
  receipt_code TEXT,
  hot_code TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price BIGINT,
  generic_flag TEXT NOT NULL
    CHECK (generic_flag IN ('originator', 'generic', 'unclassified')),
  generic_name_code TEXT,
  control_categories TEXT[] NOT NULL DEFAULT '{}',
  CONSTRAINT medication_items_pk
    PRIMARY KEY (tenant_id, pharmacy_id, medication_item_id),
  CONSTRAINT medication_items_version_fk
    FOREIGN KEY (tenant_id, pharmacy_id, master_version_id)
    REFERENCES master_versions (tenant_id, pharmacy_id, master_version_id),
  CONSTRAINT medication_items_local_code_uk
    UNIQUE (tenant_id, pharmacy_id, master_version_id, local_code)
);

CREATE INDEX medication_items_version_idx
  ON medication_items (tenant_id, pharmacy_id, master_version_id);

CREATE TABLE usage_items (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  usage_item_id TEXT NOT NULL,
  master_version_id TEXT NOT NULL,
  local_code TEXT NOT NULL,
  text TEXT NOT NULL,
  times_per_day INTEGER,
  meal_timing TEXT
    CHECK (meal_timing IN ('before', 'after', 'bedtime', 'asNeeded', 'other')),
  jahis_code TEXT,
  CONSTRAINT usage_items_pk
    PRIMARY KEY (tenant_id, pharmacy_id, usage_item_id),
  CONSTRAINT usage_items_version_fk
    FOREIGN KEY (tenant_id, pharmacy_id, master_version_id)
    REFERENCES master_versions (tenant_id, pharmacy_id, master_version_id),
  CONSTRAINT usage_items_local_code_uk
    UNIQUE (tenant_id, pharmacy_id, master_version_id, local_code)
);

CREATE INDEX usage_items_version_idx
  ON usage_items (tenant_id, pharmacy_id, master_version_id);

CREATE OR REPLACE FUNCTION master_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'master tables are append-only (MST-003)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER master_versions_no_update BEFORE UPDATE ON master_versions
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER master_versions_no_delete BEFORE DELETE ON master_versions
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER master_versions_no_truncate
  BEFORE TRUNCATE ON master_versions
  FOR EACH STATEMENT EXECUTE FUNCTION master_block_mutation();

CREATE TRIGGER medication_items_no_update BEFORE UPDATE ON medication_items
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER medication_items_no_delete BEFORE DELETE ON medication_items
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER medication_items_no_truncate
  BEFORE TRUNCATE ON medication_items
  FOR EACH STATEMENT EXECUTE FUNCTION master_block_mutation();

CREATE TRIGGER usage_items_no_update BEFORE UPDATE ON usage_items
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER usage_items_no_delete BEFORE DELETE ON usage_items
  FOR EACH ROW EXECUTE FUNCTION master_block_mutation();
CREATE TRIGGER usage_items_no_truncate
  BEFORE TRUNCATE ON usage_items
  FOR EACH STATEMENT EXECUTE FUNCTION master_block_mutation();
