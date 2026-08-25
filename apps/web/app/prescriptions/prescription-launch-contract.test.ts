import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch URL contract", () => {
  it("does not accept identifiers supplied as repeated query parameters", () => {
    expect(
      parsePrescriptionLaunchContext({
        receptionId: "reception-a",
        patientId: ["patient-a", "patient-b"],
        date: "2026-08-25",
      }),
    ).toMatchObject({ status: "invalid" });
  });
});
