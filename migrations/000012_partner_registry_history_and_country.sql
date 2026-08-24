-- WP-6006 closure checker (2026-08-24): M2 / M3.
-- * the destination-country rule is enforced by the database as well as by code:
--   an ACTIVE endpoint must be in an allowed country (SEC-004 §4, currently JP only);
-- * grants and subscriptions keep their full permission history: every UPDATE appends
--   the previous row to a history table, so grant(t1)/revoke(t2)/grant(t3) remains
--   reconstructable even though the live row is keyed per (app, scope).

ALTER TABLE partner_delivery_endpoints
  ADD CONSTRAINT partner_delivery_endpoints_active_country_allowed
  CHECK (state <> 'ACTIVE' OR country_code IN ('JP'));

CREATE TABLE partner_grant_history (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sequence_number BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT partner_grant_history_pk PRIMARY KEY (sequence_number)
);

CREATE FUNCTION partner_grants_archive_previous() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO partner_grant_history (tenant_id, pharmacy_id, app_id, scope, granted_at, revoked_at)
  VALUES (OLD.tenant_id, OLD.pharmacy_id, OLD.app_id, OLD.scope, OLD.granted_at, OLD.revoked_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_grants_history_guard
BEFORE UPDATE ON partner_grants
FOR EACH ROW EXECUTE FUNCTION partner_grants_archive_previous();

CREATE TABLE partner_subscription_history (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sequence_number BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT partner_subscription_history_pk PRIMARY KEY (sequence_number)
);

CREATE FUNCTION partner_subscriptions_archive_previous() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO partner_subscription_history (tenant_id, pharmacy_id, app_id, event_type, created_at, ended_at)
  VALUES (OLD.tenant_id, OLD.pharmacy_id, OLD.app_id, OLD.event_type, OLD.created_at, OLD.ended_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_subscriptions_history_guard
BEFORE UPDATE ON partner_subscriptions
FOR EACH ROW EXECUTE FUNCTION partner_subscriptions_archive_previous();

-- M4: raw_response_ref is an opaque store handle: <store>/<hex id>. A base64url payload
-- cannot satisfy the hex-only id part.
ALTER TABLE eligibility_snapshots
  DROP CONSTRAINT eligibility_snapshots_raw_response_ref_opaque;

ALTER TABLE eligibility_snapshots
  ADD CONSTRAINT eligibility_snapshots_raw_response_ref_opaque CHECK (
    raw_response_ref IS NULL OR raw_response_ref ~ '^[a-z][a-z0-9_-]{0,15}/[0-9a-f]{16,64}$'
  );
