import type { SystemMode } from "@yrese/shared-kernel";

import {
  SYSTEM_MODE_LABELS,
  SYSTEM_MODE_PRESENTATION,
} from "./status/visual-status-registry";

export const MODE_LABELS: Record<SystemMode, string> = SYSTEM_MODE_LABELS;

export interface SystemModeBadgeProps {
  readonly mode?: SystemMode;
  readonly provisional?: boolean;
}

/**
 * システムモード常時表示。
 * mode 未指定は常に未検知へ倒し、provisional=falseを渡してもNORMALを推測しない。
 * mode が明示された場合だけ Visual Status Registry のラベルと形状を投影する。
 */
export function SystemModeBadge({
  mode,
  provisional = false,
}: SystemModeBadgeProps) {
  if (mode === undefined) {
    return (
      <span
        className="system-mode-badge"
        data-mode="UNDETECTED"
        data-provisional="true"
        role="status"
        aria-live="polite"
        title="モード検知バックエンド未接続のため状態を判定できません"
      >
        <span className="system-mode-shape" aria-hidden="true">
          ?
        </span>
        状態未検知
        <span className="system-mode-provisional">API未接続</span>
      </span>
    );
  }

  return (
    <span
      className="system-mode-badge"
      data-mode={mode}
      data-provisional={provisional ? "true" : "false"}
      role="status"
      aria-live="polite"
      title={provisional ? "取得したシステムモードは暫定値です" : undefined}
    >
      <span className="system-mode-shape" aria-hidden="true">
        {SYSTEM_MODE_PRESENTATION[mode].shape}
      </span>
      {MODE_LABELS[mode]}
      {provisional ? <span className="system-mode-provisional">暫定</span> : null}
    </span>
  );
}
