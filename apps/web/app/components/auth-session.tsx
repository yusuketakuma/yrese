import type { SessionStatus } from "@yrese/shared-kernel";
import { requiresReauth } from "@yrese/shared-kernel";

import { SESSION_PRESENTATION } from "../status/visual-status-registry";

/**
 * 認証・セッション表示群(R-AUTH)。
 *
 * 安全含意(H-10): セッション失効の直前に警告し、入力中の記録を消失させない。失効時は
 * 未保存記録を保全し、再認証後に作業へ復帰できる導線を示す。医療情報システム安全管理GLの
 * 識別・認証(将来の二要素)を前提に UI を構成する。
 *
 * 注記: 実際の認証プロトコル(OIDC/Cognito 等)との接続は API/セキュリティ契約に従う。
 * 本モジュールは UI 状態と表示の骨格であり、認証処理そのものは実装しない(契約シーム)。
 * 認証情報(パスワード・トークン)をログ・計測・画面エラーへ出さない。
 */

/**
 * 有効期限と現在時刻からセッション状態を導出する(純粋関数・テスト可能)。
 * warnWithinMs 以内に失効するなら EXPIRING_SOON、超過なら EXPIRED。
 * 時刻はミリ秒 epoch で受け、実行環境のタイムゾーンに依存させない。
 */
export function computeSessionStatus(
  expiresAtMs: number,
  nowMs: number,
  warnWithinMs = 2 * 60 * 1000,
): SessionStatus {
  if (nowMs >= expiresAtMs) {
    return "EXPIRED";
  }
  if (expiresAtMs - nowMs <= warnWithinMs) {
    return "EXPIRING_SOON";
  }
  return "ACTIVE";
}

/**
 * セッション失効の事前警告(ACTIVE では何も出さない)。
 * EXPIRING_SOON は延長導線、EXPIRED/LOCKED は再認証導線を示す。
 * hasUnsavedWork のとき、未保存記録が保全される旨を明示する(H-10)。
 */
export interface SessionExpiryWarningProps {
  readonly status: SessionStatus;
  /** 失効までの残り目安(表示用文言。例: "あと1分")。 */
  readonly remainingLabel?: string;
  /** 未保存の入力があるか。あれば保全の明示を強める。 */
  readonly hasUnsavedWork?: boolean;
}

export function SessionExpiryWarning(props: SessionExpiryWarningProps) {
  if (props.status === "ACTIVE") {
    return null;
  }
  const presentation = SESSION_PRESENTATION[props.status];
  const reauth = requiresReauth(props.status);
  return (
    <section
      className="session-expiry-warning"
      data-session-status={props.status}
      role={presentation.ariaRole}
      aria-live={presentation.ariaLive}
    >
      <div className="session-expiry-header">
        <span className="session-expiry-shape" aria-hidden="true">
          {presentation.shape}
        </span>
        <span className="session-expiry-label">{presentation.label}</span>
        {props.remainingLabel && !reauth && (
          <span className="session-expiry-remaining">({props.remainingLabel})</span>
        )}
      </div>
      {props.hasUnsavedWork && (
        <p className="session-expiry-unsaved">
          入力中の内容は下書きとして保全されます。再認証後に作業を続けられます。
        </p>
      )}
      <div className="session-expiry-actions">
        {reauth ? (
          <span className="session-expiry-action">再度サインインしてください。</span>
        ) : (
          <span className="session-expiry-action">
            続ける場合はセッションを延長してください。
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * サインインフォーム(静的骨格)。
 * 実際の認証は Server Action / 認証基盤に委ねる(契約シーム — action は呼び出し側が渡す)。
 * error 文言に認証情報を含めない。二要素前提の導線は将来の認証SSOTに従い拡張する。
 */
export interface LoginFormProps {
  /** フォーム送信先(Server Action の URL 等)。未指定なら送信不可の骨格表示。 */
  readonly action?: string;
  /** 直近の認証失敗の一般化メッセージ(具体的な失敗理由・認証情報は含めない)。 */
  readonly errorMessage?: string;
}

export function LoginForm(props: LoginFormProps) {
  return (
    <form className="login-form" method="post" action={props.action} aria-label="サインイン">
      {props.errorMessage && (
        <p className="login-form-error" role="alert">
          {props.errorMessage}
        </p>
      )}
      <label className="login-form-field">
        <span>職員ID</span>
        <input type="text" name="staffId" autoComplete="username" required />
      </label>
      <label className="login-form-field">
        <span>パスワード</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <button type="submit" className="login-form-submit">
        サインイン
      </button>
    </form>
  );
}
