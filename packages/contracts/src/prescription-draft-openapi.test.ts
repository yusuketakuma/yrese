import { describe, expect, it } from "vitest";

import { createYreseOpenApiDocument } from "./openapi.js";

describe("prescription draft OpenAPI projection", () => {
  it("publishes the bounded read/write path with no-store and explicit scopes", () => {
    const document = createYreseOpenApiDocument();
    const path = document.paths?.["/prescription-drafts/by-reception/{receptionId}"];

    expect(path?.get?.operationId).toBe("getPrescriptionDraftByReception");
    expect(path?.put?.operationId).toBe("savePrescriptionDraftByReception");
    expect(path?.get?.["x-yrese-required-scopes"]).toEqual([
      "prescription:read",
      "reception:read",
      "patient:read",
    ]);
    expect(path?.put?.["x-yrese-required-scopes"]).toEqual([
      "prescription:write",
      "reception:read",
      "patient:read",
    ]);
    expect(path?.get?.responses?.["200"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    expect(path?.get?.responses?.["204"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    expect(path?.get?.responses?.["204"]).not.toHaveProperty("content");
    expect(path?.put?.responses?.["409"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    expect(path?.put?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "header",
          name: "if-match",
        }),
      ]),
    );
    expect(
      path?.put?.parameters?.find(
        (parameter) => "name" in parameter && parameter.name === "if-match",
      ),
    ).not.toMatchObject({ required: true });
  });

  it("publishes the WP-7304 from-prior copy path with no-store and scopes", () => {
    const document = createYreseOpenApiDocument();
    const path =
      document.paths?.[
        "/prescription-drafts/by-reception/{receptionId}/from-prior"
      ];

    expect(path?.post?.operationId).toBe("createPrescriptionDraftFromPrior");
    expect(path?.post?.["x-yrese-required-scopes"]).toEqual([
      "prescription:write",
      "reception:read",
      "patient:read",
    ]);
    expect(path?.post?.responses?.["201"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    expect(path?.post?.responses?.["404"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    expect(path?.post?.responses?.["409"]?.headers).toHaveProperty(
      "Cache-Control",
    );
    // Idempotency-Key を要求しない(reception 一意で fail-closed)。
    expect(path?.post?.parameters ?? []).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ in: "header", name: "idempotency-key" }),
      ]),
    );
  });
});
