export type ApiShutdownSignal = 'SIGINT' | 'SIGTERM';

export interface DatabasePoolSnapshot {
  readonly totalCount: number;
  readonly idleCount: number;
  readonly waitingCount: number;
}

export type RuntimeOperationalEvent =
  | {
      readonly kind: 'api.startup.port_selected';
      readonly port: number;
    }
  | {
      readonly kind: 'api.startup.listening';
      readonly port: number;
    }
  | {
      readonly kind: 'api.shutdown.started';
      readonly signal: ApiShutdownSignal;
      readonly databasePool?: DatabasePoolSnapshot;
    }
  | {
      readonly kind: 'api.shutdown.completed';
      readonly signal: ApiShutdownSignal;
      readonly databasePool?: DatabasePoolSnapshot;
    }
  | {
      readonly kind: 'api.shutdown.failed';
      readonly signal: ApiShutdownSignal;
      readonly databasePool?: DatabasePoolSnapshot;
    }
  | {
      readonly kind: 'database.pool.background_error';
      readonly databasePool: DatabasePoolSnapshot;
    }
  | {
      readonly kind: 'outbox.runner.started';
      readonly intervalMs: number;
    }
  | {
      readonly kind: 'outbox.runner.stopped';
    }
  | {
      readonly kind: 'outbox.runner.lock_acquired';
    }
  | {
      readonly kind: 'outbox.runner.lock_waiting';
    }
  | {
      readonly kind: 'outbox.runner.lock_lost';
    }
  | {
      readonly kind: 'outbox.runner.run_failed';
    }
  | {
      readonly kind: 'outbox.delivery.delivered';
      readonly outboxEventId: string;
      readonly eventType: string;
      readonly aggregateType: string;
      readonly aggregateId: string;
    }
  | {
      readonly kind: 'outbox.delivery.deferred';
      readonly delivered: number;
      readonly failed: number;
    };

export interface RuntimeOperationalEventSink {
  record(event: RuntimeOperationalEvent): void;
}

export interface JsonRuntimeOperationalEventSinkOptions {
  readonly now?: () => Date;
  readonly writeInfo?: (line: string) => void;
  readonly writeError?: (line: string) => void;
}

function eventLevel(event: RuntimeOperationalEvent): 'ERROR' | 'INFO' {
  switch (event.kind) {
    case 'api.shutdown.failed':
    case 'database.pool.background_error':
    case 'outbox.runner.lock_lost':
    case 'outbox.runner.run_failed':
      return 'ERROR';
    case 'api.shutdown.completed':
    case 'api.shutdown.started':
    case 'api.startup.listening':
    case 'api.startup.port_selected':
    case 'outbox.runner.started':
    case 'outbox.runner.stopped':
    case 'outbox.runner.lock_acquired':
    case 'outbox.runner.lock_waiting':
    case 'outbox.delivery.delivered':
    case 'outbox.delivery.deferred':
      return 'INFO';
  }
}

function snapshotTimestamp(now: () => Date): string | undefined {
  let value: unknown;
  try {
    value = now();
  } catch {
    return undefined;
  }
  try {
    return Date.prototype.toISOString.call(value);
  } catch {
    return undefined;
  }
}

export function createJsonRuntimeOperationalEventSink(
  options: JsonRuntimeOperationalEventSinkOptions = {},
): RuntimeOperationalEventSink {
  const now = options.now ?? (() => new Date());
  const writeInfo = options.writeInfo ?? ((line: string) => process.stdout.write(`${line}\n`));
  const writeError = options.writeError ?? ((line: string) => process.stderr.write(`${line}\n`));

  return Object.freeze({
    record(event: RuntimeOperationalEvent): void {
      try {
        const level = eventLevel(event);
        const timestamp = snapshotTimestamp(now);
        const { kind, ...attributes } = event;
        const serialized = JSON.stringify({
          ...(timestamp === undefined ? {} : { timestamp }),
          level,
          event: kind,
          ...attributes,
        });
        if (serialized === undefined) return;
        if (level === 'ERROR') writeError(serialized);
        else writeInfo(serialized);
      } catch {
        // Operational logging must never replace the primary runtime outcome.
      }
    },
  });
}
