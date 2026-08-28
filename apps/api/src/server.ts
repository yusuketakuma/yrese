import Fastify, { type FastifyInstance } from 'fastify';
import {
  healthResponseSchema,
  type HealthResponse,
  whoamiResponseSchema,
  type WhoamiResponse,
} from '@yrese/contracts';
import { permissionScope } from '@yrese/shared-kernel';

import {
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
  type ApiRepositoryMode,
} from './config.js';
import { auditLogRoutes } from './audit-log-routes.js';
import type { PatientSearchCursorCodec } from './patient-search-cursor.js';
import { patientRoutes } from './patient-routes.js';
import {
  requirePermission,
  requireTenantContext,
  tenantContextPlugin,
  type TenantContextMode,
} from './plugins/tenant-context.js';
import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
import {
  InMemoryReceptionOutbox,
  composeDefaultReceptionCreateCommand,
  type ReceptionCreateCommand,
} from './reception-command.js';
import {
  InMemoryPatientRepository,
  type PatientRepository,
} from './patient-repository.js';
import {
  InMemoryReceptionRepository,
  type ReceptionRepository,
} from './reception-repository.js';
import { receptionCreateRoutes } from './reception-create-routes.js';
import { receptionQueueRoutes } from './reception-queue-routes.js';
import { snapshotWallClock } from './route-invariants.js';

export {
  auditLogDuplicateIdentityInvariantErrorMessage,
  auditLogListSchemaInvariantErrorMessage,
  auditLogRepositoryReadErrorMessage,
  auditLogScopeInvariantErrorMessage,
  auditLogSequenceInvariantErrorMessage,
  auditLogViewAuditInvariantErrorMessage,
  auditLogViewClockInvariantErrorMessage,
  auditLogViewClockReadErrorMessage,
} from './audit-log-routes.js';

export {
  receptionAcceptedAtClockInvariantErrorMessage,
  receptionAcceptedAtClockReadErrorMessage,
  receptionCreateRepositoryErrorMessage,
  receptionCreatedAcceptedAtInvariantErrorMessage,
  receptionCreatedAuditInvariantErrorMessage,
  receptionCreatedOutboxInvariantErrorMessage,
  receptionCreatedPatientSnapshotMismatchErrorMessage,
  receptionCreatedStatusInvariantErrorMessage,
  receptionIdempotencyConflictErrorCode,
  receptionPatientNotFoundErrorCode,
  receptionReconciliationHeaderName,
  receptionResultIdempotencyProvenanceMismatchErrorMessage,
  receptionResultKindInvariantErrorMessage,
  receptionResultPatientIdentityMismatchErrorMessage,
  receptionResultSchemaInvariantErrorMessage,
} from './reception-create-routes.js';

export {
  patientLookupRepositoryErrorMessage,
  patientSearchAuditClockInvariantErrorMessage,
  patientSearchAuditClockReadErrorMessage,
  patientSearchAuditInvariantErrorMessage,
  patientSearchCursorDecodeErrorMessage,
  patientSearchCursorEncodeErrorMessage,
  patientSearchCursorProgressInvariantErrorMessage,
  patientSearchDecodedCursorInvariantErrorMessage,
  patientSearchDuplicateIdentityInvariantErrorMessage,
  patientSearchEncodedCursorInvariantErrorMessage,
  patientSearchInvalidQueryErrorCode,
  patientSearchPageSchemaInvariantErrorMessage,
  patientSearchRepositoryErrorMessage,
  patientSearchResultLimitInvariantErrorMessage,
  patientViewAuditInvariantErrorMessage,
  patientViewClockInvariantErrorMessage,
  patientViewClockReadErrorMessage,
  receptionPatientIdentityMismatchErrorMessage,
  receptionPatientSchemaInvariantErrorMessage,
} from './patient-routes.js';

export {
  receptionInvalidRequestErrorCode,
  receptionQueueAuditClockInvariantErrorMessage,
  receptionQueueAuditClockReadErrorMessage,
  receptionQueueAuditInvariantErrorMessage,
  receptionQueueBusinessDateInvariantErrorMessage,
  receptionQueueDuplicateIdentityInvariantErrorMessage,
  receptionQueueRepositoryErrorMessage,
  receptionQueueSchemaInvariantErrorMessage,
} from './reception-queue-routes.js';

export type { HealthResponse } from '@yrese/contracts';

export const apiVersion = '0.0.1';
export const healthClockReadErrorMessage = 'Health clock read failed';
export const healthClockInvariantErrorMessage = 'Health clock returned an invalid instant';

export interface BuildServerOptions {
  readonly patientRepository?: PatientRepository;
  readonly receptionRepository?: ReceptionRepository;
  readonly auditRepository?: AuditRepository;
  /**
   * WP-4050: 受付コマンド境界。未指定なら receptionRepository / auditRepository を
   * 合成した in-memory unit of work を使う(Postgres 構成は main.ts が
   * PostgresReceptionCreateCommand を注入する)。
   */
  readonly receptionCreateCommand?: ReceptionCreateCommand;
  readonly receptionOutbox?: InMemoryReceptionOutbox;
  readonly now?: () => Date;
  readonly repositoryMode?: ApiRepositoryMode;
  readonly tenantContextMode?: TenantContextMode;
  readonly patientSearchCursorCodec?: PatientSearchCursorCodec;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const tenantContextMode = options.tenantContextMode ?? 'disabled';
  if (tenantContextMode === 'dev_headers' && options.repositoryMode !== 'in_memory') {
    throw new Error(devTenantContextConfigurationErrorMessage);
  }

  if (options.patientSearchCursorCodec === undefined) {
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }
  const patientSearchCursorCodec = options.patientSearchCursorCodec;

  const patientRepository = options.patientRepository ?? new InMemoryPatientRepository();
  const receptionRepository = options.receptionRepository ?? new InMemoryReceptionRepository();
  const auditRepository = options.auditRepository ?? new InMemoryAuditRepository();
  const receptionOutbox = options.receptionOutbox ?? new InMemoryReceptionOutbox();
  const receptionCreateCommand =
    options.receptionCreateCommand ??
    composeDefaultReceptionCreateCommand({
      receptionRepository,
      auditRepository,
      outbox: receptionOutbox,
    });
  const now = options.now ?? (() => new Date());
  const server = Fastify({
    logger: false,
  });

  server.register(tenantContextPlugin, { mode: tenantContextMode });

  server.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: apiVersion,
      timestamp: snapshotWallClock(
        now,
        healthClockReadErrorMessage,
        healthClockInvariantErrorMessage,
      ),
    });
  });

  server.get(
    '/whoami',
    {
      preHandler: requirePermission(permissionScope('tenant', 'read')),
    },
    async (request): Promise<WhoamiResponse> => {
      const tenantContext = requireTenantContext(request);

      return whoamiResponseSchema.parse({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
        actorId: tenantContext.actorId,
        scopes: tenantContext.scopes,
      });
    },
  );

  server.register(patientRoutes, {
    patientRepository,
    auditRepository,
    now,
    patientSearchCursorCodec,
  });

  server.register(receptionQueueRoutes, {
    receptionRepository,
    auditRepository,
    now,
  });

  server.register(receptionCreateRoutes, {
    patientRepository,
    receptionCreateCommand,
    now,
  });

  server.register(auditLogRoutes, { repository: auditRepository, now });

  return server;
}
