import type { ErrorSeverity } from "@yrese/shared-kernel";

import { SEVERITY_PRESENTATION } from "../status/visual-status-registry";

/**
 * 確認ダイアログ群(UIX-001 P-11 破壊的・確定・承認操作の二段階確認)。
 *
 * 安全含意: ワンクリック実行を禁止し、対象患者・影響を再提示してから確定させる。
 * 患者取り違え防止のため、対象患者ラベルを必ず再確認できるようにする(H-01/H-02)。
 *
 * 本コンポーネントは表示骨格(open で制御)。focus trap・Escape・復帰などの相互作用は
 * 呼び出し側(client)が担う。ここでは role=dialog / aria-modal と明示ラベルを保証する。
 * PHI をログ・計測へ渡さない。
 */
export interface ConfirmationDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  /** 対象患者の再提示ラベル(取り違え防止)。任意。 */
  readonly patientLabel?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export function ConfirmationDialog(props: ConfirmationDialogProps) {
  if (!props.open) {
    return null;
  }
  return (
    <div
      className="confirmation-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      data-open="true"
    >
      <div className="confirmation-dialog-panel">
        <h2 className="confirmation-dialog-title">{props.title}</h2>
        {props.patientLabel && (
          <p className="confirmation-dialog-patient">対象患者: {props.patientLabel}</p>
        )}
        <p className="confirmation-dialog-message">{props.message}</p>
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel">
            {props.cancelLabel ?? "キャンセル"}
          </button>
          <button type="button" className="confirmation-dialog-confirm">
            {props.confirmLabel ?? "確定する"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 破壊的操作ダイアログ。ConfirmationDialog に重大度の明示と影響説明を加える。
 * 既定の severity は WARNING。取消不能な操作は severity=CRITICAL/BLOCKER を渡す。
 */
export interface DestructiveActionDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  /** この操作の影響(取消不能・波及範囲など)。 */
  readonly impact: string;
  readonly patientLabel?: string;
  readonly severity?: ErrorSeverity;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export function DestructiveActionDialog(props: DestructiveActionDialogProps) {
  if (!props.open) {
    return null;
  }
  const severity = props.severity ?? "WARNING";
  const presentation = SEVERITY_PRESENTATION[severity];
  return (
    <div
      className="destructive-action-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-label={props.title}
      data-open="true"
      data-severity={severity}
      data-tone={presentation.tone}
    >
      <div className="destructive-action-panel">
        <h2 className="destructive-action-title">
          <span aria-hidden="true">{presentation.shape}</span> {props.title}
        </h2>
        {props.patientLabel && (
          <p className="destructive-action-patient">対象患者: {props.patientLabel}</p>
        )}
        <p className="destructive-action-message">{props.message}</p>
        <p className="destructive-action-impact">影響: {props.impact}</p>
        <div className="destructive-action-actions">
          <button type="button" className="destructive-action-cancel">
            {props.cancelLabel ?? "キャンセル"}
          </button>
          <button type="button" className="destructive-action-confirm">
            {props.confirmLabel ?? "実行する"}
          </button>
        </div>
      </div>
    </div>
  );
}
