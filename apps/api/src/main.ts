import { randomBytes } from 'node:crypto';

import { InMemoryAuditRepository } from './audit-repository.js';
import {
  parseApiPort,
  parseDatabaseUrl,
  resolveApiRepositoryMode,
  resolveDbPoolConfiguration,
  resolvePatientSearchCursorHmacKey,
  resolveTenantContextMode,
} from './config.js';
import { PostgresAuditRepository } from './db/audit-repository.js';
import { assertMigrationStateAllowsStartup } from './db/migration-runner.js';
import { loadMigrationFiles } from './db/migrations.js';
import { PostgresOperationsReadService } from './db/operations-read.js';
import { PostgresPatientRepository } from './db/patient-repository.js';
import {
  closeObservedDatabasePool,
  createDbPool,
  observeDatabasePoolBackgroundErrors,
  snapshotDatabasePool,
} from './db/pool.js';
import { PostgresPrescriptionDraftService } from './db/prescription-draft-service.js';
import { PostgresReceptionCreateCommand } from './db/reception-command.js';
import { PostgresReceptionRepository } from './db/reception-repository.js';
import { operationsRoutes } from './operations-routes.js';
import { InMemoryOperationsReadService } from './operations-service.js';
import { InMemoryPatientRepository } from './patient-repository.js';
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from './patient-search-cursor.js';
import { prescriptionDraftRoutes } from './prescription-draft-routes.js';
import { InMemoryPrescriptionDraftService } from './prescription-draft-service.js';
import { InMemoryReceptionOutbox } from './reception-command.js';
import { InMemoryReceptionRepository } from './reception-repository.js';
import {
  createJsonRuntimeOperationalEventSink,
  type DatabasePoolSnapshot,
} from './runtime-events.js';
import {
  registerGracefulShutdown,
  type RuntimeSignalSource,
} from './runtime-lifecycle.js';
import { buildServer } from './server.js';
import {
  handleStartupFailure,
  normalizeStartupFailure,
  preserveStartupFailureAcrossCleanup,
} from './startup-failure.js';

interface BuiltServerRuntime {
  readonly server: ReturnType<typeof buildServer>;
  readonly databasePoolSnapshot?: () => DatabasePoolSnapshot;
}

const runtimeEvents = createJsonRuntimeOperationalEventSink();

async function buildServerForEnvironment(): Promise<BuiltServerRuntime> {
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
    const patientRepository = new InMemoryPatientRepository();
    const receptionRepository = new InMemoryReceptionRepository();
    const auditRepository = new InMemoryAuditRepository();
    // 運用状態の読み取りが数えるのは、受付コマンドが実際に追記した intent である。
    // 同一インスタンスを buildServer と読み取りサービスへ共有する。
    const receptionOutbox = new InMemoryReceptionOutbox();
    const server = buildServer({
      patientRepository,
      receptionRepository,
      auditRepository,
      receptionOutbox,
      repositoryMode,
      tenantContextMode,
      patientSearchCursorCodec,
    });
    server.register(prescriptionDraftRoutes, {
      service: new InMemoryPrescriptionDraftService(
        receptionRepository,
        auditRepository,
      ),
    });
    server.register(operationsRoutes, {
      service: new InMemoryOperationsReadService(receptionOutbox, receptionRepository),
    });
    return Object.freeze({ server });
  }

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for postgres repository mode');
  }

  const poolConfiguration = resolveDbPoolConfiguration({
    max: process.env.YRESE_DB_POOL_MAX,
    idleTimeoutMillis: process.env.YRESE_DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: process.env.YRESE_DB_POOL_CONNECTION_TIMEOUT_MS,
    maxLifetimeSeconds: process.env.YRESE_DB_POOL_MAX_LIFETIME_SECONDS,
  });
  const pool = createDbPool(databaseUrl, {}, poolConfiguration);
  let stopObservingPool: (() => void) | undefined;
  try {
    stopObservingPool = observeDatabasePoolBackgroundErrors(pool, runtimeEvents);
    const migrations = await loadMigrationFiles();
    await assertMigrationStateAllowsStartup(pool, migrations);
    const server = buildServer({
      patientRepository: new PostgresPatientRepository(pool),
      receptionRepository: new PostgresReceptionRepository(pool),
      auditRepository: new PostgresAuditRepository(pool),
      // WP-4050: 受付・監査・outbox を単一トランザクションで原子化する。
      receptionCreateCommand: new PostgresReceptionCreateCommand(pool),
      repositoryMode,
      tenantContextMode,
      patientSearchCursorCodec,
    });
    server.register(prescriptionDraftRoutes, {
      service: new PostgresPrescriptionDraftService(pool),
    });
    server.register(operationsRoutes, {
      service: new PostgresOperationsReadService({ pool, migrations }),
    });
    server.addHook('onClose', async () => {
      await closeObservedDatabasePool(pool, stopObservingPool ?? (() => {}));
    });
    return Object.freeze({
      server,
      databasePoolSnapshot: () => snapshotDatabasePool(pool),
    });
  } catch (error) {
    throw await preserveStartupFailureAcrossCleanup({
      originalError: error,
      cleanup: () => closeObservedDatabasePool(pool, stopObservingPool ?? (() => {})),
    });
  }
}

function createRuntimeSignalSource(): RuntimeSignalSource {
  const signals: RuntimeSignalSource = {
    on(signal, listener) {
      process.on(signal, listener);
    },
    off(signal, listener) {
      process.off(signal, listener);
    },
    setExitCode(exitCode) {
      process.exitCode = exitCode;
    },
  };
  return Object.freeze(signals);
}

let server: ReturnType<typeof buildServer> | undefined;

try {
  const runtime = await buildServerForEnvironment();
  server = runtime.server;
  const port = parseApiPort(process.env.PORT);
  runtimeEvents.record({ kind: 'api.startup.port_selected', port });
  await server.listen({ host: '0.0.0.0', port });
  runtimeEvents.record({ kind: 'api.startup.listening', port });
  registerGracefulShutdown({
    server,
    signals: createRuntimeSignalSource(),
    events: runtimeEvents,
    ...(runtime.databasePoolSnapshot === undefined
      ? {}
      : { databasePoolSnapshot: runtime.databasePoolSnapshot }),
  });
} catch (error) {
  const startupFailure = normalizeStartupFailure(error);
  const failureReporter = {
    report: (message: string) => console.error(message),
    setExitCode: (exitCode: number) => {
      process.exitCode = exitCode;
    },
  };
  if (server === undefined) {
    await handleStartupFailure({
      originalError: startupFailure.originalError,
      server: undefined,
      ...('priorCleanupFailure' in startupFailure
        ? { priorCleanupFailure: startupFailure.priorCleanupFailure }
        : {}),
      ...failureReporter,
    });
  } else {
    await handleStartupFailure({
      originalError: startupFailure.originalError,
      server,
      ...failureReporter,
    });
  }
}
