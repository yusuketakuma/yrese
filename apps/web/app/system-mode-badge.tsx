import type { SystemMode } from "@yrese/shared-kernel";

import {
  SYSTEM_MODE_LABELS,
  SYSTEM_MODE_PRESENTATION,
} from "./status/visual-status-registry";

export const MODE_LABELS: Record<SystemMode, string> = SYSTEM_MODE_LABELS;

/**
 * システムモード常時表示。
 *
 * モード検知 API が未接続の既定状態では NORMAL を推測せず、状態未検知として表示する。
 * mode が明示された場合だけ Visual Status Registry のラベルを表示する。
 */
export function SystemModeBadge({
  mode,
  provisional = mode === undefined,
}: {
  readonly mode?: SystemMode;
  readonly provisional?: boolean;
}) {
  const effectiveMode = mode ?? "NORMAL";
  const displayMode = provisional ? "UNDETECTED" : effectiveMode;

  return (
    <span
      className="system-mode-badge"
      data-mode={displayMode}
      data-provisional={provisional ? "true" : "false"}
      role="status"
      aria-live="polite"
      title={
        provisional
          ? "モード検知バックエンド未接続のため状態を判定できません"
          : undefined
      }
      style={
        provisional
          ? { background: "var(--color-status-attention-bg)" }
          : undefined
      }
    >
      <span className="system-mode-shape" aria-hidden="true">
        {provisional ? "?" : SYSTEM_MODE_PRESENTATION[effectiveMode].shape}
      </span>
      {provisional ? "状態未検知" : MODE_LABELS[effectiveMode]}
      {provisional ? (
        <span className="system-mode-provisional">API未接続</span>
      ) : null}
    </span>
  );
}
