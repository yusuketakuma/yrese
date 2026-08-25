import { describe, expect, it } from "vitest";

import { getOperatorFocusGroups } from "./operator-focus-board";

describe("operator focus projections", () => {
  it("shows both operational perspectives in the combined projection", () => {
    expect(getOperatorFocusGroups("combined").map((group) => group.id)).toEqual([
      "clerk",
      "pharmacist",
    ]);
  });

  it("never represents an unavailable derived queue as zero", () => {
    for (const view of ["combined", "clerk", "pharmacist"] as const) {
      const unavailable = getOperatorFocusGroups(view)
        .flatMap((group) => group.items)
        .filter((item) => item.status === "UNAVAILABLE");

      expect(unavailable.length).toBeGreaterThan(0);
      for (const item of unavailable) {
        expect(item.detail).not.toBe("0件");
      }
    }
  });

  it("keeps the wired reception queue only in the clerk projection", () => {
    const clerkIds = getOperatorFocusGroups("clerk").flatMap((group) =>
      group.items.map((item) => item.id),
    );
    const pharmacistIds = getOperatorFocusGroups("pharmacist").flatMap((group) =>
      group.items.map((item) => item.id),
    );

    expect(clerkIds).toContain("reception-wired");
    expect(pharmacistIds).not.toContain("reception-wired");
  });
});
