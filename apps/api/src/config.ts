import type { TenantContextMode } from './plugins/tenant-context.js';

export const defaultApiPort = 3001;
export const apiRepositoryModes = ['postgres', 'in_memory'] as const;
export const devTenantContextConfigurationErrorMessage =
  'DEV tenant context headers require exact opt-in for an in-memory development or test server';
export const patientSearchCursorHmacConfigurationErrorMessage =
  'Patient search cursor HMAC key configuration is invalid';
export const postgresCompositionConfigurationErrorMessage =
  'Postgres repository mode requires an explicit receptionCreateCommand (in-memory composition would lose transactional atomicity)';

export type ApiRepositoryMode = (typeof apiRepositoryModes)[number];

export interface DbPoolConfiguration {
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
  readonly maxLifetimeSeconds: number;
}

export const defaultDbPoolConfiguration: DbPoolConfiguration = Object.freeze({
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  // Preserve the previous unlimited lifetime until deployment-specific connection
  // churn and Aurora failover behavior are measured. Operators may opt in explicitly.
  maxLifetimeSeconds: 0,
});

export type PatientSearchCursorHmacKeyResolution =
  | {
      readonly kind: 'configured';
      readonly key: Uint8Array;
    }
  | {
      readonly kind: 'ephemeral';
    };

const decimalIntegerPattern = /^(0|[1-9]\d*)$/;

function parseBoundedDecimalInteger(input: {
  readonly value: string | undefined;
  readonly defaultValue: number;
  readonly variableName: string;
  readonly minimum: number;
  readonly maximum: number;
}): number {
  if (input.value === undefined) return input.defaultValue;

  const normalizedValue = input.value.trim();
  if (!decimalIntegerPattern.test(normalizedValue)) {
    throw new RangeError(
      `${input.variableName} must be a decimal integer between ${input.minimum} and ${input.maximum}`,
    );
  }

  const parsed = Number.parseInt(normalizedValue, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < input.minimum ||
    parsed > input.maximum
  ) {
    throw new RangeError(
      `${input.variableName} must be a decimal integer between ${input.minimum} and ${input.maximum}`,
    );
  }
  return parsed;
}

export function resolveDbPoolConfiguration(input: {
  readonly max: string | undefined;
  readonly idleTimeoutMillis: string | undefined;
  readonly connectionTimeoutMillis: string | undefined;
  readonly maxLifetimeSeconds: string | undefined;
}): DbPoolConfiguration {
  return Object.freeze({
    max: parseBoundedDecimalInteger({
      value: input.max,
      defaultValue: defaultDbPoolConfiguration.max,
      variableName: 'YRESE_DB_POOL_MAX',
      minimum: 1,
      maximum: 100,
    }),
    idleTimeoutMillis: parseBoundedDecimalInteger({
      value: input.idleTimeoutMillis,
      defaultValue: defaultDbPoolConfiguration.idleTimeoutMillis,
      variableName: 'YRESE_DB_POOL_IDLE_TIMEOUT_MS',
      minimum: 1_000,
      maximum: 600_000,
    }),
    connectionTimeoutMillis: parseBoundedDecimalInteger({
      value: input.connectionTimeoutMillis,
      defaultValue: defaultDbPoolConfiguration.connectionTimeoutMillis,
      variableName: 'YRESE_DB_POOL_CONNECTION_TIMEOUT_MS',
      minimum: 250,
      maximum: 60_000,
    }),
    maxLifetimeSeconds: parseBoundedDecimalInteger({
      value: input.maxLifetimeSeconds,
      defaultValue: defaultDbPoolConfiguration.maxLifetimeSeconds,
      variableName: 'YRESE_DB_POOL_MAX_LIFETIME_SECONDS',
      minimum: 0,
      maximum: 86_400,
    }),
  });
}

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

export const testAuthContextConfigurationErrorMessage =
  'test-signed tenant context configuration is invalid';

/**
 * DATABASE_URL の db 名が test allowlist(`yrese_test*`)に一致するか。
 * URL parse 失敗・db 名欠落は許可しない(fail-closed)。
 */
export function isAllowedTestAuthDatabaseName(
  databaseUrl: string | undefined,
): boolean {
  if (databaseUrl === undefined) {
    return false;
  }
  try {
    const pathname = new URL(databaseUrl).pathname;
    const name = pathname.replace(/^\/+/, '').split('/')[0];
    return name !== undefined && /^yrese_test/u.test(name);
  } catch {
    return false;
  }
}

export function resolveTenantContextMode(input: {
  readonly allowDevTenantStub: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly repositoryMode: ApiRepositoryMode;
  readonly databaseUrl: string | undefined;
  /** YRESE_TEST_AUTH=1 — test_signed の明示 opt-in(SEC-009 §4 条件4)。 */
  readonly testAuth?: string | undefined;
  /** YRESE_TEST_AUTH_KEY — HMAC 鍵。未設定で test_signed 要求は拒否。 */
  readonly testAuthKey?: string | undefined;
}): TenantContextMode {
  // SEC-009 §4: test_signed は flag opt-in + 非 production + 鍵設定 +
  // postgres の場合は test db 名 allowlist、の全条件を満たす場合のみ。
  if (input.testAuth === '1' || input.testAuth === 'true') {
    if (input.nodeEnv === 'production') {
      throw new Error(testAuthContextConfigurationErrorMessage);
    }
    if (input.testAuthKey === undefined || input.testAuthKey.length === 0) {
      throw new Error(testAuthContextConfigurationErrorMessage);
    }
    if (
      input.repositoryMode === 'postgres' &&
      !isAllowedTestAuthDatabaseName(input.databaseUrl)
    ) {
      throw new Error(testAuthContextConfigurationErrorMessage);
    }
    return 'test_signed';
  }
  if (input.testAuth !== undefined && input.testAuth !== 'false' && input.testAuth !== '0') {
    throw new Error(testAuthContextConfigurationErrorMessage);
  }

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

export interface OutboxDeliveryConfiguration {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly runLimit: number;
}

export const outboxDeliveryConfigurationErrorMessage =
  'Outbox delivery runner configuration is invalid';

/**
 * WP-7103: outbox 配送 runner の構成。既定は無効。
 * 有効化は postgres かつ非 production のみ — production の外部配送は
 * BLOCKED_SECURITY_REVIEW(egress)gate 下であり、local/CI 用 sink 以外は
 * 結線しない。in_memory では durable outbox が存在しないため有効化は拒否する
 * (黙って無効化すると「配送されているはず」の誤認を生む)。
 */
export function resolveOutboxDeliveryConfiguration(input: {
  readonly enabled: string | undefined;
  readonly intervalMs: string | undefined;
  readonly runLimit: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly repositoryMode: ApiRepositoryMode;
}): OutboxDeliveryConfiguration {
  const intervalMs = parseBoundedDecimalInteger({
    value: input.intervalMs,
    defaultValue: 5_000,
    variableName: 'YRESE_OUTBOX_DELIVERY_INTERVAL_MS',
    minimum: 100,
    maximum: 600_000,
  });
  const runLimit = parseBoundedDecimalInteger({
    value: input.runLimit,
    defaultValue: 100,
    variableName: 'YRESE_OUTBOX_DELIVERY_RUN_LIMIT',
    minimum: 1,
    maximum: 1_000,
  });

  if (input.enabled === undefined || input.enabled === 'false') {
    return Object.freeze({ enabled: false, intervalMs, runLimit });
  }
  if (input.enabled !== 'true') {
    throw new Error(outboxDeliveryConfigurationErrorMessage);
  }
  if (input.repositoryMode !== 'postgres') {
    throw new Error(outboxDeliveryConfigurationErrorMessage);
  }
  if (input.nodeEnv === 'production') {
    throw new Error(outboxDeliveryConfigurationErrorMessage);
  }
  return Object.freeze({ enabled: true, intervalMs, runLimit });
}

export function resolvePatientSearchCursorHmacKey(input: {
  readonly configuredKey: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly repositoryMode: ApiRepositoryMode;
}): PatientSearchCursorHmacKeyResolution {
  if (input.configuredKey === undefined) {
    if (
      input.repositoryMode === 'in_memory' &&
      (input.nodeEnv === 'development' || input.nodeEnv === 'test')
    ) {
      return Object.freeze({ kind: 'ephemeral' });
    }
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(input.configuredKey)) {
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }

  const key = Buffer.from(input.configuredKey, 'base64url');
  if (key.byteLength !== 32 || key.toString('base64url') !== input.configuredKey) {
    throw new Error(patientSearchCursorHmacConfigurationErrorMessage);
  }

  return Object.freeze({
    kind: 'configured',
    key: Buffer.from(key),
  });
}
