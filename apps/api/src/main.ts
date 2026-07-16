import { randomBytes } from 'node:crypto';
import {
  parseApiPort,
  parseDatabaseUrl,
  resolveApiRepositoryMode,
  resolvePatientSearchCursorHmacKey,
  resolveTenantContextMode,
} from './config.js';
import { PostgresAuditRepository } from './db/audit-repository.js';
import { assertMigrationStateAllowsStartup } from './db/migration-runner.js';
import { loadMigrationFiles } from './db/migrations.js';
import { PostgresPatientRepository } from './db/patient-repository.js';
import { createDbPool } from './db/pool.js';
import { PostgresReceptionRepository } from './db/reception-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { buildServer } from './server.js';
import { handleStartupFailure } from './startup-failure.js';

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
  const cursorKeyResolution = resolvePatientSearchCursorHmacKey({
    configuredKey: process.env.YRESE_PATIENT_SEARCH_CURSOR_HMAC_KEY,
    nodeEnv: process.env.NODE_ENV,
    repositoryMode,
  });
  const patientSearchCursorHmacKey =
    cursorKeyResolution.kind === 'configured'
      ? cursorKeyResolution.key
      : randomBytes(patientSearchCursorHmacKeyByteLength);
  const patientSearchCursorCodec = createPatientSearchCursorCodec(patientSearchCursorHmacKey);

  if (repositoryMode === 'in_memory') {
    return buildServer({ repositoryMode, tenantContextMode, patientSearchCursorCodec });
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
      auditRepository: new PostgresAuditRepository(pool),
      repositoryMode,
      tenantContextMode,
      patientSearchCursorCodec,
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
  await handleStartupFailure({
    originalError: error,
    server,
    report: (message) => console.error(message),
    setExitCode: (exitCode) => {
      process.exitCode = exitCode;
    },
  });
}
