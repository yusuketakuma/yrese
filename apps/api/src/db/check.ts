import { parseDatabaseUrl } from '../config.js';
import { formatMigrationCheckResult } from './migration-state.js';
import { assertMigrationStateAllowsStartup } from './migration-runner.js';
import { loadMigrationFiles } from './migrations.js';
import { createDbPool } from './pool.js';

const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required for db:check');
}

const pool = createDbPool(databaseUrl);
try {
  const migrations = await loadMigrationFiles();
  const result = await assertMigrationStateAllowsStartup(pool, migrations);
  console.log(formatMigrationCheckResult(result));
} finally {
  await pool.end();
}
