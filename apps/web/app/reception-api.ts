import {
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
  receptionTransitionResponseSchema,
  type ReceptionQueueEntry,
  type ReceptionQueueResponse,
  type ReceptionStatus,
  type ReceptionTransitionResponse,
  type ReceptionTransitionTarget,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_INVALID_TRANSITION_ERROR_CODE,
  RECEPTION_NOT_FOUND_ERROR_CODE,
  RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE,
  RECEPTION_QUEUE_BOUND_EXCEEDED_ERROR_CODE,
  RECEPTION_VERSION_CONFLICT_ERROR_CODE,
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "./api-transport";
import { registeredErrorCodeOrUndefined } from "./components/error-code";
import { type ErrorNoticeProps } from "./components/error-notice";
import { devTenantHeaders } from "./dev-tenant";
import { RECEPTION_STATUS_LABELS as RECEPTION_STATUS_LABELS_SSOT } from "./status/visual-status-registry";
import { todayAsIsoDate } from "./reception-time";

export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> =
  RECEPTION_STATUS_LABELS_SSOT;

export const PRESCRIPTION_INTAKE_LABELS: Record<
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
const RECEPTION_TRANSITION_DEV_SCOPES = [
  permissionScope("reception", "write"),
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
    return trustedReceptionErrorNotices.get(this) ?? genericRegistrationErrorNotice;
  }
}

const trustedReceptionErrorNotices = new WeakMap<object, ErrorNoticeProps>();

/**
 * 受付登録の失敗のうち、「サーバー側に受付は作られていない」と断定できるもの
 * (400 / 403 / 404 / 409)。結果が確定したときだけ冪等キーを退役させてよい。
 * ネットワーク失敗・応答喪失・5xx・応答形式違反は結果不明として扱う。
 */
const settledReceptionCreateFailures = new WeakSet<object>();
export const queuePermissionDeniedFailures = new WeakSet<object>();

export function isSettledReceptionCreateFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    settledReceptionCreateFailures.has(error)
  );
}

function settledCreateFailure(error: ReceptionError): ReceptionError {
  settledReceptionCreateFailures.add(error);
  return error;
}

export const genericQueueErrorNotice = Object.freeze({
  message: "受付一覧の処理に失敗しました。",
  nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
} satisfies ErrorNoticeProps);
export const genericRegistrationErrorNotice = Object.freeze({
  message: "受付の処理に失敗しました。",
  nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
} satisfies ErrorNoticeProps);

function createTrustedReceptionError(
  message: string,
  nextAction: string,
  errorCode?: string,
): ReceptionError {
  const error = new ReceptionError(message, nextAction, errorCode);
  const notice = Object.freeze({
    message,
    nextAction,
    ...(errorCode !== undefined ? { errorCode } : {}),
  } satisfies ErrorNoticeProps);
  trustedReceptionErrorNotices.set(error, notice);
  return error;
}

export function trustedReceptionErrorNotice(error: unknown): ErrorNoticeProps | undefined {
  return typeof error === "object" && error !== null
    ? trustedReceptionErrorNotices.get(error)
    : undefined;
}

type ReceptionErrorOperation = "queue" | "create" | "transition";

function expectedReceptionErrorCode(
  operation: ReceptionErrorOperation,
  status: number,
): string | readonly string[] | undefined {
  if (operation === "queue") {
    if (status === 400) return RECEPTION_INVALID_REQUEST_ERROR_CODE;
    if (status === 403) return AUTH_PERMISSION_DENIED_ERROR_CODE;
    // C-021(選択肢 b): 防御的 cap 超過は 503 + RCV-0007 で返る。
    if (status === 503) return RECEPTION_QUEUE_BOUND_EXCEEDED_ERROR_CODE;
    return undefined;
  }
  if (operation === "transition") {
    if (status === 400) return RECEPTION_INVALID_REQUEST_ERROR_CODE;
    if (status === 403) return AUTH_PERMISSION_DENIED_ERROR_CODE;
    if (status === 404) return RECEPTION_NOT_FOUND_ERROR_CODE;
    if (status === 409) {
      return [
        RECEPTION_INVALID_TRANSITION_ERROR_CODE,
        RECEPTION_VERSION_CONFLICT_ERROR_CODE,
      ];
    }
    return undefined;
  }
  if (status === 400) return RECEPTION_INVALID_REQUEST_ERROR_CODE;
  if (status === 403) return AUTH_PERMISSION_DENIED_ERROR_CODE;
  if (status === 404) return RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE;
  if (status === 409) return RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE;
  return undefined;
}

async function extractErrorCode(
  res: Response,
  operation: ReceptionErrorOperation,
): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(body, "errorCode");
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    // registry 未登録/形式外のコードは表示しない(異常値の verbatim 出力防止)
    const registeredCode = registeredErrorCodeOrUndefined(descriptor.value);
    const expectedCode = expectedReceptionErrorCode(operation, res.status);
    if (registeredCode === undefined || expectedCode === undefined) {
      return undefined;
    }
    const expectedCodes = Array.isArray(expectedCode)
      ? expectedCode
      : [expectedCode];
    return expectedCodes.includes(registeredCode) ? registeredCode : undefined;
  } catch {
    return undefined;
  }
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
    const errorCode = await extractErrorCode(res, "queue");
    if (res.status === 403) {
      const error = createTrustedReceptionError(
        "権限がありません。",
        "管理者に権限(reception:read / patient:read)の付与状況を確認してください。",
        errorCode,
      );
      queuePermissionDeniedFailures.add(error);
      throw error;
    }
    if (res.status === 400) {
      throw createTrustedReceptionError(
        "日付の指定が不正です。",
        "日付(YYYY-MM-DD)を確認して再表示してください。",
        errorCode,
      );
    }
    if (res.status === 503) {
      throw createTrustedReceptionError(
        "当日の受付件数が表示上限を超えています。",
        "件数が正常であれば運用手順に従ってシステム管理者へ連絡してください。",
        errorCode,
      );
    }
    throw createTrustedReceptionError(
      `受付一覧の取得に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
      errorCode,
    );
  }
  if (res.status !== 200) {
    throw createTrustedReceptionError(
      `受付一覧の取得に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
    );
  }
  const parsed = receptionQueueResponseSchema.parse(await res.json());
  if (parsed.date !== date) {
    const notice = queueResponseDateMismatchNotice();
    throw createTrustedReceptionError(notice.message, notice.nextAction);
  }
  const receptionIds = new Set<string>();
  for (const entry of parsed.entries) {
    if (receptionIds.has(entry.receptionId)) {
      throw new Error("Reception queue response contains duplicate reception identities");
    }
    receptionIds.add(entry.receptionId);
  }
  for (const entry of parsed.entries) {
    let entryBusinessDate: string;
    try {
      entryBusinessDate = todayAsIsoDate(new Date(entry.acceptedAt));
    } catch {
      throw new Error(
        "Reception queue response contains entries outside the requested business date",
      );
    }
    if (entryBusinessDate !== date) {
      throw new Error(
        "Reception queue response contains entries outside the requested business date",
      );
    }
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
  signal?: AbortSignal,
): Promise<ReceptionQueueEntry> {
  const url = resolveWebApiUrl("/reception");
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...devTenantHeaders(RECEPTION_CREATE_DEV_SCOPES),
      },
      cache: "no-store",
      body: JSON.stringify({ patientId: patientIdValue, idempotencyKey }),
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (error) {
    // 中断/無応答は「結果不明」であり、受付が durable に作られた可能性を否定できない。
    // 例外値そのものは検査せず、こちらが渡した signal の状態だけで判定する。
    if (signal?.aborted === true) {
      throw createTrustedReceptionError(
        "受付の結果を確認できませんでした(応答がありません)。",
        "受付一覧を更新して受付状況を確認してください。同じ患者への再受付は同じ操作キーで送られるため、受付が二重に作られることはありません。",
      );
    }
    throw error;
  }
  if (!res.ok) {
    const errorCode = await extractErrorCode(res, "create");
    if (res.status === 409) {
      throw settledCreateFailure(
        createTrustedReceptionError(
          "同じ操作キーが別の患者で再利用されました(二重操作の可能性)。",
          "受付一覧を更新して受付状況を確認してください。解消しない場合はシステム管理者へ連絡してください。",
          errorCode,
        ),
      );
    }
    if (res.status === 404) {
      throw settledCreateFailure(
        createTrustedReceptionError(
          "指定した患者がこの薬局に見つかりません。",
          "患者検索画面で受付対象の患者を選択し直してください。",
          errorCode,
        ),
      );
    }
    if (res.status === 403) {
      throw settledCreateFailure(
        createTrustedReceptionError(
          "権限がありません。",
          "管理者に権限(reception:write / patient:read)の付与状況を確認してください。",
          errorCode,
        ),
      );
    }
    if (res.status === 400) {
      throw settledCreateFailure(
        createTrustedReceptionError(
          "受付内容が不正です。",
          "患者検索画面で受付対象の患者を選択し直してから、再度受付してください。",
          errorCode,
        ),
      );
    }
    // 5xx 等は結果不明。冪等キーを保持したまま再試行させ、サーバー側の同一受付へ収束させる。
    throw createTrustedReceptionError(
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

/**
 * 受付状態遷移 POST(API-006 0.3.1)。楽観的同時実行制御は
 * `If-Match: "{version}"` + body の `expectedVersion` の二重一致。
 * 409 は「遷移不許可」(RCV-0004)か「版競合」(RCV-0005)のどちらかで、
 * いずれの場合も一覧を force reload して最新版へ収束させる。
 * 取消は構造化理由コード(MOD-008)を必須とし、自由記述は送らない。
 */
export async function transitionReception(
  entry: ReceptionQueueEntry,
  to: ReceptionTransitionTarget,
  businessReason: string | undefined,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ReceptionTransitionResponse> {
  const url = resolveWebApiUrl(
    `/reception/${encodeURIComponent(entry.receptionId)}/transitions`,
  );
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "if-match": `"${entry.version}"`,
      ...devTenantHeaders(RECEPTION_TRANSITION_DEV_SCOPES),
    },
    cache: "no-store",
    body: JSON.stringify(
      businessReason === undefined
        ? { to, expectedVersion: entry.version }
        : { to, expectedVersion: entry.version, businessReason },
    ),
    ...(signal !== undefined ? { signal } : {}),
  });
  if (!res.ok) {
    const errorCode = await extractErrorCode(res, "transition");
    if (res.status === 409) {
      throw createTrustedReceptionError(
        errorCode === RECEPTION_VERSION_CONFLICT_ERROR_CODE
          ? "受付の状態が他の操作で更新されました。"
          : "この受付状態からは指定した操作を実行できません。",
        "受付一覧を更新して最新の状態を確認してください。",
        errorCode,
      );
    }
    if (res.status === 404) {
      throw createTrustedReceptionError(
        "対象の受付がこの薬局に見つかりません。",
        "受付一覧を更新して対象の受付を確認してください。",
        errorCode,
      );
    }
    if (res.status === 403) {
      throw createTrustedReceptionError(
        "権限がありません。",
        "管理者に権限(reception:write)の付与状況を確認してください。",
        errorCode,
      );
    }
    throw createTrustedReceptionError(
      `受付の状態変更に失敗しました(HTTP ${res.status})。`,
      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      errorCode,
    );
  }
  if (res.status !== 200) {
    throw new Error("Reception transition response used an unsupported success status");
  }
  const parsed = receptionTransitionResponseSchema.parse(await res.json());
  if (parsed.receptionId !== entry.receptionId) {
    throw new Error("Reception transition response identity mismatch");
  }
  if (parsed.receptionStatus !== to) {
    throw new Error("Reception transition response status mismatch");
  }
  return parsed;
}

export function queueResponseDateMismatchNotice(): ErrorNoticeProps {
  return {
    message: "受付一覧の応答日付が要求日付と一致しません。",
    nextAction:
      "表示日付を確認して再表示してください。解消しない場合はシステム管理者へ連絡してください。",
  };
}
