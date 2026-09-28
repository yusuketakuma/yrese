import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverageListResponse } from "@yrese/contracts";

import {
  CoverageRequestError,
  createCoverageController,
  fetchCoverage,
  PatientCoveragePanel,
  recordCoverage,
} from './patient-coverage';

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

describe("createCoverageController (SCR-007)", () => {
  const validRecordRequest = {
    kind: "insurance-card",
    insurerNumber: "SYN12345",
    insuredSymbol: "G-001",
    insuredNumber: "0001",
    relationship: "self",
    copayRatio: 0.3,
    validFrom: "2026-04-01",
  } as const;

  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function makeController(fetchImpl: typeof fetch) {
    const views: { kind: string; data?: CoverageListResponse }[] = [];
    const submits: { kind: string }[] = [];
    let keyCount = 0;
    const controller = createCoverageController({
      patientId: "patient-cov-001",
      emitView: (view) => views.push(view),
      emitSubmit: (state) => submits.push(state),
      getAsOf: () => "2026-09-18",
      fetchImpl,
      makeIdempotencyKey: () => `web-coverage-test-${(keyCount += 1)}`,
    });
    return { controller, views, submits };
  }

  it("suppresses a stale reload response and aborts the superseded request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const signals: AbortSignal[] = [];
    let resolveFirst!: (response: Response) => void;
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init!.signal!);
      if (String(url).includes("asOf=2026-09-17")) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return jsonResponse(200, { ...listResponse, asOf: "2026-09-18" });
    }) as typeof fetch;
    const { controller, views } = makeController(fetchImpl);

    controller.reload("2026-09-17");
    controller.reload("2026-09-18");
    await flush();
    resolveFirst(jsonResponse(200, { ...listResponse, asOf: "2026-09-17" }));
    await flush();

    expect(signals[0]!.aborted).toBe(true);
    const loaded = views.filter((view) => view.kind === "loaded");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.data?.asOf).toBe("2026-09-18");
  });

  it("reuses the idempotency key while a submission outcome is unknown", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const postedKeys: string[] = [];
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postedKeys.push(
          (init.headers as Record<string, string>)["idempotency-key"] ?? "",
        );
        throw new TypeError("response lost");
      }
      return jsonResponse(200, listResponse);
    }) as typeof fetch;
    const { controller, submits } = makeController(fetchImpl);

    controller.submit(validRecordRequest);
    await flush();
    controller.submit(validRecordRequest);
    await flush();

    expect(postedKeys).toEqual([
      "web-coverage-test-1",
      "web-coverage-test-1",
    ]);
    expect(submits.filter((state) => state.kind === "error")).toHaveLength(2);
  });

  it("retains the idempotency key after an unsettled 5xx failure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const postedKeys: string[] = [];
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postedKeys.push(
          (init.headers as Record<string, string>)["idempotency-key"] ?? "",
        );
        return jsonResponse(500, {});
      }
      return jsonResponse(200, listResponse);
    }) as typeof fetch;
    const { controller, submits } = makeController(fetchImpl);

    controller.submit(validRecordRequest);
    await flush();
    controller.submit(validRecordRequest);
    await flush();

    // 5xx は結果不明(記録済みかもしれない)のため同一キーで再試行する。
    expect(postedKeys).toEqual([
      "web-coverage-test-1",
      "web-coverage-test-1",
    ]);
    expect(submits.filter((state) => state.kind === "error")).toHaveLength(2);
  });

  it("issues a new key after a settled 4xx and after a recorded success", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const postedKeys: string[] = [];
    let rejectNext = true;
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postedKeys.push(
          (init.headers as Record<string, string>)["idempotency-key"] ?? "",
        );
        if (rejectNext) {
          rejectNext = false;
          return jsonResponse(409, { errorCode: "INS-0003" });
        }
        return jsonResponse(201, listResponse.insuranceCards[0]);
      }
      return jsonResponse(200, listResponse);
    }) as typeof fetch;
    const { controller } = makeController(fetchImpl);

    controller.submit(validRecordRequest);
    await flush();
    controller.submit(validRecordRequest);
    await flush();
    controller.submit(validRecordRequest);
    await flush();

    expect(postedKeys).toEqual([
      "web-coverage-test-1",
      "web-coverage-test-2",
      "web-coverage-test-3",
    ]);
  });

  it("coalesces a synchronous double submit into one POST", async () => {
    vi.stubEnv("NODE_ENV", "development");
    let postCount = 0;
    let resolvePost!: (response: Response) => void;
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postCount += 1;
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }
      return jsonResponse(200, listResponse);
    }) as typeof fetch;
    const { controller, submits } = makeController(fetchImpl);

    controller.submit(validRecordRequest);
    controller.submit(validRecordRequest);
    resolvePost(jsonResponse(201, listResponse.insuranceCards[0]));
    await flush();

    expect(postCount).toBe(1);
    expect(submits.at(-1)?.kind).toBe("idle");
  });
});

describe("PatientCoveragePanel render (SCR-007)", () => {
  it("renders as-of input, recorded-input honesty notice, and registration form", () => {
    const html = renderToStaticMarkup(<PatientCoveragePanel patient={patient} />);
    // 既定基準日は JST 業務日(todayAsIsoDate)。UTC date 直取りでは
    // JST 午前 0〜9 時に前日を表示してしまう。
    const jstToday = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(html).toContain(`value="${jstToday}"`);
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
