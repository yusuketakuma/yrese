import { PARTNER_EVENT_TYPES } from "./partner-event.js";

/**
 * Partner scope レジストリ(WP-6006 review F11、SSOT: API-011 api_scope_registry APPROVED 2026-08-23)。
 * ここにない scope は発行も受理もしない。ワイルドカードは存在しない。
 */
export const PARTNER_RESOURCE_SCOPES = [
  "patient:read",
  "medication-request:read",
  "medication-request:write",
  "medication-dispense:read",
  "yakureki:report",
  "audit-result:submit",
  "export:tenant",
] as const;

export const PARTNER_SUBSCRIBE_SCOPE_PREFIX = "events:subscribe:";

export const PARTNER_SUBSCRIBE_SCOPES = PARTNER_EVENT_TYPES.map(
  (eventType) => `${PARTNER_SUBSCRIBE_SCOPE_PREFIX}${eventType}` as const,
);

export const PARTNER_SCOPES = [...PARTNER_RESOURCE_SCOPES, ...PARTNER_SUBSCRIBE_SCOPES] as const;
export type PartnerScope = (typeof PARTNER_SCOPES)[number];

export function isPartnerScope(value: string): value is PartnerScope {
  return (PARTNER_SCOPES as readonly string[]).includes(value);
}

export function subscribeScopeFor(eventType: (typeof PARTNER_EVENT_TYPES)[number]): PartnerScope {
  return `${PARTNER_SUBSCRIBE_SCOPE_PREFIX}${eventType}`;
}
