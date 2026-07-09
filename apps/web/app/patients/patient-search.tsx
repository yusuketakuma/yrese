"use client";

import { useCallback, useRef, useState } from "react";

import {
  patientSearchResponseSchema,
  type PatientSearchResult,
} from "@yrese/contracts";
import { isValidErrorCode } from "@yrese/shared-kernel";

import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { ELIGIBILITY_LABELS } from "../components/patient-header";
import { SeverityList } from "../components/severity-list";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/**
 * 開発用テナントヘッダ(バックエンドの dev stub と対)。
 * development 以外では一切送らない(WP-4038: 本番境界)。バックエンド側も
 * NODE_ENV=production で dev stub 自体が起動拒否されるため二重防御になる。
 * 本番認証(OIDC等)は BLOCKED_SECURITY_REVIEW — auth SSOT 承認後に置換する。
 */
export function devTenantHeaders(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Record<string, string> {
  if (nodeEnv !== "development") {
    return {};
  }
  return {
    "x-dev-tenant": "t-dev",
    "x-dev-pharmacy": "ph-dev",
    "x-dev-actor": "u-dev",
    "x-dev-scopes": "patient:read",
  };
}

const SEX_LABELS = { male: "男", female: "女", unknown: "不明" } as const;

export type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | {
      kind: "loaded";
      results: PatientSearchResult[];
      nextCursor?: string;
      query: string;
    };

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

async function fetchSearch(q: string, cursor?: string): Promise<SearchPage> {
  const params = new URLSearchParams({ q });
  if (cursor !== undefined) {
    params.set("cursor", cursor);
  }
  const res = await fetch(`${API_BASE}/patients/search?${params}`, {
    headers: devTenantHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const rawErrorCode =
      typeof body === "object" && body !== null && "errorCode" in body
        ? (body as { errorCode: unknown }).errorCode
        : undefined;
    // registry 形式外のコードは表示しない(異常値の verbatim 出力防止)
    const errorCode =
      typeof rawErrorCode === "string" && isValidErrorCode(rawErrorCode)
        ? rawErrorCode
        : undefined;
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
  return async (query, cursor, append = false) => {
    const trimmed = query.trim();
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
    const gen = ++generation;
    emit((prev) =>
      append && prev.kind === "loaded" ? prev : { kind: "loading" },
    );
    try {
      const page = await fetcher(trimmed, cursor);
      if (gen !== generation) {
        return; // 古い応答は破棄(最後の検索のみ反映)
      }
      emit((prev) => ({
        kind: "loaded",
        results:
          append && prev.kind === "loaded"
            ? [...prev.results, ...page.results]
            : page.results,
        ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
        query: trimmed,
      }));
    } catch (error) {
      if (gen !== generation) {
        return; // 古いリクエストの失敗も破棄
      }
      emit(() => ({
        kind: "error",
        notice:
          error instanceof SearchError
            ? error.toNotice()
            : {
                message: "検索結果の処理に失敗しました。",
                nextAction:
                  "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
              },
      }));
    }
  };
}

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
  onLoadMore,
}: {
  readonly results: readonly PatientSearchResult[];
  readonly query: string;
  readonly nextCursor?: string;
  readonly onLoadMore?: () => void;
}) {
  const duplicates = duplicateKanaSet(results);
  return (
    <>
      <p role="status">
        「{query}」の検索結果: {results.length}件
        {nextCursor !== undefined && "(続きあり)"}
      </p>
      {duplicates.size > 0 && (
        <SeverityList
          items={[
            {
              severity: "WARNING",
              message:
                "同姓同名の患者が複数います。生年月日・患者番号で必ず確認してください。",
            },
          ]}
        />
      )}
      {results.length > 0 && (
        <table className="patient-search-results">
          <thead>
            <tr>
              <th scope="col">患者番号</th>
              <th scope="col">氏名(カナ)</th>
              <th scope="col">生年月日</th>
              <th scope="col">性別</th>
              <th scope="col">資格確認状態</th>
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
                      {ELIGIBILITY_LABELS[p.eligibilityStatus]}
                      {p.eligibilityCheckedAt !== undefined && (
                        <span className="patient-eligibility-checked-at">
                          (最終確認: {p.eligibilityCheckedAt})
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {nextCursor !== undefined && onLoadMore !== undefined && (
        <button type="button" onClick={onLoadMore}>
          続きを読み込む
        </button>
      )}
    </>
  );
}

export function PatientSearch() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const runnerRef = useRef(createSearchRunner(fetchSearch, setState));

  const runSearch = useCallback(
    (query: string, cursor?: string, append = false) => {
      void runnerRef.current(query, cursor, append);
    },
    [],
  );

  return (
    <section aria-label="患者検索">
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
          {...(state.nextCursor !== undefined
            ? { nextCursor: state.nextCursor }
            : {})}
          onLoadMore={() => runSearch(state.query, state.nextCursor, true)}
        />
      )}
    </section>
  );
}
