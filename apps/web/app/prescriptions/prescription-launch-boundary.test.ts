import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch authorization evidence", () => {
  it("requires an entry from the authenticated queue", () => {
    expect(
      validateReceptionLaunchEntry(
        [],
        {
          receptionId: "route-only-reception",
          businessDate: "2026-08-25",
        },
        "selected-patient",
      ),
    ).toEqual({ status: "not-found" });
  });
});
