import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricCard, PrototypeAction, PrototypeBanner, StatusPill } from "./operator-ui";

(globalThis as { React?: typeof React }).React = React;

describe("operator UI prototype primitives", () => {
  it("marks prototype-only surfaces and disables actions", () => {
    const html = renderToStaticMarkup(
      <>
        <PrototypeBanner>合成データです</PrototypeBanner>
        <PrototypeAction kind="primary">確定</PrototypeAction>
      </>,
    );

    expect(html).toContain("UIプロトタイプ");
    expect(html).toContain("合成データです");
    expect(html).toContain("disabled");
    expect(html).toContain("確定");
  });

  it("renders metric and status semantics without relying on color alone", () => {
    const html = renderToStaticMarkup(
      <>
        <MetricCard label="未処理" value="—" unit="件" detail="API未接続" tone="warning" />
        <StatusPill tone="warning">未接続</StatusPill>
      </>,
    );

    expect(html).toContain("未処理");
    expect(html).toContain("API未接続");
    expect(html).toContain("未接続");
    expect(html).toContain('data-tone="warning"');
  });
});
