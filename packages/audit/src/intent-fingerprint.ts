import type { PharmacyId, TenantId, UserId } from "@yrese/shared-kernel";

import { canonicalJsonString, normalizeCanonicalInstant } from "./canonical-json.js";
import type { AuditEvent, CreateAuditEventInput } from "./index.js";

export const AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION = 1 as const;

export interface AuditWriteContext {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
}

export type AuditAppendIntent = Omit<
  CreateAuditEventInput,
  | "tenantId"
  | "pharmacyId"
  | "actorId"
  | "prevHash"
  | "sequenceNumber"
  | "phiClassification"
> & {
  readonly phiClassification: "none";
};

export interface AuditIntentFingerprint {
  readonly fingerprintSchemaVersion: typeof AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION;
  readonly intentFingerprint: string;
}

export interface AuditIntentFingerprintInput {
  readonly fingerprintSchemaVersion: number;
  readonly context: AuditWriteContext;
  readonly intent: AuditAppendIntent;
}

export interface AuditEventIntentFingerprintInput {
  readonly fingerprintSchemaVersion: number;
  readonly context: AuditWriteContext;
  readonly event: unknown;
}

export class UnsupportedAuditIntentFingerprintSchemaVersionError extends Error {
  constructor() {
    super("Unsupported audit intent fingerprint schema version");
    this.name = "UnsupportedAuditIntentFingerprintSchemaVersionError";
  }
}

export class AuditEventContextMismatchError extends Error {
  constructor() {
    super("Audit event authority context mismatch");
    this.name = "AuditEventContextMismatchError";
  }
}

const contextFields = {
  actorId: true,
  pharmacyId: true,
  tenantId: true,
} as const satisfies Record<keyof AuditWriteContext, true>;

const fingerprintInputFields = {
  context: true,
  fingerprintSchemaVersion: true,
  intent: true,
} as const satisfies Record<keyof AuditIntentFingerprintInput, true>;

const intentFields = {
  aggregateId: true,
  aggregateType: true,
  auditEventType: true,
  businessReason: true,
  causationId: true,
  correlationId: true,
  deadLetterReason: true,
  deviceId: true,
  encryptionStatus: true,
  eventId: true,
  idempotencyKey: true,
  logicalClock: true,
  outcome: true,
  payloadHash: true,
  phiClassification: true,
  reasonCode: true,
  retryCount: true,
  schemaVersion: true,
  syncStatus: true,
  targetRef: true,
  wallClock: true,
} as const satisfies Record<keyof AuditAppendIntent, true>;

const eventFields = {
  actorId: true,
  aggregateId: true,
  aggregateType: true,
  auditEventType: true,
  businessReason: true,
  causationId: true,
  correlationId: true,
  deadLetterReason: true,
  deviceId: true,
  encryptionStatus: true,
  entryHash: true,
  eventId: true,
  idempotencyKey: true,
  logicalClock: true,
  outcome: true,
  payloadHash: true,
  pharmacyId: true,
  phiClassification: true,
  prevHash: true,
  reasonCode: true,
  retryCount: true,
  schemaVersion: true,
  sequenceNumber: true,
  syncStatus: true,
  targetRef: true,
  tenantId: true,
  wallClock: true,
} as const satisfies Record<keyof AuditEvent, true>;

const optionalEventFields = [
  "businessReason",
  "causationId",
  "deadLetterReason",
  "deviceId",
  "reasonCode",
] as const satisfies readonly (keyof AuditEvent)[];

const optionalIntentFields = [
  "businessReason",
  "causationId",
  "deadLetterReason",
  "deviceId",
  "reasonCode",
] as const satisfies readonly (keyof AuditAppendIntent)[];

const auditEventIntentFingerprintInputFields = {
  context: true,
  event: true,
  fingerprintSchemaVersion: true,
} as const satisfies Record<keyof AuditEventIntentFingerprintInput, true>;

function copyExactRecord(
  value: unknown,
  allowedFields: Readonly<Record<string, true>>,
  requiredFields: readonly string[],
  optionalFields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const descriptors = new Map<string, PropertyDescriptor & { value: unknown }>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol" || !Object.hasOwn(allowedFields, key)) {
      throw new TypeError(`${label} contains an unknown field`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${label}.${key} must be an enumerable data property`);
    }
    descriptors.set(key, descriptor as PropertyDescriptor & { value: unknown });
  }

  for (const key of requiredFields) {
    if (!descriptors.has(key)) {
      throw new TypeError(`${label}.${key} is required`);
    }
  }
  const optionalFieldSet = new Set(optionalFields);
  const copy: Record<string, unknown> = {};
  for (const [key, descriptor] of descriptors) {
    const fieldValue = descriptor.value;
    if (optionalFieldSet.has(key) && fieldValue === undefined) {
      throw new TypeError(`${label}.${key} must be omitted instead of undefined`);
    }
    copy[key] = fieldValue;
  }
  return copy;
}

function copyTargetRef(value: unknown, label: string): AuditEvent["targetRef"] {
  return Object.freeze(
    copyExactRecord(value, { id: true, kind: true }, ["id", "kind"], [], label),
  ) as unknown as AuditEvent["targetRef"];
}

function copyBusinessReason(value: unknown, label: string): AuditEvent["businessReason"] {
  return Object.freeze(
    copyExactRecord(value, { code: true }, ["code"], [], label),
  ) as unknown as NonNullable<AuditEvent["businessReason"]>;
}

export function copyExactAuditEventShape(value: unknown): AuditEvent {
  const optionalFields = new Set<string>(optionalEventFields);
  const event = copyExactRecord(
    value,
    eventFields,
    Object.keys(eventFields).filter((field) => !optionalFields.has(field)),
    optionalEventFields,
    "auditEvent",
  );
  event.targetRef = copyTargetRef(event.targetRef, "auditEvent.targetRef");
  if (Object.hasOwn(event, "businessReason")) {
    event.businessReason = copyBusinessReason(event.businessReason, "auditEvent.businessReason");
  }
  return Object.freeze(event) as unknown as AuditEvent;
}

function copyAuditWriteContext(value: unknown): AuditWriteContext {
  return Object.freeze(
    copyExactRecord(value, contextFields, Object.keys(contextFields), [], "context"),
  ) as unknown as AuditWriteContext;
}

function copyAuditAppendIntent(value: unknown): AuditAppendIntent {
  const optionalFields = new Set<string>(optionalIntentFields);
  const intent = copyExactRecord(
    value,
    intentFields,
    Object.keys(intentFields).filter((field) => !optionalFields.has(field)),
    optionalIntentFields,
    "intent",
  );
  intent.targetRef = copyTargetRef(intent.targetRef, "intent.targetRef");
  if (Object.hasOwn(intent, "businessReason")) {
    intent.businessReason = copyBusinessReason(intent.businessReason, "intent.businessReason");
  }
  intent.wallClock = normalizeCanonicalInstant(
    intent.wallClock as string | Date,
    "intent.wallClock",
  );
  return Object.freeze(intent) as unknown as AuditAppendIntent;
}

export function projectAuditEventIntentFingerprintInput(
  value: AuditEventIntentFingerprintInput,
): AuditIntentFingerprintInput {
  const input = copyExactRecord(
    value,
    auditEventIntentFingerprintInputFields,
    Object.keys(auditEventIntentFingerprintInputFields),
    [],
    "auditEventFingerprintInput",
  );
  const context = copyAuditWriteContext(input.context);
  const event = copyExactAuditEventShape(input.event);
  if (
    event.tenantId !== context.tenantId ||
    event.pharmacyId !== context.pharmacyId ||
    event.actorId !== context.actorId
  ) {
    throw new AuditEventContextMismatchError();
  }

  const intent: Record<string, unknown> = {};
  for (const field of Object.keys(intentFields)) {
    if (Object.hasOwn(event, field)) {
      intent[field] = event[field as keyof AuditEvent];
    }
  }

  return Object.freeze({
    fingerprintSchemaVersion: input.fingerprintSchemaVersion as number,
    context,
    intent: Object.freeze(intent) as unknown as AuditAppendIntent,
  });
}

function canonicalizeV1(context: AuditWriteContext, intent: AuditAppendIntent): string {
  const canonicalContext: Record<keyof AuditWriteContext, unknown> = {
    actorId: context.actorId,
    pharmacyId: context.pharmacyId,
    tenantId: context.tenantId,
  };
  const canonicalIntent: Record<keyof AuditAppendIntent, unknown> = {
    aggregateId: intent.aggregateId,
    aggregateType: intent.aggregateType,
    auditEventType: intent.auditEventType,
    businessReason: intent.businessReason,
    causationId: intent.causationId,
    correlationId: intent.correlationId,
    deadLetterReason: intent.deadLetterReason,
    deviceId: intent.deviceId,
    encryptionStatus: intent.encryptionStatus,
    eventId: intent.eventId,
    idempotencyKey: intent.idempotencyKey,
    logicalClock: intent.logicalClock,
    outcome: intent.outcome,
    payloadHash: intent.payloadHash,
    phiClassification: intent.phiClassification,
    reasonCode: intent.reasonCode,
    retryCount: intent.retryCount,
    schemaVersion: intent.schemaVersion,
    syncStatus: intent.syncStatus,
    targetRef: intent.targetRef,
    wallClock: intent.wallClock,
  };

  return canonicalJsonString(
    {
      context: canonicalContext,
      intent: canonicalIntent,
    },
    "auditIntentFingerprint",
  );
}

export function snapshotAuditAppendIntentFingerprintInput(
  value: AuditIntentFingerprintInput,
): AuditIntentFingerprintInput {
  const input = copyExactRecord(
    value,
    fingerprintInputFields,
    Object.keys(fingerprintInputFields),
    [],
    "fingerprintInput",
  );

  const fingerprintSchemaVersion: unknown = input.fingerprintSchemaVersion;
  if (
    typeof fingerprintSchemaVersion !== "number" ||
    !Number.isSafeInteger(fingerprintSchemaVersion) ||
    fingerprintSchemaVersion <= 0
  ) {
    throw new UnsupportedAuditIntentFingerprintSchemaVersionError();
  }

  switch (fingerprintSchemaVersion) {
    case AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION:
      return Object.freeze({
        fingerprintSchemaVersion,
        context: copyAuditWriteContext(input.context),
        intent: copyAuditAppendIntent(input.intent),
      });
    default:
      throw new UnsupportedAuditIntentFingerprintSchemaVersionError();
  }
}

export function canonicalizeAuditAppendIntentFingerprintSnapshot(
  snapshot: AuditIntentFingerprintInput,
): string {
  return canonicalizeV1(snapshot.context, snapshot.intent);
}

export function canonicalizeAuditAppendIntentFingerprintInput(
  input: AuditIntentFingerprintInput,
): string {
  return canonicalizeAuditAppendIntentFingerprintSnapshot(
    snapshotAuditAppendIntentFingerprintInput(input),
  );
}
