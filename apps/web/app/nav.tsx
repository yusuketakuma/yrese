"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 業務ナビゲーション。
 * 画面群は docs/plan/phase0_plan.md §5 screen_inventory 仮説の主要業務フロー順
 * (受付 → 患者 → 処方入力 → 会計 → 請求前点検 → 月次締め)に並べる。
 * 医療UI原則: 業務順序に沿ったナビゲーション、重要状態を隠さない。
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "受付" },
  { href: "/patients", label: "患者" },
  { href: "/prescriptions", label: "処方入力" },
  { href: "/checkout", label: "会計" },
  { href: "/claim-check", label: "請求前点検" },
  { href: "/monthly-closing", label: "月次締め" },
  { href: "/masters", label: "マスター" },
  { href: "/sync-status", label: "同期状態" },
  { href: "/admin", label: "管理" },
] as const;

export function BusinessNav() {
  return <BusinessNavView current={usePathname()} />;
}

export function BusinessNavView({ current }: { readonly current: string }) {
  return (
    <nav className="app-nav" aria-label="業務メニュー">
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
