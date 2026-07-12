"use client";

import { useCallback, useRef, useState } from "react";

import {
  patientSearchResponseSchema,
  type PatientSearchResult,
} from "@yrese/contracts";
import { patientId } from "@yrese/shared-kernel";

import { devTenantHeaders } from "../dev-tenant";

import { registeredErrorCodeOrUndefined } from "../components/error-code";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import {
  type PatientContextData,
  toPatientContextData,
  useOptionalPatientContext,
} from "../components/patient-context";
import {
  ELIGIBILITY_LABELS,
  PatientHeader,
  computeAgeYears,
} from "../components/patient-header";
import { SeverityList } from "../components/severity-list";
import { ELIGIBILITY_PRESENTATION } from "../status/visual-status-registry";
import { resolveWebApiUrl } from "../api-transport";

/**
 * 患者検索UI(WP-3003 / WP-3008)。
 *
 * 契約の正本は @yrese/contracts(API-001)。契約外フィールドを仮定しない。
 * レスポンスは zod schema でクライアント側でも検証する(契約ドリフト検知)。
 *
 * 医療UI原則: 資格確認状態のテキストラベルは PatientHeader の ELIGIBILITY_LABELS を
 * 再利用(文言の二重実装禁止 — WP-4041)、カナ併記+同姓同名警告(P-09)、
 * キーボード第一(autoFocus + Enter 送信)。
 */

// 正本は dev-tenant.ts(複数画面で共用)。既存 import 互換のため再エクスポート。
export { PATIENT_SEARCH_DEV_SCOPES, devTenantHeaders } from "../dev-tenant";

const SEX_LABELS: Record<PatientSearchResult["sex"], string> = {
  male: "男",
  female: "女",
  unknown: "不明",
};

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
class SearchError extends Error {
  constructor(
    message: string,
    readonly nextAction: string,
    readonly errorCode?: string,
  ) {
    super(message);
  }

  toNotice(): ErrorNoticeProps {
    return {
      message: this.message,
      nextAction: this.nextAction,
      ...(this.errorCode !== undefined ? { errorCode: this.errorCode } : {}),
    };
  }
}

export async function fetchSearch(
  q: string,
  cursor?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchPage> {
  const params = new URLSearchParams({ q });
  if (cursor !== undefined) {
    params.set("cursor", cursor);
  }
  const url = resolveWebApiUrl(`/patients/search?${params}`);
  const res = await fetchImpl(url, {
    headers: devTenantHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const rawErrorCode =
      typeof body === "object" && body !== null && "errorCode" in body
        ? (body as { errorCode: unknown }).errorCode
        : undefined;
    // registry 未登録/形式外のコードは表示しない(異常値の verbatim 出力防止)
    const errorCode = registeredErrorCodeOrUndefined(rawErrorCode);
    if (res.status === 403) {
      throw new SearchError(
        "権限がありません。",
        "管理者に権限(patient:read)の付与状況を確認してください。",
        errorCode,
      );
    }
    if (res.status === 400) {
      throw new SearchError(
        "検索条件が不正です。",
        "入力内容を確認して再度検索してください。",
        errorCode,
      );
    }
    throw new SearchError(
      `検索に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
      errorCode,
    );
  }
  const parsed = patientSearchResponseSchema.parse(await res.json());
  return {
    results: [...parsed.results],
    ...(parsed.nextCursor !== undefined ? { nextCursor: parsed.nextCursor } : {}),
  };
}

/**
 * 最後に発行した検索だけを状態へ反映する runner(WP-4037: stale response guard)。
 * 古いリクエストは成功・失敗のどちらも破棄し、連続検索で結果が巻き戻らないようにする。
 */
export function createSearchRunner(
  fetcher: (q: string, cursor?: string) => Promise<SearchPage>,
  emit: (update: (prev: SearchState) => SearchState) => void,
): (query: string, cursor?: string, append?: boolean) => Promise<void> {
  let generation = 0;
  const activeAppendOwners = new Map<
    string,
    Map<string | undefined, object>
  >();
  return async (query, cursor, append = false) => {
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

    const gen = ++generation;
    if (trimmed.length === 0) {
      emit(() => ({
        kind: "error",
        notice: {
          severity: "WARNING",
          message: "検索語が入力されていません。",
          nextAction: "氏名・カナ・患者番号のいずれかを入力してください。",
        },
      }));
      return;
    }
    try {
      emit((prev) => {
        if (!append) return { kind: "loading" };
        return prev.kind === "loaded" &&
          prev.query === trimmed &&
          prev.nextCursor === cursor
          ? { ...prev, appendState: { kind: "loading" } }
          : prev;
      });
      try {
        const page = await fetcher(trimmed, cursor);
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
        const notice =
          error instanceof SearchError
            ? error.toNotice()
            : {
                message: "検索結果の処理に失敗しました。",
                nextAction:
                  "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
              };
        emit((prev) => {
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
      if (appendOwner !== undefined) {
        const cursorOwners = activeAppendOwners.get(trimmed);
        if (cursorOwners?.get(cursor) === appendOwner) {
          cursorOwners.delete(cursor);
          if (cursorOwners.size === 0) {
            activeAppendOwners.delete(trimmed);
          }
        }
      }
    }
  };
}

// 正本は patient-context.tsx(再取得経路と共用)。既存 import 互換のため再エクスポート。
export { toPatientContextData } from "../components/patient-context";

/** カナ完全一致で複数存在する患者のカナ集合(UIX-001 P-09 同姓同名警告) */
export function duplicateKanaSet(
  results: readonly PatientSearchResult[],
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const p of results) {
    counts.set(p.kana, (counts.get(p.kana) ?? 0) + 1);
  }
  return new Set(
    [...counts].filter(([, count]) => count > 1).map(([kana]) => kana),
  );
}

export function PatientSearchResults({
  results,
  query,
  nextCursor,
  appendState = { kind: "idle" },
  onLoadMore,
  onSelect,
}: {
  readonly results: readonly PatientSearchResult[];
  readonly query: string;
  readonly nextCursor?: string;
  readonly appendState?: SearchAppendState;
  readonly onLoadMore?: () => void;
  /** 患者を業務対象として選択する(患者文脈確定 — UIX-006 / R-PATCTX) */
  readonly onSelect?: (patient: PatientSearchResult) => void;
}) {
  const duplicates = duplicateKanaSet(results);
  // 同姓同名判定は「読み込み済みの結果」に対してのみ有効。続きがある間は
  // 未読込分に同姓同名が存在しうるため、警告の不在を「同姓同名なし」と
  // 誤読させない(fail-closed の可視化 — opus4.8 医療安全レビュー F1)
  const notices = [
    ...(duplicates.size > 0
      ? [
          {
            severity: "WARNING" as const,
            message:
              "同姓同名の患者が複数います。生年月日・患者番号で必ず確認してください。",
          },
        ]
      : []),
    ...(nextCursor !== undefined && results.length > 0
      ? [
          {
            severity: "INFO" as const,
            message:
              "未読込の続きがあります。同姓同名の患者が続きに含まれる可能性があるため、続きの読み込みか検索語の絞り込みで確認してください。",
          },
        ]
      : []),
  ];
  return (
    <>
      <p role="status">
        「{query}」の検索結果: {results.length}件
        {nextCursor !== undefined && "(続きあり)"}
      </p>
      {notices.length > 0 && <SeverityList items={notices} />}
      {results.length > 0 && (
        <div className="table-scroll">
          <table className="patient-search-results">
          <thead>
            <tr>
              <th scope="col">患者番号</th>
              <th scope="col">氏名(カナ)</th>
              <th scope="col">生年月日</th>
              <th scope="col">性別</th>
              <th scope="col">資格確認状態</th>
              {onSelect !== undefined && <th scope="col">操作</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((p) => {
              const isDuplicate = duplicates.has(p.kana);
              return (
                <tr
                  key={p.patientId}
                  {...(isDuplicate ? { "data-duplicate-kana": "true" } : {})}
                >
                  <td>{p.patientNumber}</td>
                  <td>
                    {isDuplicate && (
                      <span className="patient-duplicate-kana-label">
                        【同姓同名注意】
                      </span>
                    )}
                    <span className="patient-kana">{p.kana}</span>
                    <span className="patient-name">{p.name}</span>
                  </td>
                  <td>{p.birthDate}</td>
                  <td>{SEX_LABELS[p.sex]}</td>
                  <td>
                    <span
                      className="patient-eligibility"
                      data-status={p.eligibilityStatus}
                    >
                      <span className="patient-eligibility-shape" aria-hidden="true">
                        {ELIGIBILITY_PRESENTATION[p.eligibilityStatus].shape}
                      </span>
                      {ELIGIBILITY_LABELS[p.eligibilityStatus]}
                      {p.eligibilityCheckedAt !== undefined && (
                        <span className="patient-eligibility-checked-at">
                          (最終確認: {p.eligibilityCheckedAt})
                        </span>
                      )}
                    </span>
                  </td>
                  {onSelect !== undefined && (
                    <td>
                      <button type="button" onClick={() => onSelect(p)}>
                        この患者を選択
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
      {nextCursor !== undefined && onLoadMore !== undefined && (
        <>
          {appendState.kind === "error" && <ErrorNotice {...appendState.notice} />}
          <button
            type="button"
            onClick={onLoadMore}
            disabled={appendState.kind === "loading"}
          >
            {appendState.kind === "loading"
              ? "続きを読み込み中…"
              : appendState.kind === "error"
                ? "続きの読み込みを再試行"
                : "続きを読み込む"}
          </button>
        </>
      )}
    </>
  );
}

export function PatientSearch() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  // 業務対象として確定した患者(患者文脈)。別患者を選ぶと置き換わり、
  // 前患者の文脈は破棄される(患者切替時の残存防止 — R-PATCTX / H-02)。
  // Provider 配下(実アプリ)では横断文脈へ委譲し、全画面共通バーで固定表示する。
  // Provider なし(スタンドアロン)ではローカル状態で自己完結する。
  const patientCtx = useOptionalPatientContext();
  const [localSelected, setLocalSelected] = useState<PatientContextData | null>(null);
  const runnerRef = useRef<ReturnType<typeof createSearchRunner> | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createSearchRunner(fetchSearch, setState);
  }

  const runSearch = useCallback(
    (query: string, cursor?: string, append = false) => {
      if (runnerRef.current === null) {
        throw new Error("PatientSearch runner is not initialized");
      }
      void runnerRef.current(query, cursor, append);
    },
    [],
  );

  const selectPatient = useCallback(
    (p: PatientSearchResult) => {
      const data = toPatientContextData(p);
      if (patientCtx !== null) {
        patientCtx.selectPatient(data);
      } else {
        setLocalSelected(data);
      }
    },
    [patientCtx],
  );

  // Provider 配下では固定バーが選択中患者を表示するため、検索画面での重複表示はしない。
  const standaloneSelected = patientCtx === null ? localSelected : null;

  return (
    <section aria-label="患者検索">
      {standaloneSelected !== null && (
        <div className="selected-patient-context">
          <p className="selected-patient-context-title" role="status">
            選択中の患者(この患者を業務対象とします)
          </p>
          <PatientHeader
            patientId={patientId(standaloneSelected.patientId)}
            name={standaloneSelected.name}
            kana={standaloneSelected.kana}
            birthDate={standaloneSelected.birthDate}
            age={computeAgeYears(standaloneSelected.birthDate, new Date())}
            sex={standaloneSelected.sex}
            eligibility={standaloneSelected.eligibilityStatus}
            {...(standaloneSelected.eligibilityCheckedAt !== undefined
              ? { eligibilityCheckedAt: standaloneSelected.eligibilityCheckedAt }
              : {})}
          />
          <button type="button" onClick={() => setLocalSelected(null)}>
            選択解除
          </button>
        </div>
      )}
      <form
        className="patient-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q);
        }}
      >
        <label htmlFor="patient-search-q">患者検索(氏名・カナ・患者番号)</label>
        <div className="patient-search-row">
          <input
            id="patient-search-q"
            name="q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            autoFocus
            autoComplete="off"
            placeholder="例: ヤマダ / 山田 / P-0001"
          />
          <button type="submit" disabled={state.kind === "loading"}>
            検索
          </button>
        </div>
      </form>

      {state.kind === "loading" && <p role="status">検索中…</p>}

      {state.kind === "error" && <ErrorNotice {...state.notice} />}

      {state.kind === "loaded" && (
        <PatientSearchResults
          results={state.results}
          query={state.query}
          appendState={state.appendState}
          {...(state.nextCursor !== undefined
            ? { nextCursor: state.nextCursor }
            : {})}
          onLoadMore={() => runSearch(state.query, state.nextCursor, true)}
          onSelect={selectPatient}
        />
      )}
    </section>
  );
}
