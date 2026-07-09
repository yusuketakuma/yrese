import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SystemModeBadge } from "./system-mode-badge";
import "./globals.css";

export const metadata: Metadata = {
  title: "yrese 調剤レセプトコンピューター",
  description: "保険薬局向け 調剤用レセプトコンピューター MVP",
};

/**
 * 全画面共通シェル。
 * 医療UI原則(v0.1.7 §7): システムモード・外部確認状態などの重要状態は
 * すべての業務画面で常時視認できる位置に固定表示する。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <h1 className="app-title">yrese 調剤レセコン</h1>
          <SystemModeBadge />
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
