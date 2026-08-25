import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrescriptionWorkflowProgress } from "./prescription-workflow-progress";

(globalThis as { React?: typeof React }).React = React;

describe("PrescriptionWorkflowProgress", () => {
  it("separates the connected draft stage from later clinical and finalization stages", () => {
    const html = renderToStaticMarkup(<PrescriptionWorkflowProgress />);

    expect(html).toContain('aria-label="処方業務の接続状況"');
    expect(html).toContain("受付・患者確認");
    expect(html).toContain("下書き入力・保存");
    expect(html).toContain("接続済み");
    expect(html.match(/未接続/g)).toHaveLength(3);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("下書き保存は処方内容の安全確認");
    expect(html).not.toContain("安全確認済み");
    expect(html).not.toContain("確定済み");
  });
});
