import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/patient-context", async () => {
  const actual = await vi.importActual<object>("../components/patient-context");
  return {
    ...actual,
    useOptionalPatientContext: () => ({ patient: null }),
  };
});

import { PrescriptionLaunchRoute } from "./prescription-launch-route";

(globalThis as { React?: typeof React }).React = React;

describe("prescription launch accessibility", () => {
  it("exposes the blocked start condition as text and a named region", () => {
    const html = renderToStaticMarkup(
      <PrescriptionLaunchRoute
        launch={{
          receptionId: "reception-accessibility",
          patientId: "patient-accessibility",
          businessDate: "2026-08-25",
        }}
      />,
    );

    expect(html).toContain('aria-label="処方入力開始条件"');
    expect(html).toContain("受付に対応する患者が選択されていません");
    expect(html).toContain("患者検索を開く");
  });
});
