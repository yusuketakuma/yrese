import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("accepts valid health responses", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        version: "0.0.1",
        timestamp: "2026-07-09T06:35:27.000Z",
      }),
    ).toEqual({
      status: "ok",
      service: "api",
      version: "0.0.1",
      timestamp: "2026-07-09T06:35:27.000Z",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        version: "0.0.1",
      }),
    ).toThrow();
  });

  it("rejects wrong literals", () => {
    expect(() =>
      healthResponseSchema.parse({
        status: "degraded",
        service: "api",
        version: "0.0.1",
        timestamp: "2026-07-09T06:35:27.000Z",
      }),
    ).toThrow();
  });
});
