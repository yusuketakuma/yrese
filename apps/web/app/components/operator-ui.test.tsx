import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MetricCard,
  MetricGrid,
  OperatorPage,
  PrototypeAction,
  PrototypeBanner,
  StatusPill,
} from "./operator-ui";

(globalThis as { React?: typeof React }).React = React;

describe("operator UI prototype primitives", () => {
  it("keeps prototype actions disabled and explains the reason without an extra tab stop", () => {
    const html = renderToStaticMarkup(
      <>
        <PrototypeBanner>合成データです</PrototypeBanner>
        <PrototypeAction kind="primary" reason="確定API未接続">
          確定
        </PrototypeAction>
      </>,
    );

    expect(html).toContain("UIプロトタイプ");
    expect(html).toContain("合成データです");
    expect(html).toContain('class="prototype-action-shell"');
    expect(html).toContain("利用不可: 確定API未接続");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="確定（利用不可）"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("renders metrics as one labelled list without color-only semantics", () => {
    const html = renderToStaticMarkup(
      <MetricGrid>
        <MetricCard
          label="未処理"
          value="—"
          unit="件"
          detail="API未接続"
          tone="warning"
        />
      </MetricGrid>,
    );

    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="主要指標"');
    expect(html).toContain('role="listitem"');
    expect(html).toContain("未処理");
    expect(html).toContain("API未接続");
  });

  it("labels the contextual rail and status text explicitly", () => {
    const html = renderToStaticMarkup(
      <OperatorPage
        rail={<StatusPill tone="warning">未接続</StatusPill>}
        railLabel="会計補助情報"
      >
        <p>本文</p>
      </OperatorPage>,
    );

    expect(html).toContain('aria-label="会計補助情報"');
    expect(html).toContain("未接続");
    expect(html).toContain('data-tone="warning"');
  });
});
