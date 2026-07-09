import {
  parseApiPort,
  parseDatabaseUrl,
  resolveApiRepositoryMode,
  resolveTenantContextMode,
} from './config.js';
import { assertMigrationStateAllowsStartup } from './db/migration-runner.js';
import { loadMigrationFiles } from './db/migrations.js';
import { PostgresPatientRepository } from './db/patient-repository.js';
import { createDbPool } from './db/pool.js';
import { PostgresReceptionRepository } from './db/reception-repository.js';
import { buildServer } from './server.js';

async function buildServerForEnvironment(): Promise<ReturnType<typeof buildServer>> {
  const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  const repositoryMode = resolveApiRepositoryMode({
    repositoryMode: process.env.YRESE_API_REPOSITORY_MODE,
    databaseUrl,
    nodeEnv: process.env.NODE_ENV,
  });
  const tenantContextMode = resolveTenantContextMode({
    allowDevTenantStub: process.env.YRESE_ALLOW_DEV_TENANT_STUB,
    nodeEnv: process.env.NODE_ENV,
    repositoryMode,
    databaseUrl,
  });

  if (repositoryMode === 'in_memory') {
    return buildServer({ repositoryMode, tenantContextMode });
  }

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for postgres repository mode');
  }

  const pool = createDbPool(databaseUrl);
  try {
    const migrations = await loadMigrationFiles();
    await assertMigrationStateAllowsStartup(pool, migrations);
    const server = buildServer({
      patientRepository: new PostgresPatientRepository(pool),
      receptionRepository: new PostgresReceptionRepository(pool),
      repositoryMode,
      tenantContextMode,
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
