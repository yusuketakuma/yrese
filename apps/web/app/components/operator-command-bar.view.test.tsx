import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { OperatorCommandBar, OPERATOR_QUICK_LINKS } from "./operator-command-bar";

(globalThis as { React?: typeof React }).React = React;

describe("OperatorCommandBar view", () => {
  it("exposes privacy-aware keyboard navigation without enabling voice capture", () => {
    const html = renderToStaticMarkup(<OperatorCommandBar />);

    expect(html).toContain('aria-keyshortcuts="/ Control+K Meta+K"');
    expect(html).toContain("Escapeキー");
    expect(html).toContain("患者名は入れず業務名で検索");
    expect(html).toContain("承認済み音声処理境界");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>音声<\/button>/);
    expect(html).not.toContain("山田さんを検索して");
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
    expect(html).toContain('aria-label="主要業務へのショートカット"');
    for (const item of OPERATOR_QUICK_LINKS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
  });
});
