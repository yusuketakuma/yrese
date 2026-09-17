import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverageListResponse } from "@yrese/contracts";

import {
  CoverageRequestError,
  fetchCoverage,
  PatientCoveragePanel,
  recordCoverage,
} from "./patient-coverage";

(globalThis as { React?: typeof React }).React = React;

const patient = {
  patientId: "patient-cov-001",
  name: "被保険 太郎",
  kana: "ヒホケンタロウ",
  birthDate: "1980-01-01",
  sex: "male" as const,
  eligibilityStatus: "NOT_CHECKED" as const,
};

const listResponse: CoverageListResponse = {
  patientId: "patient-cov-001",
  asOf: "2026-09-18",
  insuranceCards: [
    {
      insuranceCardId: "insurance-card-0001",
      insurerNumber: "SYN12345",
      insuredSymbol: "G-001",
      insuredNumber: "0001",
      relationship: "self",
      copayRatio: 0.3,
      validFrom: "2026-04-01",
      validTo: null,
      supersededBy: null,
      recordedAt: "2026-09-18T00:00:00.000Z",
    },
  ],
  publicExpenses: [
    {
      publicExpenseId: "public-expense-0001",
      payerNumber: "SYN54321",
      recipientNumber: "R-0001",
      priority: 1,
      validFrom: "2026-04-01",
      validTo: null,
      supersededBy: null,
      recordedAt: "2026-09-18T00:00:00.000Z",
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchCoverage transport (SCR-007)", () => {
  it("gets coverage with explicit asOf and read scopes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, listResponse);
    }) as typeof fetch;

    const result = await fetchCoverage("patient-cov-001", "2026-09-18", fetchImpl);
    expect(result.insuranceCards).toHaveLength(1);
    expect(result.publicExpenses).toHaveLength(1);
    expect(calls[0]?.url).toContain(
      "/patients/patient-cov-001/coverage?asOf=2026-09-18",
    );
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-dev-scopes"]).toContain("insurance:read");
    expect(headers["x-dev-scopes"]).toContain("public-expense:read");
    expect(headers["x-dev-scopes"]).not.toContain("insurance:write");
  });

  it("maps 409 INS-0003 to a registered coverage error code", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = (async () =>
      jsonResponse(409, { errorCode: "INS-0003" })) as typeof fetch;
    const error = await recordCoverage(
      "patient-cov-001",
      {
        kind: "insurance-card",
        insurerNumber: "SYN12345",
        insuredSymbol: "G-001",
        insuredNumber: "0001",
        relationship: "self",
        copayRatio: 0.3,
        validFrom: "2026-04-01",
      },
      "web-coverage-test-key-0001",
      fetchImpl,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CoverageRequestError);
    expect((error as CoverageRequestError).notice.errorCode).toBe("INS-0003");
    expect((error as CoverageRequestError).notice.message).toContain("重複");
  });

  it("posts coverage with Idempotency-Key and write scopes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      // wire 応答は行そのもの(API-020 §2 — envelope なし)。
      return jsonResponse(201, listResponse.publicExpenses[0]);
    }) as typeof fetch;

    const result = await recordCoverage(
      "patient-cov-001",
      {
        kind: "public-expense",
        payerNumber: "SYN54321",
        recipientNumber: "R-0001",
        priority: 1,
        validFrom: "2026-04-01",
      },
      "web-coverage-test-key-0002",
      fetchImpl,
    );
    expect(result.status).toBe(201);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("web-coverage-test-key-0002");
    expect(headers["x-dev-scopes"]).toContain("insurance:write");
    expect(headers["x-dev-scopes"]).toContain("public-expense:write");
  });
});

describe("PatientCoveragePanel render (SCR-007)", () => {
  it("renders as-of input, recorded-input honesty notice, and registration form", () => {
    const html = renderToStaticMarkup(<PatientCoveragePanel patient={patient} />);
    expect(html).toContain("保険・公費");
    expect(html).toContain("基準日");
    expect(html).toContain("asOf");
    // 記録値であり算定に使わない旨の正直表示。
    expect(html).toContain("算定額の自動計算には使用されません");
    expect(html).toContain("保険証");
    expect(html).toContain("公費");
    // 訂正導線の説明(supersede のみ・更新/削除なし)。
    expect(html).toContain("更新・削除はできません");
  });

  it("does not render coverage data before an explicit asOf view action", () => {
    const html = renderToStaticMarkup(<PatientCoveragePanel patient={patient} />);
    // 自動 fetch しない — 初期表示は空状態の説明のみ。
    expect(html).toContain("基準日を指定して");
    expect(html).not.toContain("SYN12345");
  });
});
