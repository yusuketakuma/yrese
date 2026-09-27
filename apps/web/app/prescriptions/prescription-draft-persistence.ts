import {
  prescriptionLifecycleViewSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionLifecycleView,
} from "@yrese/contracts";
import { permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import {
  type PrescriptionDraftSnapshot,
} from "./prescription-draft";
import {
  PrescriptionDraftApiError,
  type PrescriptionDraftApiErrorKind,
  toPrescriptionDraftContent,
} from "./prescription-draft-marshalling";

export * from "./prescription-draft-marshalling";

const READ_SCOPES = [
  permissionScope("prescription", "read"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const;

const WRITE_SCOPES = [
  permissionScope("prescription", "write"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const;

export interface PrescriptionDraftContext {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

/** 受付登録と同じ既存のブラウザ通信上限。SLO確定前の性能最適化値ではない。 */
export const PRESCRIPTION_DRAFT_TIMEOUT_MS = 30_000;

function draftRequestSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal === undefined
    ? timeoutSignal
    : AbortSignal.any([callerSignal, timeoutSignal]);
}

function draftTimeoutError(): PrescriptionDraftApiError {
  return new PrescriptionDraftApiError(
    "UNAVAILABLE",
    "処方下書きAPIへの応答が時間内にありませんでした。",
  );
}

function endpoint(context: PrescriptionDraftContext): string {
  return resolveWebApiUrl(
    `/prescription-drafts/by-reception/${encodeURIComponent(context.receptionId)}`,
  );
}

/**
 * 応答の echo identity を要求文脈と照合する。スキーマ上は valid でも別
 * 受付・患者・業務日の下書きが返った場合、このタブへ取り込むと患者
 * 取り違えになるため INVALID_RESPONSE として失敗させる。
 */
function assertDraftResponseContext(
  response: PrescriptionDraftResponse,
  context: PrescriptionDraftContext,
): void {
  if (
    response.receptionId !== context.receptionId ||
    response.patientId !== context.patientId ||
    response.businessDate !== context.businessDate
  ) {
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答が要求した受付・患者・業務日と一致しませんでした。",
    );
  }
}

function classifyFailure(
  status: number,
  code?: string,
): PrescriptionDraftApiError {
  if (status === 400) {
    return new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方下書きの入力内容を検証できませんでした。",
      status,
    );
  }
  if (status === 403) {
    return new PrescriptionDraftApiError(
      "PERMISSION_DENIED",
      "処方下書きを操作する権限がありません。",
      status,
    );
  }
  if (status === 404) {
    return new PrescriptionDraftApiError(
      "NOT_FOUND",
      "受付・患者・業務日の組み合わせを確認できませんでした。",
      status,
    );
  }
  if (status === 409) {
    // RX-0002: 薬剤師確認・確定済みの draft は lifecycle 上ロック済み。
    if (code === "RX-0002") {
      return new PrescriptionDraftApiError(
        "CONFLICT",
        "薬剤師確認・確定済みのため、この下書きは編集できません。",
        status,
      );
    }
    return new PrescriptionDraftApiError(
      "CONFLICT",
      "別の端末または画面で下書きが更新されています。",
      status,
    );
  }
  return new PrescriptionDraftApiError(
    "UNAVAILABLE",
    "処方下書きAPIを利用できません。",
    status,
  );
}

export async function loadPrescriptionDraft(
  context: PrescriptionDraftContext,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs: number = PRESCRIPTION_DRAFT_TIMEOUT_MS,
): Promise<PrescriptionDraftResponse | null> {
  const query = new URLSearchParams({
    date: context.businessDate,
  });
  const requestSignal = draftRequestSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${endpoint(context)}?${query.toString()}`, {
      headers: devTenantHeaders(READ_SCOPES),
      cache: "no-store",
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (response.status === 204) return null;
  if (!response.ok) throw classifyFailure(response.status);

  let parsed: PrescriptionDraftResponse;
  try {
    parsed = prescriptionDraftResponseSchema.parse(await response.json());
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
  assertDraftResponseContext(parsed, context);
  return parsed;
}

export async function savePrescriptionDraft(
  context: PrescriptionDraftContext,
  input: {
    readonly expectedVersion: number;
    readonly snapshot: PrescriptionDraftSnapshot;
  },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs: number = PRESCRIPTION_DRAFT_TIMEOUT_MS,
): Promise<PrescriptionDraftSaveResponse> {
  let body: unknown;
  try {
    body = prescriptionDraftSaveRequestSchema.parse({
      patientId: context.patientId,
      businessDate: context.businessDate,
      expectedVersion: input.expectedVersion,
      draft: toPrescriptionDraftContent(input.snapshot),
    });
  } catch (error) {
    if (error instanceof PrescriptionDraftApiError) throw error;
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方下書きの入力内容を検証できませんでした。",
    );
  }

  const requestSignal = draftRequestSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(endpoint(context), {
      method: "PUT",
      headers: {
        ...devTenantHeaders(WRITE_SCOPES),
        "content-type": "application/json",
        ...(input.expectedVersion === 0
          ? {}
          : { "if-match": `"${input.expectedVersion}"` }),
      },
      cache: "no-store",
      body: JSON.stringify(body),
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (!response.ok) {
    // 409 locked 応答は framework shape の `code` を読み分ける。
    let code: string | undefined;
    try {
      const body: unknown = await response.clone().json();
      if (
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        typeof (body as { code: unknown }).code === "string"
      ) {
        code = (body as { code: string }).code;
      }
    } catch {
      // 応答本文が読めなくても status だけで分類する。
    }
    throw classifyFailure(response.status, code);
  }

  let parsed: PrescriptionDraftSaveResponse;
  try {
    parsed = prescriptionDraftSaveResponseSchema.parse(await response.json());
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
  assertDraftResponseContext(parsed, context);
  return parsed;
}

export type PrescriptionLifecycleTransition = "confirm" | "finalize";

function lifecycleErrorMessage(
  status: number,
  errorCode: string | undefined,
): { kind: PrescriptionDraftApiErrorKind; message: string } {
  if (status === 400) {
    return {
      kind: "INVALID_REQUEST",
      message: "確認・確定の要求形式を検証できませんでした。",
    };
  }
  if (status === 403) {
    return {
      kind: "PERMISSION_DENIED",
      message:
        "確認・確定の権限または有効な薬剤師資格がありません。付与状況を管理者へ確認してください。",
    };
  }
  if (status === 404) {
    return {
      kind: "NOT_FOUND",
      message: "対象の処方をこの薬局・業務範囲で確認できませんでした。",
    };
  }
  if (status === 409) {
    switch (errorCode) {
      case "RX-0001":
        return {
          kind: "CONFLICT",
          message:
            "マスターコード未解決の薬剤があるため確認へ進めません。コード対応を完了してください。",
        };
      case "RX-0002":
        return {
          kind: "CONFLICT",
          message:
            "現在の処方状態ではこの操作を実行できません。画面を再読込して状態を確認してください。",
        };
      case "RX-0003":
        return {
          kind: "CONFLICT",
          message:
            "処方箋原本情報(発行日・有効期限・医師名・医療機関)が不足しています。",
        };
      case "RX-0004":
        return {
          kind: "CONFLICT",
          message:
            "対象受付が調剤中ではないため確認できません。受付状態を確認してください。",
        };
      default:
        return {
          kind: "CONFLICT",
          message: "現在の処方状態ではこの操作を実行できません。",
        };
    }
  }
  return {
    kind: "UNAVAILABLE",
    message: "確認・確定APIを利用できません。",
  };
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "errorCode" in body &&
      typeof (body as { errorCode: unknown }).errorCode === "string"
    ) {
      return (body as { errorCode: string }).errorCode;
    }
  } catch {
    // 応答本文が読めなくても status だけで分類する。
  }
  return undefined;
}

/**
 * WP-7402: confirm/finalize command。Idempotency-Key は呼び出し側が
 * 同一操作の再試行で再利用できるよう1回だけ採番して渡す。応答 view は
 * schema parse してから返す(信頼境界)。
 */
export async function transitionPrescriptionLifecycle(
  prescriptionId: string,
  transition: PrescriptionLifecycleTransition,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs: number = PRESCRIPTION_DRAFT_TIMEOUT_MS,
): Promise<PrescriptionLifecycleView> {
  const requestSignal = draftRequestSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(
      resolveWebApiUrl(
        `/prescriptions/${encodeURIComponent(prescriptionId)}/${transition}`,
      ),
      {
        method: "POST",
        headers: {
          ...devTenantHeaders([permissionScope("prescription", "confirm")]),
          "idempotency-key": idempotencyKey,
        },
        cache: "no-store",
        signal: requestSignal,
      },
    );
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "確認・確定APIへ接続できませんでした。",
    );
  }

  if (!response.ok) {
    const errorCode = await readErrorCode(response);
    const { kind, message } = lifecycleErrorMessage(
      response.status,
      errorCode,
    );
    throw new PrescriptionDraftApiError(
      kind,
      message,
      response.status,
      errorCode,
    );
  }

  try {
    return prescriptionLifecycleViewSchema.parse(await response.json());
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "確認・確定APIの応答形式を検証できませんでした。",
    );
  }
}