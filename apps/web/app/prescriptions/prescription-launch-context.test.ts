import { describe, expect, it } from "vitest";

import {
  parsePrescriptionLaunchContext,
  validateReceptionLaunchEntry,
} from "./prescription-launch-context";

describe("parsePrescriptionLaunchContext", () => {
  it("accepts one reception and business date without carrying patient identity", () => {
    expect(
      parsePrescriptionLaunchContext({
        receptionId: "reception-a",
        date: "2026-08-25",
      }),
    ).toEqual({
      status: "ready",
      context: {
        receptionId: "reception-a",
        businessDate: "2026-08-25",
      },
    });
  });

  it.each([
    {
      receptionId: ["reception-a", "reception-b"],
      date: "2026-08-25",
    },
    {
      receptionId: "reception-a",
      date: ["2026-08-25", "2026-08-26"],
    },
    {
      receptionId: "reception-a",
      date: "25/08/2026",
    },
    {
      receptionId: "",
      date: "2026-08-25",
    },
  ])("rejects ambiguous or malformed input", (input) => {
    expect(parsePrescriptionLaunchContext(input).status).toBe("invalid");
  });
});

describe("validateReceptionLaunchEntry", () => {
  const launch = {
    receptionId: "reception-a",
    businessDate: "2026-08-25",
  } as const;
  const entries = [
    {
      receptionId: "reception-a",
      patient: { patientId: "patient-a" },
      receptionStatus: "WAITING",
    },
    {
      receptionId: "reception-b",
      patient: { patientId: "patient-b" },
      receptionStatus: "WAITING",
    },
  ] as const;

  it("returns only the matching authenticated queue entry", () => {
    expect(validateReceptionLaunchEntry(entries, launch, "patient-a")).toEqual({
      status: "ready",
      entry: entries[0],
    });
  });

  it("does not reuse a queue entry for another selected patient", () => {
    expect(validateReceptionLaunchEntry(entries, launch, "patient-b")).toEqual({
      status: "patient-mismatch",
    });
  });

  it("fails closed when the reception is absent from the tenant-scoped queue", () => {
    expect(
      validateReceptionLaunchEntry(
        entries,
        { ...launch, receptionId: "reception-missing" },
        "patient-a",
      ),
    ).toEqual({ status: "not-found" });
  });
});
