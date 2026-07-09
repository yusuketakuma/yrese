import { parseApiPort, parseDatabaseUrl } from './config.js';
import { assertMigrationStateAllowsStartup } from './db/migration-runner.js';
import { loadMigrationFiles } from './db/migrations.js';
import { createDbPool } from './db/pool.js';
import { buildServer } from './server.js';

async function checkDatabaseSchemaIfConfigured(): Promise<void> {
  const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  if (databaseUrl === undefined) {
    return;
  }

  const pool = createDbPool(databaseUrl);
  try {
    const migrations = await loadMigrationFiles();
    await assertMigrationStateAllowsStartup(pool, migrations);
  } finally {
    await pool.end();
  }
}

const server = buildServer();

try {
  await checkDatabaseSchemaIfConfigured();
  const port = parseApiPort(process.env.PORT);
  server.log.info({ port }, 'API server port selected');
  const address = await server.listen({ host: '0.0.0.0', port });
  server.log.info({ address }, 'API server listening');
} catch (error) {
  server.log.error(error, 'API server failed to start');
  process.exitCode = 1;
}
