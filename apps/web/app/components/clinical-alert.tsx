import type {
  ClinicalAlertAckStatus,
  ClinicalAlertType,
  ErrorSeverity,
} from "@yrese/shared-kernel";

import { DomainStatusBadge } from "./domain-status-badge";
import {
  CLINICAL_ALERT_TYPE_IDENTITY,
  SEVERITY_ORDER,
  SEVERITY_PRESENTATION,
} from "../status/visual-status-registry";

/**
 * 臨床アラート(調剤時の患者安全チェック — H-08 重大警告見落とし対策)。
 *
 * SaMD 注記(薬機法): 相互作用・禁忌・用量等の臨床判断支援は機能単位で医療機器プログラム
 * 該当性の評価を要する(docs/ui-ux-refresh/11 R-SAMD)。本コンポーネントは「表示の骨格」であり、
 * 判定ロジック・医薬品データの正確性・該当性評価は医療安全/薬機法レビューの責務。
 *
 * 設計原則:
 * - 重大度(severity)がトーン・ARIA を決める。CRITICAL の希少性を保つ(UIX-001 §5)。
 * - 種別(alertType)ごとに形状・ラベルを分離(アレルギー/禁忌/相互作用/重複/ハイリスク/用量)。
 * - 単なる処方変更(PrescriptionChangeIndicator)と臨床警告を視覚的に混同させない(§11.7)。
 * - 未確認(ack=UNACKNOWLEDGED)を解決済みに見せない。override は理由記録+監査前提。
 * - 点滅させない・reduced-motion 尊重(globals.css)。色だけに意味を担わせない(label 必須)。
 * PHI をログ・計測へ渡さない。
 */
export interface ClinicalAlertProps {
  readonly alertType: ClinicalAlertType;
  readonly severity: ErrorSeverity;
  /** 対象薬剤名(取り違え防止のため必須)。 */
  readonly drugName: string;
  /** 検出理由(なぜ警告か)。 */
  readonly detail: string;
  /** 情報源(判断根拠のトレーサビリティ)。 */
  readonly source?: string;
  /** 評価日時(ISO文字列)。 */
  readonly evaluatedAt?: string;
  /** 推奨される確認・対応。 */
  readonly recommendedAction?: string;
  /** 確認状態。既定は未確認。 */
  readonly ack?: ClinicalAlertAckStatus;
  /** 続行前に確認必須(ブロッキング)か。 */
  readonly blocking?: boolean;
}

export function ClinicalAlert(props: ClinicalAlertProps) {
  const severity = SEVERITY_PRESENTATION[props.severity];
  const identity = CLINICAL_ALERT_TYPE_IDENTITY[props.alertType];
  const ack: ClinicalAlertAckStatus = props.ack ?? "UNACKNOWLEDGED";
  return (
    <section
      className="clinical-alert"
      data-alert-type={props.alertType}
      data-severity={props.severity}
      data-tone={severity.tone}
      data-blocking={props.blocking ? "true" : "false"}
      data-ack={ack}
      role={severity.ariaRole}
      aria-live={severity.ariaLive}
    >
      <div className="clinical-alert-header">
        <span className="clinical-alert-shape" aria-hidden="true">
          {identity.shape}
        </span>
        <span className="clinical-alert-type">{identity.label}</span>
        <span className="clinical-alert-severity">[{severity.label}]</span>
        {props.blocking && <span className="clinical-alert-blocking">続行前に確認が必要</span>}
      </div>
      <div className="clinical-alert-body">
        <span className="clinical-alert-drug">対象薬剤: {props.drugName}</span>
        <span className="clinical-alert-detail">{props.detail}</span>
        {props.recommendedAction && (
          <span className="clinical-alert-action">推奨対応: {props.recommendedAction}</span>
        )}
        <span className="clinical-alert-provenance">
          {props.source && <span className="clinical-alert-source">情報源: {props.source}</span>}
          {props.evaluatedAt && (
            <span className="clinical-alert-evaluated-at">評価: {props.evaluatedAt}</span>
          )}
        </span>
      </div>
      <div className="clinical-alert-ack">
        <DomainStatusBadge query={{ domain: "clinical-ack", key: ack }} />
      </div>
    </section>
  );
}

/**
 * 臨床アラート集約(複数アラートから critical を見つけやすくする — H-08)。
 * 重大度降順で件数を示し、最上位の重大度を先頭に強調する。0件時は安全な空表示。
 */
export interface ClinicalAlertSummaryProps {
  readonly alerts: readonly {
    readonly severity: ErrorSeverity;
    readonly alertType: ClinicalAlertType;
    readonly ack?: ClinicalAlertAckStatus;
  }[];
}

/** 未確認かつ最重大の severity を返す(なければ null)。表示強調の判断に使う。 */
export function highestUnacknowledgedSeverity(
  alerts: ClinicalAlertSummaryProps["alerts"],
): ErrorSeverity | null {
  const unresolved = alerts.filter((a) => (a.ack ?? "UNACKNOWLEDGED") === "UNACKNOWLEDGED");
  for (const severity of SEVERITY_ORDER) {
    if (unresolved.some((a) => a.severity === severity)) {
      return severity;
    }
  }
  return null;
}

export function ClinicalAlertSummary(props: ClinicalAlertSummaryProps) {
  const total = props.alerts.length;
  if (total === 0) {
    return (
      <div className="clinical-alert-summary" data-total="0" role="status">
        臨床アラートはありません
      </div>
    );
  }
  const counts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: props.alerts.filter((a) => a.severity === severity).length,
  })).filter((c) => c.count > 0);
  const top = highestUnacknowledgedSeverity(props.alerts);
  const topPresentation = top ? SEVERITY_PRESENTATION[top] : null;
  return (
    <div
      className="clinical-alert-summary"
      data-total={total}
      data-top-severity={top ?? "NONE"}
      role={topPresentation?.ariaRole ?? "status"}
      aria-live={topPresentation?.ariaLive ?? "polite"}
    >
      <span className="clinical-alert-summary-total">要確認 {total}件</span>
      {top && (
        <span className="clinical-alert-summary-top">
          未確認の最重大: {SEVERITY_PRESENTATION[top].label}
        </span>
      )}
      <ul className="clinical-alert-summary-breakdown">
        {counts.map((c) => (
          <li key={c.severity} data-severity={c.severity}>
            <span aria-hidden="true">{SEVERITY_PRESENTATION[c.severity].shape}</span>{" "}
            {SEVERITY_PRESENTATION[c.severity].label}: {c.count}件
          </li>
        ))}
      </ul>
    </div>
  );
}
