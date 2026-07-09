import { describe, expect, it } from 'vitest';

import { defaultApiPort, parseApiPort, parseDatabaseUrl, resolveApiRepositoryMode } from './config.js';

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
