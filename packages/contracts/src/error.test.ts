import { describe, expect, it } from "vitest";

import { errorResponseSchema } from "./error.js";

describe("errorResponseSchema", () => {
  it("accepts PHI-free error responses", () => {
    expect(
      errorResponseSchema.parse({
        errorCode: "AUTH-0003",
        message: "Forbidden",
      }),
    ).toEqual({
      errorCode: "AUTH-0003",
      message: "Forbidden",
    });
  });

  it("rejects missing fields", () => {
    expect(() => errorResponseSchema.parse({ errorCode: "PAT-0001" })).toThrow();
  });

  it("rejects empty values", () => {
    expect(() =>
      errorResponseSchema.parse({
        errorCode: "",
        message: "Invalid patient search query",
      }),
    ).toThrow();
  });
});
