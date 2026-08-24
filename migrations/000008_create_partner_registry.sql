-- WP-6006 Partner Registry (SSOT: API-010 partner_registry_policy, API-011 scope registry,
-- API-012 event catalog; APPROVED 2026-08-23).
--
-- Invariants carried by the schema:
-- * a credential/app is pinned to one (tenant, pharmacy, partner); there is no
--   cross-tenant app (API-010 §2, SEC-006);
-- * grants are per (tenant, pharmacy, app, scope) with no wildcard;
-- * delivery endpoints store a secret *reference* (secret store key), never the
--   signing secret itself, and record the country of the destination (API-010 §2,
--   SEC-004 §4);
-- * states are closed enumerations; retirement is a state, not a DELETE.
-- No PHI lives in these tables.

CREATE TABLE partners (
  partner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT partners_pk PRIMARY KEY (partner_id),
  CONSTRAINT partners_partner_id_non_empty CHECK (length(partner_id) > 0),
  CONSTRAINT partners_state_check CHECK (state IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'))
);

CREATE TABLE partner_apps (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT partner_apps_pk PRIMARY KEY (tenant_id, pharmacy_id, app_id),
  CONSTRAINT partner_apps_partner_fk FOREIGN KEY (partner_id) REFERENCES partners (partner_id),
  CONSTRAINT partner_apps_app_id_non_empty CHECK (length(app_id) > 0),
  CONSTRAINT partner_apps_state_check CHECK (state IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'))
);

CREATE TABLE partner_grants (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT partner_grants_pk PRIMARY KEY (tenant_id, pharmacy_id, app_id, scope),
  CONSTRAINT partner_grants_app_fk FOREIGN KEY (tenant_id, pharmacy_id, app_id)
    REFERENCES partner_apps (tenant_id, pharmacy_id, app_id),
  CONSTRAINT partner_grants_scope_shape CHECK (scope ~ '^[a-z][a-z0-9-]*(:[a-z][a-z0-9_.-]*)+$'),
  CONSTRAINT partner_grants_no_wildcard CHECK (position('*' in scope) = 0)
);

CREATE TABLE partner_delivery_endpoints (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  url TEXT NOT NULL,
  key_id TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  country_code TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT partner_delivery_endpoints_pk PRIMARY KEY (tenant_id, pharmacy_id, endpoint_id),
  CONSTRAINT partner_delivery_endpoints_app_fk FOREIGN KEY (tenant_id, pharmacy_id, app_id)
    REFERENCES partner_apps (tenant_id, pharmacy_id, app_id),
  CONSTRAINT partner_delivery_endpoints_https CHECK (url LIKE 'https://%'),
  CONSTRAINT partner_delivery_endpoints_country CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT partner_delivery_endpoints_state_check CHECK (state IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'))
);

CREATE TABLE partner_subscriptions (
  tenant_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT partner_subscriptions_pk PRIMARY KEY (tenant_id, pharmacy_id, app_id, event_type),
  CONSTRAINT partner_subscriptions_app_fk FOREIGN KEY (tenant_id, pharmacy_id, app_id)
    REFERENCES partner_apps (tenant_id, pharmacy_id, app_id),
  CONSTRAINT partner_subscriptions_event_type_shape CHECK (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
);
