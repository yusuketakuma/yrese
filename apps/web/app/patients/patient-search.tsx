"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PATIENT_SEARCH_DEFAULT_LIMIT,
  type PatientSearchResult,
} from "@yrese/contracts";
import { patientId } from "@yrese/shared-kernel";

import { EmptyState } from '../components/empty-state';
import { LoadingState } from '../components/loading-state';
import {
  MetricCard,
  MetricGrid,
  Panel,
  TableScroll,
} from '../components/operator/operator-ui';
import { ErrorNotice } from '../components/error-notice';
import {
  type PatientContextData,
  toPatientContextData,
  useOptionalPatientContext,
} from '../components/patient/patient-context';
import {
  ELIGIBILITY_LABELS,
  PatientHeader,
  computeAgeYears,
} from '../components/patient/patient-header';
import { SeverityList } from '../components/severity-list';
import {
  ELIGIBILITY_PRESENTATION,
  SEX_LABELS,
} from '../status/visual-status-registry';
import { PatientCoveragePanel } from './patient-coverage';
import { PatientRegistrationForm } from './patient-registration';
import {
  createSearchRunner,
  duplicateKanaSet,
  fetchSearch,
  patientSearchEmptyContinuationErrorMessage,
  patientSearchPageLimitErrorMessage,
  trustedSearchErrorNotice,
  type SearchAppendState,
  type SearchPage,
  type SearchState,
} from './patient-search-data';

export * from './patient-search-data';

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


// 正本は patient-context.tsx(再取得経路と共用)。既存 import 互換のため再エクスポート。
export { toPatientContextData } from '../components/patient/patient-context';

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
        <TableScroll label="患者検索結果表。横方向にスクロールできます">
          <table className="patient-search-results">
            <thead>
              <tr>
                <th scope="col">患者番号</th>
                <th scope="col">氏名(カナ)</th>
                <th scope="col">生年月日</th>
                <th scope="col">満年齢</th>
                <th scope="col">性別</th>
                <th scope="col">資格確認状態</th>
                {onSelect !== undefined && (
                  <th scope="col" className="patient-search-action-column">
                    操作
                  </th>
                )}
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
                    <td>{computeAgeYears(p.birthDate, new Date())}歳</td>
                    <td>{SEX_LABELS[p.sex]}</td>
                    <td>
                      <span
                        className="patient-eligibility"
                        data-status={p.eligibilityStatus}
                      >
                        <span
                          className="patient-eligibility-shape"
                          aria-hidden="true"
                        >
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
                      <td className="patient-search-action-column">
                        <button
                          className="operator-button"
                          type="button"
                          onClick={() => onSelect(p)}
                        >
                          この患者を選択
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
      {results.length === 0 && (
        <EmptyState message="検索条件に一致する患者は0件でした。氏名・カナ・患者番号の表記(全角・半角、旧字体)を変えて再検索してください。この0件は検索が実行できた結果であり、未接続を意味しません。" />
      )}
      {nextCursor !== undefined && onLoadMore !== undefined && (
        <>
          {appendState.kind === "error" && <ErrorNotice {...appendState.notice} />}
          <button
            className="operator-button"
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

/**
 * 検索結果メトリクスの表示投影(WP-5101)。実際の検索状態だけを反映し、
 * 未実行・エラー時は欠測「—」を維持する(truthfulness 原則)。
 */
export function patientSearchResultMetric(state: SearchState): {
  readonly value: string;
  readonly detail: string;
} {
  if (state.kind === "loaded") {
    // 契約は総件数を返さないため、切り詰められた頁では「該当件数」と呼ばない
    // (表示中の件数と総数を混同させない — WP-5101 review)。
    return {
      value: String(state.results.length),
      detail:
        state.nextCursor !== undefined
          ? `「${state.query}」の表示中件数(未読込の続きあり・総数不明)`
          : `「${state.query}」の該当件数`,
    };
  }
  if (state.kind === "loading") {
    return { value: "—", detail: "検索中" };
  }
  if (state.kind === "error") {
    return { value: "—", detail: "検索エラー" };
  }
  return { value: "—", detail: "検索実行後に一覧表示" };
}

/** 選択確定後に処方入力へ進む導線(WP-5212-6)。手入力の受付IDは経由しない。 */
export function ProceedToPrescriptionLink({
  selected,
}: {
  readonly selected: PatientContextData | null;
}) {
  if (selected === null) return null;
  return (
    <p className="operator-empty-copy">
      <Link className="operator-text-action" href="/">
        受付を選んで処方入力へ進む
      </Link>
    </p>
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
    runnerRef.current = createSearchRunner(
      (query, cursor, signal) => fetchSearch(query, cursor, fetch, signal),
      setState,
    );
  }

  useEffect(
    () => () => {
      runnerRef.current?.cancelActive();
    },
    [],
  );

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

  const selected = patientCtx !== null ? patientCtx.patient : localSelected;
  const resultMetric = patientSearchResultMetric(state);

  return (
    <>
      <MetricGrid>
        <MetricCard
          label="検索結果"
          value={resultMetric.value}
          unit="名"
          detail={resultMetric.detail}
          tone="accent"
          icon="患"
        />
        <MetricCard
          label="選択中の患者"
          value={selected !== null ? "1" : "0"}
          unit="名"
          detail={selected !== null ? `${selected.name} を業務対象に固定中` : "未選択"}
          tone="info"
          icon="選"
        />
        {/* 未接続の集計は「—」のまま理由を名指しする(0を捏造しない — UIX-001 §6)。 */}
        <MetricCard
          label="資格未確認"
          value="—"
          unit="名"
          detail="患者横断の集計APIが未登録のため導出できません(0件を意味しません)"
          tone="neutral"
          icon="?"
        />
        <MetricCard
          label="要フォロー"
          value="—"
          unit="名"
          detail="フォロー対象の判定基準がAPPROVED SSOTに未登録のため導出できません(0件を意味しません)"
          tone="neutral"
          icon="?"
        />
      </MetricGrid>
      <section aria-label="患者検索">
        <Panel
          title="患者一覧"
          description="検索結果は取得時点の鮮度を表示し、古い応答や重複患者IDを安全側で拒否します。"
          className="live-surface-panel"
        >
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
              <button
                className="operator-button"
                type="button"
                onClick={() => setLocalSelected(null)}
              >
                選択解除
              </button>
            </div>
          )}
          <ProceedToPrescriptionLink selected={selected} />
          <form
            className="patient-search-form"
            method="post"
            action="/patients"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
          >
            <label htmlFor="patient-search-q">患者検索(氏名・カナ・患者番号)</label>
            <div className="patient-search-row">
              <input
                id="patient-search-q"
                type="search"
                enterKeyHint="search"
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
            {/* 検索語(患者氏名になりうる)を送信本文・URLへ載せないため、
                入力欄に name 属性を付けない。結果としてJavaScript無効時は
                検索が実行できないので、その制約を常時可視で説明する。 */}
            <p className="operator-empty-copy">
              検索はブラウザ上でのみ実行します。JavaScriptが無効の場合、患者氏名などの検索語をURL・送信本文へ載せない設計のため検索を実行できません。その場合は管理者へ連絡してください。
            </p>
          </form>

          {state.kind === "loading" && <LoadingState label="患者を検索中…" />}

          {state.kind === "error" && <ErrorNotice {...state.notice} />}

          {state.kind === "idle" && (
            <EmptyState message="まだ検索を実行していません。氏名・カナ・患者番号のいずれかを入力して検索してください。患者一覧は検索を実行するまで表示しません。" />
          )}

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
        </Panel>
      </section>
      {selected !== null && (
        <section aria-label="保険・公費">
          <PatientCoveragePanel patient={selected} />
        </section>
      )}
      <section aria-label="患者登録">
        <PatientRegistrationForm onRegistered={selectPatient} />
      </section>
    </>
  );
}
