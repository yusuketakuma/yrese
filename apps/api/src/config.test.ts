import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  defaultApiPort,
  devTenantContextConfigurationErrorMessage,
  patientSearchCursorHmacConfigurationErrorMessage,
  parseApiPort,
  parseDatabaseUrl,
  resolveApiRepositoryMode,
  resolvePatientSearchCursorHmacKey,
  resolveTenantContextMode,
} from './config.js';

function makeNonCanonicalBase64Url(value: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = value.at(-1);
  if (last === undefined) {
    throw new Error('test value must not be empty');
  }
  const index = alphabet.indexOf(last);
  if (index < 0 || index % 4 !== 0) {
    throw new Error('test value must have canonical 32-byte base64url tail bits');
  }
  return `${value.slice(0, -1)}${alphabet[index + 1]}`;
}

describe('parseApiPort', () => {
  it('defaults when PORT is absent or blank', () => {
    for (const value of [undefined, '', '   ']) {
      expect(parseApiPort(value)).toBe(defaultApiPort);
    }
  });

  it('fails fast when PORT is explicitly invalid', () => {
    for (const value of ['3001abc', '-1', '0', '65536', '3.1', '+3001']) {
      expect(() => parseApiPort(value)).toThrow(RangeError);
    }
  });

  it('accepts decimal integer ports in range', () => {
    expect(parseApiPort('1')).toBe(1);
    expect(parseApiPort('3001')).toBe(3001);
    expect(parseApiPort('65535')).toBe(65535);
    expect(parseApiPort(' 3001 ')).toBe(3001);
  });
});

describe('parseDatabaseUrl', () => {
  it('defaults to undefined when DATABASE_URL is absent or blank', () => {
    for (const value of [undefined, '', '   ']) {
      expect(parseDatabaseUrl(value)).toBeUndefined();
    }
  });

  it('fails fast when DATABASE_URL is malformed or not PostgreSQL', () => {
    for (const value of ['not-a-url', 'https://example.com/db', 'mysql://localhost/yrese']) {
      expect(() => parseDatabaseUrl(value)).toThrow(Error);
    }
  });

  it('accepts PostgreSQL URLs without logging or normalizing credentials', () => {
    expect(parseDatabaseUrl('postgres://user:pass@localhost:55432/yrese_dev')).toBe(
      'postgres://user:pass@localhost:55432/yrese_dev',
    );
    expect(parseDatabaseUrl(' postgresql://user:pass@localhost:55432/yrese_dev ')).toBe(
      'postgresql://user:pass@localhost:55432/yrese_dev',
    );
  });
});

describe('resolveApiRepositoryMode', () => {
  it('uses postgres mode when DATABASE_URL is present', () => {
    expect(
      resolveApiRepositoryMode({
        repositoryMode: undefined,
        databaseUrl: 'postgres://user:pass@localhost:55432/yrese_dev',
        nodeEnv: 'development',
      }),
    ).toBe('postgres');
    expect(
      resolveApiRepositoryMode({
        repositoryMode: 'postgres',
        databaseUrl: 'postgres://user:pass@localhost:55432/yrese_dev',
        nodeEnv: 'development',
      }),
    ).toBe('postgres');
  });

  it('allows in-memory mode only when explicitly requested outside production', () => {
    expect(
      resolveApiRepositoryMode({
        repositoryMode: 'in_memory',
        databaseUrl: undefined,
        nodeEnv: 'development',
      }),
    ).toBe('in_memory');
    expect(
      resolveApiRepositoryMode({
        repositoryMode: ' in_memory ',
        databaseUrl: undefined,
        nodeEnv: 'test',
      }),
    ).toBe('in_memory');
  });

  it('fails closed when DATABASE_URL is absent and repository mode is unset', () => {
    expect(() =>
      resolveApiRepositoryMode({
        repositoryMode: undefined,
        databaseUrl: undefined,
        nodeEnv: 'development',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('fails closed when in-memory mode is requested in production', () => {
    expect(() =>
      resolveApiRepositoryMode({
        repositoryMode: 'in_memory',
        databaseUrl: undefined,
        nodeEnv: 'production',
      }),
    ).toThrow(/in_memory/);
  });

  it('fails closed for invalid repository modes and contradictory settings', () => {
    expect(() =>
      resolveApiRepositoryMode({
        repositoryMode: 'memory',
        databaseUrl: undefined,
        nodeEnv: 'development',
      }),
    ).toThrow(/YRESE_API_REPOSITORY_MODE/);
    expect(() =>
      resolveApiRepositoryMode({
        repositoryMode: 'postgres',
        databaseUrl: undefined,
        nodeEnv: 'development',
      }),
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      resolveApiRepositoryMode({
        repositoryMode: 'in_memory',
        databaseUrl: 'postgres://user:pass@localhost:55432/yrese_dev',
        nodeEnv: 'development',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe('resolveTenantContextMode', () => {
  it('defaults to disabled when the opt-in flag is absent or exactly false', () => {
    for (const allowDevTenantStub of [undefined, 'false']) {
      expect(
        resolveTenantContextMode({
          allowDevTenantStub,
          nodeEnv: 'production',
          repositoryMode: 'postgres',
          databaseUrl: 'postgres://synthetic.invalid/yrese',
        }),
      ).toBe('disabled');
    }
  });

  it('enables dev headers only for exact opt-in in development or test with in-memory storage', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(
        resolveTenantContextMode({
          allowDevTenantStub: 'true',
          nodeEnv,
          repositoryMode: 'in_memory',
          databaseUrl: undefined,
        }),
      ).toBe('dev_headers');
    }
  });

  it('fails with a fixed startup error when the opt-in flag is malformed', () => {
    for (const allowDevTenantStub of ['', 'TRUE', '1', ' true ', 'false ']) {
      expect(() =>
        resolveTenantContextMode({
          allowDevTenantStub,
          nodeEnv: 'development',
          repositoryMode: 'in_memory',
          databaseUrl: undefined,
        }),
      ).toThrowError(new Error(devTenantContextConfigurationErrorMessage));
    }
  });

  it('fails with the same fixed startup error for every unsafe enabled combination', () => {
    const unsafeInputs = [
      { nodeEnv: undefined, repositoryMode: 'in_memory', databaseUrl: undefined },
      { nodeEnv: 'staging', repositoryMode: 'in_memory', databaseUrl: undefined },
      { nodeEnv: 'Production', repositoryMode: 'in_memory', databaseUrl: undefined },
      { nodeEnv: 'develop', repositoryMode: 'in_memory', databaseUrl: undefined },
      { nodeEnv: 'production', repositoryMode: 'in_memory', databaseUrl: undefined },
      { nodeEnv: 'development', repositoryMode: 'postgres', databaseUrl: undefined },
      {
        nodeEnv: 'development',
        repositoryMode: 'in_memory',
        databaseUrl: 'postgres://synthetic.invalid/yrese',
      },
    ] as const;

    for (const input of unsafeInputs) {
      expect(() =>
        resolveTenantContextMode({
          allowDevTenantStub: 'true',
          ...input,
        }),
      ).toThrowError(new Error(devTenantContextConfigurationErrorMessage));
    }
  });
});

describe('resolvePatientSearchCursorHmacKey', () => {
  it('decodes an exact canonical unpadded base64url 32-byte configured key', () => {
    const key = randomBytes(32);
    const encoded = key.toString('base64url');

    const resolved = resolvePatientSearchCursorHmacKey({
      configuredKey: encoded,
      nodeEnv: 'production',
      repositoryMode: 'postgres',
    });

    expect(resolved.kind).toBe('configured');
    if (resolved.kind === 'configured') {
      expect(Buffer.from(resolved.key)).toEqual(key);
      expect(resolved.key).not.toBe(key);
    }
  });

  it('returns an explicit ephemeral decision only for absent key in exact dev/test in-memory mode', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(
        resolvePatientSearchCursorHmacKey({
          configuredKey: undefined,
          nodeEnv,
          repositoryMode: 'in_memory',
        }),
      ).toEqual({ kind: 'ephemeral' });
    }
  });

  it('fails closed when the key is absent outside the explicit ephemeral boundary', () => {
    const cases = [
      { nodeEnv: 'production', repositoryMode: 'postgres' },
      { nodeEnv: 'development', repositoryMode: 'postgres' },
      { nodeEnv: 'test', repositoryMode: 'postgres' },
      { nodeEnv: 'staging', repositoryMode: 'postgres' },
      { nodeEnv: undefined, repositoryMode: 'postgres' },
      { nodeEnv: 'production', repositoryMode: 'in_memory' },
      { nodeEnv: 'staging', repositoryMode: 'in_memory' },
      { nodeEnv: 'Development', repositoryMode: 'in_memory' },
      { nodeEnv: undefined, repositoryMode: 'in_memory' },
    ] as const;

    for (const input of cases) {
      expect(() =>
        resolvePatientSearchCursorHmacKey({ configuredKey: undefined, ...input }),
      ).toThrowError(new Error(patientSearchCursorHmacConfigurationErrorMessage));
    }
  });

  it('rejects blank, padded, malformed, short, long, and non-canonical configured keys with no echo', () => {
    const valid = randomBytes(32).toString('base64url');
    const malformedValues = [
      '',
      '   ',
      `${valid}=`,
      'not+base64url',
      randomBytes(31).toString('base64url'),
      randomBytes(33).toString('base64url'),
      makeNonCanonicalBase64Url(valid),
    ];

    for (const configuredKey of malformedValues) {
      try {
        resolvePatientSearchCursorHmacKey({
          configuredKey,
          nodeEnv: 'development',
          repositoryMode: 'in_memory',
        });
        throw new Error('expected cursor HMAC configuration to fail');
      } catch (error) {
        expect(error).toEqual(new Error(patientSearchCursorHmacConfigurationErrorMessage));
        if (configuredKey.length > 0) {
          expect((error as Error).message).not.toContain(configuredKey);
        }
      }
    }
  });
});
