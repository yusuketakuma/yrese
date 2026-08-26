import { describe, expect, it, vi } from 'vitest';

import type {
  ApiShutdownSignal,
  RuntimeOperationalEvent,
} from './runtime-events.js';
import {
  registerGracefulShutdown,
  type RuntimeSignalSource,
} from './runtime-lifecycle.js';

function createSignalHarness(options: { readonly failOnSigint?: boolean } = {}) {
  const listeners: Record<ApiShutdownSignal, Set<() => void>> = {
    SIGINT: new Set(),
    SIGTERM: new Set(),
  };
  const exitCodes: number[] = [];
  const source: RuntimeSignalSource = {
    on(signal, listener) {
      if (signal === 'SIGINT' && options.failOnSigint === true) {
        throw new Error('synthetic signal registration detail');
      }
      listeners[signal].add(listener);
    },
    off(signal, listener) {
      listeners[signal].delete(listener);
    },
    setExitCode(exitCode) {
      exitCodes.push(exitCode);
    },
  };
  return {
    source,
    exitCodes,
    emit(signal: ApiShutdownSignal) {
      for (const listener of [...listeners[signal]]) listener();
    },
    listenerCount(signal: ApiShutdownSignal) {
      return listeners[signal].size;
    },
  };
}

describe('registerGracefulShutdown', () => {
  it('drains the server once and keeps signal handlers until the drain settles', async () => {
    let resolveClose: (() => void) | undefined;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const signals = createSignalHarness();
    const events: RuntimeOperationalEvent[] = [];
    const poolSnapshot = vi
      .fn()
      .mockReturnValueOnce({ totalCount: 3, idleCount: 1, waitingCount: 2 })
      .mockReturnValueOnce({ totalCount: 0, idleCount: 0, waitingCount: 0 });
    const controller = registerGracefulShutdown({
      server: { close },
      signals: signals.source,
      events: { record: (event) => events.push(event) },
      databasePoolSnapshot: poolSnapshot,
    });

    expect(signals.listenerCount('SIGTERM')).toBe(1);
    expect(signals.listenerCount('SIGINT')).toBe(1);
    signals.emit('SIGTERM');
    signals.emit('SIGINT');
    const repeatedRequest = controller.request('SIGINT');

    expect(close).toHaveBeenCalledOnce();
    expect(signals.listenerCount('SIGTERM')).toBe(1);
    expect(signals.listenerCount('SIGINT')).toBe(1);
    expect(events).toEqual([
      {
        kind: 'api.shutdown.started',
        signal: 'SIGTERM',
        databasePool: { totalCount: 3, idleCount: 1, waitingCount: 2 },
      },
    ]);

    resolveClose?.();
    await expect(repeatedRequest).resolves.toEqual({ ok: true });
    await expect(controller.request('SIGTERM')).resolves.toEqual({ ok: true });
    expect(close).toHaveBeenCalledOnce();
    expect(poolSnapshot).toHaveBeenCalledTimes(2);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(events).toEqual([
      {
        kind: 'api.shutdown.started',
        signal: 'SIGTERM',
        databasePool: { totalCount: 3, idleCount: 1, waitingCount: 2 },
      },
      {
        kind: 'api.shutdown.completed',
        signal: 'SIGTERM',
        databasePool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
      },
    ]);
    expect(signals.exitCodes).toEqual([]);
  });

  it('sets a failing exit code without exposing the close rejection', async () => {
    const close = vi.fn().mockRejectedValue(
      new Error('postgres://user:secret@db/patient-private'),
    );
    const signals = createSignalHarness();
    const events: RuntimeOperationalEvent[] = [];
    const controller = registerGracefulShutdown({
      server: { close },
      signals: signals.source,
      events: { record: (event) => events.push(event) },
      databasePoolSnapshot: () => {
        throw new Error('synthetic metrics detail');
      },
    });

    const result = await controller.request('SIGINT');

    expect(result).toEqual({ ok: false });
    expect(signals.exitCodes).toEqual([1]);
    expect(close).toHaveBeenCalledOnce();
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(events).toEqual([
      { kind: 'api.shutdown.started', signal: 'SIGINT' },
      { kind: 'api.shutdown.failed', signal: 'SIGINT' },
    ]);
    const serializedEvents = JSON.stringify(events);
    expect(serializedEvents).not.toContain('postgres://');
    expect(serializedEvents).not.toContain('secret');
    expect(serializedEvents).not.toContain('patient-private');
    expect(serializedEvents).not.toContain('synthetic metrics detail');
  });

  it('does not let an operational-event sink failure block shutdown', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const signals = createSignalHarness();
    const controller = registerGracefulShutdown({
      server: { close },
      signals: signals.source,
      events: {
        record() {
          throw new Error('synthetic event sink detail');
        },
      },
    });

    await expect(controller.request('SIGTERM')).resolves.toEqual({ ok: true });
    expect(close).toHaveBeenCalledOnce();
    expect(signals.exitCodes).toEqual([]);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });

  it('supports an explicit idempotent listener disposal before shutdown', () => {
    const signals = createSignalHarness();
    const controller = registerGracefulShutdown({
      server: { close: vi.fn().mockResolvedValue(undefined) },
      signals: signals.source,
      events: { record() {} },
    });

    controller.dispose();
    controller.dispose();

    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });

  it('rolls back the first listener when registering the second signal fails', () => {
    const signals = createSignalHarness({ failOnSigint: true });

    expect(() =>
      registerGracefulShutdown({
        server: { close: vi.fn().mockResolvedValue(undefined) },
        signals: signals.source,
        events: { record() {} },
      }),
    ).toThrow('synthetic signal registration detail');
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });
});
