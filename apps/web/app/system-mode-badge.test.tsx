import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SystemModeBadge } from "./system-mode-badge";

(globalThis as { React?: typeof React }).React = React;

describe("SystemModeBadge", () => {
  it("does not present the default fixed mode as verified runtime health", () => {
    const html = renderToStaticMarkup(<SystemModeBadge />);
    expect(html).toContain("NORMAL");
    expect(html).toContain("暫定");
    expect(html).toContain('data-provisional="true"');
  });

  it("can render a non-provisional value only when an authoritative caller provides it", () => {
    const html = renderToStaticMarkup(<SystemModeBadge mode="NORMAL" provisional={false} />);
    expect(html).toContain('data-provisional="false"');
    expect(html).not.toContain("暫定");
  });
});
