import type { PrescriptionChangeType } from "@yrese/shared-kernel";
import { isPrescriptionChanged } from "@yrese/shared-kernel";

import { DomainStatusBadge } from "./domain-status-badge";

/**
 * 処方変化インジケータ(前回処方からの差分 — H-06/H-07 増減量・中止の見落とし対策)。
 *
 * 重要: これは「事実としての処方差分」であり臨床警告(ClinicalAlert)ではない。
 * 両者を視覚的に分離する(§11.7)。危険性の判断は ClinicalAlert 側が担う。
 * 増減は矢印記号(↑/↓)で色に依存させずに示す(Registry の prescription-change 軸)。
 *
 * 変更前→変更後を併記し、変化を数値で確認できるようにする。PHI をログ・計測へ渡さない。
 */
export interface PrescriptionChangeIndicatorProps {
  readonly change: PrescriptionChangeType;
  /** 薬剤名(表示。取り違え防止のため必須)。 */
  readonly drugName: string;
  /** 前回の用量・用法(任意)。 */
  readonly previous?: string;
  /** 今回の用量・用法(任意)。 */
  readonly current?: string;
}

export function PrescriptionChangeIndicator(props: PrescriptionChangeIndicatorProps) {
  const changed = isPrescriptionChanged(props.change);
  return (
    <span
      className="prescription-change"
      data-change={props.change}
      data-changed={changed ? "true" : "false"}
    >
      <span className="prescription-change-drug">{props.drugName}</span>
      <DomainStatusBadge query={{ domain: "prescription-change", key: props.change }} />
      {(props.previous || props.current) && (
        <span className="prescription-change-delta">
          {props.previous && <span className="prescription-change-prev">{props.previous}</span>}
          {props.previous && props.current && (
            <span className="prescription-change-arrow" aria-hidden="true">
              {" → "}
            </span>
          )}
          {props.current && <span className="prescription-change-curr">{props.current}</span>}
        </span>
      )}
    </span>
  );
}
