import { describe, expect, it } from "vitest";

import {
  RECEPTION_ELIGIBILITY_STATES,
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isEligibilityTransitionAllowed,
  verifiedStateForMethod,
} from "./eligibility.js";

describe("reception eligibility state machine (ADP-004 §3)", () => {
  it("allows final calculation only for online-verified states", () => {
    const finalAllowed = RECEPTION_ELIGIBILITY_STATES.filter(allowsFinalCalculationForEligibility);
    expect(finalAllowed).toEqual(["VERIFIED_MYNA", "VERIFIED_CARD"]);
  });

  it("allows provisional calculation for verified and provisional states, never for unverified/expired/mismatch", () => {
    const provisional = RECEPTION_ELIGIBILITY_STATES.filter(allowsProvisionalCalculationForEligibility);
    expect(provisional).toEqual(["VERIFIED_MYNA", "VERIFIED_CARD", "PROVISIONAL_VISUAL", "OFFLINE_PROVISIONAL"]);
    for (const blocked of ["UNVERIFIED", "EXPIRED", "MISMATCH"] as const) {
      expect(allowsProvisionalCalculationForEligibility(blocked)).toBe(false);
    }
  });

  it("follows the ADP-004 transition table and rejects everything else", () => {
    expect(isEligibilityTransitionAllowed("UNVERIFIED", "VERIFIED_MYNA")).toBe(true);
    expect(isEligibilityTransitionAllowed("UNVERIFIED", "OFFLINE_PROVISIONAL")).toBe(true);
    expect(isEligibilityTransitionAllowed("OFFLINE_PROVISIONAL", "VERIFIED_CARD")).toBe(true);
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "EXPIRED")).toBe(true);
    expect(isEligibilityTransitionAllowed("EXPIRED", "VERIFIED_MYNA")).toBe(true);
    // 検証済みから未確認へ戻す遷移、期限切れから仮状態へ戻す遷移は存在しない。
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "UNVERIFIED")).toBe(false);
    expect(isEligibilityTransitionAllowed("EXPIRED", "OFFLINE_PROVISIONAL")).toBe(false);
    expect(isEligibilityTransitionAllowed("MISMATCH", "PROVISIONAL_VISUAL")).toBe(false);
    expect(isEligibilityTransitionAllowed("UNVERIFIED", "EXPIRED")).toBe(false);
  });

  it("maps verification methods to their verified state", () => {
    expect(verifiedStateForMethod("MYNA_ONLINE")).toBe("VERIFIED_MYNA");
    expect(verifiedStateForMethod("CARD_ONLINE")).toBe("VERIFIED_CARD");
    expect(verifiedStateForMethod("CARD_VISUAL")).toBe("PROVISIONAL_VISUAL");
  });
});
