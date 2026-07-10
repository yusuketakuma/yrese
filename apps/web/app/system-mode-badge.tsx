import type { SystemMode } from "@yrese/shared-kernel";

export const MODE_LABELS: Record<SystemMode, string> = {
  NORMAL: "通常稼働",
  EXTERNAL_DEGRADED: "外部システム障害",
  CLOUD_DEGRADED: "クラウド障害",
  LOCAL_ONLY: "ローカル単独稼働(外部確認不可)",
  RECOVERY_SYNC: "復旧同期中(要再検証)",
};

/**
 * システムモード常時表示バッジ。
 * 現時点はモード検知バックエンドが未実装のため NORMAL 固定のプレースホルダー。
 * モード取得APIは API Contract SSOT 承認後に接続する(未定義APIの仮定は禁止)。
 * 色だけに依存しない状態表現のため、必ず日本語ラベルを表示する。
 */
export function SystemModeBadge({ mode = "NORMAL" }: { mode?: SystemMode }) {
  return (
    <span
      className="system-mode-badge"
      data-mode={mode}
      role="status"
      aria-live="polite"
    >
      {MODE_LABELS[mode]}
    </span>
  );
}
