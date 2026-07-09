/**
 * 汎用状態バッジ(WP-3006)。
 *
 * 医療UI原則(UIX-001): 状態は色だけに依存せず、必ずテキストラベルで明示する。
 * tone は補助的な背景色の選択のみを行い、意味は label が担う。
 * PHI をこのコンポーネント経由でログ・計測へ渡してはならない。
 */

export type StatusTone = "ok" | "pending" | "blocked" | "neutral";

export interface StatusBadgeProps {
  /** 表示する状態テキスト(必須 — 色のみの状態表現は禁止) */
  readonly label: string;
  readonly tone: StatusTone;
  /** 機械可読の状態値(data-status 属性。テスト・スタイル用) */
  readonly status?: string;
}

export function StatusBadge({ label, tone, status }: StatusBadgeProps) {
  return (
    <span
      className="status-badge"
      data-tone={tone}
      data-status={status}
      role="status"
    >
      {label}
    </span>
  );
}
