import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrescriptionChangeIndicator } from "./prescription-change-indicator";
import { RecordStateBadge } from "./record-state-badge";

(globalThis as { React?: typeof React }).React = React;

describe("RecordStateBadge (R-RECLIFE / 真正性)", () => {
  it("renders draft distinctly from finalized (確定前を確定と誤認させない — H-05)", () => {
    const draft = renderToStaticMarkup(<RecordStateBadge status="DRAFT" />);
    const finalized = renderToStaticMarkup(<RecordStateBadge status="FINALIZED" />);
    expect(draft).toContain("下書き(未確定)");
    expect(draft).toContain('data-record-status="DRAFT"');
    expect(finalized).toContain("確定");
    expect(finalized).not.toContain("下書き");
  });

  it("shows finalizer/date/version only for finalized records (P-12)", () => {
    const html = renderToStaticMarkup(
      <RecordStateBadge
        status="AMENDED"
        finalizedBy="鈴木薬剤師"
        finalizedAt="2026-07-11T10:00:00+09:00"
        version={2}
      />,
    );
    expect(html).toContain("訂正");
    expect(html).toContain("鈴木薬剤師");
    expect(html).toContain("第2版");
  });

  it("does not leak audit line for non-finalized states", () => {
    const html = renderToStaticMarkup(
      <RecordStateBadge status="DRAFT" finalizedBy="誰か" finalizedAt="2026-07-11" />,
    );
    expect(html).not.toContain("誰か");
  });

  it("presents local auto-save separately from server-saved (H-03)", () => {
    const local = renderToStaticMarkup(<RecordStateBadge status="AUTO_SAVED_LOCALLY" />);
    expect(local).toContain("ローカル自動保存(未同期)");
    expect(local).toContain('data-tone="blocked"');
  });
});

describe("PrescriptionChangeIndicator (H-06/H-07 増減・中止の見落とし)", () => {
  it("shows dose increase with arrow shape and before/after", () => {
    const html = renderToStaticMarkup(
      <PrescriptionChangeIndicator
        change="DOSE_INCREASED"
        drugName="アムロジピン錠5mg"
        previous="1錠"
        current="2錠"
      />,
    );
    expect(html).toContain("アムロジピン錠5mg");
    expect(html).toContain("増量");
    expect(html).toContain("↑");
    expect(html).toContain("1錠");
    expect(html).toContain("2錠");
    expect(html).toContain('data-change="DOSE_INCREASED"');
    expect(html).toContain('data-changed="true"');
  });

  it("marks unchanged as not-changed and neutral", () => {
    const html = renderToStaticMarkup(
      <PrescriptionChangeIndicator change="UNCHANGED" drugName="ロキソプロフェン錠" />,
    );
    expect(html).toContain("変更なし");
    expect(html).toContain('data-changed="false"');
  });

  it("distinguishes discontinued from decreased by label (色非依存)", () => {
    const discontinued = renderToStaticMarkup(
      <PrescriptionChangeIndicator change="DISCONTINUED" drugName="薬A" />,
    );
    const decreased = renderToStaticMarkup(
      <PrescriptionChangeIndicator change="DOSE_DECREASED" drugName="薬A" />,
    );
    expect(discontinued).toContain("中止");
    expect(decreased).toContain("減量");
    expect(decreased).toContain("↓");
  });
});
