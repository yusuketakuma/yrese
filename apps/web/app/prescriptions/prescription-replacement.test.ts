import { describe, expect, it } from "vitest";

import {
  createBlankDraftRow,
  createBlankDraftRows,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";

describe("prescription draft row policy", () => {
  it("starts from exactly one blank row", () => {
    const rows = createBlankDraftRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      drug: "",
      usage: "",
      days: "",
      quantity: "",
      medicationMode: "text",
      usageMode: "text",
    });
    expect(rows[0]?.rpGroupId).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    expect(rows[0]?.rpItemId).not.toBe(rows[0]?.rpGroupId);
  });

  it("keeps at least one blank row after a confirmed row deletion", () => {
    const remaining = removeDraftRow(
      [
        {
          ...createBlankDraftRow(7),
          drug: "薬A",
          usage: "朝",
          days: "7",
          quantity: "7錠",
        },
      ],
      7,
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(1);
    expect(isDraftRowEmpty(remaining[0]!)).toBe(true);
  });

  it("removes only the confirmed row and preserves the remaining ids", () => {
    const rows = removeDraftRow(
      [
        {
          ...createBlankDraftRow(1),
          drug: "薬A",
          usage: "朝",
          days: "7",
          quantity: "7錠",
        },
        {
          ...createBlankDraftRow(2),
          drug: "薬B",
          usage: "夕",
          days: "7",
          quantity: "7錠",
        },
      ],
      1,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 2, drug: "薬B", usage: "夕" });
  });

  it("treats width-variant and whitespace-only input as empty, not as entered content", () => {
    expect(
      isDraftRowEmpty({
        ...createBlankDraftRow(1),
        drug: "　",
        usage: " ",
        quantity: "\t",
      }),
    ).toBe(true);
    expect(
      isDraftRowEmpty({ ...createBlankDraftRow(1), days: "７" }),
    ).toBe(false);
    expect(
      isDraftRowEmpty({
        ...createBlankDraftRow(1),
        usageMode: "code",
        usageItemId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toBe(false);
    // モード不整合な orphan id(text モードに残った選択値)は
    // 内容として数えない — phantom unresolved item 防止(R3 MEDIUM-2)。
    expect(
      isDraftRowEmpty({
        ...createBlankDraftRow(1),
        medicationMode: "text",
        medicationItemId: "00000000-0000-4000-8000-000000000002",
        masterVersionId: "00000000-0000-4000-8000-000000000003",
      }),
    ).toBe(true);
    // master モードで未選択の行は不完全入力 — 空扱いせず具体エラーへ。
    expect(
      isDraftRowEmpty({
        ...createBlankDraftRow(1),
        medicationMode: "master",
      }),
    ).toBe(false);
  });
});
