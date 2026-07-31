-- Transactional outbox intents (WP-4050 atomic reception command boundary).
-- A reception create commits atomically with its reception.created audit event and
-- exactly one outbox intent; the UNIQUE constraint makes retries converge on the
-- single intent instead of duplicating it. No delivery worker exists in this slice:
-- rows stay pending (delivered_at IS NULL) until a separately approved delivery
-- boundary lands. payload holds identifiers only (reception/patient ids) — no PHI.
-- Discipline: INSERT plus the single pending -> delivered transition only;
-- DELETE and any other UPDATE are rejected by trigger.

CREATE TABLE outbox_events (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  outbox_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  CONSTRAINT outbox_events_pk PRIMARY KEY (tenant_id, pharmacy_id, outbox_event_id),
  CONSTRAINT outbox_events_intent_unique UNIQUE (tenant_id, pharmacy_id, aggregate_type, aggregate_id, event_type),
  CONSTRAINT outbox_events_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT outbox_events_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT outbox_events_outbox_event_id_non_empty CHECK (length(outbox_event_id) > 0),
  CONSTRAINT outbox_events_event_type_non_empty CHECK (length(event_type) > 0),
  CONSTRAINT outbox_events_aggregate_type_non_empty CHECK (length(aggregate_type) > 0),
  CONSTRAINT outbox_events_aggregate_id_non_empty CHECK (length(aggregate_id) > 0),
  CONSTRAINT outbox_events_audit_event_id_non_empty CHECK (length(audit_event_id) > 0)
);

CREATE FUNCTION outbox_events_block_mutation() RETURNS trigger
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
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'outbox_events allows only the single pending -> delivered transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER outbox_events_mutation_guard
BEFORE UPDATE OR DELETE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION outbox_events_block_mutation();
