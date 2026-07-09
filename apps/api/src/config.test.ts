import { describe, expect, it } from 'vitest';

import { defaultApiPort, parseApiPort, parseDatabaseUrl } from './config.js';

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
