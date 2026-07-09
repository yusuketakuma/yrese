import { describe, expect, it } from "vitest";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
} from "@yrese/shared-kernel";

import { errorResponseSchema } from "./error.js";

describe("errorResponseSchema", () => {
  it("accepts PHI-free error responses", () => {
    expect(
      errorResponseSchema.parse({
        errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
        message: "Forbidden",
      }),
    ).toEqual({
      errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
      message: "Forbidden",
    });
  });

  it("accepts existing wire error codes", () => {
    expect(
      errorResponseSchema.parse({
        errorCode: PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
        message: "Invalid patient search query",
      }),
    ).toEqual({
      errorCode: PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
      message: "Invalid patient search query",
    });
  });

  it("rejects missing fields", () => {
    expect(() =>
      errorResponseSchema.parse({ errorCode: PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE }),
    ).toThrow();
  });

  it("rejects empty values", () => {
    expect(() =>
      errorResponseSchema.parse({
        errorCode: "",
        message: "Invalid patient search query",
      }),
    ).toThrow();
  });

  it("rejects malformed error codes", () => {
    expect(() =>
      errorResponseSchema.parse({
        errorCode: "AUTH-3",
        message: "Forbidden",
      }),
    ).toThrow();

    expect(() =>
      errorResponseSchema.parse({
        errorCode: "not-a-code",
        message: "Forbidden",
      }),
    ).toThrow();
  });

  it("rejects well-formed but unregistered error codes", () => {
    expect(() =>
      errorResponseSchema.parse({
        errorCode: "SYSTEM-9999",
        message: "Unexpected system error",
      }),
    ).toThrow();
  });
});
