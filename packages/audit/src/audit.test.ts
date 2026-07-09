import { describe, expect, it } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import {
  AUDIT_EVENT_TYPES,
  createAuditEvent,
  isAuditEventType,
  parseAuditEventType,
  requiresBusinessReason,
  type CreateAuditEventInput,
} from "./index.js";

const payloadHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const prevHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const entryHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function baseAuditEvent(overrides: Partial<CreateAuditEventInput> = {}): CreateAuditEventInput {
  return {
    eventId: eventId("audit-event-001"),
    aggregateId: "patient-001",
    aggregateType: "patient",
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
    deviceId: deviceId("device-001"),
    actorId: userId("user-001"),
    sequenceNumber: 1n,
    logicalClock: 1n,
    wallClock: "2026-07-09T08:59:01.000Z",
    idempotencyKey: "audit-event-001:1",
    correlationId: eventId("correlation-001"),
    schemaVersion: 1,
    payloadHash,
    phiClassification: "none",
    encryptionStatus: "plaintext_forbidden",
    syncStatus: "pending",
    retryCount: 0,
    auditEventType: "patient.viewed",
    targetRef: {
      kind: "patient",
      id: "patient-001",
    },
    outcome: "success",
    prevHash,
    entryHash,
    ...overrides,
  };
}

describe("audit event type registry", () => {
  it("parses the approved audit event grammar", () => {
    expect(parseAuditEventType("patient.viewed")).toEqual({
      domain: "patient",
      action: "viewed",
    });
    expect(parseAuditEventType("support.session.started")).toEqual({
      domain: "support",
      resource: "session",
      action: "started",
    });
  });

  it.each(["Patient.viewed", "patient", "patient..viewed", "patient.record-viewed"])(
    "rejects malformed auditEventType %j",
    (auditEventType) => {
      expect(() => createAuditEvent(baseAuditEvent({ auditEventType }))).toThrow(/auditEventType/);
    },
  );

  it("rejects valid grammar event types that are absent from the registry", () => {
    expect(() =>
      createAuditEvent(baseAuditEvent({ auditEventType: "patient.archived" })),
    ).toThrow(/unknown auditEventType/);
  });

  it("rejects SUPERSEDED checkout event types", () => {
    expect(isAuditEventType("checkout.refunded")).toBe(false);
    expect(AUDIT_EVENT_TYPES).not.toContain("checkout.refunded");
    expect(AUDIT_EVENT_TYPES).not.toContain("checkout.finalized");
    expect(() =>
      createAuditEvent(baseAuditEvent({ auditEventType: "checkout.refunded" })),
    ).toThrow(/unknown auditEventType/);
  });

  it("registers meta-audit event types", () => {
    expect(isAuditEventType("audit.viewed")).toBe(true);
  });

  it("registers break-glass start and end event types", () => {
    expect(isAuditEventType("breakglass.used")).toBe(true);
    expect(isAuditEventType("breakglass.ended")).toBe(true);
  });
});

describe("createAuditEvent", () => {
  it("creates immutable audit events using the EventEnvelope invariants", () => {
    const auditEvent = createAuditEvent(baseAuditEvent());

    expect(auditEvent.auditEventType).toBe("patient.viewed");
    expect(auditEvent.actorId).toBe("user-001");
    expect(Object.isFrozen(auditEvent)).toBe(true);
    expect(Object.isFrozen(auditEvent.targetRef)).toBe(true);
  });

  it("requires businessReason for refund/cancellation/void/adjustment style events", () => {
    expect(requiresBusinessReason("accounting.payment.refunded")).toBe(true);
    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          auditEventType: "accounting.payment.refunded",
          aggregateId: "payment-001",
          aggregateType: "accounting_payment",
          targetRef: {
            kind: "accounting_payment",
            id: "payment-001",
          },
        }),
      ),
    ).toThrow(/businessReason/);
  });

  it("accepts accounting.payment.refunded when businessReason is structured", () => {
    const auditEvent = createAuditEvent(
      baseAuditEvent({
        auditEventType: "accounting.payment.refunded",
        aggregateId: "payment-001",
        aggregateType: "accounting_payment",
        targetRef: {
          kind: "accounting_payment",
          id: "payment-001",
        },
        businessReason: {
          code: "PATIENT_REQUESTED_REFUND",
        },
      }),
    );

    expect(auditEvent.businessReason).toEqual({
      code: "PATIENT_REQUESTED_REFUND",
    });
    expect(Object.isFrozen(auditEvent.businessReason)).toBe(true);
  });

  it("requires businessReason for breakglass.used", () => {
    expect(requiresBusinessReason("breakglass.used")).toBe(true);

    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          auditEventType: "breakglass.used",
          aggregateId: "breakglass-session-001",
          aggregateType: "breakglass_session",
          targetRef: {
            kind: "breakglass_session",
            id: "breakglass-session-001",
          },
        }),
      ),
    ).toThrow(/businessReason/);
  });

  it("links breakglass.ended to the start event with correlation and causation IDs", () => {
    expect(requiresBusinessReason("breakglass.ended")).toBe(false);

    const correlationId = eventId("breakglass-correlation-001");
    const breakglassUsed = createAuditEvent(
      baseAuditEvent({
        eventId: eventId("breakglass-used-001"),
        correlationId,
        auditEventType: "breakglass.used",
        aggregateId: "breakglass-session-001",
        aggregateType: "breakglass_session",
        targetRef: {
          kind: "breakglass_session",
          id: "breakglass-session-001",
        },
        businessReason: {
          code: "EMERGENCY_SUPPORT_ACCESS",
        },
      }),
    );

    const breakglassEnded = createAuditEvent(
      baseAuditEvent({
        eventId: eventId("breakglass-ended-001"),
        correlationId,
        causationId: breakglassUsed.eventId,
        auditEventType: "breakglass.ended",
        aggregateId: "breakglass-session-001",
        aggregateType: "breakglass_session",
        targetRef: {
          kind: "breakglass_session",
          id: "breakglass-session-001",
        },
      }),
    );

    expect(breakglassEnded.correlationId).toBe(breakglassUsed.correlationId);
    expect(breakglassEnded.causationId).toBe(breakglassUsed.eventId);
    expect(breakglassEnded.businessReason).toBeUndefined();
  });

  it.each([
    [{ kind: "", id: "patient-001" }, /targetRef.kind/],
    [{ kind: "patient", id: "" }, /targetRef.id/],
    [{ kind: "patient\u0000", id: "patient-001" }, /targetRef.kind/],
    [{ kind: "patient", id: "patient-001\u001f" }, /targetRef.id/],
    [{ kind: "patient-record", id: "patient-001" }, /targetRef.kind/],
  ] as const)("rejects invalid targetRef values: %j", (targetRef, expectedMessage) => {
    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          targetRef,
        }),
      ),
    ).toThrow(expectedMessage);
  });

  it("rejects invalid audit outcomes at runtime", () => {
    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          outcome: "partial" as CreateAuditEventInput["outcome"],
        }),
      ),
    ).toThrow(/outcome/);
  });

  it.each(["lowercase_reason", "NO", "BAD-CODE", "BAD CODE"] as const)(
    "rejects malformed businessReason.code %j",
    (code) => {
      expect(() =>
        createAuditEvent(
          baseAuditEvent({
            auditEventType: "accounting.payment.refunded",
            aggregateId: "payment-001",
            aggregateType: "accounting_payment",
            targetRef: {
              kind: "accounting_payment",
              id: "payment-001",
            },
            businessReason: {
              code,
            },
          }),
        ),
      ).toThrow(/businessReason.code/);
    },
  );

  it("rejects audit events when correlationId is missing at runtime", () => {
    expect(() =>
      createAuditEvent({
        ...baseAuditEvent(),
        correlationId: undefined,
      } as unknown as CreateAuditEventInput),
    ).toThrow();
  });

  it("validates registered reasonCode references and hash-chain fields", () => {
    const deniedAuditEvent = createAuditEvent(
      baseAuditEvent({
        outcome: "denied",
        reasonCode: "AUTH-0003",
      }),
    );

    expect(deniedAuditEvent.reasonCode).toBe("AUTH-0003");

    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          outcome: "denied",
          reasonCode: "AUTH-9999",
        }),
      ),
    ).toThrow(/reasonCode/);

    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          prevHash: prevHash.toUpperCase(),
        }),
      ),
    ).toThrow(/prevHash/);

    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          entryHash: "abc",
        }),
      ),
    ).toThrow(/entryHash/);
  });

  it.each(["phi", "pii", "phi_pii"] as const)(
    "rejects audit events with %s classification even when encrypted",
    (phiClassification) => {
      expect(() =>
        createAuditEvent(
          baseAuditEvent({
            phiClassification,
            encryptionStatus: "encrypted",
          }),
        ),
      ).toThrow(/phiClassification/);
    },
  );

  it("rejects control characters in required envelope IDs", () => {
    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          actorId: "user-001\u0000" as CreateAuditEventInput["actorId"],
        }),
      ),
    ).toThrow(/actorId/);

    expect(() =>
      createAuditEvent(
        baseAuditEvent({
          correlationId: "correlation-001\u001f" as CreateAuditEventInput["correlationId"],
        }),
      ),
    ).toThrow(/correlationId/);
  });

  it("drops extra enumerable fields from envelope and audit-only objects", () => {
    const auditEvent = createAuditEvent({
      ...baseAuditEvent(),
      auditEventType: "accounting.payment.refunded",
      aggregateId: "payment-001",
      aggregateType: "accounting_payment",
      targetRef: {
        kind: "accounting_payment",
        id: "payment-001",
        patientName: "DO_NOT_RETURN",
      },
      businessReason: {
        code: "PATIENT_REQUESTED_REFUND",
        freeText: "DO_NOT_RETURN",
      },
      patientName: "DO_NOT_RETURN",
    } as unknown as CreateAuditEventInput);

    expect("patientName" in auditEvent).toBe(false);
    expect("patientName" in auditEvent.targetRef).toBe(false);
    expect(auditEvent.businessReason).toEqual({
      code: "PATIENT_REQUESTED_REFUND",
    });
    expect("freeText" in auditEvent.businessReason!).toBe(false);
  });
});
