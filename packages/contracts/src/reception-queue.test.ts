import { describe, expect, it } from "vitest";

import {
  RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH,
  receptionCreateRequestSchema,
  receptionIdempotencyKeySchema,
  receptionQueueEntrySchema,
  receptionQueueQuerySchema,
  receptionQueueResponseSchema,
  receptionStatusSchema,
  receptionTransitionHeadersSchema,
  receptionTransitionRequestSchema,
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
  version: 1,
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
  it("reuses the canonical reception idempotency key schema", () => {
    expect(receptionCreateRequestSchema.shape.idempotencyKey).toBe(receptionIdempotencyKeySchema);
  });

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

describe("receptionTransitionRequestSchema (API-006 0.3.1)", () => {
  it("accepts each allowed transition target", () => {
    for (const to of ["IN_PROGRESS", "COMPLETED"] as const) {
      expect(
        receptionTransitionRequestSchema.parse({ to, expectedVersion: 1 }),
      ).toEqual({ to, expectedVersion: 1 });
    }
    expect(
      receptionTransitionRequestSchema.parse({
        to: "CANCELLED",
        expectedVersion: 3,
        businessReason: "PATIENT_REQUEST",
      }),
    ).toEqual({
      to: "CANCELLED",
      expectedVersion: 3,
      businessReason: "PATIENT_REQUEST",
    });
  });

  it.each([
    { to: "WAITING", expectedVersion: 1 },
    { to: "RECEIVED_PROVISIONAL", expectedVersion: 1 },
    { to: "IN_PROGRESS", expectedVersion: 0 },
    { to: "IN_PROGRESS", expectedVersion: -1 },
    { to: "IN_PROGRESS", expectedVersion: 1.5 },
    { to: "IN_PROGRESS" },
    { expectedVersion: 1 },
    { to: "CANCELLED", expectedVersion: 1 },
    { to: "IN_PROGRESS", expectedVersion: 1, businessReason: "PATIENT_REQUEST" },
    { to: "COMPLETED", expectedVersion: 1, businessReason: "DONE" },
    { to: "CANCELLED", expectedVersion: 1, businessReason: "lowercase" },
    { to: "CANCELLED", expectedVersion: 1, businessReason: "患者都合" },
    { to: "CANCELLED", expectedVersion: 1, businessReason: "AB" },
    {
      to: "CANCELLED",
      expectedVersion: 1,
      businessReason: `A${"B".repeat(64)}`,
    },
    { to: "IN_PROGRESS", expectedVersion: 1, extra: true },
  ])("rejects invalid transition request %j", (value) => {
    expect(() => receptionTransitionRequestSchema.parse(value)).toThrow();
  });
});

describe("receptionTransitionHeadersSchema", () => {
  it("requires a quoted positive integer If-Match", () => {
    expect(
      receptionTransitionHeadersSchema.parse({ "if-match": '"2"' }),
    ).toEqual({ "if-match": '"2"' });
  });

  it.each([
    {},
    { "if-match": "2" },
    { "if-match": '"0"' },
    { "if-match": '"-1"' },
    { "if-match": '"1.5"' },
    { "if-match": 'W/"2"' },
    { "if-match": `"${"1".repeat(13)}"` },
  ])("rejects invalid If-Match %j", (value) => {
    expect(() => receptionTransitionHeadersSchema.parse(value)).toThrow();
  });
});
