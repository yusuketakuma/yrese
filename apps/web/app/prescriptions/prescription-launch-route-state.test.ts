import { describe, expect, it } from "vitest";

import { validateReceptionLaunchEntry } from "./prescription-launch-context";

describe("prescription launch explicit states", () => {
  it("returns a named ready state for an exact match", () => {
    expect(
      validateReceptionLaunchEntry(
        [{ receptionId: "r-1", patientId: "p-1" }],
        { receptionId: "r-1", patientId: "p-1", businessDate: "2026-08-25" },
      ).status,
    ).toBe("ready");
  });
});
