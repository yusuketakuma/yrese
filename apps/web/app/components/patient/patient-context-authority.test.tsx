import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PatientSearchResult } from "@yrese/contracts";

import {
  PatientContextBar,
  PatientContextBarView,
  createPatientContextAuthorityController,
  createPatientRefreshRunner,
  fetchPatientById,
  toPatientContextData,
  type PatientContextData,
} from './patient-context';

(globalThis as { React?: typeof React }).React = React;


import { SAMPLE } from './patient-context-test-support';

describe("createPatientContextAuthorityController (selection authority)", () => {
  const secondId = "22222222-2222-4222-8222-222222222222";

  it("invalidates refresh authority synchronously for direct selection and clear", () => {
    const order: string[] = [];
    const controller = createPatientContextAuthorityController({
      invalidate: () => order.push("invalidate"),
    });

    const selectedAuthority = controller.select(SAMPLE.patientId);
    order.push("select-commit");
    const selectedClaim = controller.capture(SAMPLE.patientId);
    expect(selectedClaim).not.toBeNull();
    expect(selectedAuthority).toBe(1);

    controller.clear();
    order.push("clear-commit");

    expect(order).toEqual([
      "invalidate",
      "select-commit",
      "invalidate",
      "clear-commit",
    ]);
    expect(selectedClaim === null ? true : controller.isCurrent(selectedClaim)).toBe(false);
  });

  it("rejects old success, removal, and failure authority after a different patient is selected", () => {
    const invalidate = vi.fn();
    const controller = createPatientContextAuthorityController({ invalidate });
    controller.select(SAMPLE.patientId);
    const authorityA = controller.capture(SAMPLE.patientId);
    expect(authorityA).not.toBeNull();

    controller.select(secondId);

    if (authorityA === null) throw new Error("expected patient A authority claim");
    expect(controller.acceptFresh(authorityA, SAMPLE.patientId)).toBe(false);
    expect(controller.acceptRemoval(authorityA)).toBeNull();
    expect(controller.isCurrent(authorityA)).toBe(false);
    expect(controller.capture(secondId)).not.toBeNull();
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("invalidates an old refresh for same-ID direct reselection", () => {
    const controller = createPatientContextAuthorityController({ invalidate: vi.fn() });
    controller.select(SAMPLE.patientId);
    const oldAuthority = controller.capture(SAMPLE.patientId);
    controller.select(SAMPLE.patientId);

    if (oldAuthority === null) throw new Error("expected old authority claim");
    expect(controller.isCurrent(oldAuthority)).toBe(false);
    expect(controller.acceptFresh(oldAuthority, SAMPLE.patientId)).toBe(false);
    expect(controller.capture(SAMPLE.patientId)?.authority).toBe(2);
  });

  it("accepts a current same-patient refresh without self-invalidating", () => {
    const invalidate = vi.fn();
    const controller = createPatientContextAuthorityController({ invalidate });
    controller.select(SAMPLE.patientId);
    const currentAuthority = controller.capture(SAMPLE.patientId);

    if (currentAuthority === null) throw new Error("expected current authority claim");
    expect(controller.acceptFresh(currentAuthority, SAMPLE.patientId)).toBe(true);
    expect(controller.isCurrent(currentAuthority)).toBe(true);
    expect(controller.acceptFresh(currentAuthority, secondId)).toBe(false);
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("accepts current removal exactly once and makes its authority obsolete", () => {
    const controller = createPatientContextAuthorityController({ invalidate: vi.fn() });
    controller.select(SAMPLE.patientId);
    const currentAuthority = controller.capture(SAMPLE.patientId);

    if (currentAuthority === null) throw new Error("expected current authority claim");
    expect(controller.acceptRemoval(currentAuthority)).toBe(2);
    expect(controller.acceptRemoval(currentAuthority)).toBeNull();
    expect(controller.isCurrent(currentAuthority)).toBe(false);
    expect(controller.capture(SAMPLE.patientId)).toBeNull();
  });

  it.each([
    ["success", toPatientContextData(SAMPLE)],
    ["removal", null],
    ["failure", new Error("late patient A failure")],
  ] as const)(
    "suppresses a late A %s after direct B selection before React cleanup",
    async (_kind, outcome) => {
      let resolve!: (value: PatientContextData | null) => void;
      let reject!: (reason: unknown) => void;
      const pending = new Promise<PatientContextData | null>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const runner = createPatientRefreshRunner(() => pending);
      const controller = createPatientContextAuthorityController(runner);
      controller.select(SAMPLE.patientId);
      const authorityA = controller.capture(SAMPLE.patientId);
      if (authorityA === null) throw new Error("expected patient A authority claim");
      const effects = {
        fresh: vi.fn(),
        removed: vi.fn(),
        failed: vi.fn(),
      };
      const refreshA = runner.refresh(SAMPLE.patientId, {
        onFresh: (fresh) => {
          if (controller.acceptFresh(authorityA, fresh.patientId)) effects.fresh(fresh);
        },
        onRemoved: () => {
          if (controller.acceptRemoval(authorityA) !== null) effects.removed();
        },
        onFailure: () => {
          if (controller.isCurrent(authorityA)) effects.failed();
        },
      });

      controller.select(secondId);
      if (outcome instanceof Error) reject(outcome);
      else resolve(outcome);
      await refreshA;

      expect(effects.fresh).not.toHaveBeenCalled();
      expect(effects.removed).not.toHaveBeenCalled();
      expect(effects.failed).not.toHaveBeenCalled();
      expect(controller.capture(secondId)).not.toBeNull();
    },
  );
});

describe("createPatientRefreshRunner (患者切替・解除の競合防止)", () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  const callbacks = () => ({
    onFresh: vi.fn(),
    onRemoved: vi.fn(),
    onFailure: vi.fn(),
  });

  it("ignores a late success after the patient selection is cleared", async () => {
    const pending = deferred<PatientContextData | null>();
    const events = callbacks();
    const runner = createPatientRefreshRunner(() => pending.promise);
    const controller = createPatientContextAuthorityController(runner);

    controller.select(SAMPLE.patientId);
    const refresh = runner.refresh(SAMPLE.patientId, events);
    controller.clear();
    pending.resolve(toPatientContextData(SAMPLE));
    await refresh;

    expect(events.onFresh).not.toHaveBeenCalled();
    expect(events.onRemoved).not.toHaveBeenCalled();
    expect(events.onFailure).not.toHaveBeenCalled();
  });

  it("ignores a late failure after the patient selection is cleared", async () => {
    const pending = deferred<PatientContextData | null>();
    const events = callbacks();
    const runner = createPatientRefreshRunner(() => pending.promise);

    const refresh = runner.refresh(SAMPLE.patientId, events);
    runner.invalidate();
    pending.reject(new Error("late failure"));
    await refresh;

    expect(events.onFresh).not.toHaveBeenCalled();
    expect(events.onRemoved).not.toHaveBeenCalled();
    expect(events.onFailure).not.toHaveBeenCalled();
  });

  it("ignores a late removal response after the patient selection is cleared", async () => {
    const pending = deferred<PatientContextData | null>();
    const events = callbacks();
    const runner = createPatientRefreshRunner(() => pending.promise);

    const refresh = runner.refresh(SAMPLE.patientId, events);
    runner.invalidate();
    pending.resolve(null);
    await refresh;

    expect(events.onFresh).not.toHaveBeenCalled();
    expect(events.onRemoved).not.toHaveBeenCalled();
    expect(events.onFailure).not.toHaveBeenCalled();
  });

  it("keeps only the latest patient refresh authoritative", async () => {
    const patientA = deferred<PatientContextData | null>();
    const patientB = deferred<PatientContextData | null>();
    const eventsA = callbacks();
    const eventsB = callbacks();
    const runner = createPatientRefreshRunner((id) =>
      id === SAMPLE.patientId ? patientA.promise : patientB.promise,
    );
    const secondId = "22222222-2222-4222-8222-222222222222";

    const refreshA = runner.refresh(SAMPLE.patientId, eventsA);
    const refreshB = runner.refresh(secondId, eventsB);
    patientB.resolve({ ...toPatientContextData(SAMPLE), patientId: secondId });
    await refreshB;
    patientA.resolve(toPatientContextData(SAMPLE));
    await refreshA;

    expect(eventsB.onFresh).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: secondId }),
    );
    expect(eventsA.onFresh).not.toHaveBeenCalled();
    expect(eventsA.onRemoved).not.toHaveBeenCalled();
    expect(eventsA.onFailure).not.toHaveBeenCalled();
  });

  it("aborts the previous patient refresh and gives the replacement a fresh signal", async () => {
    const patientA = deferred<PatientContextData | null>();
    const secondId = "22222222-2222-4222-8222-222222222222";
    const signals: AbortSignal[] = [];
    const eventsA = callbacks();
    const eventsB = callbacks();
    const runner = createPatientRefreshRunner((id, signal) => {
      signals.push(signal);
      return id === SAMPLE.patientId
        ? patientA.promise
        : Promise.resolve({ ...toPatientContextData(SAMPLE), patientId: secondId });
    });

    const refreshA = runner.refresh(SAMPLE.patientId, eventsA);
    await runner.refresh(secondId, eventsB);
    patientA.resolve(toPatientContextData(SAMPLE));
    await refreshA;

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(eventsA.onFresh).not.toHaveBeenCalled();
    expect(eventsB.onFresh).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ patientId: secondId }),
    );
  });

  it("suppresses abort rejection after clear and remains reusable", async () => {
    const signals: AbortSignal[] = [];
    const eventsBeforeClear = callbacks();
    const eventsAfterClear = callbacks();
    const runner = createPatientRefreshRunner((id, signal) => {
      signals.push(signal);
      if (id === SAMPLE.patientId) {
        return new Promise<PatientContextData | null>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return Promise.resolve({ ...toPatientContextData(SAMPLE), patientId: id });
    });
    const secondId = "22222222-2222-4222-8222-222222222222";

    const beforeClear = runner.refresh(SAMPLE.patientId, eventsBeforeClear);
    runner.invalidate();
    runner.invalidate();
    await beforeClear;

    expect(signals[0]?.aborted).toBe(true);
    expect(eventsBeforeClear.onFresh).not.toHaveBeenCalled();
    expect(eventsBeforeClear.onRemoved).not.toHaveBeenCalled();
    expect(eventsBeforeClear.onFailure).not.toHaveBeenCalled();

    await runner.refresh(secondId, eventsAfterClear);
    expect(signals[1]?.aborted).toBe(false);
    expect(eventsAfterClear.onFresh).toHaveBeenCalledOnce();
  });

  it("drops refresh re-entry from invalidate abort listeners", async () => {
    let runner!: ReturnType<typeof createPatientRefreshRunner>;
    let reentrantRefresh: Promise<void> | undefined;
    const events = callbacks();
    const reentrantEvents = callbacks();
    const fetcher = vi.fn(
      (id: string, signal: AbortSignal) =>
        new Promise<PatientContextData | null>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reentrantRefresh = runner.refresh(`${id}-reentrant`, reentrantEvents);
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    runner = createPatientRefreshRunner(fetcher);

    const active = runner.refresh(SAMPLE.patientId, events);
    runner.invalidate();
    await active;
    await reentrantRefresh;

    expect(fetcher).toHaveBeenCalledOnce();
    expect(reentrantEvents.onFresh).not.toHaveBeenCalled();
    expect(reentrantEvents.onRemoved).not.toHaveBeenCalled();
    expect(reentrantEvents.onFailure).not.toHaveBeenCalled();
  });

  it("does not start a superseded refresh after abort-listener re-entry", async () => {
    let runner!: ReturnType<typeof createPatientRefreshRunner>;
    let reentrantRefresh: Promise<void> | undefined;
    const oldEvents = callbacks();
    const outerEvents = callbacks();
    const reentrantEvents = callbacks();
    const fetcher = vi.fn((id: string, signal: AbortSignal) => {
      if (id === SAMPLE.patientId) {
        return new Promise<PatientContextData | null>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reentrantRefresh = runner.refresh("reentrant-new", reentrantEvents);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve({ ...toPatientContextData(SAMPLE), patientId: id });
    });
    runner = createPatientRefreshRunner(fetcher);

    const old = runner.refresh(SAMPLE.patientId, oldEvents);
    await runner.refresh("obsolete-outer", outerEvents);
    await old;
    await reentrantRefresh;

    expect(fetcher.mock.calls.map(([id]) => id)).toEqual([
      SAMPLE.patientId,
      "reentrant-new",
    ]);
    expect(outerEvents.onFresh).not.toHaveBeenCalled();
    expect(reentrantEvents.onFresh).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ patientId: "reentrant-new" }),
    );
  });

  it("does not let stale settlement detach the replacement controller", async () => {
    const oldResult = deferred<PatientContextData | null>();
    const replacementResult = deferred<PatientContextData | null>();
    let replacementSignal: AbortSignal | undefined;
    const oldEvents = callbacks();
    const replacementEvents = callbacks();
    const secondId = "22222222-2222-4222-8222-222222222222";
    const runner = createPatientRefreshRunner((id, signal) => {
      if (id === SAMPLE.patientId) {
        return oldResult.promise;
      }
      replacementSignal = signal;
      return replacementResult.promise;
    });

    const old = runner.refresh(SAMPLE.patientId, oldEvents);
    const replacement = runner.refresh(secondId, replacementEvents);
    oldResult.resolve(toPatientContextData(SAMPLE));
    await old;
    runner.invalidate();

    expect(replacementSignal?.aborted).toBe(true);
    replacementResult.resolve({ ...toPatientContextData(SAMPLE), patientId: secondId });
    await replacement;
    expect(replacementEvents.onFresh).not.toHaveBeenCalled();
    expect(replacementEvents.onRemoved).not.toHaveBeenCalled();
    expect(replacementEvents.onFailure).not.toHaveBeenCalled();
  });

  it("does not abort a settled signal when its callback starts a new refresh", async () => {
    const signals: AbortSignal[] = [];
    const secondId = "22222222-2222-4222-8222-222222222222";
    let callbackRefresh: Promise<void> | undefined;
    const secondEvents = callbacks();
    const runner = createPatientRefreshRunner((id, signal) => {
      signals.push(signal);
      return Promise.resolve({ ...toPatientContextData(SAMPLE), patientId: id });
    });

    await runner.refresh(SAMPLE.patientId, {
      ...callbacks(),
      onFresh: () => {
        callbackRefresh = runner.refresh(secondId, secondEvents);
      },
    });
    await callbackRefresh;

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(false);
    expect(signals[1]?.aborted).toBe(false);
    expect(secondEvents.onFresh).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ patientId: secondId }),
    );
  });

  it("releases a failed owner before its callback starts a new refresh", async () => {
    const signals: AbortSignal[] = [];
    const secondId = "22222222-2222-4222-8222-222222222222";
    let callbackRefresh: Promise<void> | undefined;
    let abortReentry: Promise<void> | undefined;
    const secondEvents = callbacks();
    const reentryEvents = callbacks();
    let runner!: ReturnType<typeof createPatientRefreshRunner>;
    runner = createPatientRefreshRunner((id, signal) => {
      signals.push(signal);
      if (id === SAMPLE.patientId) {
        signal.addEventListener("abort", () => {
          abortReentry = runner.refresh("unexpected-abort-reentry", reentryEvents);
        });
        return Promise.reject(new Error("synthetic current refresh failure"));
      }
      return Promise.resolve({ ...toPatientContextData(SAMPLE), patientId: id });
    });

    await runner.refresh(SAMPLE.patientId, {
      ...callbacks(),
      onFailure: () => {
        callbackRefresh = runner.refresh(secondId, secondEvents);
      },
    });
    await callbackRefresh;
    await abortReentry;

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(false);
    expect(signals[1]?.aborted).toBe(false);
    expect(secondEvents.onFresh).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ patientId: secondId }),
    );
    expect(reentryEvents.onFresh).not.toHaveBeenCalled();
  });

  it("routes a current bound-fetch identity mismatch only to onFailure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const returnedId = "22222222-2222-4222-8222-222222222222";
      const fetchImpl: typeof fetch = async () =>
        new Response(JSON.stringify({ ...SAMPLE, patientId: returnedId }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const events = callbacks();

      await runner.refresh(SAMPLE.patientId, events);

      expect(events.onFailure).toHaveBeenCalledOnce();
      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps bound-fetch 404 removal semantics unchanged", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({ errorCode: "PAT-0002", message: "Patient not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          },
        );
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const events = callbacks();

      await runner.refresh(SAMPLE.patientId, events);

      expect(events.onRemoved).toHaveBeenCalledOnce();
      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("routes a current synchronous 404 body read failure only to onFailure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const fetchImpl: typeof fetch = async () =>
        ({
          status: 404,
          json: () => {
            throw new Error("raw synchronous patient response failure");
          },
        }) as unknown as Response;
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const events = callbacks();

      await runner.refresh(SAMPLE.patientId, events);

      expect(events.onFailure).toHaveBeenCalledOnce();
      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("routes a hostile current 404 body only to onFailure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const rawSentinel = `raw runner patient body ${SAMPLE.patientId}`;
      const body = new Proxy(
        { errorCode: "PAT-0002", message: "Patient not found" },
        {
          getOwnPropertyDescriptor() {
            throw new Error(rawSentinel);
          },
        },
      );
      const fetchImpl: typeof fetch = async () =>
        ({ status: 404, json: () => body }) as unknown as Response;
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const events = callbacks();

      await runner.refresh(SAMPLE.patientId, events);

      expect(events.onFailure).toHaveBeenCalledOnce();
      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("suppresses a late synchronous 404 body read failure after clear", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const pending = deferred<Response>();
    try {
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, () => pending.promise),
      );
      const events = callbacks();

      const refresh = runner.refresh(SAMPLE.patientId, events);
      runner.invalidate();
      pending.resolve(
        ({
          status: 404,
          json: () => {
            throw new Error("raw late patient response failure");
          },
        }) as unknown as Response,
      );
      await refresh;

      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
      expect(events.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("routes a current unsupported success status only to onFailure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const fetchImpl: typeof fetch = async () =>
        new Response(JSON.stringify(SAMPLE), {
          status: 202,
          headers: { "content-type": "application/json" },
        });
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const events = callbacks();

      await runner.refresh(SAMPLE.patientId, events);

      expect(events.onFailure).toHaveBeenCalledOnce();
      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("suppresses a stale unsupported success status after clear", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const pending = deferred<Response>();
    try {
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, () => pending.promise),
      );
      const events = callbacks();

      const refresh = runner.refresh(SAMPLE.patientId, events);
      runner.invalidate();
      pending.resolve(
        new Response(JSON.stringify(SAMPLE), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
      );
      await refresh;

      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
      expect(events.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("suppresses a stale bound-fetch mismatch after clear", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const pending = deferred<Response>();
    try {
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, () => pending.promise),
      );
      const events = callbacks();

      const refresh = runner.refresh(SAMPLE.patientId, events);
      runner.invalidate();
      pending.resolve(
        new Response(
          JSON.stringify({
            ...SAMPLE,
            patientId: "22222222-2222-4222-8222-222222222222",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      await refresh;

      expect(events.onFresh).not.toHaveBeenCalled();
      expect(events.onRemoved).not.toHaveBeenCalled();
      expect(events.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps a newer matching bound-fetch patient authoritative over an older mismatch", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const oldResponse = deferred<Response>();
    const secondId = "22222222-2222-4222-8222-222222222222";
    try {
      const fetchImpl: typeof fetch = async (input) =>
        String(input).endsWith(encodeURIComponent(SAMPLE.patientId))
          ? oldResponse.promise
          : new Response(JSON.stringify({ ...SAMPLE, patientId: secondId }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
      const runner = createPatientRefreshRunner((id) =>
        fetchPatientById(id, fetchImpl),
      );
      const oldEvents = callbacks();
      const newEvents = callbacks();

      const oldRefresh = runner.refresh(SAMPLE.patientId, oldEvents);
      await runner.refresh(secondId, newEvents);
      oldResponse.resolve(
        new Response(JSON.stringify({ ...SAMPLE, patientId: secondId }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await oldRefresh;

      expect(newEvents.onFresh).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: secondId }),
      );
      expect(oldEvents.onFresh).not.toHaveBeenCalled();
      expect(oldEvents.onRemoved).not.toHaveBeenCalled();
      expect(oldEvents.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

