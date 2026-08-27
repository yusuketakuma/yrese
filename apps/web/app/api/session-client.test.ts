import { afterEach, describe, expect, it, vi } from "vitest";

import type { WhoamiResponse } from "@yrese/contracts";

import {
  SESSION_SCOPES,
  SessionApiError,
  fetchSessionScopes,
  scopeAbsenceIsMeasurable,
  sessionHasScopes,
  toSessionNotice,
} from "./session-client";

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

const IDENTITY: WhoamiResponse = {
  tenantId: "tenant-test-a",
  pharmacyId: "pharmacy-test-a",
  actorId: "actor-test-a",
  scopes: ["tenant:read", "tenant:admin", "user:admin", "sync:read"],
};

function recordingFetch(handler: () => Response) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return handler();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("fetchSessionScopes", () => {
  it("reads /whoami with tenant:read and returns the same shape as fetchAdminIdentity", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(IDENTITY));

    const session = await fetchSessionScopes({ fetchImpl });

    expect(session).toEqual({
      tenantId: "tenant-test-a",
      pharmacyId: "pharmacy-test-a",
      actorId: "actor-test-a",
      scopes: ["tenant:read", "tenant:admin", "user:admin", "sync:read"],
    });
    expect(Object.keys(session).sort()).toEqual([
      "actorId",
      "pharmacyId",
      "scopes",
      "tenantId",
    ]);
    expect(calls[0]?.url).toBe("/_yrese-api/whoami");
    expect(
      (calls[0]?.init?.headers as Record<string, string>)["x-dev-scopes"],
    ).toBe(SESSION_SCOPES.join(","));
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("forwards an abort signal", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const controller = new AbortController();
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(IDENTITY));

    await fetchSessionScopes({ fetchImpl, signal: controller.signal });

    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });

  it.each([
    [403, "PERMISSION_DENIED"],
    [500, "UNAVAILABLE"],
    [404, "UNAVAILABLE"],
  ] as const)("maps HTTP %d to %s", async (status, kind) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ errorCode: "AUTH-0003", message: "server detail" }, status),
    );

    await expect(fetchSessionScopes({ fetchImpl })).rejects.toMatchObject({ kind });
  });

  it("maps a transport failure to UNAVAILABLE", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(fetchSessionScopes({ fetchImpl })).rejects.toMatchObject({
      kind: "UNAVAILABLE",
    });
  });

  it("rejects a whoami payload that does not match the contract", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ ...IDENTITY, scopes: ["not-a-scope"] }),
    );

    await expect(fetchSessionScopes({ fetchImpl })).rejects.toMatchObject({
      kind: "INVALID_RESPONSE",
    });
  });
});

describe("SessionApiError notices", () => {
  it("never exposes a server supplied message", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const serverDetail = "whoami backend at 10.0.0.9 refused the connection";
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ statusCode: 500, error: "Internal Server Error", message: serverDetail }, 500),
    );

    try {
      await fetchSessionScopes({ fetchImpl });
      expect.unreachable("fetchSessionScopes should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionApiError);
      const notice = toSessionNotice(error);
      expect(notice.message).not.toContain(serverDetail);
      expect(notice.message).toBe(
        "セッション情報へ到達できませんでした。障害とは断定せず未確認として扱います。",
      );
      expect((error as Error).message).toBe("UNAVAILABLE");
    }
  });

  it("carries the registered AUTH-0003 code for permission denial", () => {
    expect(new SessionApiError("PERMISSION_DENIED").toNotice()).toEqual({
      errorCode: "AUTH-0003",
      message: "この操作に必要な権限がセッションに付与されていません。",
      nextAction: "管理者に必要な scope の付与状況を確認してください。",
    });
  });

  it("hands back a frozen notice", () => {
    expect(Object.isFrozen(new SessionApiError("UNAVAILABLE").toNotice())).toBe(true);
  });
});

describe("sessionHasScopes", () => {
  it("reports whether every required scope is granted", () => {
    expect(sessionHasScopes(IDENTITY, ["tenant:admin"])).toBe(true);
    expect(sessionHasScopes(IDENTITY, ["tenant:admin", "sync:read"])).toBe(true);
    expect(sessionHasScopes(IDENTITY, ["reception:read"])).toBe(false);
    expect(sessionHasScopes(IDENTITY, [])).toBe(true);
  });
});

describe("scopeAbsenceIsMeasurable", () => {
  it("developmentではweb側が宣言したscopeの欠落だけを測定結果として扱う", () => {
    // dev stubは宣言済みscopeをそのまま返すため、未宣言scopeの欠落は測定ではない。
    expect(scopeAbsenceIsMeasurable(SESSION_SCOPES, "development")).toBe(true);
    expect(scopeAbsenceIsMeasurable(["claim:finalize"], "development")).toBe(false);
    expect(scopeAbsenceIsMeasurable(["master:admin"], "development")).toBe(false);
  });

  it("development以外ではAPIが返したscopeを測定結果として扱う", () => {
    expect(scopeAbsenceIsMeasurable(["claim:finalize"], "production")).toBe(true);
    expect(scopeAbsenceIsMeasurable(["claim:finalize"], "test")).toBe(true);
  });
});
