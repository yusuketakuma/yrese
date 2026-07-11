-- Audit event hash chain store (SCR-028 / R-AUDIT 永続層).
-- Event construction/validation SSOT is @yrese/audit (createAuditEvent / verifyAuditHashChain);
-- event_body holds the canonical event JSON with bigint fields serialized as strings.
-- The table is append-only: UPDATE/DELETE are rejected by trigger to protect 真正性.
-- Chain continuity (prev_hash -> entry_hash) is enforced by the repository under an
-- advisory transaction lock per (tenant_id, pharmacy_id); sequence_number is the chain order.

CREATE TABLE audit_events (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  sequence_number BIGINT NOT NULL,
  event_id TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  wall_clock TIMESTAMPTZ NOT NULL,
  event_body JSONB NOT NULL,
  CONSTRAINT audit_events_pk PRIMARY KEY (tenant_id, pharmacy_id, sequence_number),
  CONSTRAINT audit_events_event_id_unique UNIQUE (tenant_id, pharmacy_id, event_id),
  CONSTRAINT audit_events_tenant_id_non_empty CHECK (length(tenant_id) > 0),
  CONSTRAINT audit_events_pharmacy_id_non_empty CHECK (length(pharmacy_id) > 0),
  CONSTRAINT audit_events_event_id_non_empty CHECK (length(event_id) > 0),
  CONSTRAINT audit_events_sequence_number_positive CHECK (sequence_number > 0),
  CONSTRAINT audit_events_prev_hash_format CHECK (prev_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT audit_events_entry_hash_format CHECK (entry_hash ~ '^[a-f0-9]{64}$')
);

CREATE FUNCTION audit_events_block_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (真正性: 監査証跡の変更・削除は禁止)';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();
