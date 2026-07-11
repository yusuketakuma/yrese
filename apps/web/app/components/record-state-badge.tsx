import type { RecordLifecycleStatus } from "@yrese/shared-kernel";
import { isFinalizedRecord } from "@yrese/shared-kernel";

import { DomainStatusBadge } from "./domain-status-badge";

/**
 * 記録状態バッジ(記録ライフサイクル R-RECLIFE)。
 *
 * 医療UI原則(UIX-001 P-06 確定前後の識別 / P-07 訂正履歴 / P-12 確定者・日時)。
 * 電子保存三基準(真正性): 確定前(下書き)を確定と誤認させない(H-05)。確定後の変更は
 * 「訂正」として確定者・日時・版を残し、原本を上書きしたように見せない。
 *
 * 視覚は Visual Status Registry(record-lifecycle 軸)が単一正本。ここでは状態バッジに加え、
 * 確定/訂正時のみ確定者・日時・版(Level3 詳細)を併記する。PHI をログ・計測へ渡さない。
 */
export interface RecordStateBadgeProps {
  readonly status: RecordLifecycleStatus;
  /** 確定・訂正の実施者(表示名)。確定系状態でのみ表示する。 */
  readonly finalizedBy?: string;
  /** 確定・訂正日時(ISO文字列)。確定系状態でのみ表示する。 */
  readonly finalizedAt?: string;
  /** 版番号(訂正・置換の識別)。 */
  readonly version?: number;
}

export function RecordStateBadge(props: RecordStateBadgeProps) {
  const finalized = isFinalizedRecord(props.status);
  const showAudit = finalized && (props.finalizedBy || props.finalizedAt);
  const verb = props.status === "AMENDED" ? "訂正" : "確定";
  return (
    <span className="record-state" data-record-status={props.status}>
      <DomainStatusBadge query={{ domain: "record-lifecycle", key: props.status }} />
      {typeof props.version === "number" && (
        <span className="record-state-version">第{props.version}版</span>
      )}
      {showAudit && (
        <span className="record-state-audit">
          {verb}
          {props.finalizedBy ? `: ${props.finalizedBy}` : ""}
          {props.finalizedAt ? `(${props.finalizedAt})` : ""}
        </span>
      )}
    </span>
  );
}
