"use client";

import { useState } from "react";

import {
  RECEPTION_BUSINESS_REASON_CODE_PATTERN,
  type ReceptionQueueEntry,
  type ReceptionTransitionTarget,
} from "@yrese/contracts";

import { ConfirmationDialog } from "./components/confirmation-dialog";
import { ErrorNotice, type ErrorNoticeProps } from "./components/error-notice";
import {
  transitionReception,
  trustedReceptionErrorNotice,
} from "./reception-dashboard";

/**
 * 受付キュー行の状態遷移操作(WP-7201 / API-006 0.3.1)。
 *
 * 遷移表(DOM-004 §2)の許可遷移だけを提示する:
 *   WAITING → 対応開始(IN_PROGRESS)/ 取消(CANCELLED)
 *   IN_PROGRESS → 完了(COMPLETED)/ 取消(CANCELLED)
 *   終端(COMPLETED/CANCELLED)では操作を表示しない。
 * UIX-001 の二段階確認: 実行前に ConfirmationDialog で対象患者を再提示する。
 * 取消は構造化理由コード(MOD-008)の選択を必須とし、自由記述入力は提供しない。
 * 成功・409(版競合/遷移不許可)のいずれでも呼び出し側へ通知し、
 * 一覧を force reload して最新の version/状態へ収束させる。
 */

const TRANSITION_ACTION_LABELS: Record<ReceptionTransitionTarget, string> = {
  IN_PROGRESS: "対応開始",
  COMPLETED: "完了",
  CANCELLED: "取消",
};

/** DOM-004 §2 の許可遷移に対応する行操作。順序は操作頻度ではなく遷移表の列挙順。 */
const TRANSITION_ACTIONS_BY_STATUS: Record<
  ReceptionQueueEntry["receptionStatus"],
  readonly ReceptionTransitionTarget[]
> = {
  WAITING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const TRANSITION_CONFIRM_MESSAGES: Record<ReceptionTransitionTarget, string> = {
  IN_PROGRESS: "この受付を対応中にします。よろしいですか。",
  COMPLETED: "この受付を完了にします。完了後は状態を戻せません。",
  CANCELLED: "この受付を取消します。取消後は状態を戻せません。",
};

/**
 * 取消理由の構造化コード(MOD-008 の businessReason.code 規律)。
 * コード集合の正本が SSOT に未登録のため、wire 契約が許す範囲で運用上の
 * 最小集合をここに固定する。自由記述は禁止(監査要件)。
 */
export const RECEPTION_CANCEL_REASON_OPTIONS = [
  { code: "PATIENT_REQUEST", label: "患者都合" },
  { code: "WRONG_PATIENT", label: "患者取り違え" },
  { code: "DUPLICATE_RECEPTION", label: "受付重複" },
  { code: "OTHER", label: "その他" },
] as const satisfies readonly { code: string; label: string }[];

const genericTransitionErrorNotice: ErrorNoticeProps = {
  message: "受付の状態変更に失敗しました。",
  nextAction: "受付一覧を更新して最新の状態を確認してください。",
};

export function ReceptionTransitionActions({
  entry,
  onChanged,
  submit = (target, reason, signal) =>
    transitionReception(entry, target, reason, fetch, signal),
}: {
  readonly entry: ReceptionQueueEntry;
  /** 遷移確定・409 収束など、一覧再読込が必要になったときに呼ばれる。 */
  readonly onChanged: () => void;
  readonly submit?: (
    to: ReceptionTransitionTarget,
    businessReason: string | undefined,
    signal: AbortSignal,
  ) => Promise<unknown>;
}) {
  const [pending, setPending] = useState<ReceptionTransitionTarget | null>(null);
  const [reasonCode, setReasonCode] = useState<string>(
    RECEPTION_CANCEL_REASON_OPTIONS[0].code,
  );
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<ErrorNoticeProps | null>(null);

  const actions = TRANSITION_ACTIONS_BY_STATUS[entry.receptionStatus];
  if (actions.length === 0) {
    return null;
  }

  const patientLabel = `${entry.patient.name}(患者番号 ${entry.patient.patientNumber})`;
  const reasonValid =
    pending !== "CANCELLED" ||
    RECEPTION_BUSINESS_REASON_CODE_PATTERN.test(reasonCode);

  const confirm = async () => {
    if (pending === null || submitting) return;
    if (pending === "CANCELLED" && !reasonValid) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await submit(
        pending,
        pending === "CANCELLED" ? reasonCode : undefined,
        AbortSignal.timeout(30_000),
      );
      setPending(null);
      onChanged();
    } catch (error) {
      setNotice(
        trustedReceptionErrorNotice(error) ?? genericTransitionErrorNotice,
      );
      // 409 系(版競合・遷移不許可)は一覧を最新へ収束させる
      setPending(null);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reception-transition-actions">
      <div className="operator-inline-actions">
        {actions.map((target) => (
          <button
            key={target}
            type="button"
            className="operator-button"
            data-kind={target === "CANCELLED" ? "secondary" : "primary"}
            data-transition={target}
            disabled={submitting}
            aria-label={`${TRANSITION_ACTION_LABELS[target]}: ${patientLabel}`}
            onClick={() => {
              setNotice(null);
              setPending(target);
            }}
          >
            {TRANSITION_ACTION_LABELS[target]}
          </button>
        ))}
      </div>
      {notice !== null && <ErrorNotice {...notice} />}
      <ConfirmationDialog
        open={pending !== null}
        title={
          pending === null
            ? "受付の状態変更"
            : `受付を${TRANSITION_ACTION_LABELS[pending]}にする`
        }
        patientLabel={patientLabel}
        message={
          pending === null ? "" : TRANSITION_CONFIRM_MESSAGES[pending]
        }
        confirmLabel={submitting ? "実行中…" : "実行する"}
        onCancel={() => {
          if (!submitting) setPending(null);
        }}
        onConfirm={() => void confirm()}
      >
        {pending === "CANCELLED" ? (
          <label className="confirmation-dialog-reason">
            取消理由
            <select
              className="operator-input"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              {RECEPTION_CANCEL_REASON_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </ConfirmationDialog>
    </div>
  );
}
