import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import { PatientContextProvider } from "./components/patient-context";
import { UnsavedWorkProvider } from "./components/unsaved-work";
import { PrescriptionOriginProvider } from "./prescriptions/prescription-origin-context";
import {
  ReceptionPrescriptionHandoffAction,
  canOpenPrescriptionFromReception,
} from "./reception-prescription-handoff";

(globalThis as { React?: typeof React }).React = React;

function entry(status: ReceptionQueueEntry["receptionStatus"]): ReceptionQueueEntry {
  return {
    receptionId: "reception-test-001",
    patient: {
      patientId: "patient-test-001",
      name: "合成 患者",
      kana: "ゴウセイ カンジャ",
      birthDate: "1950-01-02",
      sex: "female",
      patientNumber: "T-0001",
      eligibilityStatus: "VERIFIED",
    },
    acceptedAt: "2026-08-25T00:15:00.000Z",
    receptionStatus: status,
    prescriptionIntakeType: "paper",
  };
}

describe("ReceptionPrescriptionHandoffAction", () => {
  it("links a non-cancelled, contract-validated reception to the existing route", () => {
    const html = renderToStaticMarkup(
      <UnsavedWorkProvider>
        <PatientContextProvider>
          <PrescriptionOriginProvider>
            <ReceptionPrescriptionHandoffAction
              entry={entry("WAITING")}
              businessDate="2026-08-25"
            />
          </PrescriptionOriginProvider>
        </PatientContextProvider>
      </UnsavedWorkProvider>,
    );

    expect(html).toContain('href="/prescriptions"');
    expect(html).toContain("処方入力へ");
    expect(html).toContain("この受付を処方入力へ引き継ぐ");
  });

  it("keeps a cancelled reception fail-closed", () => {
    expect(canOpenPrescriptionFromReception(entry("CANCELLED"))).toBe(false);
    const html = renderToStaticMarkup(
      <UnsavedWorkProvider>
        <PatientContextProvider>
          <PrescriptionOriginProvider>
            <ReceptionPrescriptionHandoffAction
              entry={entry("CANCELLED")}
              businessDate="2026-08-25"
            />
          </PrescriptionOriginProvider>
        </PatientContextProvider>
      </UnsavedWorkProvider>,
    );

    expect(html).toMatch(/<button[^>]*disabled[^>]*>処方入力へ<\/button>/);
    expect(html).not.toContain('href="/prescriptions"');
  });
});
