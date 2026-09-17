import { describe, expect, it } from "vitest";

import {
  coverageListQuerySchema,
  coverageListResponseSchema,
  coverageRecordRequestSchema,
  coverageRecordResponseSchema,
  coverageRowIdSchema,
  insuranceCardSchema,
  publicExpenseSchema,
} from "./coverage.js";

const cardFields = {
  insurerNumber: "12345678",
  insuredSymbol: "SYN-001",
  insuredNumber: "0001",
  relationship: "self" as const,
  copayRatio: 0.3,
  validFrom: "2026-04-01",
};

const expenseFields = {
  payerNumber: "98765432",
  recipientNumber: "RCV-0001",
  priority: 1,
  validFrom: "2026-04-01",
};

const cardRow = {
  insuranceCardId: "insurance-card-0001",
  ...cardFields,
  validTo: null,
  supersededBy: null,
  recordedAt: "2026-09-18T00:00:00.000Z",
};

const expenseRow = {
  publicExpenseId: "public-expense-0001",
  ...expenseFields,
  validTo: null,
  supersededBy: null,
  recordedAt: "2026-09-18T00:00:00.000Z",
};

describe("coverage contract schemas (API-020 / WP-7203)", () => {
  it("accepts the three POST kinds and validates each shape", () => {
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "insurance-card",
        ...cardFields,
      }).success,
    ).toBe(true);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "public-expense",
        ...expenseFields,
      }).success,
    ).toBe(true);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "supersede",
        targetKind: "insurance-card",
        targetId: "insurance-card-0001",
        ...cardFields,
      }).success,
    ).toBe(true);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "supersede",
        targetKind: "public-expense",
        targetId: "public-expense-0001",
        ...expenseFields,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown kind and missing required fields", () => {
    expect(
      coverageRecordRequestSchema.safeParse({ kind: "delete", targetId: "x" })
        .success,
    ).toBe(false);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "insurance-card",
        payerNumber: "1",
      }).success,
    ).toBe(false);
    // supersede は targetKind で再分岐 — 対象 kind の必須項目が無いものは拒否。
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "supersede",
        targetKind: "insurance-card",
        targetId: "insurance-card-0001",
        payerNumber: "1",
        recipientNumber: "2",
        priority: 1,
        validFrom: "2026-04-01",
      }).success,
    ).toBe(false);
  });

  it("rejects copayRatio outside (0,1) and non-positive priority", () => {
    for (const copayRatio of [0, 1, -0.1, 1.5]) {
      expect(
        coverageRecordRequestSchema.safeParse({
          kind: "insurance-card",
          ...cardFields,
          copayRatio,
        }).success,
      ).toBe(false);
    }
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "public-expense",
        ...expenseFields,
        priority: 0,
      }).success,
    ).toBe(false);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "public-expense",
        ...expenseFields,
        priority: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects validTo before validFrom and non-real calendar dates", () => {
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "insurance-card",
        ...cardFields,
        validTo: "2026-03-31",
      }).success,
    ).toBe(false);
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "insurance-card",
        ...cardFields,
        validFrom: "2026-02-30",
      }).success,
    ).toBe(false);
    // validTo = validFrom(同日)は契約上受理(以降 = 同日を含む)。
    expect(
      coverageRecordRequestSchema.safeParse({
        kind: "insurance-card",
        ...cardFields,
        validTo: "2026-04-01",
      }).success,
    ).toBe(true);
  });

  it("requires asOf in the GET query and rejects invalid dates", () => {
    expect(coverageListQuerySchema.safeParse({}).success).toBe(false);
    expect(coverageListQuerySchema.safeParse({ asOf: "2026-09-18" }).success).toBe(
      true,
    );
    expect(
      coverageListQuerySchema.safeParse({ asOf: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("round-trips row schemas and the list/record responses", () => {
    expect(insuranceCardSchema.safeParse(cardRow).success).toBe(true);
    expect(publicExpenseSchema.safeParse(expenseRow).success).toBe(true);
    expect(
      coverageListResponseSchema.safeParse({
        patientId: "patient-001",
        asOf: "2026-09-18",
        insuranceCards: [cardRow],
        publicExpenses: [expenseRow],
      }).success,
    ).toBe(true);
    // POST 応答は行そのもの(envelope なし — API-020 §2)。
    expect(coverageRecordResponseSchema.safeParse(cardRow).success).toBe(true);
    expect(coverageRecordResponseSchema.safeParse(expenseRow).success).toBe(
      true,
    );
    expect(
      coverageRecordResponseSchema.safeParse({
        kind: "insurance-card",
        insuranceCard: cardRow,
      }).success,
    ).toBe(false);
  });

  it("rejects control characters and blank coverage ids", () => {
    expect(coverageRowIdSchema.safeParse("").success).toBe(false);
    expect(coverageRowIdSchema.safeParse("   ").success).toBe(false);
    expect(coverageRowIdSchema.safeParse("id\tcontrol").success).toBe(false);
    expect(coverageRowIdSchema.safeParse("coverage-0001").success).toBe(true);
  });
});
