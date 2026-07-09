import type { DeviceId, EventId, PharmacyId, TenantId, UserId } from "@yrese/shared-kernel";

export type PhiClassification = "none" | "phi" | "pii" | "phi_pii";
export type EncryptionStatus = "plaintext_forbidden" | "encrypted";
export type SyncStatus = "pending" | "sent" | "acknowledged" | "failed" | "dead_letter";

export interface EventEnvelope {
  readonly eventId: EventId;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly deviceId?: DeviceId;
  readonly actorId?: UserId;
  readonly sequenceNumber: bigint;
  readonly logicalClock: bigint;
  readonly wallClock: string;
  readonly idempotencyKey: string;
  readonly causationId?: EventId;
  readonly correlationId: EventId;
  readonly schemaVersion: number;
  readonly payloadHash: string;
  readonly phiClassification: PhiClassification;
  readonly encryptionStatus: EncryptionStatus;
  readonly syncStatus: SyncStatus;
  readonly retryCount: number;
  readonly deadLetterReason?: string;
}

export type CreateEventEnvelopeInput = EventEnvelope;

const sha256HexPattern = /^[a-f0-9]{64}$/;
const isoInstantPattern =
  /^\d{4,}-((0[1-9])|(1[0-2]))-((0[1-9])|([12]\d)|(3[01]))T(([01]\d)|(2[0-3])):[0-5]\d:[0-5]\d(?:\.\d+)?(Z|[+-](([01]\d)|(2[0-3])):[0-5]\d)$/;

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function assertNonNegativeBigInt(value: bigint, label: string): void {
  if (typeof value !== "bigint") {
    throw new TypeError(`${label} must be a bigint`);
  }
  if (value < 0n) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function assertPayloadHash(value: string): void {
  if (!sha256HexPattern.test(value)) {
    throw new RangeError("payloadHash must be a lowercase sha-256 hex string");
  }
}

function assertWallClock(value: string): void {
  if (!isoInstantPattern.test(value)) {
    throw new RangeError("wallClock must be a caller-provided ISO string with timezone");
  }
}

function assertPhiEncryptionInvariant(
  phiClassification: PhiClassification,
  encryptionStatus: EncryptionStatus,
): void {
  if (phiClassification !== "none" && encryptionStatus !== "encrypted") {
    throw new RangeError("PHI/PII event payloads require encryptionStatus 'encrypted'");
  }
}

function assertDeadLetterInvariant(syncStatus: SyncStatus, deadLetterReason?: string): void {
  if (syncStatus === "dead_letter") {
    if (deadLetterReason === undefined) {
      throw new RangeError("deadLetterReason is required when syncStatus is 'dead_letter'");
    }
    assertNonEmptyString(deadLetterReason, "deadLetterReason");
    return;
  }

  if (deadLetterReason !== undefined) {
    throw new RangeError("deadLetterReason is only allowed when syncStatus is 'dead_letter'");
  }
}

export function createEventEnvelope(input: CreateEventEnvelopeInput): EventEnvelope {
  assertNonEmptyString(input.eventId, "eventId");
  assertNonEmptyString(input.aggregateId, "aggregateId");
  assertNonEmptyString(input.aggregateType, "aggregateType");
  assertNonEmptyString(input.tenantId, "tenantId");
  assertNonEmptyString(input.pharmacyId, "pharmacyId");
  if (input.deviceId !== undefined) {
    assertNonEmptyString(input.deviceId, "deviceId");
  }
  if (input.actorId !== undefined) {
    assertNonEmptyString(input.actorId, "actorId");
  }
  assertNonNegativeBigInt(input.sequenceNumber, "sequenceNumber");
  assertNonNegativeBigInt(input.logicalClock, "logicalClock");
  assertWallClock(input.wallClock);
  assertNonEmptyString(input.idempotencyKey, "idempotencyKey");
  if (input.causationId !== undefined) {
    assertNonEmptyString(input.causationId, "causationId");
  }
  assertNonEmptyString(input.correlationId, "correlationId");
  assertPositiveInteger(input.schemaVersion, "schemaVersion");
  assertPayloadHash(input.payloadHash);
  assertPhiEncryptionInvariant(input.phiClassification, input.encryptionStatus);
  assertNonNegativeInteger(input.retryCount, "retryCount");
  assertDeadLetterInvariant(input.syncStatus, input.deadLetterReason);

  return Object.freeze({ ...input });
}
