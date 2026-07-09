import { describe, expect, it } from "vitest";

import { whoamiResponseSchema } from "./whoami.js";
import { WIRE_ID_MAX_LENGTH } from "./wire-id.js";

describe("whoamiResponseSchema", () => {
  it("accepts valid tenant context responses", () => {
    expect(
      whoamiResponseSchema.parse({
        tenantId: "t-dev",
        pharmacyId: "ph-dev",
        actorId: "user-dev-001",
        scopes: ["tenant:read", "claim:read"],
      }),
    ).toEqual({
      tenantId: "t-dev",
      pharmacyId: "ph-dev",
      actorId: "user-dev-001",
      scopes: ["tenant:read", "claim:read"],
    });
  });

  it.each(["tenant:read:extra", "claim:destroy", "not-a-scope"] as const)(
    "rejects malformed or unregistered scope %j",
    (scope) => {
      expect(() =>
        whoamiResponseSchema.parse({
          tenantId: "t-dev",
          pharmacyId: "ph-dev",
          actorId: "user-dev-001",
          scopes: [scope],
        }),
      ).toThrow(/scope/);
    },
  );

  it("rejects missing required fields", () => {
    expect(() =>
      whoamiResponseSchema.parse({
        tenantId: "t-dev",
        pharmacyId: "ph-dev",
        scopes: ["tenant:read"],
      }),
    ).toThrow();
  });

  it.each([
    ["tenantId", ""],
    ["tenantId", "   "],
    ["tenantId", "t-dev\u0000"],
    ["tenantId", "x".repeat(WIRE_ID_MAX_LENGTH + 1)],
    ["pharmacyId", ""],
    ["pharmacyId", "   "],
    ["pharmacyId", "ph-dev\u0000"],
    ["pharmacyId", "x".repeat(WIRE_ID_MAX_LENGTH + 1)],
    ["actorId", ""],
    ["actorId", "   "],
    ["actorId", "user-dev-001\u0000"],
    ["actorId", "x".repeat(WIRE_ID_MAX_LENGTH + 1)],
  ] as const)("rejects invalid %s wire value %j", (field, value) => {
    expect(() =>
      whoamiResponseSchema.parse({
        tenantId: "t-dev",
        pharmacyId: "ph-dev",
        actorId: "user-dev-001",
        scopes: ["tenant:read"],
        [field]: value,
      }),
    ).toThrow();
  });
});
