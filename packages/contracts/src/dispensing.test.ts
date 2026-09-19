import { describe, expect, it } from "vitest";

import {
  dispensingConfirmParamsSchema,
  dispensingConfirmRequestSchema,
  dispensingItemInputSchema,
  dispensingRecordCreateRequestSchema,
  dispensingRecordViewSchema,
} from "./dispensing.js";

const VALID_ITEM = {
  rpItemId: "00000000-0000-4000-8000-0000000000b1",
  dispensedMedicationItemId: "00000000-0000-4000-8000-0000000000d1",
  dispensedText: null,
  quantity: "7",
  remainingStockAdjustment: null,
  note: null,
} as const;

const VALID_CREATE = {
  prescriptionId: "prescription-0001",
  prescriptionVersion: 1,
  dispensingDate: "2026-08-25",
  items: [VALID_ITEM],
} as const;

describe("dispensing contract (WP-7404 / API-021)", () => {
  it("accepts a valid create request", () => {
    expect(
      dispensingRecordCreateRequestSchema.parse(VALID_CREATE),
    ).toEqual(VALID_CREATE);
  });

  it("requires exactly one of dispensedMedicationItemId or dispensedText", () => {
    expect(() =>
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        dispensedMedicationItemId: null,
        dispensedText: null,
      }),
    ).toThrow();
    expect(() =>
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        dispensedText: "両方指定は不可",
      }),
    ).toThrow();
    // free-text 経路は受理される。
    expect(
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        dispensedMedicationItemId: null,
        dispensedText: "マスター未収載品目",
      }),
    ).toMatchObject({ dispensedText: "マスター未収載品目" });
  });

  it("normalizes empty-after-trim dispensedText to null (XOR 不変条件)", () => {
    // "" は id 併記で永続化すると DB の XOR CHECK を破るため、
    // schema 段階で「指定なし」に正規化する。
    expect(
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        dispensedText: "  ",
      }),
    ).toMatchObject({ dispensedText: null });
    // 空文字のみの指定は「どちらも未指定」として拒否される。
    expect(() =>
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        dispensedMedicationItemId: null,
        dispensedText: "   ",
      }),
    ).toThrow();
  });

  it("rejects empty items, empty quantity, and non-integer version", () => {
    expect(() =>
      dispensingRecordCreateRequestSchema.parse({
        ...VALID_CREATE,
        items: [],
      }),
    ).toThrow();
    expect(() =>
      dispensingRecordCreateRequestSchema.parse({
        ...VALID_CREATE,
        items: [{ ...VALID_ITEM, quantity: "" }],
      }),
    ).toThrow();
    expect(() =>
      dispensingRecordCreateRequestSchema.parse({
        ...VALID_CREATE,
        prescriptionVersion: 0,
      }),
    ).toThrow();
    expect(() =>
      dispensingRecordCreateRequestSchema.parse({
        ...VALID_CREATE,
        dispensingDate: "2026/08/25",
      }),
    ).toThrow();
  });

  it("rejects unknown keys (strict) and extra item fields", () => {
    expect(() =>
      dispensingRecordCreateRequestSchema.parse({
        ...VALID_CREATE,
        patientName: "PHI は受けない",
      }),
    ).toThrow();
    // item レベルでも strict(未知 key を黙って strip しない)。
    expect(() =>
      dispensingItemInputSchema.parse({
        ...VALID_ITEM,
        strength: "10mg",
      }),
    ).toThrow();
  });

  it("accepts an empty confirm body and validates the path param", () => {
    expect(dispensingConfirmRequestSchema.parse({})).toEqual({});
    expect(() =>
      dispensingConfirmRequestSchema.parse({ note: "unexpected" }),
    ).toThrow();
    expect(
      dispensingConfirmParamsSchema.parse({ dispensingId: "dispensing-001" }),
    ).toEqual({ dispensingId: "dispensing-001" });
    expect(() =>
      dispensingConfirmParamsSchema.parse({ dispensingId: "" }),
    ).toThrow();
  });

  it("accepts a persisted record view with items echo", () => {
    const view = {
      dispensingId: "dispensing-0001",
      prescriptionId: "prescription-0001",
      prescriptionVersion: 2,
      dispensingDate: "2026-08-25",
      items: [
        {
          ...VALID_ITEM,
          prescribedMedicationItemId:
            "00000000-0000-4000-8000-0000000000d1",
          dispensedBy: "actor-001",
        },
      ],
      status: "DISPENSING_RECORDED" as const,
      confirmedBy: "actor-001",
      confirmedAt: "2026-08-25T01:00:00.000Z",
      createdBy: "actor-001",
      createdAt: "2026-08-25T00:30:00.000Z",
    };
    expect(dispensingRecordViewSchema.parse(view)).toEqual(view);
    expect(() =>
      dispensingRecordViewSchema.parse({ ...view, status: "INVALID" }),
    ).toThrow();
  });
});
