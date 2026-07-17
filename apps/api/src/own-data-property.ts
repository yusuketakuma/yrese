import { isProxy } from 'node:util/types';

export type OwnDataPropertyRead =
  | { readonly present: false }
  | { readonly present: true; readonly value: unknown };

type OwnDataTarget = object | Function;

function assertOwnDataTarget(
  input: unknown,
  invariantErrorMessage: string,
): asserts input is OwnDataTarget {
  if (
    (typeof input !== 'object' && typeof input !== 'function') ||
    input === null ||
    isProxy(input)
  ) {
    throw new Error(invariantErrorMessage);
  }
}

function readGuardedOwnDataProperty(
  input: OwnDataTarget,
  property: PropertyKey,
  invariantErrorMessage: string,
): OwnDataPropertyRead {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(input, property);
  } catch {
    throw new Error(invariantErrorMessage);
  }
  if (descriptor === undefined) return { present: false };
  if (!('value' in descriptor)) {
    throw new Error(invariantErrorMessage);
  }
  return { present: true, value: descriptor.value };
}

export function readOwnDataProperty(
  input: unknown,
  property: PropertyKey,
  invariantErrorMessage: string,
): OwnDataPropertyRead {
  assertOwnDataTarget(input, invariantErrorMessage);
  return readGuardedOwnDataProperty(input, property, invariantErrorMessage);
}

export function createOwnDataPropertyReader(
  input: unknown,
  invariantErrorMessage: string,
): (property: PropertyKey) => OwnDataPropertyRead {
  assertOwnDataTarget(input, invariantErrorMessage);
  return (property: PropertyKey): OwnDataPropertyRead =>
    readGuardedOwnDataProperty(input, property, invariantErrorMessage);
}
