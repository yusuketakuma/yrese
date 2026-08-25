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

function renderAction(status: ReceptionQueueEntry["receptionStatus"]): string {
  return renderToStaticMarkup(
    <UnsavedWorkProvider>
      <PatientContextProvider>
        <PrescriptionOriginProvider>
          <ReceptionPrescriptionHandoffAction
            entry={entry(status)}
            businessDate="2026-08-25"
          />
        </PrescriptionOriginProvider>
      </PatientContextProvider>
    </UnsavedWorkProvider>,
  );
}

describe("ReceptionPrescriptionHandoffAction", () => {
  it.each(["WAITING", "IN_PROGRESS"] as const)(
    "links an editable %s reception to the existing route",
    (status) => {
      expect(canOpenPrescriptionFromReception(entry(status))).toBe(true);
      const html = renderAction(status);
      expect(html).toContain('href="/prescriptions"');
      expect(html).toContain("処方入力へ");
      expect(html).toContain(
        "この受付を処方入力へ引き継ぐ: 合成 患者（患者番号 T-0001、受付ID reception-test-001）",
      );
    },
  );

  it.each([
    ["CANCELLED", "取消済み受付"],
    ["COMPLETED", "完了済み受付"],
  ] as const)("keeps a terminal %s reception fail-closed", (status, reason) => {
    expect(canOpenPrescriptionFromReception(entry(status))).toBe(false);
    const html = renderAction(status);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>処方入力へ<\/button>/);
    expect(html).toContain(reason);
    expect(html).toContain('class="prototype-action-reason"');
    expect(html).toContain(
      "合成 患者（患者番号 T-0001、受付ID reception-test-001）",
    );
    expect(html).not.toContain('href="/prescriptions"');
  });
});
