"use client";

import { useEffect, useState } from "react";

import type { ReceptionSummaryResponse } from "@yrese/contracts";
import {
  SYSTEM_MODES,
  allowsClaimFinalization,
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import {
  fetchReceptionSummary,
  toOperationsNotice,
} from "../api/operations-client";
import {
  fetchSessionScopes,
  scopeAbsenceIsMeasurable,
  sessionHasScopes,
  toSessionNotice,
  type SessionScopes,
} from "../api/session-client";
import {
  PermissionState,
  ReadOnlyIndicator,
} from "../components/audit-metadata";
import { DomainStatusBadge } from "../components/domain-status-badge";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import {
  InlineNotice,
  KeyValueList,
  StatusPill,
  TableScroll,
} from "../components/operator-ui";
import { todayAsIsoDate } from "../reception-dashboard";

/**
 * SCR-020 月次締め・返戻管理のうち、**実データで言えることだけ**を描く部品群。
 *
 * この画面の締め・ロック・オンライン請求送信は実行できない。実行不可の結論は
 * セッション権限の取得結果に依存せず常に fail-closed であり、権限判定(第1段)と
 * operation 認可(第2段)を分けて説明する。第2段を止めているゲートは
 * CLOSING_BLOCKING_GATES で短く参照し、full detail は画面上部の機能境界に集約する。
 *
 * 表示する実データは 2 系統だけ:
 * - GET /whoami(セッションの scope。claim:finalize の有無は事実として出す)
 * - GET /operations/reception-summary?date=(保存済み受付の件数。PHI 非含有)
 * モード検知 API は存在しないため、システムモードは未検知のままとし NORMAL を前提にしない。
 */

/** 締め・ロック・送信に必要とされる scope(付与されていても実行可にはならない)。 */
export const CLAIM_FINALIZE_SCOPES = [
  permissionScope("claim", "finalize"),
] as const satisfies readonly PermissionScope[];

export interface ClosingGate {
  /** 正本側の識別子。短い日本語の参照説明と併記する。 */
  readonly id: string;
  readonly summary: string;
}

/** 締め・ロック・送信を止めているゲート参照。 */
export const CLOSING_BLOCKING_GATES: readonly ClosingGate[] = [
  {
    id: "UIX-001 §12.3",
    summary: "claim:finalize を要する未登録の不可逆 operation",
  },
  {
    id: "RB-001",
    summary: "電子レセプト生成: 記録条件仕様の evidence_id 未発行",
  },
  {
    id: "RB-004 BLOCKED_REGULATORY_REVIEW",
    summary: "オンライン請求送信: 規制レビュー中",
  },
  {
    id: "ARC-007 claim_finalization_immutability_policy",
    summary: "請求確定後の不可逆性(訂正は取消・再作成のみ)",
  },
  {
    id: "UIX-001 §12.4",
    summary:
      "local-finalize / external-register 境界: DOM-004・RB-003・API-013・MOD-008・MOD-009 未承認",
  },
  {
    id: "AGENTS.md 人間承認ゲート",
    summary: "請求確定・送信: human approval 必須、system self-approval 不可",
  },
];

/* ------------------------------------------------------------------ *
 * 第1段: 実セッションの権限
 * ------------------------------------------------------------------ */

export type SessionState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly session: SessionScopes }
  | { readonly kind: "error"; readonly notice: ErrorNoticeProps };

export type FinalizeScopeState = "granted" | "missing" | "unknown";

/** セッションが claim:finalize を持つかの事実。取得できていなければ unknown(0/false に丸めない)。 */
export function finalizeScopeState(state: SessionState): FinalizeScopeState {
  if (state.kind !== "loaded") return "unknown";
  if (sessionHasScopes(state.session, CLAIM_FINALIZE_SCOPES)) return "granted";
  // 欠落が測定結果でない場合(dev stubが宣言済みscopeしか返さない)は断定しない。
  return scopeAbsenceIsMeasurable(CLAIM_FINALIZE_SCOPES) ? "missing" : "unknown";
}

const FINALIZE_SCOPE_TEXT: Record<FinalizeScopeState, string> = {
  granted:
    "現在のセッションに claim:finalize が付与されています(権限は充足しています)。",
  missing: "現在のセッションに claim:finalize は付与されていません。",
  unknown:
    "現在のセッションでは claim:finalize の付与有無を確認できていないため、権限は未確認です。付与なしとは断定しません。",
};

export function finalizeScopeText(scope: FinalizeScopeState): string {
  return FINALIZE_SCOPE_TEXT[scope];
}

const FINALIZE_SCOPE_PILL: Record<FinalizeScopeState, string> = {
  granted: "claim:finalize 付与あり",
  missing: "claim:finalize 付与なし",
  unknown: "claim:finalize 未確認",
};

export function ClosingAuthorityView({
  state,
}: {
  readonly state: SessionState;
}) {
  const scope = finalizeScopeState(state);
  return (
    <div
      className="operator-stack"
      data-finalize-scope={scope}
      aria-busy={state.kind === "loading"}
    >
      {state.kind === "loading" ? (
        <LoadingState label="セッションの権限を取得しています…" />
      ) : null}

      <div>
        <StatusPill tone={scope === "granted" ? "info" : "warning"}>
          {FINALIZE_SCOPE_PILL[scope]}
        </StatusPill>
        <p role="status">第1段(セッション権限): {finalizeScopeText(scope)}</p>
      </div>

      <PermissionState
        allowed={false}
        actionLabel="月次締め・請求データロック・オンライン請求送信"
        reason="第2段(operation 認可): claim:finalize の付与有無に関わらず、UIX-001 §12.3 に未登録の不可逆 operation のため認可が存在しません"
      />
      <ReadOnlyIndicator reason="RB-001 電子レセプト生成・RB-004 オンライン請求送信が停止中のため閲覧のみ" />

      <div>
        <h4>実行を止めているゲート参照</h4>
        <ul className="rail-action-list">
          {CLOSING_BLOCKING_GATES.map((gate) => (
            <li key={gate.id} data-gate={gate.id}>
              <strong>{gate.id}</strong>: {gate.summary}
            </li>
          ))}
        </ul>
      </div>

      {state.kind === "error" ? <ErrorNotice {...state.notice} /> : null}
    </div>
  );
}

export function ClosingExecutionAuthority() {
  const [state, setState] = useState<SessionState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchSessionScopes({ signal: controller.signal })
      .then((session) => {
        if (active) setState({ kind: "loaded", session });
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: "error", notice: toSessionNotice(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return <ClosingAuthorityView state={state} />;
}

/* ------------------------------------------------------------------ *
 * システムモード別の確定可否(shared-kernel のモードガードが正本)
 * ------------------------------------------------------------------ */

/**
 * ModeCapabilityView は「現在のモード」を1つ受け取る前提の部品であり、
 * 検知 API が無い本画面で使うと未検知のモードを断定してしまう。そのため
 * 判定関数 allowsClaimFinalization(共有正本)だけを使い、全モードを並べる。
 */
export function ClaimFinalizationModeMatrix() {
  return (
    <div className="operator-stack">
      <InlineNotice title="システムモードは未検知です" tone="warning">
        モード検知APIが存在しないため、現在のモードは判定できません。NORMAL(通常稼働)を前提にしません。下表は shared-kernel のモードガード allowsClaimFinalization による静的な可否であり、現在の実行可否ではありません。未検知は「正常」を意味しません。
      </InlineNotice>
      <TableScroll label="システムモード別の月次締め・レセプト確定の可否">
        <table className="operator-table operator-table-dense">
          <caption className="visually-hidden">
            モードガード上の請求確定可否(現在のモードは未検知)
          </caption>
          <thead>
            <tr>
              <th scope="col">システムモード</th>
              <th scope="col">請求前点検・月次締め・レセプト確定</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEM_MODES.map((mode) => {
              const notProhibited = allowsClaimFinalization(mode);
              return (
                <tr key={mode} data-mode={mode}>
                  <th scope="row">
                    <DomainStatusBadge
                      query={{ domain: "system-mode", key: mode }}
                    />
                  </th>
                  <td data-mode-guard={notProhibited ? "not-prohibited" : "prohibited"}>
                    {notProhibited
                      ? "モードガード上は未禁止(実行可否は別ゲートで停止中)"
                      : "不可"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 指定業務日の受付件数(保存済み実データ)
 * ------------------------------------------------------------------ */

export interface ReceptionSummaryViewState {
  /** 取得を試みている業務日。 */
  readonly requestedDate: string;
  readonly phase: "loading" | "ready" | "error";
  /** 直近に取得できた集計。再取得の失敗で消さない。 */
  readonly loaded: ReceptionSummaryResponse | null;
  readonly notice: ErrorNoticeProps | null;
}

/** この集計が何であって何でないかの定型。締め対象件数と読み替えさせない。 */
export const RECEPTION_SUMMARY_SCOPE_NOTE =
  "指定日の受付件数（保存済み実データ）です。締め対象件数・請求件数・提出件数ではありません。";

export function ReceptionSummaryView({
  state,
}: {
  readonly state: ReceptionSummaryViewState;
}) {
  const { requestedDate, phase, loaded, notice } = state;
  return (
    <section
      aria-label="指定業務日の受付件数"
      aria-busy={phase === "loading"}
      data-reception-summary={phase}
    >
      <p className="operator-empty-copy">{RECEPTION_SUMMARY_SCOPE_NOTE}</p>
      <p role="status">
        {loaded === null
          ? `${requestedDate} の受付件数はまだ表示していません。`
          : `${loaded.date} の保存済み受付データを表示しています。`}
        {phase === "loading" ? `（${requestedDate} を取得中です）` : null}
        {phase === "error" && loaded !== null
          ? `（${requestedDate} の再取得に失敗したため、表示は更新していません）`
          : null}
      </p>

      {phase === "loading" && loaded === null ? (
        <LoadingState label="受付件数を取得しています…" />
      ) : null}

      {loaded !== null ? (
        <>
          <KeyValueList
            items={[
              { label: "業務日", value: loaded.date },
              { label: "受付件数（合計）", value: `${loaded.totalCount} 件` },
            ]}
          />
          <TableScroll label="受付状態別の件数">
            <table className="operator-table operator-table-dense">
              <caption className="visually-hidden">
                {loaded.date} の受付状態別件数
              </caption>
              <thead>
                <tr>
                  <th scope="col">受付状態</th>
                  <th scope="col">件数</th>
                </tr>
              </thead>
              <tbody>
                {loaded.byReceptionStatus.map((row) => (
                  <tr key={row.status} data-status={row.status}>
                    <th scope="row">
                      <DomainStatusBadge
                        query={{ domain: "reception", key: row.status }}
                      />
                    </th>
                    <td>{row.count} 件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      ) : null}

      {notice !== null ? <ErrorNotice {...notice} /> : null}
    </section>
  );
}

export function ClosingReceptionSummary() {
  const [date, setDate] = useState(todayAsIsoDate);
  // date は入力値、request は実際に取得を試みた要求。attempt は同一業務日の再取得を可能にする。
  const [request, setRequest] = useState<{
    readonly date: string;
    readonly attempt: number;
  }>(() => ({ date, attempt: 0 }));
  const [state, setState] = useState<ReceptionSummaryViewState>({
    requestedDate: date,
    phase: "loading",
    loaded: null,
    notice: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const requestedDate = request.date;
    setState((prev) => ({
      requestedDate,
      phase: "loading",
      loaded: prev.loaded,
      notice: null,
    }));
    fetchReceptionSummary({ date: requestedDate, signal: controller.signal })
      .then((summary) => {
        if (!active) return;
        setState({
          requestedDate,
          phase: "ready",
          loaded: summary,
          notice: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState((prev) => ({
          requestedDate,
          phase: "error",
          loaded: prev.loaded,
          notice: toOperationsNotice(error),
        }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [request]);

  return (
    <div className="operator-stack">
      <form
        className="filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setRequest((prev) => ({ date, attempt: prev.attempt + 1 }));
        }}
      >
        <label>
          業務日（患者情報は表示しません）
          <input
            type="date"
            className="operator-input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="operator-inline-actions">
          <button type="submit" className="operator-button" data-kind="secondary">
            この業務日で集計
          </button>
        </div>
      </form>
      <ReceptionSummaryView state={state} />
    </div>
  );
}
