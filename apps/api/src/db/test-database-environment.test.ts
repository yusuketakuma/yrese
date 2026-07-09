import { describe, expect, it } from 'vitest';

import { missingCiTestDatabaseUrlMessage, resolveTestDatabaseUrl } from './test-database-environment.js';

describe('resolveTestDatabaseUrl', () => {
  it('fails closed for a missing or blank URL when CI is exactly true', () => {
    for (const testDatabaseUrl of [undefined, '', '   ']) {
      expect(() => resolveTestDatabaseUrl({ CI: 'true', TEST_DATABASE_URL: testDatabaseUrl })).toThrowError(
        missingCiTestDatabaseUrlMessage,
      );
    }
  });

  it('keeps local missing or blank URLs as an explicit integration-test skip', () => {
    expect(resolveTestDatabaseUrl({})).toBeUndefined();
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: '' })).toBeUndefined();
    expect(resolveTestDatabaseUrl({ CI: 'false', TEST_DATABASE_URL: '   ' })).toBeUndefined();
    expect(resolveTestDatabaseUrl({ CI: 'TRUE' })).toBeUndefined();
  });

  it('preserves a configured URL without normalization', () => {
    const testDatabaseUrl = 'postgresql://synthetic-user:synthetic-pass@127.0.0.1:5432/synthetic-db';

    expect(resolveTestDatabaseUrl({ CI: 'true', TEST_DATABASE_URL: testDatabaseUrl })).toBe(testDatabaseUrl);
  });
});
