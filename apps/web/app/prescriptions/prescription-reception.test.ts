import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import type { PrescriptionReceptionOrigin } from "./prescription-origin-context";
import {
  PrescriptionReceptionError,
  loadPrescriptionReceptionOrigin,
  verifyPrescriptionReceptionOrigin,
} from "./prescription-reception";

const ORIGIN: PrescriptionReceptionOrigin = {
  receptionId: "reception-test-001",
  patientId: "patient-test-001",
  businessDate: "2026-08-25",
};

const ENTRY: ReceptionQueueEntry = {
  receptionId: ORIGIN.receptionId,
  patient: {
    patientId: ORIGIN.patientId,
    name: "合成 患者",
    kana: "ゴウセイ カンジャ",
    birthDate: "1950-01-02",
    sex: "female",
    patientNumber: "T-0001",
    eligibilityStatus: "VERIFIED",
  },
  acceptedAt: "2026-08-25T00:15:00.000Z",
  receptionStatus: "WAITING",
  prescriptionIntakeType: "paper",
};

function response(entries: ReceptionQueueEntry[]): ReceptionQueueResponse {
  return { date: ORIGIN.businessDate, entries };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("prescription reception verification", () => {
  it("returns only the exact reception with the expected patient", () => {
    expect(verifyPrescriptionReceptionOrigin(ORIGIN, response([ENTRY]))).toBe(
      ENTRY,
    );
  });

  it("fails closed when the reception is absent", () => {
    expect(() =>
      verifyPrescriptionReceptionOrigin(ORIGIN, response([])),
    ).toThrowError(
      expect.objectContaining<Partial<PrescriptionReceptionError>>({
        kind: "NOT_FOUND",
      }),
    );
  });

  it("fails closed without echoing identifiers when patient ownership mismatches", () => {
    let caught: unknown;
    try {
      verifyPrescriptionReceptionOrigin(
        ORIGIN,
        response([
          {
            ...ENTRY,
            patient: { ...ENTRY.patient, patientId: "patient-secret-other" },
          },
        ]),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PrescriptionReceptionError);
    expect((caught as PrescriptionReceptionError).kind).toBe("PATIENT_MISMATCH");
    expect((caught as Error).message).not.toContain(ORIGIN.patientId);
    expect((caught as Error).message).not.toContain("patient-secret-other");
  });

  it("reuses the existing no-store reception API contract", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async () => jsonResponse(response([ENTRY]))) as unknown as typeof fetch;

    const loaded = await loadPrescriptionReceptionOrigin(ORIGIN, fetchImpl);

    expect(loaded).toEqual(ENTRY);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/_yrese-api/reception/queue?date=2026-08-25",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("converts transport and contract failures into a section-safe unavailable state", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async () => {
      throw new Error("patient-secret-transport-detail");
    }) as unknown as typeof fetch;

    await expect(
      loadPrescriptionReceptionOrigin(ORIGIN, fetchImpl),
    ).rejects.toMatchObject({
      kind: "UNAVAILABLE",
      message: "受付情報を再取得できませんでした。",
    });
  });
});
