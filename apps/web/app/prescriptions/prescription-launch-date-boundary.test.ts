import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch business date", () => {
  it.each(["2026/08/25", "2026-8-25", "", "20260825"])(
    "rejects %s",
    (date) => {
      expect(
        parsePrescriptionLaunchContext({
          receptionId: "reception-date",
          date,
        }).status,
      ).toBe("invalid");
    },
  );
});
