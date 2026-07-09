export const defaultApiPort = 3001;

const decimalIntegerPattern = /^(0|[1-9]\d*)$/;

export function parseApiPort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return defaultApiPort;
  }

  const normalizedValue = value.trim();
  if (!decimalIntegerPattern.test(normalizedValue)) {
    return defaultApiPort;
  }

  const port = Number.parseInt(normalizedValue, 10);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return defaultApiPort;
  }

  return port;
}
