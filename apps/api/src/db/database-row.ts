import { isProxy } from 'node:util/types';

export function readDatabaseRowOwnDataProperty(
  row: unknown,
  property: PropertyKey,
  errorMessage: string,
): unknown {
  if ((typeof row !== 'object' && typeof row !== 'function') || row === null || isProxy(row)) {
    throw new Error(errorMessage);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(row, property);
  } catch {
    throw new Error(errorMessage);
  }
  if (descriptor === undefined || !('value' in descriptor)) {
    throw new Error(errorMessage);
  }
  return descriptor.value;
}
