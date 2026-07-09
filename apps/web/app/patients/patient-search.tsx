"use client";

import { useCallback, useState } from "react";

import {
  patientSearchResponseSchema,
  type EligibilityStatus,
  type PatientSearchResult,
} from "@yrese/contracts";

import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";

/**
 * 患者検索UI(WP-3003)。
 *
 * 契約の正本は @yrese/contracts(API-001 v0.2.0)。契約外フィールドを仮定しない。
 * レスポンスは zod schema でクライアント側でも検証する(契約ドリフト検知)。
 *
 * 医療UI原則: 資格確認状態を検索結果の時点でテキストラベル表示(色非依存)、
 * カナ併記(取り違え防止)、キーボード第一(autoFocus + Enter 送信)。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/**
 * 開発用テナントヘッダ(バックエンドの dev stub と対)。
 * 本番認証(OIDC等)は BLOCKED_SECURITY_REVIEW — auth SSOT 承認後に置換する。
 * バックエンド側は NODE_ENV=production でこのスタブ自体が起動拒否される。
 */
const DEV_HEADERS: Record<string, string> = {
  "x-dev-tenant": "t-dev",
  "x-dev-pharmacy": "ph-dev",
  "x-dev-actor": "u-dev",
  "x-dev-scopes": "patient:read",
};

const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  VERIFIED: "資格確認済み",
  PENDING_REVERIFY: "資格再確認待ち",
  LOCAL_ONLY_UNVERIFIED: "ローカル参照のみ(未確認)",
  NOT_CHECKED: "資格未確認",
};

const SEX_LABELS = { male: "男", female: "女", unknown: "不明" } as const;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | {
      kind: "loaded";
      results: PatientSearchResult[];
      nextCursor?: string;
      query: string;
    };

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

async function fetchSearch(
  q: string,
  cursor?: string,
): Promise<{ results: PatientSearchResult[]; nextCursor?: string }> {
  const params = new URLSearchParams({ q });
  if (cursor !== undefined) {
    params.set("cursor", cursor);
  }
  const res = await fetch(`${API_BASE}/patients/search?${params}`, {
    headers: DEV_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const errorCode =
      typeof body === "object" && body !== null && "errorCode" in body
        ? String((body as { errorCode: unknown }).errorCode)
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

export function PatientSearch() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  const runSearch = useCallback(async (query: string, cursor?: string, append = false) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setState({
        kind: "error",
        notice: {
          severity: "WARNING",
          message: "検索語が入力されていません。",
          nextAction: "氏名・カナ・患者番号のいずれかを入力してください。",
        },
      });
      return;
    }
    setState((prev) =>
      append && prev.kind === "loaded" ? prev : { kind: "loading" },
    );
    try {
      const page = await fetchSearch(trimmed, cursor);
      setState((prev) => ({
        kind: "loaded",
        results:
          append && prev.kind === "loaded"
            ? [...prev.results, ...page.results]
            : page.results,
        ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
        query: trimmed,
      }));
    } catch (error) {
      setState({
        kind: "error",
        notice:
          error instanceof SearchError
            ? error.toNotice()
            : {
                message: "検索結果の処理に失敗しました。",
                nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
              },
      });
    }
  }, []);

  return (
    <section aria-label="患者検索">
      <form
        className="patient-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(q);
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
        <>
          <p role="status">
            「{state.query}」の検索結果: {state.results.length}件
            {state.nextCursor !== undefined && "(続きあり)"}
          </p>
          {state.results.length > 0 && (
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
                {state.results.map((p) => (
                  <tr key={p.patientId}>
                    <td>{p.patientNumber}</td>
                    <td>
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
                ))}
              </tbody>
            </table>
          )}
          {state.nextCursor !== undefined && (
            <button
              type="button"
              onClick={() => void runSearch(state.query, state.nextCursor, true)}
            >
              続きを読み込む
            </button>
          )}
        </>
      )}
    </section>
  );
}
