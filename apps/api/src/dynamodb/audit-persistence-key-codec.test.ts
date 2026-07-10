import { describe, expect, it } from 'vitest';
import type { AuditWriteContext } from '@yrese/audit';
import { eventId, pharmacyId, tenantId, userId, type EventId } from '@yrese/shared-kernel';

import {
  AUDIT_SEQUENCE_MAX,
  AUDIT_SEQUENCE_WIDTH,
  buildAuditChainScope,
  buildAuditDedupeKey,
  buildAuditEventKey,
  buildAuditTipKey,
  decodeAuditSequenceNumberDecimal,
  encodeAuditSequenceNumberDecimal,
  encodeAuditSequenceSortSegment,
  parseAuditEventSortKey,
} from './audit-persistence-key-codec.js';

const invalidKeySegmentMessage = 'Invalid audit persistence key segment';
const invalidSequenceMessage = 'Invalid audit persistence sequence number';
const invalidEventSortKeyMessage = 'Invalid audit persistence event sort key';

function syntheticContext(overrides: Partial<AuditWriteContext> = {}): AuditWriteContext {
  return {
    tenantId: tenantId('tenant-synthetic-001'),
    pharmacyId: pharmacyId('pharmacy-synthetic-001'),
    actorId: userId('actor-synthetic-001'),
    ...overrides,
  };
}

const syntheticEventId = eventId('event-synthetic-001');
const expectedChainScope =
  'TENANT#tenant-synthetic-001#PHARMACY#pharmacy-synthetic-001#AUDIT#CHAIN#CLOUD';

describe('audit persistence sequence codec', () => {
  it.each([
    [1n, '1', '00000000000000000001'],
    [9n, '9', '00000000000000000009'],
    [10n, '10', '00000000000000000010'],
    [AUDIT_SEQUENCE_MAX, '18446744073709551615', '18446744073709551615'],
  ] as const)('round-trips canonical sequence %s', (sequenceNumber, decimal, sortSegment) => {
    expect(encodeAuditSequenceNumberDecimal(sequenceNumber)).toBe(decimal);
    expect(decodeAuditSequenceNumberDecimal(decimal)).toBe(sequenceNumber);
    expect(encodeAuditSequenceSortSegment(sequenceNumber)).toBe(sortSegment);
    expect(sortSegment).toHaveLength(AUDIT_SEQUENCE_WIDTH);
  });

  it('keeps lexicographic and numeric sequence order identical', () => {
    const sequenceNumbers = [1n, 2n, 9n, 10n, 99n, 100n, AUDIT_SEQUENCE_MAX];
    const encoded = sequenceNumbers.map(encodeAuditSequenceSortSegment);

    expect(AUDIT_SEQUENCE_MAX.toString(10)).toHaveLength(AUDIT_SEQUENCE_WIDTH);
    expect([...encoded].sort()).toEqual(encoded);
  });

  it.each([0n, -1n, AUDIT_SEQUENCE_MAX + 1n])(
    'rejects out-of-range bigint %s before key construction',
    (value) => {
      expect(() => encodeAuditSequenceNumberDecimal(value)).toThrow(invalidSequenceMessage);
      expect(() => encodeAuditSequenceSortSegment(value)).toThrow(invalidSequenceMessage);
    },
  );

  it.each([1, '1', null, undefined, {}, Number.NaN])(
    'rejects non-bigint encode input %j with a fixed error',
    (value) => {
      expect(() => encodeAuditSequenceNumberDecimal(value as unknown as bigint)).toThrow(
        invalidSequenceMessage,
      );
      expect(() => encodeAuditSequenceSortSegment(value as unknown as bigint)).toThrow(
        invalidSequenceMessage,
      );
      expect(() =>
        buildAuditEventKey(syntheticContext(), value as unknown as bigint, syntheticEventId),
      ).toThrow(invalidSequenceMessage);
    },
  );

  it.each([
    '',
    '0',
    '-1',
    '+1',
    '01',
    ' 1',
    '1 ',
    '1e1',
    '１',
    '18446744073709551616',
    '99999999999999999999',
    '1'.repeat(21),
  ])('rejects noncanonical or out-of-range decimal %j', (value) => {
    expect(() => decodeAuditSequenceNumberDecimal(value)).toThrow(invalidSequenceMessage);
  });
});

describe('audit persistence key construction', () => {
  it('pins the exact synthetic chain, event, dedupe, and tip keys', () => {
    const context = syntheticContext();
    const eventKey = buildAuditEventKey(context, 1n, syntheticEventId);
    const dedupeKey = buildAuditDedupeKey(context, syntheticEventId);
    const tipKey = buildAuditTipKey(context);

    expect(buildAuditChainScope(context)).toBe(expectedChainScope);
    expect(eventKey).toEqual({
      PK: expectedChainScope,
      SK: 'SEQ#00000000000000000001#EVENT#event-synthetic-001',
    });
    expect(dedupeKey).toEqual({
      PK: expectedChainScope,
      SK: 'DEDUPE#EVENT#event-synthetic-001',
    });
    expect(tipKey).toEqual({ PK: expectedChainScope, SK: 'TIP' });
    expect(new Set([eventKey.PK, dedupeKey.PK, tipKey.PK])).toEqual(
      new Set([expectedChainScope]),
    );
    expect(new Set([eventKey.SK, dedupeKey.SK, tipKey.SK]).size).toBe(3);
    expect([eventKey.SK, dedupeKey.SK, tipKey.SK].sort()).toEqual([
      dedupeKey.SK,
      eventKey.SK,
      tipKey.SK,
    ]);
    expect(buildAuditEventKey(context, AUDIT_SEQUENCE_MAX, syntheticEventId)).toEqual({
      PK: expectedChainScope,
      SK: 'SEQ#18446744073709551615#EVENT#event-synthetic-001',
    });
  });

  it('does not use actorId in the chain scope or keys', () => {
    const first = syntheticContext({ actorId: userId('actor-synthetic-001') });
    const second = syntheticContext({ actorId: userId('actor-synthetic-002') });

    expect(buildAuditEventKey(second, 1n, syntheticEventId)).toEqual(
      buildAuditEventKey(first, 1n, syntheticEventId),
    );
    const serializedKey = JSON.stringify(buildAuditEventKey(first, 1n, syntheticEventId));
    expect(serializedKey).not.toContain(first.actorId);
    expect(serializedKey).not.toContain('targetRef');
    expect(serializedKey).not.toContain('intentFingerprint');
  });

  it('changes the chain scope when trusted tenant or pharmacy context changes', () => {
    const original = buildAuditChainScope(syntheticContext());
    const otherTenant = buildAuditChainScope(
      syntheticContext({ tenantId: tenantId('tenant-synthetic-002') }),
    );
    const otherPharmacy = buildAuditChainScope(
      syntheticContext({ pharmacyId: pharmacyId('pharmacy-synthetic-002') }),
    );

    expect(otherTenant).not.toBe(original);
    expect(otherPharmacy).not.toBe(original);
  });

  it.each(['', ' ', '#', 'tenant#other', 't#PHARMACY#p2#AUDIT#CHAIN#CLOUD', 'value\u0000'])(
    'rejects invalid tenant key segment %j',
    (value) => {
      const context = syntheticContext({ tenantId: value as AuditWriteContext['tenantId'] });
      expect(() => buildAuditChainScope(context)).toThrow(invalidKeySegmentMessage);
    },
  );

  it.each(['', ' ', '#', 'pharmacy#other', 'value\u001f'])(
    'rejects invalid pharmacy key segment %j',
    (value) => {
      const context = syntheticContext({ pharmacyId: value as AuditWriteContext['pharmacyId'] });
      expect(() => buildAuditChainScope(context)).toThrow(invalidKeySegmentMessage);
    },
  );

  it.each(['', ' ', '#', 'event#other', 'a#EVENT#b', 'value\u007f'])(
    'rejects invalid eventId key segment %j',
    (value) => {
      expect(() => buildAuditEventKey(syntheticContext(), 1n, value as EventId)).toThrow(
        invalidKeySegmentMessage,
      );
      expect(() => buildAuditDedupeKey(syntheticContext(), value as EventId)).toThrow(
        invalidKeySegmentMessage,
      );
    },
  );

  it.each([null, undefined, 1, {}, []])('rejects wrong-type tenant values %j', (value) => {
    const context = syntheticContext({
      tenantId: value as unknown as AuditWriteContext['tenantId'],
    });
    expect(() => buildAuditChainScope(context)).toThrow(invalidKeySegmentMessage);
  });

  it('rejects malformed context objects without reading actorId', () => {
    const actorAccessor = () => {
      throw new Error('actor-accessor-must-not-run');
    };
    const context = syntheticContext();
    Object.defineProperty(context, 'actorId', { enumerable: true, get: actorAccessor });

    expect(buildAuditChainScope(context)).toBe(expectedChainScope);
    expect(() => buildAuditChainScope(null as unknown as AuditWriteContext)).toThrow(
      invalidKeySegmentMessage,
    );
  });

  it('never echoes rejected key segments in errors', () => {
    const attackerValue = 'attacker-private-value#segment';

    try {
      buildAuditDedupeKey(syntheticContext(), attackerValue as EventId);
      throw new Error('expected key segment rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe(invalidKeySegmentMessage);
      expect((error as Error).message).not.toContain(attackerValue);
    }
  });

  it('never echoes rejected sequence values in errors', () => {
    const attackerValue = '99999999999999999999';

    try {
      decodeAuditSequenceNumberDecimal(attackerValue);
      throw new Error('expected sequence rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe(invalidSequenceMessage);
      expect((error as Error).message).not.toContain(attackerValue);
    }
  });
});

describe('audit event sort key parsing', () => {
  it('strictly parses and byte-rebuilds the golden event sort key', () => {
    const sortKey = buildAuditEventKey(syntheticContext(), 1n, syntheticEventId).SK;
    const parsed = parseAuditEventSortKey(sortKey);

    expect(parsed).toEqual({
      sequenceNumber: 1n,
      sequenceNumberDecimal: '1',
      eventId: syntheticEventId,
    });
    expect(buildAuditEventKey(syntheticContext(), parsed.sequenceNumber, parsed.eventId).SK).toBe(
      sortKey,
    );
  });

  it.each([
    'SEQ#00000000000000000000#EVENT#event-synthetic-001',
    'SEQ#18446744073709551616#EVENT#event-synthetic-001',
    'SEQ#99999999999999999999#EVENT#event-synthetic-001',
    'SEQ#0000000000000000001#EVENT#event-synthetic-001',
    'SEQ#000000000000000000001#EVENT#event-synthetic-001',
    'SEQ#00000000000000000001#EVENT#',
    'SEQ#00000000000000000001#EVENT#event#synthetic',
    'SEQ#00000000000000000001#EVENT#event\u0000synthetic',
    'SEQ#00000000000000000001#event#event-synthetic-001',
    'SEQUENCE#00000000000000000001#EVENT#event-synthetic-001',
    '00000000000000000001',
    '',
  ])('rejects malformed event sort key %j', (value) => {
    expect(() => parseAuditEventSortKey(value)).toThrow(invalidEventSortKeyMessage);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 1],
    ['bigint', 1n],
    ['object', {}],
    ['array', []],
  ] as const)('rejects non-string event sort key: %s', (_label, value) => {
    expect(() => parseAuditEventSortKey(value)).toThrow(invalidEventSortKeyMessage);
  });

  it('never echoes a rejected sort key in errors', () => {
    const attackerValue = 'SEQ#00000000000000000001#EVENT#attacker-private#value';

    try {
      parseAuditEventSortKey(attackerValue);
      throw new Error('expected event sort key rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe(invalidEventSortKeyMessage);
      expect((error as Error).message).not.toContain(attackerValue);
    }
  });
});
