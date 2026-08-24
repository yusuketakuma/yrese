import type { Pool } from 'pg';

import {
  isPartnerScope,
  subscribeScopeFor as contractSubscribeScopeFor,
} from '@yrese/contracts';

import {
  PartnerEndpointPolicyError,
  assertPublicHttpsEndpoint,
  assertResolvesToPublicAddress,
  defaultAddressLookup,
  type AddressLookup,
} from '../partner-endpoint-policy.js';

/**
 * Partner Registry の永続化(WP-6006、SSOT: API-010 / API-011 / API-012、migrations/000008 + 000010)。
 *
 * - credential/app は (tenant, pharmacy, partner) に固定し、app_id は大域一意。tenant は
 *   trusted context から渡され、request 由来の tenant を受け取らない。
 * - 状態遷移は表(DRAFT → ACTIVE ⇄ SUSPENDED → RETIRED、RETIRED は終端)で拘束し、
 *   期待状態付きの CAS で並行書き手を検出する。
 * - grant は revoked_at で失効(DELETE は trigger で禁止)。scope は API-011 レジストリ外を拒否。
 * - endpoint の ACTIVE 化は所在国が許可国(SEC-004 §4: JP のみ)かつ所有権検証済みであること。
 * - 配送先の解決は毎回評価し、policy 非適合行はその行だけ除外して報告する。
 *   一時停止中(SUSPENDED)の購読者が居る場合は「配送済み扱いにしてはならない」ことを返す。
 * - secret は secret store の参照(secret_ref)だけを持つ。
 *
 * ponytail: HTTP route(登録 API)と partner.* 監査発火は contract-first の次 WP。
 */
export type PartnerState = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type EndpointState =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

/** SEC-004 §4「越境移転なし」。拡張は privacy/legal review を伴う SSOT 改版で行う。 */
export const ALLOWED_ENDPOINT_COUNTRIES: readonly string[] = ['JP'];

const partnerTransitions: Readonly<
  Record<PartnerState, readonly PartnerState[]>
> = {
  DRAFT: ['ACTIVE', 'RETIRED'],
  ACTIVE: ['SUSPENDED', 'RETIRED'],
  SUSPENDED: ['ACTIVE', 'RETIRED'],
  RETIRED: [],
};

const endpointTransitions: Readonly<
  Record<EndpointState, readonly EndpointState[]>
> = {
  PENDING_VERIFICATION: ['ACTIVE', 'RETIRED'],
  ACTIVE: ['SUSPENDED', 'PENDING_VERIFICATION', 'RETIRED'],
  SUSPENDED: ['ACTIVE', 'RETIRED'],
  RETIRED: [],
};

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

export interface DeliveryResolution {
  readonly targets: readonly DeliveryTarget[];
  /** policy 非適合で除外した endpoint(fail-visible。配送は他 target へ継続)。 */
  readonly rejectedEndpointIds: readonly string[];
  /** 一時停止(SUSPENDED)中の購読 app。>0 なら event を配送済み扱いにしてはならない。 */
  readonly suspendedSubscribers: number;
}

export class PartnerStateTransitionError extends RangeError {
  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`${entity} state transition ${from} -> ${to} is not allowed`);
    this.name = 'PartnerStateTransitionError';
  }
}

export class PartnerStateConflictError extends Error {
  constructor(readonly entity: string) {
    super(`${entity} state changed concurrently or entity not found`);
    this.name = 'PartnerStateConflictError';
  }
}

export class PartnerScopeError extends RangeError {
  constructor(readonly scope: string) {
    super('scope is not in the partner scope registry');
    this.name = 'PartnerScopeError';
  }
}

export const subscribeScopeFor = contractSubscribeScopeFor;

export class PostgresPartnerRegistry {
  private readonly lookup: AddressLookup;

  constructor(
    private readonly pool: Pool,
    options: { readonly lookup?: AddressLookup } = {},
  ) {
    this.lookup = options.lookup ?? defaultAddressLookup;
  }

  async registerPartner(input: {
    readonly partnerId: string;
    readonly displayName: string;
    readonly now: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO partners (partner_id, display_name, state, created_at)
       VALUES ($1, $2, 'DRAFT', $3)
       ON CONFLICT (partner_id) DO NOTHING`,
      [input.partnerId, input.displayName, input.now],
    );
  }

  /** 期待状態付き CAS。表にない遷移は拒否、期待状態不一致は conflict。 */
  async setPartnerState(
    partnerId: string,
    from: PartnerState,
    to: PartnerState,
  ): Promise<void> {
    if (!partnerTransitions[from].includes(to)) {
      throw new PartnerStateTransitionError('partner', from, to);
    }
    const result = await this.pool.query(
      'UPDATE partners SET state = $3 WHERE partner_id = $1 AND state = $2',
      [partnerId, from, to],
    );
    if (result.rowCount !== 1) throw new PartnerStateConflictError('partner');
  }

  async issueApp(
    scope: PartnerScope,
    input: {
      readonly appId: string;
      readonly partnerId: string;
      readonly now: Date;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO partner_apps (tenant_id, pharmacy_id, app_id, partner_id, state, created_at)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5)
       ON CONFLICT (tenant_id, pharmacy_id, app_id) DO NOTHING`,
      [
        scope.tenantId,
        scope.pharmacyId,
        input.appId,
        input.partnerId,
        input.now,
      ],
    );
  }

  async setAppState(
    scope: PartnerScope,
    appId: string,
    from: PartnerState,
    to: PartnerState,
  ): Promise<void> {
    if (!partnerTransitions[from].includes(to)) {
      throw new PartnerStateTransitionError('partner app', from, to);
    }
    const result = await this.pool.query(
      `UPDATE partner_apps SET state = $5
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND app_id = $3 AND state = $4`,
      [scope.tenantId, scope.pharmacyId, appId, from, to],
    );
    if (result.rowCount !== 1)
      throw new PartnerStateConflictError('partner app');
  }

  async grant(
    scope: PartnerScope,
    appId: string,
    scopeName: string,
    now: Date,
  ): Promise<void> {
    if (!isPartnerScope(scopeName)) throw new PartnerScopeError(scopeName);
    await this.pool.query(
      `INSERT INTO partner_grants (tenant_id, pharmacy_id, app_id, scope, granted_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (tenant_id, pharmacy_id, app_id, scope)
       DO UPDATE SET granted_at = EXCLUDED.granted_at, revoked_at = NULL
       WHERE partner_grants.revoked_at IS NOT NULL`,
      [scope.tenantId, scope.pharmacyId, appId, scopeName, now],
    );
  }

  async revokeGrant(
    scope: PartnerScope,
    appId: string,
    scopeName: string,
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE partner_grants SET revoked_at = $5
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND app_id = $3 AND scope = $4 AND revoked_at IS NULL`,
      [scope.tenantId, scope.pharmacyId, appId, scopeName, now],
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
    await assertResolvesToPublicAddress(input.url, this.lookup);
    await this.pool.query(
      `INSERT INTO partner_delivery_endpoints
         (tenant_id, pharmacy_id, app_id, endpoint_id, url, key_id, secret_ref, country_code, state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_VERIFICATION', $9)
       ON CONFLICT (tenant_id, pharmacy_id, endpoint_id) DO NOTHING`,
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

  /** 所有権検証(challenge)の完了を記録する。ACTIVE 化の前提。 */
  async recordEndpointOwnershipVerified(
    scope: PartnerScope,
    endpointId: string,
    verifiedAt: Date,
  ): Promise<void> {
    const result = await this.pool.query(
      `UPDATE partner_delivery_endpoints SET ownership_verified_at = $4
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND endpoint_id = $3`,
      [scope.tenantId, scope.pharmacyId, endpointId, verifiedAt],
    );
    if (result.rowCount !== 1) throw new PartnerStateConflictError('endpoint');
  }

  async setEndpointState(
    scope: PartnerScope,
    endpointId: string,
    from: EndpointState,
    to: EndpointState,
  ): Promise<void> {
    if (!endpointTransitions[from].includes(to)) {
      throw new PartnerStateTransitionError('endpoint', from, to);
    }
    if (to === 'ACTIVE') {
      const row = await this.pool.query<{
        country_code: string;
        ownership_verified_at: Date | null;
      }>(
        `SELECT country_code, ownership_verified_at FROM partner_delivery_endpoints
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND endpoint_id = $3`,
        [scope.tenantId, scope.pharmacyId, endpointId],
      );
      const current = row.rows[0];
      if (current === undefined)
        throw new PartnerStateConflictError('endpoint');
      if (!ALLOWED_ENDPOINT_COUNTRIES.includes(current.country_code)) {
        throw new PartnerEndpointPolicyError(
          'destination country is not allowed (SEC-004 §4)',
        );
      }
      if (current.ownership_verified_at === null) {
        throw new PartnerEndpointPolicyError(
          'endpoint ownership is not verified',
        );
      }
    }
    const result = await this.pool.query(
      `UPDATE partner_delivery_endpoints SET state = $5
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND endpoint_id = $3 AND state = $4`,
      [scope.tenantId, scope.pharmacyId, endpointId, from, to],
    );
    if (result.rowCount !== 1) throw new PartnerStateConflictError('endpoint');
  }

  async subscribe(
    scope: PartnerScope,
    appId: string,
    eventType: string,
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO partner_subscriptions (tenant_id, pharmacy_id, app_id, event_type, created_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (tenant_id, pharmacy_id, app_id, event_type)
       DO UPDATE SET created_at = EXCLUDED.created_at, ended_at = NULL
       WHERE partner_subscriptions.ended_at IS NOT NULL`,
      [scope.tenantId, scope.pharmacyId, appId, eventType, now],
    );
  }

  async unsubscribe(
    scope: PartnerScope,
    appId: string,
    eventType: string,
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE partner_subscriptions SET ended_at = $5
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND app_id = $3 AND event_type = $4 AND ended_at IS NULL`,
      [scope.tenantId, scope.pharmacyId, appId, eventType, now],
    );
  }

  /** 配送時に毎回評価する(grant / state の失効を即時反映)。DNS 再解決も行う。 */
  async resolveDeliveryTargets(
    scope: PartnerScope,
    eventType: string,
  ): Promise<DeliveryResolution> {
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
          AND s.ended_at IS NULL
         JOIN partner_grants g
           ON g.tenant_id = a.tenant_id AND g.pharmacy_id = a.pharmacy_id AND g.app_id = a.app_id
          AND g.revoked_at IS NULL
         JOIN partner_delivery_endpoints e
           ON e.tenant_id = a.tenant_id AND e.pharmacy_id = a.pharmacy_id AND e.app_id = a.app_id
        WHERE a.tenant_id = $1 AND a.pharmacy_id = $2
          AND s.event_type = $3
          AND g.scope = $4
          AND p.state = 'ACTIVE' AND a.state = 'ACTIVE' AND e.state = 'ACTIVE'
        ORDER BY a.app_id, e.endpoint_id`,
      [
        scope.tenantId,
        scope.pharmacyId,
        eventType,
        `events:subscribe:${eventType}`,
      ],
    );
    const suspended = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM partner_apps a
         JOIN partners p ON p.partner_id = a.partner_id
         JOIN partner_subscriptions s
           ON s.tenant_id = a.tenant_id AND s.pharmacy_id = a.pharmacy_id AND s.app_id = a.app_id
          AND s.ended_at IS NULL
        WHERE a.tenant_id = $1 AND a.pharmacy_id = $2 AND s.event_type = $3
          AND (a.state = 'SUSPENDED' OR p.state = 'SUSPENDED'
               OR EXISTS (SELECT 1 FROM partner_delivery_endpoints e
                           WHERE e.tenant_id = a.tenant_id AND e.pharmacy_id = a.pharmacy_id
                             AND e.app_id = a.app_id AND e.state = 'SUSPENDED'))`,
      [scope.tenantId, scope.pharmacyId, eventType],
    );
    const targets: DeliveryTarget[] = [];
    const rejectedEndpointIds: string[] = [];
    for (const row of result.rows) {
      try {
        const url = new URL(row.url);
        await assertResolvesToPublicAddress(url, this.lookup);
        targets.push({
          appId: row.app_id,
          partnerId: row.partner_id,
          endpointId: row.endpoint_id,
          url,
          keyId: row.key_id,
          secretRef: row.secret_ref,
        });
      } catch {
        rejectedEndpointIds.push(row.endpoint_id);
      }
    }
    return Object.freeze({
      targets,
      rejectedEndpointIds,
      suspendedSubscribers: Number(suspended.rows[0]?.count ?? '0'),
    });
  }
}
