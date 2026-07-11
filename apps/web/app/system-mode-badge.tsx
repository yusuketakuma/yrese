import type { SystemMode } from "@yrese/shared-kernel";

import {
  SYSTEM_MODE_LABELS,
  SYSTEM_MODE_PRESENTATION,
} from "./status/visual-status-registry";

/**
 * システムモード表示文言。正本は Visual Status Registry(SYSTEM_MODE_LABELS)。
 * 既存 import(mode-capability-view 等)との互換のため同名で再エクスポートする。
 */
export const MODE_LABELS: Record<SystemMode, string> = SYSTEM_MODE_LABELS;

/**
 * システムモード常時表示バッジ。
 * 現時点はモード検知バックエンドが未実装のため NORMAL 固定のプレースホルダー。
 * モード取得APIは API Contract SSOT 承認後に接続する(未定義APIの仮定は禁止)。
 * 色だけに依存しない状態表現のため、必ず日本語ラベルを表示し、色非依存の冗長エンコードとして
 * 形状記号(aria-hidden の補助シンボル)を併記する(監査 A-03)。
 */
export function SystemModeBadge({ mode = "NORMAL" }: { mode?: SystemMode }) {
  return (
    <span
      className="system-mode-badge"
      data-mode={mode}
      role="status"
      aria-live="polite"
    >
      <span className="system-mode-shape" aria-hidden="true">
        {SYSTEM_MODE_PRESENTATION[mode].shape}
      </span>
      {MODE_LABELS[mode]}
    </span>
  );
}
