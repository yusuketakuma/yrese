import {
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftFlag,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionDraftType,
} from "@yrese/contracts";
import { permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import {
  type PrescriptionDraftSnapshot,
  type PrescriptionOption,
} from "./prescription-draft";

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

const TYPE_TO_WIRE: Record<string, PrescriptionDraftType> = {
  "": "UNSPECIFIED",
  外来: "OUTPATIENT",
  在宅: "HOME",
};

const TYPE_FROM_WIRE: Record<PrescriptionDraftType, string> = {
  UNSPECIFIED: "",
  OUTPATIENT: "外来",
  HOME: "在宅",
};

const FLAG_TO_WIRE: Record<PrescriptionOption, PrescriptionDraftFlag> = {
  一包化: "PACKAGING",
  在宅: "HOME_CARE",
  麻薬: "NARCOTIC",
  向精神薬: "PSYCHOTROPIC",
  残薬調整: "LEFTOVER_ADJUSTMENT",
};

const FLAG_FROM_WIRE: Record<PrescriptionDraftFlag, PrescriptionOption> = {
  PACKAGING: "一包化",
  HOME_CARE: "在宅",
  NARCOTIC: "麻薬",
  PSYCHOTROPIC: "向精神薬",
  LEFTOVER_ADJUSTMENT: "残薬調整",
};

export type PrescriptionDraftApiErrorKind =
  | "INVALID_REQUEST"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_RESPONSE"
  | "UNAVAILABLE";

export class PrescriptionDraftApiError extends Error {
  constructor(
    readonly kind: PrescriptionDraftApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PrescriptionDraftApiError";
  }
}

export interface PrescriptionDraftContext {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

function parseOptionalInteger(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (!/^[0-9]+$/u.test(normalized)) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "日数は1〜999の整数で入力してください。",
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 999) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "日数は1〜999の整数で入力してください。",
    );
  }
  return parsed;
}

export function toPrescriptionDraftContent(
  snapshot: PrescriptionDraftSnapshot,
): PrescriptionDraftContent {
  const prescriptionType = TYPE_TO_WIRE[snapshot.prescriptionType];
  if (prescriptionType === undefined) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方区分を確認してください。",
    );
  }

  const candidate = {
    prescriptionType,
    prescriptionDate:
      snapshot.prescriptionDate.trim().length === 0
        ? null
        : snapshot.prescriptionDate.trim(),
    defaultDays: parseOptionalInteger(snapshot.defaultDays),
    flags: snapshot.options.map((option) => FLAG_TO_WIRE[option]),
    note: snapshot.note,
    rows: snapshot.rows.map((row, index) => ({
      sequence: index + 1,
      drugText: row.drug,
      usageText: row.usage,
      days: parseOptionalInteger(row.days),
      quantityText: row.quantity,
    })),
  };

  try {
    return prescriptionDraftSaveRequestSchema.shape.draft.parse(candidate);
  } catch {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "入力値の長さ、日付、日数または行数を確認してください。",
    );
  }
}

export function fromPrescriptionDraftResponse(
  response: PrescriptionDraftResponse,
): PrescriptionDraftSnapshot {
  return {
    prescriptionType: TYPE_FROM_WIRE[response.draft.prescriptionType],
    prescriptionDate: response.draft.prescriptionDate ?? "",
    defaultDays:
      response.draft.defaultDays === null
        ? ""
        : String(response.draft.defaultDays),
    options: response.draft.flags.map((flag) => FLAG_FROM_WIRE[flag]),
    note: response.draft.note,
    rows: response.draft.rows.map((row) => ({
      id: row.sequence,
      drug: row.drugText,
      usage: row.usageText,
      days: row.days === null ? "" : String(row.days),
      quantity: row.quantityText,
    })),
  };
}

export function prescriptionDraftSnapshotsEqual(
  left: PrescriptionDraftSnapshot,
  right: PrescriptionDraftSnapshot,
): boolean {
  try {
    return (
      JSON.stringify(toPrescriptionDraftContent(left)) ===
      JSON.stringify(toPrescriptionDraftContent(right))
    );
  } catch {
    return false;
  }
}

function endpoint(context: PrescriptionDraftContext): string {
  return resolveWebApiUrl(
    `/prescription-drafts/by-reception/${encodeURIComponent(context.receptionId)}`,
  );
}

function classifyFailure(status: number): PrescriptionDraftApiError {
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
): Promise<PrescriptionDraftResponse | null> {
  const query = new URLSearchParams({
    date: context.businessDate,
  });
  let response: Response;
  try {
    response = await fetchImpl(`${endpoint(context)}?${query.toString()}`, {
      headers: devTenantHeaders(READ_SCOPES),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (response.status === 204) return null;
  if (!response.ok) throw classifyFailure(response.status);

  try {
    return prescriptionDraftResponseSchema.parse(await response.json());
  } catch {
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
}

export async function savePrescriptionDraft(
  context: PrescriptionDraftContext,
  input: {
    readonly expectedVersion: number;
    readonly snapshot: PrescriptionDraftSnapshot;
  },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
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
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (!response.ok) throw classifyFailure(response.status);

  try {
    return prescriptionDraftSaveResponseSchema.parse(await response.json());
  } catch {
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
}
