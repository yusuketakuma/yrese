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
} from "./reception-dashboard";
import ReceptionPage from "./page";

import {
  unverifiedEligibility,
  patient,
  entry,
  queueResponse,
  jsonResponse,
  deferredValue,
  withNodeEnv,
} from './reception-dashboard-test-support';

describe("receptionDashboardDisplayButtonLabel (WP-5212-1)", () => {
  it("labels the 表示日付 submit action 表示 when no matching queue is loaded yet", () => {
    expect(
      receptionDashboardDisplayButtonLabel({ kind: "loading" }, "2026-08-27"),
    ).toBe("表示");
    expect(
      receptionDashboardDisplayButtonLabel(
        {
          kind: "error",
          notice: { message: "エラー", nextAction: "再試行してください。" },
        },
        "2026-08-27",
      ),
    ).toBe("表示");
    expect(
      receptionDashboardDisplayButtonLabel(
        {
          kind: "loaded",
          response: queueResponse("2026-08-26"),
          refreshState: { kind: "idle" },
        },
        "2026-08-27",
      ),
    ).toBe("表示");
  });

  it("labels the submit action 再読み込み when the typed date matches the already-loaded date", () => {
    expect(
      receptionDashboardDisplayButtonLabel(
        {
          kind: "loaded",
          response: queueResponse("2026-08-27"),
          refreshState: { kind: "idle" },
        },
        "2026-08-27",
      ),
    ).toBe("再読み込み");
  });
});

describe("ReceptionDashboard display-date input (WP-5212-1)", () => {
  it("requires the display-date input to unify native validation with the launch panel", () => {
    const html = renderToStaticMarkup(<ReceptionDashboard />);
    expect(html).toMatch(/<input[^>]*type="date"[^>]*required=""/);
  });

  it("defaults the submit label to 表示 before any queue has loaded", () => {
    const html = renderToStaticMarkup(<ReceptionDashboard />);
    expect(html).toContain(">表示<");
  });
});

describe("createReceptionRegistrationRunner (same-flight duplicate prevention)", () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  it("runs only one operation while the accepted registration flight is pending", async () => {
    const pending = deferred();
    const operation = vi.fn(() => pending.promise);
    const runner = createReceptionRegistrationRunner();

    const first = runner.run(operation);
    const duplicate = runner.run(operation);

    await expect(duplicate).resolves.toBe(false);
    expect(operation).toHaveBeenCalledOnce();
    expect(runner.isRunning()).toBe(true);

    pending.resolve();
    await expect(first).resolves.toBe(true);
    expect(runner.isRunning()).toBe(false);
  });

  it("keeps the lock through the authoritative queue reload", async () => {
    const reload = deferred();
    const events: string[] = [];
    const runner = createReceptionRegistrationRunner();
    const first = runner.run(async () => {
      events.push("created");
      await reload.promise;
      events.push("reloaded");
    });

    expect(events).toEqual(["created"]);
    await expect(
      runner.run(async () => {
        events.push("duplicate");
      }),
    ).resolves.toBe(false);
    expect(events).toEqual(["created"]);

    reload.resolve();
    await first;
    expect(events).toEqual(["created", "reloaded"]);
  });

  it("keeps the registration lock through a shared same-target queue reload", async () => {
    const pendingQueue = deferredValue<ReceptionQueueResponse>();
    const queueFetcher = vi.fn(() => pendingQueue.promise);
    let queueState: QueueState = { kind: "loading" };
    const queueRun = createReceptionQueueRunner(queueFetcher, (update) => {
      queueState = update(queueState);
    });
    const registrationRunner = createReceptionRegistrationRunner();

    const registration = registrationRunner.run(async () => {
      await queueRun("2026-07-10");
    });
    const joinedReload = queueRun("2026-07-10");

    expect(queueFetcher).toHaveBeenCalledOnce();
    expect(registrationRunner.isRunning()).toBe(true);
    pendingQueue.resolve(queueResponse("2026-07-10"));
    await Promise.all([registration, joinedReload]);
    expect(registrationRunner.isRunning()).toBe(false);
    expect(queueState.kind).toBe("loaded");
  });

  it("allows a later explicit operation after success", async () => {
    const operation = vi.fn().mockResolvedValue(undefined);
    const runner = createReceptionRegistrationRunner();

    await expect(runner.run(operation)).resolves.toBe(true);
    await expect(runner.run(operation)).resolves.toBe(true);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after failure and allows an explicit retry", async () => {
    const operation = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("synthetic failure"))
      .mockResolvedValueOnce(undefined);
    const runner = createReceptionRegistrationRunner();

    await expect(runner.run(operation)).rejects.toThrow("synthetic failure");
    expect(runner.isRunning()).toBe(false);
    await expect(runner.run(operation)).resolves.toBe(true);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("reloads the latest explicitly loaded target after a deferred registration instead of its start target", async () => {
    const post = deferred();
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const queueTargets: string[] = [];
    const load = async (target: string) => {
      tracker.mark(target);
      queueTargets.push(target);
    };
    const runner = createReceptionRegistrationRunner();

    await load("2026-07-10");
    const registration = runner.run(async () => {
      await post.promise;
      await load(tracker.current());
    });
    await load("2026-07-11");
    const draftOnlyDate = "2026-07-12";
    expect(draftOnlyDate).toBe("2026-07-12");
    expect(tracker.current()).toBe("2026-07-11");

    post.resolve();
    await registration;

    expect(queueTargets).toEqual(["2026-07-10", "2026-07-11", "2026-07-11"]);
  });

  it("uses the latest of multiple explicit queue targets while registration is pending", async () => {
    const post = deferred();
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const queueTargets: string[] = [];
    const load = async (target: string) => {
      tracker.mark(target);
      queueTargets.push(target);
    };
    const runner = createReceptionRegistrationRunner();
    const registration = runner.run(async () => {
      await post.promise;
      await load(tracker.current());
    });

    await load("2026-07-11");
    await load("2026-07-12");
    post.resolve();
    await registration;

    expect(queueTargets).toEqual(["2026-07-11", "2026-07-12", "2026-07-12"]);
  });

  it("keeps a failed invoked queue target authoritative for registration completion reload", async () => {
    const post = deferred();
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const queueFetch = vi
      .fn<(target: string) => Promise<ReceptionQueueResponse>>()
      .mockRejectedValueOnce(new Error("synthetic queue failure"))
      .mockResolvedValueOnce(queueResponse("2026-07-11"));
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-10"),
        refreshState: { kind: "idle" },
      },
    ];
    const queueRunner = createReceptionQueueRunner(queueFetch, (update) => {
      states.push(update(states[states.length - 1]!));
    });
    const load = async (target: string) => {
      tracker.mark(target);
      await queueRunner(target);
    };
    const registrationRunner = createReceptionRegistrationRunner();
    const registration = registrationRunner.run(async () => {
      await post.promise;
      await load(tracker.current());
    });

    await load("2026-07-11");
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10" },
      refreshState: { kind: "error", requestTarget: "2026-07-11" },
    });
    expect(tracker.current()).toBe("2026-07-11");
    post.resolve();
    await registration;

    expect(queueFetch.mock.calls.map(([target]) => target)).toEqual([
      "2026-07-11",
      "2026-07-11",
    ]);
    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.response.date).toBe("2026-07-11");
    }
  });

  it("does not reload or alter the queue target when registration POST fails", async () => {
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const load = vi.fn(async (target: string) => tracker.mark(target));
    await load("2026-07-10");
    const runner = createReceptionRegistrationRunner();

    await expect(
      runner.run(async () => {
        throw new Error("synthetic POST failure");
      }),
    ).rejects.toThrow("synthetic POST failure");

    expect(load).toHaveBeenCalledOnce();
    expect(tracker.current()).toBe("2026-07-10");
  });

  it("lets a late POST settle after unmount without resuming queue or UI work", async () => {
    const post = deferredValue<ReceptionQueueEntry>();
    const lifecycle = createReceptionDashboardLifecycle();
    const runner = createReceptionRegistrationRunner();
    const queueReload = vi.fn().mockResolvedValue(undefined);
    const uiContinuation = vi.fn();
    const postCall = vi.fn(() => post.promise);
    lifecycle.mount();

    const registration = runner.run(async () => {
      const created = await postCall();
      if (!lifecycle.isMounted()) return;
      uiContinuation(created);
      await queueReload();
    });
    lifecycle.unmount();
    post.resolve(entry({ receptionId: "server-completed-after-unmount" }));
    await registration;

    expect(postCall).toHaveBeenCalledOnce();
    expect(uiContinuation).not.toHaveBeenCalled();
    expect(queueReload).not.toHaveBeenCalled();
    expect(runner.isRunning()).toBe(false);
  });

  it("restores lifecycle admission after a StrictMode-like cleanup and setup", async () => {
    const lifecycle = createReceptionDashboardLifecycle();
    const runner = createReceptionRegistrationRunner();
    const queueReload = vi.fn().mockResolvedValue(undefined);

    lifecycle.mount();
    lifecycle.unmount();
    lifecycle.mount();
    await runner.run(async () => {
      if (!lifecycle.isMounted()) return;
      await queueReload("2026-07-11");
    });

    expect(queueReload).toHaveBeenCalledOnce();
    expect(queueReload).toHaveBeenCalledWith("2026-07-11");
  });
});

describe("createReceptionQueueTargetTracker", () => {
  it("exposes only the current closure value and explicit mark transition", () => {
    const tracker = createReceptionQueueTargetTracker("2026-07-10");

    expect(tracker.current()).toBe("2026-07-10");
    tracker.mark("2026-07-11");
    expect(tracker.current()).toBe("2026-07-11");
    expect(Object.keys(tracker).sort()).toEqual(["current", "mark"]);
  });

  it("treats an invoked restored-URL load target as authoritative without a separate state channel", () => {
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const load = (target: string) => tracker.mark(target);
    const restored = parseDateParam("?date=2026-07-15");
    if (restored === undefined) throw new Error("expected synthetic restored date");

    load(restored);

    expect(tracker.current()).toBe("2026-07-15");
  });
});

describe("subscribeReceptionQueueRefreshOnVisible", () => {
  it("wires hidden-visible edges to the explicit target and cleans up across remount", async () => {
    let visibilityState: DocumentVisibilityState = "visible";
    const listeners = new Set<() => void>();
    const source: Parameters<typeof subscribeReceptionQueueRefreshOnVisible>[0] = {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    };
    const dispatchVisibility = (next: DocumentVisibilityState) => {
      visibilityState = next;
      for (const listener of listeners) listener();
    };
    const first = deferredValue<ReceptionQueueResponse>();
    const cancelled = deferredValue<ReceptionQueueResponse>();
    const signals: AbortSignal[] = [];
    let call = 0;
    const fetcher = vi.fn((target: string, signal: AbortSignal) => {
      call += 1;
      signals.push(signal);
      if (call === 1) return first.promise;
      if (call === 4) return cancelled.promise;
      return Promise.resolve(queueResponse(target));
    });
    let state: QueueState = { kind: "loading" };
    const runner = createReceptionQueueRunner(fetcher, (update) => {
      state = update(state);
    });
    const tracker = createReceptionQueueTargetTracker("2026-07-10");
    const load = vi.fn((target: string) => {
      tracker.mark(target);
      return runner(target);
    });
    const unsubscribe = subscribeReceptionQueueRefreshOnVisible(
      source,
      tracker,
      load,
    );

    const initial = load("2026-07-10");
    const typedButNotSubmitted = "2026-07-11";
    dispatchVisibility("hidden");
    expect(load).toHaveBeenCalledOnce();
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("2026-07-10");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe("2026-07-10");
    expect(fetcher.mock.calls.map(([target]) => target)).not.toContain(
      typedButNotSubmitted,
    );

    first.resolve(queueResponse("2026-07-10"));
    await initial;
    await load("2026-07-12");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenCalledTimes(2);
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(4);
    expect(load).toHaveBeenLastCalledWith("2026-07-12");
    expect(fetcher.mock.calls.map(([target]) => target)).toEqual([
      "2026-07-10",
      "2026-07-12",
      "2026-07-12",
    ]);
    await Promise.resolve();
    await Promise.resolve();

    unsubscribe();
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(4);
    expect(fetcher).toHaveBeenCalledTimes(3);

    const unsubscribeRemount = subscribeReceptionQueueRefreshOnVisible(
      source,
      tracker,
      load,
    );
    dispatchVisibility("visible");
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(5);
    expect(fetcher).toHaveBeenCalledTimes(4);
    unsubscribeRemount();
    runner.cancelActive();
    expect(signals[3]?.aborted).toBe(true);
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    expect(load).toHaveBeenCalledTimes(5);
    expect(fetcher).toHaveBeenCalledTimes(4);
    cancelled.resolve(queueResponse("2026-07-12"));
  });
});

describe("business date is JST (WP-4053)", () => {
  it("todayAsIsoDate returns the JST calendar date, not the UTC date", () => {
    // 2026-07-09T20:00:00Z = JST 2026-07-10 05:00(UTC 日付のままだと前日になる時間帯)
    expect(todayAsIsoDate(new Date("2026-07-09T20:00:00Z"))).toBe("2026-07-10");
    // 2026-07-09T02:00:00Z = JST 2026-07-09 11:00(同日)
    expect(todayAsIsoDate(new Date("2026-07-09T02:00:00Z"))).toBe("2026-07-09");
  });

  it.each([
    ["0001-01-01T00:00:00.000Z", "0001-01-01"],
    ["0004-02-28T15:00:00.000Z", "0004-02-29"],
    ["0099-12-31T14:59:59.999Z", "0099-12-31"],
    ["0099-12-31T15:00:00.000Z", "0100-01-01"],
    ["9999-12-31T14:59:59.999Z", "9999-12-31"],
    ["0000-12-31T15:00:00.000Z", "0001-01-01"],
  ] as const)("canonicalizes JST boundary %s to %s", (instant, expected) => {
    expect(todayAsIsoDate(new Date(instant))).toBe(expected);
  });

  it.each([
    ["local BCE", new Date("0000-01-01T00:00:00.000Z")],
    ["JST year 10000", new Date("9999-12-31T15:00:00.000Z")],
    ["invalid Date", new Date(Number.NaN)],
  ] as const)("rejects %s with one fixed non-echo error", (_label, value) => {
    expect(() => todayAsIsoDate(value)).toThrow(
      "Reception business date could not be derived",
    );
  });

  it("rejects non-Date authorities without coercion or Proxy traps", () => {
    let coercions = 0;
    let traps = 0;
    const coercible = {
      valueOf() {
        coercions += 1;
        return Date.now();
      },
      [Symbol.toPrimitive]() {
        coercions += 1;
        return Date.now();
      },
    };
    const hostileProxy = new Proxy(new Date(), {
      get() {
        traps += 1;
        throw new Error("raw browser Date Proxy secret 4232");
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error("raw browser Date prototype secret 4232");
      },
    });
    const revoked = Proxy.revocable(new Date(), {});
    revoked.revoke();

    for (const value of [
      undefined,
      null,
      Date.now(),
      new String("2026-07-10T00:00:00.000Z"),
      coercible,
      Object.create(Date.prototype),
      hostileProxy,
      revoked.proxy,
    ]) {
      expect(() => todayAsIsoDate(value)).toThrow(
        "Reception business date could not be derived",
      );
    }
    expect(coercions).toBe(0);
    expect(traps).toBe(0);
  });

  it("ignores poisoned own Date methods after intrinsic snapshot", () => {
    const instant = new Date("0099-12-31T15:00:00.000Z");
    let ownMethodReads = 0;
    for (const property of ["getTime", "valueOf", "toISOString"] as const) {
      Object.defineProperty(instant, property, {
        get() {
          ownMethodReads += 1;
          throw new Error(`raw own Date ${property} secret 4232`);
        },
      });
    }

    expect(todayAsIsoDate(instant)).toBe("0100-01-01");
    expect(ownMethodReads).toBe(0);
  });
});

describe("parseDateParam (URL 状態は非PHIの業務日付のみ — S-03)", () => {
  it("accepts a valid YYYY-MM-DD date param", () => {
    expect(parseDateParam("?date=2026-07-10")).toBe("2026-07-10");
    expect(parseDateParam("?foo=1&date=2026-01-01")).toBe("2026-01-01");
  });

  it.each([
    "0001-01-01",
    "0004-02-29",
    "0099-12-31",
    "0100-01-01",
    "2000-02-29",
    "9999-12-31",
  ])("accepts CalendarDate boundary %s without timezone conversion", (value) => {
    expect(parseDateParam(`?date=${value}`)).toBe(value);
  });

  it("rejects missing / malformed / impossible dates (fail-closed)", () => {
    expect(parseDateParam("")).toBeUndefined();
    expect(parseDateParam("?date=")).toBeUndefined();
    expect(parseDateParam("?date=0000-01-01")).toBeUndefined();
    expect(parseDateParam("?date=0001-02-29")).toBeUndefined();
    expect(parseDateParam("?date=1900-02-29")).toBeUndefined();
    expect(parseDateParam("?date=2026/07/10")).toBeUndefined();
    expect(parseDateParam("?date=07-10-2026")).toBeUndefined();
    expect(parseDateParam("?date=2026-02-31")).toBeUndefined();
    // 患者名などの PHI らしき値は日付形式でないため復元されない(URLにPHIを載せない前提)
    expect(parseDateParam("?date=ヤマダタロウ")).toBeUndefined();
  });

  it("keeps the first duplicate date authoritative without fallback or raw-value echo", () => {
    expect(parseDateParam("?date=0001-01-01&date=raw-phi-sentinel")).toBe(
      "0001-01-01",
    );
    expect(parseDateParam("?date=raw-phi-sentinel&date=2026-07-10")).toBeUndefined();
  });
});

describe("reception create idempotency across retries (BUG-4260)", () => {
  it("keeps one key per unresolved registration intent and separates patients", () => {
    let issued = 0;
    const store = createReceptionIdempotencyKeyStore(() => `key-${++issued}`);

    expect(store.keyFor("patient-a")).toBe("key-1");
    expect(store.keyFor("patient-a")).toBe("key-1");
    expect(store.keyFor("patient-b")).toBe("key-2");
    expect(store.hasPendingKey("patient-a")).toBe(true);

    store.retire("patient-a");
    expect(store.hasPendingKey("patient-a")).toBe(false);
    expect(store.keyFor("patient-a")).toBe("key-3");
    // 別患者の未解決意図は巻き添えで失われない
    expect(store.keyFor("patient-b")).toBe("key-2");
  });

  it.each([
    [400, "RCV-0001"],
    [403, "AUTH-0003"],
    [404, "RCV-0002"],
    [409, "RCV-0003"],
  ] as const)(
    "classifies HTTP %s as a settled create failure (no reception was created)",
    async (status, errorCode) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(status, { errorCode, message: "denied" }));

      const error = await withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-1").then(
          () => {
            throw new Error("expected a rejection");
          },
          (rejection: unknown) => rejection,
        ),
      );

      expect(error).toBeInstanceOf(ReceptionError);
      expect(isSettledReceptionCreateFailure(error)).toBe(true);
    },
  );

  it.each([500, 502, 503] as const)(
    "treats HTTP %s as an unknown create outcome so the key is retained",
    async (status) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(status, { errorCode: "SYS-0001", message: "boom" }));

      const error = await withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-1").then(
          () => {
            throw new Error("expected a rejection");
          },
          (rejection: unknown) => rejection,
        ),
      );

      expect(error).toBeInstanceOf(ReceptionError);
      expect(isSettledReceptionCreateFailure(error)).toBe(false);
    },
  );

  it("treats a network rejection and an unparseable success body as unknown outcomes", async () => {
    const networkError = await withNodeEnv("development", () =>
      createReception(
        "patient-test-001",
        vi.fn().mockRejectedValue(new TypeError("network down")),
        "key-1",
      ).then(
        () => {
          throw new Error("expected a rejection");
        },
        (rejection: unknown) => rejection,
      ),
    );
    expect(isSettledReceptionCreateFailure(networkError)).toBe(false);

    const malformedError = await withNodeEnv("development", () =>
      createReception(
        "patient-test-001",
        vi.fn().mockResolvedValue(jsonResponse(201, { receptionId: "not-an-entry" })),
        "key-1",
      ).then(
        () => {
          throw new Error("expected a rejection");
        },
        (rejection: unknown) => rejection,
      ),
    );
    expect(isSettledReceptionCreateFailure(malformedError)).toBe(false);
  });

  it("reuses the retained key after a lost response so the retry converges on one reception", async () => {
    let issued = 0;
    const store = createReceptionIdempotencyKeyStore(() => `key-${++issued}`);
    const created = entry({ receptionId: "reception-000004", receptionStatus: "WAITING" });
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(jsonResponse(200, created));
    const submit = (
      patientIdValue: string,
      idempotencyKey: string,
      signal: AbortSignal,
    ) => createReception(patientIdValue, fetchImpl, idempotencyKey, signal);

    await withNodeEnv("development", async () => {
      // 1回目: 応答喪失。結果不明のためキーを退役させない。
      await expect(
        submitReceptionRegistration("patient-test-001", store, submit, 60_000),
      ).rejects.toBeInstanceOf(TypeError);
      expect(store.hasPendingKey("patient-test-001")).toBe(true);

      // 2回目(再試行): 同じキーで送られ、サーバーは既存受付を 200 で返す。
      const retried = await submitReceptionRegistration(
        "patient-test-001",
        store,
        submit,
        60_000,
      );
      expect(retried.receptionId).toBe("reception-000004");
    });

    const sentKeys = fetchImpl.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return (JSON.parse(String(init.body)) as { idempotencyKey: string }).idempotencyKey;
    });
    expect(sentKeys).toEqual(["key-1", "key-1"]);
    // 成功で退役済み。次の登録意図は別キーになる(同一日の2件目の受付を妨げない)
    expect(store.hasPendingKey("patient-test-001")).toBe(false);
    expect(store.keyFor("patient-test-001")).toBe("key-2");
  });

  it("retires the key on a settled failure so the next attempt is a new intent", async () => {
    let issued = 0;
    const store = createReceptionIdempotencyKeyStore(() => `key-${++issued}`);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { errorCode: "RCV-0002", message: "no patient" }));

    await withNodeEnv("development", async () => {
      await expect(
        submitReceptionRegistration(
          "patient-test-001",
          store,
          (patientIdValue, idempotencyKey, signal) =>
            createReception(patientIdValue, fetchImpl, idempotencyKey, signal),
          60_000,
        ),
      ).rejects.toBeInstanceOf(ReceptionError);
    });

    expect(store.hasPendingKey("patient-test-001")).toBe(false);
    expect(store.keyFor("patient-test-001")).toBe("key-2");
  });

  it("bounds each attempt with an abort signal derived from the timeout", async () => {
    const store = createReceptionIdempotencyKeyStore(() => "key-1");
    const signals: AbortSignal[] = [];

    await submitReceptionRegistration(
      "patient-test-001",
      store,
      (_patientIdValue, _idempotencyKey, signal) => {
        signals.push(signal);
        return Promise.resolve(entry({ receptionId: "reception-000004" }));
      },
      60_000,
    );

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]!.aborted).toBe(false);
  });
});

describe("reception create response timeout (BUG-4262)", () => {
  it("reports an unknown outcome instead of hanging when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("aborted"));

    const error = await withNodeEnv("development", () =>
      createReception("patient-test-001", fetchImpl, "key-1", controller.signal).then(
        () => {
          throw new Error("expected a rejection");
        },
        (rejection: unknown) => rejection,
      ),
    );

    expect(error).toBeInstanceOf(ReceptionError);
    const notice = (error as ReceptionError).toNotice();
    expect(notice.message).toContain("応答がありません");
    expect(notice.nextAction).toContain("受付一覧を更新");
    // 中断は結果不明であり、冪等キーを退役させてはならない
    expect(isSettledReceptionCreateFailure(error)).toBe(false);
  });

  it("passes the caller signal through and leaves unaborted rejections unchanged", async () => {
    const controller = new AbortController();
    const rejection = new TypeError("network down");
    const fetchImpl = vi.fn().mockRejectedValue(rejection);

    await expect(
      withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-1", controller.signal),
      ),
    ).rejects.toBe(rejection);

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });
});

describe("receptionQueueMetrics", () => {
  it("counts queue statuses and eligibility attention from real entries", () => {
    // WP-7204: 資格要確認は受付 snapshot の eligibility.state で数える
    // (患者要約 eligibilityStatus ではない)。VERIFIED_* 以外かつ非取消が対象。
    const verifiedEligibility: ReceptionQueueEntry["eligibility"] = {
      state: "VERIFIED_CARD",
      snapshotId: "snapshot-test-001",
      allowsProvisionalCalculation: true,
      allowsFinalCalculation: true,
    };
    const entries: readonly ReceptionQueueEntry[] = [
      entry({
        receptionId: "rc-1",
        receptionStatus: "WAITING",
        eligibility: verifiedEligibility,
      }),
      entry({
        receptionId: "rc-2",
        receptionStatus: "WAITING",
        patient: patient({ patientId: "patient-test-002", eligibilityStatus: "VERIFIED" }),
      }),
      entry({
        receptionId: "rc-3",
        receptionStatus: "IN_PROGRESS",
        eligibility: verifiedEligibility,
      }),
      entry({
        receptionId: "rc-4",
        receptionStatus: "COMPLETED",
        eligibility: verifiedEligibility,
      }),
      entry({
        receptionId: "rc-5",
        receptionStatus: "CANCELLED",
      }),
    ];
    expect(receptionQueueMetrics(entries)).toEqual({
      waiting: 2,
      inProgress: 1,
      completed: 1,
      eligibilityAttention: 1,
    });
  });

  it("returns zero counts for an empty queue", () => {
    expect(receptionQueueMetrics([])).toEqual({
      waiting: 0,
      inProgress: 0,
      completed: 0,
      eligibilityAttention: 0,
    });
  });
});

describe("ReceptionQueueMetricsView", () => {
  it("renders real counts when the queue is loaded", () => {
    const state: QueueState = {
      kind: "loaded",
      response: queueResponse("2026-07-09", [
        entry({ receptionId: "rc-1", receptionStatus: "WAITING" }),
        entry({ receptionId: "rc-2", receptionStatus: "COMPLETED" }),
      ]),
      refreshState: { kind: "idle" },
    };
    const html = renderToStaticMarkup(<ReceptionQueueMetricsView state={state} />);
    expect(html).toContain("待機中");
    expect(html).toContain("完了");
    expect(html).not.toContain("集計API未接続");
    expect(html).toContain("受付キューから集計");
  });

  it("does not show numbers while loading or after an error", () => {
    const loadingHtml = renderToStaticMarkup(
      <ReceptionQueueMetricsView state={{ kind: "loading" }} />,
    );
    expect(loadingHtml).toContain("取得中");
    const errorHtml = renderToStaticMarkup(
      <ReceptionQueueMetricsView
        state={{
          kind: "error",
          notice: { severity: "ERROR", message: "x", nextAction: "再試行してください。" },
        }}
      />,
    );
    expect(errorHtml).toContain("取得失敗");
    expect(errorHtml).not.toContain("取得中");
  });

  it("labels each count with the visual status registry wording (WP-5101 review)", () => {
    const state: QueueState = {
      kind: "loaded",
      response: queueResponse("2026-07-09", [
        entry({ receptionId: "rc-1", receptionStatus: "IN_PROGRESS" }),
      ]),
      refreshState: { kind: "idle" },
    };
    for (const html of [
      renderToStaticMarkup(<ReceptionQueueMetricsView state={state} />),
      renderToStaticMarkup(<ReceptionQueueMetricsView state={{ kind: "loading" }} />),
    ]) {
      expect(html).toContain(RECEPTION_STATUS_LABELS.IN_PROGRESS);
      expect(html).toContain(RECEPTION_STATUS_LABELS.WAITING);
      expect(html).toContain(RECEPTION_STATUS_LABELS.COMPLETED);
      expect(html).not.toContain("処理中");
    }
  });
});

describe("reception screen surface (SCR-001 refresh)", () => {
  it("makes the live queue table a keyboard-reachable scroll region", () => {
    // 静的シェルの表だけが focus 可能なスクロール領域を持つ逆転を防ぐ。
    const html = renderToStaticMarkup(
      <ReceptionQueueTable entries={[entry({ receptionId: "rc-scroll" })]} />,
    );

    expect(html).toContain(
      '<div class="table-scroll" role="region" tabindex="0" aria-label="受付キュー表。横方向にスクロールできます">',
    );
  });

  it("styles the business-date control with the shared operator primitives", () => {
    const html = renderToStaticMarkup(<ReceptionPage />);

    expect(html).toContain("表示日付");
    expect(html).toContain('class="operator-input"');
    expect(html).toContain(
      '<button type="submit" class="operator-button" data-kind="secondary">表示</button>',
    );
  });

  it("names the blocking gate on every disabled intake action", () => {
    const html = renderToStaticMarkup(<ReceptionPage />);

    for (const gate of [
      "SCR-005 BLOCKED_JAHIS_SPEC_ACQUISITION",
      "SCR-006 / RB-003 BLOCKED_REGULATORY_REVIEW",
      "UIX-001 §12.3 operation registry 未登録",
    ]) {
      expect(html).toContain(gate);
    }
    // 内部トークンは日本語の説明文と対で提示する(UIX-001 §11)。
    expect(html).toContain("JAHIS Ver.1.11 仕様本文の正規入手と evidence_id 発行が未了");
    expect(html).toContain("技術解説書2.04版以降の確認と境界SSOTのAPPROVEDが未了");
    expect(html).toContain("原本画像の取込・保存・抽出を定めるAPPROVED SSOTが未作成");
    expect(html).not.toContain("は接続・承認前のため実行できません");
  });

  it("replaces rail advice with a statement of what is and is not displayed", () => {
    const html = renderToStaticMarkup(<ReceptionPage />);

    expect(html).toContain("この画面が表示していること");
    expect(html).toContain("この画面が表示していないこと");
    expect(html).toContain("アラートが表示されないことは安全確認済みを意味しません");
    expect(html).toContain("表示されないことは該当なしを意味しません");
    expect(html).toContain(
      "資格状態は受付時点で保存されたスナップショットの表示であり",
    );
    // 根拠のない助言型コピーは残さない。
    expect(html).not.toContain("安全チェックのお願い");
    expect(html).not.toContain("システムからの提案");
    expect(html).not.toContain("資格確認が必要な受付を優先表示");
  });
});

