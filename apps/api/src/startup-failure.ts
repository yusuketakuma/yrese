export const apiStartupFailureMessage = 'API server failed to start';
export const apiStartupCleanupFailureMessage = 'API server cleanup failed after startup failure';

interface ClosableServer {
  close(): Promise<unknown>;
}

interface HandleStartupFailureInput {
  readonly originalError: unknown;
  readonly server: ClosableServer | undefined;
  readonly report: (message: string) => void;
  readonly setExitCode: (exitCode: number) => void;
}

interface StartupFailureResult {
  readonly originalError: unknown;
  readonly cleanupError?: unknown;
  readonly reporterErrors: readonly unknown[];
}

export async function handleStartupFailure(
  input: HandleStartupFailureInput,
): Promise<StartupFailureResult> {
  const reporterErrors: unknown[] = [];
  input.setExitCode(1);

  try {
    input.report(apiStartupFailureMessage);
  } catch (error) {
    reporterErrors.push(error);
  }

  let cleanupFailed = false;
  let cleanupError: unknown;
  if (input.server !== undefined) {
    try {
      await input.server.close();
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
      try {
        input.report(apiStartupCleanupFailureMessage);
      } catch (reporterError) {
        reporterErrors.push(reporterError);
      }
    }
  }

  return {
    originalError: input.originalError,
    ...(cleanupFailed ? { cleanupError } : {}),
    reporterErrors,
  };
}
