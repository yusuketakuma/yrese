-- WP-4050 HIGH-3 + WP-6003 review (2026-08-23, human approval 2026-08-23).
--
-- 1. Foreign keys: an outbox intent must point at a real reception and at a real
--    audit event in the same tenant/pharmacy. Added NOT VALID and then VALIDATED in
--    the same migration: VALIDATE still fails closed on a legacy dangling row, but
--    takes only ShareUpdateExclusiveLock on the referenced tables, so reception
--    creation and audit appends are not blocked while the scan runs (a plain
--    validated ADD CONSTRAINT would take ShareRowExclusiveLock on both parents).
-- 2. aggregate_type is pinned to 'reception' by CHECK so the FK cannot silently
--    bind a future aggregate type to reception_entries. Widening it is a new
--    forward migration that replaces both the CHECK and the FK together.
-- 3. sequence_number: a database-assigned monotonic ordering key. created_at is
--    an application wall clock (can go backwards across API instances) and
--    outbox_event_id is random, so neither can carry the per-aggregate delivery
--    order the worker promises. The mutation guard now freezes it as well.
-- 4. Indexes for the FK lookups and for the pending-scan (partial index).
--
-- No backfill of evidence. If a legacy dangling row exists, VALIDATE fails and the
-- runner stops before this version is recorded. Recovery path (runbook, requires
-- explicit human approval because the 000005 guard forbids DELETE/UPDATE): list the
-- rows with the reconciliation query, record them as reconciliation evidence, and
-- land a dedicated forward migration that disables the guard trigger only for the
-- approved rows; never edit this file after it has been applied anywhere.

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_aggregate_type_reception
  CHECK (aggregate_type = 'reception');

ALTER TABLE outbox_events
  ADD COLUMN sequence_number BIGINT GENERATED ALWAYS AS IDENTITY;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_sequence_number_unique UNIQUE (sequence_number);

CREATE INDEX outbox_events_reception_fk_idx
  ON outbox_events (tenant_id, pharmacy_id, aggregate_id);

CREATE INDEX outbox_events_audit_event_fk_idx
  ON outbox_events (tenant_id, pharmacy_id, audit_event_id);

CREATE INDEX outbox_events_pending_idx
  ON outbox_events (tenant_id, pharmacy_id, aggregate_type, aggregate_id, sequence_number)
  WHERE delivered_at IS NULL;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_reception_fk
  FOREIGN KEY (tenant_id, pharmacy_id, aggregate_id)
  REFERENCES reception_entries (tenant_id, pharmacy_id, reception_id)
  NOT VALID;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_audit_event_fk
  FOREIGN KEY (tenant_id, pharmacy_id, audit_event_id)
  REFERENCES audit_events (tenant_id, pharmacy_id, event_id)
  NOT VALID;

ALTER TABLE outbox_events VALIDATE CONSTRAINT outbox_events_reception_fk;
ALTER TABLE outbox_events VALIDATE CONSTRAINT outbox_events_audit_event_fk;

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
     OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number THEN
    RAISE EXCEPTION 'outbox_events allows only the single pending -> delivered transition';
  END IF;
  RETURN NEW;
END;
$$;
