export type PrescriptionLaunchSearchParam = string | readonly string[] | undefined;

export interface PrescriptionLaunchContext {
  readonly receptionId: string;
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
  readonly date: PrescriptionLaunchSearchParam;
}): PrescriptionLaunchContextParseResult {
  const receptionId = singleValue(input.receptionId)?.trim();
  const businessDate = singleValue(input.date)?.trim();

  if (receptionId === undefined || businessDate === undefined) {
    return {
      status: "invalid",
      reason: "受付ID・業務日を一意に指定してください。",
    };
  }
  if (!validIdentifier(receptionId)) {
    return {
      status: "invalid",
      reason: "受付IDの形式を確認できません。",
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
    context: { receptionId, businessDate },
  };
}

export interface ReceptionLaunchIdentity {
  readonly receptionId: string;
  readonly patient: { readonly patientId: string };
}

export type ReceptionLaunchValidationResult<T extends ReceptionLaunchIdentity> =
  | { readonly status: "ready"; readonly entry: T }
  | { readonly status: "not-found" }
  | { readonly status: "patient-mismatch" };

/**
 * Resolve only an entry returned by the authenticated, tenant-scoped reception queue.
 * Patient identity comes from the queue and must match the explicitly selected patient.
 */
export function validateReceptionLaunchEntry<T extends ReceptionLaunchIdentity>(
  entries: readonly T[],
  context: PrescriptionLaunchContext,
  selectedPatientId: string,
): ReceptionLaunchValidationResult<T> {
  const entry = entries.find(
    (candidate) => candidate.receptionId === context.receptionId,
  );
  if (entry === undefined) return { status: "not-found" };
  if (entry.patient.patientId !== selectedPatientId) {
    return { status: "patient-mismatch" };
  }
  return { status: "ready", entry };
}
