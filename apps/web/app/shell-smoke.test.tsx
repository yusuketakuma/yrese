import React, { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import AdminPage from "./admin/page";
import CheckoutPage from "./checkout/page";
import ClaimCheckPage from "./claim-check/page";
import RootLayout from "./layout";
import MastersPage from "./masters/page";
import MonthlyClosingPage from "./monthly-closing/page";
import { BusinessNav, NAV_GROUPS, NAV_ITEMS } from "./nav";
import ReceptionPage from "./page";
import PatientsPage from "./patients/page";
import PrescriptionsPage from "./prescriptions/page";
import SyncStatusPage from "./sync-status/page";
import { SystemModeBadge } from "./system-mode-badge";

(globalThis as { React?: typeof React }).React = React;

function currentHref(html: string): string | undefined {
  return html.match(
    /<a(?=[^>]*\baria-current="page")(?=[^>]*\bhref="([^"]+)")[^>]*>/,
  )?.[1];
}

describe("web shell smoke contracts", () => {
  it("renders every business navigation item with stable hrefs", () => {
    navigation.pathname = "/patients";
    const html = renderToStaticMarkup(<BusinessNav />);

    for (const item of NAV_ITEMS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
    expect(html).toContain('id="business-nav-label"');
    expect(html).toContain('aria-labelledby="business-nav-label"');
    for (const group of NAV_GROUPS) expect(html).toContain(group.label);
    expect(currentHref(html)).toBe("/patients");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it.each(["/", "/patients", "/admin"])(
    "marks exactly one navigation item for the exact pathname: %s",
    (pathname: string) => {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(<BusinessNav />);

      expect(currentHref(html)).toBe(pathname);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    },
  );

  it("keeps a parent workspace active for a nested route", () => {
    navigation.pathname = "/patients/example";
    const html = renderToStaticMarkup(<BusinessNav />);

    expect(currentHref(html)).toBe("/patients");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("does not infer a current navigation item for an unmatched pathname", () => {
    navigation.pathname = "/not-present";
    expect(renderToStaticMarkup(<BusinessNav />)).not.toContain('aria-current="page"');
  });

  it("fails closed when the system mode API is unconnected", () => {
    const defaultMode = renderToStaticMarkup(<SystemModeBadge />);
    expect(defaultMode).toContain("状態未検知");
    expect(defaultMode).toContain("API未接続");
    expect(defaultMode).toContain('data-mode="UNDETECTED"');
    expect(defaultMode).toContain('data-provisional="true"');
    expect(defaultMode).not.toContain("通常稼働");

    const forcedFalse = renderToStaticMarkup(<SystemModeBadge provisional={false} />);
    expect(forcedFalse).toContain("状態未検知");
    expect(forcedFalse).not.toContain("通常稼働");

    const localOnly = renderToStaticMarkup(<SystemModeBadge mode="LOCAL_ONLY" />);
    expect(localOnly).toContain("ローカル単独稼働(外部確認不可)");
    expect(localOnly).toContain('data-mode="LOCAL_ONLY"');
    expect(localOnly).toContain('data-provisional="false"');
  });

  it("provides truthful keyboard landmarks without inviting PHI in the command bar", () => {
    navigation.pathname = "/";
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>本文</p>
      </RootLayout>,
    );

    expect(html).toContain('class="skip-link"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain("Gbrain");
    expect(html).toContain("未接続");
    expect(html).toContain("プロフィール表示未接続");
    expect(html).not.toContain("操作者未接続");
    expect(html).toContain('aria-keyshortcuts="/ Control+K Meta+K"');
    expect(html).toContain("患者名は入れず業務名で検索");
    expect(html).toContain('aria-label="主要業務へのショートカット"');
    expect(html).not.toContain("山田さんを検索して");
    expect(html).not.toContain('aria-label="通知 2件"');
  });

  it("retains the implemented reception queue while disabling unconnected intake actions", () => {
    const html = renderToStaticMarkup(<ReceptionPage />);

    expect(html).toContain("受付ダッシュボード");
    expect(html).toContain("既存受付API配線");
    expect(html).toContain("受付キュー");
    expect(html).toContain('aria-label="受付ダッシュボード"');
    expect(html).toContain("処方せんQR");
    expect(html).toContain("電子処方箋");
    expect(html).toContain("現在は安全に未接続です");
    expect(html).toContain("disabled");
  });

  it("retains the implemented patient search inside the new workspace", () => {
    const html = renderToStaticMarkup(<PatientsPage />);
    expect(html).toContain("患者検索・患者管理");
    expect(html).toContain("既存患者検索API配線");
    expect(html).toContain('aria-label="患者検索"');
  });

  it("keeps prescription work blocked until a patient is selected", () => {
    const html = renderToStaticMarkup(<PrescriptionsPage />);
    expect(html).toContain("処方入力ワークスペース");
    expect(html).toContain("業務対象の患者が選択されていません");
    expect(html).toContain("患者取り違え防止");
    expect(html).toContain('href="/patients"');
  });

  it.each([
    ["会計・一部負担金", "算定・会計API未接続", <CheckoutPage />],
    ["請求前点検", "BLOCKED_REGULATORY_REVIEW", <ClaimCheckPage />],
    ["月次締め・返戻管理", "締めAPI未接続", <MonthlyClosingPage />],
    ["マスター管理", "master_update_pipeline未承認", <MastersPage />],
  ])("renders a non-operational prototype for %s", (title: string, boundary: string, element: ReactElement) => {
    const html = renderToStaticMarkup(element);
    expect(html).toContain(title);
    expect(html).toContain("UIプロトタイプ");
    expect(html).toContain(boundary);
    expect(html).toContain("disabled");
  });

  it("fails closed when synchronization and system mode cannot be detected", () => {
    const html = renderToStaticMarkup(<SyncStatusPage />);
    expect(html).toContain("同期状態・外部連携");
    expect(html).toContain("システムモード未検知");
    expect(html).toContain("NORMAL・障害・オフラインのいずれも推測しません");
    expect(html).toContain("判定不可・実行不可");
    expect(html).not.toContain("すべて正常に稼働中");
    expect(html).toMatch(
      /<table class="operator-table"><thead><tr>(?:<th scope="col">[^<]+<\/th>){5}/,
    );
  });

  it("renders the connected SCR-029 boundary without reintroducing the retired audit viewer", () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("yrese 管理設定ダッシュボード");
    expect(html).toContain("認証・tenant境界・API状態を検証しています");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("テナント・薬局・ユーザー・権限管理は未実装のプレースホルダー");
    expect(html).not.toContain("監査イベント一覧");
    expect(html).not.toContain(["SCR", "028"].join("-"));
    expect(html).not.toContain(["audit", "log", "panel"].join("-"));
  });
});
