import { parseApiPort, parseDatabaseUrl } from './config.js';
import { assertMigrationStateAllowsStartup } from './db/migration-runner.js';
import { loadMigrationFiles } from './db/migrations.js';
import { PostgresPatientRepository } from './db/patient-repository.js';
import { createDbPool } from './db/pool.js';
import { PostgresReceptionRepository } from './db/reception-repository.js';
import { buildServer } from './server.js';

async function buildServerForEnvironment(): Promise<ReturnType<typeof buildServer>> {
  const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  if (databaseUrl === undefined) {
    return buildServer();
  }

  const pool = createDbPool(databaseUrl);
  try {
    const migrations = await loadMigrationFiles();
    await assertMigrationStateAllowsStartup(pool, migrations);
    const server = buildServer({
      patientRepository: new PostgresPatientRepository(pool),
      receptionRepository: new PostgresReceptionRepository(pool),
    });
    server.addHook('onClose', async () => {
      await pool.end();
    });
    return server;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

let server: ReturnType<typeof buildServer> | undefined;

try {
  server = await buildServerForEnvironment();
  const port = parseApiPort(process.env.PORT);
  server.log.info({ port }, 'API server port selected');
  const address = await server.listen({ host: '0.0.0.0', port });
  server.log.info({ address }, 'API server listening');
} catch (error) {
  if (server !== undefined) {
    server.log.error(error, 'API server failed to start');
    await server.close().catch(() => undefined);
  }
  console.error(error);
  process.exitCode = 1;
}
