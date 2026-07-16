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
} from "./patient-context";

(globalThis as { React?: typeof React }).React = React;

const SAMPLE: PatientSearchResult = {
  patientId: "11111111-1111-4111-8111-111111111111",
  patientNumber: "P-0001",
  name: "山田 太郎",
  kana: "ヤマダ タロウ",
  birthDate: "1980-01-15",
  sex: "male",
  eligibilityStatus: "VERIFIED",
};

describe("toPatientContextData (R-PATCTX)", () => {
  it("projects the display fields and omits undefined eligibilityCheckedAt", () => {
    const data = toPatientContextData(SAMPLE);
    expect(data.patientId).toBe(SAMPLE.patientId);
    expect(data.kana).toBe("ヤマダ タロウ");
    expect("eligibilityCheckedAt" in data).toBe(false);
  });
});

describe("PatientContextBarView (全画面横断固定 H-01/H-02)", () => {
  it("fixes the selected patient identity with a clear-selection control", () => {
    const asOf = new Date("2026-07-11T00:00:00+09:00");
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={asOf}
      />,
    );
    expect(html).toContain('data-has-patient="true"');
    expect(html).toContain("選択中の患者(全画面共通の業務対象)");
    expect(html).toContain("ヤマダ タロウ");
    expect(html).toContain("山田 太郎");
    expect(html).toContain("1980-01-15");
    expect(html).toContain("46歳"); // 2026-07-11 時点(JST)で満46歳
    expect(html).toContain("選択解除");
  });
});

describe("PatientContextBar without provider", () => {
  it("renders nothing when no patient context is present", () => {
    expect(renderToStaticMarkup(<PatientContextBar />)).toBe("");
  });
});

describe("PatientContextBarView staleness (再取得失敗の明示)", () => {
  it("marks the bar as stale and shows the STALE badge when refresh failed", () => {
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={new Date("2026-07-11T00:00:00+09:00")}
        stale
      />,
    );
    expect(html).toContain('data-stale="true"');
    expect(html).toContain("情報が古い可能性");
  });

  it("does not show staleness by default", () => {
    const html = renderToStaticMarkup(
      <PatientContextBarView
        patient={toPatientContextData(SAMPLE)}
        onClear={() => undefined}
        asOf={new Date("2026-07-11T00:00:00+09:00")}
      />,
    );
    expect(html).toContain('data-stale="false"');
    expect(html).not.toContain("情報が古い可能性");
  });
});

describe("fetchPatientById (GET /patients/:patientId 契約)", () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const withDevEnv = async (run: () => Promise<void>) => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      await run();
    } finally {
      vi.unstubAllEnvs();
    }
  };

  it("returns the context projection for a 200 response", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async (input) => {
        expect(String(input)).toContain(`/patients/${SAMPLE.patientId}`);
        return jsonResponse(200, SAMPLE);
      };
      const data = await fetchPatientById(SAMPLE.patientId, stub);
      expect(data).toEqual(toPatientContextData(SAMPLE));
    });
  });

  it("rejects a schema-valid response for a different patient with a fixed non-echo error", async () => {
    await withDevEnv(async () => {
      const requestedId = SAMPLE.patientId;
      const returnedId = "22222222-2222-4222-8222-222222222222";
      const mismatched = {
        ...SAMPLE,
        patientId: returnedId,
        patientNumber: "SECRET-PATIENT-NUMBER",
        name: "秘密 名前",
        kana: "ヒミツ ナマエ",
      };
      const stub: typeof fetch = async () => jsonResponse(200, mismatched);

      let thrown: unknown;
      try {
        await fetchPatientById(requestedId, stub);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        "Patient refresh response identity mismatch",
      );
      const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
      expect(serialized).not.toContain(requestedId);
      expect(serialized).not.toContain(returnedId);
      expect(serialized).not.toContain("SECRET-PATIENT-NUMBER");
      expect(serialized).not.toContain("秘密 名前");
      expect(serialized).not.toContain("ヒミツ ナマエ");
    });
  });

  it("returns null only for a contract-valid PAT-0002 response", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () =>
        jsonResponse(404, {
          errorCode: "PAT-0002",
          message: "Patient unavailable",
        });
      expect(await fetchPatientById(SAMPLE.patientId, stub)).toBeNull();
    });
  });

  it.each([
    ["a bodyless response", () => new Response(null, { status: 404 })],
    [
      "invalid JSON",
      () =>
        new Response("{", {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    ],
    ["a missing message", () => jsonResponse(404, { errorCode: "PAT-0002" })],
    [
      "a blank message",
      () => jsonResponse(404, { errorCode: "PAT-0002", message: "" }),
    ],
    [
      "a non-string message",
      () => jsonResponse(404, { errorCode: "PAT-0002", message: 404 }),
    ],
    [
      "a missing error code",
      () => jsonResponse(404, { message: "Patient unavailable" }),
    ],
    [
      "an unregistered error code",
      () =>
        jsonResponse(404, {
          errorCode: "PAT-9999",
          message: "Patient unavailable",
        }),
    ],
    [
      "a registered non-removal error code",
      () =>
        jsonResponse(404, {
          errorCode: "PAT-0001",
          message: "SECRET patient response detail",
          patientId: SAMPLE.patientId,
        }),
    ],
  ])("rejects 404 with %s using a fixed non-echo error", async (_label, response) => {
    await withDevEnv(async () => {
      let thrown: unknown;
      try {
        await fetchPatientById(SAMPLE.patientId, async () => response());
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        "Patient refresh not-found response invalid",
      );
      const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
      expect(serialized).not.toContain(SAMPLE.patientId);
      expect(serialized).not.toContain("PAT-0001");
      expect(serialized).not.toContain("PAT-9999");
      expect(serialized).not.toContain("SECRET patient response detail");
    });
  });

  it("normalizes a synchronous 404 body read failure and reads the body once", async () => {
    await withDevEnv(async () => {
      const rawSentinel = `raw response detail ${SAMPLE.patientId} PAT-0002`;
      const json = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const stub: typeof fetch = async () =>
        ({ status: 404, json }) as unknown as Response;

      let thrown: unknown;
      try {
        await fetchPatientById(SAMPLE.patientId, stub);
      } catch (error) {
        thrown = error;
      }

      expect(json).toHaveBeenCalledOnce();
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        "Patient refresh not-found response invalid",
      );
      const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
      expect(serialized).not.toContain(rawSentinel);
      expect(serialized).not.toContain(SAMPLE.patientId);
      expect(serialized).not.toContain("PAT-0002");
    });
  });

  it("accepts a valid own-data 404 Proxy without invoking get or has traps", async () => {
    await withDevEnv(async () => {
      const propertyRead = vi.fn(() => {
        throw new Error("raw valid patient proxy property trap");
      });
      const body = new Proxy(
        { errorCode: "PAT-0002", message: "Patient unavailable" },
        {
          get(target, property, receiver) {
            return property === "errorCode" || property === "message"
              ? propertyRead()
              : Reflect.get(target, property, receiver);
          },
          has(_target, property) {
            return property === "errorCode" || property === "message"
              ? propertyRead()
              : false;
          },
        },
      );
      const json = vi.fn(() => body);
      const stub: typeof fetch = async () =>
        ({ status: 404, json }) as unknown as Response;

      await expect(fetchPatientById(SAMPLE.patientId, stub)).resolves.toBeNull();
      expect(json).toHaveBeenCalledOnce();
      expect(propertyRead).not.toHaveBeenCalled();
    });
  });

  it.each([
    [
      "a throwing own accessor",
      (trap: () => never) =>
        Object.defineProperty(
          { message: "Patient unavailable" },
          "errorCode",
          { enumerable: true, get: trap },
        ),
    ],
    [
      "a throwing descriptor Proxy",
      (trap: () => never) =>
        new Proxy(
          { errorCode: "PAT-0002", message: "Patient unavailable" },
          { getOwnPropertyDescriptor: trap },
        ),
    ],
  ] as const)(
    "normalizes 404 with %s without exposing hostile body details",
    async (_label, createBody) => {
      await withDevEnv(async () => {
        const rawSentinel = `raw hostile 404 ${SAMPLE.patientId} PAT-0002`;
        const trap = vi.fn((): never => {
          throw new Error(rawSentinel);
        });
        const body = createBody(trap);
        const stub: typeof fetch = async () =>
          ({ status: 404, json: () => body }) as unknown as Response;

        let thrown: unknown;
        try {
          await fetchPatientById(SAMPLE.patientId, stub);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe(
          "Patient refresh not-found response invalid",
        );
        expect(JSON.stringify(thrown, Object.getOwnPropertyNames(thrown))).not.toContain(
          rawSentinel,
        );
        expect(trap).toHaveBeenCalledTimes(
          _label === "a throwing descriptor Proxy" ? 1 : 0,
        );
      });
    },
  );

  it("rejects inherited 404 fields without reading inherited accessors", async () => {
    await withDevEnv(async () => {
      const getter = vi.fn(() => {
        throw new Error("raw inherited patient response getter");
      });
      const prototype = Object.defineProperties({}, {
        errorCode: { enumerable: true, get: getter },
        message: { enumerable: true, get: getter },
      });
      const body = Object.create(prototype);

      await expect(
        fetchPatientById(
          SAMPLE.patientId,
          async () =>
            ({ status: 404, json: () => body }) as unknown as Response,
        ),
      ).rejects.toThrow("Patient refresh not-found response invalid");
      expect(getter).not.toHaveBeenCalled();
    });
  });

  it("rejects an array root even when it carries valid own-data fields", async () => {
    await withDevEnv(async () => {
      const body = Object.assign([], {
        errorCode: "PAT-0002",
        message: "Patient unavailable",
      });

      await expect(
        fetchPatientById(
          SAMPLE.patientId,
          async () =>
            ({ status: 404, json: () => body }) as unknown as Response,
        ),
      ).rejects.toThrow("Patient refresh not-found response invalid");
    });
  });

  it("throws on other failures (呼び出し側が stale 扱いを判断)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () => jsonResponse(500, {});
      await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow("HTTP 500");
    });
  });

  it("forwards an optional abort signal only to the fetch transport", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const controller = new AbortController();

    try {
      await fetchPatientById(SAMPLE.patientId, fetchImpl, controller.signal);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(encodeURIComponent(SAMPLE.patientId)),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it.each([201, 202, 204, 206])(
    "rejects unsupported success status %i before reading the response body",
    async (status) => {
      await withDevEnv(async () => {
        const json = vi.fn(async () => SAMPLE);
        const response = { status, ok: true, json } as unknown as Response;
        const stub: typeof fetch = async () => response;

        await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow(
          `patient refresh failed (HTTP ${status})`,
        );
        expect(json).not.toHaveBeenCalled();
      });
    },
  );

  it("keeps unsupported-status diagnostics free of response PHI and identity data", async () => {
    await withDevEnv(async () => {
      const returnedId = "22222222-2222-4222-8222-222222222222";
      const body = {
        ...SAMPLE,
        patientId: returnedId,
        patientNumber: "SECRET-PATIENT-NUMBER",
        name: "秘密 名前",
        kana: "ヒミツ ナマエ",
      };
      const stub: typeof fetch = async () => jsonResponse(202, body);

      let thrown: unknown;
      try {
        await fetchPatientById(SAMPLE.patientId, stub);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe("patient refresh failed (HTTP 202)");
      const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
      expect(serialized).not.toContain(SAMPLE.patientId);
      expect(serialized).not.toContain(returnedId);
      expect(serialized).not.toContain("SECRET-PATIENT-NUMBER");
      expect(serialized).not.toContain("秘密 名前");
      expect(serialized).not.toContain("ヒミツ ナマエ");
    });
  });

  it("rejects contract drift (契約外レスポンスを表示に流さない)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () => jsonResponse(200, { patientId: SAMPLE.patientId });
      await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow();
    });
  });
});

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
