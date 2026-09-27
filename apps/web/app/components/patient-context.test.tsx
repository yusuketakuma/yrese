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


import { SAMPLE } from './patient-context-test-support';


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

