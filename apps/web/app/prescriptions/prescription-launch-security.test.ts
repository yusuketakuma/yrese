import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch security boundary", () => {
  it("does not authorize a selected patient when the tenant-scoped queue says another patient", () => {
    const result = validateReceptionLaunchEntry(
      [
        {
          receptionId: "reception-shared-looking-id",
          patient: { patientId: "patient-authoritative" },
        },
      ],
      {
        receptionId: "reception-shared-looking-id",
        businessDate: "2026-08-25",
      },
      "patient-attacker-selected",
    );

    expect(result).toEqual({ status: "patient-mismatch" });
  });
});
