import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch identifier bounds", () => {
  it("rejects oversized identifiers before API access", () => {
    expect(
      parsePrescriptionLaunchContext({
        receptionId: "r".repeat(129),
        patientId: "patient-a",
        date: "2026-08-25",
      }).status,
    ).toBe("invalid");
  });
});
