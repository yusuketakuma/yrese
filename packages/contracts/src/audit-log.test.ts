import { describe, expect, it } from "vitest";

import {
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_MAX_LIMIT,
  auditChainVerificationSchema,
  auditLogEntrySchema,
  auditLogQuerySchema,
  auditLogResponseSchema,
} from "./audit-log.js";

const VALID_ENTRY = {
  eventId: "evt-0001",
  wallClock: "2026-07-11T10:00:00.000Z",
  actorId: "u-1001",
  auditEventType: "patient.viewed",
  targetRef: { kind: "patient", id: "p-0001" },
  outcome: "success",
} as const;

describe("auditLogQuerySchema", () => {
  it("applies the default limit and coerces strings", () => {
    expect(auditLogQuerySchema.parse({}).limit).toBe(AUDIT_LOG_DEFAULT_LIMIT);
    expect(auditLogQuerySchema.parse({ limit: "10" }).limit).toBe(10);
  });

  it("rejects limits above the maximum and non-positive limits", () => {
    expect(auditLogQuerySchema.safeParse({ limit: AUDIT_LOG_MAX_LIMIT + 1 }).success).toBe(false);
    expect(auditLogQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});

describe("auditLogEntrySchema", () => {
  it("accepts a valid display projection", () => {
    expect(auditLogEntrySchema.parse(VALID_ENTRY)).toEqual(VALID_ENTRY);
  });

  it("accepts three-segment audit event types (support.session.started)", () => {
    expect(
      auditLogEntrySchema.safeParse({ ...VALID_ENTRY, auditEventType: "support.session.started" })
        .success,
    ).toBe(true);
  });

  it("rejects malformed audit event types", () => {
    for (const bad of ["Patient.Viewed", "patient", "patient..viewed", "patient.viewed.x.y"]) {
      expect(auditLogEntrySchema.safeParse({ ...VALID_ENTRY, auditEventType: bad }).success).toBe(
        false,
      );
    }
  });

  it("rejects unknown outcomes", () => {
    expect(auditLogEntrySchema.safeParse({ ...VALID_ENTRY, outcome: "maybe" }).success).toBe(false);
  });
});

describe("auditChainVerificationSchema", () => {
  it("accepts ok=true without break details and ok=false with them", () => {
    expect(auditChainVerificationSchema.parse({ ok: true, checkedCount: 3 })).toEqual({
      ok: true,
      checkedCount: 3,
    });
    expect(
      auditChainVerificationSchema.parse({
        ok: false,
        checkedCount: 3,
        breakIndex: 1,
        reason: "prev_hash_mismatch",
      }).ok,
    ).toBe(false);
  });

  it("rejects ok=false without a reason", () => {
    expect(
      auditChainVerificationSchema.safeParse({ ok: false, checkedCount: 3, breakIndex: 1 }).success,
    ).toBe(false);
  });
});

describe("auditLogResponseSchema", () => {
  it("accepts entries with verification and total count", () => {
    const parsed = auditLogResponseSchema.parse({
      entries: [VALID_ENTRY],
      chainVerification: { ok: true, checkedCount: 1 },
      totalCount: 1,
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.totalCount).toBe(1);
  });
});
