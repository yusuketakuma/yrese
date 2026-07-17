import { describe, expect, it } from "vitest";

import {
  BLOCKER_TYPES,
  CLAIMABLE_SAFE_STATUSES,
  CONFLICT_REQUIRES_HUMAN_REVIEW,
  ErrorCodeRegistry,
  createKernelErrorCodeRegistry,
  claimId,
  deviceId,
  dispensingId,
  eventId,
  evidenceId,
  PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE,
  PROVISIONAL_STATUSES,
  pharmacyId,
  prescriptionId,
  RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  RECEPTION_INVALID_REQUEST_ERROR_CODE,
  RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE,
  RECEPTION_STATUSES,
  SYSTEM_MODES,
  allowsClaimFinalization,
  allowsFinalCalculation,
  canConfirmExternal,
  isBlockerType,
  isClaimable,
  isPermissionScope,
  isProvisionalStatus,
  isReceptionStatus,
  isSystemMode,
  isValidErrorCode,
  patientId,
  permissionScope,
  receptionId,
  tenantId,
  userId,
  workPackageId,
} from "./index.js";

describe("branded ids", () => {
  const factories = [
    ["TenantId", tenantId],
    ["PharmacyId", pharmacyId],
    ["UserId", userId],
    ["PatientId", patientId],
    ["ReceptionId", receptionId],
    ["PrescriptionId", prescriptionId],
    ["DispensingId", dispensingId],
    ["ClaimId", claimId],
    ["EventId", eventId],
    ["DeviceId", deviceId],
    ["EvidenceId", evidenceId],
    ["WorkPackageId", workPackageId],
  ] as const;

  it("accepts non-empty ids and preserves the value", () => {
    expect(tenantId("t-001")).toBe("t-001");
    expect(patientId("p-123")).toBe("p-123");
    expect(receptionId("reception-001")).toBe("reception-001");
    expect(tenantId("  tenant with whitespace  ")).toBe("  tenant with whitespace  ");
    expect(tenantId(`tenant-${"x".repeat(256)}-患者`)).toBe(
      `tenant-${"x".repeat(256)}-患者`,
    );
  });

  it.each(["", "   ", "a\u0000b", "a\u001fb"])("rejects invalid id %j", (v) => {
    expect(() => tenantId(v)).toThrow(RangeError);
  });

  it.each(factories)("rejects non-string runtime values for %s", (label, factory) => {
    const runtimeFactory = factory as (value: unknown) => string;
    const invalidValues: readonly unknown[] = [
      null,
      undefined,
      1,
      true,
      1n,
      Symbol("raw-id-sentinel"),
      () => "raw-id-sentinel",
      [],
      {},
      new String("raw-id-sentinel"),
      Promise.resolve("raw-id-sentinel"),
    ];

    for (const value of invalidValues) {
      expect(() => runtimeFactory(value)).toThrow(
        new RangeError(`${label} must be a non-empty string`),
      );
    }
  });

  it.each(factories)("does not coerce or inspect hostile values for %s", (label, factory) => {
    const runtimeFactory = factory as (value: unknown) => string;
    let coercionCalls = 0;
    const coercible = {
      length: 16,
      trim: () => {
        coercionCalls += 1;
        return "raw-id-sentinel";
      },
      toString: () => {
        coercionCalls += 1;
        return "raw-id-sentinel";
      },
      valueOf: () => {
        coercionCalls += 1;
        return "raw-id-sentinel";
      },
      [Symbol.toPrimitive]: () => {
        coercionCalls += 1;
        return "raw-id-sentinel";
      },
    };
    expect(() => runtimeFactory(coercible)).toThrow(
      new RangeError(`${label} must be a non-empty string`),
    );
    expect(coercionCalls).toBe(0);

    let trapCalls = 0;
    const hostile = new Proxy(
      {},
      {
        get: () => {
          trapCalls += 1;
          throw new Error("raw-proxy-sentinel");
        },
        getOwnPropertyDescriptor: () => {
          trapCalls += 1;
          throw new Error("raw-proxy-sentinel");
        },
      },
    );
    expect(() => runtimeFactory(hostile)).toThrow(
      new RangeError(`${label} must be a non-empty string`),
    );
    expect(trapCalls).toBe(0);

    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(() => runtimeFactory(revocable.proxy)).toThrow(
      new RangeError(`${label} must be a non-empty string`),
    );
  });
});

describe("system modes (v0.2.0 §13-15)", () => {
  it("defines exactly the five modes", () => {
    expect(SYSTEM_MODES).toEqual([
      "NORMAL",
      "EXTERNAL_DEGRADED",
      "CLOUD_DEGRADED",
      "LOCAL_ONLY",
      "RECOVERY_SYNC",
    ]);
    expect(isSystemMode("NORMAL")).toBe(true);
    expect(isSystemMode("OFFLINE")).toBe(false);
  });

  it("never allows new external confirmation in LOCAL_ONLY / EXTERNAL_DEGRADED", () => {
    expect(canConfirmExternal("LOCAL_ONLY")).toBe(false);
    expect(canConfirmExternal("EXTERNAL_DEGRADED")).toBe(false);
    expect(canConfirmExternal("NORMAL")).toBe(true);
  });

  it("only allows provisional calculation in LOCAL_ONLY", () => {
    expect(allowsFinalCalculation("LOCAL_ONLY")).toBe(false);
    expect(allowsFinalCalculation("NORMAL")).toBe(true);
  });

  it("only allows claim finalization in NORMAL", () => {
    for (const mode of SYSTEM_MODES) {
      expect(allowsClaimFinalization(mode)).toBe(mode === "NORMAL");
    }
  });
});

describe("provisional statuses (v0.2.0 §14)", () => {
  it("contains the six mandated statuses", () => {
    expect(PROVISIONAL_STATUSES).toHaveLength(6);
    expect(isProvisionalStatus("PENDING_REVERIFY")).toBe(true);
    expect(isProvisionalStatus("DONE")).toBe(false);
  });

  it("blocks claim generation when any provisional/blocked status is present", () => {
    expect(isClaimable([])).toBe(true);
    expect(isClaimable(["PENDING_REVERIFY"])).toBe(false);
    expect(isClaimable(["BLOCKED_UNSUPPORTED_CLAIM"])).toBe(false);
    expect(isClaimable([CONFLICT_REQUIRES_HUMAN_REVIEW])).toBe(false);
    expect(isClaimable(["FUTURE_SCOPE_NOT_CLAIMABLE"])).toBe(false);
  });

  it("fails closed for unapproved claimability statuses", () => {
    expect(isClaimable(["REQUIRES_RECORD"])).toBe(false);
    expect(isClaimable(["SUGGESTED_REQUIRES_CONFIRMATION"])).toBe(false);
    expect(isClaimable(["UNKNOWN_FUTURE_STATUS"])).toBe(false);
    expect(isClaimable(["PENDING_REVERIFY", "UNKNOWN_FUTURE_STATUS"])).toBe(false);
  });

  it("starts with no claimable safe statuses", () => {
    expect(CLAIMABLE_SAFE_STATUSES).toEqual([]);
  });
});

describe("reception statuses (API-006)", () => {
  it("contains the approved reception queue statuses", () => {
    expect(RECEPTION_STATUSES).toEqual(["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
    expect(isReceptionStatus("WAITING")).toBe(true);
    expect(isReceptionStatus("RECEIVED_PROVISIONAL")).toBe(false);
  });
});

describe("blocker types (v0.2.0 §0.13 ほか)", () => {
  it("has no duplicates", () => {
    expect(new Set(BLOCKER_TYPES).size).toBe(BLOCKER_TYPES.length);
  });

  it("recognises regulatory and SaMD blockers", () => {
    expect(isBlockerType("BLOCKED_REGULATORY_REVIEW")).toBe(true);
    expect(isBlockerType("BLOCKED_PMDA_SAMD_REVIEW")).toBe(true);
    expect(isBlockerType("SOMETHING_ELSE")).toBe(false);
  });
});

describe("error code registry", () => {
  it("validates format and rejects duplicates", () => {
    expect(isValidErrorCode("CALC-0001")).toBe(true);
    expect(isValidErrorCode("calc-1")).toBe(false);

    const registry = new ErrorCodeRegistry();
    const def = {
      code: "CALC-0001",
      domain: "CALCULATION",
      severity: "BLOCKER",
      affectsClaimability: true,
      requiresHumanReview: true,
      description: "test",
    } as const;
    registry.register(def);
    expect(registry.get("CALC-0001")?.severity).toBe("BLOCKER");
    expect(() => registry.register(def)).toThrow(/duplicate/);
  });

  it("seeds approved kernel error codes", () => {
    const registry = createKernelErrorCodeRegistry();

    expect(registry.get("AUTH-0003")).toEqual({
      code: "AUTH-0003",
      domain: "AUTH",
      severity: "ERROR",
      affectsClaimability: false,
      requiresHumanReview: false,
      description: "permission denied (deny-by-default)",
    });
    expect(registry.get(PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE)).toEqual({
      code: "PAT-0001",
      domain: "PATIENT",
      severity: "ERROR",
      affectsClaimability: false,
      requiresHumanReview: false,
      description: "invalid patient search query",
    });
    expect(registry.get(RECEPTION_INVALID_REQUEST_ERROR_CODE)).toEqual({
      code: "RCV-0001",
      domain: "RECEPTION",
      severity: "ERROR",
      affectsClaimability: false,
      requiresHumanReview: false,
      description: "invalid reception request",
    });
    expect(registry.get(RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE)?.domain).toBe("RECEPTION");
    expect(registry.get(RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE)?.code).toBe("RCV-0003");
  });
});

describe("permission scopes", () => {
  it("builds and validates scopes", () => {
    expect(permissionScope("claim", "finalize")).toBe("claim:finalize");
    expect(permissionScope("reception", "write")).toBe("reception:write");
    expect(isPermissionScope("claim:finalize")).toBe(true);
    expect(isPermissionScope("reception:read")).toBe(true);
    expect(isPermissionScope("claim:destroy")).toBe(false);
    expect(isPermissionScope("nonsense")).toBe(false);
  });

  it.each(["tenant:read:extra", ":", "a:", ":b"])(
    "rejects malformed scope %j",
    (value) => {
      expect(isPermissionScope(value)).toBe(false);
    },
  );
});
