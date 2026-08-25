import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch tenant scope", () => {
  it("cannot authorize a reception absent from the authenticated queue", () => {
    expect(
      validateReceptionLaunchEntry(
        [
          {
            receptionId: "tenant-a-reception",
            patient: { patientId: "patient-a" },
          },
        ],
        {
          receptionId: "tenant-b-reception",
          businessDate: "2026-08-25",
        },
        "patient-a",
      ),
    ).toEqual({ status: "not-found" });
  });
});
