export const missingCiTestDatabaseUrlMessage =
  'TEST_DATABASE_URL is required for PostgreSQL integration tests when CI=true';

type TestDatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveTestDatabaseUrl(environment: TestDatabaseEnvironment): string | undefined {
  const testDatabaseUrl = environment.TEST_DATABASE_URL;
  if (typeof testDatabaseUrl === 'string' && testDatabaseUrl.trim().length > 0) {
    return testDatabaseUrl;
  }
  if (environment.CI === 'true') {
    throw new Error(missingCiTestDatabaseUrlMessage);
  }
  return undefined;
}
