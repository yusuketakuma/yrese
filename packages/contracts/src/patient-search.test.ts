import { describe, expect, it } from "vitest";

import {
  ELIGIBILITY_STATUSES,
  PATIENT_SEARCH_CURSOR_MAX_LENGTH,
  PATIENT_SEARCH_DEFAULT_LIMIT,
  patientCreateRequestSchema,
  patientCreateResponseSchema,
  patientIdempotencyKeySchema,
  patientSearchQuerySchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
  patientUpdateRequestSchema,
  patientUpdateResponseSchema,
  patientVersionedSummarySchema,
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
  it("exports the approved default page limit", () => {
    expect(PATIENT_SEARCH_DEFAULT_LIMIT).toBe(20);
  });

  it("trims q and applies the default limit", () => {
    expect(patientSearchQuerySchema.parse({ q: "  シケン  " })).toEqual({
      q: "シケン",
      limit: PATIENT_SEARCH_DEFAULT_LIMIT,
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
      limit: PATIENT_SEARCH_DEFAULT_LIMIT,
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

describe("patientCreateRequestSchema (WP-7202 / API-001 0.3.0)", () => {
  const validCreate = {
    name: "試験花子",
    kana: "シケンハナコ",
    birthDate: "1980-04-12",
    sex: "female",
  } as const;

  it("accepts a valid create request without patientNumber", () => {
    expect(patientCreateRequestSchema.parse(validCreate)).toEqual(validCreate);
  });

  it("accepts an explicit patientNumber", () => {
    expect(
      patientCreateRequestSchema.parse({ ...validCreate, patientNumber: "K-100" }),
    ).toEqual({ ...validCreate, patientNumber: "K-100" });
  });

  it.each<[Record<string, unknown>, string]>([
    [{ ...validCreate, kana: undefined }, "kana required"],
    [{ ...validCreate, birthDate: "2026-02-30" }, "non-existent calendar date"],
    [{ ...validCreate, birthDate: "1980-4-12" }, "non-ISO date"],
    [{ ...validCreate, sex: "other" }, "sex enum"],
    [{ ...validCreate, name: "" }, "empty name"],
    [{ ...validCreate, name: "x".repeat(129) }, "name over max"],
    [{ ...validCreate, kana: "x".repeat(129) }, "kana over max"],
    [{ ...validCreate, patientNumber: "" }, "empty patientNumber"],
    [{ ...validCreate, patientNumber: "x".repeat(65) }, "patientNumber over max"],
    [{ ...validCreate, phone: "090-0000-0000" }, "unspecified field tolerated at schema level"],
  ])("rejects or tolerates case %#", (value) => {
    // phone 等の未指定フィールドは z.object 既定で strip される(fail-closed は
    // route 層の `patientNumber in body` 検査が担う)。schema 受理可否だけを確認。
    if ("phone" in value) {
      const parsed = patientCreateRequestSchema.parse(value);
      expect("phone" in parsed).toBe(false);
      return;
    }
    expect(() => patientCreateRequestSchema.parse(value)).toThrow();
  });
});

describe("patientUpdateRequestSchema", () => {
  it("requires expectedVersion and at least one updatable field", () => {
    expect(() =>
      patientUpdateRequestSchema.parse({ expectedVersion: 1 }),
    ).toThrow();
    expect(() => patientUpdateRequestSchema.parse({ name: "x" })).toThrow();
    expect(
      patientUpdateRequestSchema.parse({ expectedVersion: 2, kana: "シケン" }),
    ).toEqual({ expectedVersion: 2, kana: "シケン" });
  });

  it.each<[Record<string, unknown>, string]>([
    [{ expectedVersion: 0, name: "x" }, "version must be >= 1"],
    [{ expectedVersion: 1.5, name: "x" }, "version must be int"],
    [{ expectedVersion: 1, birthDate: "2026-02-30" }, "non-existent calendar date"],
    [{ expectedVersion: 1, sex: "other" }, "sex enum"],
  ])("rejects %#", (value) => {
    expect(() => patientUpdateRequestSchema.parse(value)).toThrow();
  });
});

describe("patientIdempotencyKeySchema", () => {
  it("accepts the API-013 alphabet within length bounds", () => {
    expect(patientIdempotencyKeySchema.parse("a".repeat(16))).toBe("a".repeat(16));
    expect(
      patientIdempotencyKeySchema.parse("A-Z_0-9".repeat(19).slice(0, 128)),
    ).toHaveLength(128);
  });

  it.each([
    ["short-key", "below 16 chars"],
    ["x".repeat(129), "over 128 chars"],
    ["has space padding!!", "non-alphabet"],
    ["", "empty"],
  ])("rejects %s", (value) => {
    expect(() => patientIdempotencyKeySchema.parse(value)).toThrow();
  });
});

describe("patientVersionedSummarySchema / responses", () => {
  it("extends the search result with version", () => {
    expect(
      patientVersionedSummarySchema.parse({ ...validResult, version: 3 })
        .version,
    ).toBe(3);
    expect(() =>
      patientVersionedSummarySchema.parse({ ...validResult, version: 0 }),
    ).toThrow();
    expect(() => patientVersionedSummarySchema.parse(validResult)).toThrow();
  });

  it("accepts a create response with a duplicate warning capped at 5 candidates", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      ...validResult,
      patientId: `patient-syn-${String(i).padStart(3, "0")}`,
      patientNumber: `SYN-${String(i).padStart(3, "0")}`,
    }));
    const parsed = patientCreateResponseSchema.parse({
      patient: { ...validResult, version: 1 },
      warnings: [{ type: "POSSIBLE_DUPLICATE", candidates }],
    });
    expect(parsed.warnings?.[0]?.candidates).toHaveLength(5);

    expect(() =>
      patientCreateResponseSchema.parse({
        patient: { ...validResult, version: 1 },
        warnings: [
          {
            type: "POSSIBLE_DUPLICATE",
            candidates: [
              ...candidates,
              { ...validResult, patientId: "patient-syn-006", patientNumber: "SYN-006" },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts an update response shape", () => {
    expect(
      patientUpdateResponseSchema.parse({
        patient: { ...validResult, version: 2 },
      }),
    ).toEqual({ patient: { ...validResult, version: 2 } });
  });
});
