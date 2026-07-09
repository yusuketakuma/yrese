import { describe, expect, it } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import { createEventEnvelope, type EventEnvelope } from "./index.js";

const payloadHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function baseEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: eventId("event-001"),
    aggregateId: "claim-001",
    aggregateType: "claim",
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
    deviceId: deviceId("device-001"),
    actorId: userId("user-001"),
    sequenceNumber: 1n,
    logicalClock: 10n,
    wallClock: "2026-07-09T06:29:01.000Z",
    idempotencyKey: "claim-001:1",
    causationId: eventId("event-000"),
    correlationId: eventId("correlation-001"),
    schemaVersion: 1,
    payloadHash,
    phiClassification: "none",
    encryptionStatus: "plaintext_forbidden",
    syncStatus: "pending",
    retryCount: 0,
    ...overrides,
  };
}

describe("createEventEnvelope", () => {
  it("creates immutable validated event envelopes", () => {
    const envelope = createEventEnvelope(baseEnvelope());

    expect(envelope.eventId).toBe("event-001");
    expect(envelope.sequenceNumber).toBe(1n);
    expect(envelope.logicalClock).toBe(10n);
    expect(Object.isFrozen(envelope)).toBe(true);
  });

  it("allows encrypted PHI/PII envelopes", () => {
    const envelope = createEventEnvelope(
      baseEnvelope({
        phiClassification: "phi_pii",
        encryptionStatus: "encrypted",
      }),
    );

    expect(envelope.phiClassification).toBe("phi_pii");
    expect(envelope.encryptionStatus).toBe("encrypted");
  });

  it("rejects PHI/PII envelopes without encryption", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          phiClassification: "phi",
          encryptionStatus: "plaintext_forbidden",
        }),
      ),
    ).toThrow(/require encryptionStatus 'encrypted'/);
  });

  it("rejects invalid payload hash formats", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          payloadHash: payloadHash.toUpperCase(),
        }),
      ),
    ).toThrow(/payloadHash/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          payloadHash: "abc",
        }),
      ),
    ).toThrow(/payloadHash/);
  });

  it("rejects negative retry counts and invalid versions", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          retryCount: -1,
        }),
      ),
    ).toThrow(/retryCount/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          schemaVersion: 0,
        }),
      ),
    ).toThrow(/schemaVersion/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          schemaVersion: 1.5,
        }),
      ),
    ).toThrow(/schemaVersion/);
  });

  it("rejects negative clocks and non-ISO wall clocks", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          sequenceNumber: -1n,
        }),
      ),
    ).toThrow(/sequenceNumber/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          logicalClock: -1n,
        }),
      ),
    ).toThrow(/logicalClock/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          wallClock: "now",
        }),
      ),
    ).toThrow(/wallClock/);
  });

  it("validates optional IDs and dead-letter reason when present", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          deviceId: "" as EventEnvelope["deviceId"],
        } as Partial<EventEnvelope>),
      ),
    ).toThrow(/deviceId/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          syncStatus: "dead_letter",
          deadLetterReason: " ",
        }),
      ),
    ).toThrow(/deadLetterReason/);
  });
});
