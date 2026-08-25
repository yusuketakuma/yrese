import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch context data minimization", () => {
  it("returns only reception, patient, and business-date identifiers", () => {
    const parsed = parsePrescriptionLaunchContext({
      receptionId: "reception-minimal",
      patientId: "patient-minimal",
      date: "2026-08-25",
    });

    expect(parsed).toEqual({
      status: "ready",
      context: {
        receptionId: "reception-minimal",
        patientId: "patient-minimal",
        businessDate: "2026-08-25",
      },
    });
  });
});
