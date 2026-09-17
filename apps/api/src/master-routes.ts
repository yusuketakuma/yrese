import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  errorResponseSchema,
  masterMedicationsResponseSchema,
  masterQuerySchema,
  masterUsagesResponseSchema,
  type MasterMedicationsResponse,
  type MasterUsagesResponse,
} from '@yrese/contracts';
import {
  MASTER_INVALID_QUERY_ERROR_CODE,
  permissionScope,
} from '@yrese/shared-kernel';

import type { MasterRepository } from './master-repository.js';
import {
  requirePermission,
  requireTenantContext,
} from './plugins/tenant-context.js';
import {
  readRequiredOwnEnumerableDataProperty,
  snapshotDenseArray,
} from './route-invariants.js';

/**
 * WP-7301/WP-7303 / MST-003: GET /masters/{medications,usages}。
 *
 * - scope: `master:read`。認可なしは 403 AUTH-0003。
 * - asOf 必須(MOD-011 — 暗黙の「今日」解決なし)。不正 query は 400 MST-0001。
 * - asOf に有効な版が無い場合は 200 {masterVersion: null, items: []}
 *   (存在非開示の空集合 — cross-scope も同じ応答)。
 * - non-PHI のため read audit・no-store は要求しない(MST-003 §5)。
 */

export interface MasterRoutesOptions {
  readonly masterRepository: MasterRepository;
}

export const masterInvalidQueryErrorCode = MASTER_INVALID_QUERY_ERROR_CODE;

export const masterRepositoryErrorMessage =
  'Master repository operation failed';
export const masterResultKindInvariantErrorMessage =
  'Master repository returned an invalid result kind';
export const masterResultSchemaInvariantErrorMessage =
  'Master repository returned an invalid row snapshot';

const invalidMasterQueryResponseTemplate = errorResponseSchema.parse({
  errorCode: masterInvalidQueryErrorCode,
  message: 'Invalid master query',
});
function invalidMasterQueryResponse() {
  return { ...invalidMasterQueryResponseTemplate };
}

const callback: FastifyPluginCallback<MasterRoutesOptions> = (
  server,
  options,
  done,
) => {
  server.get(
    '/masters/medications',
    {
      preHandler: [requirePermission(permissionScope('master', 'read'))],
    },
    async (request, reply): Promise<MasterMedicationsResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const query = masterQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidMasterQueryResponse());
      }

      let result;
      try {
        result = await options.masterRepository.list({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          kind: 'medication',
          asOf: query.data.asOf,
          ...(query.data.q === undefined ? {} : { q: query.data.q }),
        });
      } catch {
        throw new Error(masterRepositoryErrorMessage);
      }

      const resultKind = readRequiredOwnEnumerableDataProperty(
        result,
        'kind',
        masterResultKindInvariantErrorMessage,
      );
      if (resultKind === 'no_version') {
        return reply
          .code(200)
          .send(masterMedicationsResponseSchema.parse({ masterVersion: null, items: [] }));
      }
      if (resultKind !== 'listed') {
        throw new Error(masterResultKindInvariantErrorMessage);
      }

      const rawItems = readRequiredOwnEnumerableDataProperty(
        result,
        'items',
        masterResultSchemaInvariantErrorMessage,
      );
      const items = snapshotDenseArray(
        rawItems,
        masterResultSchemaInvariantErrorMessage,
      );
      const rawVersion = readRequiredOwnEnumerableDataProperty(
        result,
        'masterVersion',
        masterResultSchemaInvariantErrorMessage,
      );
      const parsedResponse = masterMedicationsResponseSchema.safeParse({
        masterVersion: rawVersion,
        items,
      });
      if (!parsedResponse.success) {
        throw new Error(masterResultSchemaInvariantErrorMessage);
      }
      return reply.code(200).send(parsedResponse.data);
    },
  );

  server.get(
    '/masters/usages',
    {
      preHandler: [requirePermission(permissionScope('master', 'read'))],
    },
    async (request, reply): Promise<MasterUsagesResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const query = masterQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidMasterQueryResponse());
      }

      let result;
      try {
        result = await options.masterRepository.list({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          kind: 'usage',
          asOf: query.data.asOf,
          ...(query.data.q === undefined ? {} : { q: query.data.q }),
        });
      } catch {
        throw new Error(masterRepositoryErrorMessage);
      }

      const resultKind = readRequiredOwnEnumerableDataProperty(
        result,
        'kind',
        masterResultKindInvariantErrorMessage,
      );
      if (resultKind === 'no_version') {
        return reply
          .code(200)
          .send(masterUsagesResponseSchema.parse({ masterVersion: null, items: [] }));
      }
      if (resultKind !== 'listed') {
        throw new Error(masterResultKindInvariantErrorMessage);
      }

      const rawItems = readRequiredOwnEnumerableDataProperty(
        result,
        'items',
        masterResultSchemaInvariantErrorMessage,
      );
      const items = snapshotDenseArray(
        rawItems,
        masterResultSchemaInvariantErrorMessage,
      );
      const rawVersion = readRequiredOwnEnumerableDataProperty(
        result,
        'masterVersion',
        masterResultSchemaInvariantErrorMessage,
      );
      const parsedResponse = masterUsagesResponseSchema.safeParse({
        masterVersion: rawVersion,
        items,
      });
      if (!parsedResponse.success) {
        throw new Error(masterResultSchemaInvariantErrorMessage);
      }
      return reply.code(200).send(parsedResponse.data);
    },
  );

  done();
};

export const masterRoutes = fp(callback, {
  name: 'master-routes',
});
