-- WP-6006 independent review closure (2026-08-24).
-- * app_id is globally unique so an authentication layer that looks a client up by
--   app_id alone can never cross a tenant (review F9, SEC-006).
-- * grants are revoked, not deleted: revoked_at keeps the permission window
--   reconstructable (F8). Active grant = revoked_at IS NULL.
-- * endpoints record ownership verification; PENDING_VERIFICATION -> ACTIVE requires it
--   (F4, API-010 §2). RETIRED is a terminal endpoint state (F13).
-- * subscriptions can be ended (ended_at) instead of deleted (F13, F8).

ALTER TABLE partner_apps
  ADD CONSTRAINT partner_apps_app_id_global_unique UNIQUE (app_id);

ALTER TABLE partner_grants
  ADD COLUMN revoked_at TIMESTAMPTZ;

ALTER TABLE partner_subscriptions
  ADD COLUMN ended_at TIMESTAMPTZ;

ALTER TABLE partner_delivery_endpoints
  ADD COLUMN ownership_verified_at TIMESTAMPTZ;

ALTER TABLE partner_delivery_endpoints
  DROP CONSTRAINT partner_delivery_endpoints_state_check;

ALTER TABLE partner_delivery_endpoints
  ADD CONSTRAINT partner_delivery_endpoints_state_check
  CHECK (state IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'RETIRED'));

ALTER TABLE partner_delivery_endpoints
  ADD CONSTRAINT partner_delivery_endpoints_active_requires_verification
  CHECK (state <> 'ACTIVE' OR ownership_verified_at IS NOT NULL);

CREATE FUNCTION partner_grants_block_delete() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'partner_grants rows must not be deleted; set revoked_at instead';
END;
$$;

CREATE TRIGGER partner_grants_delete_guard
BEFORE DELETE ON partner_grants
FOR EACH ROW EXECUTE FUNCTION partner_grants_block_delete();
