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

  it("names the blocking API or gate on every unavailable focus item", () => {
    // 未接続項目は「どの API / どのゲートで止まっているか」を必ず名指しし、
    // 件数不明を 0 件・確認済みと読ませない(UIX-001 §6 / §11)。
    const namesApiOrGate = /(?:GET \/[a-z-]|API|BLOCKED_[A-Z_]+|SCR-\d{3}|RB-\d{3})/u;

    for (const item of getOperatorFocusGroups("combined").flatMap(
      (group) => group.items,
    )) {
      if (item.status !== "UNAVAILABLE") continue;
      expect(item.detail).toMatch(namesApiOrGate);
      expect(item.detail).toMatch(/導出不能|意味しません/u);
      expect(item.href).toBeUndefined();
    }
  });

  it("gives a real destination to the only wired focus item", () => {
    const wired = getOperatorFocusGroups("combined")
      .flatMap((group) => group.items)
      .filter((item) => item.status === "WIRED");

    expect(wired.map((item) => item.id)).toEqual(["reception-wired"]);
    expect(wired[0]?.href).toBe("#reception-live-queue");
    expect(wired[0]?.detail).toContain("GET /reception/queue");
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
