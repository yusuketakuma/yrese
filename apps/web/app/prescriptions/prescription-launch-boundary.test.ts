import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch authorization evidence", () => {
  it("requires an entry from the authenticated queue", () => {
    expect(
      validateReceptionLaunchEntry([], {
        receptionId: "route-only-reception",
        patientId: "route-only-patient",
        businessDate: "2026-08-25",
      }),
    ).toEqual({ status: "not-found" });
  });
});
