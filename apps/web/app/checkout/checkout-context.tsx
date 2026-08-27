"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  PrescriptionDraftResponse,
  ReceptionStatus,
} from "@yrese/contracts";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import { Panel, StatusPill, TableScroll } from "../components/operator-ui";
import { useOptionalPatientContext } from "../components/patient-context";
import { loadPrescriptionDraft } from "../prescriptions/prescription-draft-persistence";
import {
  ReceptionError,
  fetchReceptionQueue,
  formatAcceptedTime,
  todayAsIsoDate,
} from "../reception-dashboard";

/**
 * 会計画面(SCR-016)の実接続部。
 *
 * 算定・請求・薬価・帳票は RB-008 / MST-001 / UIX-001 §12.3 / SCR-018 で停止しているため、
 * この領域は「既に実在する API の実応答」だけを表示する:
 *   - GET /reception/queue?date= (API-006) を選択患者で絞り込んだ受付
 *   - GET /prescription-drafts/by-reception/:receptionId の保存済み **行数と版のみ**
 *
 * 行数は「サーバーに保存済みである」という事実であり、算定結果ではない。
 * 薬剤名・用法・日数は会計画面へ持ち込まない(患者臨床データの不要な露出を作らない)。
 */

/** 保存済み処方下書きの要約。行数と版のみで、処方内容そのものは保持しない。 */
export type CheckoutDraftSummary =
  | { readonly kind: "saved"; readonly rowCount: number; readonly version: number }
  | { readonly kind: "absent" }
  | { readonly kind: "unavailable" };

export interface CheckoutReceptionSummary {
  readonly receptionId: string;
  readonly receptionStatus: ReceptionStatus;
  /** JST 固定の受付時刻(HH:MM)。 */
  readonly acceptedTime: string;
  readonly businessDate: string;
  readonly draft: CheckoutDraftSummary;
}

export type CheckoutContextState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly receptions: readonly CheckoutReceptionSummary[] }
  | { readonly kind: "error"; readonly notice: ErrorNoticeProps };

const GENERIC_CHECKOUT_CONTEXT_ERROR = Object.freeze({
  message: "選択患者の受付と処方下書きの保存状態を取得できませんでした。",
  nextAction:
    "業務日を確認して再表示してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
} satisfies ErrorNoticeProps);

/** 下書き取得の結果を要約へ落とす。1件の失敗が他の受付行を汚染しないようにする。 */
export function toDraftSummary(
  result: PromiseSettledResult<PrescriptionDraftResponse | null> | undefined,
): CheckoutDraftSummary {
  if (result === undefined || result.status === "rejected") {
    return { kind: "unavailable" };
  }
  if (result.value === null) return { kind: "absent" };
  return {
    kind: "saved",
    rowCount: result.value.draft.rows.length,
    version: result.value.version,
  };
}

/** 表セルの文言。未取得を「未保存」「0行」と読ませない。 */
export function describeDraftSummary(draft: CheckoutDraftSummary): string {
  switch (draft.kind) {
    case "saved":
      return `サーバー保存済み ${draft.rowCount}行（版 v${draft.version}）`;
    case "absent":
      return "この受付の処方下書きは未保存です";
    case "unavailable":
      return "処方下書きの保存状態を取得できません（未保存・0行を意味しません）";
  }
}

/**
 * 選択患者の受付と、その受付の保存済み処方下書き要約を取得する。
 * 受付キューの取得失敗は throw(画面全体を ErrorNotice にする)。
 * 個々の下書き取得失敗は行単位の unavailable へ縮退させる。
 */
export async function loadCheckoutReceptions(
  input: { readonly patientId: string; readonly businessDate: string },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<readonly CheckoutReceptionSummary[]> {
  const queue = await fetchReceptionQueue(input.businessDate, fetchImpl, signal);
  const entries = queue.entries.filter(
    (entry) => entry.patient.patientId === input.patientId,
  );
  const drafts = await Promise.allSettled(
    entries.map((entry) =>
      loadPrescriptionDraft(
        {
          receptionId: entry.receptionId,
          patientId: input.patientId,
          businessDate: input.businessDate,
        },
        fetchImpl,
        signal,
      ),
    ),
  );
  return entries.map((entry, index) => ({
    receptionId: entry.receptionId,
    receptionStatus: entry.receptionStatus,
    acceptedTime: formatAcceptedTime(entry.acceptedAt),
    businessDate: input.businessDate,
    draft: toDraftSummary(drafts[index]),
  }));
}

export function checkoutContextNotice(error: unknown): ErrorNoticeProps {
  return error instanceof ReceptionError
    ? error.toNotice()
    : GENERIC_CHECKOUT_CONTEXT_ERROR;
}

const PANEL_TITLE = "この患者の受付と保存済み処方下書き";

/**
 * 患者未選択では会計の患者固有業務を開始させない。
 * 入力 UI を描画せず、患者検索への導線だけを出す。
 */
function CheckoutPatientUnselected() {
  return (
    <Panel
      className="live-surface-panel"
      title={PANEL_TITLE}
      description="患者を選択すると、受付APIと処方下書きAPIの実応答だけを表示します。"
    >
      <EmptyState message="業務対象の患者が選択されていません。会計は患者単位の業務のため、患者を選択するまで受付・処方下書きの照会も会計操作も開始しません。" />
      <Link className="operator-text-action" href="/patients">
        患者検索を開く
      </Link>
    </Panel>
  );
}

function CheckoutReceptionContextForPatient({
  patientId,
  patientName,
}: {
  readonly patientId: string;
  readonly patientName: string;
}) {
  const [businessDate, setBusinessDate] = useState(todayAsIsoDate);
  const [state, setState] = useState<CheckoutContextState>({ kind: "loading" });

  useEffect(() => {
    if (businessDate === "") {
      setState({ kind: "ready", receptions: [] });
      return;
    }
    const controller = new AbortController();
    setState({ kind: "loading" });
    loadCheckoutReceptions({ patientId, businessDate }, fetch, controller.signal)
      .then((receptions) => {
        if (controller.signal.aborted) return;
        setState({ kind: "ready", receptions });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", notice: checkoutContextNotice(error) });
      });
    return () => {
      controller.abort();
    };
  }, [patientId, businessDate]);

  return (
    <Panel
      className="live-surface-panel"
      title={PANEL_TITLE}
      description="受付API・処方下書きAPIの実応答のみを表示します。点数・金額・薬剤名は含みません。"
      actions={<StatusPill tone="info">既存受付API・処方下書きAPI配線</StatusPill>}
    >
      <section
        aria-label="選択患者の受付と処方下書きの保存状態"
        {...(state.kind === "loading" ? { "aria-busy": true } : {})}
      >
        <div className="filter-grid">
          <label htmlFor="checkout-business-date">
            照会する業務日
            <input
              id="checkout-business-date"
              className="operator-input"
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
            />
          </label>
        </div>
        <p className="operator-empty-copy" role="status">
          表示対象: 選択患者 {patientName}、業務日{" "}
          {businessDate === "" ? "未指定" : businessDate} の認証済み受付キュー。
          受付IDは手入力せず、認証済み受付キューから取得しています。
        </p>

        {state.kind === "loading" ? (
          <LoadingState label="選択患者の受付と処方下書きの保存状態を取得しています…" />
        ) : null}

        {state.kind === "error" ? (
          <ErrorNotice severity="ERROR" {...state.notice} />
        ) : null}

        {state.kind === "ready" && state.receptions.length === 0 ? (
          <EmptyState
            message={
              businessDate === ""
                ? "業務日が指定されていないため照会していません。照会する業務日を指定してください。"
                : "指定した業務日の認証済み受付キューに、この患者の受付はありません。受付が未登録・別業務日・取得不能のいずれかです。会計対象が0件であることを意味しません。"
            }
          />
        ) : null}

        {state.kind === "ready" && state.receptions.length > 0 ? (
          <TableScroll label="選択患者の受付と処方下書きの保存状態">
            <table className="operator-table operator-table-dense">
              <caption className="operator-table-caption">
                受付API の実応答と、その受付にサーバー保存済みの処方下書きの行数・版。
                行数は保存済みであることを示すだけで、算定結果ではありません。
              </caption>
              <thead>
                <tr>
                  <th scope="col">受付ID</th>
                  <th scope="col">受付状態</th>
                  <th scope="col">受付時刻（JST）</th>
                  <th scope="col">業務日</th>
                  <th scope="col">処方下書きの保存状態</th>
                </tr>
              </thead>
              <tbody>
                {state.receptions.map((reception) => (
                  <tr key={reception.receptionId}>
                    <td>{reception.receptionId}</td>
                    <td>
                      <DomainStatusBadge
                        query={{ domain: "reception", key: reception.receptionStatus }}
                      />
                    </td>
                    <td>{reception.acceptedTime}</td>
                    <td>{reception.businessDate}</td>
                    <td>{describeDraftSummary(reception.draft)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : null}
      </section>
    </Panel>
  );
}

/**
 * 会計画面の実接続パネル。患者切替では key で再生成し、
 * 前患者の結果・エラー・in-flight 応答を持ち越さない。
 */
export function CheckoutReceptionContext() {
  const patient = useOptionalPatientContext()?.patient ?? null;
  if (patient === null) return <CheckoutPatientUnselected />;
  return (
    <CheckoutReceptionContextForPatient
      key={patient.patientId}
      patientId={patient.patientId}
      patientName={patient.name}
    />
  );
}
