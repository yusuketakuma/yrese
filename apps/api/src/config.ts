import type { TenantContextMode } from './plugins/tenant-context.js';

export const defaultApiPort = 3001;
export const apiRepositoryModes = ['postgres', 'in_memory'] as const;
export const devTenantContextConfigurationErrorMessage =
  'DEV tenant context headers require exact opt-in for an in-memory development or test server';

export type ApiRepositoryMode = (typeof apiRepositoryModes)[number];

const decimalIntegerPattern = /^(0|[1-9]\d*)$/;

export function parseApiPort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return defaultApiPort;
  }

  const normalizedValue = value.trim();
  if (!decimalIntegerPattern.test(normalizedValue)) {
    throw new RangeError('PORT must be a decimal integer between 1 and 65535');
  }

  const port = Number.parseInt(normalizedValue, 10);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('PORT must be a decimal integer between 1 and 65535');
  }

  return port;
}

export function parseDatabaseUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const normalizedValue = value.trim();
  let url: URL;
  try {
    url = new URL(normalizedValue);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  return normalizedValue;
}

function parseExplicitRepositoryMode(value: string | undefined): ApiRepositoryMode | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!apiRepositoryModes.includes(normalizedValue as ApiRepositoryMode)) {
    throw new Error('YRESE_API_REPOSITORY_MODE must be postgres or in_memory');
  }

  return normalizedValue as ApiRepositoryMode;
}

export function resolveApiRepositoryMode(input: {
  readonly repositoryMode: string | undefined;
  readonly databaseUrl: string | undefined;
  readonly nodeEnv: string | undefined;
}): ApiRepositoryMode {
  const explicitMode = parseExplicitRepositoryMode(input.repositoryMode);

  if (explicitMode === 'in_memory' && input.nodeEnv === 'production') {
    throw new Error('YRESE_API_REPOSITORY_MODE=in_memory is not allowed in production');
  }

  if (input.databaseUrl !== undefined) {
    if (explicitMode === 'in_memory') {
      throw new Error('YRESE_API_REPOSITORY_MODE=in_memory cannot be used with DATABASE_URL');
    }
    return 'postgres';
  }

  if (explicitMode === 'in_memory') {
    return 'in_memory';
  }

  if (explicitMode === 'postgres') {
    throw new Error('DATABASE_URL is required when YRESE_API_REPOSITORY_MODE=postgres');
  }

  throw new Error('DATABASE_URL is required unless YRESE_API_REPOSITORY_MODE=in_memory is explicit');
}

export function resolveTenantContextMode(input: {
  readonly allowDevTenantStub: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly repositoryMode: ApiRepositoryMode;
  readonly databaseUrl: string | undefined;
}): TenantContextMode {
  if (input.allowDevTenantStub === undefined || input.allowDevTenantStub === 'false') {
    return 'disabled';
  }

  if (
    input.allowDevTenantStub !== 'true' ||
    (input.nodeEnv !== 'development' && input.nodeEnv !== 'test') ||
    input.repositoryMode !== 'in_memory' ||
    input.databaseUrl !== undefined
  ) {
    throw new Error(devTenantContextConfigurationErrorMessage);
  }

  return 'dev_headers';
}
