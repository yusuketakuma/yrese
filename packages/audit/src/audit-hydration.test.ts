import { describe, expect, it } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import {
  AUDIT_GENESIS_PREV_HASH,
  AuditEventHydrationError,
  createAuditEvent,
  hydrateAuditEvent,
  type AuditEvent,
  type AuditEventHydrationFailureReason,
  type CreateAuditEventInput,
} from "./index.js";

const payloadHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const hydrationErrorMessage = "Stored audit event failed integrity validation";

function auditInput(overrides: Partial<CreateAuditEventInput> = {}): CreateAuditEventInput {
  return {
    eventId: eventId("event-hydration-synthetic-001"),
    aggregateId: "patient-synthetic-001",
    aggregateType: "patient",
    tenantId: tenantId("tenant-synthetic-001"),
    pharmacyId: pharmacyId("pharmacy-synthetic-001"),
    deviceId: deviceId("device-synthetic-001"),
    actorId: userId("actor-synthetic-001"),
    sequenceNumber: 1n,
    logicalClock: 1n,
    wallClock: "2026-07-10T00:00:00.000Z",
    idempotencyKey: "event-hydration-synthetic-001:1",
    causationId: eventId("event-causation-synthetic-001"),
    correlationId: eventId("event-correlation-synthetic-001"),
    schemaVersion: 1,
    payloadHash,
    phiClassification: "none",
    encryptionStatus: "plaintext_forbidden",
    syncStatus: "pending",
    retryCount: 0,
    auditEventType: "patient.viewed",
    targetRef: {
      kind: "patient",
      id: "patient-synthetic-001",
    },
    outcome: "success",
    reasonCode: "AUTH-0003",
    prevHash: AUDIT_GENESIS_PREV_HASH,
    ...overrides,
  };
}

function storedEvent(overrides: Partial<AuditEvent> = {}): Record<string, unknown> {
  const created = createAuditEvent(auditInput());
  return {
    ...created,
    targetRef: { ...created.targetRef },
    ...overrides,
  };
}

function expectHydrationFailure(
  value: unknown,
  reason: AuditEventHydrationFailureReason,
): AuditEventHydrationError {
  try {
    hydrateAuditEvent(value);
    throw new Error("expected hydrateAuditEvent to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(AuditEventHydrationError);
    expect((error as Error).message).toBe(hydrationErrorMessage);
    expect((error as AuditEventHydrationError).reason).toBe(reason);
    return error as AuditEventHydrationError;
  }
}

describe("hydrateAuditEvent", () => {
  it("hydrates a validated independent deeply frozen audit event", () => {
    const stored = storedEvent();
    const storedTarget = stored.targetRef;
    const hydrated = hydrateAuditEvent(stored);

    expect(hydrated).toEqual(createAuditEvent(auditInput()));
    expect(hydrated).not.toBe(stored);
    expect(hydrated.targetRef).not.toBe(storedTarget);
    expect(Object.isFrozen(hydrated)).toBe(true);
    expect(Object.isFrozen(hydrated.targetRef)).toBe(true);

    stored.aggregateId = "mutated-after-hydration";
    (storedTarget as Record<string, unknown>).id = "mutated-after-hydration";
    expect(hydrated.aggregateId).toBe("patient-synthetic-001");
    expect(hydrated.targetRef.id).toBe("patient-synthetic-001");
  });

  it("hydrates exact null-prototype records and nested records", () => {
    const stored = Object.assign(Object.create(null) as Record<string, unknown>, storedEvent());
    stored.targetRef = Object.assign(
      Object.create(null) as Record<string, unknown>,
      stored.targetRef,
    );

    expect(hydrateAuditEvent(stored)).toEqual(createAuditEvent(auditInput()));
  });

  it("hydrates and independently freezes an exact businessReason", () => {
    const created = createAuditEvent(
      auditInput({
        auditEventType: "accounting.payment.refunded",
        aggregateId: "payment-synthetic-001",
        aggregateType: "accounting_payment",
        targetRef: { kind: "accounting_payment", id: "payment-synthetic-001" },
        businessReason: { code: "SYNTHETIC_REFUND" },
      }),
    );
    const storedReason = { ...created.businessReason! };
    const stored = { ...created, targetRef: { ...created.targetRef }, businessReason: storedReason };
    const hydrated = hydrateAuditEvent(stored);

    expect(hydrated.businessReason).toEqual({ code: "SYNTHETIC_REFUND" });
    expect(hydrated.businessReason).not.toBe(storedReason);
    expect(Object.isFrozen(hydrated.businessReason)).toBe(true);
  });

  it("hydrates all optional fields together for a valid dead-letter event", () => {
    const created = createAuditEvent(
      auditInput({
        auditEventType: "breakglass.used",
        syncStatus: "dead_letter",
        deadLetterReason: "SYNTHETIC_TRANSPORT_FAILURE",
        businessReason: { code: "SYNTHETIC_EMERGENCY_ACCESS" },
      }),
    );
    const stored = {
      ...created,
      targetRef: { ...created.targetRef },
      businessReason: { ...created.businessReason! },
    };
    const hydrated = hydrateAuditEvent(stored);

    expect(hydrated).toEqual(created);
    expect(hydrated.deviceId).toBe("device-synthetic-001");
    expect(hydrated.causationId).toBe("event-causation-synthetic-001");
    expect(hydrated.reasonCode).toBe("AUTH-0003");
    expect(hydrated.deadLetterReason).toBe("SYNTHETIC_TRANSPORT_FAILURE");
    expect(Object.isFrozen(hydrated)).toBe(true);
    expect(Object.isFrozen(hydrated.targetRef)).toBe(true);
    expect(Object.isFrozen(hydrated.businessReason)).toBe(true);
  });

  const requiredFields = [
    "actorId",
    "aggregateId",
    "aggregateType",
    "auditEventType",
    "correlationId",
    "encryptionStatus",
    "entryHash",
    "eventId",
    "idempotencyKey",
    "logicalClock",
    "outcome",
    "payloadHash",
    "pharmacyId",
    "phiClassification",
    "prevHash",
    "retryCount",
    "schemaVersion",
    "sequenceNumber",
    "syncStatus",
    "targetRef",
    "tenantId",
    "wallClock",
  ] as const;

  it.each(requiredFields)("rejects missing required field %s as malformed", (field) => {
    const stored = storedEvent();
    delete stored[field];

    expectHydrationFailure(stored, "malformed_event");
  });

  it.each(["businessReason", "causationId", "deadLetterReason", "deviceId", "reasonCode"] as const)(
    "rejects explicitly undefined optional field %s",
    (field) => {
      const stored = storedEvent();
      stored[field] = undefined;

      expectHydrationFailure(stored, "malformed_event");
    },
  );

  it.each([null, undefined, [], new (class StoredAuditEvent {})()])(
    "rejects non-plain root shape %#",
    (value) => {
      expectHydrationFailure(value, "malformed_event");
    },
  );

  it("rejects unknown, symbol, non-enumerable, and accessor root properties before reading", () => {
    const unknown = storedEvent();
    unknown.patientName = "SYNTHETIC_UNKNOWN_FIELD";
    const symbol = Object.assign(storedEvent(), { [Symbol("hidden")]: true });
    const nonEnumerable = storedEvent();
    Object.defineProperty(nonEnumerable, "hidden", { value: true, enumerable: false });
    const accessor = storedEvent();
    let accessorReads = 0;
    Object.defineProperty(accessor, "eventId", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        throw new Error("accessor-must-not-run");
      },
    });

    expectHydrationFailure(unknown, "malformed_event");
    expectHydrationFailure(symbol, "malformed_event");
    expectHydrationFailure(nonEnumerable, "malformed_event");
    expectHydrationFailure(accessor, "malformed_event");
    expect(accessorReads).toBe(0);
  });

  it("maps a proxy-thrown public hydration error to malformed_event instead of trusting its reason", () => {
    const attacker = new Proxy(storedEvent(), {
      getPrototypeOf: () => {
        throw new AuditEventHydrationError("entry_hash_mismatch");
      },
    });

    expectHydrationFailure(attacker, "malformed_event");
  });

  it("rejects malformed nested targetRef shapes before reading accessors", () => {
    const unknown = storedEvent();
    unknown.targetRef = { kind: "patient", id: "patient-synthetic-001", patientName: "SYNTHETIC" };
    const missing = storedEvent();
    missing.targetRef = { kind: "patient" };
    const accessorTarget = { kind: "patient", id: "patient-synthetic-001" };
    let accessorReads = 0;
    Object.defineProperty(accessorTarget, "id", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        throw new Error("nested-accessor-must-not-run");
      },
    });
    const accessor = storedEvent();
    accessor.targetRef = accessorTarget;

    expectHydrationFailure(unknown, "malformed_event");
    expectHydrationFailure(missing, "malformed_event");
    expectHydrationFailure(accessor, "malformed_event");
    expect(accessorReads).toBe(0);
  });

  it("rejects malformed nested businessReason shapes", () => {
    const created = createAuditEvent(
      auditInput({
        auditEventType: "accounting.payment.refunded",
        targetRef: { kind: "accounting_payment", id: "payment-synthetic-001" },
        businessReason: { code: "SYNTHETIC_REFUND" },
      }),
    );
    const unknown = { ...created, targetRef: { ...created.targetRef }, businessReason: {
      ...created.businessReason,
      freeText: "SYNTHETIC_UNKNOWN_FIELD",
    } };
    const missing = { ...created, targetRef: { ...created.targetRef }, businessReason: {} };

    expectHydrationFailure(unknown, "malformed_event");
    expectHydrationFailure(missing, "malformed_event");
  });

  it.each([
    "2026-07-10T09:00:00+09:00",
    "2026-07-10T00:00:00Z",
    "2026-07-10T00:00:00.0000Z",
  ])("rejects noncanonical but equivalent wallClock %s", (wallClock) => {
    expectHydrationFailure(storedEvent({ wallClock }), "malformed_event");
  });

  it("classifies only a well-formed wrong stored hash as entry_hash_mismatch", () => {
    expectHydrationFailure(storedEvent({ entryHash: "a".repeat(64) }), "entry_hash_mismatch");
    expectHydrationFailure(storedEvent({ prevHash: "a".repeat(64) }), "entry_hash_mismatch");
    expectHydrationFailure(
      storedEvent({ targetRef: { kind: "patient", id: "patient-synthetic-002" } }),
      "entry_hash_mismatch",
    );

    expectHydrationFailure(storedEvent({ entryHash: "short" }), "malformed_event");
    expectHydrationFailure(storedEvent({ entryHash: "A".repeat(64) }), "malformed_event");
    expectHydrationFailure(
      storedEvent({ entryHash: 1n as unknown as string }),
      "malformed_event",
    );
  });

  it.each([
    ["sequenceNumber number", { sequenceNumber: 1 as unknown as bigint }],
    ["sequenceNumber string", { sequenceNumber: "1" as unknown as bigint }],
    ["logicalClock number", { logicalClock: 1 as unknown as bigint }],
    ["logicalClock string", { logicalClock: "1" as unknown as bigint }],
    ["invalid outcome", { outcome: "unknown" as AuditEvent["outcome"] }],
    ["invalid syncStatus", { syncStatus: "unknown" as AuditEvent["syncStatus"] }],
    [
      "invalid encryptionStatus",
      { encryptionStatus: "unknown" as AuditEvent["encryptionStatus"] },
    ],
    ["invalid phiClassification", { phiClassification: "phi" as const }],
  ] as const)("maps domain-invalid %s to malformed_event", (_label, overrides) => {
    expectHydrationFailure(storedEvent(overrides), "malformed_event");
  });

  it.each(["auditEventType", "entryHash", "payloadHash", "prevHash"] as const)(
    "rejects non-string %s without invoking attacker coercion",
    (field) => {
      let coercionCalls = 0;
      const attackerValue = {
        toString: () => {
          coercionCalls += 1;
          throw new Error("coercion-must-not-run");
        },
      };
      const stored = storedEvent();
      stored[field] = attackerValue;

      expectHydrationFailure(stored, "malformed_event");
      expect(coercionCalls).toBe(0);
    },
  );

  it("maps domain-invalid stored values to a fixed non-echo malformed error", () => {
    const attackerValue = "patient.attacker_supplied_value";
    const error = expectHydrationFailure(
      storedEvent({ auditEventType: attackerValue as AuditEvent["auditEventType"] }),
      "malformed_event",
    );

    expect(error.message).not.toContain(attackerValue);
    expect(Object.keys(error)).toEqual(["reason", "name"]);
  });
});
