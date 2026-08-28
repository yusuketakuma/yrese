import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAuditHashChain, type AuditEvent } from '@yrese/audit';
import {
  auditLogEntrySchema,
  auditLogQuerySchema,
  auditLogResponseSchema,
  errorResponseSchema,
  type AuditLogEntry,
  type AuditLogResponse,
} from '@yrese/contracts';
import {
  AUDIT_LOG_INVALID_QUERY_ERROR_CODE,
  permissionScope,
  userId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  assertRecordedAuditMatchesIntent,
  setSensitiveResponseNoStore,
  snapshotDenseArray,
  snapshotWallClock,
} from './route-invariants.js';

export interface AuditLogRoutesOptions {
  readonly repository: AuditRepository;
  readonly now: () => Date;
}

const auditLogProjectionInvariantErrorMessage =
  'Audit event display projection failed for a verified hash chain';
export const auditLogScopeInvariantErrorMessage =
  'Audit repository returned events outside the requested scope';
export const auditLogRepositoryReadErrorMessage = 'Audit repository list failed';
export const auditLogListSchemaInvariantErrorMessage =
  'Audit repository returned an invalid event list';
export const auditLogDuplicateIdentityInvariantErrorMessage =
  'Verified audit chain contains duplicate event identities';
export const auditLogSequenceInvariantErrorMessage =
  'Verified audit chain contains a non-contiguous event sequence';
export const auditLogViewAuditInvariantErrorMessage =
  'Audit repository returned mismatched audit view evidence';
export const auditLogViewClockReadErrorMessage = 'Audit view clock read failed';
export const auditLogViewClockInvariantErrorMessage =
  'Audit view clock returned an invalid instant';

function projectAuditLogEntry(event: AuditEvent): AuditLogEntry | undefined {
  try {
    const projected = auditLogEntrySchema.safeParse({
      eventId: event.eventId,
      wallClock: event.wallClock,
      actorId: event.actorId,
      auditEventType: event.auditEventType,
      targetRef: event.targetRef,
      outcome: event.outcome,
      ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
      ...(event.businessReason === undefined
        ? {}
        : { businessReasonCode: event.businessReason.code }),
    });
    return projected.success ? projected.data : undefined;
  } catch {
    return undefined;
  }
}

function invalidAuditLogQueryResponse() {
  return errorResponseSchema.parse({
    errorCode: AUDIT_LOG_INVALID_QUERY_ERROR_CODE,
    message: 'Invalid audit log query',
  });
}

const callback: FastifyPluginCallback<AuditLogRoutesOptions> = (server, options, done) => {
  server.get(
    '/audit/events',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('audit-log', 'read')),
    },
    async (request, reply): Promise<AuditLogResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const query = auditLogQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidAuditLogQueryResponse());
      }

      const scope = Object.freeze({
        tenantId: tenantContext.tenantId,
        pharmacyId: tenantContext.pharmacyId,
      });
      let rawEvents: readonly AuditEvent[];
      try {
        rawEvents = await options.repository.list(scope);
      } catch {
        throw new Error(auditLogRepositoryReadErrorMessage);
      }
      const events = snapshotDenseArray(
        rawEvents,
        auditLogListSchemaInvariantErrorMessage,
      ) as readonly AuditEvent[];
      // WP-4236: 破損行(JSON null / scalar / array / 敵対的 graph)は scope を
      // 運搬できないため、この防衛的 scope 検査ではプロパティ読取り不能な要素を
      // 検査対象外とし、直後の verifyAuditHashChain に構造的破断
      // (hash_format_invalid)として報告させる。読取れて不一致なら従来どおり
      // invariant 違反(行レベルの scope は永続化層の WHERE が別途強制している)。
      const readOwnScopeString = (value: unknown, property: string): string | undefined => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          return undefined;
        }
        try {
          const descriptor = Object.getOwnPropertyDescriptor(value, property);
          if (
            descriptor !== undefined &&
            'value' in descriptor &&
            typeof descriptor.value === 'string'
          ) {
            return descriptor.value;
          }
        } catch {
          // 敵対的 descriptor trap は scope 検査を妨げない(verify が破断報告する)
        }
        return undefined;
      };
      if (
        events.some((event) => {
          const eventTenantId = readOwnScopeString(event, 'tenantId');
          const eventPharmacyId = readOwnScopeString(event, 'pharmacyId');
          if (eventTenantId === undefined || eventPharmacyId === undefined) {
            return false;
          }
          return eventTenantId !== scope.tenantId || eventPharmacyId !== scope.pharmacyId;
        })
      ) {
        throw new Error(auditLogScopeInvariantErrorMessage);
      }

      // 改ざん検知: 保存されている全イベントに対する hash chain 検証(返却分だけではない)。
      const verification = verifyAuditHashChain(events);
      if (verification.ok) {
        const eventIds = new Set<string>();
        for (const event of events) {
          if (eventIds.has(event.eventId)) {
            throw new Error(auditLogDuplicateIdentityInvariantErrorMessage);
          }
          eventIds.add(event.eventId);
        }
        for (const [index, event] of events.entries()) {
          if (event.sequenceNumber !== BigInt(index + 1)) {
            throw new Error(auditLogSequenceInvariantErrorMessage);
          }
        }
      }

      // 検証済みchainは公開契約どおりwallClock降順。同時刻は後のappendを先にする。
      // 破損chainはwallClockを信頼せず、WP-4093のraw append window/no-backfillを維持する。
      const displayCandidates = events.map((event, appendIndex) => ({ event, appendIndex }));
      displayCandidates.sort((left, right) => {
        if (!verification.ok) return right.appendIndex - left.appendIndex;
        if (left.event.wallClock < right.event.wallClock) return 1;
        if (left.event.wallClock > right.event.wallClock) return -1;
        return right.appendIndex - left.appendIndex;
      });
      const displayWindow = displayCandidates
        .slice(0, query.data.limit)
        .map(({ event }) => event);
      const entries: AuditLogEntry[] = [];
      let projectionFailed = false;
      for (const event of displayWindow) {
        const entry = projectAuditLogEntry(event);
        if (entry === undefined) {
          projectionFailed = true;
        } else {
          entries.push(entry);
        }
      }
      if (projectionFailed && verification.ok) {
        throw new Error(auditLogProjectionInvariantErrorMessage);
      }

      const responseSnapshot = auditLogResponseSchema.parse({
        entries,
        chainVerification: verification.ok
          ? { ok: true, checkedCount: verification.checkedCount }
          : {
              ok: false,
              checkedCount: verification.checkedCount,
              breakIndex: verification.breakIndex,
              reason: verification.reason,
            },
        totalCount: events.length,
      });

      // 監査ログの閲覧自体を監査する(audit.viewed)。事前検証済みの今回の応答には含めない。
      const viewWallClock = snapshotWallClock(
        options.now,
        auditLogViewClockReadErrorMessage,
        auditLogViewClockInvariantErrorMessage,
      );
      const viewTarget = Object.freeze({ kind: 'audit_log', id: `view:${events.length}` });
      const viewIntent = Object.freeze({
        actorId: userId(tenantContext.actorId),
        auditEventType: 'audit.viewed',
        targetRef: viewTarget,
        outcome: 'success',
        wallClock: viewWallClock,
      });
      let recordedViewAudit: unknown;
      try {
        recordedViewAudit = await options.repository.record(scope, viewIntent);
      } catch {
        throw new Error(auditLogViewAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedViewAudit,
        { ...scope, ...viewIntent },
        auditLogViewAuditInvariantErrorMessage,
      );

      return responseSnapshot;
    },
  );

  done();
};

export const auditLogRoutes = fp(callback, {
  name: 'audit-log-routes',
});
