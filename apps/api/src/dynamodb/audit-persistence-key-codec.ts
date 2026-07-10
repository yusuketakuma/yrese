import type { AuditWriteContext } from '@yrese/audit';
import { eventId, type EventId } from '@yrese/shared-kernel';

export const AUDIT_SEQUENCE_MAX = 18_446_744_073_709_551_615n;
export const AUDIT_SEQUENCE_WIDTH = 20;

export interface AuditPersistenceKey {
  readonly PK: string;
  readonly SK: string;
}

export interface ParsedAuditEventSortKey {
  readonly sequenceNumber: bigint;
  readonly sequenceNumberDecimal: string;
  readonly eventId: EventId;
}

const auditPersistenceKeySegmentErrorMessage = 'Invalid audit persistence key segment';
const auditPersistenceSequenceErrorMessage = 'Invalid audit persistence sequence number';
const auditPersistenceEventSortKeyErrorMessage = 'Invalid audit persistence event sort key';
const auditSequenceDecimalPattern = /^[1-9][0-9]*$/;
const auditSequenceSortSegmentPattern = /^[0-9]{20}$/;
// eslint-disable-next-line no-control-regex
const controlCharacterPattern = /[\x00-\x1f\x7f]/;
const auditEventSortKeyPrefix = 'SEQ#';
const auditEventSortKeyMarker = '#EVENT#';

function invalidKeySegment(): never {
  throw new RangeError(auditPersistenceKeySegmentErrorMessage);
}

function invalidSequenceNumber(): never {
  throw new RangeError(auditPersistenceSequenceErrorMessage);
}

function invalidEventSortKey(): never {
  throw new RangeError(auditPersistenceEventSortKeyErrorMessage);
}

function isCanonicalKeySegment(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('#') &&
    !controlCharacterPattern.test(value)
  );
}

function assertCanonicalKeySegment(value: unknown): asserts value is string {
  if (!isCanonicalKeySegment(value)) {
    invalidKeySegment();
  }
}

function readContextSegment(
  context: AuditWriteContext,
  field: 'tenantId' | 'pharmacyId',
): string {
  if (typeof context !== 'object' || context === null) {
    return invalidKeySegment();
  }

  const descriptor = Object.getOwnPropertyDescriptor(context, field);
  if (descriptor === undefined || !('value' in descriptor)) {
    return invalidKeySegment();
  }

  const value: unknown = descriptor.value;
  assertCanonicalKeySegment(value);
  return value;
}

function assertSequenceNumber(value: unknown): asserts value is bigint {
  if (typeof value !== 'bigint' || value < 1n || value > AUDIT_SEQUENCE_MAX) {
    invalidSequenceNumber();
  }
}

function persistenceKey(PK: string, SK: string): AuditPersistenceKey {
  return Object.freeze({ PK, SK });
}

export function encodeAuditSequenceNumberDecimal(sequenceNumber: bigint): string {
  assertSequenceNumber(sequenceNumber);
  return sequenceNumber.toString(10);
}

export function decodeAuditSequenceNumberDecimal(value: unknown): bigint {
  if (
    typeof value !== 'string' ||
    !auditSequenceDecimalPattern.test(value) ||
    value.length > AUDIT_SEQUENCE_WIDTH
  ) {
    return invalidSequenceNumber();
  }

  const sequenceNumber = BigInt(value);
  assertSequenceNumber(sequenceNumber);
  if (encodeAuditSequenceNumberDecimal(sequenceNumber) !== value) {
    return invalidSequenceNumber();
  }
  return sequenceNumber;
}

export function encodeAuditSequenceSortSegment(sequenceNumber: bigint): string {
  assertSequenceNumber(sequenceNumber);
  return sequenceNumber.toString(10).padStart(AUDIT_SEQUENCE_WIDTH, '0');
}

export function buildAuditChainScope(context: AuditWriteContext): string {
  const tenant = readContextSegment(context, 'tenantId');
  const pharmacy = readContextSegment(context, 'pharmacyId');
  return `TENANT#${tenant}#PHARMACY#${pharmacy}#AUDIT#CHAIN#CLOUD`;
}

export function buildAuditEventKey(
  context: AuditWriteContext,
  sequenceNumber: bigint,
  auditEventId: EventId,
): AuditPersistenceKey {
  assertCanonicalKeySegment(auditEventId);
  return persistenceKey(
    buildAuditChainScope(context),
    `${auditEventSortKeyPrefix}${encodeAuditSequenceSortSegment(sequenceNumber)}${auditEventSortKeyMarker}${auditEventId}`,
  );
}

export function buildAuditDedupeKey(
  context: AuditWriteContext,
  auditEventId: EventId,
): AuditPersistenceKey {
  assertCanonicalKeySegment(auditEventId);
  return persistenceKey(buildAuditChainScope(context), `DEDUPE#EVENT#${auditEventId}`);
}

export function buildAuditTipKey(context: AuditWriteContext): AuditPersistenceKey {
  return persistenceKey(buildAuditChainScope(context), 'TIP');
}

export function parseAuditEventSortKey(value: unknown): ParsedAuditEventSortKey {
  if (typeof value !== 'string' || !value.startsWith(auditEventSortKeyPrefix)) {
    return invalidEventSortKey();
  }

  const sequenceStart = auditEventSortKeyPrefix.length;
  const sequenceEnd = sequenceStart + AUDIT_SEQUENCE_WIDTH;
  const sequenceSegment = value.slice(sequenceStart, sequenceEnd);
  if (
    !auditSequenceSortSegmentPattern.test(sequenceSegment) ||
    value.slice(sequenceEnd, sequenceEnd + auditEventSortKeyMarker.length) !== auditEventSortKeyMarker
  ) {
    return invalidEventSortKey();
  }

  const rawEventId = value.slice(sequenceEnd + auditEventSortKeyMarker.length);
  if (!isCanonicalKeySegment(rawEventId)) {
    return invalidEventSortKey();
  }

  const sequenceNumber = BigInt(sequenceSegment);
  if (sequenceNumber < 1n || sequenceNumber > AUDIT_SEQUENCE_MAX) {
    return invalidEventSortKey();
  }

  const parsedEventId = eventId(rawEventId);
  const rebuilt = `${auditEventSortKeyPrefix}${encodeAuditSequenceSortSegment(sequenceNumber)}${auditEventSortKeyMarker}${parsedEventId}`;
  if (rebuilt !== value) {
    return invalidEventSortKey();
  }

  return Object.freeze({
    sequenceNumber,
    sequenceNumberDecimal: encodeAuditSequenceNumberDecimal(sequenceNumber),
    eventId: parsedEventId,
  });
}
