-- WP-4050 HIGH-3 (independent review 2026-08-23, human approval 2026-08-23):
-- an outbox intent must point at a real reception and at a real audit event in the
-- same tenant/pharmacy. Until now only the application-side completeness join
-- (PostgresReceptionCreateCommand) enforced this; a direct INSERT could leave a
-- dangling intent that looked "complete". Both referenced keys already exist
-- (reception_entries PK, audit_events (tenant_id, pharmacy_id, event_id) UNIQUE).
--
-- Scope: the outbox currently carries only aggregate_type = 'reception'. When
-- another aggregate type is added, replace the reception FK with a partial /
-- per-type constraint in a new forward migration; do not widen this one.
-- No backfill: existing rows are append-only evidence. If a legacy dangling row
-- exists the migration fails closed and the row must be surfaced as
-- reconciliation evidence, never rewritten.

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_reception_fk
  FOREIGN KEY (tenant_id, pharmacy_id, aggregate_id)
  REFERENCES reception_entries (tenant_id, pharmacy_id, reception_id);

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_audit_event_fk
  FOREIGN KEY (tenant_id, pharmacy_id, audit_event_id)
  REFERENCES audit_events (tenant_id, pharmacy_id, event_id);
