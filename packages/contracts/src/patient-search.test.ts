import { describe, expect, it } from "vitest";

import {
  ELIGIBILITY_STATUSES,
  PATIENT_SEARCH_CURSOR_MAX_LENGTH,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
} from "./patient-search.js";
import { WIRE_ID_MAX_LENGTH } from "./wire-id.js";

const validResult = {
  patientId: "patient-syn-001",
  name: "試験花子",
  kana: "シケンハナコ",
  birthDate: "1980-04-12",
  sex: "female",
  patientNumber: "SYN-001",
  eligibilityStatus: "VERIFIED",
  eligibilityCheckedAt: "2026-07-09T08:16:15.000Z",
} as const;

describe("patientSearchQuerySchema", () => {
  it("trims q and applies the default limit", () => {
    expect(patientSearchQuerySchema.parse({ q: "  シケン  " })).toEqual({
      q: "シケン",
      limit: 20,
    });
  });

  it.each([
    {},
    { q: "" },
    { q: "   " },
    { q: "x".repeat(101) },
    { q: "シケン", limit: 0 },
    { q: "シケン", limit: 51 },
    { q: "シケン", cursor: "x".repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH + 1) },
  ])("rejects invalid query %#", (value) => {
    expect(() => patientSearchQuerySchema.parse(value)).toThrow();
  });

  it("accepts cursors up to the approved opaque cursor length limit", () => {
    const cursor = "x".repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH);

    expect(patientSearchQuerySchema.parse({ q: "シケン", cursor })).toEqual({
      q: "シケン",
      limit: 20,
      cursor,
    });
  });
});

describe("patientSearchResultSchema", () => {
  it("accepts valid patient search results", () => {
    expect(patientSearchResultSchema.parse(validResult)).toEqual(validResult);
  });

  it("accepts existing dev wire patient IDs as plain strings", () => {
    expect(
      patientSearchResultSchema.parse({
        ...validResult,
        patientId: "patient-dev-001",
      }).patientId,
    ).toBe("patient-dev-001");
  });

  it("exports the approved eligibility status values", () => {
    expect(ELIGIBILITY_STATUSES).toEqual([
      "VERIFIED",
      "PENDING_REVERIFY",
      "LOCAL_ONLY_UNVERIFIED",
      "NOT_CHECKED",
    ]);
  });

  it("rejects invalid result shapes", () => {
    expect(() =>
      patientSearchResultSchema.parse({
        ...validResult,
        eligibilityStatus: "CONFIRMED",
      }),
    ).toThrow();
    expect(() =>
      patientSearchResultSchema.parse({
        ...validResult,
        birthDate: "19800412",
      }),
    ).toThrow();
  });

  it.each(["", "   ", "patient-dev-001\u0000", "x".repeat(WIRE_ID_MAX_LENGTH + 1)])(
    "rejects invalid patientId wire value %j",
    (patientId) => {
      expect(() =>
        patientSearchResultSchema.parse({
          ...validResult,
          patientId,
        }),
      ).toThrow();
    },
  );
});

describe("patientSearchResponseSchema", () => {
  it("accepts paginated responses", () => {
    expect(
      patientSearchResponseSchema.parse({
        results: [validResult],
        nextCursor: "opaque-cursor",
      }),
    ).toEqual({
      results: [validResult],
      nextCursor: "opaque-cursor",
    });
  });

  it("rejects oversized response cursors", () => {
    expect(() =>
      patientSearchResponseSchema.parse({
        results: [validResult],
        nextCursor: "x".repeat(PATIENT_SEARCH_CURSOR_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("rejects missing results", () => {
    expect(() => patientSearchResponseSchema.parse({ nextCursor: "cursor" })).toThrow();
  });
});
