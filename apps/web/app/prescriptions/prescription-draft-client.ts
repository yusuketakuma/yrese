import {
  prescriptionDraftContentSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftFlag,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionDraftType,
} from "@yrese/contracts";
import {
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import {
  PRESCRIPTION_OPTIONS,
  type PrescriptionDraftSnapshot,
  type PrescriptionOption,
  clonePrescriptionDraft,
} from "./prescription-draft";

export interface PrescriptionDraftScope {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

export type PrescriptionDraftClientErrorKind =
  | "INVALID_REQUEST"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

export class PrescriptionDraftClientError extends Error {
  constructor(
    readonly kind: PrescriptionDraftClientErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PrescriptionDraftClientError";
  }
}

const READ_SCOPES = [
  permissionScope("prescription", "read"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const satisfies readonly PermissionScope[];

const WRITE_SCOPES = [
  permissionScope("prescription", "write"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const satisfies readonly PermissionScope[];

function draftUrl(scope: PrescriptionDraftScope): string {
  const query = new URLSearchParams({
    patientId: scope.patientId,
    date: scope.businessDate,
  });
  return resolveWebApiUrl(
    `/prescription-drafts/by-reception/${encodeURIComponent(scope.receptionId)}?${query}`,
  );
}

function abortOrUnavailable(
  error: unknown,
  signal: AbortSignal | undefined,
  message: string,
): never {
  if (signal?.aborted === true) throw error;
  throw new PrescriptionDraftClientError("UNAVAILABLE", message);
}

function responseError(status: number): PrescriptionDraftClientError {
  if (status === 400) {
    return new PrescriptionDraftClientError(
      "INVALID_REQUEST",
      "処方下書きの要求形式を確認できませんでした。",
      status,
    );
  }
  if (status === 403) {
    return new PrescriptionDraftClientError(
      "PERMISSION_DENIED",
      "処方下書きを参照または保存する権限がありません。",
      status,
    );
  }
  if (status === 404) {
    return new PrescriptionDraftClientError(
      "NOT_FOUND",
      "受付・患者・業務日の組み合わせを確認できませんでした。",
      status,
    );
  }
  if (status === 409) {
    return new PrescriptionDraftClientError(
      "CONFLICT",
      "別の端末またはタブで処方下書きが更新されました。",
      status,
    );
  }
  return new PrescriptionDraftClientError(
    "UNAVAILABLE",
    "処方下書きサービスを利用できません。",
    status,
  );
}

export async function loadPrescriptionDraft(
  scope: PrescriptionDraftScope,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PrescriptionDraftResponse | null> {
  let response: Response;
  try {
    response = await fetchImpl(draftUrl(scope), {
      headers: devTenantHeaders(READ_SCOPES),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return abortOrUnavailable(
      error,
      signal,
      "処方下書きを取得できませんでした。",
    );
  }

  if (response.status === 404) return null;
  if (!response.ok || response.status !== 200) {
    throw responseError(response.status);
  }

  try {
    return prescriptionDraftResponseSchema.parse(await response.json());
  } catch {
    throw new PrescriptionDraftClientError(
      "INVALID_RESPONSE",
      "処方下書きの応答形式を検証できませんでした。",
    );
  }
}

export async function savePrescriptionDraft(
  scope: PrescriptionDraftScope,
  expectedVersion: number,
  draft: PrescriptionDraftContent,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PrescriptionDraftSaveResponse> {
  let response: Response;
  try {
    response = await fetchImpl(draftUrl(scope), {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...devTenantHeaders(WRITE_SCOPES),
      },
      cache: "no-store",
      body: JSON.stringify({
        patientId: scope.patientId,
        businessDate: scope.businessDate,
        expectedVersion,
        draft,
      }),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return abortOrUnavailable(
      error,
      signal,
      "処方下書きを保存できませんでした。",
    );
  }

  if (!response.ok || (response.status !== 200 && response.status !== 201)) {
    throw responseError(response.status);
  }

  try {
    return prescriptionDraftSaveResponseSchema.parse(await response.json());
  } catch {
    throw new PrescriptionDraftClientError(
      "INVALID_RESPONSE",
      "保存後の処方下書き応答を検証できませんでした。",
    );
  }
}

const TYPE_TO_WIRE: Readonly<Record<string, PrescriptionDraftType>> = {
  "": "UNSPECIFIED",
  外来: "OUTPATIENT",
  在宅: "HOME",
};

const WIRE_TO_TYPE: Readonly<Record<PrescriptionDraftType, string>> = {
  UNSPECIFIED: "",
  OUTPATIENT: "外来",
  HOME: "在宅",
};

const OPTION_TO_FLAG: Readonly<Record<PrescriptionOption, PrescriptionDraftFlag>> = {
  一包化: "PACKAGING",
  在宅: "HOME_CARE",
  麻薬: "NARCOTIC",
  向精神薬: "PSYCHOTROPIC",
  残薬調整: "LEFTOVER_ADJUSTMENT",
};

const FLAG_TO_OPTION = Object.fromEntries(
  Object.entries(OPTION_TO_FLAG).map(([option, flag]) => [flag, option]),
) as Readonly<Record<PrescriptionDraftFlag, PrescriptionOption>>;

function optionalPositiveInteger(value: string): number | null | undefined {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (!/^\d+$/u.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export type PrescriptionDraftConversionResult =
  | { readonly ok: true; readonly value: PrescriptionDraftContent }
  | { readonly ok: false; readonly message: string };

export function prescriptionDraftSnapshotToContent(
  snapshot: PrescriptionDraftSnapshot,
): PrescriptionDraftConversionResult {
  const defaultDays = optionalPositiveInteger(snapshot.defaultDays);
  if (defaultDays === undefined) {
    return {
      ok: false,
      message: "交付日数は1以上の整数で入力してください。",
    };
  }

  const rows = snapshot.rows.map((row, index) => ({
    sequence: index + 1,
    drugText: row.drug,
    usageText: row.usage,
    days: optionalPositiveInteger(row.days),
    quantityText: row.quantity,
  }));
  if (rows.some((row) => row.days === undefined)) {
    return {
      ok: false,
      message: "RP行の日数は空欄または1以上の整数で入力してください。",
    };
  }

  const parsed = prescriptionDraftContentSchema.safeParse({
    prescriptionType: TYPE_TO_WIRE[snapshot.prescriptionType],
    prescriptionDate:
      snapshot.prescriptionDate.trim().length === 0
        ? null
        : snapshot.prescriptionDate,
    defaultDays,
    flags: snapshot.options.map((option) => OPTION_TO_FLAG[option]),
    note: snapshot.note,
    rows,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "処方下書きの文字数、日付、行数、または入力形式を確認してください。",
    };
  }
  return { ok: true, value: parsed.data };
}

export function prescriptionDraftResponseToSnapshot(
  response: PrescriptionDraftResponse,
): PrescriptionDraftSnapshot {
  return {
    rows: response.draft.rows.map((row) => ({
      id: row.sequence,
      drug: row.drugText,
      usage: row.usageText,
      days: row.days === null ? "" : String(row.days),
      quantity: row.quantityText,
    })),
    prescriptionType: WIRE_TO_TYPE[response.draft.prescriptionType],
    prescriptionDate: response.draft.prescriptionDate ?? "",
    defaultDays:
      response.draft.defaultDays === null
        ? ""
        : String(response.draft.defaultDays),
    options: response.draft.flags.map((flag) => FLAG_TO_OPTION[flag]),
    note: response.draft.note,
  };
}

function normalizedSnapshot(snapshot: PrescriptionDraftSnapshot) {
  const optionOrder = new Map(
    PRESCRIPTION_OPTIONS.map((option, index) => [option, index] as const),
  );
  return {
    rows: snapshot.rows.map((row) => ({
      drug: row.drug.trim(),
      usage: row.usage.trim(),
      days: row.days.trim(),
      quantity: row.quantity.trim(),
    })),
    prescriptionType: snapshot.prescriptionType.trim(),
    prescriptionDate: snapshot.prescriptionDate.trim(),
    defaultDays: snapshot.defaultDays.trim(),
    options: [...snapshot.options].sort(
      (left, right) =>
        (optionOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (optionOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
    ),
    note: snapshot.note.trim(),
  };
}

export function prescriptionDraftSnapshotsEqual(
  left: PrescriptionDraftSnapshot,
  right: PrescriptionDraftSnapshot,
): boolean {
  return JSON.stringify(normalizedSnapshot(left)) === JSON.stringify(normalizedSnapshot(right));
}

export interface PersistedPrescriptionWorkSnapshot {
  readonly kind: "persisted-prescription-work-v1";
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
  readonly baseVersion: number;
  readonly baseline: PrescriptionDraftSnapshot;
  readonly draft: PrescriptionDraftSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDraftSnapshot(value: unknown): value is PrescriptionDraftSnapshot {
  if (!isRecord(value) || !Array.isArray(value.rows)) return false;
  return (
    typeof value.prescriptionType === "string" &&
    typeof value.prescriptionDate === "string" &&
    typeof value.defaultDays === "string" &&
    Array.isArray(value.options) &&
    value.options.every((option) =>
      PRESCRIPTION_OPTIONS.includes(option as PrescriptionOption),
    ) &&
    typeof value.note === "string" &&
    value.rows.every(
      (row) =>
        isRecord(row) &&
        typeof row.id === "number" &&
        typeof row.drug === "string" &&
        typeof row.usage === "string" &&
        typeof row.days === "string" &&
        typeof row.quantity === "string",
    )
  );
}

export function isPersistedPrescriptionWorkSnapshot(
  value: unknown,
): value is PersistedPrescriptionWorkSnapshot {
  return (
    isRecord(value) &&
    value.kind === "persisted-prescription-work-v1" &&
    typeof value.receptionId === "string" &&
    typeof value.patientId === "string" &&
    typeof value.businessDate === "string" &&
    typeof value.baseVersion === "number" &&
    Number.isInteger(value.baseVersion) &&
    value.baseVersion >= 0 &&
    isDraftSnapshot(value.baseline) &&
    isDraftSnapshot(value.draft)
  );
}

export function createPersistedPrescriptionWorkSnapshot(
  scope: PrescriptionDraftScope,
  baseVersion: number,
  baseline: PrescriptionDraftSnapshot,
  draft: PrescriptionDraftSnapshot,
): PersistedPrescriptionWorkSnapshot {
  return {
    kind: "persisted-prescription-work-v1",
    ...scope,
    baseVersion,
    baseline: clonePrescriptionDraft(baseline),
    draft: clonePrescriptionDraft(draft),
  };
}

export function persistentPrescriptionDraftWorkId(
  patientId: string,
  receptionId: string,
): string {
  return `prescription-draft:${patientId}:${receptionId}`;
}
