import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  PATIENT_SEARCH_CURSOR_MAX_LENGTH,
  errorResponseSchema,
  patientGetParamsSchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
  type PatientSearchResponse,
  type PatientSearchResult,
} from '@yrese/contracts';
import {
  PATIENT_NOT_FOUND_ERROR_CODE,
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  patientId,
  permissionScope,
  userId,
} from '@yrese/shared-kernel';

import type { AuditRepository } from './audit-repository.js';
import type { PatientSearchCursorCodec } from './patient-search-cursor.js';
import type {
  PatientRepository,
  PatientSearchCursor,
  PatientSearchPage,
} from './patient-repository.js';
import { requirePermission, requireTenantContext } from './plugins/tenant-context.js';
import {
  assertRecordedAuditMatchesIntent,
  readOwnEnumerableDataProperty,
  readRequiredOwnEnumerableDataProperty,
  setSensitiveResponseNoStore,
  snapshotDenseArray,
  snapshotWallClock,
} from './route-invariants.js';

export interface PatientRoutesOptions {
  readonly patientRepository: PatientRepository;
  readonly auditRepository: AuditRepository;
  readonly now: () => Date;
  readonly patientSearchCursorCodec: PatientSearchCursorCodec;
}

export const patientSearchInvalidQueryErrorCode = PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;
export const patientSearchResultLimitInvariantErrorMessage =
  'Patient repository returned more results than requested';
export const patientSearchDuplicateIdentityInvariantErrorMessage =
  'Patient repository returned duplicate patient identities';
export const patientSearchCursorProgressInvariantErrorMessage =
  'Patient repository returned an invalid next cursor';
export const patientSearchCursorDecodeErrorMessage = 'Patient search cursor decode failed';
export const patientSearchDecodedCursorInvariantErrorMessage =
  'Patient search cursor codec returned an invalid cursor';
export const patientSearchCursorEncodeErrorMessage = 'Patient search cursor encode failed';
export const patientSearchEncodedCursorInvariantErrorMessage =
  'Patient search cursor codec returned an invalid encoded cursor';
export const patientSearchRepositoryErrorMessage = 'Patient repository search failed';
export const patientSearchPageSchemaInvariantErrorMessage =
  'Patient repository returned an invalid search page';
export const patientLookupRepositoryErrorMessage = 'Patient repository lookup failed';
export const receptionPatientIdentityMismatchErrorMessage =
  'Patient lookup returned a mismatched patient identity';
export const receptionPatientSchemaInvariantErrorMessage =
  'Patient lookup returned an invalid patient snapshot';
export const patientSearchAuditInvariantErrorMessage =
  'Audit repository returned mismatched patient search evidence';
export const patientSearchAuditClockReadErrorMessage = 'Patient search audit clock read failed';
export const patientSearchAuditClockInvariantErrorMessage =
  'Patient search audit clock returned an invalid instant';
export const patientViewAuditInvariantErrorMessage =
  'Audit repository returned mismatched patient view evidence';
export const patientViewClockReadErrorMessage = 'Patient view clock read failed';
export const patientViewClockInvariantErrorMessage =
  'Patient view clock returned an invalid instant';

function invalidPatientSearchQueryResponse() {
  return errorResponseSchema.parse({
    errorCode: patientSearchInvalidQueryErrorCode,
    message: 'Invalid patient search query',
  });
}

function snapshotDecodedPatientSearchCursor(value: unknown): PatientSearchCursor {
  const offset = readRequiredOwnEnumerableDataProperty(
    value,
    'offset',
    patientSearchDecodedCursorInvariantErrorMessage,
  );
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error(patientSearchDecodedCursorInvariantErrorMessage);
  }
  return Object.freeze({ offset });
}

function assertEncodedPatientSearchCursor(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > PATIENT_SEARCH_CURSOR_MAX_LENGTH
  ) {
    throw new Error(patientSearchEncodedCursorInvariantErrorMessage);
  }
  return value;
}

export function snapshotPatientSearchResultIdentity(
  value: unknown,
  invariantErrorMessage: string,
): unknown {
  return readRequiredOwnEnumerableDataProperty(value, 'patientId', invariantErrorMessage);
}

export function snapshotPatientSearchResult(
  value: unknown,
  patientIdentity: unknown,
  invariantErrorMessage: string,
) {
  const eligibilityCheckedAt = readOwnEnumerableDataProperty(
    value,
    'eligibilityCheckedAt',
    invariantErrorMessage,
  );
  return Object.freeze({
    patientId: patientIdentity,
    name: readRequiredOwnEnumerableDataProperty(
      value,
      'name',
      invariantErrorMessage,
    ),
    kana: readRequiredOwnEnumerableDataProperty(
      value,
      'kana',
      invariantErrorMessage,
    ),
    birthDate: readRequiredOwnEnumerableDataProperty(
      value,
      'birthDate',
      invariantErrorMessage,
    ),
    sex: readRequiredOwnEnumerableDataProperty(
      value,
      'sex',
      invariantErrorMessage,
    ),
    patientNumber: readRequiredOwnEnumerableDataProperty(
      value,
      'patientNumber',
      invariantErrorMessage,
    ),
    eligibilityStatus: readRequiredOwnEnumerableDataProperty(
      value,
      'eligibilityStatus',
      invariantErrorMessage,
    ),
    ...(eligibilityCheckedAt.present
      ? { eligibilityCheckedAt: eligibilityCheckedAt.value }
      : {}),
  });
}

export function parsePatientSearchResultSnapshot(
  value: unknown,
  invariantErrorMessage: string,
): PatientSearchResult {
  try {
    const parsed = patientSearchResultSchema.safeParse(value);
    if (!parsed.success) throw new Error(invariantErrorMessage);
    return parsed.data;
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

function patientNotFoundResponse() {
  return errorResponseSchema.parse({
    errorCode: PATIENT_NOT_FOUND_ERROR_CODE,
    message: 'Patient not found',
  });
}

const callback: FastifyPluginCallback<PatientRoutesOptions> = (server, options, done) => {
  server.get(
    '/patients/search',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('patient', 'read')),
    },
    async (request, reply): Promise<PatientSearchResponse | void> => {
      const tenantContext = requireTenantContext(request);

      const query = patientSearchQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      let cursor: PatientSearchCursor | undefined;
      if (query.data.cursor !== undefined) {
        const cursorBinding = Object.freeze({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          q: query.data.q,
        });
        let decodedCursor: PatientSearchCursor | undefined;
        try {
          decodedCursor = options.patientSearchCursorCodec.decode(
            cursorBinding,
            query.data.cursor,
          );
        } catch {
          throw new Error(patientSearchCursorDecodeErrorMessage);
        }
        if (decodedCursor !== undefined) {
          cursor = snapshotDecodedPatientSearchCursor(decodedCursor);
        }
      }

      if (query.data.cursor !== undefined && cursor === undefined) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      const requestedOffset = cursor?.offset ?? 0;

      let page: PatientSearchPage;
      try {
        page = await options.patientRepository.search({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          q: query.data.q,
          limit: query.data.limit,
          ...(cursor === undefined ? {} : { cursor }),
        });
      } catch {
        throw new Error(patientSearchRepositoryErrorMessage);
      }
      const rawResultsValue = readRequiredOwnEnumerableDataProperty(
        page,
        'results',
        patientSearchPageSchemaInvariantErrorMessage,
      );
      const rawResults = snapshotDenseArray(
        rawResultsValue,
        patientSearchPageSchemaInvariantErrorMessage,
        {
          length: query.data.limit,
          errorMessage: patientSearchResultLimitInvariantErrorMessage,
        },
      );
      const validatedResults = rawResults.map((result) => {
        const patientIdentity = snapshotPatientSearchResultIdentity(
          result,
          patientSearchPageSchemaInvariantErrorMessage,
        );
        const patientSnapshot = snapshotPatientSearchResult(
          result,
          patientIdentity,
          patientSearchPageSchemaInvariantErrorMessage,
        );
        return parsePatientSearchResultSnapshot(
          patientSnapshot,
          patientSearchPageSchemaInvariantErrorMessage,
        );
      });
      const patientIds = new Set<string>();
      for (const result of validatedResults) {
        if (patientIds.has(result.patientId)) {
          throw new Error(patientSearchDuplicateIdentityInvariantErrorMessage);
        }
        patientIds.add(result.patientId);
      }
      const nextCursorProperty = readOwnEnumerableDataProperty(
        page,
        'nextCursor',
        patientSearchCursorProgressInvariantErrorMessage,
      );
      let encodedNextCursor: string | undefined;
      if (nextCursorProperty.present && nextCursorProperty.value !== undefined) {
        const rawNextOffset = readRequiredOwnEnumerableDataProperty(
          nextCursorProperty.value,
          'offset',
          patientSearchCursorProgressInvariantErrorMessage,
        );
        const expectedNextOffset = requestedOffset + validatedResults.length;
        if (
          validatedResults.length === 0 ||
          !Number.isSafeInteger(expectedNextOffset) ||
          rawNextOffset !== expectedNextOffset
        ) {
          throw new Error(patientSearchCursorProgressInvariantErrorMessage);
        }
        const encodeBinding = Object.freeze({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          q: query.data.q,
        });
        let rawEncodedCursor: unknown;
        try {
          rawEncodedCursor = options.patientSearchCursorCodec.encode(
            encodeBinding,
            Object.freeze({ offset: expectedNextOffset }),
          );
        } catch {
          throw new Error(patientSearchCursorEncodeErrorMessage);
        }
        encodedNextCursor = assertEncodedPatientSearchCursor(rawEncodedCursor);
      }

      const searchResponseSnapshot = patientSearchResponseSchema.parse({
        results: validatedResults,
        ...(encodedNextCursor === undefined ? {} : { nextCursor: encodedNextCursor }),
      });

      // WP-4162: 検索は要配慮情報の列挙アクセス(patient.searched — MOD-008 0.2.4)。
      // データ最小化: 検索クエリ文字列・氏名・カナ・生年月日を監査ペイロードへ
      // 入れない(targetRef は件数のみ)。0 件でも検索実行の事実を 1 件記録する。
      // 記録失敗は 500 で PHI 非返却(fail-closed)。
      const searchWallClock = snapshotWallClock(
        options.now,
        patientSearchAuditClockReadErrorMessage,
        patientSearchAuditClockInvariantErrorMessage,
      );
      const searchTarget = Object.freeze({
        kind: 'patient_search',
        id: `results:${validatedResults.length}`,
      });
      const searchIntent = Object.freeze({
        actorId: userId(tenantContext.actorId),
        auditEventType: 'patient.searched',
        targetRef: searchTarget,
        outcome: 'success',
        wallClock: searchWallClock,
      });
      let recordedSearchAudit: unknown;
      try {
        recordedSearchAudit = await options.auditRepository.record(
          Object.freeze({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          }),
          searchIntent,
        );
      } catch {
        throw new Error(patientSearchAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedSearchAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          ...searchIntent,
        },
        patientSearchAuditInvariantErrorMessage,
      );

      return searchResponseSnapshot;
    },
  );

  server.get(
    '/patients/:patientId',
    {
      onRequest: setSensitiveResponseNoStore,
      preHandler: requirePermission(permissionScope('patient', 'read')),
    },
    async (request, reply): Promise<PatientSearchResult | void> => {
      const tenantContext = requireTenantContext(request);

      const params = patientGetParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send(invalidPatientSearchQueryResponse());
      }

      const parsedPatientId = patientId(params.data.patientId);
      let patient: PatientSearchResult | undefined;
      try {
        patient = await options.patientRepository.findById({
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          patientId: parsedPatientId,
        });
      } catch {
        throw new Error(patientLookupRepositoryErrorMessage);
      }
      if (patient === undefined) {
        return reply.code(404).send(patientNotFoundResponse());
      }
      const patientIdentity = snapshotPatientSearchResultIdentity(
        patient,
        receptionPatientIdentityMismatchErrorMessage,
      );
      if (patientIdentity !== parsedPatientId) {
        throw new Error(receptionPatientIdentityMismatchErrorMessage);
      }

      const patientSnapshot = snapshotPatientSearchResult(
        patient,
        patientIdentity,
        receptionPatientSchemaInvariantErrorMessage,
      );
      const responseSnapshot = parsePatientSearchResultSnapshot(
        patientSnapshot,
        receptionPatientSchemaInvariantErrorMessage,
      );

      // WP-4162: 単一患者の全属性開示は要配慮情報アクセスであり、durable な
      // patient.viewed(MOD-008 既登録)なしに PHI を返さない。targetRef は
      // 識別子のみ(氏名・カナ・生年月日・患者番号を監査ペイロードへ入れない)。
      // 記録失敗は 500 で PHI 非返却(fail-closed)。404 / 拒否 / 検索・キューの
      // 列挙監査は MOD-008 に対応 event type が未登録のため本スライスでは
      // 記録せず、SSOT_UPDATE_REQUIRED として WP-4162 残余に留まる。
      const viewWallClock = snapshotWallClock(
        options.now,
        patientViewClockReadErrorMessage,
        patientViewClockInvariantErrorMessage,
      );
      // patientIdentity === parsedPatientId は上で検証済み(branded string を使う)。
      const viewTarget = Object.freeze({ kind: 'patient', id: parsedPatientId });
      const viewIntent = Object.freeze({
        actorId: userId(tenantContext.actorId),
        auditEventType: 'patient.viewed',
        targetRef: viewTarget,
        outcome: 'success',
        wallClock: viewWallClock,
      });
      let recordedViewAudit: unknown;
      try {
        recordedViewAudit = await options.auditRepository.record(
          Object.freeze({
            tenantId: tenantContext.tenantId,
            pharmacyId: tenantContext.pharmacyId,
          }),
          viewIntent,
        );
      } catch {
        throw new Error(patientViewAuditInvariantErrorMessage);
      }
      assertRecordedAuditMatchesIntent(
        recordedViewAudit,
        {
          tenantId: tenantContext.tenantId,
          pharmacyId: tenantContext.pharmacyId,
          ...viewIntent,
        },
        patientViewAuditInvariantErrorMessage,
      );

      return responseSnapshot;
    },
  );

  done();
};

export const patientRoutes = fp(callback, {
  name: 'patient-routes',
});
