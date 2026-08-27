import {
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryResponseSchema,
  type MigrationStateResponse,
  type OutboxSummaryResponse,
  type ReceptionSummaryResponse,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import type { ErrorNoticeProps } from "../components/error-notice";
import { devTenantHeaders } from "../dev-tenant";

/**
 * 運用集計API(件数・時刻・enum・スキーマ版数のみ)のWebクライアント。
 *
 * 表示文言は **この層で固定** し、サーバの message 文字列を画面へ露出させない
 * (サーバ文言は登録済みエラーコードの語彙ではなく、UI の次アクションも持たないため)。
 * 応答は必ず契約 schema で検証してから返す。検証に失敗したら表示を中止する。
 */

export const OUTBOX_SUMMARY_SCOPES = [
  permissionScope("sync", "read"),
] as const satisfies readonly PermissionScope[];

export const RECEPTION_SUMMARY_SCOPES = [
  permissionScope("reception", "read"),
] as const satisfies readonly PermissionScope[];

export const MIGRATION_STATE_SCOPES = [
  permissionScope("tenant", "admin"),
] as const satisfies readonly PermissionScope[];

export type OperationsApiErrorKind =
  | "PERMISSION_DENIED"
  | "INVALID_REQUEST"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

const OPERATIONS_NOTICES: Readonly<
  Record<OperationsApiErrorKind, ErrorNoticeProps>
> = Object.freeze({
  PERMISSION_DENIED: Object.freeze({
    errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
    message: "この操作に必要な権限がセッションに付与されていません。",
    nextAction: "管理者に必要な scope の付与状況を確認してください。",
  }),
  INVALID_REQUEST: Object.freeze({
    message: "指定した業務日を解釈できませんでした。",
    nextAction: "YYYY-MM-DD 形式で業務日を指定し直してください。",
  }),
  UNAVAILABLE: Object.freeze({
    message:
      "集計APIへ到達できませんでした。障害とは断定せず未確認として扱います。",
    nextAction:
      "時間をおいて再取得するか、管理画面でAPI疎通を確認してください。",
  }),
  INVALID_RESPONSE: Object.freeze({
    message: "集計APIの応答が契約と一致しません。",
    nextAction: "表示を中止しました。管理者へ連絡してください。",
  }),
});

/**
 * 例外が運ぶのは kind だけ。`message` にも kind しか入れないので、サーバ由来の
 * 文字列が例外経由で画面やログへ回り込まない。表示文言は kind から引き当てる。
 */
export class OperationsApiError extends Error {
  readonly kind: OperationsApiErrorKind;

  constructor(kind: OperationsApiErrorKind) {
    super(kind);
    this.name = "OperationsApiError";
    this.kind = kind;
  }

  toNotice(): ErrorNoticeProps {
    return OPERATIONS_NOTICES[this.kind];
  }
}

export interface OperationsRequestOptions {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  /** 受付集計だけが使う業務日(YYYY-MM-DD)。 */
  readonly date?: string;
}

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function classifyHttpFailure(status: number): OperationsApiError {
  if (status === 403) return new OperationsApiError("PERMISSION_DENIED");
  if (status === 400) return new OperationsApiError("INVALID_REQUEST");
  return new OperationsApiError("UNAVAILABLE");
}

async function fetchOperationsJson(
  path: string,
  scopes: readonly PermissionScope[],
  options: OperationsRequestOptions | undefined,
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const signal = options?.signal;

  let response: Response;
  try {
    response = await fetchImpl(resolveWebApiUrl(path), {
      headers: devTenantHeaders(scopes),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new OperationsApiError("UNAVAILABLE");
  }

  if (!response.ok) {
    throw classifyHttpFailure(response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new OperationsApiError("INVALID_RESPONSE");
  }
}

export async function fetchOutboxSummary(
  options?: OperationsRequestOptions,
): Promise<OutboxSummaryResponse> {
  const body = await fetchOperationsJson(
    "/operations/outbox-summary",
    OUTBOX_SUMMARY_SCOPES,
    options,
  );
  const parsed = outboxSummaryResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new OperationsApiError("INVALID_RESPONSE");
  }
  return parsed.data;
}

export async function fetchReceptionSummary(
  options?: OperationsRequestOptions,
): Promise<ReceptionSummaryResponse> {
  const date = options?.date;
  // 形式が崩れた業務日は送らずにここで止める(サーバの 400 文言に依存しない)。
  if (date === undefined || !businessDatePattern.test(date)) {
    throw new OperationsApiError("INVALID_REQUEST");
  }

  const body = await fetchOperationsJson(
    `/operations/reception-summary?date=${encodeURIComponent(date)}`,
    RECEPTION_SUMMARY_SCOPES,
    options,
  );
  const parsed = receptionSummaryResponseSchema.safeParse(body);
  if (!parsed.success || parsed.data.date !== date) {
    throw new OperationsApiError("INVALID_RESPONSE");
  }
  return parsed.data;
}

export async function fetchMigrationState(
  options?: OperationsRequestOptions,
): Promise<MigrationStateResponse> {
  const body = await fetchOperationsJson(
    "/operations/migration-state",
    MIGRATION_STATE_SCOPES,
    options,
  );
  const parsed = migrationStateResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new OperationsApiError("INVALID_RESPONSE");
  }
  return parsed.data;
}

/** 想定外の例外も画面には固定文言だけを見せる(raw message を素通ししない)。 */
export function toOperationsNotice(error: unknown): ErrorNoticeProps {
  return error instanceof OperationsApiError
    ? error.toNotice()
    : OPERATIONS_NOTICES.UNAVAILABLE;
}
