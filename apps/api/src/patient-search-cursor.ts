import { createHmac, timingSafeEqual } from 'node:crypto';
import { PATIENT_SEARCH_CURSOR_MAX_LENGTH } from '@yrese/contracts';
import type { PharmacyId, TenantId } from '@yrese/shared-kernel';

import type { PatientSearchCursor } from './patient-repository.js';

export const patientSearchCursorSchemaVersion = 1 as const;
export const patientSearchCursorHmacKeyByteLength = 32;

const hmacDomain = 'yrese.patient-search.cursor';
const hmacByteLength = 32;
const base64UrlSha256Length = 43;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

interface EncodedPatientSearchCursor {
  readonly v: typeof patientSearchCursorSchemaVersion;
  readonly o: number;
  readonly m: string;
}

export interface PatientSearchCursorBinding {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
}

export interface PatientSearchCursorCodec {
  encode(binding: PatientSearchCursorBinding, cursor: PatientSearchCursor): string;
  decode(binding: PatientSearchCursorBinding, value: string): PatientSearchCursor | undefined;
}

function assertSafeOffset(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('patient search cursor offset must be a non-negative safe integer');
  }
}

function updateLengthPrefixed(hmac: ReturnType<typeof createHmac>, value: string): void {
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length, 0);
  hmac.update(length);
  hmac.update(bytes);
}

function computeMac(
  key: Buffer,
  binding: PatientSearchCursorBinding,
  offset: number,
): Buffer {
  const hmac = createHmac('sha256', key);
  for (const value of [
    hmacDomain,
    String(patientSearchCursorSchemaVersion),
    binding.tenantId,
    binding.pharmacyId,
    binding.q,
    String(offset),
  ]) {
    updateLengthPrefixed(hmac, value);
  }
  return hmac.digest();
}

function isExactEncodedCursor(value: unknown): value is EncodedPatientSearchCursor {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 3 ||
    keys[0] !== 'v' ||
    keys[1] !== 'o' ||
    keys[2] !== 'm'
  ) {
    return false;
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }

  const cursor = value as Partial<EncodedPatientSearchCursor>;
  return (
    cursor.v === patientSearchCursorSchemaVersion &&
    Number.isSafeInteger(cursor.o) &&
    cursor.o !== undefined &&
    cursor.o >= 0 &&
    typeof cursor.m === 'string' &&
    cursor.m.length === base64UrlSha256Length &&
    base64UrlPattern.test(cursor.m)
  );
}

function decodeCanonicalToken(value: string): EncodedPatientSearchCursor | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > PATIENT_SEARCH_CURSOR_MAX_LENGTH ||
    !base64UrlPattern.test(value)
  ) {
    return undefined;
  }

  let bytes: Buffer;
  let decodedText: string;
  let decoded: unknown;
  try {
    bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) {
      return undefined;
    }
    decodedText = bytes.toString('utf8');
    if (!Buffer.from(decodedText, 'utf8').equals(bytes)) {
      return undefined;
    }
    decoded = JSON.parse(decodedText) as unknown;
  } catch {
    return undefined;
  }

  if (!isExactEncodedCursor(decoded)) {
    return undefined;
  }

  const canonicalText = JSON.stringify({ v: decoded.v, o: decoded.o, m: decoded.m });
  return canonicalText === decodedText ? decoded : undefined;
}

export function createPatientSearchCursorCodec(
  hmacKey: Uint8Array,
): PatientSearchCursorCodec {
  if (!(hmacKey instanceof Uint8Array) || hmacKey.byteLength !== patientSearchCursorHmacKeyByteLength) {
    throw new RangeError('patient search cursor HMAC key must be 32 bytes');
  }
  const key = Buffer.from(hmacKey);

  return Object.freeze({
    encode(binding: PatientSearchCursorBinding, cursor: PatientSearchCursor): string {
      assertSafeOffset(cursor.offset);
      const mac = computeMac(key, binding, cursor.offset).toString('base64url');
      return Buffer.from(
        JSON.stringify({ v: patientSearchCursorSchemaVersion, o: cursor.offset, m: mac }),
        'utf8',
      ).toString('base64url');
    },

    decode(binding: PatientSearchCursorBinding, value: string): PatientSearchCursor | undefined {
      const decoded = decodeCanonicalToken(value);
      if (decoded === undefined) {
        return undefined;
      }

      const actualMac = Buffer.from(decoded.m, 'base64url');
      if (
        actualMac.byteLength !== hmacByteLength ||
        actualMac.toString('base64url') !== decoded.m
      ) {
        return undefined;
      }
      const expectedMac = computeMac(key, binding, decoded.o);
      if (!timingSafeEqual(actualMac, expectedMac)) {
        return undefined;
      }

      return Object.freeze({ offset: decoded.o });
    },
  });
}
