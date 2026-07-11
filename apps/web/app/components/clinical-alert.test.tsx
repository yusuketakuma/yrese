import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ClinicalAlert,
  ClinicalAlertSummary,
  highestUnacknowledgedSeverity,
} from "./clinical-alert";

(globalThis as { React?: typeof React }).React = React;

describe("ClinicalAlert (R-CLINALERT / H-08)", () => {
  it("uses assertive alert semantics for CRITICAL severity, driven by severity not type", () => {
    const html = renderToStaticMarkup(
      <ClinicalAlert
        alertType="CONTRAINDICATION"
        severity="CRITICAL"
        drugName="ワルファリン錠1mg"
        detail="出血リスクの高い併用禁忌です"
        source="添付文書"
        recommendedAction="処方医に疑義照会してください"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("禁忌");
    expect(html).toContain("[重大]");
    expect(html).toContain("ワルファリン錠1mg");
    expect(html).toContain("疑義照会");
    expect(html).toContain('data-alert-type="CONTRAINDICATION"');
    expect(html).toContain('data-severity="CRITICAL"');
  });

  it("defaults ack to UNACKNOWLEDGED and marks blocking alerts", () => {
    const html = renderToStaticMarkup(
      <ClinicalAlert
        alertType="ALLERGY"
        severity="ERROR"
        drugName="アモキシシリン"
        detail="ペニシリンアレルギー歴あり"
        blocking
      />,
    );
    expect(html).toContain('data-ack="UNACKNOWLEDGED"');
    expect(html).toContain("未確認");
    expect(html).toContain("続行前に確認が必要");
    expect(html).toContain('data-blocking="true"');
  });

  it("shows overridden ack state without hiding the alert", () => {
    const html = renderToStaticMarkup(
      <ClinicalAlert
        alertType="DUPLICATE_THERAPY"
        severity="WARNING"
        drugName="ロキソプロフェン"
        detail="同効薬の重複"
        ack="OVERRIDDEN"
      />,
    );
    expect(html).toContain('data-ack="OVERRIDDEN"');
    expect(html).toContain("理由記録のうえ実施");
  });

  it("WARNING severity does not escalate to assertive (警告過多防止)", () => {
    const html = renderToStaticMarkup(
      <ClinicalAlert alertType="DOSAGE_LIMIT" severity="WARNING" drugName="薬X" detail="上限近接" />,
    );
    expect(html).toContain('aria-live="polite"');
  });
});

describe("highestUnacknowledgedSeverity", () => {
  it("returns the most severe unacknowledged severity", () => {
    expect(
      highestUnacknowledgedSeverity([
        { severity: "WARNING", alertType: "DOSAGE_LIMIT" },
        { severity: "CRITICAL", alertType: "CONTRAINDICATION" },
        { severity: "ERROR", alertType: "ALLERGY" },
      ]),
    ).toBe("CRITICAL");
  });

  it("ignores acknowledged/resolved alerts", () => {
    expect(
      highestUnacknowledgedSeverity([
        { severity: "CRITICAL", alertType: "CONTRAINDICATION", ack: "RESOLVED" },
        { severity: "WARNING", alertType: "DOSAGE_LIMIT" },
      ]),
    ).toBe("WARNING");
  });

  it("returns null when nothing is unacknowledged", () => {
    expect(
      highestUnacknowledgedSeverity([
        { severity: "CRITICAL", alertType: "CONTRAINDICATION", ack: "ACKNOWLEDGED" },
      ]),
    ).toBeNull();
  });
});

describe("ClinicalAlertSummary", () => {
  it("announces empty state safely", () => {
    const html = renderToStaticMarkup(<ClinicalAlertSummary alerts={[]} />);
    expect(html).toContain("臨床アラートはありません");
    expect(html).toContain('data-total="0"');
  });

  it("surfaces total count and highest unacknowledged severity (H-08)", () => {
    const html = renderToStaticMarkup(
      <ClinicalAlertSummary
        alerts={[
          { severity: "WARNING", alertType: "DOSAGE_LIMIT" },
          { severity: "CRITICAL", alertType: "CONTRAINDICATION" },
          { severity: "INFO", alertType: "HIGH_RISK_DRUG" },
        ]}
      />,
    );
    expect(html).toContain("要確認 3件");
    expect(html).toContain('data-top-severity="CRITICAL"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("未確認の最重大: 重大");
  });
});
