import type { ErrorSeverity } from "@yrese/shared-kernel";

/**
 * 重要度別メッセージリスト(WP-3006 / UIX-001 §5)。
 *
 * 重要度は shared-kernel の ErrorSeverity(INFO/WARNING/ERROR/BLOCKER/CRITICAL)を
 * 再利用し、ローカル定義しない。色は補助であり、重要度は必ずテキストで明示する。
 * 表示順は重要度の高い順(BLOCKER → CRITICAL → ERROR → WARNING → INFO)に固定。
 */

const SEVERITY_ORDER: readonly ErrorSeverity[] = [
  "BLOCKER",
  "CRITICAL",
  "ERROR",
  "WARNING",
  "INFO",
];

const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  BLOCKER: "停止",
  CRITICAL: "重大",
  ERROR: "エラー",
  WARNING: "警告",
  INFO: "情報",
};

export interface SeverityItem {
  readonly severity: ErrorSeverity;
  readonly message: string;
}

export function SeverityList({ items }: { readonly items: readonly SeverityItem[] }) {
  const sorted = [...items].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  return (
    <ul className="severity-list" role="list">
      {sorted.map((item, index) => (
        <li key={`${item.severity}-${index}`} data-severity={item.severity}>
          <span className="severity-label">
            [{SEVERITY_LABELS[item.severity]}({item.severity})]
          </span>
          {item.message}
        </li>
      ))}
    </ul>
  );
}
