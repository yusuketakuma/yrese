import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import type { AddressLookup } from '../partner-endpoint-policy.js';
import {
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_KEY_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from '../webhook-partner-sink.js';
import { appendAuditEventWithinTransaction } from './audit-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { PostgresOutboxDeliveryWorker } from './outbox-delivery.js';
import {
  PartnerRegistrationConflictError,
  PartnerScopeError,
  PartnerStateConflictError,
  PartnerStateTransitionError,
  PostgresPartnerRegistry,
  subscribeScopeFor,
} from './partner-registry.js';
import { createDbPool } from './pool.js';
import { RegistryRoutedSink } from './registry-routed-sink.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/** WP-6006: Partner Registry と registry-routed 配送の統合テスト(synthetic のみ)。 */
const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres =
  testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: 'tenant-reg-int-001',
  pharmacyId: 'pharmacy-reg-int-001',
};
const otherScope = {
  tenantId: 'tenant-reg-int-002',
  pharmacyId: 'pharmacy-reg-int-001',
};
const now = new Date('2026-08-24T00:00:00.000Z');

/** DNS を合成する: partner.example 配下は public、rebind.example は metadata アドレスへ解決。 */
const syntheticLookup: AddressLookup = async (hostname) => {
  if (hostname.endsWith('.partner.example'))
    return [{ address: '203.0.113.10', family: 4 }];
  if (hostname === 'rebind.example')
    return [{ address: '169.254.169.254', family: 4 }];
  throw new Error('ENOTFOUND');
};

async function withMigratedSchema(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  if (testDatabaseUrl === undefined)
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  const schemaName = `yrese_partner_registry_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();
  const pool = createDbPool(testDatabaseUrl, {
    max: 2,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: now,
    });
    await run(pool);
  } finally {
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    try {
      await cleanupPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupPool.end();
    }
  }
}

function registry(pool: Pool): PostgresPartnerRegistry {
  return new PostgresPartnerRegistry(pool, { lookup: syntheticLookup });
}

async function seedReceptionIntent(
  pool: Pool,
  s: typeof scope,
  receptionId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO patients (tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
         patient_number, eligibility_status, eligibility_checked_at)
       VALUES ($1, $2, 'patient-reg-001', '合成患者', 'ゴウセイカンジャ', '1980-01-01'::date, 'female',
               'REG-001', 'VERIFIED', NULL)
       ON CONFLICT DO NOTHING`,
      [s.tenantId, s.pharmacyId],
    );
    await client.query(
      `INSERT INTO reception_entries (tenant_id, pharmacy_id, reception_id, patient_id, accepted_at,
         business_date, reception_status, prescription_intake_type, idempotency_key)
       VALUES ($1, $2, $3, 'patient-reg-001', $4, '2026-08-24'::date, 'WAITING', 'paper', $5)`,
      [s.tenantId, s.pharmacyId, receptionId, now, `idem-${receptionId}`],
    );
    const audit = await appendAuditEventWithinTransaction(
      client,
      { tenantId: tenantId(s.tenantId), pharmacyId: pharmacyId(s.pharmacyId) },
      {
        actorId: userId('user-reg-001'),
        auditEventType: 'reception.created',
        targetRef: { kind: 'reception', id: receptionId },
        outcome: 'success',
        wallClock: now.toISOString(),
      },
    );
    await client.query(
      `INSERT INTO outbox_events (tenant_id, pharmacy_id, outbox_event_id, event_type, aggregate_type,
         aggregate_id, audit_event_id, payload, created_at)
       VALUES ($1, $2, $3, 'reception.created', 'reception', $4, $5, '{}'::jsonb, $6)`,
      [
        s.tenantId,
        s.pharmacyId,
        `ob-${receptionId}`,
        receptionId,
        audit.eventId,
        now,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function activePartner(
  r: PostgresPartnerRegistry,
  partnerId = 'partner-yakureki',
): Promise<void> {
  await r.registerPartner({ partnerId, displayName: '合成薬歴', now });
  await r.setPartnerState(partnerId, 'DRAFT', 'ACTIVE');
}

async function activeAppWithEndpoint(
  r: PostgresPartnerRegistry,
  s: typeof scope,
  input: {
    readonly appId: string;
    readonly url: string;
    readonly subscribe?: boolean;
    readonly grant?: boolean;
    readonly countryCode?: string;
    readonly verify?: boolean;
  },
): Promise<void> {
  await r.issueApp(s, {
    appId: input.appId,
    partnerId: 'partner-yakureki',
    now,
  });
  await r.setAppState(s, input.appId, 'DRAFT', 'ACTIVE');
  if (input.grant !== false)
    await r.grant(s, input.appId, subscribeScopeFor('reception.created'), now);
  if (input.subscribe !== false)
    await r.subscribe(s, input.appId, 'reception.created', now);
  await r.registerEndpoint(s, {
    appId: input.appId,
    endpointId: `${input.appId}-ep`,
    url: new URL(input.url),
    keyId: 'k1',
    secretRef: `secret/${input.appId}`,
    countryCode: input.countryCode ?? 'JP',
    now,
  });
  if (input.verify !== false)
    await r.recordEndpointOwnershipVerified(s, `${input.appId}-ep`, now);
  await r.setEndpointState(
    s,
    `${input.appId}-ep`,
    'PENDING_VERIFICATION',
    'ACTIVE',
  );
}

describe('PostgresPartnerRegistry delivery DNS revalidation', () => {
  it('bounds concurrent lookups and preserves database order', async () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({
      app_id: `app-${index}`,
      partner_id: 'partner-yakureki',
      endpoint_id: `endpoint-${index}`,
      url: `https://endpoint-${index}.partner.example/hook`,
      key_id: 'k1',
      secret_ref: `secret/app-${index}`,
    }));
    const query = vi.fn(async (statement: string) => {
      if (statement.includes('SELECT a.app_id')) return { rows };
      if (statement.includes('SELECT count(*)'))
        return { rows: [{ count: '2' }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;

    let notifyFirstLookup!: () => void;
    const firstLookup = new Promise<void>((resolve) => {
      notifyFirstLookup = resolve;
    });
    let releasePending = false;
    let inFlight = 0;
    let maxInFlight = 0;
    const started: string[] = [];
    const pending: (() => void)[] = [];
    const lookup: AddressLookup = async (hostname) => {
      started.push(hostname);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      notifyFirstLookup();
      if (!releasePending) {
        await new Promise<void>((resolve) => pending.push(resolve));
      }
      inFlight -= 1;
      return [
        {
          address:
            hostname === 'endpoint-3.partner.example'
              ? '169.254.169.254'
              : '203.0.113.10',
          family: 4,
        },
      ];
    };

    const resolving = new PostgresPartnerRegistry(pool, { lookup })
      .resolveDeliveryTargets(scope, 'reception.created');
    await firstLookup;
    const initiallyStarted = started.length;
    releasePending = true;
    for (const resolve of pending.toReversed()) resolve();
    const resolution = await resolving;

    expect(initiallyStarted).toBe(8);
    expect(maxInFlight).toBe(8);
    expect(started).toHaveLength(9);
    expect(resolution.targets.map((target) => target.endpointId)).toEqual([
      'endpoint-0',
      'endpoint-1',
      'endpoint-2',
      'endpoint-4',
      'endpoint-5',
      'endpoint-6',
      'endpoint-7',
      'endpoint-8',
    ]);
    expect(resolution.rejectedEndpointIds).toEqual(['endpoint-3']);
    expect(resolution.suspendedSubscribers).toBe(2);
    expect(release).toHaveBeenCalledOnce();
  });
});

describePostgres(
  'PostgresPartnerRegistry + RegistryRoutedSink (PostgreSQL)',
  () => {
    it('resolves only fully active, subscribed, granted, verified endpoints within the tenant', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-ok',
          url: 'https://hooks.partner.example/ok',
        });
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-nosub',
          url: 'https://hooks.partner.example/nosub',
          subscribe: false,
        });
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-nogrant',
          url: 'https://hooks.partner.example/nogrant',
          grant: false,
        });
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-revoked',
          url: 'https://hooks.partner.example/revoked',
        });
        await r.revokeGrant(
          scope,
          'app-revoked',
          subscribeScopeFor('reception.created'),
          now,
        );
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-unsub',
          url: 'https://hooks.partner.example/unsub',
        });
        await r.unsubscribe(scope, 'app-unsub', 'reception.created', now);
        await activeAppWithEndpoint(r, otherScope, {
          appId: 'app-other',
          url: 'https://hooks.partner.example/other',
        });

        const resolution = await r.resolveDeliveryTargets(
          scope,
          'reception.created',
        );
        expect(resolution.targets.map((t) => t.appId)).toEqual(['app-ok']);
        expect(resolution.targets[0]).toMatchObject({
          keyId: 'k1',
          secretRef: 'secret/app-ok',
          endpointId: 'app-ok-ep',
        });
        expect(resolution).toMatchObject({
          rejectedEndpointIds: [],
          suspendedSubscribers: 0,
        });

        // 失効した grant は行として残る(DELETE 禁止、revoked_at 付き)。
        const grants = await pool.query<{
          scope: string;
          revoked_at: Date | null;
        }>(
          `SELECT scope, revoked_at FROM partner_grants WHERE app_id = 'app-revoked'`,
        );
        expect(grants.rows[0]?.revoked_at).not.toBeNull();
        await expect(
          pool.query(`DELETE FROM partner_grants WHERE app_id = 'app-revoked'`),
        ).rejects.toThrow(/must not be deleted/);

        // partner 全体の一時停止は配送先を消し、一時停止中の購読者として数える。
        await r.setPartnerState('partner-yakureki', 'ACTIVE', 'SUSPENDED');
        await expect(
          r.resolveDeliveryTargets(scope, 'reception.created'),
        ).resolves.toMatchObject({
          targets: [],
          suspendedSubscribers: 1,
        });
      });
    });

    it('enforces state transitions, expected-state CAS, and terminal RETIRED', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await r.registerPartner({ partnerId: 'p', displayName: 'p', now });
        await expect(
          r.setPartnerState('p', 'DRAFT', 'SUSPENDED'),
        ).rejects.toThrow(PartnerStateTransitionError);
        await r.setPartnerState('p', 'DRAFT', 'ACTIVE');
        // stale な期待状態は conflict(last-writer-wins にしない)。
        await expect(r.setPartnerState('p', 'DRAFT', 'ACTIVE')).rejects.toThrow(
          PartnerStateConflictError,
        );
        await r.setPartnerState('p', 'ACTIVE', 'RETIRED');
        await expect(
          r.setPartnerState('p', 'RETIRED', 'ACTIVE'),
        ).rejects.toThrow(PartnerStateTransitionError);
        // app_id は tenant を跨いで一意。
        await r.issueApp(scope, { appId: 'app-unique', partnerId: 'p', now });
        await expect(
          r.issueApp(otherScope, { appId: 'app-unique', partnerId: 'p', now }),
        ).rejects.toThrow(/partner_apps_app_id_global_unique/);
        // 登録系は同一入力で冪等。
        await expect(
          r.issueApp(scope, { appId: 'app-unique', partnerId: 'p', now }),
        ).resolves.toBeUndefined();
      });
    });

    it('rejects non-public, non-resolving, rebinding endpoints, unknown scopes, and unverified or foreign activation', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await r.issueApp(scope, {
          appId: 'app-x',
          partnerId: 'partner-yakureki',
          now,
        });
        const endpoint = (url: string, id = 'ep-x', countryCode = 'JP') => ({
          appId: 'app-x',
          endpointId: id,
          url: new URL(url),
          keyId: 'k1',
          secretRef: 'secret/x',
          countryCode,
          now,
        });
        await expect(
          r.registerEndpoint(scope, endpoint('https://169.254.169.254/latest')),
        ).rejects.toThrow(/rejected/);
        await expect(
          r.registerEndpoint(scope, endpoint('https://localhost./x')),
        ).rejects.toThrow(/not public/);
        await expect(
          r.registerEndpoint(scope, endpoint('https://rebind.example/x')),
        ).rejects.toThrow(/private address/);
        await expect(
          r.registerEndpoint(scope, endpoint('https://nowhere.example/x')),
        ).rejects.toThrow(/does not resolve/);

        await expect(
          r.grant(scope, 'app-x', 'events:subscribe:*', now),
        ).rejects.toThrow(PartnerScopeError);
        await expect(
          r.grant(scope, 'app-x', 'patient:read-everything', now),
        ).rejects.toThrow(PartnerScopeError);
        await expect(
          r.grant(scope, 'app-x', 'patient:read', now),
        ).resolves.toBeUndefined();

        // 所有権未検証 / 国外は ACTIVE 化できない。
        await r.registerEndpoint(
          scope,
          endpoint('https://hooks.partner.example/x', 'ep-jp'),
        );
        await expect(
          r.setEndpointState(scope, 'ep-jp', 'PENDING_VERIFICATION', 'ACTIVE'),
        ).rejects.toThrow(/ownership/);
        await r.registerEndpoint(
          scope,
          endpoint('https://hooks.partner.example/us', 'ep-us', 'US'),
        );
        await r.recordEndpointOwnershipVerified(scope, 'ep-us', now);
        await expect(
          r.setEndpointState(scope, 'ep-us', 'PENDING_VERIFICATION', 'ACTIVE'),
        ).rejects.toThrow(/country/);
        await r.recordEndpointOwnershipVerified(scope, 'ep-jp', now);
        await expect(
          r.setEndpointState(scope, 'ep-jp', 'PENDING_VERIFICATION', 'ACTIVE'),
        ).resolves.toBeUndefined();
      });
    });

    it('delivers to every endpoint in parallel, keeps pending on partial failure, and never starves later endpoints', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-a',
          url: 'https://hooks.partner.example/a',
        });
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-b',
          url: 'https://hooks.partner.example/b',
        });
        await seedReceptionIntent(pool, scope, 'reception-reg-001');

        const calls: { url: string; init: RequestInit }[] = [];
        let failA = true;
        const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
          calls.push({ url: String(url), init: init! });
          if (String(url).endsWith('/a') && failA)
            return new Response('down', { status: 503 });
          return new Response(null, { status: 204 });
        });
        const secrets = { resolve: async (ref: string) => `resolved:${ref}` };
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(r, secrets, {
            fetch: fetchImpl,
            now: () => now,
          }),
        );

        const first = await worker.runOnce();
        expect(first.delivered).toBe(0);
        expect(first.failures).toEqual([
          expect.objectContaining({
            outboxEventId: 'ob-reception-reg-001',
            reason: 'PartialDeliveryError',
          }),
        ]);
        // 先頭(/a)が失敗しても /b は同じ run で受け取る。
        expect(calls.map((c) => c.url).sort()).toEqual([
          'https://hooks.partner.example/a',
          'https://hooks.partner.example/b',
        ]);

        const b = calls.find((c) => c.url.endsWith('/b'))!;
        const headers = b.init.headers as Record<string, string>;
        const body = b.init.body as string;
        expect(headers[WEBHOOK_EVENT_ID_HEADER]).toBe('ob-reception-reg-001');
        expect(headers[WEBHOOK_KEY_ID_HEADER]).toBe('k1');
        expect(
          verifyWebhookSignature(
            'resolved:secret/app-b',
            headers[WEBHOOK_TIMESTAMP_HEADER]!,
            body,
            headers[WEBHOOK_SIGNATURE_HEADER]!,
          ),
        ).toBe(true);
        expect(b.init.redirect).toBe('error');
        expect(JSON.parse(body)).toMatchObject({
          eventType: 'reception.created',
          aggregate: { type: 'reception', id: 'reception-reg-001' },
        });
        expect(body).not.toContain('patient');
        expect(body).not.toContain('resolved:secret');

        failA = false;
        const second = await worker.runOnce();
        expect(second.delivered).toBe(1);
        expect(calls).toHaveLength(4);
      });
    });

    it('keeps an intent pending while a subscriber is suspended, and marks it delivered when nobody subscribes', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-s',
          url: 'https://hooks.partner.example/s',
        });
        await r.setAppState(scope, 'app-s', 'ACTIVE', 'SUSPENDED');
        await seedReceptionIntent(pool, scope, 'reception-reg-002');
        const fetchImpl = vi.fn<typeof fetch>(
          async () => new Response(null, { status: 204 }),
        );
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(
            r,
            { resolve: async () => 's' },
            { fetch: fetchImpl },
          ),
        );
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 0,
          failures: [
            expect.objectContaining({ reason: 'SubscriberSuspendedError' }),
          ],
        });
        expect(fetchImpl).not.toHaveBeenCalled();
        // 復帰後に届く(event は失われていない)。
        await r.setAppState(scope, 'app-s', 'SUSPENDED', 'ACTIVE');
        await expect(worker.runOnce()).resolves.toMatchObject({ delivered: 1 });
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        // 購読者が居ない event は配送済み扱い。
        await seedReceptionIntent(pool, otherScope, 'reception-reg-003');
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 1,
          failed: 0,
        });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      });
    });

    it('skips a policy-violating endpoint row without stopping delivery to compliant ones', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-good',
          url: 'https://hooks.partner.example/good',
        });
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-bad',
          url: 'https://hooks.partner.example/bad',
        });
        // 生 SQL で policy 非適合 URL に書き換える(登録時検証をすり抜けた行を模す)。
        await pool.query(
          `UPDATE partner_delivery_endpoints SET url = 'https://rebind.example/bad' WHERE endpoint_id = 'app-bad-ep'`,
        );
        const resolution = await r.resolveDeliveryTargets(
          scope,
          'reception.created',
        );
        expect(resolution.targets.map((t) => t.appId)).toEqual(['app-good']);
        expect(resolution.rejectedEndpointIds).toEqual(['app-bad-ep']);
      });
    });

    it('aborts in-flight fan-out when the worker sink timeout fires', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-slow',
          url: 'https://hooks.partner.example/slow',
        });
        await seedReceptionIntent(pool, scope, 'reception-reg-004');
        const aborted: boolean[] = [];
        const hanging = vi.fn<typeof fetch>(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                aborted.push(true);
                reject(new Error('aborted'));
              });
            }),
        );
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(
            r,
            { resolve: async () => 's' },
            { fetch: hanging, timeoutMs: 10_000 },
          ),
          { sinkTimeoutMs: 400 },
        );
        const summary = await worker.runOnce();
        expect(summary.failures[0]).toMatchObject({ timedOut: true });
        // worker の timeout が fetch まで伝播し、孤児 fan-out が残らない。
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(aborted).toEqual([true]);
      });
    });

    it('does not defer when an active endpoint exists alongside a suspended one, and counts only truly blocked subscribers (H1)', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-mixed',
          url: 'https://hooks.partner.example/m1',
        });
        await r.registerEndpoint(scope, {
          appId: 'app-mixed',
          endpointId: 'app-mixed-ep2',
          url: new URL('https://hooks.partner.example/m2'),
          keyId: 'k1',
          secretRef: 'secret/m2',
          countryCode: 'JP',
          now,
        });
        await r.recordEndpointOwnershipVerified(scope, 'app-mixed-ep2', now);
        await r.setEndpointState(
          scope,
          'app-mixed-ep2',
          'PENDING_VERIFICATION',
          'ACTIVE',
        );
        await r.setEndpointState(scope, 'app-mixed-ep2', 'ACTIVE', 'SUSPENDED');
        // grant の無い SUSPENDED app は「止まっている購読者」に数えない。
        await r.issueApp(scope, {
          appId: 'app-nogrant-susp',
          partnerId: 'partner-yakureki',
          now,
        });
        await r.setAppState(scope, 'app-nogrant-susp', 'DRAFT', 'ACTIVE');
        await r.subscribe(scope, 'app-nogrant-susp', 'reception.created', now);
        await r.setAppState(scope, 'app-nogrant-susp', 'ACTIVE', 'SUSPENDED');
        await seedReceptionIntent(pool, scope, 'reception-reg-h1');
        const fetchImpl = vi.fn<typeof fetch>(
          async () => new Response(null, { status: 204 }),
        );
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(
            r,
            { resolve: async () => 's' },
            { fetch: fetchImpl },
          ),
        );
        const resolution = await r.resolveDeliveryTargets(
          scope,
          'reception.created',
        );
        expect(resolution.targets.map((t) => t.endpointId)).toEqual([
          'app-mixed-ep',
        ]);
        expect(resolution.suspendedSubscribers).toBe(0);
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 1,
          failed: 0,
        });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 0,
          failed: 0,
        });
      });
    });

    it('keeps an intent pending and reports it when every candidate endpoint is rejected by policy (H2)', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-only',
          url: 'https://hooks.partner.example/only',
        });
        await pool.query(
          `UPDATE partner_delivery_endpoints SET url = 'https://rebind.example/only' WHERE endpoint_id = 'app-only-ep'`,
        );
        await seedReceptionIntent(pool, scope, 'reception-reg-h2');
        const fetchImpl = vi.fn<typeof fetch>(
          async () => new Response(null, { status: 204 }),
        );
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(
            r,
            { resolve: async () => 's' },
            { fetch: fetchImpl },
          ),
        );
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 0,
          failures: [
            expect.objectContaining({ reason: 'EndpointPolicyRejectedError' }),
          ],
        });
        expect(fetchImpl).not.toHaveBeenCalled();
      });
    });

    it('rejects re-registration with different attributes instead of silently ignoring it (M1)', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await r.registerPartner({ partnerId: 'p1', displayName: 'one', now });
        await r.registerPartner({ partnerId: 'p2', displayName: 'two', now });
        await expect(
          r.registerPartner({ partnerId: 'p1', displayName: 'renamed', now }),
        ).rejects.toThrow(PartnerRegistrationConflictError);
        await r.issueApp(scope, { appId: 'app-m1', partnerId: 'p1', now });
        await expect(
          r.issueApp(scope, { appId: 'app-m1', partnerId: 'p2', now }),
        ).rejects.toThrow(PartnerRegistrationConflictError);
        const endpoint = (url: string) => ({
          appId: 'app-m1',
          endpointId: 'ep-m1',
          url: new URL(url),
          keyId: 'k1',
          secretRef: 'secret/m1',
          countryCode: 'JP',
          now,
        });
        await r.registerEndpoint(
          scope,
          endpoint('https://hooks.partner.example/a'),
        );
        await expect(
          r.registerEndpoint(
            scope,
            endpoint('https://hooks.partner.example/a'),
          ),
        ).resolves.toBeUndefined();
        await expect(
          r.registerEndpoint(
            scope,
            endpoint('https://hooks.partner.example/b'),
          ),
        ).rejects.toThrow(PartnerRegistrationConflictError);
      });
    });

    it('keeps the full grant history across revoke and re-grant, enforces the country CHECK, and retires endpoints terminally (M2/M3/F13)', async () => {
      await withMigratedSchema(async (pool) => {
        const r = registry(pool);
        await activePartner(r);
        await activeAppWithEndpoint(r, scope, {
          appId: 'app-h',
          url: 'https://hooks.partner.example/h',
        });
        const t1 = new Date('2026-08-24T01:00:00.000Z');
        const t2 = new Date('2026-08-24T02:00:00.000Z');
        const t3 = new Date('2026-08-24T03:00:00.000Z');
        await r.grant(scope, 'app-h', 'patient:read', t1);
        await r.revokeGrant(scope, 'app-h', 'patient:read', t2);
        await r.grant(scope, 'app-h', 'patient:read', t3);
        const history = await pool.query<{
          granted_at: Date;
          revoked_at: Date | null;
        }>(
          `SELECT granted_at, revoked_at FROM partner_grant_history WHERE app_id = 'app-h' AND scope = 'patient:read' ORDER BY sequence_number`,
        );
        // 履歴: (t1, NULL) → (t1, t2) の 2 世代が残り、live 行は (t3, NULL)。
        expect(
          history.rows.map((row) => [
            row.granted_at.toISOString(),
            row.revoked_at?.toISOString() ?? null,
          ]),
        ).toEqual([
          [t1.toISOString(), null],
          [t1.toISOString(), t2.toISOString()],
        ]);
        await expect(
          pool.query(
            `UPDATE partner_delivery_endpoints SET country_code = 'US' WHERE endpoint_id = 'app-h-ep'`,
          ),
        ).rejects.toThrow(/active_country_allowed/);
        await r.setEndpointState(scope, 'app-h-ep', 'ACTIVE', 'RETIRED');
        await expect(
          r.setEndpointState(scope, 'app-h-ep', 'RETIRED', 'ACTIVE'),
        ).rejects.toThrow(PartnerStateTransitionError);
        await expect(
          r.resolveDeliveryTargets(scope, 'reception.created'),
        ).resolves.toMatchObject({ targets: [], suspendedSubscribers: 0 });
      });
    });
  },
);
