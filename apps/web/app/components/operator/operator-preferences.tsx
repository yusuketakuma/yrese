"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const OPERATOR_VIEWS = ["combined", "clerk", "pharmacist"] as const;
export type OperatorView = (typeof OPERATOR_VIEWS)[number];

interface OperatorPreferencesValue {
  readonly view: OperatorView;
  readonly setView: (view: OperatorView) => void;
}

const OperatorPreferencesContext =
  createContext<OperatorPreferencesValue | null>(null);

/**
 * 表示プリセットだけを保持する非権限コンテキスト。
 * ロール、permission scope、患者安全情報、API認可は変更しない。
 * 現段階ではブラウザ永続化せず、同一タブのProvider生存期間だけ保持する。
 */
export function OperatorPreferencesProvider({
  children,
  initialView = "combined",
}: {
  readonly children: ReactNode;
  readonly initialView?: OperatorView;
}) {
  const [view, setView] = useState<OperatorView>(initialView);
  const value = useMemo(() => ({ view, setView }), [view]);

  return (
    <OperatorPreferencesContext.Provider value={value}>
      {children}
    </OperatorPreferencesContext.Provider>
  );
}

export function useOptionalOperatorPreferences():
  | OperatorPreferencesValue
  | null {
  return useContext(OperatorPreferencesContext);
}

export function useOperatorPreferences(): OperatorPreferencesValue {
  const context = useOptionalOperatorPreferences();
  if (context === null) {
    throw new Error(
      "useOperatorPreferences must be used within OperatorPreferencesProvider",
    );
  }
  return context;
}
