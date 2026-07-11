import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PatientSearchResult } from "@yrese/contracts";

import {
  PatientContextBar,
  PatientContextBarView,
  fetchPatientById,
  toPatientContextData,
} from "./patient-context";

(globalThis as { React?: typeof React }).React = React;

const SAMPLE: PatientSearchResult = {
  patientId: "11111111-1111-4111-8111-111111111111",
  patientNumber: "P-0001",
  name: "山田 太郎",
  kana: "ヤマダ タロウ",
  birthDate: "1980-01-15",
  sex: "male",
  eligibilityStatus: "VERIFIED",
};

describe("toPatientContextData (R-PATCTX)", () => {
  it("projects the display fields and omits undefined eligibilityCheckedAt", () => {
    const data = toPatientContextData(SAMPLE);
    expect(data.patientId).toBe(SAMPLE.patientId);
    expect(data.kana).toBe("ヤマダ タロウ");
    expect("eligibilityCheckedAt" in data).toBe(false);
  });
});

describe("PatientContextBarView (全画面横断固定 H-01/H-02)", () => {
  it("fixes the selected patient identity with a clear-selection control", () => {
    const asOf = new Date("2026-07-11T00:00:00+09:00");
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={asOf}
      />,
    );
    expect(html).toContain('data-has-patient="true"');
    expect(html).toContain("選択中の患者(全画面共通の業務対象)");
    expect(html).toContain("ヤマダ タロウ");
    expect(html).toContain("山田 太郎");
    expect(html).toContain("1980-01-15");
    expect(html).toContain("46歳"); // 2026-07-11 時点(JST)で満46歳
    expect(html).toContain("選択解除");
  });
});

describe("PatientContextBar without provider", () => {
  it("renders nothing when no patient context is present", () => {
    expect(renderToStaticMarkup(<PatientContextBar />)).toBe("");
  });
});

describe("PatientContextBarView staleness (再取得失敗の明示)", () => {
  it("marks the bar as stale and shows the STALE badge when refresh failed", () => {
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={new Date("2026-07-11T00:00:00+09:00")}
        stale
      />,
    );
    expect(html).toContain('data-stale="true"');
    expect(html).toContain("情報が古い可能性");
  });

  it("does not show staleness by default", () => {
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={new Date("2026-07-11T00:00:00+09:00")}
      />,
    );
    expect(html).toContain('data-stale="false"');
    expect(html).not.toContain("情報が古い可能性");
  });
});

describe("fetchPatientById (GET /patients/:patientId 契約)", () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const withDevEnv = async (run: () => Promise<void>) => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      await run();
    } finally {
      vi.unstubAllEnvs();
    }
  };

  it("returns the context projection for a 200 response", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async (input) => {
        expect(String(input)).toContain(`/patients/${SAMPLE.patientId}`);
        return jsonResponse(200, SAMPLE);
      };
      const data = await fetchPatientById(SAMPLE.patientId, stub);
      expect(data).toEqual(toPatientContextData(SAMPLE));
    });
  });

  it("returns null on 404 (対象患者が参照不能)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () =>
        jsonResponse(404, { errorCode: "PAT-0002", message: "x" });
      expect(await fetchPatientById(SAMPLE.patientId, stub)).toBeNull();
    });
  });

  it("throws on other failures (呼び出し側が stale 扱いを判断)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () => jsonResponse(500, {});
      await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow("HTTP 500");
    });
  });

  it("rejects contract drift (契約外レスポンスを表示に流さない)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () => jsonResponse(200, { patientId: SAMPLE.patientId });
      await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow();
    });
  });
});
