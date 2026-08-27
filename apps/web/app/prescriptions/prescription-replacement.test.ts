import { describe, expect, it } from "vitest";

import {
  createBlankDraftRows,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";

describe("prescription draft row policy", () => {
  it("starts from exactly one blank row", () => {
    expect(createBlankDraftRows()).toEqual([
      { id: 1, drug: "", usage: "", days: "", quantity: "" },
    ]);
  });

  it("keeps at least one blank row after a confirmed row deletion", () => {
    expect(
      removeDraftRow(
        [{ id: 7, drug: "薬A", usage: "朝", days: "7", quantity: "7錠" }],
        7,
      ),
    ).toEqual([{ id: 1, drug: "", usage: "", days: "", quantity: "" }]);
  });

  it("removes only the confirmed row and preserves the remaining ids", () => {
    expect(
      removeDraftRow(
        [
          { id: 1, drug: "薬A", usage: "朝", days: "7", quantity: "7錠" },
          { id: 2, drug: "薬B", usage: "夕", days: "7", quantity: "7錠" },
        ],
        1,
      ),
    ).toEqual([{ id: 2, drug: "薬B", usage: "夕", days: "7", quantity: "7錠" }]);
  });

  it("treats width-variant and whitespace-only input as empty, not as entered content", () => {
    expect(
      isDraftRowEmpty({ drug: "　", usage: " ", days: "", quantity: "\t" }),
    ).toBe(true);
    expect(
      isDraftRowEmpty({ drug: "", usage: "", days: "７", quantity: "" }),
    ).toBe(false);
  });
});
