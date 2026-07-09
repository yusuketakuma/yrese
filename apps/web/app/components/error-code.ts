import { createKernelErrorCodeRegistry, isValidErrorCode } from "@yrese/shared-kernel";

const errorCodeRegistry = createKernelErrorCodeRegistry();

export function registeredErrorCodeOrUndefined(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !isValidErrorCode(raw)) {
    return undefined;
  }
  return errorCodeRegistry.get(raw) !== undefined ? raw : undefined;
}
