import { describe, expect, it } from 'vitest';

import { defaultApiPort, parseApiPort } from './config.js';

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
