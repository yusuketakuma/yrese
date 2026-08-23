import { describe, expect, it } from "vitest";

import {
  PARTNER_EVENT_FORBIDDEN_KEYS,
  partnerEventSchema,
  receptionCreatedPartnerEventSchema,
} from "./partner-event.js";

const valid = {
  eventId: "outbox-0001",
  eventType: "reception.created" as const,
  schemaVersion: 1 as const,
  occurredAt: "2026-08-23T00:00:00.000Z",
  auditEventId: "audit-0001",
  aggregate: { type: "reception" as const, id: "reception-000001" },
};

describe("partnerEventSchema (Event Catalog v0)", () => {
  it("accepts a reception.created event carrying identifiers only", () => {
    expect(partnerEventSchema.parse(valid)).toEqual(valid);
  });

  it("rejects unknown event types, wrong schema versions, and naive timestamps", () => {
    expect(() => partnerEventSchema.parse({ ...valid, eventType: "reception.deleted" })).toThrow();
    expect(() => partnerEventSchema.parse({ ...valid, schemaVersion: 2 })).toThrow();
    expect(() => partnerEventSchema.parse({ ...valid, occurredAt: "2026-08-23T00:00:00" })).toThrow();
  });

  it("rejects control characters and the composite-key delimiter in identifiers", () => {
    expect(() => partnerEventSchema.parse({ ...valid, eventId: "a\u001fb" })).toThrow();
    expect(() =>
      partnerEventSchema.parse({ ...valid, aggregate: { type: "reception", id: "r#1" } }),
    ).toThrow();
  });

  it("declares no PHI-bearing or free-form payload keys", () => {
    const keys = Object.keys(receptionCreatedPartnerEventSchema.shape);
    for (const forbidden of PARTNER_EVENT_FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
