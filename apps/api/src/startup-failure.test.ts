import { describe, expect, it, vi } from 'vitest';
import {
  apiStartupCleanupFailureMessage,
  apiStartupFailureMessage,
  apiStartupPoolCleanupFailureMessage,
  handleStartupFailure,
  normalizeStartupFailure,
  preserveStartupFailureAcrossCleanup,
} from './startup-failure.js';

describe('preserveStartupFailureAcrossCleanup', () => {
  it('returns the exact primary failure after one successful cleanup', async () => {
    const originalError = new Error('synthetic primary detail');
    const cleanup = vi.fn().mockResolvedValue(undefined);

    const throwable = await preserveStartupFailureAcrossCleanup({ originalError, cleanup });

    expect(cleanup).toHaveBeenCalledOnce();
    expect(throwable).toBe(originalError);
    expect(normalizeStartupFailure(throwable)).toEqual({ originalError });
  });

  it.each([
    ['rejection', () => Promise.reject(new Error('secret pool cleanup token'))],
    [
      'synchronous throw',
      () => {
        throw new Error('secret pool cleanup token');
      },
    ],
    ['undefined rejection', () => Promise.reject(undefined)],
    [
      'undefined synchronous throw',
      () => {
        throw undefined;
      },
    ],
  ])('retains a %s separately without replacing the primary failure', async (_label, cleanup) => {
    const originalError = new Error('patient-synthetic-private-primary');
    const cleanupSpy = vi.fn(cleanup);

    const throwable = await preserveStartupFailureAcrossCleanup({
      originalError,
      cleanup: cleanupSpy,
    });
    const normalized = normalizeStartupFailure(throwable);

    expect(cleanupSpy).toHaveBeenCalledOnce();
    expect(normalized.originalError).toBe(originalError);
    expect(normalized).toHaveProperty('priorCleanupFailure');
    expect(normalized.priorCleanupFailure?.stage).toBe('database_pool');
    if (_label.startsWith('undefined')) {
      expect(normalized.priorCleanupFailure?.error).toBeUndefined();
    } else {
      expect(normalized.priorCleanupFailure?.error).toBeInstanceOf(Error);
    }
  });

  it('treats a hostile proxy as the primary failure without inspecting its prototype', () => {
    const originalError = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('prototype inspection must not run');
        },
      },
    );

    const normalized = normalizeStartupFailure(originalError);

    expect(normalized.originalError).toBe(originalError);
    expect('priorCleanupFailure' in normalized).toBe(false);
  });

  it('does not unwrap a forged structural envelope', () => {
    const forgedError = Object.freeze({
      originalError: new Error('forged primary'),
      cleanupError: new Error('forged cleanup'),
    });

    expect(normalizeStartupFailure(forgedError)).toEqual({ originalError: forgedError });
  });
});

describe('handleStartupFailure', () => {
  it('reports a fixed startup event and sets exit code without a server', async () => {
    const originalError = new Error('synthetic primary detail');
    const report = vi.fn();
    const setExitCode = vi.fn();

    const result = await handleStartupFailure({ originalError, server: undefined, report, setExitCode });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(report).toHaveBeenCalledExactlyOnceWith(apiStartupFailureMessage);
    expect(result).toEqual({ originalError, cleanupFailed: false, reporterErrors: [] });
  });

  it('reports before waiting for one successful cleanup attempt', async () => {
    let resolveClose: (() => void) | undefined;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const events: string[] = [];
    const handling = handleStartupFailure({
      originalError: new Error('synthetic primary detail'),
      server: { close },
      report: (message) => events.push(`report:${message}`),
      setExitCode: (exitCode) => events.push(`exit:${exitCode}`),
    });

    expect(events).toEqual([`exit:1`, `report:${apiStartupFailureMessage}`]);
    expect(close).toHaveBeenCalledOnce();
    resolveClose?.();
    const result = await handling;

    expect(result.cleanupError).toBeUndefined();
    expect(result.cleanupFailed).toBe(false);
    expect(events).not.toContain(`report:${apiStartupCleanupFailureMessage}`);
  });

  it.each([
    ['rejection', () => Promise.reject(new Error('secret cleanup token'))],
    ['synchronous throw', () => {
      throw new Error('secret cleanup token');
    }],
  ])('separates a cleanup %s from the primary failure without exposing raw detail', async (_label, close) => {
    const originalError = new Error('patient-synthetic-private-primary');
    const report = vi.fn();
    const setExitCode = vi.fn();

    const result = await handleStartupFailure({ originalError, server: { close }, report, setExitCode });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(report.mock.calls).toEqual([
      [apiStartupFailureMessage],
      [apiStartupCleanupFailureMessage],
    ]);
    expect(result.originalError).toBe(originalError);
    expect(result.cleanupFailed).toBe(true);
    expect(result.cleanupStage).toBe('server');
    expect(result.cleanupError).toBeInstanceOf(Error);
    expect(JSON.stringify(report.mock.calls)).not.toContain('patient-synthetic-private-primary');
    expect(JSON.stringify(report.mock.calls)).not.toContain('secret cleanup token');
  });

  it.each([
    ['rejection', () => Promise.reject(undefined)],
    ['synchronous throw', () => {
      throw undefined;
    }],
  ])('preserves an undefined cleanup %s as a distinct failure result', async (_label, close) => {
    const originalError = new Error('synthetic primary detail');
    const report = vi.fn();

    const result = await handleStartupFailure({
      originalError,
      server: { close },
      report,
      setExitCode: vi.fn(),
    });

    expect(Object.hasOwn(result, 'cleanupError')).toBe(true);
    expect(result.cleanupFailed).toBe(true);
    expect(result.cleanupStage).toBe('server');
    expect(result.cleanupError).toBeUndefined();
    expect(result.originalError).toBe(originalError);
    expect(report.mock.calls).toEqual([
      [apiStartupFailureMessage],
      [apiStartupCleanupFailureMessage],
    ]);
  });

  it('attempts cleanup after reporter failure and retains reporter failures in the result', async () => {
    const originalError = new Error('synthetic primary detail');
    const cleanupError = new Error('synthetic cleanup detail');
    const reporterError = new Error('synthetic reporter detail');
    const close = vi.fn().mockRejectedValue(cleanupError);
    const setExitCode = vi.fn();

    const result = await handleStartupFailure({
      originalError,
      server: { close },
      report: () => {
        throw reporterError;
      },
      setExitCode,
    });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual({
      originalError,
      cleanupFailed: true,
      cleanupStage: 'server',
      cleanupError,
      reporterErrors: [reporterError, reporterError],
    });
  });

  it.each([
    ['error', new Error('postgres://user:secret@db/patient-private')],
    ['undefined', undefined],
  ])('reports a prior database pool cleanup %s after the startup signal', async (_label, cleanupError) => {
    const originalError = new Error('patient-synthetic-private-primary');
    const report = vi.fn();
    const setExitCode = vi.fn();

    const result = await handleStartupFailure({
      originalError,
      server: undefined,
      priorCleanupFailure: { stage: 'database_pool', error: cleanupError },
      report,
      setExitCode,
    });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(report.mock.calls).toEqual([
      [apiStartupFailureMessage],
      [apiStartupPoolCleanupFailureMessage],
    ]);
    expect(result.originalError).toBe(originalError);
    expect(result.cleanupFailed).toBe(true);
    expect(result.cleanupStage).toBe('database_pool');
    expect(Object.hasOwn(result, 'cleanupError')).toBe(true);
    expect(result.cleanupError).toBe(cleanupError);
    expect(JSON.stringify(report.mock.calls)).not.toContain('patient-synthetic-private-primary');
    expect(JSON.stringify(report.mock.calls)).not.toContain('postgres://');
    expect(JSON.stringify(report.mock.calls)).not.toContain('secret');
  });

  it('retains reporter failures without changing prior database pool failure identities', async () => {
    const originalError = new Error('synthetic primary detail');
    const cleanupError = new Error('synthetic cleanup detail');
    const reporterError = new Error('synthetic reporter detail');

    const result = await handleStartupFailure({
      originalError,
      server: undefined,
      priorCleanupFailure: { stage: 'database_pool', error: cleanupError },
      report: () => {
        throw reporterError;
      },
      setExitCode: vi.fn(),
    });

    expect(result).toEqual({
      originalError,
      cleanupFailed: true,
      cleanupStage: 'database_pool',
      cleanupError,
      reporterErrors: [reporterError, reporterError],
    });
  });

  it('sets exit code and reports a hostile proxy as a normal primary startup failure', async () => {
    const originalError = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('prototype inspection must not run');
        },
      },
    );
    const report = vi.fn();
    const setExitCode = vi.fn();
    const normalized = normalizeStartupFailure(originalError);

    const result = await handleStartupFailure({
      originalError: normalized.originalError,
      server: undefined,
      report,
      setExitCode,
    });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(report).toHaveBeenCalledExactlyOnceWith(apiStartupFailureMessage);
    expect(result.originalError).toBe(originalError);
    expect(result.cleanupFailed).toBe(false);
  });
});
