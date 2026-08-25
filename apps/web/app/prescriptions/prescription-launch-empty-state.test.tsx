import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/patient-context", async () => {
  const actual = await vi.importActual<object>("../components/patient-context");
  return { ...actual, useOptionalPatientContext: () => ({ patient: null }) };
});

import { PrescriptionLaunchRoute } from "./prescription-launch-route";

(globalThis as { React?: typeof React }).React = React;

describe("prescription launch empty state", () => {
  it("provides a patient-search recovery path", () => {
    const html = renderToStaticMarkup(
      <PrescriptionLaunchRoute
        launch={{
          receptionId: "reception-empty",
          patientId: "patient-empty",
          businessDate: "2026-08-25",
        }}
      />,
    );
    expect(html).toContain('href="/patients"');
  });
});
