"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ReceptionQueueEntry,
} from "@yrese/contracts";

import { ErrorNotice, type ErrorNoticeProps } from '../components/error-notice';
import {
  type PatientContextData,
  useOptionalPatientContext,
} from '../components/patient/patient-context';
import {
  RECEPTION_STATUS_LABELS,
  fetchReceptionQueue,
  genericRegistrationErrorNotice,
  trustedReceptionErrorNotice,
} from './reception-api';
import {
  ReceptionQueueMetricsView,
  ReceptionQueueView,
  createReceptionQueueRunner,
  type QueueState,
} from './reception-queue';
import {
  ReceptionRegistrationForm,
  createReceptionDashboardLifecycle,
  createReceptionIdempotencyKeyStore,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  registrationPatientChangeNotice,
  submitReceptionRegistration,
  subscribeReceptionQueueRefreshOnVisible,
} from './reception-registration';
import { parseDateParam, todayAsIsoDate } from './reception-time';

export * from './reception-api';
export * from './reception-time';
export * from './reception-queue';
export * from './reception-registration';

/**
 * 受付ダッシュボード(WP-3009-UI / SCR-001)。
 *
 * 契約の正本は @yrese/contracts(API-006 v0.2.0)。契約外フィールドを仮定しない。
 * 日付は常に明示指定で API へ送る(暗黙の現在時刻をサーバーに解決させない —
 * ブラウザの今日は UI 層の既定値にすぎない)。
 * 受付状態は RECEPTION_STATUSES のテキストラベルで表示(色非依存、UIX-001 P-20)。
 * 受付登録は retryable な create であり、冪等キーは「未解決の登録意図」ごとに固定する
 * (DEVELOPMENT_POLICY §6)。応答喪失後の再試行はサーバー側の同一受付へ収束させ、
 * 受付を二重に作らない。
 */


/**
 * 表示日付 submit ボタンの役割明示(WP-5212-1)。typed date が既に表示中のキューと
 * 同じなら、この操作は新しい日付の取得ではなく再読み込みであることをラベルで示す。
 */
export function receptionDashboardDisplayButtonLabel(
  queue: QueueState,
  date: string,
): string {
  return queue.kind === "loaded" && queue.response.date === date
    ? "再読み込み"
    : "表示";
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
  const idempotencyKeyStoreRef = useRef<ReturnType<
    typeof createReceptionIdempotencyKeyStore
  > | null>(null);
  if (registrationRunner.current === null) {
    registrationRunner.current = createReceptionRegistrationRunner();
  }
  if (idempotencyKeyStoreRef.current === null) {
    idempotencyKeyStoreRef.current = createReceptionIdempotencyKeyStore();
  }
  const idempotencyKeyStore = idempotencyKeyStoreRef.current;
  if (lifecycleRef.current === null) {
    lifecycleRef.current = createReceptionDashboardLifecycle();
  }
  if (queueTargetTrackerRef.current === null) {
    queueTargetTrackerRef.current = createReceptionQueueTargetTracker(date);
  }
  const queueTargetTracker = queueTargetTrackerRef.current;
  const lifecycle = lifecycleRef.current;

  const load = useCallback(
    async (targetDate: string, options?: { readonly force?: boolean }) => {
      if (!lifecycle.isMounted()) return;
      queueTargetTracker.mark(targetDate);
      if (loadRunner.current === null) {
        loadRunner.current = createReceptionQueueRunner(
          (requestedDate, signal) =>
            fetchReceptionQueue(requestedDate, fetch, signal),
          (update) => setQueue((prev) => update(prev)),
          () => {
            setRegistered(null);
            setRegisterNotice(null);
          },
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
      await loadRunner.current(targetDate, options);
    },
    [],
  );

  useEffect(() => {
    lifecycle.mount();
    // 初回のみ URL の ?date= を復元。以降は明示の「表示」操作で反映する
    const fromUrl =
      typeof window !== "undefined" ? parseDateParam(window.location.search) : undefined;
    if (fromUrl !== undefined && fromUrl !== date) {
      setDate(fromUrl);
    }
    void load(fromUrl ?? date);
    const unsubscribeVisibilityRefresh =
      subscribeReceptionQueueRefreshOnVisible(
        document,
        queueTargetTracker,
        (targetDate) => void load(targetDate),
      );
    return () => {
      unsubscribeVisibilityRefresh();
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

  /**
   * 遷移確定・409 収束後の一覧再読込(WP-7201)。in-flight fetch への join を
   * 避けるため force を必ず付ける(create と同じ規律)。
   */
  const handleReceptionChanged = useCallback(() => {
    void load(queueTargetTracker.current(), { force: true });
  }, [load, queueTargetTracker]);

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
        // 冪等キーは「未解決の登録意図」ごとに固定する(再試行で再生成しない)。
        const entry = await submitReceptionRegistration(
          submittedPatientId,
          idempotencyKeyStore,
        );
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
        await load(queueTargetTracker.current(), { force: true });
      } catch (error) {
        if (!lifecycle.isMounted()) return;
        const patientChangeNotice = registrationPatientChangeNotice(
          selectedPatientIdRef.current,
          submittedPatientId,
          "failure",
        );
        setRegisterNotice(
          patientChangeNotice ??
            trustedReceptionErrorNotice(error) ??
            genericRegistrationErrorNotice,
        );
      } finally {
        if (lifecycle.isMounted()) {
          setSubmitting(false);
        }
      }
    });
  }, [
    selectedPatient?.patientId,
    lifecycle,
    load,
    queueTargetTracker,
    idempotencyKeyStore,
  ]);

  return (
    <section aria-label="受付ダッシュボード">
      <ReceptionQueueMetricsView state={queue} />
      <form
        className="filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void load(date);
        }}
      >
        <label>
          表示日付
          <input
            className="operator-input"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="operator-inline-actions">
          <button type="submit" className="operator-button" data-kind="secondary">
            {receptionDashboardDisplayButtonLabel(queue, date)}
          </button>
        </div>
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

      <ReceptionQueueView
        state={queue}
        selectedPatientId={selectedPatient?.patientId}
        onReceptionChanged={handleReceptionChanged}
      />
    </section>
  );
}

