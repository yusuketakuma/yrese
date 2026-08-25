import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch bounded scope", () => {
  it("does not derive medication, calculation, or confirmation state from URL input", () => {
    const result = parsePrescriptionLaunchContext({
      receptionId: "reception-bounded",
      patientId: "patient-bounded",
      date: "2026-08-25",
    });

    expect(result).toEqual({
      status: "ready",
      context: {
        receptionId: "reception-bounded",
        patientId: "patient-bounded",
        businessDate: "2026-08-25",
      },
    });
  });
});
