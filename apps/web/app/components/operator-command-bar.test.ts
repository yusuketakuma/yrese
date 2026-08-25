import { describe, expect, it } from "vitest";

import {
  resolveOperatorIntent,
  shouldFocusOperatorCommand,
} from "./operator-command-policy";

describe("operator command policy", () => {
  it("maps explicit bounded requests to existing workspaces", () => {
    expect(resolveOperatorIntent("山田さんの患者情報を検索して")?.href).toBe("/patients");
    expect(resolveOperatorIntent("未収の会計を確認")?.href).toBe("/checkout");
    expect(resolveOperatorIntent("電子処方箋を取り込みたい")?.href).toBe("/");
    expect(resolveOperatorIntent("月次締めを開く")?.href).toBe("/monthly-closing");
  });

  it("rejects weak or competing intents instead of choosing the first match", () => {
    expect(resolveOperatorIntent("薬")).toBeNull();
    expect(resolveOperatorIntent("エラー")).toBeNull();
    expect(resolveOperatorIntent("患者検索と会計を同時に開いて")).toBeNull();
    expect(resolveOperatorIntent("この内容を自動で全部確定して")).toBeNull();
  });

  it("normalizes full-width text while preserving bounded routing", () => {
    expect(resolveOperatorIntent("ＱＲで処方箋を取り込む")?.href).toBe("/");
  });

  it("does not steal shortcuts from clinical text entry or IME composition", () => {
    expect(
      shouldFocusOperatorCommand({ key: "/", targetIsTextEntry: false }),
    ).toBe(true);
    expect(
      shouldFocusOperatorCommand({ key: "/", targetIsTextEntry: true }),
    ).toBe(false);
    expect(
      shouldFocusOperatorCommand({
        key: "k",
        ctrlKey: true,
        targetIsTextEntry: true,
        targetIsCommandInput: false,
      }),
    ).toBe(false);
    expect(
      shouldFocusOperatorCommand({
        key: "k",
        metaKey: true,
        targetIsTextEntry: true,
        targetIsCommandInput: true,
      }),
    ).toBe(true);
    expect(
      shouldFocusOperatorCommand({
        key: "/",
        isComposing: true,
        targetIsTextEntry: false,
      }),
    ).toBe(false);
    expect(
      shouldFocusOperatorCommand({
        key: "k",
        altKey: true,
        ctrlKey: true,
        targetIsTextEntry: false,
      }),
    ).toBe(false);
  });
});
