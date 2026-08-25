import type {
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import { fetchReceptionQueue } from "../reception-dashboard";
import type { PrescriptionReceptionOrigin } from "./prescription-origin-context";

export type PrescriptionReceptionErrorKind =
  | "NOT_FOUND"
  | "PATIENT_MISMATCH"
  | "UNAVAILABLE";

export class PrescriptionReceptionError extends Error {
  constructor(
    readonly kind: PrescriptionReceptionErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PrescriptionReceptionError";
  }
}

/**
 * Bind a tab-local handoff pointer back to a fresh, contract-validated queue projection.
 * No identity supplied by the browser is trusted without this exact reception+patient match.
 */
export function verifyPrescriptionReceptionOrigin(
  origin: PrescriptionReceptionOrigin,
  response: ReceptionQueueResponse,
): ReceptionQueueEntry {
  const entry = response.entries.find(
    (candidate) => candidate.receptionId === origin.receptionId,
  );
  if (entry === undefined) {
    throw new PrescriptionReceptionError(
      "NOT_FOUND",
      "受付一覧から対象の受付を確認できませんでした。",
    );
  }
  if (entry.patient.patientId !== origin.patientId) {
    throw new PrescriptionReceptionError(
      "PATIENT_MISMATCH",
      "受付と選択患者の関連を確認できませんでした。",
    );
  }
  return entry;
}

export async function loadPrescriptionReceptionOrigin(
  origin: PrescriptionReceptionOrigin,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ReceptionQueueEntry> {
  let response: ReceptionQueueResponse;
  try {
    response = await fetchReceptionQueue(
      origin.businessDate,
      fetchImpl,
      signal,
    );
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (error instanceof PrescriptionReceptionError) throw error;
    throw new PrescriptionReceptionError(
      "UNAVAILABLE",
      "受付情報を再取得できませんでした。",
    );
  }
  return verifyPrescriptionReceptionOrigin(origin, response);
}
