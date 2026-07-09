/**
 * 保留・仮状態ステータス。
 *
 * 根拠: 構築プロンプト v0.1.7 §14(LOCAL_ONLY での必須付与ステータス)、§0.0.3.3。
 * LOCAL_ONLY で生成された計算・帳票・受付には、これらのいずれかを必ず付与する。
 * 外部確認未完了の処理を「成功扱い」に見せることは禁止(§15)。
 */

export const PROVISIONAL_STATUSES = [
  "PROVISIONAL_CALCULATION",
  "PENDING_REVERIFY",
  "PENDING_EXTERNAL_SYNC",
  "PENDING_PMH_REVERIFY",
  "LOCAL_ONLY_UNVERIFIED",
  "MANUAL_REVIEW_REQUIRED",
] as const;

export type ProvisionalStatus = (typeof PROVISIONAL_STATUSES)[number];

export function isProvisionalStatus(value: string): value is ProvisionalStatus {
  return (PROVISIONAL_STATUSES as readonly string[]).includes(value);
}

/**
 * 復旧後同期での競合状態。自動補正は禁止(v0.1.7 §16)。
 */
export const CONFLICT_REQUIRES_HUMAN_REVIEW = "CONFLICT_REQUIRES_HUMAN_REVIEW" as const;

/**
 * MVP対象外の算定・請求を含む処方に付与するステータス(v0.1.7 §18)。
 * これらが付与されたデータから保険請求データを生成してはならない。
 */
export const UNSUPPORTED_CLAIM_STATUSES = [
  "BLOCKED_UNSUPPORTED_CLAIM",
  "MANUAL_REVIEW_REQUIRED",
  "FUTURE_SCOPE_NOT_CLAIMABLE",
] as const;

export type UnsupportedClaimStatus = (typeof UNSUPPORTED_CLAIM_STATUSES)[number];

/** 請求データ生成を許可してよいか(保留・対象外ステータスが1つでもあれば不可) */
export function isClaimable(statuses: readonly string[]): boolean {
  return statuses.every(
    (s) =>
      !isProvisionalStatus(s) &&
      !(UNSUPPORTED_CLAIM_STATUSES as readonly string[]).includes(s) &&
      s !== CONFLICT_REQUIRES_HUMAN_REVIEW,
  );
}
