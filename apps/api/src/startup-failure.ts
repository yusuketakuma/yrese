export const apiStartupFailureMessage = 'API server failed to start';
export const apiStartupCleanupFailureMessage = 'API server cleanup failed after startup failure';
export const apiStartupPoolCleanupFailureMessage =
  'API database pool cleanup failed after startup failure';

interface ClosableServer {
  close(): Promise<unknown>;
}

interface StartupCleanupFailure {
  readonly stage: 'database_pool';
  readonly error: unknown;
}

interface StartupFailureBaseInput {
  readonly originalError: unknown;
  readonly report: (message: string) => void;
  readonly setExitCode: (exitCode: number) => void;
}

type HandleStartupFailureInput = StartupFailureBaseInput &
  (
    | {
        readonly server: ClosableServer;
        readonly priorCleanupFailure?: never;
      }
    | {
        readonly server: undefined;
        readonly priorCleanupFailure?: StartupCleanupFailure;
      }
  );

interface StartupFailureResultBase {
  readonly originalError: unknown;
  readonly reporterErrors: readonly unknown[];
}

type StartupFailureResult = StartupFailureResultBase &
  (
    | {
        readonly cleanupFailed: false;
        readonly cleanupStage?: never;
        readonly cleanupError?: never;
      }
    | {
        readonly cleanupFailed: true;
        readonly cleanupStage: 'database_pool' | 'server';
        readonly cleanupError: unknown;
      }
  );

interface StartupFailureEnvelopePayload {
  readonly originalError: unknown;
  readonly cleanupError: unknown;
}

const startupFailureEnvelopePayloads = new WeakMap<object, StartupFailureEnvelopePayload>();

interface PreserveStartupFailureAcrossCleanupInput {
  readonly originalError: unknown;
  readonly cleanup: () => Promise<unknown>;
}

interface NormalizedStartupFailure {
  readonly originalError: unknown;
  readonly priorCleanupFailure?: StartupCleanupFailure;
}

export async function preserveStartupFailureAcrossCleanup(
  input: PreserveStartupFailureAcrossCleanupInput,
): Promise<unknown> {
  try {
    await input.cleanup();
    return input.originalError;
  } catch (cleanupError) {
    const envelope = Object.freeze({});
    startupFailureEnvelopePayloads.set(envelope, {
      originalError: input.originalError,
      cleanupError,
    });
    return envelope;
  }
}

export function normalizeStartupFailure(error: unknown): NormalizedStartupFailure {
  const isWeakKey =
    (typeof error === 'object' && error !== null) || typeof error === 'function';
  const envelopePayload = isWeakKey ? startupFailureEnvelopePayloads.get(error) : undefined;
  if (envelopePayload !== undefined) {
    return {
      originalError: envelopePayload.originalError,
      priorCleanupFailure: {
        stage: 'database_pool',
        error: envelopePayload.cleanupError,
      },
    };
  }

  return { originalError: error };
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

  let cleanupFailure:
    | {
        readonly stage: 'database_pool' | 'server';
        readonly error: unknown;
      }
    | undefined;
  if (input.priorCleanupFailure !== undefined) {
    cleanupFailure = input.priorCleanupFailure;
    try {
      input.report(apiStartupPoolCleanupFailureMessage);
    } catch (reporterError) {
      reporterErrors.push(reporterError);
    }
  } else if (input.server !== undefined) {
    try {
      await input.server.close();
    } catch (error) {
      cleanupFailure = { stage: 'server', error };
      try {
        input.report(apiStartupCleanupFailureMessage);
      } catch (reporterError) {
        reporterErrors.push(reporterError);
      }
    }
  }

  if (cleanupFailure === undefined) {
    return {
      originalError: input.originalError,
      cleanupFailed: false,
      reporterErrors,
    };
  }

  return {
    originalError: input.originalError,
    cleanupFailed: true,
    cleanupStage: cleanupFailure.stage,
    cleanupError: cleanupFailure.error,
    reporterErrors,
  };
}
