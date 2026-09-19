-- WP-7403: 処方訂正(新版)と疑義照会記録。DOM-002 §4「確定後の変更は訂正版の
-- 新規作成+履歴保持のみ」・§5「疑義照会による処方変更は Prescription の訂正版
-- 経由」を DB 層で裏付ける。
--
-- - prescription_versions は v>=2 で lineage 必須(supersedes_version = v-1、
--   inquiry_id・amended_by・amended_at NOT NULL)。append-only の既存 trigger は
--   そのまま全版に効く。
-- - prescription_inquiries は回答が write-once(再回答は新 inquiry を起票)。
--   OPEN(answer 未記録)/ RESOLVED を列の NULL 組合せで表現し、status 列は
--   持たない(導出状態の二重管理を避ける)。
--
-- Applying it to any environment remains an explicit operational action
-- under DB-002.

ALTER TABLE prescription_versions
  ADD COLUMN supersedes_version INTEGER,
  ADD COLUMN inquiry_id TEXT,
  ADD COLUMN amended_by TEXT,
  ADD COLUMN amended_at TIMESTAMPTZ,
  ADD COLUMN amend_idempotency_key TEXT;

ALTER TABLE prescription_versions
  ADD CONSTRAINT prescription_versions_amendment_lineage CHECK (
    (version = 1
      AND supersedes_version IS NULL
      AND inquiry_id IS NULL
      AND amended_by IS NULL
      AND amended_at IS NULL
      AND amend_idempotency_key IS NULL)
    OR
    (version > 1
      AND supersedes_version = version - 1
      AND inquiry_id IS NOT NULL
      AND amended_by IS NOT NULL
      AND amended_at IS NOT NULL
      AND amend_idempotency_key IS NOT NULL)
  );

CREATE TABLE prescription_inquiries (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  inquiry_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  directed_to TEXT NOT NULL,
  content TEXT NOT NULL,
  answer TEXT,
  answered_by TEXT,
  answered_at TIMESTAMPTZ,
  result TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  answer_idempotency_key TEXT,
  recorded_seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT prescription_inquiries_pk
    PRIMARY KEY (tenant_id, pharmacy_id, inquiry_id),
  CONSTRAINT prescription_inquiries_draft_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id)
    REFERENCES prescription_drafts (tenant_id, pharmacy_id, prescription_id),
  CONSTRAINT prescription_inquiries_directed_to_limit
    CHECK (length(directed_to) BETWEEN 1 AND 500),
  CONSTRAINT prescription_inquiries_content_limit
    CHECK (length(content) BETWEEN 1 AND 2000),
  CONSTRAINT prescription_inquiries_result_kind
    CHECK (result IN ('UNCHANGED', 'CHANGED')),
  -- 複合 FK 参照先: amend 側が (prescription_id, inquiry_id) で指すため、
  -- inquiry が同一処方に属することを DB 層でも強制する。
  CONSTRAINT prescription_inquiries_prescription_unique
    UNIQUE (tenant_id, pharmacy_id, prescription_id, inquiry_id),
  CONSTRAINT prescription_inquiries_answer_complete CHECK (
    (answer IS NULL AND answered_by IS NULL
      AND answered_at IS NULL AND result IS NULL
      AND answer_idempotency_key IS NULL)
    OR
    (answer IS NOT NULL AND answered_by IS NOT NULL
      AND answered_at IS NOT NULL AND result IS NOT NULL
      AND answer_idempotency_key IS NOT NULL)
  )
);

CREATE INDEX prescription_inquiries_prescription_idx
  ON prescription_inquiries (tenant_id, pharmacy_id, prescription_id, recorded_seq);

-- 起票冪等キーは scope+処方内で一意(same-key replay の解決キー)。
CREATE UNIQUE INDEX prescription_inquiries_idempotency_idx
  ON prescription_inquiries (tenant_id, pharmacy_id, prescription_id, idempotency_key);

-- amend の lineage 整合: v>=2 の inquiry_id は同一 scope・同一処方の実在
-- inquiry を指す(複合 FK)。v1 は inquiry_id NULL のため FK は NULL を許容する。
ALTER TABLE prescription_versions
  ADD CONSTRAINT prescription_versions_inquiry_fk
    FOREIGN KEY (tenant_id, pharmacy_id, prescription_id, inquiry_id)
    REFERENCES prescription_inquiries
      (tenant_id, pharmacy_id, prescription_id, inquiry_id);

-- inquiry の不変条件: 起票時 field(directed_to/content/対象/起票者)は不変、
-- 回答は write-once。修正は新 inquiry の起票でのみ行う。
CREATE OR REPLACE FUNCTION prescription_inquiries_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'prescription inquiries cannot be deleted';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id
    OR NEW.inquiry_id IS DISTINCT FROM OLD.inquiry_id
    OR NEW.directed_to IS DISTINCT FROM OLD.directed_to
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.prescription_id IS DISTINCT FROM OLD.prescription_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
  THEN
    RAISE EXCEPTION 'prescription inquiry identity fields are immutable';
  END IF;

  IF OLD.answer IS NOT NULL AND (
    NEW.answer IS DISTINCT FROM OLD.answer
    OR NEW.answered_by IS DISTINCT FROM OLD.answered_by
    OR NEW.answered_at IS DISTINCT FROM OLD.answered_at
    OR NEW.result IS DISTINCT FROM OLD.result
    OR NEW.answer_idempotency_key IS DISTINCT FROM OLD.answer_idempotency_key
  ) THEN
    RAISE EXCEPTION 'prescription inquiry answer is write-once';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_inquiries_guard
  BEFORE UPDATE OR DELETE ON prescription_inquiries
  FOR EACH ROW EXECUTE FUNCTION prescription_inquiries_guard();

-- TRUNCATE は行 trigger を通らないため statement 単位で別途禁止する
-- (他表の append-only guard 関数名には依存せず本表専用とする)。
CREATE OR REPLACE FUNCTION prescription_inquiries_block_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'prescription_inquiries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_inquiries_truncate_guard
  BEFORE TRUNCATE ON prescription_inquiries
  FOR EACH STATEMENT EXECUTE FUNCTION prescription_inquiries_block_truncate();

-- outbox intent 一意性の拡張: 同一処方への複数 amend はそれぞれ独立した
-- intent を持つため、(aggregate, event_type) 単位の一意性では 2 回目の
-- prescription.amended が衝突する。intent_dedup_key で logical command
-- 単位の一意性へ置き換える(reception.created/finalized は既定 '' で
-- 従来どおり一意、amended は 'v<version>' で版ごとに一意)。
ALTER TABLE outbox_events
  ADD COLUMN intent_dedup_key TEXT NOT NULL DEFAULT '';

ALTER TABLE outbox_events
  DROP CONSTRAINT outbox_events_intent_unique;
ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_intent_unique UNIQUE
    (tenant_id, pharmacy_id, aggregate_type, aggregate_id,
     event_type, intent_dedup_key);

CREATE OR REPLACE FUNCTION outbox_events_block_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'outbox_events rows must not be deleted (transactional outbox discipline)';
  END IF;
  IF OLD.delivered_at IS NOT NULL
     OR NEW.delivered_at IS NULL
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id
     OR NEW.outbox_event_id IS DISTINCT FROM OLD.outbox_event_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.aggregate_type IS DISTINCT FROM OLD.aggregate_type
     OR NEW.aggregate_id IS DISTINCT FROM OLD.aggregate_id
     OR NEW.audit_event_id IS DISTINCT FROM OLD.audit_event_id
     OR NEW.payload::text IS DISTINCT FROM OLD.payload::text
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
     OR NEW.intent_dedup_key IS DISTINCT FROM OLD.intent_dedup_key THEN
    RAISE EXCEPTION 'outbox_events allows only the single pending -> delivered transition';
  END IF;
  RETURN NEW;
END;
$$;
