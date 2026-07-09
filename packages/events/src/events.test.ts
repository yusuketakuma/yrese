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

  it("rejects unregistered enum values at runtime", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          syncStatus: "lost" as EventEnvelope["syncStatus"],
        }),
      ),
    ).toThrow(/syncStatus/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          phiClassification: "bad" as EventEnvelope["phiClassification"],
          encryptionStatus: "encrypted",
        }),
      ),
    ).toThrow(/phiClassification/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          encryptionStatus: "plain" as EventEnvelope["encryptionStatus"],
        }),
      ),
    ).toThrow(/encryptionStatus/);
  });

  it.each([
    ["eventId", { eventId: "event-\u0000bad" as EventEnvelope["eventId"] }],
    ["aggregateId", { aggregateId: "claim-\u0000bad" }],
    ["aggregateType", { aggregateType: "claim\u0000" }],
    ["tenantId", { tenantId: "tenant-\u0000bad" as EventEnvelope["tenantId"] }],
    ["pharmacyId", { pharmacyId: "pharmacy-\u0000bad" as EventEnvelope["pharmacyId"] }],
    ["deviceId", { deviceId: "device-\u0000bad" as NonNullable<EventEnvelope["deviceId"]> }],
    ["actorId", { actorId: "user-\u0000bad" as NonNullable<EventEnvelope["actorId"]> }],
    ["idempotencyKey", { idempotencyKey: "claim-001:\u00001" }],
    ["causationId", { causationId: "event-\u0000bad" as NonNullable<EventEnvelope["causationId"]> }],
    ["correlationId", { correlationId: "correlation-\u0000bad" as EventEnvelope["correlationId"] }],
  ])("rejects control characters in %s", (_label, overrides) => {
    expect(() => createEventEnvelope(baseEnvelope(overrides))).toThrow(/control characters/);
  });

  it.each([
    ["eventId", { eventId: " " as EventEnvelope["eventId"] }],
    ["aggregateId", { aggregateId: " " }],
    ["aggregateType", { aggregateType: " " }],
    ["tenantId", { tenantId: " " as EventEnvelope["tenantId"] }],
    ["pharmacyId", { pharmacyId: " " as EventEnvelope["pharmacyId"] }],
    ["deviceId", { deviceId: " " as NonNullable<EventEnvelope["deviceId"]> }],
    ["actorId", { actorId: " " as NonNullable<EventEnvelope["actorId"]> }],
    ["idempotencyKey", { idempotencyKey: " " }],
    ["causationId", { causationId: " " as NonNullable<EventEnvelope["causationId"]> }],
    ["correlationId", { correlationId: " " as EventEnvelope["correlationId"] }],
  ])("rejects blank %s", (_label, overrides) => {
    expect(() => createEventEnvelope(baseEnvelope(overrides))).toThrow(/non-empty string/);
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

  it.each([
    "2026-02-29T00:00:00Z",
    "2023-02-29T23:59:59+09:00",
    "2024-02-30T00:00:00.000Z",
    "2024-02-31T12:30:00-04:00",
    "1900-02-29T00:00:00+00:00",
    "2026-04-31T00:00:00-23:59",
  ])("rejects non-real Gregorian wallClock date %s", (wallClock) => {
    expect(() => createEventEnvelope(baseEnvelope({ wallClock }))).toThrow(/wallClock/);
  });

  it.each([
    "2028-02-29T23:59:59Z",
    "2024-02-29T00:00:00.123456+09:00",
    "2000-02-29T12:30:00-23:59",
  ])("accepts real leap-day wallClock %s without changing it", (wallClock) => {
    const actualWallClock = createEventEnvelope(baseEnvelope({ wallClock })).wallClock;

    expect(actualWallClock).toBe(wallClock);
    expect(typeof actualWallClock).toBe("string");
  });

  it.each([
    null,
    undefined,
    new String("2024-02-29T00:00:00Z"),
    { toString: () => "2024-02-29T00:00:00Z" },
  ])("rejects non-primitive wallClock value %j", (wallClock) => {
    expect(() =>
      createEventEnvelope(baseEnvelope({ wallClock: wallClock as unknown as string })),
    ).toThrow(/wallClock/);
  });

  it("validates unbounded years using the Gregorian 400-year cycle", () => {
    const yearPrefix = "9".repeat(400);
    const validWallClock = `${yearPrefix}2000-02-29T00:00:00Z`;
    const invalidWallClock = `${yearPrefix}1900-02-29T00:00:00Z`;

    expect(createEventEnvelope(baseEnvelope({ wallClock: validWallClock })).wallClock).toBe(
      validWallClock,
    );
    expect(() => createEventEnvelope(baseEnvelope({ wallClock: invalidWallClock }))).toThrow(
      /wallClock/,
    );
  });

  it("accepts dead-letter envelopes with a reason", () => {
    const envelope = createEventEnvelope(
      baseEnvelope({
        syncStatus: "dead_letter",
        deadLetterReason: "retry budget exhausted",
      }),
    );

    expect(envelope.syncStatus).toBe("dead_letter");
    expect(envelope.deadLetterReason).toBe("retry budget exhausted");
  });

  it("rejects dead-letter envelopes without a non-empty reason", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          syncStatus: "dead_letter",
        }),
      ),
    ).toThrow(/deadLetterReason/);
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          syncStatus: "dead_letter",
          deadLetterReason: " ",
        }),
      ),
    ).toThrow(/deadLetterReason/);
  });

  it("rejects dead-letter reasons on non-dead-letter envelopes", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          syncStatus: "failed",
          deadLetterReason: "not dead-lettered yet",
        }),
      ),
    ).toThrow(/only allowed/);
  });

  it("validates optional IDs", () => {
    expect(() =>
      createEventEnvelope(
        baseEnvelope({
          deviceId: "" as EventEnvelope["deviceId"],
        } as Partial<EventEnvelope>),
      ),
    ).toThrow(/deviceId/);
  });
});
