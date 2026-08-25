import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { OperatorCommandBar } from "./components/operator-command-bar";
import { PatientContextBoundary } from "./components/patient-context-boundary";
import { PatientContextProvider } from "./components/patient-context";
import { OperatorPreferencesProvider } from "./components/operator-preferences";
import {
  UnsavedWorkProvider,
  UnsavedWorkStatus,
} from "./components/unsaved-work";
import { BusinessNav } from "./nav";
import { PrescriptionOriginProvider } from "./prescriptions/prescription-origin-context";
import { SystemModeBadge } from "./system-mode-badge";
import "./globals.css";
import "./operator-first.css";
import "./operator-ux-refinement.css";
import "./operator-first-navigation.css";
import "./operator-adversarial-refinement.css";
import "./operator-completion-refinement.css";

export const metadata: Metadata = {
  title: "yrese 調剤レセプトコンピューター",
  description: "保険薬局向け 調剤用レセプトコンピューター MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">
          本文へスキップ
        </a>
        <UnsavedWorkProvider>
          <OperatorPreferencesProvider>
            <PatientContextProvider>
              <PrescriptionOriginProvider>
                <header className="app-header">
                  <div className="app-header-brand-area">
                    <Link
                      className="app-brand"
                      href="/"
                      aria-label="yrese 受付ダッシュボードへ"
                    >
                      <span className="app-brand-mark" aria-hidden="true">
                        Y
                      </span>
                      <div>
                        <h1 className="app-title">yrese</h1>
                        <span className="app-subtitle">
                          調剤業務ワークスペース
                        </span>
                      </div>
                    </Link>
                    <SystemModeBadge />
                  </div>
                  <div className="app-header-command">
                    <OperatorCommandBar />
                  </div>
                  <div
                    className="app-header-meta"
                    role="group"
                    aria-label="接続・実行環境"
                  >
                    <UnsavedWorkStatus />
                    <span
                      className="integration-chip"
                      data-state="disconnected"
                      role="status"
                    >
                      <strong>Gbrain</strong>
                      <small>未接続</small>
                    </span>
                    <span
                      className="integration-chip"
                      data-state="prototype"
                      role="status"
                    >
                      <strong>UI</strong>
                      <small>プロトタイプ</small>
                    </span>
                    <div
                      className="operator-profile"
                      role="group"
                      aria-label="操作者情報は未接続"
                    >
                      <span className="operator-avatar" aria-hidden="true">
                        未
                      </span>
                      <div>
                        <strong>操作者未接続</strong>
                        <small>開発環境</small>
                      </div>
                    </div>
                  </div>
                </header>
                <div className="app-shell">
                  <aside
                    className="app-sidebar"
                    aria-label="主要業務ナビゲーション"
                  >
                    <BusinessNav />
                  </aside>
                  <div className="app-workspace">
                    <PatientContextBoundary />
                    <main id="main-content" className="app-main" tabIndex={-1}>
                      {children}
                    </main>
                  </div>
                </div>
              </PrescriptionOriginProvider>
            </PatientContextProvider>
          </OperatorPreferencesProvider>
        </UnsavedWorkProvider>
      </body>
    </html>
  );
}
