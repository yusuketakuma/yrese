import type {
  ApiShutdownSignal,
  DatabasePoolSnapshot,
  RuntimeOperationalEvent,
  RuntimeOperationalEventSink,
} from './runtime-events.js';

export interface RuntimeSignalSource {
  on(signal: ApiShutdownSignal, listener: () => void): void;
  off(signal: ApiShutdownSignal, listener: () => void): void;
  setExitCode(exitCode: number): void;
}

export interface GracefulShutdownResult {
  readonly ok: boolean;
}

export interface GracefulShutdownController {
  request(signal: ApiShutdownSignal): Promise<GracefulShutdownResult>;
  dispose(): void;
}

function safeRecord(
  events: RuntimeOperationalEventSink,
  event: RuntimeOperationalEvent,
): void {
  try {
    events.record(event);
  } catch {
    // A reporter failure must not interrupt shutdown.
  }
}

function safeDatabasePoolSnapshot(
  snapshot: (() => DatabasePoolSnapshot) | undefined,
): DatabasePoolSnapshot | undefined {
  if (snapshot === undefined) return undefined;
  try {
    return snapshot();
  } catch {
    return undefined;
  }
}

export function registerGracefulShutdown(input: {
  readonly server: { close(): Promise<unknown> };
  readonly signals: RuntimeSignalSource;
  readonly events: RuntimeOperationalEventSink;
  readonly databasePoolSnapshot?: () => DatabasePoolSnapshot;
}): GracefulShutdownController {
  let disposed = false;
  let shutdown: Promise<GracefulShutdownResult> | undefined;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    try {
      input.signals.off('SIGTERM', onSigterm);
    } catch {
      // Continue removing the remaining listener.
    }
    try {
      input.signals.off('SIGINT', onSigint);
    } catch {
      // Listener removal failure must not replace the shutdown outcome.
    }
  };

  const request = (signal: ApiShutdownSignal): Promise<GracefulShutdownResult> => {
    if (shutdown !== undefined) return shutdown;

    dispose();
    const startedPool = safeDatabasePoolSnapshot(input.databasePoolSnapshot);
    safeRecord(input.events, {
      kind: 'api.shutdown.started',
      signal,
      ...(startedPool === undefined ? {} : { databasePool: startedPool }),
    });

    shutdown = (async (): Promise<GracefulShutdownResult> => {
      try {
        await input.server.close();
        const completedPool = safeDatabasePoolSnapshot(input.databasePoolSnapshot);
        safeRecord(input.events, {
          kind: 'api.shutdown.completed',
          signal,
          ...(completedPool === undefined ? {} : { databasePool: completedPool }),
        });
        return Object.freeze({ ok: true });
      } catch {
        try {
          input.signals.setExitCode(1);
        } catch {
          // The fixed failure event remains the last available signal.
        }
        const failedPool = safeDatabasePoolSnapshot(input.databasePoolSnapshot);
        safeRecord(input.events, {
          kind: 'api.shutdown.failed',
          signal,
          ...(failedPool === undefined ? {} : { databasePool: failedPool }),
        });
        return Object.freeze({ ok: false });
      }
    })();
    return shutdown;
  };

  function onSigterm(): void {
    void request('SIGTERM');
  }

  function onSigint(): void {
    void request('SIGINT');
  }

  let sigtermRegistered = false;
  try {
    input.signals.on('SIGTERM', onSigterm);
    sigtermRegistered = true;
    input.signals.on('SIGINT', onSigint);
  } catch (error) {
    if (sigtermRegistered) {
      try {
        input.signals.off('SIGTERM', onSigterm);
      } catch {
        // Preserve the registration failure as the primary error.
      }
    }
    throw error;
  }

  return Object.freeze({ request, dispose });
}
