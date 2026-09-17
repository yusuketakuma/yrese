import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { pharmacyId, tenantId } from '@yrese/shared-kernel';
import type { MedicationItem } from '@yrese/contracts';

import { seedSyntheticMasters } from '../master-seed.js';
import { PostgresMasterRepository } from './master-repository.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';
import { resolveTestDatabaseUrl } from './test-database-environment.js';

/**
 * WP-7301/WP-7303 受入(Postgres 永続境界):
 * master_versions / medication_items / usage_items は append-only
 * (trigger が UPDATE/DELETE/TRUNCATE を拒否)、版解決は明示 asOf で
 * valid_from 最大の版を選び、seed は冪等、scope 絞込みを保持する。
 */

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
const describePostgres = testDatabaseUrl === undefined ? describe.skip : describe;

const scope = {
  tenantId: 'tenant-mst-int-001',
  pharmacyId: 'pharmacy-mst-int-001',
};
const brandedScope = {
  tenantId: tenantId(scope.tenantId),
  pharmacyId: pharmacyId(scope.pharmacyId),
};
const recordedAt = '2026-09-18T00:00:00.000Z';

function createTestSchemaName(): string {
  return `yrese_master_test_${process.pid}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function withMigratedSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL unexpectedly missing');
  }
  const schemaName = createTestSchemaName();
  const adminPool = createDbPool(testDatabaseUrl, { max: 1 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  await adminPool.end();

  const pool = createDbPool(testDatabaseUrl, {
    max: 1,
    options: `-c search_path=${schemaName}`,
  });
  try {
    await applyPendingMigrations(pool, await loadMigrationFiles(), {
      appliedBy: 'vitest',
      appliedAt: new Date('2026-09-18T00:00:00.000Z'),
    });
    await run(pool);
  } finally {
    await pool.end();
    const cleanupPool = createDbPool(testDatabaseUrl, { max: 1 });
    await cleanupPool.query(`DROP SCHEMA ${schemaName} CASCADE`);
    await cleanupPool.end();
  }
}

describePostgres('WP-7301/7303 master foundation (Postgres)', () => {
  it('seeds synthetic masters and lists items for a covering asOf', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      const result = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
      });
      expect(result.kind).toBe('listed');
      if (result.kind !== 'listed') return;
      expect(result.masterVersion.version).toBe('SYN-2026-001');
      expect(result.masterVersion.distributionState).toBe('synthetic');
      expect(result.items.length).toBeGreaterThanOrEqual(6);
      for (const item of result.items as readonly MedicationItem[]) {
        expect(item.localCode).toMatch(/^SYN-/u);
      }
    });
  });

  it('resolves the version with the greatest valid_from covering asOf', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      // 後継版(2026-07-01 から有効)を seed 追加し、asOf で版が切替ることを確認。
      await repository.seedVersion({
        ...brandedScope,
        masterVersionId: '00000000-0000-4000-8000-00000000b001',
        masterKind: 'medication',
        version: 'SYN-2026-002',
        validFrom: '2026-07-01',
        validTo: null,
        transitionNote: null,
        recordedAt,
      });
      const before = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-30',
      });
      const after = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-07-01',
      });
      if (before.kind !== 'listed' || after.kind !== 'listed') {
        throw new Error('expected listed results');
      }
      expect(before.masterVersion.version).toBe('SYN-2026-001');
      expect(after.masterVersion.version).toBe('SYN-2026-002');
      // 旧版に属する品目は新版では返らない(版は品目集合を束ねる)。
      expect(after.items).toHaveLength(0);
    });
  });

  it('returns no_version when asOf precedes every version', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      const result = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2020-01-01',
      });
      expect(result.kind).toBe('no_version');
    });
  });

  it('isolates items by tenant/pharmacy scope', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      const other = await repository.list({
        tenantId: tenantId('tenant-mst-int-999'),
        pharmacyId: pharmacyId('pharmacy-mst-int-999'),
        kind: 'medication',
        asOf: '2026-06-01',
      });
      expect(other.kind).toBe('no_version');
    });
  });

  it('seed is idempotent: re-running records no duplicate rows', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      await seedSyntheticMasters(repository, scope, recordedAt);
      const versions = await pool.query(
        `SELECT count(*)::int AS n FROM master_versions
          WHERE tenant_id = $1 AND pharmacy_id = $2`,
        [scope.tenantId, scope.pharmacyId],
      );
      expect(versions.rows[0].n).toBe(2);
      const items = await pool.query(
        `SELECT count(*)::int AS n FROM medication_items
          WHERE tenant_id = $1 AND pharmacy_id = $2`,
        [scope.tenantId, scope.pharmacyId],
      );
      expect(items.rows[0].n).toBe(6);
    });
  });

  it('rejects UPDATE/DELETE/TRUNCATE on master tables (append-only)', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      await expect(
        pool.query(
          `UPDATE medication_items SET name = 'x'
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [scope.tenantId, scope.pharmacyId],
        ),
      ).rejects.toThrow(/append-only/u);
      await expect(
        pool.query(
          `DELETE FROM usage_items
            WHERE tenant_id = $1 AND pharmacy_id = $2`,
          [scope.tenantId, scope.pharmacyId],
        ),
      ).rejects.toThrow(/append-only/u);
      // TRUNCATE は FK 参照(master_versions)か trigger で拒否される。
      // どちらも append-only を維持するので拒否自体を検証する。
      await expect(
        pool.query(`TRUNCATE master_versions CASCADE`),
      ).rejects.toThrow();
    });
  });

  it('matches q by localCode prefix or name substring, case-sensitive', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      const prefix = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
        q: 'SYN-MED-001',
      });
      if (prefix.kind !== 'listed') throw new Error('expected listed');
      expect(prefix.items).toHaveLength(1);
      const substring = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
        q: '麻薬',
      });
      if (substring.kind !== 'listed') throw new Error('expected listed');
      expect(substring.items).toHaveLength(1);
      const lower = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
        q: 'syn-med',
      });
      if (lower.kind !== 'listed') throw new Error('expected listed');
      expect(lower.items).toHaveLength(0);
    });
  });

  it('treats LIKE metacharacters in q as literals (in-memory parity)', async () => {
    await withMigratedSchema(async (pool) => {
      const repository = new PostgresMasterRepository(pool);
      await seedSyntheticMasters(repository, scope, recordedAt);
      // '_' がワイルドカードなら任意1文字として全 localCode に prefix 一致する。
      // リテラル扱いなら '_' 始まりの code が無い限り 0 件。
      for (const q of ['_', '\\']) {
        const result = await repository.list({
          ...brandedScope,
          kind: 'medication',
          asOf: '2026-06-01',
          q,
        });
        if (result.kind !== 'listed') throw new Error('expected listed');
        expect(result.items).toHaveLength(0);
      }
      // '%' はリテラル部分一致 — seed には '%' 含有名があり得るため、
      // 返却品目が全て '%' を名前に含むこと(= wildcard ではない)を検証する。
      const percent = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
        q: '%',
      });
      if (percent.kind !== 'listed') throw new Error('expected listed');
      const all = await repository.list({
        ...brandedScope,
        kind: 'medication',
        asOf: '2026-06-01',
      });
      if (all.kind !== 'listed') throw new Error('expected listed');
      expect(percent.items.length).toBeLessThan(all.items.length);
      for (const item of percent.items) {
        expect('name' in item && item.name.includes('%')).toBe(true);
      }
    });
  });
});
