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
  postgresCompositionConfigurationErrorMessage,
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
  composeDefaultReceptionTransitionCommand,
  type ReceptionCreateCommand,
  type ReceptionTransitionCommand,
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
import { receptionTransitionRoutes } from './reception-transition-routes.js';
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

export {
  receptionInvalidTransitionErrorCode,
  receptionNotFoundErrorCode,
  receptionTransitionAuditInvariantErrorMessage,
  receptionTransitionClockInvariantErrorMessage,
  receptionTransitionClockReadErrorMessage,
  receptionTransitionInvalidRequestErrorCode,
  receptionTransitionRepositoryErrorMessage,
  receptionTransitionResultInvariantErrorMessage,
  receptionTransitionResultKindInvariantErrorMessage,
  receptionTransitionSchemaInvariantErrorMessage,
  receptionVersionConflictErrorCode,
} from './reception-transition-routes.js';

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
  /**
   * WP-7201: 受付遷移コマンド境界。未指定なら receptionRepository /
   * auditRepository を合成した in-memory unit of work を使う
   * (Postgres 構成は main.ts が PostgresReceptionTransitionCommand を注入する)。
   */
  readonly receptionTransitionCommand?: ReceptionTransitionCommand;
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

  // Postgres 構成で receptionCreateCommand 未指定なら、受付・監査・outbox を束ねる
  // unit of work が in-memory 合成に fallback して原子性を失う。production 経路
  // (main.ts)は PostgresReceptionCreateCommand を注入する。
  if (
    options.repositoryMode === 'postgres' &&
    (options.receptionCreateCommand === undefined ||
      options.receptionTransitionCommand === undefined)
  ) {
    throw new Error(postgresCompositionConfigurationErrorMessage);
  }

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
  const receptionTransitionCommand =
    options.receptionTransitionCommand ??
    composeDefaultReceptionTransitionCommand({
      receptionRepository,
      auditRepository,
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

  server.register(receptionTransitionRoutes, {
    receptionTransitionCommand,
    now,
  });

  server.register(auditLogRoutes, { repository: auditRepository, now });

  return server;
}
