/**
 * 臨床アラート種別(調剤時の患者安全チェック)。
 *
 * 根拠: docs/ui-ux-refresh/07-use-error-risk-register.md(H-08 重大警告見落とし)、
 * 12-component-contracts.md(ClinicalAlert)、JIS T 14971 / IEC 62366-1(使用エラー低減)。
 *
 * SaMD 該当性(薬機法): 相互作用・禁忌・用量等の「臨床判断支援」を提供する機能は、
 * 機能単位で医療機器プログラム該当性の評価が必要(グレー時は厚労省/PMDA 該当性相談)。
 * 本 enum と UI は「表示の骨格」であり、判定ロジック・医薬品データの正確性・
 * 該当性評価は別途の医療安全/薬機法レビューを要する(docs/ui-ux-refresh/11 R-SAMD)。
 *
 * 重大度は ErrorSeverity(error-codes.ts)を再利用する(severity SSOT を二重定義しない)。
 * アラート「種別」ごとに視覚(形状・配色)を分離し、単なる処方変更(prescription-change)と
 * 臨床警告を混同させない(§11.7)。CRITICAL の希少性を維持する(UIX-001 §5)。
 */

export const CLINICAL_ALERT_TYPES = [
  /** アレルギー歴との一致(禁忌に準ずる)。 */
  "ALLERGY",
  /** 禁忌(疾患禁忌・併用禁忌等)。 */
  "CONTRAINDICATION",
  /** 薬物相互作用。 */
  "DRUG_INTERACTION",
  /** 重複投薬(同一成分・同一効能の重複)。 */
  "DUPLICATE_THERAPY",
  /** ハイリスク薬(特に安全管理が必要な医薬品)。 */
  "HIGH_RISK_DRUG",
  /** 用量・投与量の上限/下限逸脱。 */
  "DOSAGE_LIMIT",
] as const;

export type ClinicalAlertType = (typeof CLINICAL_ALERT_TYPES)[number];

export function isClinicalAlertType(value: string): value is ClinicalAlertType {
  return (CLINICAL_ALERT_TYPES as readonly string[]).includes(value);
}

/**
 * アラートの確認状態。override(理由記録つき上書き)は監査対象(§12)。
 * 未確認の CRITICAL/BLOCKER を「解決済み」と見せないための状態軸。
 */
export const CLINICAL_ALERT_ACK_STATUSES = [
  /** 未確認(要対応)。 */
  "UNACKNOWLEDGED",
  /** 確認済み(内容を認識)。 */
  "ACKNOWLEDGED",
  /** 理由記録のうえ上書き(override)。監査ログ必須。 */
  "OVERRIDDEN",
  /** 解消(処方修正等で条件が消えた)。 */
  "RESOLVED",
] as const;

export type ClinicalAlertAckStatus = (typeof CLINICAL_ALERT_ACK_STATUSES)[number];

export function isClinicalAlertAckStatus(value: string): value is ClinicalAlertAckStatus {
  return (CLINICAL_ALERT_ACK_STATUSES as readonly string[]).includes(value);
}
