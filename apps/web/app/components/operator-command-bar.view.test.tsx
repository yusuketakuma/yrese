import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OperatorCommandBar, OPERATOR_QUICK_LINKS } from "./operator-command-bar";

(globalThis as { React?: typeof React }).React = React;

describe("OperatorCommandBar view", () => {
  it("exposes keyboard-first navigation without enabling unapproved voice capture", () => {
    const html = renderToStaticMarkup(<OperatorCommandBar />);

    expect(html).toContain('aria-keyshortcuts="/"');
    expect(html).toContain("Escapeキー");
    expect(html).toContain("承認済み音声処理境界");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>音声<\/button>/);
  });

  it("offers only bounded links to existing workspaces", () => {
    expect(OPERATOR_QUICK_LINKS.map((item) => item.href)).toEqual([
      "/",
      "/patients",
      "/prescriptions",
      "/checkout",
      "/claim-check",
    ]);

    const html = renderToStaticMarkup(<OperatorCommandBar />);
    for (const item of OPERATOR_QUICK_LINKS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
  });
});
