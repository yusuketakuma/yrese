import { describe, expect, it, vi } from 'vitest';

import { createJsonRuntimeOperationalEventSink } from './runtime-events.js';

describe('createJsonRuntimeOperationalEventSink', () => {
  it('emits allowlisted startup and database events as one-line JSON', () => {
    const infoLines: string[] = [];
    const errorLines: string[] = [];
    const sink = createJsonRuntimeOperationalEventSink({
      now: () => new Date('2026-08-27T00:00:00.000Z'),
      writeInfo: (line) => infoLines.push(line),
      writeError: (line) => errorLines.push(line),
    });

    sink.record({ kind: 'api.startup.port_selected', port: 3001 });
    sink.record({
      kind: 'database.pool.background_error',
      databasePool: { totalCount: 5, idleCount: 2, waitingCount: 1 },
    });

    expect(infoLines).toHaveLength(1);
    expect(errorLines).toHaveLength(1);
    expect(JSON.parse(infoLines[0] ?? '')).toEqual({
      timestamp: '2026-08-27T00:00:00.000Z',
      level: 'INFO',
      event: 'api.startup.port_selected',
      port: 3001,
    });
    expect(JSON.parse(errorLines[0] ?? '')).toEqual({
      timestamp: '2026-08-27T00:00:00.000Z',
      level: 'ERROR',
      event: 'database.pool.background_error',
      databasePool: { totalCount: 5, idleCount: 2, waitingCount: 1 },
    });
  });

  it('omits an invalid timestamp without replacing the operational event', () => {
    const lines: string[] = [];
    const sink = createJsonRuntimeOperationalEventSink({
      now: () => {
        throw new Error('synthetic clock detail');
      },
      writeInfo: (line) => lines.push(line),
    });

    sink.record({ kind: 'api.startup.listening', port: 3001 });

    expect(JSON.parse(lines[0] ?? '')).toEqual({
      level: 'INFO',
      event: 'api.startup.listening',
      port: 3001,
    });
    expect(lines.join('\n')).not.toContain('synthetic clock detail');
  });

  it('never throws when an output writer fails', () => {
    const writeInfo = vi.fn(() => {
      throw new Error('synthetic writer detail');
    });
    const sink = createJsonRuntimeOperationalEventSink({ writeInfo });

    expect(() =>
      sink.record({ kind: 'api.startup.port_selected', port: 3001 }),
    ).not.toThrow();
    expect(writeInfo).toHaveBeenCalledOnce();
  });
});
