import { parseDatabaseUrl } from '../config.js';
import { seedSyntheticMasters } from '../master-seed.js';
import { PostgresMasterRepository } from './master-repository.js';
import { createDbPool } from './pool.js';

/**
 * WP-7301/WP-7303(MST-003 §4): synthetic master seed 用 CLI。
 * 冪等(既存 version/localCode は skip)。対象 scope は env で指定する:
 *   YRESE_MASTER_SEED_TENANT_ID / YRESE_MASTER_SEED_PHARMACY_ID
 * 未指定時は dev 既定(dev-tenant / dev-pharmacy)。実マスターデータの
 * 取込ではない(RB-009 維持 — synthetic fixture のみ)。監査対象外。
 */
const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required for db:seed-masters');
}

const scope = {
  tenantId: process.env.YRESE_MASTER_SEED_TENANT_ID ?? 'dev-tenant',
  pharmacyId: process.env.YRESE_MASTER_SEED_PHARMACY_ID ?? 'dev-pharmacy',
};

const pool = createDbPool(databaseUrl);
try {
  await seedSyntheticMasters(
    new PostgresMasterRepository(pool),
    scope,
    new Date().toISOString(),
  );
  console.log(
    `Seeded synthetic masters for ${scope.tenantId}/${scope.pharmacyId}`,
  );
} finally {
  await pool.end();
}
