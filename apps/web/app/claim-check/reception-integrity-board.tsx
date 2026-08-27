"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { ReceptionSummaryResponse } from "@yrese/contracts";

import {
  fetchReceptionSummary,
  toOperationsNotice,
} from "../api/operations-client";
import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import { TableScroll } from "../components/operator-ui";
import { formatAcceptedTime, todayAsIsoDate } from "../reception-dashboard";

/**
 * 請求前点検(SCR-019)内の「保存済み受付・資格確認の実件数」パネル。
 *
 * 表示するのは GET /operations/reception-summary が返す **件数だけ** である。
 * この集計エンドポイントは患者識別子を返さない。氏名・カナ・生年月日・患者IDを
 * この画面へ持ち込まないため、PHI を含む GET /reception/queue は使わない
 * (患者横断・バッチ画面に患者文脈を持ち込まない — UIX-001)。
 *
 * ここに出る件数は「点検結果」でも「請求可否の判定」でもない。点検ルールは
 * RB-001 BLOCKED_REGULATORY_REVIEW / RB-008 / RB-009 で停止しており、
 * 本パネルはその停止範囲の外にある保存済み実績のみを示す。
 *
 * 配列 byReceptionStatus / byEligibilityStatus は契約 (operations-status.ts) が
 * 全 enum メンバーの網羅と宣言順を強制するため、count: 0 は「実測 0 件」であり
 * 「集計していない」ではない。
 */

export interface ReceptionIntegritySnapshot {
  readonly summary: ReceptionSummaryResponse;
  /** 取得時刻 HH:MM (JST)。いつ時点の内容かを表示するために持つ。 */
  readonly loadedAt: string;
}

export type ReceptionIntegrityState =
  | { readonly kind: "loading"; readonly date: string; readonly previous: ReceptionIntegritySnapshot | null }
  | { readonly kind: "loaded"; readonly summary: ReceptionSummaryResponse; readonly loadedAt: string }
  | {
      readonly kind: "error";
      readonly date: string;
      readonly notice: ErrorNoticeProps;
      readonly previous: ReceptionIntegritySnapshot | null;
    };

/**
 * 再取得の失敗で前回結果を消さないための保持規則。
 * 「いつの・どの業務日の内容を表示しているか」を必ず添えて再掲する。
 */
export function retainedSnapshot(
  state: ReceptionIntegrityState,
): ReceptionIntegritySnapshot | null {
  return state.kind === "loaded"
    ? { summary: state.summary, loadedAt: state.loadedAt }
    : state.previous;
}

/**
 * 取得を試みた要求の識別。業務日だけを state に持つと、同じ業務日で「表示」を押しても
 * React が state 更新を bail out し、取得 effect が再実行されない。失敗表示から同じ
 * 業務日で再取得する導線が消えるため、attempt を含めた要求単位で識別する
 * (OutboxBoard の reloadToken / ClosingReceptionSummary の attempt と同じ規則)。
 */
export interface ReceptionIntegrityRequest {
  readonly date: string;
  readonly attempt: number;
}

export function nextReceptionIntegrityRequest(
  previous: ReceptionIntegrityRequest,
  date: string,
): ReceptionIntegrityRequest {
  return { date, attempt: previous.attempt + 1 };
}

function StatusCountTable({
  caption,
  scrollLabel,
  headerLabel,
  rows,
}: {
  readonly caption: string;
  readonly scrollLabel: string;
  readonly headerLabel: string;
  readonly rows: readonly { readonly key: string; readonly badge: ReactNode; readonly count: number }[];
}) {
  return (
    <TableScroll label={scrollLabel}>
      <table className="operator-table operator-table-dense">
        <caption className="operator-table-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headerLabel}</th>
            <th scope="col">件数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.badge}</th>
              <td>{row.count}件</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

export function ReceptionIntegrityView({
  state,
}: {
  readonly state: ReceptionIntegrityState;
}) {
  const snapshot = retainedSnapshot(state);
  /** 取得が完了していない業務日。null なら表示中の内容が最新の取得結果。 */
  const pendingDate = state.kind === "loaded" ? null : state.date;

  return (
    <div className="operator-stack">
      {state.kind === "loading" && snapshot === null ? (
        <LoadingState label={`${state.date} の受付集計を取得しています…`} />
      ) : null}

      {snapshot !== null ? (
        <>
          <p role="status">
            {pendingDate === null
              ? `業務日 ${snapshot.summary.date} の保存済み受付は ${snapshot.summary.totalCount} 件です(最終取得 ${snapshot.loadedAt}(JST))。`
              : `表示中の内容は業務日 ${snapshot.summary.date} を ${snapshot.loadedAt}(JST)に取得した結果です。業務日 ${pendingDate} の取得は完了していません。`}
          </p>
          {snapshot.summary.totalCount === 0 ? (
            <EmptyState
              message={`業務日 ${snapshot.summary.date} に保存された受付はありません(実測0件)。集計が未接続なのではなく、この業務日の受付が0件です。`}
            />
          ) : (
            <div className="operator-two-column">
              <StatusCountTable
                scrollLabel="受付状態別の保存済み件数"
                caption="保存済み受付の受付状態別件数です。0件は実測値であり、未取得ではありません。"
                headerLabel="受付状態"
                rows={snapshot.summary.byReceptionStatus.map((row) => ({
                  key: row.status,
                  badge: <DomainStatusBadge query={{ domain: "reception", key: row.status }} />,
                  count: row.count,
                }))}
              />
              <StatusCountTable
                scrollLabel="資格確認状態別の保存済み件数"
                caption="保存済み受付の資格確認状態別件数です。資格確認済み以外が0件でも、請求可否を確認済みという意味ではありません。"
                headerLabel="資格確認状態"
                rows={snapshot.summary.byEligibilityStatus.map((row) => ({
                  key: row.status,
                  badge: <DomainStatusBadge query={{ domain: "eligibility", key: row.status }} />,
                  count: row.count,
                }))}
              />
            </div>
          )}
        </>
      ) : null}

      {state.kind === "error" ? <ErrorNotice {...state.notice} /> : null}
    </div>
  );
}

export function ReceptionIntegrityBoard() {
  const [dateInput, setDateInput] = useState(todayAsIsoDate);
  const [request, setRequest] = useState<ReceptionIntegrityRequest>(() => ({
    date: dateInput,
    attempt: 0,
  }));
  const [state, setState] = useState<ReceptionIntegrityState>(() => ({
    kind: "loading",
    date: dateInput,
    previous: null,
  }));

  useEffect(() => {
    const controller = new AbortController();
    const target = request.date;
    setState((prev) => ({ kind: "loading", date: target, previous: retainedSnapshot(prev) }));

    fetchReceptionSummary({ date: target, signal: controller.signal })
      .then((summary) => {
        // 業務日を切り替えた後・アンマウント後の応答は state へ反映しない。
        if (controller.signal.aborted) return;
        setState({
          kind: "loaded",
          summary,
          loadedAt: formatAcceptedTime(new Date().toISOString()),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          kind: "error",
          date: target,
          notice: toOperationsNotice(error),
          previous: retainedSnapshot(prev),
        }));
      });

    return () => {
      controller.abort();
    };
  }, [request]);

  return (
    <section
      aria-label="受付・資格確認の保存済み実件数"
      className="operator-stack"
      {...(state.kind === "loading" ? { "aria-busy": "true" } : {})}
    >
      <form
        className="filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setRequest((prev) => nextReceptionIntegrityRequest(prev, dateInput));
        }}
      >
        <label htmlFor="claim-check-business-date">
          業務日(JST)
          <input
            id="claim-check-business-date"
            className="operator-input"
            type="date"
            required
            value={dateInput}
            onChange={(event) => {
              setDateInput(event.target.value);
            }}
          />
        </label>
        <div className="operator-inline-actions">
          <button type="submit" className="operator-button" data-kind="primary">
            表示
          </button>
        </div>
      </form>
      <ReceptionIntegrityView state={state} />
    </section>
  );
}
