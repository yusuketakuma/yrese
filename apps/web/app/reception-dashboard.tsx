"use client";

import { useCallback, useEffect, useState } from "react";

import {
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
  type ReceptionStatus,
} from "@yrese/contracts";
import { isValidErrorCode } from "@yrese/shared-kernel";

import { EmptyState } from "./components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "./components/error-notice";
import { LoadingState } from "./components/loading-state";
import { API_BASE, devTenantHeaders } from "./patients/patient-search";

/**
 * 受付ダッシュボード(WP-3009-UI / SCR-001)。
 *
 * 契約の正本は @yrese/contracts(API-006 v0.2.0)。契約外フィールドを仮定しない。
 * 日付は常に明示指定で API へ送る(暗黙の現在時刻をサーバーに解決させない —
 * ブラウザの今日は UI 層の既定値にすぎない)。
 * 受付状態は RECEPTION_STATUSES のテキストラベルで表示(色非依存、UIX-001 P-20)。
 */

/** 受付状態の表示ラベル(値の正本は shared-kernel の RECEPTION_STATUSES) */
export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> = {
  WAITING: "待機中",
  IN_PROGRESS: "対応中",
  COMPLETED: "完了",
  CANCELLED: "取消済み",
};

const PRESCRIPTION_INTAKE_LABELS = { paper: "紙" } as const;

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
  // registry 形式外のコードは表示しない(異常値の verbatim 出力防止)
  return typeof raw === "string" && isValidErrorCode(raw) ? raw : undefined;
}

export async function fetchReceptionQueue(
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReceptionQueueResponse> {
  const params = new URLSearchParams({ date });
  const res = await fetchImpl(`${API_BASE}/reception/queue?${params}`, {
    headers: devTenantHeaders(),
    cache: "no-store",
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
  return receptionQueueResponseSchema.parse(await res.json());
}

export async function createReception(
  patientIdValue: string,
  fetchImpl: typeof fetch = fetch,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<ReceptionQueueEntry> {
  const res = await fetchImpl(`${API_BASE}/reception`, {
    method: "POST",
    headers: { "content-type": "application/json", ...devTenantHeaders() },
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
        "患者検索画面で患者IDを確認してください。",
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
        "患者IDを確認して再度受付してください。",
        errorCode,
      );
    }
    throw new ReceptionError(
      `受付の登録に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      errorCode,
    );
  }
  return receptionQueueEntrySchema.parse(await res.json());
}

export function formatAcceptedTime(acceptedAt: string): string {
  return new Date(acceptedAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReceptionQueueTable({
  entries,
}: {
  readonly entries: readonly ReceptionQueueEntry[];
}) {
  return (
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
              <span data-status={entry.receptionStatus}>
                {RECEPTION_STATUS_LABELS[entry.receptionStatus]}
              </span>
            </td>
            <td>{PRESCRIPTION_INTAKE_LABELS[entry.prescriptionIntakeType]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type QueueState =
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | { kind: "loaded"; response: ReceptionQueueResponse };

export function ReceptionQueueView({ state }: { readonly state: QueueState }) {
  if (state.kind === "loading") {
    return <LoadingState label="受付一覧を読み込み中…" />;
  }
  if (state.kind === "error") {
    return <ErrorNotice {...state.notice} />;
  }
  if (state.response.entries.length === 0) {
    return <EmptyState message={`${state.response.date} の受付はまだありません。`} />;
  }
  return (
    <>
      <p role="status">
        {state.response.date} の受付: {state.response.entries.length}件
      </p>
      <ReceptionQueueTable entries={state.response.entries} />
    </>
  );
}

function todayAsIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReceptionDashboard() {
  const [date, setDate] = useState(todayAsIsoDate);
  const [queue, setQueue] = useState<QueueState>({ kind: "loading" });
  const [registerPatientId, setRegisterPatientId] = useState("");
  const [registerNotice, setRegisterNotice] = useState<ErrorNoticeProps | null>(null);
  const [registered, setRegistered] = useState<ReceptionQueueEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (targetDate: string) => {
    setQueue({ kind: "loading" });
    try {
      const response = await fetchReceptionQueue(targetDate);
      setQueue({ kind: "loaded", response });
    } catch (error) {
      setQueue({
        kind: "error",
        notice:
          error instanceof ReceptionError
            ? error.toNotice()
            : {
                message: "受付一覧の処理に失敗しました。",
                nextAction:
                  "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
              },
      });
    }
  }, []);

  useEffect(() => {
    void load(date);
    // 初回表示のみ。日付変更は明示の「表示」操作で反映する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(async () => {
    const trimmed = registerPatientId.trim();
    setRegistered(null);
    if (trimmed.length === 0) {
      setRegisterNotice({
        severity: "WARNING",
        message: "患者IDが入力されていません。",
        nextAction: "患者検索画面で患者を特定し、患者IDを入力してください。",
      });
      return;
    }
    setSubmitting(true);
    setRegisterNotice(null);
    try {
      const entry = await createReception(trimmed);
      setRegistered(entry);
      setRegisterPatientId("");
      await load(date);
    } catch (error) {
      setRegisterNotice(
        error instanceof ReceptionError
          ? error.toNotice()
          : {
              message: "受付の処理に失敗しました。",
              nextAction:
                "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
            },
      );
    } finally {
      setSubmitting(false);
    }
  }, [registerPatientId, date, load]);

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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void register();
        }}
      >
        <label>
          患者ID
          <input
            type="text"
            value={registerPatientId}
            onChange={(event) => setRegisterPatientId(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={submitting}>
          受付登録
        </button>
      </form>
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
