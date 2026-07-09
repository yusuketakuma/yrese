import type { PharmacyId, TenantId, UserId } from "@yrese/shared-kernel";

import { canonicalJsonString, normalizeCanonicalInstant } from "./canonical-json.js";
import type { CreateAuditEventInput } from "./index.js";

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

export class UnsupportedAuditIntentFingerprintSchemaVersionError extends Error {
  constructor() {
    super("Unsupported audit intent fingerprint schema version");
    this.name = "UnsupportedAuditIntentFingerprintSchemaVersionError";
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

function assertExactRecordKeys(
  value: unknown,
  allowedFields: Readonly<Record<string, true>>,
  requiredFields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol" || !Object.hasOwn(allowedFields, key)) {
      throw new TypeError(`${label} contains an unknown field`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${label}.${key} must be an enumerable data property`);
    }
  }

  for (const key of requiredFields) {
    if (!Object.hasOwn(value, key)) {
      throw new TypeError(`${label}.${key} is required`);
    }
  }
}

function projectTargetRef(value: AuditAppendIntent["targetRef"]): Record<string, unknown> {
  assertExactRecordKeys(value, { id: true, kind: true }, ["id", "kind"], "intent.targetRef");
  return {
    id: value.id,
    kind: value.kind,
  };
}

function projectBusinessReason(
  value: NonNullable<AuditAppendIntent["businessReason"]>,
): Record<string, unknown> {
  assertExactRecordKeys(value, { code: true }, ["code"], "intent.businessReason");
  return { code: value.code };
}

function canonicalizeV1(context: AuditWriteContext, intent: AuditAppendIntent): string {
  assertExactRecordKeys(context, contextFields, Object.keys(contextFields), "context");
  assertExactRecordKeys(
    intent,
    intentFields,
    Object.keys(intentFields).filter(
      (key) =>
        key !== "businessReason" &&
        key !== "causationId" &&
        key !== "deadLetterReason" &&
        key !== "deviceId" &&
        key !== "reasonCode",
    ),
    "intent",
  );

  const canonicalContext: Record<keyof AuditWriteContext, unknown> = {
    actorId: context.actorId,
    pharmacyId: context.pharmacyId,
    tenantId: context.tenantId,
  };
  const canonicalIntent: Record<keyof AuditAppendIntent, unknown> = {
    aggregateId: intent.aggregateId,
    aggregateType: intent.aggregateType,
    auditEventType: intent.auditEventType,
    businessReason:
      intent.businessReason === undefined ? undefined : projectBusinessReason(intent.businessReason),
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
    targetRef: projectTargetRef(intent.targetRef),
    wallClock: normalizeCanonicalInstant(intent.wallClock, "intent.wallClock"),
  };

  return canonicalJsonString(
    {
      context: canonicalContext,
      intent: canonicalIntent,
    },
    "auditIntentFingerprint",
  );
}

export function canonicalizeAuditAppendIntentFingerprintInput(
  input: AuditIntentFingerprintInput,
): string {
  assertExactRecordKeys(
    input,
    fingerprintInputFields,
    Object.keys(fingerprintInputFields),
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
      return canonicalizeV1(input.context, input.intent);
    default:
      throw new UnsupportedAuditIntentFingerprintSchemaVersionError();
  }
}
