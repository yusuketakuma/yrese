import { describe, expect, it } from "vitest";

import { resolveOperatorIntent } from "./operator-command-bar";

describe("resolveOperatorIntent", () => {
  it("maps bounded natural-language requests to existing workspaces", () => {
    expect(resolveOperatorIntent("山田さんの患者情報を検索して")?.href).toBe("/patients");
    expect(resolveOperatorIntent("未収の会計を確認")?.href).toBe("/checkout");
    expect(resolveOperatorIntent("電子処方箋を取り込みたい")?.href).toBe("/");
  });

  it("does not invent an action for an unknown request", () => {
    expect(resolveOperatorIntent("この内容を自動で全部確定して")).toBeNull();
  });
});
