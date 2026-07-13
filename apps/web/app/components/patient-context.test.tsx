import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PatientSearchResult } from "@yrese/contracts";

import {
  PatientContextBar,
  PatientContextBarView,
  createPatientClearHandler,
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

  it("returns null on 404 (対象患者が参照不能)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () =>
        jsonResponse(404, { errorCode: "PAT-0002", message: "x" });
      expect(await fetchPatientById(SAMPLE.patientId, stub)).toBeNull();
    });
  });

  it("throws on other failures (呼び出し側が stale 扱いを判断)", async () => {
    await withDevEnv(async () => {
      const stub: typeof fetch = async () => jsonResponse(500, {});
      await expect(fetchPatientById(SAMPLE.patientId, stub)).rejects.toThrow("HTTP 500");
    });
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

    const refresh = runner.refresh(SAMPLE.patientId, events);
    const clearPatient = vi.fn();
    createPatientClearHandler(runner, clearPatient)();
    pending.resolve(toPatientContextData(SAMPLE));
    await refresh;

    expect(clearPatient).toHaveBeenCalledOnce();
    expect(events.onFresh).not.toHaveBeenCalled();
    expect(events.onRemoved).not.toHaveBeenCalled();
    expect(events.onFailure).not.toHaveBeenCalled();
  });

  it("invalidates the refresh before clearing the selected patient", () => {
    const order: string[] = [];
    const handler = createPatientClearHandler(
      { invalidate: () => order.push("invalidate") },
      () => order.push("clear"),
    );

    handler();

    expect(order).toEqual(["invalidate", "clear"]);
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
        new Response(JSON.stringify({ errorCode: "PAT-0002" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
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
