import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  MigrationStateResponse,
  OutboxSummaryResponse,
  ReceptionSummaryResponse,
} from "@yrese/contracts";

import {
  MIGRATION_STATE_SCOPES,
  OUTBOX_SUMMARY_SCOPES,
  OperationsApiError,
  RECEPTION_SUMMARY_SCOPES,
  fetchMigrationState,
  fetchOutboxSummary,
  fetchReceptionSummary,
  toOperationsNotice,
} from "./operations-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const OUTBOX: OutboxSummaryResponse = {
  pendingCount: 2,
  deliveredCount: 0,
  oldestPendingCreatedAt: "2026-07-09T08:30:00.000Z",
  byEventType: [
    { eventType: "reception.created", pendingCount: 2, deliveredCount: 0 },
  ],
};

const RECEPTION: ReceptionSummaryResponse = {
  date: "2026-07-09",
  totalCount: 3,
  byReceptionStatus: [
    { status: "WAITING", count: 1 },
    { status: "IN_PROGRESS", count: 1 },
    { status: "COMPLETED", count: 1 },
    { status: "CANCELLED", count: 0 },
  ],
  byEligibilityStatus: [
    { status: "VERIFIED", count: 1 },
    { status: "PENDING_REVERIFY", count: 1 },
    { status: "LOCAL_ONLY_UNVERIFIED", count: 1 },
    { status: "NOT_CHECKED", count: 0 },
  ],
};

const MIGRATION: MigrationStateResponse = {
  available: false,
  reason: "PERSISTENT_STORE_NOT_CONFIGURED",
};

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function recordingFetch(handler: (url: string) => Response) {
  const calls: RecordedCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("operations client transport", () => {
  it("sends only the scopes each endpoint needs, with no-store", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { calls, fetchImpl } = recordingFetch((url) => {
      if (url.endsWith("/operations/outbox-summary")) return jsonResponse(OUTBOX);
      if (url.includes("/operations/reception-summary")) return jsonResponse(RECEPTION);
      if (url.endsWith("/operations/migration-state")) return jsonResponse(MIGRATION);
      return jsonResponse({}, 404);
    });

    await fetchOutboxSummary({ fetchImpl });
    await fetchReceptionSummary({ fetchImpl, date: "2026-07-09" });
    await fetchMigrationState({ fetchImpl });

    expect(calls.map((call) => call.url)).toEqual([
      "/_yrese-api/operations/outbox-summary",
      "/_yrese-api/operations/reception-summary?date=2026-07-09",
      "/_yrese-api/operations/migration-state",
    ]);
    const scopeHeaders = calls.map(
      (call) => (call.init?.headers as Record<string, string>)["x-dev-scopes"],
    );
    expect(scopeHeaders).toEqual([
      OUTBOX_SUMMARY_SCOPES.join(","),
      RECEPTION_SUMMARY_SCOPES.join(","),
      MIGRATION_STATE_SCOPES.join(","),
    ]);
    expect(scopeHeaders[1]).toBe("reception:read");
    expect(scopeHeaders[1]).not.toContain("patient:read");
    for (const call of calls) {
      expect(call.init?.cache).toBe("no-store");
    }
  });

  it("sends no dev tenant headers outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "https://api.example.test");
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(OUTBOX));

    await fetchOutboxSummary({ fetchImpl });

    expect(calls[0]?.url).toBe("https://api.example.test/operations/outbox-summary");
    expect(calls[0]?.init?.headers).toEqual({});
  });

  it("forwards an abort signal when one is supplied", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const controller = new AbortController();
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(MIGRATION));

    await fetchMigrationState({ fetchImpl, signal: controller.signal });

    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });

  it("preserves intentional request cancellation", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const controller = new AbortController();
    const aborted = new DOMException("Aborted", "AbortError");
    controller.abort();
    const fetchImpl: typeof fetch = async () => {
      throw aborted;
    };

    await expect(
      fetchOutboxSummary({ fetchImpl, signal: controller.signal }),
    ).rejects.toBe(aborted);
  });
});

describe("operations client responses", () => {
  it("returns contract-validated payloads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch((url) =>
      url.includes("reception-summary") ? jsonResponse(RECEPTION) : jsonResponse(OUTBOX),
    );

    expect(await fetchOutboxSummary({ fetchImpl })).toEqual(OUTBOX);
    expect(await fetchReceptionSummary({ fetchImpl, date: "2026-07-09" })).toEqual(
      RECEPTION,
    );
  });

  it("rejects a reception summary for a different requested date", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(() => jsonResponse(RECEPTION));

    await expect(
      fetchReceptionSummary({ fetchImpl, date: "2026-07-10" }),
    ).rejects.toMatchObject({ kind: "INVALID_RESPONSE" });
  });

  it("rejects a response that does not match the contract", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ ...RECEPTION, byReceptionStatus: [{ status: "WAITING", count: 1 }] }),
    );

    await expect(
      fetchReceptionSummary({ fetchImpl, date: "2026-07-09" }),
    ).rejects.toMatchObject({ kind: "INVALID_RESPONSE" });
  });

  it("rejects a body that is not JSON at all", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(
      () => new Response("not json", { status: 200 }),
    );

    await expect(fetchOutboxSummary({ fetchImpl })).rejects.toMatchObject({
      kind: "INVALID_RESPONSE",
    });
  });
});

describe("operations client failure classification", () => {
  it.each([
    [403, "PERMISSION_DENIED"],
    [400, "INVALID_REQUEST"],
    [500, "UNAVAILABLE"],
    [404, "UNAVAILABLE"],
  ] as const)("maps HTTP %d to %s", async (status, kind) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ errorCode: "AUTH-0003", message: "server side detail" }, status),
    );

    await expect(fetchOutboxSummary({ fetchImpl })).rejects.toMatchObject({ kind });
  });

  it("maps a transport failure to UNAVAILABLE", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      fetchOutboxSummary({ fetchImpl, signal: controller.signal }),
    ).rejects.toMatchObject({ kind: "UNAVAILABLE" });
  });

  it("refuses a missing or malformed business date without calling the API", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(RECEPTION));

    for (const date of [undefined, "20260709", "2026-7-9", "yesterday"]) {
      await expect(
        fetchReceptionSummary({
          fetchImpl,
          ...(date === undefined ? {} : { date }),
        }),
      ).rejects.toMatchObject({ kind: "INVALID_REQUEST" });
    }
    expect(calls).toHaveLength(0);
  });
});

describe("OperationsApiError notices", () => {
  it("never exposes a server supplied message", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const serverDetail = "internal outbox pool exploded at 10.0.0.4";
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ statusCode: 500, error: "Internal Server Error", message: serverDetail }, 500),
    );

    try {
      await fetchOutboxSummary({ fetchImpl });
      expect.unreachable("fetchOutboxSummary should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OperationsApiError);
      const notice = toOperationsNotice(error);
      expect(notice.message).not.toContain(serverDetail);
      expect(notice.message).toBe(
        "集計APIへ到達できませんでした。障害とは断定せず未確認として扱います。",
      );
      expect(notice.nextAction).toBe(
        "時間をおいて再取得するか、管理画面でAPI疎通を確認してください。",
      );
      expect((error as Error).message).toBe("UNAVAILABLE");
    }
  });

  it("carries the registered AUTH-0003 code only for permission denial", () => {
    expect(new OperationsApiError("PERMISSION_DENIED").toNotice()).toEqual({
      errorCode: "AUTH-0003",
      message: "この操作に必要な権限がセッションに付与されていません。",
      nextAction: "管理者に必要な scope の付与状況を確認してください。",
    });
    expect(new OperationsApiError("INVALID_REQUEST").toNotice()).toEqual({
      message: "指定した業務日を解釈できませんでした。",
      nextAction: "YYYY-MM-DD 形式で業務日を指定し直してください。",
    });
    expect(new OperationsApiError("INVALID_RESPONSE").toNotice()).toEqual({
      message: "集計APIの応答が契約と一致しません。",
      nextAction: "表示を中止しました。管理者へ連絡してください。",
    });
  });

  it("hands back a frozen notice so a screen cannot rewrite the wording", () => {
    const notice = new OperationsApiError("UNAVAILABLE").toNotice();

    expect(Object.isFrozen(notice)).toBe(true);
  });

  it("falls back to the unavailable notice for a non-client error", () => {
    expect(toOperationsNotice(new Error("boom")).message).toBe(
      "集計APIへ到達できませんでした。障害とは断定せず未確認として扱います。",
    );
  });
});
