import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OperatorCommandBar } from "./components/operator-command-bar";
import { PatientContextBar, PatientContextProvider } from "./components/patient-context";
import { BusinessNav } from "./nav";
import { SystemModeBadge } from "./system-mode-badge";
import "./globals.css";
import "./operator-first.css";

export const metadata: Metadata = {
  title: "yrese 調剤レセプトコンピューター",
  description: "保険薬局向け 調剤用レセプトコンピューター MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <PatientContextProvider>
          <header className="app-header">
            <div className="app-header-brand-area">
              <div className="app-brand">
                <span className="app-brand-mark" aria-hidden="true">
                  Y
                </span>
                <div>
                  <h1 className="app-title">yrese</h1>
                  <span className="app-subtitle">調剤業務ワークスペース</span>
                </div>
              </div>
              <SystemModeBadge />
            </div>
            <div className="app-header-command">
              <OperatorCommandBar />
            </div>
            <div className="app-header-meta">
              <span className="integration-chip" data-state="disconnected">
                <strong>Gbrain</strong>
                <small>未接続</small>
              </span>
              <span className="integration-chip" data-state="branch">
                <strong>GitHub</strong>
                <small>UI branch</small>
              </span>
              <span className="app-notification" aria-label="通知 2件">
                2
              </span>
              <div className="operator-profile">
                <span className="operator-avatar" aria-hidden="true">
                  薬
                </span>
                <div>
                  <strong>薬剤師</strong>
                  <small>開発環境</small>
                </div>
              </div>
            </div>
          </header>
          <div className="app-shell">
            <aside className="app-sidebar">
              <BusinessNav />
            </aside>
            <div className="app-workspace">
              <PatientContextBar />
              <main className="app-main">{children}</main>
            </div>
          </div>
        </PatientContextProvider>
      </body>
    </html>
  );
}
