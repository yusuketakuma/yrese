-- WP-4236: constrain new audit event bodies to JSON objects.
-- A stored JSON null / scalar / array root cannot carry the audit event shape
-- and previously turned a fail-visible chain break into a runtime crash.
-- The verifier is now total over malformed roots (structural
-- hash_format_invalid break); this forward constraint rejects new invalid
-- roots at the write boundary.
-- NOT VALID: existing rows are append-only evidence and must not be rewritten
-- or retroactively judged by this migration; any legacy malformed row remains
-- visible as a chain break instead of being hidden or repaired.

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_event_body_object
  CHECK (jsonb_typeof(event_body) = 'object')
  NOT VALID;
