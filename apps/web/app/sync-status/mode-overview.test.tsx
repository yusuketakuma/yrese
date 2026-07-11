import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SYSTEM_MODES } from "@yrese/shared-kernel";

import { ModeOverviewTable } from "./mode-overview";

(globalThis as { React?: typeof React }).React = React;

describe("ModeOverviewTable (SCR-027 / P-19 非常時リファレンス)", () => {
  it("lists every system mode and marks the current one", () => {
    const html = renderToStaticMarkup(<ModeOverviewTable currentMode="NORMAL" />);
    for (const mode of SYSTEM_MODES) {
      expect(html).toContain(`data-mode="${mode}"`);
    }
    expect(html).toContain("(現在)");
    expect(html).toContain('data-current="true"');
  });

  it("derives capabilities from shared-kernel guards (LOCAL_ONLY は確定算定不可・NORMAL のみ締め可)", () => {
    const html = renderToStaticMarkup(<ModeOverviewTable currentMode="LOCAL_ONLY" />);
    // LOCAL_ONLY 行: 3列すべて不可
    const localOnlyRow = html.split('data-mode="LOCAL_ONLY"')[1]?.split("</tr>")[0] ?? "";
    expect(localOnlyRow).not.toContain('data-allowed="true"');
    // NORMAL 行: 3列すべて可
    const normalRow = html.split('data-mode="NORMAL"')[1]?.split("</tr>")[0] ?? "";
    expect(normalRow).not.toContain('data-allowed="false"');
    // CLOUD_DEGRADED 行: 締めのみ不可(外部確認・確定算定は可)
    const degradedRow = html.split('data-mode="CLOUD_DEGRADED"')[1]?.split("</tr>")[0] ?? "";
    expect(degradedRow).toContain('data-allowed="true"');
    expect(degradedRow).toContain('data-allowed="false"');
  });

  it("expresses availability as text (可/不可), not color alone", () => {
    const html = renderToStaticMarkup(<ModeOverviewTable currentMode="NORMAL" />);
    expect(html).toContain(">可<");
    expect(html).toContain(">不可<");
  });
});
