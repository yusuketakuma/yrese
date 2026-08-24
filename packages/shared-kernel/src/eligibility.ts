/**
 * 受付の資格確認状態機械(WP-6303/6304、SSOT: ADP-004 online_qualification_boundary §3、APPROVED 2026-08-23)。
 *
 * `ELIGIBILITY_STATUSES`(status.ts、患者要約の資格状態、API-001/DB-001)とは別概念である。
 * こちらは受付 1 件に紐づく EligibilitySnapshot から導出される状態で、算定・請求への
 * 進行可否を fail-closed で決める。
 */
export const ELIGIBILITY_VERIFICATION_METHODS = [
  "MYNA_ONLINE",
  "CARD_ONLINE",
  "CARD_VISUAL",
] as const;
export type EligibilityVerificationMethod = (typeof ELIGIBILITY_VERIFICATION_METHODS)[number];

export const RECEPTION_ELIGIBILITY_STATES = [
  "UNVERIFIED",
  "VERIFIED_MYNA",
  "VERIFIED_CARD",
  "PROVISIONAL_VISUAL",
  "OFFLINE_PROVISIONAL",
  "EXPIRED",
  "MISMATCH",
] as const;
export type ReceptionEligibilityState = (typeof RECEPTION_ELIGIBILITY_STATES)[number];

export function isReceptionEligibilityState(value: string): value is ReceptionEligibilityState {
  return (RECEPTION_ELIGIBILITY_STATES as readonly string[]).includes(value);
}

/** 確定算定・請求データ生成を許す状態(ADP-004 §3: VERIFIED_* のみ)。 */
export function allowsFinalCalculationForEligibility(state: ReceptionEligibilityState): boolean {
  return state === "VERIFIED_MYNA" || state === "VERIFIED_CARD";
}

/** 仮算定を許す状態(VERIFIED_* と PROVISIONAL 系)。UNVERIFIED / EXPIRED / MISMATCH は不可。 */
export function allowsProvisionalCalculationForEligibility(state: ReceptionEligibilityState): boolean {
  return (
    allowsFinalCalculationForEligibility(state) ||
    state === "PROVISIONAL_VISUAL" ||
    state === "OFFLINE_PROVISIONAL"
  );
}

/** ADP-004 §3 の遷移表。表にない遷移は拒否する(同一状態への再記録は新 snapshot として許す)。 */
const allowedTransitions: Readonly<Record<ReceptionEligibilityState, readonly ReceptionEligibilityState[]>> = {
  UNVERIFIED: ["VERIFIED_MYNA", "VERIFIED_CARD", "PROVISIONAL_VISUAL", "OFFLINE_PROVISIONAL"],
  VERIFIED_MYNA: ["VERIFIED_MYNA", "VERIFIED_CARD", "EXPIRED", "MISMATCH"],
  VERIFIED_CARD: ["VERIFIED_MYNA", "VERIFIED_CARD", "EXPIRED", "MISMATCH"],
  PROVISIONAL_VISUAL: ["VERIFIED_MYNA", "VERIFIED_CARD", "MISMATCH", "EXPIRED"],
  OFFLINE_PROVISIONAL: ["VERIFIED_MYNA", "VERIFIED_CARD", "MISMATCH", "EXPIRED"],
  EXPIRED: ["VERIFIED_MYNA", "VERIFIED_CARD"],
  MISMATCH: ["VERIFIED_MYNA", "VERIFIED_CARD"],
};

export function isEligibilityTransitionAllowed(
  from: ReceptionEligibilityState,
  to: ReceptionEligibilityState,
): boolean {
  return allowedTransitions[from].includes(to);
}

/** 確認方式から到達する検証済み状態。 */
export function verifiedStateForMethod(method: EligibilityVerificationMethod): ReceptionEligibilityState {
  switch (method) {
    case "MYNA_ONLINE":
      return "VERIFIED_MYNA";
    case "CARD_ONLINE":
      return "VERIFIED_CARD";
    case "CARD_VISUAL":
      return "PROVISIONAL_VISUAL";
  }
}
