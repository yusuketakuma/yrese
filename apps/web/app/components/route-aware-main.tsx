"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

const ADMIN_MAIN_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: "none",
  padding: 0,
  background: "#f8f9fc",
};

export function isWideWorkspaceRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Keep the legacy shell for existing routes while allowing approved dense workspaces to widen. */
export function RouteAwareMain({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      className="app-main"
      style={isWideWorkspaceRoute(pathname) ? ADMIN_MAIN_STYLE : undefined}
    >
      {children}
    </main>
  );
}
