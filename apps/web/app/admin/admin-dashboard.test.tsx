import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminDashboardSnapshot } from "./admin-data";
import { AdminDashboardView } from "./admin-dashboard";

(globalThis as { React?: typeof React }).React = React;

const PREFERENCES = {
  reducedMotion: true,
  forcedColors: false,
  darkScheme: false,
} as const;

function snapshotFor(
  tenantId: string,
  pharmacyId: string,
  actorId: string,
  scopes: string[] = ["tenant:read", "tenant:admin", "user:admin"],
): AdminDashboardSnapshot {
  return {
    identity: {
      status: "ready",
      data: { tenantId, pharmacyId, actorId, scopes },
    },
    health: {
      status: "ready",
      data: {
        status: "ok",
        service: "api",
        version: "0.0.1",
        timestamp: "2026-08-25T00:00:00.000Z",
      },
    },
    loadedAt: "2026-08-25T00:01:00.000Z",
  };
}

function renderSnapshot(
  snapshot: AdminDashboardSnapshot,
  activeTab:
    | "overview"
    | "permissions"
    | "notifications"
    | "audit-policy"
    | "accessibility"
    | "commands"
    | "integrations" = "overview",
): string {
  return renderToStaticMarkup(
    <AdminDashboardView
      snapshot={snapshot}
      preferences={PREFERENCES}
      activeTab={activeTab}
      onTabChange={() => undefined}
      onRefresh={() => undefined}
    />,
  );
}

describe("AdminDashboardView", () => {
  it("projects only the authenticated current context and no synthetic user directory", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
    );

    expect(html).toContain("tenant-alpha");
    expect(html).toContain("pharmacy-alpha");
    expect(html).toContain("actor-alpha");
    expect(html).toContain("現在の利用者セッション");
    expect(html).toContain("利用者ディレクトリAPIは存在しない");
    expect(html).not.toContain("薬師 太郎");
    expect(html).not.toContain("yrese.jp");
    expect(html).not.toContain("18 名");
  });

  it("changes all tenant-scoped identifiers when the authenticated context changes", () => {
    const alpha = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
    );
    const beta = renderSnapshot(
      snapshotFor("tenant-beta", "pharmacy-beta", "actor-beta"),
    );

    expect(alpha).toContain("tenant-alpha");
    expect(alpha).not.toContain("tenant-beta");
    expect(beta).toContain("tenant-beta");
    expect(beta).not.toContain("tenant-alpha");
    expect(beta).not.toContain("actor-alpha");
  });

  it("fails closed when either required admin scope is missing", () => {
    const html = renderSnapshot(
      snapshotFor(
        "tenant-denied",
        "pharmacy-denied",
        "actor-denied",
        ["tenant:read", "tenant:admin"],
      ),
    );

    expect(html).toContain("アクセス拒否");
    expect(html).toContain("user:admin と tenant:admin の両方");
    expect(html).not.toContain("tenant-denied");
    expect(html).not.toContain("環境・組織情報");
  });

  it("shows explicit unavailable reasons for operations without approved APIs", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
    );

    expect(html).toContain("利用不可: 利用者管理APIが未実装です");
    expect(html).toContain("利用不可: 認証セッション管理APIが未実装です");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>利用者を追加<\/button>/);
  });

  it("honors the retired audit viewer boundary instead of listing events", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      "audit-policy",
    );

    expect(html).toContain("一般業務Webでのイベント閲覧は提供しません");
    expect(html).toContain("UIX-007");
    expect(html).not.toContain("eventId");
    expect(html).not.toContain("監査イベント一覧");
  });

  it("keeps health failure section-scoped after identity authorization succeeds", () => {
    const snapshot = snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha");
    const partial: AdminDashboardSnapshot = {
      ...snapshot,
      health: {
        status: "error",
        error: Object.assign(new Error("API稼働状態を取得できませんでした。"), {
          name: "AdminDataError",
          kind: "UNAVAILABLE" as const,
        }),
      },
    };
    const html = renderSnapshot(partial, "integrations");

    expect(html).toContain("API稼働状態を取得できませんでした");
    expect(html).toContain("同期状態・外部連携画面を開く");
    expect(html).toContain("tenant-alpha");
  });
});
