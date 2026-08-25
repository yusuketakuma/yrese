import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SystemModeBadge } from "./system-mode-badge";

(globalThis as { React?: typeof React }).React = React;

describe("SystemModeBadge", () => {
  it("does not infer NORMAL while runtime mode detection is unavailable", () => {
    const html = renderToStaticMarkup(<SystemModeBadge />);
    expect(html).toContain("状態未検知");
    expect(html).toContain("API未接続");
    expect(html).toContain('data-mode="UNDETECTED"');
    expect(html).toContain('data-provisional="true"');
    expect(html).not.toContain("通常稼働");
  });

  it("cannot bypass the undetected default by setting provisional false", () => {
    const html = renderToStaticMarkup(<SystemModeBadge provisional={false} />);
    expect(html).toContain("状態未検知");
    expect(html).toContain('data-mode="UNDETECTED"');
    expect(html).not.toContain("通常稼働");
  });

  it("renders a non-provisional value only when an authoritative caller provides a mode", () => {
    const html = renderToStaticMarkup(<SystemModeBadge mode="NORMAL" provisional={false} />);
    expect(html).toContain("通常稼働");
    expect(html).toContain('data-mode="NORMAL"');
    expect(html).toContain('data-provisional="false"');
    expect(html).not.toContain("暫定");
  });
});
