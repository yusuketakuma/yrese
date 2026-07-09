import { describe, expect, it } from "vitest";

import { whoamiResponseSchema } from "./whoami.js";

describe("whoamiResponseSchema", () => {
  it("accepts valid tenant context responses", () => {
    expect(
      whoamiResponseSchema.parse({
        tenantId: "tenant-001",
        pharmacyId: "pharmacy-001",
        actorId: "user-001",
        scopes: ["tenant:read", "claim:read"],
      }),
    ).toEqual({
      tenantId: "tenant-001",
      pharmacyId: "pharmacy-001",
      actorId: "user-001",
      scopes: ["tenant:read", "claim:read"],
    });
  });

  it.each(["tenant:read:extra", "claim:destroy", "not-a-scope"] as const)(
    "rejects malformed or unregistered scope %j",
    (scope) => {
      expect(() =>
        whoamiResponseSchema.parse({
          tenantId: "tenant-001",
          pharmacyId: "pharmacy-001",
          actorId: "user-001",
          scopes: [scope],
        }),
      ).toThrow(/scope/);
    },
  );

  it("rejects missing required fields", () => {
    expect(() =>
      whoamiResponseSchema.parse({
        tenantId: "tenant-001",
        pharmacyId: "pharmacy-001",
        scopes: ["tenant:read"],
      }),
    ).toThrow();
  });
});
