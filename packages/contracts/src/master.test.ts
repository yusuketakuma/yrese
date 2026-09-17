import { describe, expect, it } from "vitest";

import {
  masterMedicationsResponseSchema,
  masterQuerySchema,
  masterUsagesResponseSchema,
  masterVersionSchema,
  medicationItemSchema,
  usageItemSchema,
} from "./master.js";

const version = {
  masterVersionId: "00000000-0000-4000-8000-00000000a001",
  masterKind: "medication",
  version: "SYN-2026-001",
  validFrom: "2026-01-01",
  validTo: null,
  transitionNote: null,
  distributionState: "synthetic",
};

const medication = {
  medicationItemId: "00000000-0000-4000-8000-000000000001",
  localCode: "SYN-MED-001",
  yjCode: "SYN-YJ-0001",
  receiptCode: null,
  hotCode: null,
  name: "合成内服薬アルファ錠10mg",
  unit: "錠",
  price: 1000,
  genericFlag: "originator",
  genericNameCode: "SYN-GN-0001",
  controlCategories: [],
};

const usage = {
  usageItemId: "00000000-0000-4000-8000-000000001001",
  localCode: "SYN-USG-001",
  text: "朝食後",
  timesPerDay: 1,
  mealTiming: "after",
  jahisCode: null,
};

describe("masterQuerySchema", () => {
  it("requires an explicit asOf (no implicit today)", () => {
    expect(masterQuerySchema.safeParse({}).success).toBe(false);
    expect(
      masterQuerySchema.safeParse({ asOf: "2026-06-01" }).success,
    ).toBe(true);
  });

  it("rejects non-real calendar dates and year 0000", () => {
    for (const asOf of ["2026-02-30", "0000-01-01", "not-a-date"]) {
      expect(masterQuerySchema.safeParse({ asOf }).success).toBe(false);
    }
  });

  it("accepts q up to 100 chars and rejects 101", () => {
    expect(
      masterQuerySchema.safeParse({ asOf: "2026-06-01", q: "x".repeat(100) })
        .success,
    ).toBe(true);
    expect(
      masterQuerySchema.safeParse({ asOf: "2026-06-01", q: "x".repeat(101) })
        .success,
    ).toBe(false);
  });
});

describe("master item schemas", () => {
  it("accepts a synthetic medication item with nullable price", () => {
    expect(medicationItemSchema.safeParse(medication).success).toBe(true);
    expect(
      medicationItemSchema.safeParse({ ...medication, price: null }).success,
    ).toBe(true);
  });

  it("rejects unknown genericFlag and non-integer price", () => {
    expect(
      medicationItemSchema.safeParse({ ...medication, genericFlag: "forbidden" })
        .success,
    ).toBe(false);
    expect(
      medicationItemSchema.safeParse({ ...medication, price: 10.5 }).success,
    ).toBe(false);
  });

  it("accepts as-needed usage with null timesPerDay", () => {
    expect(
      usageItemSchema.safeParse({
        ...usage,
        timesPerDay: null,
        mealTiming: "asNeeded",
      }).success,
    ).toBe(true);
  });
});

describe("master response schemas", () => {
  it("allows null masterVersion (no version covers asOf)", () => {
    expect(
      masterMedicationsResponseSchema.safeParse({
        masterVersion: null,
        items: [],
      }).success,
    ).toBe(true);
  });

  it("round-trips a populated response", () => {
    const parsed = masterMedicationsResponseSchema.parse({
      masterVersion: version,
      items: [medication],
    });
    expect(parsed.items).toHaveLength(1);
    expect(
      masterUsagesResponseSchema.safeParse({
        masterVersion: { ...version, masterKind: "usage" },
        items: [usage],
      }).success,
    ).toBe(true);
  });

  it("rejects non-synthetic distributionState", () => {
    expect(
      masterVersionSchema.safeParse({
        ...version,
        distributionState: "official",
      }).success,
    ).toBe(false);
  });
});
