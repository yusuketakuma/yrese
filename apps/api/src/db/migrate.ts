import { parseDatabaseUrl } from '../config.js';
import { formatMigrationCheckResult } from './migration-state.js';
import { applyPendingMigrations } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';

const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required for db:migrate');
}

const pool = createDbPool(databaseUrl);
try {
  const migrations = await loadMigrationFiles();
  const result = await applyPendingMigrations(pool, migrations, {
    appliedBy: process.env.USER?.trim() || 'yrese-db-migrate',
  });
  const applied = result.appliedVersions.length === 0 ? 'none' : result.appliedVersions.join(', ');
  console.log(`Applied migrations: ${applied}`);
  console.log(formatMigrationCheckResult(result.check));
} finally {
  await pool.end();
}
