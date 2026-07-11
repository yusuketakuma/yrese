import {
  SYSTEM_MODES,
  allowsClaimFinalization,
  allowsFinalCalculation,
  canConfirmExternal,
  type SystemMode,
} from "@yrese/shared-kernel";

import { DomainStatusBadge } from "../components/domain-status-badge";

/**
 * システムモード別 可否早見表(SCR-027 同期状態画面の基盤 / UIX-001 P-19 非常時の見読性)。
 *
 * 判定の唯一の正本は shared-kernel のモードガード関数(canConfirmExternal /
 * allowsFinalCalculation / allowsClaimFinalization)。UI 側で独自判定しない。
 * 非常時(障害・災害)に「このモードで何ができるか」を一覧で読むための静的リファレンス。
 * 「可」はモードガード上で未禁止なだけで、業務上の実行許可(権限・接続状態)ではない。
 */

const CAPABILITY_COLUMNS: readonly {
  readonly label: string;
  readonly allows: (mode: SystemMode) => boolean;
}[] = [
  { label: "外部確認(オン資・電子処方箋・PMH)", allows: canConfirmExternal },
  { label: "確定算定", allows: allowsFinalCalculation },
  { label: "請求前点検・月次締め・レセプト確定", allows: allowsClaimFinalization },
];

export function ModeOverviewTable({ currentMode }: { readonly currentMode: SystemMode }) {
  return (
    <div className="table-scroll">
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
          {SYSTEM_MODES.map((mode) => (
            <tr key={mode} data-mode={mode} data-current={mode === currentMode ? "true" : "false"}>
              <th scope="row">
                <DomainStatusBadge query={{ domain: "system-mode", key: mode }} />
                {mode === currentMode && <span className="mode-overview-current">(現在)</span>}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
