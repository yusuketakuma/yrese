import { assertIsoInstant } from "@yrese/events";

function assertPlainObject(value: object, label: string): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function assertEnumerableDataProperties(value: object, label: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new TypeError(`${label} must not contain symbol keys`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label}.${key} must be an enumerable data property`);
    }
  }
}

function assertCanonicalArrayProperties(value: readonly unknown[], label: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new TypeError(`${label} must not contain symbol keys`);
    }

    if (key === "length") {
      continue;
    }

    const index = Number(key);
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= value.length ||
      String(index) !== key
    ) {
      throw new TypeError(`${label} must not contain non-index array properties`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label}[${index}] must be an enumerable data property`);
    }
  }
}

function canonicalJsonValue(value: unknown, label: string, ancestors: WeakSet<object>): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${label} must be a safe integer`);
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`${label} has an unsupported value type`);
  }

  if (value instanceof Date) {
    throw new TypeError(`${label} must normalize Date values before canonicalization`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${label} must not contain a cycle`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      assertCanonicalArrayProperties(value, label);
      const output: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new RangeError(`${label}[${index}] must not be a sparse array hole`);
        }
        const canonicalItem = canonicalJsonValue(value[index], `${label}[${index}]`, ancestors);
        if (canonicalItem === undefined) {
          throw new RangeError(`${label}[${index}] must not be undefined`);
        }
        output.push(canonicalItem);
      }
      return output;
    }

    assertPlainObject(value, label);
    assertEnumerableDataProperties(value, label);
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    // The default sort pins JSON object keys to UTF-16 code-unit order.
    for (const key of Object.keys(value).sort()) {
      const canonicalChild = canonicalJsonValue(
        (value as Record<string, unknown>)[key],
        `${label}.${key}`,
        ancestors,
      );
      if (canonicalChild !== undefined) {
        output[key] = canonicalChild;
      }
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJsonString(value: object, label: string): string {
  return JSON.stringify(canonicalJsonValue(value, label, new WeakSet<object>()));
}

export function normalizeCanonicalInstant(value: string | Date, label: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError(`${label} must be a valid Date`);
    }
    return value.toISOString();
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
  assertIsoInstant(value, label);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${label} must be a valid instant`);
  }
  return date.toISOString();
}
