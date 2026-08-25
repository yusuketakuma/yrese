import type { ReceptionStatus } from "@yrese/contracts";

export type PrescriptionLaunchSearchParam = string | readonly string[] | undefined;

export interface PrescriptionLaunchContext {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

export type PrescriptionLaunchContextParseResult =
  | { readonly status: "ready"; readonly context: PrescriptionLaunchContext }
  | { readonly status: "invalid"; readonly reason: string };

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_IDENTIFIER_LENGTH = 128;

function singleValue(value: PrescriptionLaunchSearchParam): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

/**
 * Parse untrusted route/query input without treating it as authorization evidence.
 * The API response and authenticated tenant context remain authoritative.
 */
export function parsePrescriptionLaunchContext(input: {
  readonly receptionId: PrescriptionLaunchSearchParam;
  readonly patientId: PrescriptionLaunchSearchParam;
  readonly date: PrescriptionLaunchSearchParam;
}): PrescriptionLaunchContextParseResult {
  const receptionId = singleValue(input.receptionId)?.trim();
  const patientId = singleValue(input.patientId)?.trim();
  const businessDate = singleValue(input.date)?.trim();

  if (
    receptionId === undefined ||
    patientId === undefined ||
    businessDate === undefined
  ) {
    return {
      status: "invalid",
      reason: "受付ID・患者ID・業務日を一意に指定してください。",
    };
  }
  if (!validIdentifier(receptionId) || !validIdentifier(patientId)) {
    return {
      status: "invalid",
      reason: "受付IDまたは患者IDの形式を確認できません。",
    };
  }
  if (!BUSINESS_DATE_PATTERN.test(businessDate)) {
    return {
      status: "invalid",
      reason: "業務日はYYYY-MM-DD形式で指定してください。",
    };
  }

  return {
    status: "ready",
    context: { receptionId, patientId, businessDate },
  };
}

export interface ReceptionLaunchIdentity {
  readonly receptionId: string;
  readonly patient: {
    readonly patientId: string;
  };
  readonly receptionStatus: ReceptionStatus;
}

export type ReceptionLaunchValidationResult<T extends ReceptionLaunchIdentity> =
  | { readonly status: "ready"; readonly entry: T }
  | { readonly status: "not-found" }
  | { readonly status: "patient-mismatch" }
  | { readonly status: "terminal-status"; readonly entry: T };

function receptionAcceptsPrescriptionDraft(status: ReceptionStatus): boolean {
  return status === "WAITING" || status === "IN_PROGRESS";
}

/**
 * Resolve only an entry returned by the authenticated, tenant-scoped reception queue.
 * A route patientId never overrides the nested patient identity returned by the API contract.
 * Completed or cancelled reception entries are returned as an explicit terminal result so the
 * editor cannot be entered through a copied dynamic URL.
 */
export function validateReceptionLaunchEntry<T extends ReceptionLaunchIdentity>(
  entries: readonly T[],
  context: PrescriptionLaunchContext,
): ReceptionLaunchValidationResult<T> {
  const entry = entries.find(
    (candidate) => candidate.receptionId === context.receptionId,
  );
  if (entry === undefined) return { status: "not-found" };
  if (entry.patient.patientId !== context.patientId) {
    return { status: "patient-mismatch" };
  }
  if (!receptionAcceptsPrescriptionDraft(entry.receptionStatus)) {
    return { status: "terminal-status", entry };
  }
  return { status: "ready", entry };
}
