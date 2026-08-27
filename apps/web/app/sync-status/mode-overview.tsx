import {
  SYSTEM_MODES,
  allowsClaimFinalization,
  allowsFinalCalculation,
  canConfirmExternal,
  type SystemMode,
} from "@yrese/shared-kernel";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { TableScroll } from "../components/operator-ui";

/**
 * システムモード別 可否早見表(SCR-027 同期状態画面の基盤 / UIX-001 P-19 非常時の見読性)。
 * 判定は shared-kernel のモードガードから導出する静的リファレンスであり、
 * 権限・接続状態・業務上の実行許可を意味しない。モード未検知時は現在行を表示しない。
 */
const CAPABILITY_COLUMNS: readonly {
  readonly label: string;
  readonly allows: (mode: SystemMode) => boolean;
}[] = [
  { label: "外部確認(オン資・電子処方箋・PMH)", allows: canConfirmExternal },
  { label: "確定算定", allows: allowsFinalCalculation },
  { label: "請求前点検・月次締め・レセプト確定", allows: allowsClaimFinalization },
];

export function ModeOverviewTable({
  currentMode,
}: {
  readonly currentMode?: SystemMode;
}) {
  return (
    <TableScroll label="システムモード別の操作可否早見表。横方向にスクロールできます">
      <table className="mode-overview-table" aria-label="システムモード別の操作可否早見表">
        <thead>
          <tr>
            <th scope="col">モード</th>
            {CAPABILITY_COLUMNS.map((column) => (
              <th scope="col" key={column.label}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYSTEM_MODES.map((mode) => {
            const isCurrent = currentMode !== undefined && mode === currentMode;
            return (
              <tr key={mode} data-mode={mode} data-current={isCurrent ? "true" : "false"}>
                <th scope="row">
                  <DomainStatusBadge query={{ domain: "system-mode", key: mode }} />
                  {isCurrent ? <span className="mode-overview-current">(現在)</span> : null}
                </th>
                {CAPABILITY_COLUMNS.map((column) => {
                  const allowed = column.allows(mode);
                  return (
                    <td key={column.label} data-allowed={allowed ? "true" : "false"}>
                      {allowed ? "可" : "不可"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
