"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { OutboxSummaryResponse } from "@yrese/contracts";

import {
  fetchOutboxSummary,
  toOperationsNotice,
  type OperationsRequestOptions,
} from "../api/operations-client";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import {
  KeyValueList,
  MetricCard,
  MetricGrid,
  Panel,
  TableScroll,
  type OperatorTone,
} from "../components/operator-ui";
import { checkedAtLabel } from "./cloud-health-card";

/**
 * outbox 配送状況ボード(SCR-025 実データ配線)。
 *
 * 原資料は migrations/000005 + 000007 の `outbox_events`(payload は識別子のみで
 * PHI 非含有)であり、`GET /operations/outbox-summary` が返すのは件数・時刻・
 * イベント種別だけである。ここに出る件数は「受付登録が outbox intent を残したか」
 * の実測であって、外部サービスへ到達したこと・同期が正常であることは意味しない。
 *
 * 取得できない値は 0 ではなく「—」と理由で示す。とくに `legacyOrphanCount` は
 * 契約上「導出できたときにだけ存在する」ため、省略されている場合を 0 件と描画しない。
 */

export type OutboxBoardState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly summary: OutboxSummaryResponse;
      readonly loadedAt: string;
    }
  | { readonly kind: "error"; readonly notice: ErrorNoticeProps }
  /** 再取得に失敗したが前回値は残っている状態。現在値として読ませない。 */
  | {
      readonly kind: "stale";
      readonly summary: OutboxSummaryResponse;
      readonly loadedAt: string;
      readonly notice: ErrorNoticeProps;
    };

export type OutboxLoadResult =
  | { readonly ok: true; readonly summary: OutboxSummaryResponse; readonly loadedAt: string }
  | { readonly ok: false; readonly notice: ErrorNoticeProps };

/** 1回分の取得結果。表示状態への畳み込みは mergeOutboxLoad が担う(純関数)。 */
export async function loadOutboxSummaryResult(
  options?: OperationsRequestOptions,
  now: () => Date = () => new Date(),
): Promise<OutboxLoadResult> {
  try {
    const summary = await fetchOutboxSummary(options);
    return { ok: true, summary, loadedAt: now().toISOString() };
  } catch (error) {
    return { ok: false, notice: toOperationsNotice(error) };
  }
}

/** 失敗しても前回値を捨てない。前回値が無いときだけ error(値なし)へ落とす。 */
export function mergeOutboxLoad(
  previous: OutboxBoardState,
  result: OutboxLoadResult,
): OutboxBoardState {
  if (result.ok) {
    return { kind: "ready", summary: result.summary, loadedAt: result.loadedAt };
  }
  if (previous.kind === "ready" || previous.kind === "stale") {
    return {
      kind: "stale",
      summary: previous.summary,
      loadedAt: previous.loadedAt,
      notice: result.notice,
    };
  }
  return { kind: "error", notice: result.notice };
}

function summaryOf(state: OutboxBoardState): OutboxSummaryResponse | undefined {
  return state.kind === "ready" || state.kind === "stale" ? state.summary : undefined;
}

/** 表示中の値がいつ時点のものかを必ず言う(古い値を現在値として読ませない)。 */
export function outboxAsOfLine(state: OutboxBoardState): string {
  if (state.kind === "loading") {
    return "outbox 集計を取得中です。表示できる値はまだありません。";
  }
  if (state.kind === "error") {
    return "outbox 集計を取得できていません。件数は表示していません(0件ではありません)。";
  }
  const at = checkedAtLabel(state.loadedAt);
  if (state.kind === "stale") {
    return `再取得に失敗したため、${at}に取得した前回値を表示しています。現在値ではありません。`;
  }
  return `${at}に取得した outbox 集計を表示しています。`;
}

export function outboxCountDisplay(
  state: OutboxBoardState,
  select: (summary: OutboxSummaryResponse) => number,
): { readonly value: string; readonly tone: OperatorTone } {
  if (state.kind === "loading") return { value: "…", tone: "neutral" };
  const summary = summaryOf(state);
  if (summary === undefined) return { value: "—", tone: "warning" };
  return {
    value: String(select(summary)),
    tone: state.kind === "stale" ? "warning" : "info",
  };
}

/** 滞留時間。負の差(時計ずれ)は 0 へ丸め、未来時刻を「滞留なし」と読ませない。 */
export function formatQueueDwell(fromIso: string, now: Date): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "—";
  const minutes = Math.max(0, Math.floor((now.getTime() - from) / 60_000));
  if (minutes < 1) return "1分未満";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return `${days > 0 ? `${days}日` : ""}${days > 0 || hours > 0 ? `${hours}時間` : ""}${rest}分`;
}

/**
 * 滞留時間は「取得時点(loadedAt)」を基準に出す。表示している as-of と同じ基準に
 * 揃えることで、画面を開いたまま経過した時間を現在値と誤読させない。
 */
export function outboxDwellDisplay(state: OutboxBoardState): {
  readonly value: string;
  readonly detail: string;
  readonly tone: OperatorTone;
} {
  if (state.kind === "loading") {
    return { value: "…", detail: "outbox 集計を取得しています", tone: "neutral" };
  }
  const summary = summaryOf(state);
  if (summary === undefined || state.kind === "error") {
    return {
      value: "—",
      detail: "outbox 集計を取得できていません。滞留なしを意味しません。",
      tone: "warning",
    };
  }
  const asOf = `${checkedAtLabel(state.loadedAt)}の値`;
  if (summary.oldestPendingCreatedAt !== undefined) {
    return {
      value: formatQueueDwell(summary.oldestPendingCreatedAt, new Date(state.loadedAt)),
      detail: `最古の未配送イベントの滞留時間(${asOf})。外部サービスへの到達可否は含みません。`,
      tone: "warning",
    };
  }
  if (summary.pendingCount === 0) {
    return {
      value: "未配送なし",
      detail: `未配送イベントは実測0件です(${asOf})。外部連携の成功を意味しません。`,
      tone: "info",
    };
  }
  return {
    value: "—",
    detail: `未配送 ${summary.pendingCount} 件がありますが、最古の発生時刻を取得できませんでした。滞留なしを意味しません。`,
    tone: "warning",
  };
}

/**
 * `legacyOrphanCount` はフィールドが省略され得る。省略を 0 件と描画すると
 * 「整合性が確認できない受付は存在しない」という未検証の主張になるため、
 * 省略時は必ず導出不能として示す。
 */
export function legacyOrphanDisplay(state: OutboxBoardState): {
  readonly value: string;
  readonly note: string;
} {
  const summary = summaryOf(state);
  if (summary === undefined) {
    return {
      value: "—",
      note: "outbox 集計を取得できていないため件数は不明です。0件ではありません。",
    };
  }
  if (summary.legacyOrphanCount === undefined) {
    return {
      value: "—（この構成では導出できません）",
      note: "現在のデータストア構成では、outbox intent を持たない既存受付の件数を導出していません。0件ではありません。",
    };
  }
  return {
    value: `${summary.legacyOrphanCount}件`,
    note: "受付・監査・outbox の整合性が確認できない受付の件数です。",
  };
}

export function OutboxBoardView({
  state,
  leadingMetrics,
  onReload,
}: {
  readonly state: OutboxBoardState;
  readonly leadingMetrics?: ReactNode;
  readonly onReload?: () => void;
}) {
  const summary = summaryOf(state);
  const pending = outboxCountDisplay(state, (value) => value.pendingCount);
  const delivered = outboxCountDisplay(state, (value) => value.deliveredCount);
  const dwell = outboxDwellDisplay(state);
  const orphan = legacyOrphanDisplay(state);

  return (
    <>
      <MetricGrid>
        {leadingMetrics}
        <MetricCard
          label="未配送イベント"
          value={pending.value}
          unit="件"
          detail="outbox に残り、まだ配送されていないイベントの実測数です。"
          tone={pending.tone}
          icon="送"
        />
        <MetricCard
          label="配送済みイベント"
          value={delivered.value}
          unit="件"
          detail="outbox 上で配送済みに遷移した件数です。相手側の受領確認ではありません。"
          tone={delivered.tone}
          icon="済"
        />
        <MetricCard
          label="最古の未配送イベント滞留"
          value={dwell.value}
          detail={dwell.detail}
          tone={dwell.tone}
          icon="滞"
        />
      </MetricGrid>

      <Panel
        className="live-surface-panel"
        title="outbox 配送状況（GET /operations/outbox-summary 実データ）"
        description="受付登録が残した outbox イベントの件数です。件数・時刻・イベント種別のみで、患者情報は含みません。外部サービスへ到達したことは意味しません。"
        actions={
          onReload !== undefined ? (
            <button
              type="button"
              className="operator-button"
              data-kind="secondary"
              onClick={onReload}
            >
              outbox 集計を再取得
            </button>
          ) : undefined
        }
      >
        <section
          aria-label="outbox 配送状況"
          {...(state.kind === "loading" ? { "aria-busy": "true" } : {})}
        >
          <p className="operator-empty-copy" role="status">
            {outboxAsOfLine(state)}
          </p>
          {state.kind === "loading" ? (
            <LoadingState label="outbox の配送状況を取得しています…" />
          ) : null}
          {state.kind === "error" || state.kind === "stale" ? (
            <ErrorNotice {...state.notice} />
          ) : null}
          {summary !== undefined ? (
            summary.byEventType.length === 0 ? (
              <EmptyState message="outbox にイベントは1件も登録されていません（実測0件）。未接続ではなく、記録された配送意図が無い状態です。" />
            ) : (
              <TableScroll label="イベント種別ごとの配送状況。横方向にスクロールできます">
                <table className="operator-table operator-table-dense">
                  <caption className="operator-table-caption">
                    イベント種別ごとの未配送・配送済み件数（実測値）
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">イベント種別</th>
                      <th scope="col">未配送</th>
                      <th scope="col">配送済み</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byEventType.map((row) => (
                      <tr key={row.eventType}>
                        <th scope="row">{row.eventType}</th>
                        <td>{row.pendingCount}件</td>
                        <td>{row.deliveredCount}件</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )
          ) : null}
          <KeyValueList
            items={[
              { label: "outbox intent を持たない既存受付", value: orphan.value },
            ]}
          />
          <p className="operator-empty-copy">{orphan.note}</p>
        </section>
      </Panel>
    </>
  );
}

export function OutboxBoard({
  leadingMetrics,
}: {
  readonly leadingMetrics?: ReactNode;
}) {
  const [state, setState] = useState<OutboxBoardState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadOutboxSummaryResult({ signal: controller.signal }).then((result) => {
      // 中断済み・アンマウント済みの応答は状態へ反映しない(前回値を壊さない)。
      if (active) setState((previous) => mergeOutboxLoad(previous, result));
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  return (
    <OutboxBoardView
      state={state}
      leadingMetrics={leadingMetrics}
      onReload={() => setReloadToken((token) => token + 1)}
    />
  );
}
