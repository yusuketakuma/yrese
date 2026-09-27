"use client";

import { type ReceptionQueueEntry } from "@yrese/contracts";

import { type ErrorNoticeProps } from "./components/error-notice";
import { type PatientContextData } from "./components/patient-context";
import {
  createReception,
  isSettledReceptionCreateFailure,
} from "./reception-api";

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

/** 受付登録 POST の応答待ち上限。超過は「結果不明」として扱い、再試行を可能にする。 */
export const RECEPTION_CREATE_TIMEOUT_MS = 30_000;

/**
 * 受付登録の冪等キー保持。
 *
 * `DEVELOPMENT_POLICY.md §6`: retryable な create は安定した idempotency key を
 * 持たなければならない。呼び出しごとに新しいキーを生成すると、応答喪失後の再試行が
 * サーバー側の冪等判定を素通りし、同一患者の受付を重複作成する。
 *
 * キーは「未解決の登録意図」を表す。同一患者への再試行では同じキーを再利用し、
 * 結果が確定したとき(登録成功、または 400 / 403 / 404 / 409)にだけ退役させる。
 * 結果不明の失敗(ネットワーク失敗・応答喪失・5xx・応答形式違反)では保持し続け、
 * 再試行がサーバー側の同一受付へ収束するようにする。
 *
 * 既知の境界: キーはこのタブのセッション内でのみ保持される。結果不明のまま
 * 再読込した場合は新しいキーになるため、UI は受付一覧での確認を案内する。
 */
export interface ReceptionIdempotencyKeyStore {
  keyFor(patientIdValue: string): string;
  retire(patientIdValue: string): void;
  hasPendingKey(patientIdValue: string): boolean;
}

export function createReceptionIdempotencyKeyStore(
  generateKey: () => string = () => crypto.randomUUID(),
): ReceptionIdempotencyKeyStore {
  const keys = new Map<string, string>();
  return {
    /** 未解決の登録意図があればそのキーを、なければ新しいキーを返す。 */
    keyFor(patientIdValue: string): string {
      const existing = keys.get(patientIdValue);
      if (existing !== undefined) {
        return existing;
      }
      const key = generateKey();
      keys.set(patientIdValue, key);
      return key;
    },
    /** 結果が確定した登録意図を退役させる(次回は新しい受付になる)。 */
    retire(patientIdValue: string): void {
      keys.delete(patientIdValue);
    },
    hasPendingKey(patientIdValue: string): boolean {
      return keys.has(patientIdValue);
    },
  };
}

export type ReceptionRegistrationSubmitter = (
  patientIdValue: string,
  idempotencyKey: string,
  signal: AbortSignal,
) => Promise<ReceptionQueueEntry>;

const defaultReceptionRegistrationSubmitter: ReceptionRegistrationSubmitter = (
  patientIdValue,
  idempotencyKey,
  signal,
) => createReception(patientIdValue, fetch, idempotencyKey, signal);

/**
 * 受付登録の1回の試行。冪等キーの寿命(取得・退役)をここに集約する。
 * 呼び出し側(UI)がキーを組み立てないことが、再試行で受付が重複しない根拠になる。
 */
export async function submitReceptionRegistration(
  patientIdValue: string,
  keyStore: ReceptionIdempotencyKeyStore,
  submit: ReceptionRegistrationSubmitter = defaultReceptionRegistrationSubmitter,
  timeoutMs: number = RECEPTION_CREATE_TIMEOUT_MS,
): Promise<ReceptionQueueEntry> {
  const idempotencyKey = keyStore.keyFor(patientIdValue);
  try {
    const entry = await submit(
      patientIdValue,
      idempotencyKey,
      AbortSignal.timeout(timeoutMs),
    );
    keyStore.retire(patientIdValue);
    return entry;
  } catch (error) {
    // 結果が確定した失敗だけキーを退役させる。結果不明なら保持し、
    // 再試行がサーバー側の同一受付へ収束するようにする。
    if (isSettledReceptionCreateFailure(error)) {
      keyStore.retire(patientIdValue);
    }
    throw error;
  }
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

export function subscribeReceptionQueueRefreshOnVisible(
  source: {
    readonly visibilityState: DocumentVisibilityState;
    addEventListener(type: "visibilitychange", listener: () => void): void;
    removeEventListener(type: "visibilitychange", listener: () => void): void;
  },
  targetTracker: ReturnType<typeof createReceptionQueueTargetTracker>,
  refresh: (targetDate: string) => void,
): () => void {
  let visible = source.visibilityState === "visible";
  const onVisibilityChange = () => {
    const wasVisible = visible;
    visible = source.visibilityState === "visible";
    if (visible && !wasVisible) refresh(targetTracker.current());
  };
  source.addEventListener("visibilitychange", onVisibilityChange);
  return () => source.removeEventListener("visibilitychange", onVisibilityChange);
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
      <h4>受付登録</h4>
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
