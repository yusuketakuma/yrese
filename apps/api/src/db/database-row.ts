import { isProxy } from 'node:util/types';

import { readOwnDataProperty } from '../own-data-property.js';

export function readDatabaseRowOwnDataProperty(
  row: unknown,
  property: PropertyKey,
  errorMessage: string,
): unknown {
  const result = readOwnDataProperty(row, property, errorMessage);
  if (!result.present) {
    throw new Error(errorMessage);
  }
  return result.value;
}

export function snapshotDatabaseQueryRows<T>(
  queryResult: unknown,
  maximumRows: number,
  errorMessage: string,
): readonly T[] {
  if (!Number.isSafeInteger(maximumRows) || maximumRows < 0) {
    throw new Error(errorMessage);
  }
  const rows = readDatabaseRowOwnDataProperty(queryResult, 'rows', errorMessage);
  if (isProxy(rows) || !Array.isArray(rows)) {
    throw new Error(errorMessage);
  }
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(rows, 'length');
  } catch {
    throw new Error(errorMessage);
  }
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximumRows) {
    throw new Error(errorMessage);
  }
  const snapshot: T[] = [];
  for (let index = 0; index < length; index += 1) {
    snapshot.push(
      readDatabaseRowOwnDataProperty(rows, String(index), errorMessage) as T,
    );
  }
  return Object.freeze(snapshot);
}
