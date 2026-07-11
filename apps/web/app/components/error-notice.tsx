import type { ErrorSeverity } from "@yrese/shared-kernel";

import { SEVERITY_PRESENTATION } from "../status/visual-status-registry";
import { SeverityList } from "./severity-list";

/**
 * 画面共通のエラー表示領域(WP-3007 / SCR-013)。
 *
 * 「何が起きたか(message)」と「次に何をすべきか(nextAction)」を必ず対で表示する
 * (次アクションのないエラー表示を型で作らせない)。重要度表示は WP-3006 の
 * SeverityList を再利用し、テキストラベル必須・色非依存(UIX-001 §5)。
 * errorCode は error_code_registry に登録されたコードのみを渡す(独自コードを発明しない)。
 * PHI をエラーメッセージに含めてはならない。
 */

export interface ErrorNoticeProps {
  /** 重要度(UIX-001 §5)。省略時は ERROR */
  readonly severity?: ErrorSeverity;
  /** 登録済みエラーコード(AUTH-0003 等)。ローカル入力検証など該当コードがない場合は省略 */
  readonly errorCode?: string;
  /** 何が起きたか(業務語。PHI・技術詳細を含めない) */
  readonly message: string;
  /** 利用者が次に取るべきアクション */
  readonly nextAction: string;
}

export function ErrorNotice({
  severity = "ERROR",
  errorCode,
  message,
  nextAction,
}: ErrorNoticeProps) {
  const text =
    errorCode !== undefined ? `${message}(エラーコード: ${errorCode})` : message;
  // 重要度に応じて live region を使い分ける(§11.4-18)。CRITICAL/BLOCKER/ERROR は alert
  // (assertive 含意)、WARNING/INFO は status(polite 含意)にして警告過多を防ぐ。
  const role = SEVERITY_PRESENTATION[severity].ariaRole;
  return (
    <div
      className="error-notice"
      role={role}
      data-severity={severity}
      {...(errorCode !== undefined ? { "data-error-code": errorCode } : {})}
    >
      <SeverityList items={[{ severity, message: text }]} />
      <p className="error-notice-next-action">次のアクション: {nextAction}</p>
    </div>
  );
}
