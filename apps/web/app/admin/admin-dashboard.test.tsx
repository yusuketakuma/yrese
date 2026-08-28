import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PermissionScope } from "@yrese/shared-kernel";

import type {
  AdminDashboardSnapshot,
  AdminMigrationSection,
} from "./admin-data";
import {
  AdminDashboardView,
  loadAdminDashboardSafely,
} from "./admin-dashboard";

(globalThis as { React?: typeof React }).React = React;

const PREFERENCES = {
  reducedMotion: true,
  forcedColors: false,
  darkScheme: false,
} as const;

const MIGRATION_READY: AdminMigrationSection = {
  status: "ready",
  data: {
    available: true,
    result: "up_to_date",
    appliedCount: 13,
    availableCount: 13,
    pendingVersions: [],
    latestAppliedVersion: "000013",
    latestAppliedName: "create_prescription_drafts",
  },
};

function snapshotFor(
  tenantId: string,
  pharmacyId: string,
  actorId: string,
  scopes: PermissionScope[] = ["tenant:read", "tenant:admin", "user:admin"],
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
    migrationState: MIGRATION_READY,
    loadedAt: "2026-08-25T00:01:00.000Z",
  };
}

function withMigrationState(
  snapshot: AdminDashboardSnapshot,
  migrationState: AdminMigrationSection,
): AdminDashboardSnapshot {
  return { ...snapshot, migrationState };
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
  refreshing = false,
): string {
  return renderToStaticMarkup(
    <AdminDashboardView
      snapshot={snapshot}
      preferences={PREFERENCES}
      activeTab={activeTab}
      onTabChange={() => undefined}
      onRefresh={() => undefined}
      refreshing={refreshing}
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

  it("keeps the tab contract keyboard-reachable without dangling controls", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
    );
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g) ?? [];

    expect(tabs.filter((tab) => tab.includes('tabindex="0"'))).toHaveLength(1);
    expect(tabs.filter((tab) => tab.includes('tabindex="-1"'))).toHaveLength(6);
    expect(html.match(/aria-controls="admin-tabpanel-/g)).toHaveLength(1);
    expect(html).toContain('aria-controls="admin-tabpanel-overview"');
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

  it("renders the measured schema migration state inside the integrations tab", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      "integrations",
    );

    expect(html).toContain("DBスキーマ適用状態");
    expect(html).toContain("定義と一致(適用済み)");
    expect(html).toContain("13 件");
    expect(html).toContain("000013");
    expect(html).toContain("create_prescription_drafts");
    // checksum の値そのものと接続情報は API も UI も運ばない。
    expect(html).not.toContain("checksum:");
    expect(html).not.toContain("DATABASE_URL");
  });

  it("never renders an omitted pendingVersions as a measured zero", () => {
    const html = renderSnapshot(
      withMigrationState(
        snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
        {
          status: "ready",
          // 照合が 000004 で停止した結果。未適用件数は導出されておらず API も返さない。
          data: {
            available: true,
            result: "checksum_mismatch",
            appliedCount: 4,
            availableCount: 13,
          },
        },
      ),
      "integrations",
    );

    expect(html).toContain(
      "—（この照合結果からは導出できません。0件ではありません）",
    );
    expect(html).not.toContain("なし（0件）");
  });

  it("renders a derived empty pendingVersions as the measured zero it is", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      "integrations",
    );

    expect(MIGRATION_READY.status === "ready" && MIGRATION_READY.data.available).toBe(true);
    expect(html).toContain("なし（0件）");
  });

  it("states the unconfigured persistent store honestly instead of implying a healthy schema", () => {
    const html = renderSnapshot(
      withMigrationState(
        snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
        {
          status: "ready",
          data: { available: false, reason: "PERSISTENT_STORE_NOT_CONFIGURED" },
        },
      ),
      "integrations",
    );

    expect(html).toContain(
      "永続ストアが構成されていないため、スキーマ適用状態を取得していません。",
    );
    expect(html).toContain(
      "未取得であることは、スキーマが最新であること・不整合が無いことのいずれも意味しません。",
    );
    expect(html).not.toContain("定義と一致(適用済み)");
    expect(html).not.toContain("PERSISTENT_STORE_NOT_CONFIGURED");
  });

  it("keeps a migration-state failure section-scoped and free of server wording", () => {
    const html = renderSnapshot(
      withMigrationState(
        snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
        {
          status: "error",
          notice: {
            message: "集計APIの応答が契約と一致しません。",
            nextAction: "表示を中止しました。管理者へ連絡してください。",
          },
        },
      ),
      "integrations",
    );

    expect(html).toContain("集計APIの応答が契約と一致しません。");
    expect(html).toContain("表示を中止しました。管理者へ連絡してください。");
    // 同じタブの /health パネルは失敗に巻き込まれない。
    expect(html).toContain("API接続状態");
    expect(html).toContain("0.0.1");
  });

  it("keeps the previous result visible while re-fetching and says what is shown", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      "overview",
      true,
    );

    expect(html).toContain("再取得中");
    expect(html).toContain("画面上の値はまだ更新されていません。");
    expect(html).toContain('role="status"');
    // 前回結果は消さない。
    expect(html).toContain("tenant-alpha");
    expect(html).toContain("更新中…");
  });

  it("keeps exactly the seven approved tabs", () => {
    const html = renderSnapshot(
      snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
    );

    expect(html.match(/role="tab"/g)).toHaveLength(7);
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

  it("does not construct Intl.DateTimeFormat during render and keeps JST output (WP-5262 hoisted formatter)", () => {
    // spy設置前に、元と同一optionsの独立フォーマッタで期待表示を導出する
    const expectedLoadedAt = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Tokyo",
    }).format(new Date("2026-08-25T00:01:00.000Z"));
    const constructorSpy = vi.spyOn(Intl, "DateTimeFormat");
    try {
      const first = renderSnapshot(
        snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      );
      const second = renderSnapshot(
        snapshotFor("tenant-alpha", "pharmacy-alpha", "actor-alpha"),
      );
      expect(first).toContain(expectedLoadedAt);
      expect(second).toContain(expectedLoadedAt);
      expect(constructorSpy).not.toHaveBeenCalled();
    } finally {
      constructorSpy.mockRestore();
    }
  });
});

describe("loadAdminDashboardSafely", () => {
  it.each([
    [
      "同期例外",
      () => {
        throw new Error("raw sync failure");
      },
    ],
    ["非同期拒否", () => Promise.reject(new Error("raw async failure"))],
  ])("converges a %s to the fixed unavailable snapshot", async (_label, load) => {
    const snapshot = await loadAdminDashboardSafely(load);

    expect(snapshot.identity.status).toBe("error");
    expect(snapshot.health.status).toBe("error");
    expect(snapshot.migrationState.status).toBe("error");
    expect(JSON.stringify(snapshot)).toContain("管理情報を取得できませんでした。");
    expect(JSON.stringify(snapshot)).not.toContain("raw ");
  });
});
