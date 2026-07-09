import { createHash } from "node:crypto";
import type { EventEnvelope } from "@yrese/events";
import { assertIsoInstant, createEventEnvelope } from "@yrese/events";
import { createKernelErrorCodeRegistry, type UserId } from "@yrese/shared-kernel";

export const AUDIT_EVENT_TYPES = [
  "patient.viewed",
  "patient.created",
  "patient.updated",
  "patient.deleted",
  "reception.created",
  "reception.cancelled",
  "insurance.viewed",
  "insurance.updated",
  "prescription.created",
  "prescription.updated",
  "dispensing.confirmed",
  "inquiry.recorded",
  "calculation.finalized",
  "calculation.recalculated",
  "report.printed",
  "report.reprinted",
  "claim.checked",
  "claim.closed",
  "claim.locked",
  "claim.receipt_exported",
  "master.approved",
  "master.applied",
  "master.rolled_back",
  "permission.changed",
  "account.issued",
  "account.suspended",
  "auth.login",
  "auth.logout",
  "auth.failed",
  "breakglass.used",
  "breakglass.ended",
  "support.session.started",
  "support.session.ended",
  "support.operation",
  "data.exported",
  "data.returned",
  "config.changed",
  "edge.registered",
  "edge.revoked",
  "sync.conflict.detected",
  "sync.conflict.resolved",
  "system.mode.changed",
  "audit.viewed",
  "audit.exported",
  "retention.disposed",
  "accounting.charge.created",
  "accounting.charge.reversed",
  "accounting.payment.received",
  "accounting.payment.cancelled",
  "accounting.payment.refunded",
  "accounting.allocation.created",
  "accounting.allocation.reversed",
  "accounting.adjustment.created",
  "accounting.receivable.status_changed",
  "receipt.issued",
  "receipt.reissued",
  "receipt.cancelled",
  "receipt.voided",
  "statement.issued",
  "statement.voided",
  "closing.executed",
  "closing.adjusted",
  "facility.invoice.issued",
  "facility.payment.received",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditOutcome = "success" | "denied" | "failed";

export interface AuditTargetRef {
  readonly kind: string;
  readonly id: string;
}

export interface AuditBusinessReason {
  readonly code: string;
}

export interface ParsedAuditEventType {
  readonly domain: string;
  readonly resource?: string;
  readonly action: string;
}

export interface AuditEvent extends EventEnvelope {
  readonly actorId: UserId;
  readonly auditEventType: AuditEventType;
  readonly targetRef: AuditTargetRef;
  readonly outcome: AuditOutcome;
  readonly reasonCode?: string;
  readonly businessReason?: AuditBusinessReason;
  readonly prevHash: string;
  readonly entryHash: string;
}

export type CreateAuditEventInput = Omit<AuditEvent, "auditEventType" | "entryHash"> & {
  readonly auditEventType: string;
};

export const AUDIT_GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type AuditHashChainBreakReason =
  | "prev_hash_mismatch"
  | "entry_hash_mismatch"
  | "hash_format_invalid";

export type AuditHashChainVerification =
  | {
      readonly ok: true;
      readonly checkedCount: number;
      readonly lastEntryHash?: string;
    }
  | {
      readonly ok: false;
      readonly checkedCount: number;
      readonly breakIndex: number;
      readonly eventId?: string;
      readonly reason: AuditHashChainBreakReason;
      readonly expectedPrevHash?: string;
      readonly actualPrevHash?: string;
      readonly expectedEntryHash?: string;
      readonly actualEntryHash?: string;
    };

const auditEventTypeSet = new Set<string>(AUDIT_EVENT_TYPES);
const snakeCaseSegmentPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const sha256HexPattern = /^[a-f0-9]{64}$/;
const businessReasonCodePattern = /^[A-Z][A-Z0-9_]{2,63}$/;
const businessReasonRequiredActions = new Set([
  "cancelled",
  "voided",
  "adjusted",
  "refunded",
  "reversed",
  "rolled_back",
]);
const businessReasonRequiredEventTypes = new Set<string>(["accounting.adjustment.created", "breakglass.used"]);
const auditOutcomes = new Set<string>(["success", "denied", "failed"]);
const kernelErrorCodeRegistry = createKernelErrorCodeRegistry();

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string`);
  }

  if (value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function assertNoControlChars(value: string, label: string): void {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new RangeError(`${label} must not contain control characters`);
  }
}

function assertSha256Hex(value: string, label: string): void {
  if (!sha256HexPattern.test(value)) {
    throw new RangeError(`${label} must be a lowercase sha-256 hex string`);
  }
}

export function parseAuditEventType(value: string): ParsedAuditEventType {
  const segments = value.split(".");

  if (segments.length !== 2 && segments.length !== 3) {
    throw new RangeError("auditEventType must have 2 or 3 dot-separated segments");
  }

  for (const segment of segments) {
    if (!snakeCaseSegmentPattern.test(segment)) {
      throw new RangeError("auditEventType segments must be snake_case");
    }
  }

  if (segments.length === 2) {
    const [domain, action] = segments as [string, string];
    return Object.freeze({ domain, action });
  }

  const [domain, resource, action] = segments as [string, string, string];
  return Object.freeze({ domain, resource, action });
}

export function isAuditEventType(value: string): value is AuditEventType {
  if (!auditEventTypeSet.has(value)) {
    return false;
  }

  try {
    parseAuditEventType(value);
    return true;
  } catch {
    return false;
  }
}

export function requiresBusinessReason(auditEventType: AuditEventType): boolean {
  return (
    businessReasonRequiredEventTypes.has(auditEventType) ||
    businessReasonRequiredActions.has(parseAuditEventType(auditEventType).action)
  );
}

function assertRegisteredAuditEventType(value: string): asserts value is AuditEventType {
  parseAuditEventType(value);

  if (!auditEventTypeSet.has(value)) {
    throw new RangeError(`unknown auditEventType: ${value}`);
  }
}

function assertTargetRef(targetRef: AuditTargetRef): void {
  assertNonEmptyString(targetRef.kind, "targetRef.kind");
  assertNoControlChars(targetRef.kind, "targetRef.kind");
  assertNonEmptyString(targetRef.id, "targetRef.id");
  assertNoControlChars(targetRef.id, "targetRef.id");

  if (!snakeCaseSegmentPattern.test(targetRef.kind)) {
    throw new RangeError("targetRef.kind must be snake_case");
  }
}

function assertReasonCode(reasonCode: string | undefined): void {
  if (reasonCode !== undefined && kernelErrorCodeRegistry.get(reasonCode) === undefined) {
    throw new RangeError("reasonCode must reference a registered error code");
  }
}

function assertOutcome(outcome: AuditOutcome): void {
  if (!auditOutcomes.has(outcome)) {
    throw new RangeError("outcome must be success, denied, or failed");
  }
}

function assertBusinessReason(
  auditEventType: AuditEventType,
  businessReason: AuditBusinessReason | undefined,
): void {
  if (requiresBusinessReason(auditEventType) && businessReason === undefined) {
    throw new RangeError(`businessReason is required for ${auditEventType}`);
  }

  if (businessReason === undefined) {
    return;
  }

  assertNonEmptyString(businessReason.code, "businessReason.code");
  assertNoControlChars(businessReason.code, "businessReason.code");

  if (!businessReasonCodePattern.test(businessReason.code)) {
    throw new RangeError("businessReason.code must be an uppercase structured code");
  }
}

function assertAuditPhiClassification(input: CreateAuditEventInput): void {
  if (input.phiClassification !== "none") {
    throw new RangeError("AuditEvent phiClassification must be 'none'");
  }
}

function assertEnvelopeIdControlCharacters(input: CreateAuditEventInput): void {
  assertNoControlChars(input.eventId, "eventId");
  assertNoControlChars(input.tenantId, "tenantId");
  assertNoControlChars(input.pharmacyId, "pharmacyId");
  if (input.deviceId !== undefined) {
    assertNoControlChars(input.deviceId, "deviceId");
  }
  assertNoControlChars(input.actorId, "actorId");
  if (input.causationId !== undefined) {
    assertNoControlChars(input.causationId, "causationId");
  }
  assertNoControlChars(input.correlationId, "correlationId");
}

function freezeTargetRef(targetRef: AuditTargetRef): AuditTargetRef {
  return Object.freeze({
    kind: targetRef.kind,
    id: targetRef.id,
  });
}

function freezeBusinessReason(businessReason: AuditBusinessReason): AuditBusinessReason {
  return Object.freeze({
    code: businessReason.code,
  });
}

function normalizeInstant(value: string | Date, label: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError(`${label} must be a valid Date`);
    }
    return value.toISOString();
  }

  assertNonEmptyString(value, label);
  assertIsoInstant(value, label);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${label} must be a valid instant`);
  }

  return date.toISOString();
}

function canonicalJsonValue(value: unknown, label: string): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${label} must be a safe integer`);
    }
    return value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError(`${label} must be a valid Date`);
    }
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const canonicalItem = canonicalJsonValue(item, `${label}[${index}]`);
      if (canonicalItem === undefined) {
        throw new RangeError(`${label}[${index}] must not be undefined`);
      }
      return canonicalItem;
    });
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const canonicalChild = canonicalJsonValue(
        (value as Record<string, unknown>)[key],
        `${label}.${key}`,
      );
      if (canonicalChild !== undefined) {
        output[key] = canonicalChild;
      }
    }
    return output;
  }

  throw new TypeError(`${label} has an unsupported value type`);
}

function canonicalJsonString(value: Record<string, unknown>): string {
  return JSON.stringify(canonicalJsonValue(value, "auditEvent"));
}

function auditCanonicalPayload(input: CreateAuditEventInput | AuditEvent): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    actorId: input.actorId,
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    auditEventType: input.auditEventType,
    correlationId: input.correlationId,
    encryptionStatus: input.encryptionStatus,
    eventId: input.eventId,
    idempotencyKey: input.idempotencyKey,
    logicalClock: input.logicalClock,
    outcome: input.outcome,
    payloadHash: input.payloadHash,
    pharmacyId: input.pharmacyId,
    phiClassification: input.phiClassification,
    retryCount: input.retryCount,
    schemaVersion: input.schemaVersion,
    sequenceNumber: input.sequenceNumber,
    syncStatus: input.syncStatus,
    targetRef: {
      id: input.targetRef.id,
      kind: input.targetRef.kind,
    },
    tenantId: input.tenantId,
    wallClock: normalizeInstant(input.wallClock, "wallClock"),
  };

  if (input.businessReason !== undefined) {
    payload.businessReason = {
      code: input.businessReason.code,
    };
  }
  if (input.causationId !== undefined) {
    payload.causationId = input.causationId;
  }
  if (input.deadLetterReason !== undefined) {
    payload.deadLetterReason = input.deadLetterReason;
  }
  if (input.deviceId !== undefined) {
    payload.deviceId = input.deviceId;
  }
  if (input.reasonCode !== undefined) {
    payload.reasonCode = input.reasonCode;
  }

  return payload;
}

export function canonicalizeAuditEventPayload(input: CreateAuditEventInput | AuditEvent): string {
  // The audit entry commits to event payload through payloadHash while audit targets stay ID-only.
  return canonicalJsonString(auditCanonicalPayload(input));
}

export function computeAuditEntryHash(input: {
  readonly prevHash: string;
  readonly canonicalJson: string;
}): string {
  assertSha256Hex(input.prevHash, "prevHash");
  assertNonEmptyString(input.canonicalJson, "canonicalJson");

  return createHash("sha256")
    .update(input.prevHash, "utf8")
    .update(input.canonicalJson, "utf8")
    .digest("hex");
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  assertRegisteredAuditEventType(input.auditEventType);
  assertNonEmptyString(input.actorId, "actorId");
  assertAuditPhiClassification(input);
  assertEnvelopeIdControlCharacters(input);
  assertTargetRef(input.targetRef);
  assertOutcome(input.outcome);
  assertReasonCode(input.reasonCode);
  assertBusinessReason(input.auditEventType, input.businessReason);
  assertSha256Hex(input.prevHash, "prevHash");

  const envelopeInput: EventEnvelope = {
    eventId: input.eventId,
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
    actorId: input.actorId,
    sequenceNumber: input.sequenceNumber,
    logicalClock: input.logicalClock,
    wallClock: normalizeInstant(input.wallClock, "wallClock"),
    idempotencyKey: input.idempotencyKey,
    ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
    correlationId: input.correlationId,
    schemaVersion: input.schemaVersion,
    payloadHash: input.payloadHash,
    phiClassification: input.phiClassification,
    encryptionStatus: input.encryptionStatus,
    syncStatus: input.syncStatus,
    retryCount: input.retryCount,
    ...(input.deadLetterReason !== undefined ? { deadLetterReason: input.deadLetterReason } : {}),
  };

  const envelope = createEventEnvelope(envelopeInput);
  const targetRef = freezeTargetRef(input.targetRef);
  const businessReason =
    input.businessReason !== undefined ? freezeBusinessReason(input.businessReason) : undefined;
  const canonicalInput: CreateAuditEventInput = {
    ...envelope,
    actorId: input.actorId,
    auditEventType: input.auditEventType,
    targetRef,
    outcome: input.outcome,
    ...(input.reasonCode !== undefined ? { reasonCode: input.reasonCode } : {}),
    ...(businessReason !== undefined ? { businessReason } : {}),
    prevHash: input.prevHash,
  };
  const entryHash = computeAuditEntryHash({
    prevHash: input.prevHash,
    canonicalJson: canonicalizeAuditEventPayload(canonicalInput),
  });
  const auditEvent = {
    eventId: envelope.eventId,
    aggregateId: envelope.aggregateId,
    aggregateType: envelope.aggregateType,
    tenantId: envelope.tenantId,
    pharmacyId: envelope.pharmacyId,
    ...(envelope.deviceId !== undefined ? { deviceId: envelope.deviceId } : {}),
    actorId: input.actorId,
    sequenceNumber: envelope.sequenceNumber,
    logicalClock: envelope.logicalClock,
    wallClock: envelope.wallClock,
    idempotencyKey: envelope.idempotencyKey,
    ...(envelope.causationId !== undefined ? { causationId: envelope.causationId } : {}),
    correlationId: envelope.correlationId,
    schemaVersion: envelope.schemaVersion,
    payloadHash: envelope.payloadHash,
    phiClassification: envelope.phiClassification,
    encryptionStatus: envelope.encryptionStatus,
    syncStatus: envelope.syncStatus,
    retryCount: envelope.retryCount,
    ...(envelope.deadLetterReason !== undefined ? { deadLetterReason: envelope.deadLetterReason } : {}),
    auditEventType: input.auditEventType,
    targetRef,
    outcome: input.outcome,
    ...(input.reasonCode !== undefined ? { reasonCode: input.reasonCode } : {}),
    ...(businessReason !== undefined ? { businessReason } : {}),
    prevHash: input.prevHash,
    entryHash,
  } satisfies AuditEvent;

  return Object.freeze(auditEvent);
}

function hashFormatFailure(
  events: readonly AuditEvent[],
  index: number,
  checkedCount: number,
): AuditHashChainVerification {
  const event = events[index];
  return Object.freeze({
    ok: false,
    checkedCount,
    breakIndex: index,
    reason: "hash_format_invalid",
    ...(event !== undefined ? { eventId: event.eventId } : {}),
  });
}

export function verifyAuditHashChain(events: readonly AuditEvent[]): AuditHashChainVerification {
  let expectedPrevHash = AUDIT_GENESIS_PREV_HASH;
  let checkedCount = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event === undefined) {
      continue;
    }

    try {
      assertSha256Hex(event.prevHash, "prevHash");
      assertSha256Hex(event.entryHash, "entryHash");
    } catch {
      return hashFormatFailure(events, index, checkedCount);
    }

    if (event.prevHash !== expectedPrevHash) {
      return Object.freeze({
        ok: false,
        checkedCount,
        breakIndex: index,
        eventId: event.eventId,
        reason: "prev_hash_mismatch",
        expectedPrevHash,
        actualPrevHash: event.prevHash,
      });
    }

    const expectedEntryHash = computeAuditEntryHash({
      prevHash: event.prevHash,
      canonicalJson: canonicalizeAuditEventPayload(event),
    });
    if (event.entryHash !== expectedEntryHash) {
      return Object.freeze({
        ok: false,
        checkedCount,
        breakIndex: index,
        eventId: event.eventId,
        reason: "entry_hash_mismatch",
        expectedEntryHash,
        actualEntryHash: event.entryHash,
      });
    }

    checkedCount += 1;
    expectedPrevHash = event.entryHash;
  }

  const result: { ok: true; checkedCount: number; lastEntryHash?: string } = {
    ok: true,
    checkedCount,
  };
  if (checkedCount > 0) {
    result.lastEntryHash = expectedPrevHash;
  }
  return Object.freeze(result);
}
