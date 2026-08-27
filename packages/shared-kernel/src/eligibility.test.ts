import { describe, expect, it } from "vitest";

import {
  RECEPTION_ELIGIBILITY_STATES,
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isEligibilityMethodConsistent,
  isEligibilityTransitionAllowed,
  stateForVerificationMethod,
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
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "MISMATCH")).toBe(true);
    // 表にない遷移: 方式変更、EXPIRED / MISMATCH からの復帰、未確認への逆戻り。
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "VERIFIED_CARD")).toBe(false);
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "VERIFIED_MYNA")).toBe(false);
    expect(isEligibilityTransitionAllowed("EXPIRED", "VERIFIED_MYNA")).toBe(false);
    expect(isEligibilityTransitionAllowed("MISMATCH", "VERIFIED_CARD")).toBe(false);
    expect(isEligibilityTransitionAllowed("VERIFIED_MYNA", "UNVERIFIED")).toBe(false);
    expect(isEligibilityTransitionAllowed("EXPIRED", "OFFLINE_PROVISIONAL")).toBe(false);
    expect(isEligibilityTransitionAllowed("UNVERIFIED", "EXPIRED")).toBe(false);
  });

  it.each(["UNKNOWN", null, undefined])("rejects an invalid source state", (from) => {
    expect(isEligibilityTransitionAllowed(from as never, "VERIFIED_MYNA")).toBe(false);
  });

  it("does not coerce source or destination state objects", () => {
    let coercions = 0;
    const state = {
      [Symbol.toPrimitive]() {
        coercions += 1;
        return "UNVERIFIED";
      },
    };

    expect(isEligibilityTransitionAllowed(state as never, "VERIFIED_MYNA")).toBe(false);
    expect(isEligibilityTransitionAllowed("UNVERIFIED", state as never)).toBe(false);
    expect(coercions).toBe(0);
  });

  it("binds verification methods to the states they may record", () => {
    expect(stateForVerificationMethod("MYNA_ONLINE")).toBe("VERIFIED_MYNA");
    expect(stateForVerificationMethod("CARD_ONLINE")).toBe("VERIFIED_CARD");
    expect(stateForVerificationMethod("CARD_VISUAL")).toBe("PROVISIONAL_VISUAL");
    expect(stateForVerificationMethod("NONE")).toBe("OFFLINE_PROVISIONAL");
    expect(isEligibilityMethodConsistent("CARD_VISUAL", "VERIFIED_MYNA")).toBe(false);
    expect(isEligibilityMethodConsistent("NONE", "VERIFIED_CARD")).toBe(false);
    expect(isEligibilityMethodConsistent("CARD_VISUAL", "MISMATCH")).toBe(true);
    expect(isEligibilityMethodConsistent("MYNA_ONLINE", "EXPIRED")).toBe(true);
  });
});
