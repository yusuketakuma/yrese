import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

import type {
  PatientSearchResult,
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import {
  ReceptionDashboard,
  ReceptionError,
  ReceptionRegistrationForm,
  ReceptionQueueTable,
  ReceptionQueueView,
  createReception,
  createReceptionDashboardLifecycle,
  createReceptionQueueRunner,
  createReceptionIdempotencyKeyStore,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  fetchReceptionQueue,
  formatAcceptedTime,
  isSettledReceptionCreateFailure,
  parseDateParam,
  RECEPTION_STATUS_LABELS,
  receptionDashboardDisplayButtonLabel,
  receptionQueueMetrics,
  ReceptionQueueMetricsView,
  registrationPatientChangeNotice,
  subscribeReceptionQueueRefreshOnVisible,
  submitReceptionRegistration,
  type QueueState,
  todayAsIsoDate,
} from './reception-dashboard';
import ReceptionPage from '../page';

import {
  unverifiedEligibility,
  patient,
  entry,
  queueResponse,
  jsonResponse,
  deferredValue,
  withNodeEnv,
} from './reception-dashboard-test-support';

describe('reception dashboard queue flight ownership and abort', () => {
  it("shares one active same-target queue flight, loading emit, fetch, and commit", async () => {
    const pending = deferredValue<ReceptionQueueResponse>();
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-10"),
        refreshState: { kind: "idle" },
      },
    ];
    const fetcher = vi.fn(() => pending.promise);
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const owner = run("2026-07-11");
    const joined = run("2026-07-11");
    let settled = false;
    void joined.then(() => {
      settled = true;
    });

    expect(joined).toBe(owner);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(states).toHaveLength(2);
    await Promise.resolve();
    expect(settled).toBe(false);

    pending.resolve(queueResponse("2026-07-11"));
    await Promise.all([owner, joined]);
    expect(states).toHaveLength(3);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-11" },
      refreshState: { kind: "idle" },
    });
  });

  it("does not join a pre-mutation in-flight fetch when the reload is forced", async () => {
    const first = deferredValue<ReceptionQueueResponse>();
    const second = deferredValue<ReceptionQueueResponse>();
    const signals: AbortSignal[] = [];
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-10"),
        refreshState: { kind: "idle" },
      },
    ];
    const fetcher = vi.fn((_date: string, signal: AbortSignal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    // mutation前に開始された同一日付の in-flight fetch がある状態で、
    // mutation後の再読込は join せず新しい fetch を開始する
    const preMutation = run("2026-07-11");
    const postMutation = run("2026-07-11", { force: true });

    expect(postMutation).not.toBe(preMutation);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    // mutation前のfetchが遅れて解決しても、その結果は採用されない。
    // stale/current は識別可能な marker で分離する(同一内容では stale 採用を検出できない)。
    first.resolve(
      queueResponse("2026-07-11", [entry({ receptionId: "pre-mutation-stale" })]),
    );
    await preMutation;
    second.resolve(
      queueResponse("2026-07-11", [entry({ receptionId: "post-mutation-current" })]),
    );
    await postMutation;

    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: {
        date: "2026-07-11",
        entries: [{ receptionId: "post-mutation-current" }],
      },
      refreshState: { kind: "idle" },
    });
    expect(JSON.stringify(states)).not.toContain("pre-mutation-stale");
  });

  it("cleans successful, handled-failure, and mismatch flights so same-target retries are admitted", async () => {
    const scenarios: Array<{
      first: () => Promise<ReceptionQueueResponse>;
    }> = [
      { first: () => Promise.resolve(queueResponse("2026-07-11")) },
      { first: () => Promise.reject(new Error("synthetic handled failure")) },
      { first: () => Promise.resolve(queueResponse("2099-12-31")) },
    ];

    for (const scenario of scenarios) {
      const states: QueueState[] = [
        {
          kind: "loaded",
          response: queueResponse("2026-07-10"),
          refreshState: { kind: "idle" },
        },
      ];
      const fetcher = vi
        .fn<() => Promise<ReceptionQueueResponse>>()
        .mockImplementationOnce(scenario.first)
        .mockResolvedValueOnce(queueResponse("2026-07-11"));
      const run = createReceptionQueueRunner(fetcher, (update) => {
        states.push(update(states[states.length - 1]!));
      });

      await run("2026-07-11");
      await run("2026-07-11");

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(states.at(-1)).toMatchObject({
        kind: "loaded",
        response: { date: "2026-07-11" },
        refreshState: { kind: "idle" },
      });
    }
  });

  it("admits A-B-A as three flights and keeps the final A authoritative", async () => {
    const firstA = deferredValue<ReceptionQueueResponse>();
    const b = deferredValue<ReceptionQueueResponse>();
    const finalA = deferredValue<ReceptionQueueResponse>();
    const states: QueueState[] = [{ kind: "loading" }];
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(() => firstA.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementationOnce(() => finalA.promise);
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const oldA = run("2026-07-10");
    const oldB = run("2026-07-11");
    const currentA = run("2026-07-10");
    expect(fetcher).toHaveBeenCalledTimes(3);

    finalA.resolve(queueResponse("2026-07-10", [entry({ receptionId: "current-a" })]));
    await currentA;
    firstA.resolve(queueResponse("2026-07-10", [entry({ receptionId: "old-a" })]));
    b.reject(new Error("old B failure"));
    await Promise.all([oldA, oldB]);

    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10", entries: [{ receptionId: "current-a" }] },
    });
  });

  it("aborts superseded A-B-A queue transports while ignored abort settlements emit nothing", async () => {
    const firstA = deferredValue<ReceptionQueueResponse>();
    const b = deferredValue<ReceptionQueueResponse>();
    const finalA = deferredValue<ReceptionQueueResponse>();
    const signals: AbortSignal[] = [];
    const fetcher = vi
      .fn((_target: string, signal: AbortSignal) => {
        signals.push(signal);
        return firstA.promise;
      })
      .mockImplementationOnce((_target, signal) => {
        signals.push(signal);
        return firstA.promise;
      })
      .mockImplementationOnce((_target, signal) => {
        signals.push(signal);
        return b.promise;
      })
      .mockImplementationOnce((_target, signal) => {
        signals.push(signal);
        return finalA.promise;
      });
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states.at(-1)!));
    });

    const oldA = run("2026-07-10");
    const oldB = run("2026-07-11");
    const currentA = run("2026-07-10");

    expect(signals).toHaveLength(3);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(true);
    expect(signals[2]?.aborted).toBe(false);
    finalA.resolve(queueResponse("2026-07-10", [entry({ receptionId: "current" })]));
    await currentA;
    const countAfterCurrent = states.length;
    firstA.resolve(queueResponse("2026-07-10", [entry({ receptionId: "stale-a" })]));
    b.reject(new Error("stale B ignored-abort failure"));
    await Promise.all([oldA, oldB]);

    expect(states).toHaveLength(countAfterCurrent);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { entries: [{ receptionId: "current" }] },
    });
  });

  it("keeps buffered stale loading and terminal updaters as exact no-ops", async () => {
    const staleOutcomes: Array<() => Promise<ReceptionQueueResponse>> = [
      () => Promise.resolve(queueResponse("2026-07-10")),
      () => Promise.resolve(queueResponse("2099-12-31")),
      () => Promise.reject(new Error("buffered stale failure")),
    ];

    for (const staleOutcome of staleOutcomes) {
      const updates: Array<(prev: QueueState) => QueueState> = [];
      const fetcher = vi
        .fn<() => Promise<ReceptionQueueResponse>>()
        .mockImplementationOnce(staleOutcome)
        .mockResolvedValueOnce(
          queueResponse("2026-07-11", [entry({ receptionId: "authoritative" })]),
        );
      const run = createReceptionQueueRunner(fetcher, (update) => updates.push(update));

      await run("2026-07-10");
      const staleUpdates = updates.splice(0);
      await run("2026-07-11");
      const currentUpdates = updates.splice(0);
      let state: QueueState = {
        kind: "loaded",
        response: queueResponse("2026-07-09"),
        loadedAt: "08:15",
        refreshState: { kind: "idle" },
      };
      for (const update of currentUpdates) state = update(state);
      const authoritative = state;
      expect(authoritative).toMatchObject({
        kind: "loaded",
        response: { date: "2026-07-11", entries: [{ receptionId: "authoritative" }] },
      });
      for (const update of staleUpdates) {
        expect(update(authoritative)).toBe(authoritative);
      }
    }
  });

  it("publishes the replacement owner before abort-listener re-entry", async () => {
    const old = deferredValue<ReceptionQueueResponse>();
    const replacement = deferredValue<ReceptionQueueResponse>();
    let run!: ReturnType<typeof createReceptionQueueRunner>;
    let reentrantJoin: Promise<void> | undefined;
    const fetcher = vi
      .fn((_target: string, signal: AbortSignal) => {
        signal.addEventListener("abort", () => {
          reentrantJoin = run("2026-07-11");
        });
        return old.promise;
      })
      .mockImplementationOnce((_target, signal) => {
        signal.addEventListener("abort", () => {
          reentrantJoin = run("2026-07-11");
        });
        return old.promise;
      })
      .mockImplementationOnce(() => replacement.promise);
    run = createReceptionQueueRunner(fetcher, () => undefined);

    const obsolete = run("2026-07-10");
    const owner = run("2026-07-11");

    expect(reentrantJoin).toBe(owner);
    expect(fetcher).toHaveBeenCalledTimes(2);
    replacement.resolve(queueResponse("2026-07-11"));
    old.resolve(queueResponse("2026-07-10"));
    await Promise.all([obsolete, owner, reentrantJoin]);
  });

  it("does not abort a settled signal during terminal-emit re-entry", async () => {
    const replacement = deferredValue<ReceptionQueueResponse>();
    const signals: AbortSignal[] = [];
    const fetcher = vi
      .fn((_target: string, signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve(queueResponse("2026-07-10"));
      })
      .mockImplementationOnce((_target, signal) => {
        signals.push(signal);
        return Promise.resolve(queueResponse("2026-07-10"));
      })
      .mockImplementationOnce((_target, signal) => {
        signals.push(signal);
        return replacement.promise;
      });
    let run!: ReturnType<typeof createReceptionQueueRunner>;
    let replacementRun: Promise<void> | undefined;
    let emitCount = 0;
    run = createReceptionQueueRunner(fetcher, () => {
      emitCount += 1;
      if (emitCount === 2) replacementRun = run("2026-07-11");
    });

    const settled = run("2026-07-10");
    await Promise.resolve();

    expect(signals[0]?.aborted).toBe(false);
    expect(signals[1]?.aborted).toBe(false);
    replacement.resolve(queueResponse("2026-07-11"));
    await Promise.all([settled, replacementRun]);
  });

  it("cancels active work without emit, blocks abort-listener re-entry, and remains reusable", async () => {
    const states: QueueState[] = [{ kind: "loading" }];
    let run!: ReturnType<typeof createReceptionQueueRunner>;
    let reentrantDuringCancel: Promise<void> | undefined;
    const fetcher = vi.fn(
      (target: string, signal: AbortSignal): Promise<ReceptionQueueResponse> => {
        if (target === "2026-07-10") {
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reentrantDuringCancel = run("2026-07-11");
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(queueResponse(target));
      },
    );
    run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states.at(-1)!));
    });

    const active = run("2026-07-10");
    const countBeforeCancel = states.length;
    run.cancelActive();
    run.cancelActive();
    await active;
    await reentrantDuringCancel;

    expect(fetcher.mock.calls.map(([target]) => target)).toEqual(["2026-07-10"]);
    expect(states).toHaveLength(countBeforeCancel);
    await run("2026-07-12");
    expect(fetcher.mock.calls.map(([target]) => target)).toEqual([
      "2026-07-10",
      "2026-07-12",
    ]);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-12" },
    });
  });

  it("does not let an obsolete owner cleanup clear a newer same-target flight", async () => {
    const oldA = deferredValue<ReceptionQueueResponse>();
    const b = deferredValue<ReceptionQueueResponse>();
    const newA = deferredValue<ReceptionQueueResponse>();
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(() => oldA.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementationOnce(() => newA.promise);
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const obsoleteA = run("2026-07-10");
    const obsoleteB = run("2026-07-11");
    const ownerA = run("2026-07-10");
    oldA.resolve(queueResponse("2026-07-10"));
    await obsoleteA;
    const joinedA = run("2026-07-10");

    expect(joinedA).toBe(ownerA);
    expect(fetcher).toHaveBeenCalledTimes(3);
    newA.resolve(queueResponse("2026-07-10"));
    b.resolve(queueResponse("2026-07-11"));
    await Promise.all([obsoleteB, ownerA, joinedA]);
  });

  it("publishes ownership before a re-entrant loading emit", async () => {
    const pending = deferredValue<ReceptionQueueResponse>();
    const fetcher = vi.fn(() => pending.promise);
    let reentrant: Promise<void> | undefined;
    let reenter = true;
    let state: QueueState = { kind: "loading" };
    let run!: (target: string) => Promise<void>;
    run = createReceptionQueueRunner(fetcher, (update) => {
      state = update(state);
      if (reenter) {
        reenter = false;
        reentrant = run("2026-07-10");
      }
    });

    const owner = run("2026-07-10");

    expect(reentrant).toBe(owner);
    expect(fetcher).toHaveBeenCalledOnce();
    pending.resolve(queueResponse("2026-07-10"));
    await owner;
  });

});
