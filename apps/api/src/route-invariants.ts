import { isDate, isProxy } from 'node:util/types';

import type { onRequestHookHandler } from 'fastify';
import { hydrateAuditEvent, type AuditEvent } from '@yrese/audit';

type OwnDataPropertySnapshot =
  | { readonly present: false }
  | { readonly present: true; readonly value: unknown };

export function readOwnEnumerableDataProperty(
  value: unknown,
  key: string,
  invariantErrorMessage: string,
): OwnDataPropertySnapshot {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(invariantErrorMessage);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return Object.freeze({ present: false });
    if (descriptor.enumerable !== true || !('value' in descriptor)) {
      throw new Error(invariantErrorMessage);
    }
    return Object.freeze({ present: true, value: descriptor.value });
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export function readRequiredOwnEnumerableDataProperty(
  value: unknown,
  key: string,
  invariantErrorMessage: string,
): unknown {
  const property = readOwnEnumerableDataProperty(value, key, invariantErrorMessage);
  if (!property.present) throw new Error(invariantErrorMessage);
  return property.value;
}

export function assertRecordedAuditMatchesIntent(
  value: unknown,
  expected: {
    readonly tenantId: string;
    readonly pharmacyId: string;
    readonly actorId: string;
    readonly auditEventType: string;
    readonly targetRef: { readonly kind: string; readonly id: string };
    readonly outcome: string;
    readonly wallClock: string;
  },
  invariantErrorMessage: string,
): void {
  let event: AuditEvent;
  try {
    event = hydrateAuditEvent(value);
  } catch {
    throw new Error(invariantErrorMessage);
  }

  if (
    event.tenantId !== expected.tenantId ||
    event.pharmacyId !== expected.pharmacyId ||
    event.actorId !== expected.actorId ||
    event.auditEventType !== expected.auditEventType ||
    event.targetRef.kind !== expected.targetRef.kind ||
    event.targetRef.id !== expected.targetRef.id ||
    event.outcome !== expected.outcome ||
    event.wallClock !== expected.wallClock ||
    event.aggregateType !== expected.targetRef.kind ||
    event.aggregateId !== expected.targetRef.id ||
    event.reasonCode !== undefined ||
    event.businessReason !== undefined
  ) {
    throw new Error(invariantErrorMessage);
  }
}

export function snapshotWallClock(
  now: () => Date,
  readErrorMessage: string,
  invariantErrorMessage: string,
): string {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw new Error(readErrorMessage);
  }
  if (!isDate(value)) {
    throw new Error(invariantErrorMessage);
  }
  try {
    return Date.prototype.toISOString.call(value);
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export function snapshotDenseArray(
  value: unknown,
  invariantErrorMessage: string,
  maximum?: { readonly length: number; readonly errorMessage: string },
): readonly unknown[] {
  let arrayLength: number;
  try {
    if (isProxy(value) || !Array.isArray(value)) throw new Error(invariantErrorMessage);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      throw new Error(invariantErrorMessage);
    }
    arrayLength = lengthDescriptor.value;
  } catch {
    throw new Error(invariantErrorMessage);
  }

  if (maximum !== undefined && arrayLength > maximum.length) {
    throw new Error(maximum.errorMessage);
  }

  try {
    const snapshot: unknown[] = [];
    for (let index = 0; index < arrayLength; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor)
      ) {
        throw new Error(invariantErrorMessage);
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export const setSensitiveResponseNoStore: onRequestHookHandler = async (_request, reply) => {
  reply.header('Cache-Control', 'no-store');
};
