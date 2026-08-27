/**
 * 受付の資格確認状態機械(WP-6303/6304、SSOT: ADP-004 online_qualification_boundary §3、APPROVED 2026-08-23)。
 *
 * `ELIGIBILITY_STATUSES`(status.ts、患者要約の資格状態、API-001/DB-001)とは別概念である。
 * こちらは **受付 1 件** に紐づく EligibilitySnapshot から導出される状態で、算定・請求への
 * 進行可否を fail-closed で決める。遷移表は ADP-004 §3 と一致させ、表にない遷移
 * (方式変更、EXPIRED / MISMATCH からの復帰)は持たない — 復帰は新しい受付か、
 * evidence を伴う人間 gate の対象(ADP-004 open question)。
 */
export const ELIGIBILITY_VERIFICATION_METHODS = [
  "MYNA_ONLINE",
  "CARD_ONLINE",
  "CARD_VISUAL",
  "NONE",
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
/** snapshot として記録できる状態(UNVERIFIED は「snapshot なし」の導出状態)。 */
export type RecordedEligibilityState = Exclude<ReceptionEligibilityState, "UNVERIFIED">;

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

/** ADP-004 §3 の遷移表そのもの。表にない遷移は拒否する。 */
const allowedTransitions: Readonly<Record<ReceptionEligibilityState, readonly ReceptionEligibilityState[]>> = {
  UNVERIFIED: ["VERIFIED_MYNA", "VERIFIED_CARD", "PROVISIONAL_VISUAL", "OFFLINE_PROVISIONAL"],
  VERIFIED_MYNA: ["EXPIRED", "MISMATCH"],
  VERIFIED_CARD: ["EXPIRED", "MISMATCH"],
  PROVISIONAL_VISUAL: ["VERIFIED_MYNA", "VERIFIED_CARD", "MISMATCH", "EXPIRED"],
  OFFLINE_PROVISIONAL: ["VERIFIED_MYNA", "VERIFIED_CARD", "MISMATCH", "EXPIRED"],
  EXPIRED: [],
  MISMATCH: [],
};

export function isEligibilityTransitionAllowed(
  from: ReceptionEligibilityState,
  to: ReceptionEligibilityState,
): boolean {
  return isReceptionEligibilityState(from) && allowedTransitions[from].includes(to);
}

/**
 * 確認方式と記録状態の整合(ADP-004 §2/§3)。目視確認(CARD_VISUAL)で VERIFIED_* を記録する
 * ような組合せを拒否する。EXPIRED / MISMATCH は方式を問わない。
 */
export function isEligibilityMethodConsistent(
  method: EligibilityVerificationMethod,
  state: RecordedEligibilityState,
): boolean {
  switch (state) {
    case "VERIFIED_MYNA":
      return method === "MYNA_ONLINE";
    case "VERIFIED_CARD":
      return method === "CARD_ONLINE";
    case "PROVISIONAL_VISUAL":
      return method === "CARD_VISUAL";
    case "OFFLINE_PROVISIONAL":
      return method === "NONE";
    case "EXPIRED":
    case "MISMATCH":
      return true;
  }
}

/** 確認方式から到達する状態(記録の既定値)。 */
export function stateForVerificationMethod(method: EligibilityVerificationMethod): RecordedEligibilityState {
  switch (method) {
    case "MYNA_ONLINE":
      return "VERIFIED_MYNA";
    case "CARD_ONLINE":
      return "VERIFIED_CARD";
    case "CARD_VISUAL":
      return "PROVISIONAL_VISUAL";
    case "NONE":
      return "OFFLINE_PROVISIONAL";
  }
}
