import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OperatorCommandBar } from "./components/operator-command-bar";
import { PatientContextBar, PatientContextProvider } from "./components/patient-context";
import { BusinessNav } from "./nav";
import { SystemModeBadge } from "./system-mode-badge";
import "./globals.css";

export const metadata: Metadata = {
  title: "yrese 調剤レセプトコンピューター",
  description: "保険薬局向け 調剤用レセプトコンピューター MVP",
};

/**
 * 全画面共通シェル。
 * 重要状態と患者文脈を固定しつつ、操作者は業務メニューまたは自然言語から
 * 目的のワークスペースへ到達できる。自然言語入力自体は臨床データを変更しない。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <PatientContextProvider>
          <header className="app-header">
            <div className="app-brand">
              <span className="app-brand-mark" aria-hidden="true">Y</span>
              <div>
                <h1 className="app-title">yrese</h1>
                <span className="app-subtitle">調剤業務ワークスペース</span>
              </div>
            </div>
            <SystemModeBadge />
          </header>
          <div className="app-shell">
            <aside className="app-sidebar">
              <BusinessNav />
            </aside>
            <div className="app-workspace">
              <OperatorCommandBar />
              <PatientContextBar />
              <main className="app-main">{children}</main>
            </div>
          </div>
        </PatientContextProvider>
      </body>
    </html>
  );
}
