import type { CalculationTraceWire, EvidenceRefWire } from "@yrese/contracts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CalculationTraceView } from "./calculation-trace-view";

(globalThis as { React?: typeof React }).React = React;

type StepWire = CalculationTraceWire["steps"][number];

const baseStep: StepWire = {
  stepId: "EVD-CAL-0001:dispensing-basic-fee-1",
  description: "調剤基本料1: 受付につき47点",
  affectsClaim: true,
  evidenceRefs: [
    {
      evidenceId: "EVD-CAL-0001",
      sourceType: "notification",
      title: "調剤報酬点数表(令和8年告示第69号)別表第三",
      version: "R8",
    },
  ],
  inputRefs: ["prescription.prescriptionId"],
  output: "itemPoints=47",
  feeItemCode: "0001",
  stepStatus: "applied",
  resultPoints: "47",
};

const baseTrace: CalculationTraceWire = {
  inputsSummary: {
    ids: [
      { kind: "tenant", id: "tenant-syn-001" },
      { kind: "prescription", id: "prescription-syn-001" },
    ],
    dates: [{ kind: "prescription_date", value: "2026-06-10" }],
    masterVersions: [{ masterName: "calculation", version: "R8" }],
    ruleVersions: [{ ruleName: "calculation", version: "v0.1.0" }],
  },
  masterVersion: "R8",
  calculationRuleVersion: "v0.1.0",
  steps: [baseStep],
  warnings: [],
  blockers: [],
  evidenceIds: ["EVD-CAL-0001"],
};

function render(trace: CalculationTraceWire): string {
  return renderToStaticMarkup(<CalculationTraceView trace={trace} />);
}

describe("CalculationTraceView (SCR-012 / WP-3011a)", () => {
  it("renders master and calculation rule versions (L3 version proof)", () => {
    const html = render(baseTrace);
    expect(html).toContain('data-master-version="R8"');
    expect(html).toContain('data-rule-version="v0.1.0"');
    expect(html).toContain("算定ルール版: v0.1.0");
  });

  it("renders a normal step with evidence, source label and stepStatus label", () => {
    const html = render(baseTrace);
    expect(html).toContain('data-step-id="EVD-CAL-0001:dispensing-basic-fee-1"');
    expect(html).toContain('data-anomalous="false"');
    expect(html).toContain("調剤報酬点数表(令和8年告示第69号)別表第三");
    expect(html).toContain("[告示・通知]");
    expect(html).toContain("[適用]");
    expect(html).toContain('data-evidence-id="EVD-CAL-0001"');
  });

  it("does not render evidence titles as external links (§5)", () => {
    const html = render(baseTrace);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  it("renders inputRefs, formula and intermediateValues (QUA-007 L2 過程の証明)", () => {
    const detailed: CalculationTraceWire = {
      ...baseTrace,
      steps: [
        {
          ...baseStep,
          formula: "47 * 1",
          intermediateValues: { basePoints: "47", multiplier: "1" },
        },
      ],
    };
    const html = render(detailed);
    expect(html).toContain("入力参照: prescription.prescriptionId");
    expect(html).toContain("計算式: 47 * 1");
    expect(html).toContain("basePoints");
    expect(html).toContain("multiplier");
  });

  it("flags an affectsClaim step with no evidence as an anomaly and hides it as legitimate (§7)", () => {
    const anomalous: CalculationTraceWire = {
      ...baseTrace,
      steps: [{ ...baseStep, evidenceRefs: [] }],
      evidenceIds: [],
    };
    const html = render(anomalous);
    expect(html).toContain('data-anomalous="true"');
    expect(html).toContain('data-anomaly="true"');
    expect(html).toContain("請求に影響するステップに根拠(evidenceRef)がありません");
    // 異常ステップは根拠リストとして「正当」に見せない
    expect(html).not.toContain('class="calc-trace-step-evidence"');
  });

  it("flags rounding without evidenceId as an anomaly (§7)", () => {
    const badRounding: CalculationTraceWire = {
      ...baseTrace,
      steps: [{ ...baseStep, rounding: { method: "四捨五入", evidenceId: "  " } }],
    };
    const html = render(badRounding);
    expect(html).toContain('data-anomalous="true"');
    expect(html).toContain("丸め処理に根拠(evidenceId)がありません");
    // 根拠を欠く丸めを通常の丸め表示として出さない
    expect(html).not.toContain('class="calc-trace-step-rounding"');
    // ただし当該ステップの有効な evidenceRef は巻き添えで消さない(LOW#1 是正)
    expect(html).toContain('data-evidence-id="EVD-CAL-0001"');
  });

  it("falls back to 不明 for an unknown sourceType instead of a legitimate label (§7)", () => {
    const unknownSource: CalculationTraceWire = {
      ...baseTrace,
      steps: [
        {
          ...baseStep,
          evidenceRefs: [
            {
              evidenceId: "EVD-CAL-9999",
              sourceType: "mystery" as EvidenceRefWire["sourceType"],
              title: "未知の根拠",
            },
          ],
        },
      ],
    };
    const html = render(unknownSource);
    expect(html).toContain("不明な根拠種別(mystery)");
    expect(html).not.toContain("[告示・通知]");
  });

  it("falls back to 不明 for an unknown stepStatus (§7)", () => {
    const unknownStatus: CalculationTraceWire = {
      ...baseTrace,
      steps: [
        {
          ...baseStep,
          stepStatus: "finalized" as NonNullable<CalculationTraceWire["steps"][number]["stepStatus"]>,
        },
      ],
    };
    const html = render(unknownStatus);
    expect(html).toContain("不明なステップ状態(finalized)");
    expect(html).not.toContain("[適用]");
  });

  it("shows an unconfirmed alert when blockers are present (fail-closed)", () => {
    const blocked: CalculationTraceWire = {
      ...baseTrace,
      steps: [],
      blockers: ["BLOCKED_REGULATORY_REVIEW"],
      evidenceIds: [],
    };
    const html = render(blocked);
    expect(html).toContain('data-unconfirmed="true"');
    expect(html).toContain("算定は未確定です");
    expect(html).toContain('data-blocker="BLOCKED_REGULATORY_REVIEW"');
    expect(html).toContain("導出ステップはありません");
  });

  it("renders warnings through the shared SeverityList", () => {
    const warned: CalculationTraceWire = {
      ...baseTrace,
      warnings: ["算定要件未検証(適用可否は呼び出し側指定)"],
    };
    const html = render(warned);
    expect(html).toContain("[警告(WARNING)]");
    expect(html).toContain("算定要件未検証(適用可否は呼び出し側指定)");
  });
});
