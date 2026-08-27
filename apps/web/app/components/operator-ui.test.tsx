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
  TableScroll,
} from "./operator-ui";

(globalThis as { React?: typeof React }).React = React;

describe("operator UI capability primitives", () => {
  it("keeps unavailable actions disabled and explains the reason without an extra tab stop", () => {
    const html = renderToStaticMarkup(
      <>
        <PrototypeBanner>合成データです</PrototypeBanner>
        <PrototypeAction kind="primary" reason="確定API未接続">
          確定
        </PrototypeAction>
      </>,
    );

    expect(html).toContain("機能境界");
    expect(html).toContain("合成データです");
    expect(html).toContain('class="prototype-action-shell"');
    expect(html).toContain("利用不可: 確定API未接続");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="確定（利用不可）"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("uses capability wording when a caller does not provide a custom reason", () => {
    const html = renderToStaticMarkup(
      <PrototypeAction>未接続操作</PrototypeAction>,
    );

    expect(html).toContain(
      "利用不可: 必要な機能が未接続または未承認のため実行できません",
    );
    expect(html).not.toContain("UIプロトタイプでは実行できません");
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

  it("marks the rail as non-sticky only when the caller opts out", () => {
    const sticky = renderToStaticMarkup(
      <OperatorPage rail={<p>補助</p>}>
        <p>本文</p>
      </OperatorPage>,
    );
    const staticRail = renderToStaticMarkup(
      <OperatorPage rail={<p>補助</p>} railLabel="環境・管理補助情報" railSticky={false}>
        <p>本文</p>
      </OperatorPage>,
    );

    expect(sticky).not.toContain("data-sticky");
    expect(staticRail).toContain('aria-label="環境・管理補助情報"');
    expect(staticRail).toContain('data-sticky="false"');
  });

  it("wraps a horizontally scrolling table as one reachable labelled region", () => {
    const html = renderToStaticMarkup(
      <TableScroll label="受付キュー表">
        <table className="operator-table" />
      </TableScroll>,
    );

    expect(html).toContain('class="table-scroll"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="受付キュー表"');
    // role が無い div は generic へマップされ、aria-label は禁止属性として無視される。
    // role を落とすと名前の読まれない tab stop になる。
    expect(html).toContain('role="region"');
  });
});
