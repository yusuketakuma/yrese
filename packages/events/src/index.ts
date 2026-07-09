import type { DeviceId, EventId, PharmacyId, TenantId, UserId } from "@yrese/shared-kernel";

export const PHI_CLASSIFICATIONS = ["none", "phi", "pii", "phi_pii"] as const;
export const ENCRYPTION_STATUSES = ["plaintext_forbidden", "encrypted"] as const;
export const SYNC_STATUSES = ["pending", "sent", "acknowledged", "failed", "dead_letter"] as const;

export type PhiClassification = (typeof PHI_CLASSIFICATIONS)[number];
export type EncryptionStatus = (typeof ENCRYPTION_STATUSES)[number];
export type SyncStatus = (typeof SYNC_STATUSES)[number];

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
  /^(\d{4,})-((?:0[1-9])|(?:1[0-2]))-((?:0[1-9])|(?:[12]\d)|(?:3[01]))T(?:(?:[01]\d)|(?:2[0-3])):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:(?:[01]\d)|(?:2[0-3])):[0-5]\d)$/;
// eslint-disable-next-line no-control-regex
const controlCharacterPattern = /[\x00-\x1f\x7f]/;

function isGregorianLeapYear(year: string): boolean {
  const yearCycle = Number(year.slice(-4));
  return yearCycle % 4 === 0 && (yearCycle % 100 !== 0 || yearCycle % 400 === 0);
}

function daysInGregorianMonth(year: string, month: number): number {
  if (month === 2) {
    return isGregorianLeapYear(year) ? 29 : 28;
  }

  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function assertIsoInstant(value: string, label = "instant"): void {
  assertNonEmptyString(value, label);

  const match = isoInstantPattern.exec(value);
  if (match === null) {
    throw new RangeError(`${label} must be an ISO string with timezone`);
  }

  const year = match[1]!;
  const monthText = match[2]!;
  const dayText = match[3]!;
  const month = Number(monthText);
  const day = Number(dayText);
  if (day > daysInGregorianMonth(year, month)) {
    throw new RangeError(`${label} must contain a real proleptic Gregorian calendar date`);
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string`);
  }
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function assertNoControlChars(value: string, label: string): void {
  if (controlCharacterPattern.test(value)) {
    throw new RangeError(`${label} must not contain control characters`);
  }
}

function assertSafeIdentifier(value: string, label: string): void {
  assertNonEmptyString(value, label);
  assertNoControlChars(value, label);
}

function assertAllowedString<T extends string>(
  value: string,
  allowedValues: readonly T[],
  label: string,
): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new RangeError(`${label} must be one of: ${allowedValues.join(", ")}`);
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
    assertSafeIdentifier(deadLetterReason, "deadLetterReason");
    return;
  }

  if (deadLetterReason !== undefined) {
    throw new RangeError("deadLetterReason is only allowed when syncStatus is 'dead_letter'");
  }
}

export function createEventEnvelope(input: CreateEventEnvelopeInput): EventEnvelope {
  assertSafeIdentifier(input.eventId, "eventId");
  assertSafeIdentifier(input.aggregateId, "aggregateId");
  assertSafeIdentifier(input.aggregateType, "aggregateType");
  assertSafeIdentifier(input.tenantId, "tenantId");
  assertSafeIdentifier(input.pharmacyId, "pharmacyId");
  if (input.deviceId !== undefined) {
    assertSafeIdentifier(input.deviceId, "deviceId");
  }
  if (input.actorId !== undefined) {
    assertSafeIdentifier(input.actorId, "actorId");
  }
  assertNonNegativeBigInt(input.sequenceNumber, "sequenceNumber");
  assertNonNegativeBigInt(input.logicalClock, "logicalClock");
  assertIsoInstant(input.wallClock, "wallClock");
  assertSafeIdentifier(input.idempotencyKey, "idempotencyKey");
  if (input.causationId !== undefined) {
    assertSafeIdentifier(input.causationId, "causationId");
  }
  assertSafeIdentifier(input.correlationId, "correlationId");
  assertPositiveInteger(input.schemaVersion, "schemaVersion");
  assertPayloadHash(input.payloadHash);
  assertAllowedString(input.phiClassification, PHI_CLASSIFICATIONS, "phiClassification");
  assertAllowedString(input.encryptionStatus, ENCRYPTION_STATUSES, "encryptionStatus");
  assertAllowedString(input.syncStatus, SYNC_STATUSES, "syncStatus");
  assertPhiEncryptionInvariant(input.phiClassification, input.encryptionStatus);
  assertNonNegativeInteger(input.retryCount, "retryCount");
  assertDeadLetterInvariant(input.syncStatus, input.deadLetterReason);

  return Object.freeze({ ...input });
}
