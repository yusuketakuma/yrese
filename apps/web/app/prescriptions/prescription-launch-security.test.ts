import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch security boundary", () => {
  it("does not authorize from a route patientId when the tenant-scoped queue says another patient", () => {
    const result = validateReceptionLaunchEntry(
      [
        {
          receptionId: "reception-shared-looking-id",
          patientId: "patient-authoritative",
        },
      ],
      {
        receptionId: "reception-shared-looking-id",
        patientId: "patient-attacker-selected",
        businessDate: "2026-08-25",
      },
    );

    expect(result).toEqual({ status: "patient-mismatch" });
  });
});
