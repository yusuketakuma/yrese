import type { ErrorSeverity } from "@yrese/shared-kernel";

import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  SEVERITY_PRESENTATION,
} from "../status/visual-status-registry";

/**
 * 重要度別メッセージリスト(WP-3006 / UIX-001 §5)。
 *
 * 重要度は shared-kernel の ErrorSeverity(INFO/WARNING/ERROR/BLOCKER/CRITICAL)を再利用し、
 * ラベル・表示順・形状は Visual Status Registry(単一正本)から導出する(ローカル定義しない)。
 * 色は補助であり、重要度は必ずテキストで明示する。さらに色に依存しない冗長エンコードとして
 * 形状記号(aria-hidden の補助シンボル)を併記する(監査 A-03 / §11.4-3,15,16)。
 * 表示順は重要度の高い順(BLOCKER → CRITICAL → ERROR → WARNING → INFO)に固定。
 */

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
          <span className="severity-shape" aria-hidden="true">
            {SEVERITY_PRESENTATION[item.severity].shape}
          </span>
          <span className="severity-label">
            [{SEVERITY_LABELS[item.severity]}({item.severity})]
          </span>
          {item.message}
        </li>
      ))}
    </ul>
  );
}
