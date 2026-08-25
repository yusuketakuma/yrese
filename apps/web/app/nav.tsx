"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "受付", icon: "受" },
  { href: "/patients", label: "患者", icon: "患" },
  { href: "/prescriptions", label: "処方入力", icon: "処" },
  { href: "/checkout", label: "会計", icon: "会" },
  { href: "/claim-check", label: "請求前点検", icon: "点" },
  { href: "/monthly-closing", label: "月次締め", icon: "締" },
  { href: "/masters", label: "マスター", icon: "マ" },
  { href: "/sync-status", label: "同期状態", icon: "同" },
  { href: "/admin", label: "管理・設定", icon: "管" },
] as const;

function isCurrentPath(current: string, href: string): boolean {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

export function BusinessNav() {
  return <BusinessNavView current={usePathname()} />;
}

export function BusinessNavView({ current }: { readonly current: string }) {
  return (
    <div className="app-nav-wrap">
      <p className="app-nav-label" id="business-nav-label">
        業務メニュー
      </p>
      <nav className="app-nav" aria-labelledby="business-nav-label">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="app-nav-link"
                aria-current={isCurrentPath(current, item.href) ? "page" : undefined}
              >
                <span className="app-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <footer className="app-nav-footer">
        <strong>開発用UIプレビュー</strong>
        <span>未接続機能は各画面内に明示</span>
      </footer>
    </div>
  );
}
