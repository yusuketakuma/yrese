import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const patientContext = vi.hoisted(() => ({
  patient: null as null | {
    patientId: string;
    name: string;
    kana: string;
    birthDate: string;
    sex: "female";
    eligibilityStatus: "VERIFIED";
  },
}));

vi.mock("../components/patient-context", async () => {
  const actual = await vi.importActual<object>("../components/patient-context");
  return {
    ...actual,
    useOptionalPatientContext: () => ({ patient: patientContext.patient }),
  };
});

import { PrescriptionLaunchRoute } from "./prescription-launch-route";

(globalThis as { React?: typeof React }).React = React;

const LAUNCH = {
  receptionId: "reception-a",
  patientId: "patient-a",
  businessDate: "2026-08-25",
} as const;

describe("PrescriptionLaunchRoute", () => {
  it("requires explicit patient selection before loading a reception", () => {
    patientContext.patient = null;
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain("受付に対応する患者が選択されていません");
    expect(html).toContain('href="/patients"');
    expect(html).not.toContain('data-prescription-launch="verified"');
  });

  it("blocks a selected patient that differs from the route patient", () => {
    patientContext.patient = {
      patientId: "patient-b",
      name: "検証患者B",
      kana: "ケンショウカンジャビー",
      birthDate: "1980-01-01",
      sex: "female",
      eligibilityStatus: "VERIFIED",
    };
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain("選択中の患者と受付URLの患者が一致しません");
    expect(html).not.toContain('data-prescription-launch="verified"');
  });
});
