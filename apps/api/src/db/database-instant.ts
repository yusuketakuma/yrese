import { isDate } from 'node:util/types';

function invalidTimestamp(errorMessage: string): never {
  throw new Error(errorMessage);
}

export function snapshotDateInstant(value: unknown, errorMessage: string): string {
  if (!isDate(value)) {
    return invalidTimestamp(errorMessage);
  }
  try {
    return Date.prototype.toISOString.call(value);
  } catch {
    return invalidTimestamp(errorMessage);
  }
}

export function snapshotDatabaseInstant(value: unknown, errorMessage: string): string {
  if (isDate(value)) {
    return snapshotDateInstant(value, errorMessage);
  }
  if (typeof value !== 'string') {
    return invalidTimestamp(errorMessage);
  }
  try {
    return Date.prototype.toISOString.call(new Date(value));
  } catch {
    return invalidTimestamp(errorMessage);
  }
}
