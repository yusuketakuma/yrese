import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import * as auditPublicApi from "./index.js";
import { canonicalJsonString } from "./canonical-json.js";
import {
  canonicalizeAuditAppendIntentFingerprintInput,
  copyExactAuditEventShape,
  snapshotAuditAppendIntentFingerprintInput,
} from "./intent-fingerprint.js";
import {
  AUDIT_GENESIS_PREV_HASH,
  AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION,
  AuditEventContextMismatchError,
  UnsupportedAuditIntentFingerprintSchemaVersionError,
  computeAuditAppendIntentFingerprint,
  computeAuditEventIntentFingerprint,
  createAuditEvent,
  type AuditEvent,
  type AuditAppendIntent,
  type AuditEventIntentFingerprintInput,
  type AuditIntentFingerprintInput,
  type AuditWriteContext,
} from "./index.js";


export const payloadHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
export const expectedCanonicalJson =
  '{"context":{"actorId":"actor-synthetic-001","pharmacyId":"pharmacy-synthetic-001","tenantId":"tenant-synthetic-001"},"intent":{"aggregateId":"aggregate-synthetic-001","aggregateType":"synthetic-調剤","auditEventType":"breakglass.used","businessReason":{"code":"SYNTHETIC_EMERGENCY_ACCESS"},"causationId":"causation-synthetic-001","correlationId":"correlation-synthetic-001","deadLetterReason":"SYNTHETIC_TRANSPORT_FAILURE","deviceId":"device-synthetic-001","encryptionStatus":"plaintext_forbidden","eventId":"event-synthetic-001","idempotencyKey":"event-synthetic-001:1","logicalClock":"42","outcome":"denied","payloadHash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","phiClassification":"none","reasonCode":"AUTH-0003","retryCount":2,"schemaVersion":1,"syncStatus":"dead_letter","targetRef":{"id":"target-synthetic-001","kind":"synthetic"},"wallClock":"2026-07-10T00:00:00.000Z"}}';
export const expectedFingerprint = "2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745";

export function syntheticContext(): AuditWriteContext {
  return {
    tenantId: tenantId("tenant-synthetic-001"),
    pharmacyId: pharmacyId("pharmacy-synthetic-001"),
    actorId: userId("actor-synthetic-001"),
  };
}

export function syntheticIntent(overrides: Partial<AuditAppendIntent> = {}): AuditAppendIntent {
  return {
    eventId: eventId("event-synthetic-001"),
    aggregateId: "aggregate-synthetic-001",
    aggregateType: "synthetic-調剤",
    deviceId: deviceId("device-synthetic-001"),
    causationId: eventId("causation-synthetic-001"),
    logicalClock: 42n,
    wallClock: "2026-07-10T09:00:00+09:00",
    idempotencyKey: "event-synthetic-001:1",
    correlationId: eventId("correlation-synthetic-001"),
    schemaVersion: 1,
    payloadHash,
    phiClassification: "none",
    encryptionStatus: "plaintext_forbidden",
    syncStatus: "dead_letter",
    retryCount: 2,
    deadLetterReason: "SYNTHETIC_TRANSPORT_FAILURE",
    auditEventType: "breakglass.used",
    targetRef: {
      kind: "synthetic",
      id: "target-synthetic-001",
    },
    outcome: "denied",
    reasonCode: "AUTH-0003",
    businessReason: {
      code: "SYNTHETIC_EMERGENCY_ACCESS",
    },
    ...overrides,
  };
}

export function fingerprintInput(
  overrides: Partial<AuditIntentFingerprintInput> = {},
): AuditIntentFingerprintInput {
  return {
    fingerprintSchemaVersion: AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION,
    context: syntheticContext(),
    intent: syntheticIntent(),
    ...overrides,
  };
}

export function countSetConstructions(run: () => void): number {
  const NativeSet = globalThis.Set;
  let constructions = 0;
  class CountingSet<T> extends NativeSet<T> {
    constructor(values?: readonly T[] | null) {
      super(values);
      constructions += 1;
    }
  }

  vi.stubGlobal("Set", CountingSet);
  try {
    run();
  } finally {
    vi.unstubAllGlobals();
  }
  return constructions;
}

