import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
  patientSearchCursorSchemaVersion,
  type PatientSearchCursorBinding,
} from './patient-search-cursor.js';

function syntheticBinding(overrides: Partial<PatientSearchCursorBinding> = {}): PatientSearchCursorBinding {
  return {
    tenantId: tenantId('tenant-synthetic-001'),
    pharmacyId: pharmacyId('pharmacy-synthetic-001'),
    q: '合成検索',
    ...overrides,
  };
}

function encodeTokenBody(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeTokenBody(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function makeNonCanonicalBase64Url(value: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = value.at(-1);
  if (last === undefined) {
    throw new Error('test value must not be empty');
  }
  const index = alphabet.indexOf(last);
  if (index < 0 || index % 4 !== 0) {
    throw new Error('test value must have canonical SHA-256 base64url tail bits');
  }
  return `${value.slice(0, -1)}${alphabet[index + 1]}`;
}

describe('patient search cursor HMAC codec', () => {
  it('round-trips across codec instances with the same process-generated key', () => {
    const key = randomBytes(patientSearchCursorHmacKeyByteLength);
    const issuer = createPatientSearchCursorCodec(key);
    const verifier = createPatientSearchCursorCodec(key);
    const binding = syntheticBinding();

    const token = issuer.encode(binding, { offset: 42 });

    expect(verifier.decode(binding, token)).toEqual({ offset: 42 });
  });

  it('emits only the exact canonical v/o/m token body without query or scope values', () => {
    const codec = createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength));
    const binding = syntheticBinding();
    const token = codec.encode(binding, { offset: 3 });
    const body = decodeTokenBody(token);

    expect(Object.keys(body)).toEqual(['v', 'o', 'm']);
    expect(body).toMatchObject({ v: patientSearchCursorSchemaVersion, o: 3 });
    expect(body.m).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.length).toBeLessThanOrEqual(512);
    expect(JSON.stringify(body)).not.toContain(binding.q);
    expect(JSON.stringify(body)).not.toContain(binding.tenantId);
    expect(JSON.stringify(body)).not.toContain(binding.pharmacyId);
    expect(JSON.stringify(body)).not.toContain('qh');
    expect(JSON.stringify(body)).not.toContain(
      createHash('sha256').update(binding.q, 'utf8').digest('hex'),
    );
  });

  it('binds the MAC to key, tenant, pharmacy, query, and offset without concatenation ambiguity', () => {
    const key = randomBytes(patientSearchCursorHmacKeyByteLength);
    const codec = createPatientSearchCursorCodec(key);
    const binding = syntheticBinding();
    const token = codec.encode(binding, { offset: 7 });

    expect(
      createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength)).decode(binding, token),
    ).toBeUndefined();
    expect(codec.decode(syntheticBinding({ tenantId: tenantId('tenant-synthetic-002') }), token)).toBeUndefined();
    expect(
      codec.decode(syntheticBinding({ pharmacyId: pharmacyId('pharmacy-synthetic-002') }), token),
    ).toBeUndefined();
    expect(codec.decode(syntheticBinding({ q: '別の検索' }), token)).toBeUndefined();

    const first = syntheticBinding({
      tenantId: tenantId('scope-a'),
      pharmacyId: pharmacyId('scope-bc'),
    });
    const concatenationCollision = syntheticBinding({
      tenantId: tenantId('scope-ab'),
      pharmacyId: pharmacyId('scope-c'),
    });
    const collisionToken = codec.encode(first, { offset: 7 });
    expect(codec.decode(concatenationCollision, collisionToken)).toBeUndefined();
  });

  it('rejects offset, MAC, version, extra-key, and non-canonical token mutations', () => {
    const codec = createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength));
    const binding = syntheticBinding();
    const token = codec.encode(binding, { offset: 8 });
    const body = decodeTokenBody(token);
    const mac = body.m as string;
    const nonCanonicalMac = makeNonCanonicalBase64Url(mac);
    expect(Buffer.from(nonCanonicalMac, 'base64url')).toEqual(Buffer.from(mac, 'base64url'));

    const mutations = [
      encodeTokenBody({ v: body.v, o: 999, m: mac }),
      encodeTokenBody({ v: body.v, o: body.o, m: `${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}` }),
      encodeTokenBody({ v: 2, o: body.o, m: mac }),
      encodeTokenBody({ v: body.v, o: body.o, m: mac, extra: true }),
      encodeTokenBody({ o: body.o, v: body.v, m: mac }),
      Buffer.from(`{ "v":1,"o":8,"m":"${mac}"}`, 'utf8').toString('base64url'),
      encodeTokenBody({ v: body.v, o: body.o, m: nonCanonicalMac }),
    ];

    for (const mutation of mutations) {
      expect(codec.decode(binding, mutation)).toBeUndefined();
    }
  });

  it('rejects malformed, oversized, padded, invalid-offset, and legacy unsigned tokens', () => {
    const codec = createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength));
    const binding = syntheticBinding();
    const valid = codec.encode(binding, { offset: 1 });
    const mac = decodeTokenBody(valid).m;
    const invalidTokens = [
      '',
      'not+base64url',
      `${valid}=`,
      'x'.repeat(513),
      encodeTokenBody({ v: 1, o: -1, m: mac }),
      encodeTokenBody({ v: 1, o: 1.5, m: mac }),
      encodeTokenBody({ v: 1, o: Number.MAX_SAFE_INTEGER + 1, m: mac }),
      Buffer.from(`{"v":1,"o":-0,"m":"${String(mac)}"}`, 'utf8').toString('base64url'),
      Buffer.from(`{"v":1,"o":1e2,"m":"${String(mac)}"}`, 'utf8').toString('base64url'),
      encodeTokenBody({ v: 1, o: '1', m: mac }),
      encodeTokenBody({ v: 1, o: 1, m: 'short' }),
      encodeTokenBody({ t: 'tenant-synthetic-001', p: 'pharmacy-synthetic-001', qh: '0'.repeat(64), offset: 1 }),
    ];

    for (const invalidToken of invalidTokens) {
      expect(codec.decode(binding, invalidToken)).toBeUndefined();
    }
  });

  it('accepts the maximum safe offset but refuses invalid encode inputs and key sizes', () => {
    const codec = createPatientSearchCursorCodec(randomBytes(patientSearchCursorHmacKeyByteLength));
    const binding = syntheticBinding();
    const token = codec.encode(binding, { offset: Number.MAX_SAFE_INTEGER });

    expect(codec.decode(binding, token)).toEqual({ offset: Number.MAX_SAFE_INTEGER });
    for (const offset of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => codec.encode(binding, { offset })).toThrow(/offset/);
    }
    expect(() => createPatientSearchCursorCodec(randomBytes(31))).toThrow(/32 bytes/);
    expect(() => createPatientSearchCursorCodec(randomBytes(33))).toThrow(/32 bytes/);
  });
});
