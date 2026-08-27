import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WhoamiResponse } from "@yrese/contracts";

import {
  MasterAuthorityView,
  loadMasterAuthorityState,
  type MasterAuthorityState,
} from "./master-authority";

(globalThis as { React?: typeof React }).React = React;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const SESSION: WhoamiResponse = {
  tenantId: "tenant-test-a",
  pharmacyId: "pharmacy-test-a",
  actorId: "actor-test-a",
  scopes: ["tenant:read", "master:admin"],
};

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

function render(state: MasterAuthorityState): string {
  return renderToStaticMarkup(<MasterAuthorityView state={state} />);
}

describe("loadMasterAuthorityState", () => {
  it("returns the session scopes reported by /whoami", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");

    const state = await loadMasterAuthorityState({
      fetchImpl: jsonFetch(SESSION),
    });

    expect(state).toEqual({ kind: "ready", session: SESSION });
  });

  it("keeps a permission failure distinct from an unreachable API", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");

    const denied = await loadMasterAuthorityState({
      fetchImpl: jsonFetch({ message: "denied" }, 403),
    });
    const unreachable = await loadMasterAuthorityState({
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });

    expect(denied.kind).toBe("error");
    expect(unreachable.kind).toBe("error");
    if (denied.kind !== "error" || unreachable.kind !== "error") return;
    expect(denied.notice.errorCode).toBe("AUTH-0003");
    expect(denied.notice.nextAction).not.toHaveLength(0);
    // 到達できないことを障害と断定しない。
    expect(unreachable.notice.errorCode).toBeUndefined();
    expect(unreachable.notice.message).toContain("未確認");
    // サーバ由来の文字列を画面文言へ通さない。
    expect(unreachable.notice.message).not.toContain("network down");
  });
});

describe("MasterAuthorityView", () => {
  it("announces loading without rendering a fabricated scope set", () => {
    const html = render({ kind: "loading" });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("セッションの権限情報を取得しています");
    expect(html).not.toContain("付与あり");
    expect(html).not.toContain("付与なし");
  });

  it("projects the real session identifiers and scopes", () => {
    const html = render({ kind: "ready", session: SESSION });

    expect(html).toContain("live-surface-panel");
    expect(html).toContain("tenant-test-a");
    expect(html).toContain("pharmacy-test-a");
    expect(html).toContain("actor-test-a");
    expect(html).toContain("master:admin 付与あり");
    expect(html).toContain("2件");
  });

  it("does not read a missing scope as an execution gate result", () => {
    const html = render({
      kind: "ready",
      session: { ...SESSION, scopes: ["tenant:read"] },
    });

    expect(html).toContain("master:admin 付与なし");
    expect(html).not.toContain("master:admin 付与あり");
    expect(html).toContain("権限の有無と実行可否は別です。");
  });

  it("shows the blocking gate even when the session lookup fails", () => {
    const html = render({
      kind: "error",
      notice: {
        errorCode: "AUTH-0003",
        message: "この操作に必要な権限がセッションに付与されていません。",
        nextAction: "管理者に必要な scope の付与状況を確認してください。",
      },
    });

    expect(html).toContain('data-error-code="AUTH-0003"');
    expect(html).toContain("次のアクション:");
    expect(html).toContain("MST-001 の blocker により実行されません");
    expect(html).not.toContain("tenant-test-a");
  });
});
