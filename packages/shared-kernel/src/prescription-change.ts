/**
 * 処方変化種別(前回処方からの差分)。
 *
 * 根拠: docs/ui-ux-refresh/12-component-contracts.md(PrescriptionChangeIndicator)、
 * 07-use-error-risk-register.md(H-06/H-07 増減量・中止の見落とし)。
 *
 * 直交性: これは「臨床警告(clinical-alert)ではない、事実としての処方差分」である。
 * 処方差分と臨床警告は視覚的に分離する(§11.7)。差分自体は危険度を持たず、
 * 危険性の判断は clinical-alert 側が担う。色だけに頼らず記号+ラベルで示す。
 */

export const PRESCRIPTION_CHANGE_TYPES = [
  /** 前回から変更なし(継続)。 */
  "UNCHANGED",
  /** 新規(前回になかった薬剤)。 */
  "NEW",
  /** 再開(過去に中止したものの再開)。 */
  "RESUMED",
  /** 増量。 */
  "DOSE_INCREASED",
  /** 減量。 */
  "DOSE_DECREASED",
  /** 用法・剤形・規格等の変更(増減以外)。 */
  "CHANGED",
  /** 中止(前回あったが今回なし/中止指示)。 */
  "DISCONTINUED",
] as const;

export type PrescriptionChangeType = (typeof PRESCRIPTION_CHANGE_TYPES)[number];

export function isPrescriptionChangeType(value: string): value is PrescriptionChangeType {
  return (PRESCRIPTION_CHANGE_TYPES as readonly string[]).includes(value);
}

/** 前回から実質的な変化があるか(UNCHANGED 以外)。強調表示の判断に使う。 */
export function isPrescriptionChanged(type: PrescriptionChangeType): boolean {
  return type !== "UNCHANGED";
}
