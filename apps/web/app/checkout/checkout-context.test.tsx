import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PrescriptionDraftResponse,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import {
  CheckoutReceptionContext,
  CheckoutReceptionContextView,
  CheckoutReceptionTable,
  describeDraftSummary,
  loadCheckoutReceptions,
  toDraftSummary,
} from "./checkout-context";
import { PatientContextProvider } from "../components/patient-context";
import { UnsavedWorkProvider } from "../components/unsaved-work";
import { PrescriptionOriginProvider } from "../prescriptions/prescription-origin-context";

(globalThis as { React?: typeof React }).React = React;

const BUSINESS_DATE = "2026-08-25";
const SELECTED_PATIENT_ID = "patient-syn-001";

function queueEntry(
  receptionId: string,
  patientId: string,
): ReceptionQueueResponse["entries"][number] {
  return {
    receptionId,
    patient: {
      patientId,
      name: "合成患者 一",
      kana: "ゴウセイカンジャ イチ",
      birthDate: "1980-01-01",
      sex: "female",
      patientNumber: "SYN-001",
      eligibilityStatus: "VERIFIED",
    },
    // JST 2026-08-25 10:00 — fetchReceptionQueue は業務日一致を検証する。
    acceptedAt: "2026-08-25T01:00:00.000Z",
    receptionStatus: "WAITING",
    prescriptionIntakeType: "paper",
  };
}

const QUEUE: ReceptionQueueResponse = {
  date: BUSINESS_DATE,
  entries: [
    queueEntry("reception-syn-001", SELECTED_PATIENT_ID),
    queueEntry("reception-syn-002", "patient-syn-002"),
  ],
};

const SAVED_DRAFT: PrescriptionDraftResponse = {
  prescriptionId: "prescription-syn-001",
  receptionId: "reception-syn-001",
  patientId: SELECTED_PATIENT_ID,
  businessDate: BUSINESS_DATE,
  version: 3,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: BUSINESS_DATE,
    defaultDays: 7,
    flags: [],
    note: "",
    rows: [
      {
        sequence: 1,
        drugText: "合成薬剤 5mg",
        usageText: "1日1回 朝食後",
        days: 7,
        quantityText: "7錠",
      },
      {
        sequence: 2,
        drugText: "合成薬剤 10mg",
        usageText: "1日2回 朝夕食後",
        days: 14,
        quantityText: "28錠",
      },
    ],
  },
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T01:00:00.000Z",
  createdBy: "actor-syn-001",
  updatedBy: "actor-syn-001",
};

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function useDevelopmentTransport(): void {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("checkout draft summary projection", () => {
  it("keeps a saved draft as a row count and version, never as a calculation", () => {
    expect(
      toDraftSummary({ status: "fulfilled", value: SAVED_DRAFT }),
    ).toEqual({ kind: "saved", rowCount: 2, version: 3 });
    expect(
      describeDraftSummary({ kind: "saved", rowCount: 2, version: 3 }),
    ).toBe("サーバー保存済み 2行（版 v3）");
  });

  it("distinguishes an absent draft from an unavailable one", () => {
    expect(toDraftSummary({ status: "fulfilled", value: null })).toEqual({
      kind: "absent",
    });
    expect(
      toDraftSummary({ status: "rejected", reason: new Error("boom") }),
    ).toEqual({ kind: "unavailable" });
    expect(toDraftSummary(undefined)).toEqual({ kind: "unavailable" });

    expect(describeDraftSummary({ kind: "absent" })).toBe(
      "この受付の処方下書きは未保存です",
    );
    expect(describeDraftSummary({ kind: "unavailable" })).toContain(
      "0行を意味しません",
    );
  });
});

describe("loadCheckoutReceptions", () => {
  it("returns only the selected patient's receptions with the saved row count", async () => {
    useDevelopmentTransport();
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("/reception/queue")) return response(QUEUE);
      return response(SAVED_DRAFT);
    };

    const receptions = await loadCheckoutReceptions(
      { patientId: SELECTED_PATIENT_ID, businessDate: BUSINESS_DATE },
      fetchImpl,
    );

    expect(receptions).toEqual([
      {
        entry: QUEUE.entries[0],
        acceptedTime: "10:00",
        businessDate: BUSINESS_DATE,
        draft: { kind: "saved", rowCount: 2, version: 3 },
      },
    ]);
    // 他患者の受付の下書きは取得しない(患者取り違え・不要な照会の防止)。
    expect(
      requested.filter((url) => url.includes("/prescription-drafts/")),
    ).toEqual([
      "/_yrese-api/prescription-drafts/by-reception/reception-syn-001?date=2026-08-25",
    ]);
  });

  it("does not carry drug text, usage or day counts into the checkout screen", async () => {
    useDevelopmentTransport();
    const fetchImpl: typeof fetch = async (input) =>
      String(input).includes("/reception/queue")
        ? response(QUEUE)
        : response(SAVED_DRAFT);

    const receptions = await loadCheckoutReceptions(
      { patientId: SELECTED_PATIENT_ID, businessDate: BUSINESS_DATE },
      fetchImpl,
    );

    const serialized = JSON.stringify(receptions);
    for (const clinicalValue of [
      "合成薬剤 5mg",
      "合成薬剤 10mg",
      "1日1回 朝食後",
      "7錠",
    ]) {
      expect(serialized).not.toContain(clinicalValue);
    }
  });

  it("degrades a failed draft read to an unavailable row instead of an empty one", async () => {
    useDevelopmentTransport();
    const fetchImpl: typeof fetch = async (input) =>
      String(input).includes("/reception/queue")
        ? response(QUEUE)
        : response({}, 500);

    const receptions = await loadCheckoutReceptions(
      { patientId: SELECTED_PATIENT_ID, businessDate: BUSINESS_DATE },
      fetchImpl,
    );

    expect(receptions).toHaveLength(1);
    expect(receptions[0]?.draft).toEqual({ kind: "unavailable" });
  });

  it("treats a reception without a saved draft as explicitly unsaved", async () => {
    useDevelopmentTransport();
    const fetchImpl: typeof fetch = async (input) =>
      String(input).includes("/reception/queue")
        ? response(QUEUE)
        : response(null, 204);

    const receptions = await loadCheckoutReceptions(
      { patientId: SELECTED_PATIENT_ID, businessDate: BUSINESS_DATE },
      fetchImpl,
    );

    expect(receptions[0]?.draft).toEqual({ kind: "absent" });
  });

  it("propagates a reception queue failure instead of showing an empty checkout", async () => {
    useDevelopmentTransport();
    const fetchImpl: typeof fetch = async () =>
      response({ errorCode: "AUTH-0003", message: "denied" }, 403);

    await expect(
      loadCheckoutReceptions(
        { patientId: SELECTED_PATIENT_ID, businessDate: BUSINESS_DATE },
        fetchImpl,
      ),
    ).rejects.toThrow();
  });
});

describe("CheckoutReceptionContext without a selected patient", () => {
  it("blocks patient-scoped checkout work and points at patient search", () => {
    const html = renderToStaticMarkup(<CheckoutReceptionContext />);

    expect(html).toContain("業務対象の患者が選択されていません");
    expect(html).toContain('href="/patients"');
    expect(html).toContain("live-surface-panel");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("checkout-business-date");
  });
});

describe("CheckoutReceptionContextView retry", () => {
  it("offers the same-condition fetch again after a context load failure", () => {
    const html = renderToStaticMarkup(
      <CheckoutReceptionContextView
        patientName="合成患者 一"
        businessDate={BUSINESS_DATE}
        state={{
          kind: "error",
          notice: {
            message: "受付情報を取得できませんでした。",
            nextAction: "再取得してください。",
          },
        }}
        onBusinessDateChange={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toMatch(
      /<button[^>]*class="operator-button"[^>]*>再取得<\/button>/,
    );
  });
});

describe("CheckoutReceptionTable (WP-5212-7)", () => {
  it("uses the guarded handoff for editable rows and keeps terminal rows closed", () => {
    const html = renderToStaticMarkup(
      <UnsavedWorkProvider>
        <PatientContextProvider>
          <PrescriptionOriginProvider>
            <CheckoutReceptionTable
              receptions={[
                {
                  entry: queueEntry("reception-syn-001", SELECTED_PATIENT_ID),
                  acceptedTime: "09:15",
                  businessDate: BUSINESS_DATE,
                  draft: { kind: "absent" },
                },
                {
                  entry: {
                    ...queueEntry("reception-syn-002", SELECTED_PATIENT_ID),
                    receptionStatus: "CANCELLED",
                  },
                  acceptedTime: "09:20",
                  businessDate: BUSINESS_DATE,
                  draft: { kind: "absent" },
                },
              ]}
            />
          </PrescriptionOriginProvider>
        </PatientContextProvider>
      </UnsavedWorkProvider>,
    );

    expect(html.match(/href="\/prescriptions"/g)).toHaveLength(1);
    expect(html).toContain(
      "この受付を処方入力へ引き継ぐ: 合成患者 一（患者番号 SYN-001、受付ID reception-syn-001）",
    );
    expect(html).toContain("取消済み受付から処方入力は開始できません");
  });
});
