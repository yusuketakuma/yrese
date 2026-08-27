import { whoamiResponseSchema, type WhoamiResponse } from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import type { ErrorNoticeProps } from "../components/error-notice";
import { devTenantHeaders } from "../dev-tenant";

/**
 * 実セッションの scope を供給する共有クライアント。
 *
 * これまで /admin だけが持っていた「実セッションの scope」を、/masters や
 * /monthly-closing のような他画面からも同じ形で読めるようにする。返す形は
 * `WhoamiResponse` そのもの(tenantId / pharmacyId / actorId / scopes)で、
 * admin-data.ts の fetchAdminIdentity と同一である。
 *
 * API は 401 を返さない(開発は dev ヘッダ、production 認証は別 gate)。したがって
 * UNAUTHENTICATED は存在せず、権限不足は 403 = PERMISSION_DENIED として扱う。
 */

export const SESSION_SCOPES = [
  permissionScope("tenant", "read"),
] as const satisfies readonly PermissionScope[];

export type SessionApiErrorKind =
  | "PERMISSION_DENIED"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

const SESSION_NOTICES: Readonly<Record<SessionApiErrorKind, ErrorNoticeProps>> =
  Object.freeze({
    PERMISSION_DENIED: Object.freeze({
      errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
      message: "この操作に必要な権限がセッションに付与されていません。",
      nextAction: "管理者に必要な scope の付与状況を確認してください。",
    }),
    UNAVAILABLE: Object.freeze({
      message:
        "セッション情報へ到達できませんでした。障害とは断定せず未確認として扱います。",
      nextAction:
        "時間をおいて再取得するか、管理画面でAPI疎通を確認してください。",
    }),
    INVALID_RESPONSE: Object.freeze({
      message: "セッション情報の応答が契約と一致しません。",
      nextAction: "表示を中止しました。管理者へ連絡してください。",
    }),
  });

/** 例外が運ぶのは kind だけ。表示文言は kind から引き当てる(サーバ文言を運ばない)。 */
export class SessionApiError extends Error {
  readonly kind: SessionApiErrorKind;

  constructor(kind: SessionApiErrorKind) {
    super(kind);
    this.name = "SessionApiError";
    this.kind = kind;
  }

  toNotice(): ErrorNoticeProps {
    return SESSION_NOTICES[this.kind];
  }
}

export interface SessionRequestOptions {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
}

/** fetchAdminIdentity と同一の形。別名を用意するが構造は WhoamiResponse のまま。 */
export type SessionScopes = WhoamiResponse;

export async function fetchSessionScopes(
  options?: SessionRequestOptions,
): Promise<SessionScopes> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const signal = options?.signal;

  let response: Response;
  try {
    response = await fetchImpl(resolveWebApiUrl("/whoami"), {
      headers: devTenantHeaders(SESSION_SCOPES),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch {
    throw new SessionApiError("UNAVAILABLE");
  }

  if (!response.ok) {
    throw response.status === 403
      ? new SessionApiError("PERMISSION_DENIED")
      : new SessionApiError("UNAVAILABLE");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SessionApiError("INVALID_RESPONSE");
  }

  const parsed = whoamiResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SessionApiError("INVALID_RESPONSE");
  }
  return parsed.data;
}

/** セッションが特定の scope を全て持つか。UI 側の表示制御専用で、認可の代替ではない。 */
export function sessionHasScopes(
  session: SessionScopes,
  required: readonly PermissionScope[],
): boolean {
  const granted = new Set<string>(session.scopes);
  return required.every((scope) => granted.has(scope));
}

/**
 * scope の「付与なし」を測定結果として表示してよいか。
 *
 * developmentの dev stub は web が宣言した scope をそのまま返すため、`SESSION_SCOPES`
 * に含まれない scope は必ず欠落する。この欠落を「付与なし」と断定すると、測定して
 * いない事を測定結果として表示することになるので、その場合は未確認として扱う。
 */
export function scopeAbsenceIsMeasurable(
  required: readonly PermissionScope[],
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (nodeEnv !== "development") {
    return true;
  }
  const declared = new Set<string>(SESSION_SCOPES);
  return required.every((scope) => declared.has(scope));
}

/** 想定外の例外も画面には固定文言だけを見せる(raw message を素通ししない)。 */
export function toSessionNotice(error: unknown): ErrorNoticeProps {
  return error instanceof SessionApiError
    ? error.toNotice()
    : SESSION_NOTICES.UNAVAILABLE;
}
