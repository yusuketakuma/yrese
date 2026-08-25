import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch tenant scope", () => {
  it("cannot authorize a reception absent from the authenticated queue", () => {
    expect(
      validateReceptionLaunchEntry(
        [{ receptionId: "tenant-a-reception", patientId: "patient-a" }],
        {
          receptionId: "tenant-b-reception",
          patientId: "patient-a",
          businessDate: "2026-08-25",
        },
      ),
    ).toEqual({ status: "not-found" });
  });
});
