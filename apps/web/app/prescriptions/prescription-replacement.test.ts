import { describe, expect, it } from "vitest";

import {
  buildDraftRowsFromPastPrescription,
  createBlankDraftRows,
  filterPastPrescriptions,
  removeDraftRow,
  summarizePrescriptionReplacement,
  type PastPrescription,
} from "./prescription-replacement";

const FIXTURES: readonly PastPrescription[] = [
  {
    date: "2026/08/24",
    rows: [
      { drug: "薬A", usage: "朝", days: "7", quantity: "7錠" },
      { drug: "薬B", usage: "夕", days: "7", quantity: "7錠" },
    ],
  },
  {
    date: "2026/07/24",
    rows: [{ drug: "薬A", usage: "朝", days: "14", quantity: "14錠" }],
  },
];

describe("prescription replacement policy", () => {
  it("starts from one blank row and copies stored rows exactly", () => {
    expect(createBlankDraftRows()).toEqual([
      { id: 1, drug: "", usage: "", days: "", quantity: "" },
    ]);
    expect(buildDraftRowsFromPastPrescription(FIXTURES[1]!)).toEqual([
      { id: 1, drug: "薬A", usage: "朝", days: "14", quantity: "14錠" },
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

  it("normalizes history search", () => {
    expect(filterPastPrescriptions(FIXTURES, "２０２６／０７")).toHaveLength(1);
    expect(filterPastPrescriptions(FIXTURES, "14日")).toHaveLength(1);
  });

  it("compares duplicate same-drug rows as a multiset", () => {
    const summary = summarizePrescriptionReplacement(
      [
        { id: 1, drug: "同一薬10mg", usage: "朝", days: "7", quantity: "7錠" },
        { id: 2, drug: "同一薬10mg", usage: "夕", days: "7", quantity: "7錠" },
        { id: 3, drug: "同一薬10mg", usage: "就寝前", days: "7", quantity: "7錠" },
      ],
      {
        date: "2026/08/01",
        rows: [
          { drug: "同一薬10mg", usage: "朝", days: "7", quantity: "7錠" },
          { drug: "同一薬10mg", usage: "夕", days: "14", quantity: "14錠" },
        ],
      },
    );

    expect(summary).toEqual({ added: 0, removed: 1, changed: 1, unchanged: 1 });
  });
});
