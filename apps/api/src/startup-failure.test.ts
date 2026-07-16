import { describe, expect, it, vi } from 'vitest';
import {
  apiStartupCleanupFailureMessage,
  apiStartupFailureMessage,
  handleStartupFailure,
} from './startup-failure.js';

describe('handleStartupFailure', () => {
  it('reports a fixed startup event and sets exit code without a server', async () => {
    const originalError = new Error('synthetic primary detail');
    const report = vi.fn();
    const setExitCode = vi.fn();

    const result = await handleStartupFailure({ originalError, server: undefined, report, setExitCode });

    expect(setExitCode).toHaveBeenCalledExactlyOnceWith(1);
    expect(report).toHaveBeenCalledExactlyOnceWith(apiStartupFailureMessage);
    expect(result).toEqual({ originalError, reporterErrors: [] });
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
      cleanupError,
      reporterErrors: [reporterError, reporterError],
    });
  });
});
