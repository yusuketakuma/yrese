import { describe, expect, it } from "vitest";

import {
  RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH,
  receptionCreateRequestSchema,
  receptionQueueEntrySchema,
  receptionQueueQuerySchema,
  receptionQueueResponseSchema,
  receptionStatusSchema,
} from "./reception-queue.js";
import { WIRE_ID_MAX_LENGTH } from "./wire-id.js";

const patientSummary = {
  patientId: "patient-syn-001",
  name: "試験花子",
  kana: "シケンハナコ",
  birthDate: "1980-04-12",
  sex: "female",
  patientNumber: "SYN-001",
  eligibilityStatus: "VERIFIED",
  eligibilityCheckedAt: "2026-07-09T08:16:15.000Z",
} as const;

const queueEntry = {
  receptionId: "reception-syn-001",
  patient: patientSummary,
  acceptedAt: "2026-07-09T08:30:00.000Z",
  receptionStatus: "WAITING",
  prescriptionIntakeType: "paper",
} as const;

describe("receptionQueueQuerySchema", () => {
  it("accepts real calendar dates", () => {
    expect(receptionQueueQuerySchema.parse({ date: "2026-07-09" })).toEqual({
      date: "2026-07-09",
    });
  });

  it.each([{ date: "2026-02-31" }, { date: "20260709" }, {}])(
    "rejects invalid date query %#",
    (value) => {
      expect(() => receptionQueueQuerySchema.parse(value)).toThrow();
    },
  );
});

describe("reception queue schemas", () => {
  it("uses the approved reception status values", () => {
    expect(receptionStatusSchema.options).toEqual(["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
    expect(() => receptionStatusSchema.parse("RECEIVED_PROVISIONAL")).toThrow();
  });

  it("accepts queue entries and responses", () => {
    expect(receptionQueueEntrySchema.parse(queueEntry)).toEqual(queueEntry);
    expect(
      receptionQueueResponseSchema.parse({
        date: "2026-07-09",
        entries: [queueEntry],
      }),
    ).toEqual({
      date: "2026-07-09",
      entries: [queueEntry],
    });
  });

  it("rejects non-paper intake type until the electronic prescription boundary is approved", () => {
    expect(() =>
      receptionQueueEntrySchema.parse({
        ...queueEntry,
        prescriptionIntakeType: "electronic",
      }),
    ).toThrow();
  });

  it.each(["", "   ", "reception-syn-001\u0000", "x".repeat(WIRE_ID_MAX_LENGTH + 1)])(
    "rejects invalid receptionId wire value %j",
    (receptionId) => {
      expect(() =>
        receptionQueueEntrySchema.parse({
          ...queueEntry,
          receptionId,
        }),
      ).toThrow();
    },
  );
});

describe("receptionCreateRequestSchema", () => {
  it("accepts opaque idempotency keys", () => {
    expect(
      receptionCreateRequestSchema.parse({
        patientId: "patient-syn-001",
        idempotencyKey: "018f2d9d-c8cf-75bc-a774-1ef61b496c55",
      }),
    ).toEqual({
      patientId: "patient-syn-001",
      idempotencyKey: "018f2d9d-c8cf-75bc-a774-1ef61b496c55",
    });
  });

  it.each([
    { patientId: "", idempotencyKey: "key-001" },
    { patientId: "   ", idempotencyKey: "key-001" },
    { patientId: "patient-syn-001\u0000", idempotencyKey: "key-001" },
    { patientId: "x".repeat(WIRE_ID_MAX_LENGTH + 1), idempotencyKey: "key-001" },
    { patientId: "patient-syn-001", idempotencyKey: "" },
    { patientId: "patient-syn-001", idempotencyKey: "   " },
    { patientId: "patient-syn-001", idempotencyKey: "key\t001" },
    { patientId: "patient-syn-001", idempotencyKey: "x".repeat(RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH + 1) },
  ])("rejects invalid create request %#", (value) => {
    expect(() => receptionCreateRequestSchema.parse(value)).toThrow();
  });
});
