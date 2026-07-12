import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import AdminPage from "./admin/page";
import CheckoutPage from "./checkout/page";
import ClaimCheckPage from "./claim-check/page";
import MastersPage from "./masters/page";
import MonthlyClosingPage from "./monthly-closing/page";
import { BusinessNav, NAV_ITEMS } from "./nav";
import ReceptionDashboard from "./page";
import PrescriptionsPage from "./prescriptions/page";
import SyncStatusPage from "./sync-status/page";
import { SystemModeBadge } from "./system-mode-badge";

(globalThis as { React?: typeof React }).React = React;

describe("web shell smoke contracts", () => {
  it("renders every business navigation item with stable hrefs and production current marker", () => {
    navigation.pathname = "/patients";
    const html = renderToStaticMarkup(<BusinessNav />);

    for (const item of NAV_ITEMS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
    expect(html).toContain('aria-label="業務メニュー"');
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/patients"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it.each(["/", "/patients", "/admin"])(
    "marks exactly one navigation item for the exact pathname: %s",
    (pathname) => {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(<BusinessNav />);

      expect(html).toMatch(
        new RegExp(`<a[^>]*aria-current="page"[^>]*href="${pathname === "/" ? "\\/" : pathname}"`),
      );
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    },
  );

  it.each(["/not-present", "/patients/example"])(
    "does not infer a current navigation item for an unmatched pathname: %s",
    (pathname) => {
      navigation.pathname = pathname;

      expect(renderToStaticMarkup(<BusinessNav />)).not.toContain('aria-current="page"');
    },
  );

  it("renders system mode labels without relying on color only", () => {
    expect(renderToStaticMarkup(<SystemModeBadge />)).toContain("通常稼働");
    expect(renderToStaticMarkup(<SystemModeBadge mode="LOCAL_ONLY" />)).toContain(
      "ローカル単独稼働(外部確認不可)",
    );
    expect(renderToStaticMarkup(<SystemModeBadge mode="LOCAL_ONLY" />)).toContain(
      'data-mode="LOCAL_ONLY"',
    );
  });

  it("renders the implemented reception dashboard route (WP-3009-UI)", () => {
    const html = renderToStaticMarkup(<ReceptionDashboard />);

    expect(html).toContain("<h2>受付ダッシュボード</h2>");
    expect(html).toContain('aria-label="受付ダッシュボード"');
    expect(html).toContain("受付登録");
    expect(html).not.toMatch(/未実装|scaffold/);
  });

  it.each([
    ["処方入力", <PrescriptionsPage />],
    ["会計", <CheckoutPage />],
    ["請求前点検", <ClaimCheckPage />],
    ["月次締め", <MonthlyClosingPage />],
    ["マスター管理", <MastersPage />],
    ["同期状態", <SyncStatusPage />],
    ["管理", <AdminPage />],
  ])("renders placeholder route heading: %s", (heading, element) => {
    const html = renderToStaticMarkup(element);

    expect(html).toContain(`<h2>${heading}</h2>`);
    expect(html).toMatch(/未実装|scaffold/);
  });
});
