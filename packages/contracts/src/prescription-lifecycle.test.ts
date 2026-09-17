import { describe, expect, it } from "vitest";

import { prescriptionStatusWireSchema } from "./prescription-draft.js";
import {
  prescriptionLifecycleHeadersSchema,
  prescriptionLifecycleParamsSchema,
  prescriptionLifecycleViewSchema,
} from "./prescription-lifecycle.js";
import { partnerEventSchema } from "./partner-event.js";

describe("prescription lifecycle contracts (WP-7402)", () => {
  it("registers only the two forward lifecycle statuses", () => {
    expect([...prescriptionStatusWireSchema.options].sort()).toEqual([
      "PHARMACIST_CONFIRMED",
      "PRESCRIPTION_FINALIZED",
    ]);
  });

  it("parses a confirmed lifecycle view without finalized fields", () => {
    const view = prescriptionLifecycleViewSchema.parse({
      prescriptionId: "prescription-001",
      receptionId: "reception-001",
      patientId: "patient-001",
      prescriptionType: "OUTPATIENT",
      status: "PHARMACIST_CONFIRMED",
      draftVersion: 3,
      prescriptionVersion: null,
      contentHash: "a".repeat(64),
      confirmedBy: "actor-001",
      confirmedAt: "2026-08-25T00:00:00.000Z",
      finalizedBy: null,
      finalizedAt: null,
    });
    expect(view.prescriptionVersion).toBeNull();
  });

  it("parses a finalized lifecycle view with version 1", () => {
    const view = prescriptionLifecycleViewSchema.parse({
      prescriptionId: "prescription-001",
      receptionId: "reception-001",
      patientId: "patient-001",
      prescriptionType: "OUTPATIENT",
      status: "PRESCRIPTION_FINALIZED",
      draftVersion: 3,
      prescriptionVersion: 1,
      contentHash: "b".repeat(64),
      confirmedBy: "actor-001",
      confirmedAt: "2026-08-25T00:00:00.000Z",
      finalizedBy: "actor-002",
      finalizedAt: "2026-08-25T00:05:00.000Z",
    });
    expect(view.prescriptionVersion).toBe(1);
  });

  it("rejects a finalized view whose prescription version is null", () => {
    expect(
      prescriptionLifecycleViewSchema.safeParse({
        prescriptionId: "prescription-001",
        receptionId: "reception-001",
        patientId: "patient-001",
        prescriptionType: "OUTPATIENT",
        status: "PRESCRIPTION_FINALIZED",
        draftVersion: 3,
        prescriptionVersion: null,
        contentHash: "b".repeat(64),
        confirmedBy: "actor-001",
        confirmedAt: "2026-08-25T00:00:00.000Z",
        finalizedBy: "actor-002",
        finalizedAt: "2026-08-25T00:05:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("requires a syntactically valid Idempotency-Key header", () => {
    expect(
      prescriptionLifecycleHeadersSchema.safeParse({
        "idempotency-key": "key-abcdefghijklmnop",
      }).success,
    ).toBe(true);
    expect(
      prescriptionLifecycleHeadersSchema.safeParse({
        "idempotency-key": "short",
      }).success,
    ).toBe(false);
  });

  it("rejects empty prescription ids in params", () => {
    expect(
      prescriptionLifecycleParamsSchema.safeParse({ prescriptionId: "" })
        .success,
    ).toBe(false);
  });

  it("parses the prescription.finalized partner event without patient data", () => {
    const event = partnerEventSchema.parse({
      eventId: "00000000-0000-4000-8000-0000000000e1",
      eventType: "prescription.finalized",
      schemaVersion: 1,
      occurredAt: "2026-08-25T00:00:00.000Z",
      auditEventId: "audit-evt-001",
      aggregate: { type: "prescription", id: "prescription-001" },
      version: 1,
    });
    expect(event.eventType).toBe("prescription.finalized");
    expect(JSON.stringify(event)).not.toContain("patient");
  });
});
