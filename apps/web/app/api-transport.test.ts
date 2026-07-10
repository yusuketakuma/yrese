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
    {
      name: "accepts development localhost HTTP",
      environment: { nodeEnv: "development", publicApiBase: "http://localhost:3001/" },
      expected: "http://localhost:3001",
    },
    {
      name: "accepts development IPv4 loopback HTTP",
      environment: { nodeEnv: "development", publicApiBase: "http://127.0.0.1:3001/api/" },
      expected: "http://127.0.0.1:3001/api",
    },
    {
      name: "accepts development IPv6 loopback HTTP",
      environment: { nodeEnv: "development", publicApiBase: "http://[::1]:3001/" },
      expected: "http://[::1]:3001",
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
    { nodeEnv: "production", publicApiBase: "https://@api.example.test" },
    { nodeEnv: "production", publicApiBase: "https://:@api.example.test" },
    { nodeEnv: "production", publicApiBase: "https://api.example.test?q=secret" },
    { nodeEnv: "production", publicApiBase: "https://api.example.test?" },
    { nodeEnv: "production", publicApiBase: "https://api.example.test#" },
    { nodeEnv: "production", publicApiBase: "http://api.example.test" },
    { nodeEnv: "production", publicApiBase: "http://127.0.0.1:3001" },
    { nodeEnv: "staging", publicApiBase: "http://api.example.test" },
    { nodeEnv: "test", publicApiBase: "http://localhost:3001" },
    { nodeEnv: "preview", publicApiBase: "http://api.example.test" },
    { nodeEnv: undefined, publicApiBase: "http://api.example.test" },
    { nodeEnv: "development", publicApiBase: "http://api.example.test" },
    { nodeEnv: "development", publicApiBase: "http://192.168.1.10:3001" },
    { nodeEnv: "development", publicApiBase: "http://localhost.example.test:3001" },
  ])("fails closed for an unavailable or unsafe base: %j", (environment) => {
    expect(() => resolveWebApiBase(environment)).toThrow(
      ApiTransportConfigurationError,
    );
  });

  it("does not echo a rejected HTTP base in the configuration error", () => {
    const sensitiveBase = "http://patient-data.internal.example.test/private";
    let thrown: unknown;
    try {
      resolveWebApiBase({ nodeEnv: "production", publicApiBase: sensitiveBase });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiTransportConfigurationError);
    expect((thrown as Error).message).not.toContain(sensitiveBase);
    expect((thrown as Error).message).toBe(
      "Web API endpoint configuration is unavailable.",
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
