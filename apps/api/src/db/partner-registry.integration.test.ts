import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import { pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

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

async function activePartnerWithEndpoint(
  registry: PostgresPartnerRegistry,
  s: typeof scope,
  input: {
    readonly appId: string;
    readonly url: string;
    readonly subscribe?: boolean;
    readonly grant?: boolean;
  },
): Promise<void> {
  await registry.issueApp(s, {
    appId: input.appId,
    partnerId: 'partner-yakureki',
    now,
  });
  await registry.setAppState(s, input.appId, 'ACTIVE');
  if (input.grant !== false) {
    await registry.grant(
      s,
      input.appId,
      subscribeScopeFor('reception.created'),
      now,
    );
  }
  if (input.subscribe !== false) {
    await registry.subscribe(s, input.appId, 'reception.created', now);
  }
  await registry.registerEndpoint(s, {
    appId: input.appId,
    endpointId: `${input.appId}-ep`,
    url: new URL(input.url),
    keyId: 'k1',
    secretRef: `secret/${input.appId}`,
    countryCode: 'JP',
    now,
  });
  await registry.setEndpointState(s, `${input.appId}-ep`, 'ACTIVE');
}

describePostgres(
  'PostgresPartnerRegistry + RegistryRoutedSink (PostgreSQL)',
  () => {
    it('resolves only fully active, subscribed, and granted endpoints within the tenant', async () => {
      await withMigratedSchema(async (pool) => {
        const registry = new PostgresPartnerRegistry(pool);
        await registry.registerPartner({
          partnerId: 'partner-yakureki',
          displayName: '合成薬歴',
          now,
        });
        await registry.setPartnerState('partner-yakureki', 'ACTIVE');
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-ok',
          url: 'https://hooks.partner.example/ok',
        });
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-nosub',
          url: 'https://hooks.partner.example/nosub',
          subscribe: false,
        });
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-nogrant',
          url: 'https://hooks.partner.example/nogrant',
          grant: false,
        });
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-suspended',
          url: 'https://hooks.partner.example/suspended',
        });
        await registry.setAppState(scope, 'app-suspended', 'SUSPENDED');
        await activePartnerWithEndpoint(registry, otherScope, {
          appId: 'app-other-tenant',
          url: 'https://hooks.partner.example/other',
        });

        const targets = await registry.resolveDeliveryTargets(
          scope,
          'reception.created',
        );
        expect(targets.map((t) => t.appId)).toEqual(['app-ok']);
        expect(targets[0]).toMatchObject({
          keyId: 'k1',
          secretRef: 'secret/app-ok',
          endpointId: 'app-ok-ep',
        });

        // partner 全体の停止は全 app の配送先を消す。
        await registry.setPartnerState('partner-yakureki', 'SUSPENDED');
        await expect(
          registry.resolveDeliveryTargets(scope, 'reception.created'),
        ).resolves.toEqual([]);
      });
    });

    it('rejects non-public endpoints at registration and non-wildcard scopes at the database', async () => {
      await withMigratedSchema(async (pool) => {
        const registry = new PostgresPartnerRegistry(pool);
        await registry.registerPartner({
          partnerId: 'partner-yakureki',
          displayName: '合成薬歴',
          now,
        });
        await registry.issueApp(scope, {
          appId: 'app-x',
          partnerId: 'partner-yakureki',
          now,
        });
        await expect(
          registry.registerEndpoint(scope, {
            appId: 'app-x',
            endpointId: 'ep-x',
            url: new URL('https://169.254.169.254/latest'),
            keyId: 'k1',
            secretRef: 'secret/x',
            countryCode: 'JP',
            now,
          }),
        ).rejects.toThrow(/partner endpoint rejected/);
        await expect(
          registry.grant(scope, 'app-x', 'events:subscribe:*', now),
        ).rejects.toThrow(/partner_grants_no_wildcard/);
        await expect(
          registry.grant(scope, 'app-x', 'patient:read', now),
        ).resolves.toBeUndefined();
      });
    });

    it('delivers an outbox intent to every resolved endpoint with a per-endpoint key and treats partial failure as pending', async () => {
      await withMigratedSchema(async (pool) => {
        const registry = new PostgresPartnerRegistry(pool);
        await registry.registerPartner({
          partnerId: 'partner-yakureki',
          displayName: '合成薬歴',
          now,
        });
        await registry.setPartnerState('partner-yakureki', 'ACTIVE');
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-a',
          url: 'https://hooks.partner.example/a',
        });
        await activePartnerWithEndpoint(registry, scope, {
          appId: 'app-b',
          url: 'https://hooks.partner.example/b',
        });
        await seedReceptionIntent(pool, scope, 'reception-reg-001');

        const calls: { url: string; init: RequestInit }[] = [];
        let failB = true;
        const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
          calls.push({ url: String(url), init: init! });
          if (String(url).endsWith('/b') && failB)
            return new Response('down', { status: 503 });
          return new Response(null, { status: 204 });
        });
        const secrets = { resolve: async (ref: string) => `resolved:${ref}` };
        const sink = new RegistryRoutedSink(registry, secrets, {
          fetch: fetchImpl,
          now: () => now,
        });
        const worker = new PostgresOutboxDeliveryWorker(pool, sink);

        const first = await worker.runOnce();
        expect(first.delivered).toBe(0);
        expect(first.failures).toEqual([
          expect.objectContaining({
            outboxEventId: 'ob-reception-reg-001',
            reason: 'WebhookDeliveryError',
          }),
        ]);
        expect(calls.map((c) => c.url)).toEqual([
          'https://hooks.partner.example/a',
          'https://hooks.partner.example/b',
        ]);

        const headers = calls[0]!.init.headers as Record<string, string>;
        const body = calls[0]!.init.body as string;
        expect(headers[WEBHOOK_EVENT_ID_HEADER]).toBe('ob-reception-reg-001');
        expect(headers[WEBHOOK_KEY_ID_HEADER]).toBe('k1');
        expect(
          verifyWebhookSignature(
            'resolved:secret/app-a',
            headers[WEBHOOK_TIMESTAMP_HEADER]!,
            body,
            headers[WEBHOOK_SIGNATURE_HEADER]!,
          ),
        ).toBe(true);
        expect(calls[0]!.init.redirect).toBe('error');
        expect(JSON.parse(body)).toMatchObject({
          eventType: 'reception.created',
          aggregate: { type: 'reception', id: 'reception-reg-001' },
        });
        expect(body).not.toContain('patient');
        expect(body).not.toContain('resolved:secret');

        failB = false;
        const second = await worker.runOnce();
        expect(second.delivered).toBe(1);
        // 再送は全配送先へ(受信側は eventId で冪等)。
        expect(calls).toHaveLength(4);
      });
    });

    it('marks an intent delivered when no subscriber exists', async () => {
      await withMigratedSchema(async (pool) => {
        const registry = new PostgresPartnerRegistry(pool);
        await seedReceptionIntent(pool, scope, 'reception-reg-002');
        const fetchImpl = vi.fn<typeof fetch>();
        const worker = new PostgresOutboxDeliveryWorker(
          pool,
          new RegistryRoutedSink(
            registry,
            { resolve: async () => 'unused' },
            { fetch: fetchImpl },
          ),
        );
        await expect(worker.runOnce()).resolves.toMatchObject({
          delivered: 1,
          failed: 0,
        });
        expect(fetchImpl).not.toHaveBeenCalled();
      });
    });
  },
);
