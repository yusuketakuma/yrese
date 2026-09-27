"use client";

import {
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
} from "@yrese/contracts";
import { type EligibilityStatus } from "@yrese/shared-kernel";

import { DomainStatusBadge } from "./components/domain-status-badge";
import { EmptyState } from "./components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "./components/error-notice";
import { LoadingState } from "./components/loading-state";
import {
  MetricCard,
  MetricGrid,
  StatusPill,
  TableScroll,
} from "./components/operator-ui";
import { ReceptionPrescriptionHandoffAction } from "./reception-prescription-handoff";
import { ReceptionTransitionActions } from "./reception-transition-action";
import {
  PRESCRIPTION_INTAKE_LABELS,
  RECEPTION_STATUS_LABELS,
  fetchReceptionQueue,
  genericQueueErrorNotice,
  queueResponseDateMismatchNotice,
  queuePermissionDeniedFailures,
  trustedReceptionErrorNotice,
} from "./reception-api";
import { formatAcceptedTime } from "./reception-time";

export function ReceptionQueueTable({
  entries,
  businessDate,
  selectedPatientId,
  onReceptionChanged,
}: {
  readonly entries: readonly ReceptionQueueEntry[];
  readonly businessDate?: string;
  readonly selectedPatientId?: string | undefined;
  /** 遷移確定・409 収束時に呼ばれる一覧再読込フック(WP-7201)。 */
  readonly onReceptionChanged?: () => void;
}) {
  return (
    <TableScroll label="受付キュー表。横方向にスクロールできます">
      <table className="operator-table">
        {businessDate !== undefined ? (
          <caption className="operator-table-caption">
            {businessDate} の受付キュー
          </caption>
        ) : null}
        <thead>
          <tr>
            <th scope="col">受付時刻</th>
            <th scope="col">患者番号</th>
            <th scope="col">氏名(カナ)</th>
            <th scope="col">生年月日</th>
            <th scope="col">受付状態</th>
            <th scope="col">資格</th>
            <th scope="col">処方箋</th>
            {businessDate !== undefined ? <th scope="col">次の操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isSelected = entry.patient.patientId === selectedPatientId;
            return (
              <tr
                key={entry.receptionId}
                {...(isSelected
                  ? { "data-selected": "true", "aria-selected": "true" }
                  : {})}
              >
                <td>{formatAcceptedTime(entry.acceptedAt)}</td>
                <td>{entry.patient.patientNumber}</td>
                <td>
                  <span className="patient-kana">{entry.patient.kana}</span>
                  <span className="patient-name">{entry.patient.name}</span>
                  {isSelected ? <StatusPill tone="info">選択中</StatusPill> : null}
                </td>
                <td>{entry.patient.birthDate}</td>
                <td>
                  <DomainStatusBadge
                    query={{ domain: "reception", key: entry.receptionStatus }}
                  />
                </td>
                <td>
                  <DomainStatusBadge
                    query={{
                      domain: "reception-eligibility",
                      key: entry.eligibility.state,
                    }}
                  />
                </td>
                <td>{PRESCRIPTION_INTAKE_LABELS[entry.prescriptionIntakeType]}</td>
                {businessDate !== undefined ? (
                  <td>
                    {onReceptionChanged !== undefined ? (
                      <ReceptionTransitionActions
                        entry={entry}
                        onChanged={onReceptionChanged}
                      />
                    ) : null}
                    <ReceptionPrescriptionHandoffAction
                      entry={entry}
                      businessDate={businessDate}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

export type QueueState =
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | {
      kind: "loaded";
      response: ReceptionQueueResponse;
      loadedAt?: string;
      refreshState: QueueRefreshState;
    };

export type QueueRefreshState =
  | { kind: "idle" }
  | { kind: "loading"; requestTarget: string }
  | { kind: "error"; requestTarget: string; notice: ErrorNoticeProps };

type QueueStateUpdate = (prev: QueueState) => QueueState;

/**
 * 受付 snapshot の資格状態を患者要約用 EligibilityStatus へ射影する(WP-7204)。
 * PatientHeader 等の患者級コンポーネントが受付文脈で使う場合の単一正本。
 * EXPIRED/MISMATCH など請求不可の終端は PENDING_REVERIFY に潰さず扱いたいが、
 * 患者級 enum には対応値がないため最も近い「再確認必須」に寄せる。
 */
export function receptionEligibilityToPatientStatus(
  state: ReceptionQueueEntry["eligibility"]["state"],
): EligibilityStatus {
  switch (state) {
    case "VERIFIED_MYNA":
    case "VERIFIED_CARD":
      return "VERIFIED";
    case "UNVERIFIED":
      return "NOT_CHECKED";
    default:
      return "PENDING_REVERIFY";
  }
}

/**
 * 受付キュー実データからの真実集計。CANCELLED は稼働指標に数えない。
 * 資格要確認は取消済みを除く受付 snapshot が VERIFIED_MYNA / VERIFIED_CARD でない件数
 * (WP-7204。患者要約の eligibilityStatus ではなく受付単位の資格状態で数える)。
 */
export interface ReceptionQueueMetrics {
  readonly waiting: number;
  readonly inProgress: number;
  readonly completed: number;
  readonly eligibilityAttention: number;
}

export function receptionQueueMetrics(
  entries: readonly ReceptionQueueEntry[],
): ReceptionQueueMetrics {
  let waiting = 0;
  let inProgress = 0;
  let completed = 0;
  let eligibilityAttention = 0;
  for (const entry of entries) {
    if (entry.receptionStatus === "WAITING") waiting += 1;
    else if (entry.receptionStatus === "IN_PROGRESS") inProgress += 1;
    else if (entry.receptionStatus === "COMPLETED") completed += 1;
    // 資格要確認は受付 snapshot 由来(WP-7204)。VERIFIED_* 以外は要対応として数える。
    if (
      entry.receptionStatus !== "CANCELLED" &&
      entry.eligibility.state !== "VERIFIED_MYNA" &&
      entry.eligibility.state !== "VERIFIED_CARD"
    ) {
      eligibilityAttention += 1;
    }
  }
  return { waiting, inProgress, completed, eligibilityAttention };
}

export function ReceptionQueueMetricsView({
  state,
}: {
  readonly state: QueueState;
}) {
  if (state.kind === "loading") {
    return (
      <MetricGrid>
        <MetricCard label={RECEPTION_STATUS_LABELS.WAITING} value="…" unit="件" detail="キュー取得中" tone="accent" icon="受" />
        <MetricCard label={RECEPTION_STATUS_LABELS.IN_PROGRESS} value="…" unit="件" detail="キュー取得中" tone="info" icon="進" />
        <MetricCard label="資格要確認" value="…" unit="件" detail="キュー取得中" tone="warning" icon="資" />
        <MetricCard label={RECEPTION_STATUS_LABELS.COMPLETED} value="…" unit="件" detail="キュー取得中" tone="neutral" icon="済" />
      </MetricGrid>
    );
  }
  if (state.kind === "error") {
    return (
      <MetricGrid>
        <MetricCard label={RECEPTION_STATUS_LABELS.WAITING} value="—" unit="件" detail="キュー取得失敗" tone="accent" icon="受" />
        <MetricCard label={RECEPTION_STATUS_LABELS.IN_PROGRESS} value="—" unit="件" detail="キュー取得失敗" tone="info" icon="進" />
        <MetricCard label="資格要確認" value="—" unit="件" detail="キュー取得失敗" tone="warning" icon="資" />
        <MetricCard label={RECEPTION_STATUS_LABELS.COMPLETED} value="—" unit="件" detail="キュー取得失敗" tone="neutral" icon="済" />
      </MetricGrid>
    );
  }
  const metrics = receptionQueueMetrics(state.response.entries);
  const detail = `${state.response.date} の受付キューから集計`;
  return (
    <MetricGrid>
      <MetricCard label={RECEPTION_STATUS_LABELS.WAITING} value={String(metrics.waiting)} unit="件" detail={detail} tone="accent" icon="受" />
      <MetricCard label={RECEPTION_STATUS_LABELS.IN_PROGRESS} value={String(metrics.inProgress)} unit="件" detail={detail} tone="info" icon="進" />
      <MetricCard label="資格要確認" value={String(metrics.eligibilityAttention)} unit="件" detail={detail} tone="warning" icon="資" />
      <MetricCard label={RECEPTION_STATUS_LABELS.COMPLETED} value={String(metrics.completed)} unit="件" detail={detail} tone="neutral" icon="済" />
    </MetricGrid>
  );
}

function queueLoadErrorNotice(error: unknown): ErrorNoticeProps {
  return trustedReceptionErrorNotice(error) ?? genericQueueErrorNotice;
}

export interface ReceptionQueueRunner {
  (targetDate: string, options?: { readonly force?: boolean }): Promise<void>;
  cancelActive(): void;
}

export function createReceptionQueueRunner(
  fetcher: (
    targetDate: string,
    signal: AbortSignal,
  ) => Promise<ReceptionQueueResponse>,
  emit: (update: QueueStateUpdate) => void,
  onPermissionDenied?: () => void,
): ReceptionQueueRunner {
  let generation = 0;
  let latestFlight:
    | {
        readonly targetDate: string;
        readonly ownerToken: object;
        readonly sharedPromise: Promise<void>;
        readonly controller?: AbortController;
      }
    | undefined;
  let isCancelling = false;

  const run: ReceptionQueueRunner = (targetDate, options) => {
    if (isCancelling) {
      return Promise.resolve();
    }
    // force 時は join しない。mutation直後の再読込がmutation前に開始した
    // in-flight fetch へ join すると、登録結果を含まない一覧を最新表示する。
    if (latestFlight?.targetDate === targetDate && options?.force !== true) {
      return latestFlight.sharedPromise;
    }

    const previousFlight = latestFlight;
    const ownerToken = {};
    const controller = new AbortController();
    let resolveShared!: () => void;
    let rejectShared!: (reason?: unknown) => void;
    const sharedPromise = new Promise<void>((resolve, reject) => {
      resolveShared = resolve;
      rejectShared = reject;
    });
    const gen = ++generation;
    latestFlight = { targetDate, ownerToken, sharedPromise, controller };
    previousFlight?.controller?.abort();

    const execute = async () => {
      if (gen !== generation) return;
      emit((prev) => {
        if (gen !== generation) return prev;
        return prev.kind === "loaded"
          ? {
              ...prev,
              refreshState: { kind: "loading", requestTarget: targetDate },
            }
          : { kind: "loading" };
      });
      if (gen !== generation) return;

      let outcome:
        | { readonly kind: "success"; readonly response: ReceptionQueueResponse }
        | { readonly kind: "failure"; readonly error: unknown };
      try {
        outcome = {
          kind: "success",
          response: await fetcher(targetDate, controller.signal),
        };
      } catch (error) {
        outcome = { kind: "failure", error };
      }
      if (gen !== generation) return;

      // The request has settled, so a re-entrant replacement must not abort its
      // completed signal. Keep the shared flight joinable until terminal emit settles.
      if (latestFlight?.ownerToken === ownerToken) {
        latestFlight = { targetDate, ownerToken, sharedPromise };
      }
      if (gen !== generation) return;

      if (outcome.kind === "success") {
        const response = outcome.response;
        if (response.date !== targetDate) {
          const notice = queueResponseDateMismatchNotice();
          emit((prev) => {
            if (gen !== generation) return prev;
            return prev.kind === "loaded"
              ? {
                  ...prev,
                  refreshState: {
                    kind: "error",
                    requestTarget: targetDate,
                    notice,
                  },
                }
              : { kind: "error", notice };
          });
          return;
        }
        // 最終取得時刻(JST)。古い一覧を最新と誤認させない(監査 S-02)
        emit((prev) =>
          gen === generation
            ? {
                kind: "loaded",
                response,
                loadedAt: formatAcceptedTime(new Date().toISOString()),
                refreshState: { kind: "idle" },
              }
            : prev,
        );
        return;
      }

      const notice = queueLoadErrorNotice(outcome.error);
      const permissionDenied =
        typeof outcome.error === "object" &&
        outcome.error !== null &&
        queuePermissionDeniedFailures.has(outcome.error);
      if (permissionDenied) onPermissionDenied?.();
      emit((prev) => {
        if (gen !== generation) return prev;
        if (permissionDenied) return { kind: "error", notice };
        return prev.kind === "loaded"
          ? {
              ...prev,
              refreshState: { kind: "error", requestTarget: targetDate, notice },
            }
          : { kind: "error", notice };
      });
    };

    const cleanupOwner = () => {
      if (latestFlight?.ownerToken === ownerToken) {
        latestFlight = undefined;
      }
    };
    void execute().then(
      () => {
        cleanupOwner();
        resolveShared();
      },
      (error: unknown) => {
        cleanupOwner();
        rejectShared(error);
      },
    );
    return sharedPromise;
  };

  run.cancelActive = () => {
    if (isCancelling) return;
    isCancelling = true;
    try {
      generation += 1;
      const previousFlight = latestFlight;
      latestFlight = undefined;
      previousFlight?.controller?.abort();
    } finally {
      isCancelling = false;
    }
  };

  return run;
}
export function ReceptionQueueView({
  state,
  selectedPatientId,
  onReceptionChanged,
}: {
  readonly state: QueueState;
  readonly selectedPatientId?: string | undefined;
  readonly onReceptionChanged?: () => void;
}) {
  if (state.kind === "loading") {
    return <LoadingState label="受付一覧を読み込み中…" />;
  }
  if (state.kind === "error") {
    return <ErrorNotice {...state.notice} />;
  }
  const retainedSource = `${state.response.date}${
    state.loadedAt !== undefined ? ` (最終取得: ${state.loadedAt}(JST))` : ""
  }`;
  const refreshing = state.refreshState.kind !== "idle";
  const content =
    state.response.entries.length === 0 ? (
      refreshing ? (
        <div className="empty-state">
          {state.response.date} の受付はまだありません。
        </div>
      ) : (
        <EmptyState message={`${state.response.date} の受付はまだありません。`} />
      )
    ) : (
      <>
        <p {...(!refreshing ? { role: "status" } : {})}>
          {state.response.date} の受付: {state.response.entries.length}件
        </p>
        {state.loadedAt !== undefined && (
          <p className="queue-last-updated">最終取得: {state.loadedAt}(JST)</p>
        )}
        <ReceptionQueueTable
          entries={state.response.entries}
          businessDate={state.response.date}
          selectedPatientId={selectedPatientId}
          {...(onReceptionChanged !== undefined
            ? { onReceptionChanged }
            : {})}
        />
      </>
    );
  return (
    <>
      {state.refreshState.kind === "loading" && (
        <p role="status">
          {state.refreshState.requestTarget} の受付一覧を取得中です。{retainedSource}
          {" "}の内容を表示しています。
        </p>
      )}
      {state.refreshState.kind === "error" && (
        <>
          <p role="status">
            {state.refreshState.requestTarget} の受付一覧を取得できなかったため、
            {retainedSource}{" "}の内容を表示しています。
          </p>
          <ErrorNotice {...state.refreshState.notice} />
        </>
      )}
      {content}
    </>
  );
}
