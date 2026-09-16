import { describe, expect, it } from 'vitest';

import { compareTextByCodePoints } from './text-order.js';

describe('compareTextByCodePoints', () => {
  it('matches PostgreSQL COLLATE "C" code point order for BMP vs supplementary characters', () => {
    // UTF-16 code unit 順(`<`)では U+10000(lead surrogate 0xD800) < U+E000 だが、
    // code point 順(PostgreSQL C collation と同じ)では U+E000 < U+10000。
    const bmpPrivateUse = '\uE000';
    const supplementary = '\u{10000}';
    expect(bmpPrivateUse < supplementary).toBe(false);
    expect(compareTextByCodePoints(bmpPrivateUse, supplementary)).toBeLessThan(0);
    expect(compareTextByCodePoints(supplementary, bmpPrivateUse)).toBeGreaterThan(0);
  });

  it('orders by code point sequence, with prefix sorting first', () => {
    expect(compareTextByCodePoints('abc', 'abd')).toBeLessThan(0);
    expect(compareTextByCodePoints('ab', 'abc')).toBeLessThan(0);
    expect(compareTextByCodePoints('abc', 'abc')).toBe(0);
    expect(compareTextByCodePoints('b', 'a')).toBeGreaterThan(0);
  });
});
