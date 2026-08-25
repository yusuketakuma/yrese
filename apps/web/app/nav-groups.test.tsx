import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BusinessNavView, NAV_GROUPS, NAV_ITEMS } from "./nav";

(globalThis as { React?: typeof React }).React = React;

describe("operator workflow navigation", () => {
  it("groups all routes without changing the established workflow order", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      "日次業務",
      "請求業務",
      "運用・保守",
    ]);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/patients",
      "/prescriptions",
      "/checkout",
      "/claim-check",
      "/monthly-closing",
      "/masters",
      "/sync-status",
      "/admin",
    ]);
  });

  it("marks exactly one matching route as current", () => {
    const html = renderToStaticMarkup(<BusinessNavView current="/claim-check" />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("日次業務");
    expect(html).toContain("請求業務");
    expect(html).toContain("運用・保守");
  });
});
