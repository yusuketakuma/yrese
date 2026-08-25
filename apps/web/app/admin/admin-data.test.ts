import { afterEach, describe, expect, it, vi } from "vitest";

import type { HealthResponse, WhoamiResponse } from "@yrese/contracts";

import {
  ADMIN_DASHBOARD_REQUIRED_SCOPES,
  countAdminScopes,
  fetchAdminIdentity,
  hasRequiredAdminScopes,
  loadAdminDashboardSnapshot,
} from "./admin-data";

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
  scopes: ["tenant:read", "tenant:admin", "user:admin"],
};

const HEALTH: HealthResponse = {
  status: "ok",
  service: "api",
  version: "0.0.1",
  timestamp: "2026-08-25T00:00:00.000Z",
};

describe("admin dashboard data boundary", () => {
  it("loads identity and health from the existing APIs without a shared cache", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/whoami")) return jsonResponse(IDENTITY);
      if (url.endsWith("/health")) return jsonResponse(HEALTH);
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const snapshot = await loadAdminDashboardSnapshot(
      fetchImpl,
      undefined,
      () => new Date("2026-08-25T00:01:00.000Z"),
    );

    expect(snapshot.identity).toEqual({ status: "ready", data: IDENTITY });
    expect(snapshot.health).toEqual({ status: "ready", data: HEALTH });
    expect(snapshot.loadedAt).toBe("2026-08-25T00:01:00.000Z");
    expect(calls.map((call) => call.url)).toEqual([
      "/_yrese-api/whoami",
      "/_yrese-api/health",
    ]);

    const whoamiHeaders = new Headers(calls[0]?.init?.headers);
    const developmentScopes = whoamiHeaders.get("x-dev-scopes") ?? "";
    for (const scope of ["tenant:read", ...ADMIN_DASHBOARD_REQUIRED_SCOPES]) {
      expect(developmentScopes.split(",")).toContain(scope);
    }
    expect(calls.every((call) => call.init?.cache === "no-store")).toBe(true);
  });

  it("keeps the identity usable when the health endpoint fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/whoami")
        ? jsonResponse(IDENTITY)
        : jsonResponse({ message: "unavailable" }, 503),
    ) as unknown as typeof fetch;

    const snapshot = await loadAdminDashboardSnapshot(fetchImpl);

    expect(snapshot.identity.status).toBe("ready");
    expect(snapshot.health.status).toBe("error");
    if (snapshot.health.status === "error") {
      expect(snapshot.health.error.kind).toBe("UNAVAILABLE");
      expect(snapshot.health.error.status).toBe(503);
    }
  });

  it("classifies a denied whoami request without exposing the response body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "internal tenant details" }, 403),
    ) as unknown as typeof fetch;

    await expect(fetchAdminIdentity(fetchImpl)).rejects.toMatchObject({
      kind: "PERMISSION_DENIED",
      status: 403,
      message: "認証・権限情報を参照する権限がありません。",
    });
  });

  it("rejects an invalid identity response instead of rendering unvalidated fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ...IDENTITY, scopes: ["invented:root"] }),
    ) as unknown as typeof fetch;

    await expect(fetchAdminIdentity(fetchImpl)).rejects.toEqual(
      expect.objectContaining({ kind: "INVALID_RESPONSE" }),
    );
  });

  it("requires both approved SCR-029 admin scopes", () => {
    expect(hasRequiredAdminScopes(IDENTITY)).toBe(true);
    expect(
      hasRequiredAdminScopes({
        ...IDENTITY,
        scopes: ["tenant:read", "tenant:admin"],
      }),
    ).toBe(false);
    expect(countAdminScopes(IDENTITY)).toBe(2);
  });
});
