import type { SystemMode } from "@yrese/shared-kernel";

import {
  SYSTEM_MODE_LABELS,
  SYSTEM_MODE_PRESENTATION,
} from "./status/visual-status-registry";

export const MODE_LABELS: Record<SystemMode, string> = SYSTEM_MODE_LABELS;

/**
 * システムモード常時表示。
 * モード検知APIは未接続であるため、既定値はNORMALだが必ず「暫定」を併記する。
 * 実状態の正常性を保証する表示として扱ってはならない。
 */
export function SystemModeBadge({
  mode = "NORMAL",
  provisional = true,
}: {
  readonly mode?: SystemMode;
  readonly provisional?: boolean;
}) {
  return (
    <span
      className="system-mode-badge"
      data-mode={mode}
      data-provisional={provisional ? "true" : "false"}
      role="status"
      aria-live="polite"
      title={provisional ? "モード検知バックエンド未接続のため暫定表示" : undefined}
    >
      <span className="system-mode-shape" aria-hidden="true">
        {SYSTEM_MODE_PRESENTATION[mode].shape}
      </span>
      {MODE_LABELS[mode]}
      {provisional ? <span className="system-mode-provisional">暫定</span> : null}
    </span>
  );
}
