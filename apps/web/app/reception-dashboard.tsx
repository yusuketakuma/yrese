"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
  type ReceptionStatus,
} from "@yrese/contracts";
import { permissionScope, type PermissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "./api-transport";
import {
  type PatientContextData,
  useOptionalPatientContext,
} from "./components/patient-context";
import { RECEPTION_STATUS_LABELS as RECEPTION_STATUS_LABELS_SSOT } from "./status/visual-status-registry";
import { DomainStatusBadge } from "./components/domain-status-badge";
import { EmptyState } from "./components/empty-state";
import { registeredErrorCodeOrUndefined } from "./components/error-code";
import { ErrorNotice, type ErrorNoticeProps } from "./components/error-notice";
import { LoadingState } from "./components/loading-state";
import { devTenantHeaders } from "./dev-tenant";

/**
 * 受付ダッシュボード(WP-3009-UI / SCR-001)。
 *
 * 契約の正本は @yrese/contracts(API-006 v0.2.0)。契約外フィールドを仮定しない。
 * 日付は常に明示指定で API へ送る(暗黙の現在時刻をサーバーに解決させない —
 * ブラウザの今日は UI 層の既定値にすぎない)。
 * 受付状態は RECEPTION_STATUSES のテキストラベルで表示(色非依存、UIX-001 P-20)。
 */

/**
 * 受付状態の表示ラベル。文言の正本は Visual Status Registry(RECEPTION_STATUS_LABELS)、
 * 状態値の正本は shared-kernel の RECEPTION_STATUSES。既存 export 互換のため同名で再エクスポートする。
 */
export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> =
  RECEPTION_STATUS_LABELS_SSOT;

const PRESCRIPTION_INTAKE_LABELS: Record<
  ReceptionQueueEntry["prescriptionIntakeType"],
  string
> = { paper: "紙" };
const RECEPTION_QUEUE_DEV_SCOPES = [
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const satisfies readonly PermissionScope[];
const RECEPTION_CREATE_DEV_SCOPES = [
  permissionScope("reception", "write"),
  permissionScope("patient", "read"),
] as const satisfies readonly PermissionScope[];

/** API エラーを「何が起きたか+次のアクション」の対として運ぶ(WP-3007 統一様式) */
export class ReceptionError extends Error {
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

async function extractErrorCode(res: Response): Promise<string | undefined> {
  const body: unknown = await res.json().catch(() => null);
  const raw =
    typeof body === "object" && body !== null && "errorCode" in body
      ? (body as { errorCode: unknown }).errorCode
      : undefined;
  // registry 未登録/形式外のコードは表示しない(異常値の verbatim 出力防止)
  return registeredErrorCodeOrUndefined(raw);
}

export async function fetchReceptionQueue(
  date: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ReceptionQueueResponse> {
  const params = new URLSearchParams({ date });
  const url = resolveWebApiUrl(`/reception/queue?${params}`);
  const res = await fetchImpl(url, {
    headers: devTenantHeaders(RECEPTION_QUEUE_DEV_SCOPES),
    cache: "no-store",
    ...(signal !== undefined ? { signal } : {}),
  });
  if (!res.ok) {
    const errorCode = await extractErrorCode(res);
    if (res.status === 403) {
      throw new ReceptionError(
        "権限がありません。",
        "管理者に権限(reception:read / patient:read)の付与状況を確認してください。",
        errorCode,
      );
    }
    if (res.status === 400) {
      throw new ReceptionError(
        "日付の指定が不正です。",
        "日付(YYYY-MM-DD)を確認して再表示してください。",
        errorCode,
      );
    }
    throw new ReceptionError(
      `受付一覧の取得に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
      errorCode,
    );
  }
  if (res.status !== 200) {
    throw new ReceptionError(
      `受付一覧の取得に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
    );
  }
  const parsed = receptionQueueResponseSchema.parse(await res.json());
  if (parsed.date !== date) {
    const notice = queueResponseDateMismatchNotice();
    throw new ReceptionError(notice.message, notice.nextAction);
  }
  const receptionIds = new Set<string>();
  for (const entry of parsed.entries) {
    if (receptionIds.has(entry.receptionId)) {
      throw new Error("Reception queue response contains duplicate reception identities");
    }
    receptionIds.add(entry.receptionId);
  }
  const compareUtcIsoInstants = (left: string, right: string): number => {
    const leftSecond = left.slice(0, 19);
    const rightSecond = right.slice(0, 19);
    if (leftSecond !== rightSecond) return leftSecond < rightSecond ? -1 : 1;

    const leftFraction = left[19] === "." ? left.slice(20, -1) : "";
    const rightFraction = right[19] === "." ? right.slice(20, -1) : "";
    const width = Math.max(leftFraction.length, rightFraction.length);
    const normalizedLeft = leftFraction.padEnd(width, "0");
    const normalizedRight = rightFraction.padEnd(width, "0");
    if (normalizedLeft === normalizedRight) return 0;
    return normalizedLeft < normalizedRight ? -1 : 1;
  };
  const entries = [...parsed.entries].sort((left, right) => {
    const acceptedAtOrder = compareUtcIsoInstants(left.acceptedAt, right.acceptedAt);
    if (acceptedAtOrder !== 0) return acceptedAtOrder;
    if (left.receptionId === right.receptionId) return 0;
    return left.receptionId < right.receptionId ? -1 : 1;
  });
  return { ...parsed, entries };
}

export async function createReception(
  patientIdValue: string,
  fetchImpl: typeof fetch = fetch,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<ReceptionQueueEntry> {
  const url = resolveWebApiUrl("/reception");
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...devTenantHeaders(RECEPTION_CREATE_DEV_SCOPES),
    },
    cache: "no-store",
    body: JSON.stringify({ patientId: patientIdValue, idempotencyKey }),
  });
  if (!res.ok) {
    const errorCode = await extractErrorCode(res);
    if (res.status === 409) {
      throw new ReceptionError(
        "同じ操作キーが別の患者で再利用されました(二重操作の可能性)。",
        "受付一覧を更新して受付状況を確認してください。解消しない場合はシステム管理者へ連絡してください。",
        errorCode,
      );
    }
    if (res.status === 404) {
      throw new ReceptionError(
        "指定した患者がこの薬局に見つかりません。",
        "患者検索画面で受付対象の患者を選択し直してください。",
        errorCode,
      );
    }
    if (res.status === 403) {
      throw new ReceptionError(
        "権限がありません。",
        "管理者に権限(reception:write / patient:read)の付与状況を確認してください。",
        errorCode,
      );
    }
    if (res.status === 400) {
      throw new ReceptionError(
        "受付内容が不正です。",
        "患者検索画面で受付対象の患者を選択し直してから、再度受付してください。",
        errorCode,
      );
    }
    throw new ReceptionError(
      `受付の登録に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      errorCode,
    );
  }
  if (res.status !== 200 && res.status !== 201) {
    throw new Error("Reception response used an unsupported success status");
  }
  const parsed = receptionQueueEntrySchema.parse(await res.json());
  if (parsed.patient.patientId !== patientIdValue) {
    throw new Error("Reception response patient identity mismatch");
  }
  if (res.status === 201 && parsed.receptionStatus !== "WAITING") {
    throw new Error("Created reception response did not start in WAITING status");
  }
  return parsed;
}

export function formatAcceptedTime(acceptedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(acceptedAt));
}

export function ReceptionQueueTable({
  entries,
}: {
  readonly entries: readonly ReceptionQueueEntry[];
}) {
  return (
    <div className="table-scroll">
      <table className="reception-queue">
        <thead>
          <tr>
            <th scope="col">受付時刻</th>
            <th scope="col">患者番号</th>
            <th scope="col">氏名(カナ)</th>
            <th scope="col">生年月日</th>
            <th scope="col">受付状態</th>
            <th scope="col">処方箋</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.receptionId}>
              <td>{formatAcceptedTime(entry.acceptedAt)}</td>
              <td>{entry.patient.patientNumber}</td>
              <td>
                <span className="patient-kana">{entry.patient.kana}</span>
                <span className="patient-name">{entry.patient.name}</span>
              </td>
              <td>{entry.patient.birthDate}</td>
              <td>
                <DomainStatusBadge
                  query={{ domain: "reception", key: entry.receptionStatus }}
                />
              </td>
              <td>{PRESCRIPTION_INTAKE_LABELS[entry.prescriptionIntakeType]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function queueLoadErrorNotice(error: unknown): ErrorNoticeProps {
  return error instanceof ReceptionError
    ? error.toNotice()
    : {
        message: "受付一覧の処理に失敗しました。",
        nextAction:
          "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      };
}

function queueResponseDateMismatchNotice(): ErrorNoticeProps {
  return {
    message: "受付一覧の応答日付が要求日付と一致しません。",
    nextAction:
      "表示日付を確認して再表示してください。解消しない場合はシステム管理者へ連絡してください。",
  };
}

export interface ReceptionQueueRunner {
  (targetDate: string): Promise<void>;
  cancelActive(): void;
}

export function createReceptionQueueRunner(
  fetcher: (
    targetDate: string,
    signal: AbortSignal,
  ) => Promise<ReceptionQueueResponse>,
  emit: (update: QueueStateUpdate) => void,
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

  const run: ReceptionQueueRunner = (targetDate) => {
    if (isCancelling) {
      return Promise.resolve();
    }
    if (latestFlight?.targetDate === targetDate) {
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
      emit((prev) => {
        if (gen !== generation) return prev;
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

export function createReceptionDashboardLifecycle() {
  let mounted = false;
  return {
    isMounted: () => mounted,
    mount() {
      mounted = true;
    },
    unmount() {
      mounted = false;
    },
  };
}

/**
 * Runs at most one reception registration flight at a time.
 * The rendered disabled state is user feedback; this synchronous lock is the
 * correctness boundary for re-entrant submits before React commits a render.
 */
export function createReceptionRegistrationRunner() {
  let running = false;
  return {
    isRunning: () => running,
    async run(operation: () => Promise<void>): Promise<boolean> {
      if (running) {
        return false;
      }
      running = true;
      try {
        await operation();
        return true;
      } finally {
        running = false;
      }
    },
  };
}

export function registrationPatientChangeNotice(
  currentPatientId: string | undefined,
  submittedPatientId: string,
  outcome: "success" | "failure",
): ErrorNoticeProps | null {
  if (currentPatientId === submittedPatientId) {
    return null;
  }
  return outcome === "success"
    ? {
        severity: "WARNING",
        message: "受付処理中に選択患者が変更されました。",
        nextAction:
          "登録結果に表示された患者と受付一覧を確認してから、次の操作へ進んでください。",
      }
    : {
        severity: "WARNING",
        message: "選択患者の変更前に開始した受付処理が完了しませんでした。",
        nextAction:
          "変更前の患者が受付済みか受付一覧で確認し、不明な場合は再登録せずシステム管理者へ連絡してください。",
      };
}

export function createReceptionQueueTargetTracker(initialTarget: string) {
  let target = initialTarget;
  return {
    current: () => target,
    mark(nextTarget: string) {
      target = nextTarget;
    },
  };
}

export function ReceptionQueueView({ state }: { readonly state: QueueState }) {
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
        <ReceptionQueueTable entries={state.response.entries} />
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

/**
 * 受付業務日付の UI 既定値(JST 固定 — WP-4053)。
 * toISOString() は UTC 日付になり JST 00:00〜08:59 に前日を返すため使わない。
 * 業務日付のタイムゾーン規律は MOD-011 改版(WP-4053)が正本。
 */
export function todayAsIsoDate(now: Date = new Date()): string {
  // sv-SE ロケールは YYYY-MM-DD 形式を返す
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * URL の ?date= から業務日付(YYYY-MM-DD)を取り出す(監査 S-03)。
 * 共有・復元してよいのは PHI を含まない業務日付のみ。患者検索クエリ(氏名等)は
 * PHI がブラウザ履歴・リファラ・ログに残るため URL へ永続しない(意図的な除外)。
 */
export function parseDateParam(search: string): string | undefined {
  const value = new URLSearchParams(search).get("date");
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  // 実在日付か(2026-02-31 等はロールオーバーするため Y-M-D の往復一致で弾く)
  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value;
}

export function ReceptionDashboard() {
  const patientContext = useOptionalPatientContext();
  const selectedPatient = patientContext?.patient ?? null;
  const [date, setDate] = useState(todayAsIsoDate);
  const [queue, setQueue] = useState<QueueState>({ kind: "loading" });
  const [registerNotice, setRegisterNotice] = useState<ErrorNoticeProps | null>(null);
  const [registered, setRegistered] = useState<ReceptionQueueEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedPatientIdRef = useRef<string | undefined>(selectedPatient?.patientId);
  selectedPatientIdRef.current = selectedPatient?.patientId;
  const loadRunner = useRef<ReturnType<typeof createReceptionQueueRunner> | null>(
    null,
  );
  const lifecycleRef = useRef<ReturnType<
    typeof createReceptionDashboardLifecycle
  > | null>(null);
  const registrationRunner = useRef<ReturnType<
    typeof createReceptionRegistrationRunner
  > | null>(null);
  const queueTargetTrackerRef = useRef<ReturnType<
    typeof createReceptionQueueTargetTracker
  > | null>(null);
  if (registrationRunner.current === null) {
    registrationRunner.current = createReceptionRegistrationRunner();
  }
  if (lifecycleRef.current === null) {
    lifecycleRef.current = createReceptionDashboardLifecycle();
  }
  if (queueTargetTrackerRef.current === null) {
    queueTargetTrackerRef.current = createReceptionQueueTargetTracker(date);
  }
  const queueTargetTracker = queueTargetTrackerRef.current;
  const lifecycle = lifecycleRef.current;

  const load = useCallback(async (targetDate: string) => {
    if (!lifecycle.isMounted()) return;
    queueTargetTracker.mark(targetDate);
    if (loadRunner.current === null) {
      loadRunner.current = createReceptionQueueRunner(
        (requestedDate, signal) =>
          fetchReceptionQueue(requestedDate, fetch, signal),
        (update) => setQueue((prev) => update(prev)),
      );
    }
    if (!lifecycle.isMounted()) return;
    // 業務日付(非PHI)を URL に反映して共有・リロード復元を可能にする(監査 S-03)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("date", targetDate);
      window.history.replaceState(null, "", url);
    }
    if (!lifecycle.isMounted()) return;
    await loadRunner.current(targetDate);
  }, []);

  useEffect(() => {
    lifecycle.mount();
    // 初回のみ URL の ?date= を復元。以降は明示の「表示」操作で反映する
    const fromUrl =
      typeof window !== "undefined" ? parseDateParam(window.location.search) : undefined;
    if (fromUrl !== undefined && fromUrl !== date) {
      setDate(fromUrl);
    }
    void load(fromUrl ?? date);
    return () => {
      lifecycle.unmount();
      loadRunner.current?.cancelActive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // A result or error for the previous patient must never remain beside a newly
    // selected patient. In-flight submissions retain their captured identity and
    // are handled explicitly below.
    setRegistered(null);
    setRegisterNotice(null);
  }, [selectedPatient?.patientId]);

  const register = useCallback(async () => {
    const runner = registrationRunner.current;
    if (runner === null || runner.isRunning()) {
      return;
    }
    const submittedPatientId = selectedPatient?.patientId;
    if (submittedPatientId === undefined) {
      setRegistered(null);
      setRegisterNotice({
        severity: "WARNING",
        message: "受付対象の患者が選択されていません。",
        nextAction: "患者検索画面で患者を特定し、業務対象として選択してください。",
      });
      return;
    }
    await runner.run(async () => {
      setRegistered(null);
      setSubmitting(true);
      setRegisterNotice(null);
      try {
        const entry = await createReception(submittedPatientId);
        if (!lifecycle.isMounted()) return;
        setRegistered(entry);
        const patientChangeNotice = registrationPatientChangeNotice(
          selectedPatientIdRef.current,
          submittedPatientId,
          "success",
        );
        if (patientChangeNotice !== null) {
          setRegisterNotice(patientChangeNotice);
        }
        await load(queueTargetTracker.current());
      } catch (error) {
        if (!lifecycle.isMounted()) return;
        const patientChangeNotice = registrationPatientChangeNotice(
          selectedPatientIdRef.current,
          submittedPatientId,
          "failure",
        );
        setRegisterNotice(
          patientChangeNotice ??
            (error instanceof ReceptionError
              ? error.toNotice()
              : {
                  message: "受付の処理に失敗しました。",
                  nextAction:
                    "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
                }),
        );
      } finally {
        if (lifecycle.isMounted()) {
          setSubmitting(false);
        }
      }
    });
  }, [selectedPatient?.patientId, lifecycle, load, queueTargetTracker]);

  return (
    <section aria-label="受付ダッシュボード">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(date);
        }}
      >
        <label>
          表示日付
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="submit">表示</button>
      </form>

      <ReceptionRegistrationForm
        patient={selectedPatient}
        submitting={submitting}
        onSubmit={register}
      />
      {registerNotice !== null && <ErrorNotice {...registerNotice} />}
      {registered !== null && (
        <p role="status">
          受付を登録しました: {registered.patient.kana} {registered.patient.name}(
          {RECEPTION_STATUS_LABELS[registered.receptionStatus]})
        </p>
      )}

      <ReceptionQueueView state={queue} />
    </section>
  );
}

export function ReceptionRegistrationForm({
  patient,
  submitting,
  onSubmit,
}: {
  readonly patient: PatientContextData | null;
  readonly submitting: boolean;
  readonly onSubmit: () => void | Promise<void>;
}) {
  return (
    <form
      className="reception-registration-form"
      aria-label="受付登録"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <h3>受付登録</h3>
      {patient === null ? (
        <p className="reception-registration-empty" role="status">
          受付対象の患者を選択してください。<a href="/patients">患者検索へ</a>
        </p>
      ) : (
        <div className="reception-registration-target">
          <span className="reception-registration-label">受付対象</span>
          <span className="patient-kana">{patient.kana}</span>
          <strong className="patient-name">{patient.name}</strong>
          <span className="patient-birth">{patient.birthDate}</span>
        </div>
      )}
      <button type="submit" disabled={submitting || patient === null}>
        {submitting ? "登録中…" : "この患者を受付登録"}
      </button>
    </form>
  );
}
