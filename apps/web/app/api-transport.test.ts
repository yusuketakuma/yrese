import { describe, expect, it } from "vitest";

import {
  ApiTransportConfigurationError,
  resolveWebApiBase,
  resolveWebApiUrl,
} from "./api-transport";

describe("web API transport (WP-4067)", () => {
  it.each([
    {
      name: "uses the same-origin proxy in development when unset",
      environment: { nodeEnv: "development", publicApiBase: undefined },
      expected: "/_yrese-api",
    },
    {
      name: "normalizes a configured same-origin base",
      environment: { nodeEnv: "production", publicApiBase: "/gateway/" },
      expected: "/gateway",
    },
    {
      name: "normalizes a configured HTTPS base",
      environment: {
        nodeEnv: "production",
        publicApiBase: "https://api.example.test/v1/",
      },
      expected: "https://api.example.test/v1",
    },
    {
      name: "accepts the same-origin root",
      environment: { nodeEnv: "production", publicApiBase: "/" },
      expected: "",
    },
  ])("$name", ({ environment, expected }) => {
    expect(resolveWebApiBase(environment)).toBe(expected);
  });

  it.each([
    { nodeEnv: "production", publicApiBase: undefined },
    { nodeEnv: "production", publicApiBase: "" },
    { nodeEnv: "test", publicApiBase: undefined },
    { nodeEnv: "test", publicApiBase: "" },
    { nodeEnv: "staging", publicApiBase: undefined },
    { nodeEnv: undefined, publicApiBase: undefined },
    { nodeEnv: "production", publicApiBase: "javascript:alert(1)" },
    { nodeEnv: "production", publicApiBase: "//other.example.test" },
    { nodeEnv: "production", publicApiBase: "/gateway?token=value" },
    { nodeEnv: "production", publicApiBase: "/gateway#fragment" },
    { nodeEnv: "production", publicApiBase: "/\\evil" },
    { nodeEnv: "production", publicApiBase: "https://user:secret@example.test" },
    { nodeEnv: "production", publicApiBase: "https://api.example.test?q=secret" },
  ])("fails closed for an unavailable or unsafe base: %j", (environment) => {
    expect(() => resolveWebApiBase(environment)).toThrow(
      ApiTransportConfigurationError,
    );
  });

  it("joins only root-relative request paths", () => {
    expect(
      resolveWebApiUrl("/patients/search?q=test", {
        nodeEnv: "development",
        publicApiBase: undefined,
      }),
    ).toBe("/_yrese-api/patients/search?q=test");
    expect(() =>
      resolveWebApiUrl("//other.example.test/path", {
        nodeEnv: "development",
        publicApiBase: undefined,
      }),
    ).toThrow(ApiTransportConfigurationError);
  });

  it("joins configured absolute and same-origin root bases exactly", () => {
    expect(
      resolveWebApiUrl("/reception", {
        nodeEnv: "production",
        publicApiBase: "https://api.example.test/v1/",
      }),
    ).toBe("https://api.example.test/v1/reception");
    expect(
      resolveWebApiUrl("/patients/search?q=test", {
        nodeEnv: "production",
        publicApiBase: "/",
      }),
    ).toBe("/patients/search?q=test");
  });
});
