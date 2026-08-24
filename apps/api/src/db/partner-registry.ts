import type { Pool } from 'pg';

import { assertPublicHttpsEndpoint } from '../partner-endpoint-policy.js';

/**
 * Partner Registry の永続化(WP-6006、SSOT: API-010 / API-011 / API-012、migrations/000008)。
 *
 * - credential/app は (tenant, pharmacy, partner) に固定。tenant は呼び出し側の trusted
 *   context から渡され、本 repository は request 由来の tenant を受け取らない。
 * - 配送先の解決は「partner ACTIVE ∧ app ACTIVE ∧ endpoint ACTIVE ∧ subscription あり ∧
 *   `events:subscribe:<event_type>` grant あり」の全条件を満たす endpoint だけを返す。
 * - secret は secret store の参照(secret_ref)だけを持つ。値は扱わない。
 *
 * ponytail: HTTP route(登録 API)は contract-first で別 WP。ここは repository のみ。
 * 監査(partner.*)の発火も route 側の責務とし、repository は書かない。
 */
export type PartnerState = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type EndpointState = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export interface PartnerScope {
  readonly tenantId: string;
  readonly pharmacyId: string;
}

export interface DeliveryTarget {
  readonly appId: string;
  readonly partnerId: string;
  readonly endpointId: string;
  readonly url: URL;
  readonly keyId: string;
  readonly secretRef: string;
}

export function subscribeScopeFor(eventType: string): string {
  return `events:subscribe:${eventType}`;
}

export class PostgresPartnerRegistry {
  constructor(private readonly pool: Pool) {}

  async registerPartner(input: {
    readonly partnerId: string;
    readonly displayName: string;
    readonly now: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO partners (partner_id, display_name, state, created_at)
       VALUES ($1, $2, 'DRAFT', $3)`,
      [input.partnerId, input.displayName, input.now],
    );
  }

  async setPartnerState(partnerId: string, state: PartnerState): Promise<void> {
    const result = await this.pool.query(
      'UPDATE partners SET state = $2 WHERE partner_id = $1',
      [partnerId, state],
    );
    if (result.rowCount !== 1) throw new RangeError('unknown partner');
  }

  async issueApp(
    scope: PartnerScope,
    input: { readonly appId: string; readonly partnerId: string; readonly now: Date },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO partner_apps (tenant_id, pharmacy_id, app_id, partner_id, state, created_at)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5)`,
      [scope.tenantId, scope.pharmacyId, input.appId, input.partnerId, input.now],
    );
  }

  async setAppState(scope: PartnerScope, appId: string, state: PartnerState): Promise<void> {
    const result = await this.pool.query(
      `UPDATE partner_apps SET state = $4
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND app_id = $3`,
      [scope.tenantId, scope.pharmacyId, appId, state],
    );
    if (result.rowCount !== 1) throw new RangeError('unknown partner app');
  }

  async grant(scope: PartnerScope, appId: string, scopeName: string, now: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO partner_grants (tenant_id, pharmacy_id, app_id, scope, granted_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [scope.tenantId, scope.pharmacyId, appId, scopeName, now],
    );
  }

  async revokeGrant(scope: PartnerScope, appId: string, scopeName: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM partner_grants
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND app_id = $3 AND scope = $4`,
      [scope.tenantId, scope.pharmacyId, appId, scopeName],
    );
  }

  async registerEndpoint(
    scope: PartnerScope,
    input: {
      readonly appId: string;
      readonly endpointId: string;
      readonly url: URL;
      readonly keyId: string;
      readonly secretRef: string;
      readonly countryCode: string;
      readonly now: Date;
    },
  ): Promise<void> {
    assertPublicHttpsEndpoint(input.url);
    await this.pool.query(
      `INSERT INTO partner_delivery_endpoints
         (tenant_id, pharmacy_id, app_id, endpoint_id, url, key_id, secret_ref, country_code, state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_VERIFICATION', $9)`,
      [
        scope.tenantId,
        scope.pharmacyId,
        input.appId,
        input.endpointId,
        input.url.toString(),
        input.keyId,
        input.secretRef,
        input.countryCode,
        input.now,
      ],
    );
  }

  async setEndpointState(
    scope: PartnerScope,
    endpointId: string,
    state: EndpointState,
  ): Promise<void> {
    const result = await this.pool.query(
      `UPDATE partner_delivery_endpoints SET state = $4
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND endpoint_id = $3`,
      [scope.tenantId, scope.pharmacyId, endpointId, state],
    );
    if (result.rowCount !== 1) throw new RangeError('unknown endpoint');
  }

  async subscribe(scope: PartnerScope, appId: string, eventType: string, now: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO partner_subscriptions (tenant_id, pharmacy_id, app_id, event_type, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [scope.tenantId, scope.pharmacyId, appId, eventType, now],
    );
  }

  /** 配送時に毎回評価する(grant / state の失効を即時反映)。 */
  async resolveDeliveryTargets(scope: PartnerScope, eventType: string): Promise<readonly DeliveryTarget[]> {
    const result = await this.pool.query<{
      app_id: string;
      partner_id: string;
      endpoint_id: string;
      url: string;
      key_id: string;
      secret_ref: string;
    }>(
      `SELECT a.app_id, a.partner_id, e.endpoint_id, e.url, e.key_id, e.secret_ref
         FROM partner_apps a
         JOIN partners p ON p.partner_id = a.partner_id
         JOIN partner_subscriptions s
           ON s.tenant_id = a.tenant_id AND s.pharmacy_id = a.pharmacy_id AND s.app_id = a.app_id
         JOIN partner_grants g
           ON g.tenant_id = a.tenant_id AND g.pharmacy_id = a.pharmacy_id AND g.app_id = a.app_id
         JOIN partner_delivery_endpoints e
           ON e.tenant_id = a.tenant_id AND e.pharmacy_id = a.pharmacy_id AND e.app_id = a.app_id
        WHERE a.tenant_id = $1 AND a.pharmacy_id = $2
          AND s.event_type = $3
          AND g.scope = $4
          AND p.state = 'ACTIVE' AND a.state = 'ACTIVE' AND e.state = 'ACTIVE'
        ORDER BY a.app_id, e.endpoint_id`,
      [scope.tenantId, scope.pharmacyId, eventType, subscribeScopeFor(eventType)],
    );
    const targets: DeliveryTarget[] = [];
    for (const row of result.rows) {
      const url = new URL(row.url);
      assertPublicHttpsEndpoint(url);
      targets.push({
        appId: row.app_id,
        partnerId: row.partner_id,
        endpointId: row.endpoint_id,
        url,
        keyId: row.key_id,
        secretRef: row.secret_ref,
      });
    }
    return targets;
  }
}
