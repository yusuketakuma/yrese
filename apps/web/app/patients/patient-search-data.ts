import {
  PATIENT_SEARCH_DEFAULT_LIMIT,
  patientSearchResponseSchema,
  type PatientSearchResult,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  patientId,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from '../api-transport';
import { registeredErrorCodeOrUndefined } from '../components/error-code';
import { type ErrorNoticeProps } from '../components/error-notice';
import { type PatientContextData } from '../components/patient/patient-context';
import { devTenantHeaders } from '../dev-tenant';

export const patientSearchPageLimitErrorMessage =
  "Patient search response exceeded the requested page limit";
export const patientSearchEmptyContinuationErrorMessage =
  "Patient search response returned an empty continuation page";

export type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | {
      kind: "loaded";
      results: PatientSearchResult[];
      nextCursor?: string;
      query: string;
      appendState: SearchAppendState;
    };

export type SearchAppendState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps };

export interface SearchPage {
  readonly results: PatientSearchResult[];
  readonly nextCursor?: string;
}

/** API エラーを「何が起きたか+次のアクション」の対として運ぶ(WP-3007 統一様式) */
export class SearchError extends Error {
  constructor(
    message: string,
    readonly nextAction: string,
    readonly errorCode?: string,
  ) {
    super(message);
  }

  toNotice(): ErrorNoticeProps {
    return trustedSearchErrorNotices.get(this) ?? genericSearchErrorNotice;
  }
}

export const trustedSearchErrorNotices = new WeakMap<object, ErrorNoticeProps>();
export const genericSearchErrorNotice = Object.freeze({
  message: "検索結果の処理に失敗しました。",
  nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
} satisfies ErrorNoticeProps);

export function createTrustedSearchError(
  message: string,
  nextAction: string,
  errorCode?: string,
): SearchError {
  const error = new SearchError(message, nextAction, errorCode);
  const notice = Object.freeze({
    message,
    nextAction,
    ...(errorCode !== undefined ? { errorCode } : {}),
  } satisfies ErrorNoticeProps);
  trustedSearchErrorNotices.set(error, notice);
  return error;
}

export function trustedSearchErrorNotice(error: unknown): ErrorNoticeProps | undefined {
  return (typeof error === "object" && error !== null) || typeof error === "function"
    ? trustedSearchErrorNotices.get(error)
    : undefined;
}

export function expectedPatientSearchErrorCode(status: number): string | undefined {
  if (status === 400) return PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE;
  if (status === 403) return AUTH_PERMISSION_DENIED_ERROR_CODE;
  return undefined;
}

export async function fetchSearch(
  q: string,
  cursor?: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const params = new URLSearchParams({
    q,
    limit: String(PATIENT_SEARCH_DEFAULT_LIMIT),
  });
  if (cursor !== undefined) {
    params.set("cursor", cursor);
  }
  const url = resolveWebApiUrl(`/patients/search?${params}`);
  const res = await fetchImpl(url, {
    headers: devTenantHeaders(),
    cache: "no-store",
    ...(signal !== undefined ? { signal } : {}),
  });
  if (!res.ok) {
    let errorCode: string | undefined;
    try {
      const body: unknown = await res.json();
      if (typeof body === "object" && body !== null) {
        const descriptor = Object.getOwnPropertyDescriptor(body, "errorCode");
        if (descriptor !== undefined && "value" in descriptor) {
          // registry 未登録/形式外のコードは表示しない(異常値の verbatim 出力防止)
          const registeredCode = registeredErrorCodeOrUndefined(descriptor.value);
          const expectedCode = expectedPatientSearchErrorCode(res.status);
          errorCode = registeredCode === expectedCode ? registeredCode : undefined;
        }
      }
    } catch {
      errorCode = undefined;
    }
    if (res.status === 403) {
      throw createTrustedSearchError(
        "権限がありません。",
        "管理者に権限(patient:read)の付与状況を確認してください。",
        errorCode,
      );
    }
    if (res.status === 400) {
      throw createTrustedSearchError(
        "検索条件が不正です。",
        "入力内容を確認して再度検索してください。",
        errorCode,
      );
    }
    throw createTrustedSearchError(
      `検索に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
      errorCode,
    );
  }
  if (res.status !== 200) {
    throw createTrustedSearchError(
      `検索に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
    );
  }
  const parsed = patientSearchResponseSchema.parse(await res.json());
  if (parsed.results.length > PATIENT_SEARCH_DEFAULT_LIMIT) {
    throw new Error(patientSearchPageLimitErrorMessage);
  }
  if (parsed.results.length === 0 && parsed.nextCursor !== undefined) {
    throw new Error(patientSearchEmptyContinuationErrorMessage);
  }
  return {
    results: [...parsed.results],
    ...(parsed.nextCursor !== undefined ? { nextCursor: parsed.nextCursor } : {}),
  };
}

/**
 * 最後に発行した検索だけを状態へ反映する runner(WP-4037: stale response guard)。
 * 古いリクエストは成功・失敗のどちらも破棄し、連続検索で結果が巻き戻らないようにする。
 */
export interface SearchRunner {
  (query: string, cursor?: string, append?: boolean): Promise<void>;
  cancelActive(): void;
}

export function createSearchRunner(
  fetcher: (q: string, cursor: string | undefined, signal: AbortSignal) => Promise<SearchPage>,
  emit: (update: (prev: SearchState) => SearchState) => void,
): SearchRunner {
  let generation = 0;
  const activeAppendOwners = new Map<
    string,
    Map<string | undefined, object>
  >();
  const activeControllers = new Set<AbortController>();
  let isCancelling = false;

  const abortActiveControllers = () => {
    const controllers = [...activeControllers];
    activeControllers.clear();
    for (const controller of controllers) {
      controller.abort();
    }
  };

  const run: SearchRunner = async (query, cursor, append = false) => {
    if (isCancelling) return;
    const trimmed = query.trim();
    if (!append || trimmed.length === 0) {
      activeAppendOwners.clear();
    }
    let appendOwner: object | undefined;
    if (append && trimmed.length > 0) {
      const cursorOwners = activeAppendOwners.get(trimmed);
      if (cursorOwners?.has(cursor) === true) {
        return;
      }
      appendOwner = {};
      if (cursorOwners === undefined) {
        activeAppendOwners.set(trimmed, new Map([[cursor, appendOwner]]));
      } else {
        cursorOwners.set(cursor, appendOwner);
      }
    }
    const releaseAppendOwner = () => {
      if (appendOwner === undefined) return;
      const cursorOwners = activeAppendOwners.get(trimmed);
      if (cursorOwners?.get(cursor) === appendOwner) {
        cursorOwners.delete(cursor);
        if (cursorOwners.size === 0) {
          activeAppendOwners.delete(trimmed);
        }
      }
    };

    const gen = ++generation;
    abortActiveControllers();
    if (gen !== generation) {
      releaseAppendOwner();
      return;
    }
    if (trimmed.length === 0) {
      emit((prev) =>
        gen === generation
          ? {
              kind: "error",
              notice: {
                severity: "WARNING",
                message: "検索語が入力されていません。",
                nextAction: "氏名・カナ・患者番号のいずれかを入力してください。",
              },
            }
          : prev,
      );
      return;
    }
    const controller = new AbortController();
    activeControllers.add(controller);
    try {
      emit((prev) => {
        if (gen !== generation) return prev;
        if (!append) return { kind: "loading" };
        return prev.kind === "loaded" &&
          prev.query === trimmed &&
          prev.nextCursor === cursor
          ? { ...prev, appendState: { kind: "loading" } }
          : prev;
      });
      if (gen !== generation) {
        return;
      }
      try {
        const page = await fetcher(trimmed, cursor, controller.signal);
        if (gen !== generation) {
          return; // 古い応答は破棄(最後の検索のみ反映)
        }
        const pagePatientIds = new Set<string>();
        if (
          page.results.some((result) => {
            if (pagePatientIds.has(result.patientId)) return true;
            pagePatientIds.add(result.patientId);
            return false;
          })
        ) {
          throw new Error("Patient search page returned duplicate patient identity");
        }
        emit((prev) => {
          if (gen !== generation) return prev;
          if (append) {
            if (
              prev.kind !== "loaded" ||
              prev.query !== trimmed ||
              prev.nextCursor !== cursor
            ) {
              return prev;
            }
            const existingPatientIds = new Set(
              prev.results.map((result) => result.patientId),
            );
            if (page.results.some((result) => existingPatientIds.has(result.patientId))) {
              return {
                ...prev,
                appendState: {
                  kind: "error",
                  notice: {
                    message: "検索結果の処理に失敗しました。",
                    nextAction:
                      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
                  },
                },
              };
            }
            if (cursor !== undefined && page.nextCursor === cursor) {
              return {
                ...prev,
                appendState: {
                  kind: "error",
                  notice: {
                    message: "検索結果の処理に失敗しました。",
                    nextAction:
                      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
                  },
                },
              };
            }
            return {
              kind: "loaded",
              results: [...prev.results, ...page.results],
              ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
              query: trimmed,
              appendState: { kind: "idle" },
            };
          }
          return {
            kind: "loaded",
            results: page.results,
            ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
            query: trimmed,
            appendState: { kind: "idle" },
          };
        });
      } catch (error) {
        if (gen !== generation) {
          return; // 古いリクエストの失敗も破棄
        }
        const notice = trustedSearchErrorNotice(error) ?? genericSearchErrorNotice;
        emit((prev) => {
          if (gen !== generation) return prev;
          if (append) {
            return prev.kind === "loaded" &&
              prev.query === trimmed &&
              prev.nextCursor === cursor
              ? { ...prev, appendState: { kind: "error", notice } }
              : prev;
          }
          return { kind: "error", notice };
        });
      }
    } finally {
      activeControllers.delete(controller);
      releaseAppendOwner();
    }
  };

  run.cancelActive = () => {
    if (isCancelling) return;
    isCancelling = true;
    try {
      generation += 1;
      activeAppendOwners.clear();
      abortActiveControllers();
    } finally {
      isCancelling = false;
    }
  };

  return run;
}

// 正本は patient-context.tsx(再取得経路と共用)。既存 import 互換のため再エクスポート。
export { toPatientContextData } from '../components/patient/patient-context';

/** カナ完全一致で複数存在する患者のカナ集合(UIX-001 P-09 同姓同名警告) */
export function duplicateKanaSet(
  results: readonly PatientSearchResult[],
): ReadonlySet<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const p of results) {
    const kana = p.kana;
    if (seen.has(kana)) duplicates.add(kana);
    else seen.add(kana);
  }
  return duplicates;
}
