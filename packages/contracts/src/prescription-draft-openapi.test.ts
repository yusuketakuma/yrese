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
  });
});
