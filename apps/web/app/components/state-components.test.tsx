import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlockerBanner } from "./blocker-banner";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { SeverityList } from "./severity-list";
import { StatusBadge } from "./status-badge";

(globalThis as { React?: typeof React }).React = React;

describe("common state components (WP-3006)", () => {
  it("StatusBadge renders text label with role=status and tone/status attributes", () => {
    const html = renderToStaticMarkup(
      <StatusBadge label="資格再確認待ち" tone="pending" status="PENDING_REVERIFY" />,
    );

    expect(html).toContain("資格再確認待ち");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-tone="pending"');
    expect(html).toContain('data-status="PENDING_REVERIFY"');
  });

  it("BlockerBanner requires and renders blockerType, reason and next action as alert", () => {
    const html = renderToStaticMarkup(
      <BlockerBanner
        blockerType="SSOT_UPDATE_REQUIRED"
        reason="算定ルールの根拠が不足しています"
        nextAction="SSOT の改版を依頼してください"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('data-blocker-type="SSOT_UPDATE_REQUIRED"');
    expect(html).toContain("処理停止(BLOCKED): SSOT_UPDATE_REQUIRED");
    expect(html).toContain("算定ルールの根拠が不足しています");
    expect(html).toContain("次のアクション: SSOT の改版を依頼してください");
  });

  it("SeverityList labels severity as text and orders by severity descending", () => {
    const html = renderToStaticMarkup(
      <SeverityList
        items={[
          { severity: "INFO", message: "参考情報" },
          { severity: "BLOCKER", message: "請求不可の項目があります" },
          { severity: "WARNING", message: "確認してください" },
        ]}
      />,
    );

    expect(html).toContain("[停止(BLOCKER)]");
    expect(html).toContain("[警告(WARNING)]");
    expect(html).toContain("[情報(INFO)]");
    expect(html.indexOf("BLOCKER")).toBeLessThan(html.indexOf("WARNING"));
    expect(html.indexOf("WARNING")).toBeLessThan(html.indexOf("INFO"));
  });

  it("EmptyState and LoadingState announce their state as text", () => {
    const empty = renderToStaticMarkup(<EmptyState message="該当する患者はいません" />);
    const loading = renderToStaticMarkup(<LoadingState />);

    expect(empty).toContain("該当する患者はいません");
    expect(empty).toContain('role="status"');
    expect(loading).toContain("読み込み中…");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('aria-live="polite"');
  });
});
