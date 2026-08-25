import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CheckoutPage from "./checkout/page";
import ClaimCheckPage from "./claim-check/page";
import { SelectedPatientWorkspaceView } from "./prescriptions/prescription-workspace";

(globalThis as { React?: typeof React }).React = React;

const PATIENT = {
  patientId: "patient-1",
  name: "山田 花子",
  kana: "ヤマダ ハナコ",
  birthDate: "1950-01-02",
  sex: "female",
  eligibilityStatus: "VERIFIED",
} as const;

describe("patient-scoped prototype data separation", () => {
  it("does not attach fixed synthetic clinical data to a selected patient", () => {
    const html = renderToStaticMarkup(<SelectedPatientWorkspaceView patient={PATIENT} />);

    expect(html).toContain("山田 花子");
    expect(html).not.toContain("data-patient-id");
    expect(html).toContain('data-prototype-clinical-data="excluded"');
    for (const syntheticClinicalValue of [
      "アムロジピン",
      "ロサルタン",
      "トラゾドン",
      "2026/08/24",
    ]) {
      expect(html).not.toContain(syntheticClinicalValue);
    }
  });

  it("does not attach fixed synthetic amounts or payment history to the checkout page", () => {
    const html = renderToStaticMarkup(<CheckoutPage />);

    expect(html).toContain('data-prototype-financial-data="excluded"');
    expect(html).toContain("0円ではありません");
    for (const syntheticFinancialValue of [
      "¥1,230",
      "489点",
      "2025/07/31",
      "入金済",
      "返金済",
    ]) {
      expect(html).not.toContain(syntheticFinancialValue);
    }
  });

  it("keeps claim check explicitly batch-scoped without a selected-patient rail", () => {
    const html = renderToStaticMarkup(<ClaimCheckPage />);

    expect(html).toContain('data-screen-scope="batch"');
    expect(html).toContain("患者横断・バッチ単位");
    expect(html).toContain("実患者データ・実件数・実エラーではありません");
    expect(html).not.toContain("選択中の患者");
    expect(html).not.toContain('value="2025-05-20"');
  });
});
