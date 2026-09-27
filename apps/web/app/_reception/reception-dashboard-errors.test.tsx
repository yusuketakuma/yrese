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

describe('reception dashboard error/notice handling', () => {
  it("does not inspect a hostile rejected error and admits retry", async () => {
    const rawSentinel = "raw reception instanceof trap";
    const propertyRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const hostileError = new Proxy(
      {},
      {
        get: propertyRead,
        has: propertyRead,
        getPrototypeOf: propertyRead,
      },
    );
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockRejectedValueOnce(hostileError)
      .mockResolvedValueOnce(queueResponse("2026-07-10"));
    let state: QueueState = { kind: "loading" };
    const run = createReceptionQueueRunner(fetcher, (update) => {
      state = update(state);
    });

    await run("2026-07-10");

    expect(propertyRead).not.toHaveBeenCalled();
    expect(state).toEqual({
      kind: "error",
      notice: {
        message: "受付一覧の処理に失敗しました。",
        nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      },
    });
    expect(JSON.stringify(state)).not.toContain(rawSentinel);

    await run("2026-07-10");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(state.kind).toBe("loaded");
  });

  it.each([
    [
      "prototype-forged error",
      () =>
        Object.assign(Object.create(ReceptionError.prototype), {
          message: "raw forged reception message",
          nextAction: "raw forged reception action",
          errorCode: "AUTH-0003",
        }),
    ],
    [
      "externally constructed error",
      () =>
        new ReceptionError(
          "raw external reception message",
          "raw external reception action",
          "AUTH-0003",
        ),
    ],
  ])("does not trust a %s as queue notice authority", async (_case, createError) => {
    const untrustedError = createError();
    const directNotice = ReceptionError.prototype.toNotice.call(untrustedError);
    expect(directNotice).toEqual({
      message: "受付の処理に失敗しました。",
      nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(Object.isFrozen(directNotice)).toBe(true);
    const fetcher = vi.fn<() => Promise<ReceptionQueueResponse>>().mockRejectedValue(
      untrustedError,
    );
    let state: QueueState = { kind: "loading" };
    const run = createReceptionQueueRunner(fetcher, (update) => {
      state = update(state);
    });

    await run("2026-07-10");

    const finalState = state as QueueState;
    expect(finalState).toEqual({
      kind: "error",
      notice: {
        message: "受付一覧の処理に失敗しました。",
        nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      },
    });
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("raw forged reception");
    expect(serialized).not.toContain("raw external reception");
    expect(serialized).not.toContain("AUTH-0003");
  });

  it("does not inspect a hostile receiver passed directly to toNotice", () => {
    const rawSentinel = "raw reception toNotice receiver trap";
    const propertyRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const hostileReceiver = new Proxy(
      {},
      {
        get: propertyRead,
        has: propertyRead,
        getPrototypeOf: propertyRead,
      },
    );

    const notice = ReceptionError.prototype.toNotice.call(
      hostileReceiver as ReceptionError,
    );

    expect(propertyRead).not.toHaveBeenCalled();
    expect(notice).toEqual({
      message: "受付の処理に失敗しました。",
      nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(Object.isFrozen(notice)).toBe(true);
    expect(JSON.stringify(notice)).not.toContain(rawSentinel);
  });

  it("does not invoke forged receiver getters through direct toNotice", () => {
    const getter = vi.fn(() => {
      throw new Error("raw forged reception getter");
    });
    const forgedReceiver = Object.create(ReceptionError.prototype);
    for (const property of ["message", "nextAction", "errorCode"]) {
      Object.defineProperty(forgedReceiver, property, { get: getter });
    }

    const notice = ReceptionError.prototype.toNotice.call(forgedReceiver);

    expect(getter).not.toHaveBeenCalled();
    expect(notice).toEqual({
      message: "受付の処理に失敗しました。",
      nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(Object.isFrozen(notice)).toBe(true);
  });

  it("uses the frozen trusted 403 snapshot and clears a previously verified queue", async () => {
    let trustedError: unknown;
    try {
      await withNodeEnv("development", () =>
        fetchReceptionQueue(
          "2026-07-10",
          vi.fn().mockResolvedValue(jsonResponse(403, { errorCode: "AUTH-0003" })),
        ),
      );
    } catch (error) {
      trustedError = error;
    }
    expect(trustedError).toBeInstanceOf(ReceptionError);
    Object.assign(trustedError as object, {
      message: "raw mutated reception message",
      nextAction: "raw mutated reception action",
      errorCode: "SYSTEM-9999",
    });
    const directNotice = (trustedError as ReceptionError).toNotice();
    expect(directNotice).toEqual({
      message: "権限がありません。",
      nextAction:
        "管理者に権限(reception:read / patient:read)の付与状況を確認してください。",
      errorCode: "AUTH-0003",
    });
    expect(Object.isFrozen(directNotice)).toBe(true);
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockRejectedValue(trustedError);
    const clearSensitiveState = vi.fn();
    let state: QueueState = {
      kind: "loaded",
      response: queueResponse("2026-07-09", [entry({ receptionId: "stale-phi" })]),
      loadedAt: "08:15",
      refreshState: { kind: "idle" },
    };
    const run = createReceptionQueueRunner(
      fetcher,
      (update) => {
        state = update(state);
      },
      clearSensitiveState,
    );

    await run("2026-07-10");

    const finalState = state as QueueState;
    expect(finalState).toEqual({
      kind: "error",
      notice: {
        message: "権限がありません。",
        nextAction:
          "管理者に権限(reception:read / patient:read)の付与状況を確認してください。",
        errorCode: "AUTH-0003",
      },
    });
    if (finalState.kind !== "error") throw new Error("expected trusted queue failure");
    expect(Object.isFrozen(finalState.notice)).toBe(true);
    expect(JSON.stringify(finalState)).not.toContain("raw mutated reception");
    expect(JSON.stringify(finalState)).not.toContain("SYSTEM-9999");
    expect(clearSensitiveState).toHaveBeenCalledOnce();
  });

  it("maps 409 idempotency conflicts to a duplicate-operation notice (RCV-0003)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { errorCode: "RCV-0003", message: "conflict" }));

    await expect(
      withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-1"),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ReceptionError);
      const notice = (error as ReceptionError).toNotice();
      expect(notice.message).toContain("同じ操作キーが別の患者で再利用されました");
      expect(notice.nextAction).toContain("受付一覧を更新");
      expect(notice.errorCode).toBe("RCV-0003");
      return true;
    });

    // idempotencyKey がリクエストボディで送られている
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(fetchImpl.mock.calls[0]![0]).toBe("/_yrese-api/reception");
    expect(init.headers).toMatchObject({
      "x-dev-scopes": "reception:write,patient:read",
    });
    expect(String(init.body)).toContain('"idempotencyKey":"key-1"');
  });

  it.each([
    ["queue", 400, "RCV-0001", "AUTH-0003"],
    ["queue", 403, "AUTH-0003", "RCV-0003"],
    ["create", 400, "RCV-0001", "RCV-0002"],
    ["create", 403, "AUTH-0003", "RCV-0001"],
    ["create", 404, "RCV-0002", "PAT-0001"],
    ["create", 409, "RCV-0003", "AUTH-0003"],
  ] as const)(
    "binds %s HTTP %s error codes to the API-006 tuple",
    async (operation, status, expectedCode, wrongRegisteredCode) => {
      const invoke = (errorCode: string) => {
        const fetchImpl = vi
          .fn()
          .mockResolvedValue(jsonResponse(status, {
            errorCode,
            message: "raw reception error body",
          }));
        return operation === "queue"
          ? withNodeEnv("development", () =>
              fetchReceptionQueue("2026-07-10", fetchImpl),
            )
          : withNodeEnv("development", () =>
              createReception("patient-test-001", fetchImpl, "key-status-binding"),
            );
      };

      await expect(invoke(expectedCode)).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ReceptionError);
        const notice = (error as ReceptionError).toNotice();
        expect(notice.errorCode).toBe(expectedCode);
        expect(JSON.stringify(notice)).not.toContain("raw reception error body");
        return true;
      });
      await expect(invoke(wrongRegisteredCode)).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ReceptionError);
        const notice = (error as ReceptionError).toNotice();
        expect(notice.errorCode).toBeUndefined();
        expect(JSON.stringify(notice)).not.toContain(wrongRegisteredCode);
        expect(JSON.stringify(notice)).not.toContain("raw reception error body");
        return true;
      });
    },
  );

  it.each([
    ["queue", 404, "RCV-0002"],
    ["queue", 409, "RCV-0003"],
    ["queue", 500, "AUTH-0003"],
    ["create", 500, "RCV-0003"],
  ] as const)(
    "omits registered codes for contract-unsupported %s HTTP %s responses",
    async (operation, status, errorCode) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(status, { errorCode, message: "raw unsupported status body" }),
      );
      const request =
        operation === "queue"
          ? withNodeEnv("development", () =>
              fetchReceptionQueue("2026-07-10", fetchImpl),
            )
          : withNodeEnv("development", () =>
              createReception("patient-test-001", fetchImpl, "key-unsupported-status"),
            );

      await expect(request).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ReceptionError);
        const notice = (error as ReceptionError).toNotice();
        expect(notice.errorCode).toBeUndefined();
        expect(JSON.stringify(notice)).not.toContain(errorCode);
        expect(JSON.stringify(notice)).not.toContain("raw unsupported status body");
        return true;
      });
    },
  );

  it("preserves fixed queue guidance when error JSON throws synchronously", async () => {
    const rawSentinel = "raw synchronous queue error body";
    const json = vi.fn(() => {
      throw { errorCode: "AUTH-0003", message: rawSentinel };
    });
    const fetchImpl: typeof fetch = async () =>
      ({ ok: false, status: 403, json }) as unknown as Response;

    let caught: unknown;
    try {
      await withNodeEnv("development", () =>
        fetchReceptionQueue("2026-07-10", fetchImpl),
      );
    } catch (error) {
      caught = error;
    }

    expect(json).toHaveBeenCalledOnce();
    expect(caught).toBeInstanceOf(ReceptionError);
    expect((caught as ReceptionError).toNotice()).toEqual({
      message: "権限がありません。",
      nextAction:
        "管理者に権限(reception:read / patient:read)の付与状況を確認してください。",
    });
    expect(JSON.stringify((caught as ReceptionError).toNotice())).not.toContain(rawSentinel);
  });

  it("preserves fixed idempotency-conflict guidance when error JSON rejects", async () => {
    const rawSentinel = "raw asynchronous reception error body";
    const json = vi.fn(() =>
      Promise.reject({ errorCode: "RCV-0003", message: rawSentinel }),
    );
    const fetchImpl: typeof fetch = async () =>
      ({ ok: false, status: 409, json }) as unknown as Response;

    let caught: unknown;
    try {
      await withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-json-reject"),
      );
    } catch (error) {
      caught = error;
    }

    expect(json).toHaveBeenCalledOnce();
    expect(caught).toBeInstanceOf(ReceptionError);
    expect((caught as ReceptionError).toNotice()).toEqual({
      message: "同じ操作キーが別の患者で再利用されました(二重操作の可能性)。",
      nextAction:
        "受付一覧を更新して受付状況を確認してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(JSON.stringify((caught as ReceptionError).toNotice())).not.toContain(rawSentinel);
  });

  it.each([
    ["synchronous resolution", (body: unknown) => body],
    ["asynchronous resolution", (body: unknown) => Promise.resolve(body)],
  ])(
    "does not invoke error-code has/get traps after %s",
    async (_case, resolveBody) => {
      const rawSentinel = "raw reception error-code trap";
      const propertyRead = vi.fn(() => {
        throw new Error(rawSentinel);
      });
      const body = new Proxy(
        {},
        {
          get(target, property, receiver) {
            return property === "errorCode"
              ? propertyRead()
              : Reflect.get(target, property, receiver);
          },
          has(_target, property) {
            return property === "errorCode" ? propertyRead() : false;
          },
        },
      );
      const json = vi.fn(() => resolveBody(body));
      const fetchImpl: typeof fetch = async () =>
        ({ ok: false, status: 409, json }) as unknown as Response;

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          createReception("patient-test-001", fetchImpl, "key-hostile-body"),
        );
      } catch (error) {
        caught = error;
      }

      expect(json).toHaveBeenCalledOnce();
      expect(propertyRead).not.toHaveBeenCalled();
      expect(caught).toBeInstanceOf(ReceptionError);
      expect((caught as ReceptionError).toNotice()).toEqual({
        message: "同じ操作キーが別の患者で再利用されました(二重操作の可能性)。",
        nextAction:
          "受付一覧を更新して受付状況を確認してください。解消しない場合はシステム管理者へ連絡してください。",
      });
    },
  );

  it("ignores inherited and accessor error codes without invoking a getter", async () => {
    const getter = vi.fn(() => {
      throw new Error("raw reception error-code getter");
    });
    const inheritedBody = Object.create({ errorCode: "RCV-0003" });
    const accessorBody = Object.defineProperty({}, "errorCode", {
      enumerable: true,
      get: getter,
    });

    for (const [index, body] of [inheritedBody, accessorBody].entries()) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, body));
      await expect(
        withNodeEnv("development", () =>
          createReception("patient-test-001", fetchImpl, `key-untrusted-code-${index}`),
        ),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ReceptionError);
        expect((error as ReceptionError).errorCode).toBeUndefined();
        return true;
      });
    }

    expect(getter).not.toHaveBeenCalled();
  });

  it("normalizes a throwing error-code descriptor trap to fixed conflict guidance", async () => {
    const rawSentinel = "raw reception descriptor trap";
    const descriptorRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    const body = new Proxy({}, { getOwnPropertyDescriptor: descriptorRead });
    const json = vi.fn(() => body);
    const fetchImpl: typeof fetch = async () =>
      ({ ok: false, status: 409, json }) as unknown as Response;

    let caught: unknown;
    try {
      await withNodeEnv("development", () =>
        createReception("patient-test-001", fetchImpl, "key-descriptor-trap"),
      );
    } catch (error) {
      caught = error;
    }

    expect(json).toHaveBeenCalledOnce();
    expect(descriptorRead).toHaveBeenCalledOnce();
    expect(caught).toBeInstanceOf(ReceptionError);
    expect((caught as ReceptionError).toNotice()).toEqual({
      message: "同じ操作キーが別の患者で再利用されました(二重操作の可能性)。",
      nextAction:
        "受付一覧を更新して受付状況を確認してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(JSON.stringify((caught as ReceptionError).toNotice())).not.toContain(rawSentinel);
  });

  it.each([200, 201])(
    "returns a matching reception response for HTTP %s",
    async (status) => {
      const matchingEntry = entry({
        patient: patient({ patientId: "patient-requested-001" }),
      });
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, matchingEntry));

      const result = await withNodeEnv("development", () =>
        createReception("patient-requested-001", fetchImpl, `key-match-${status}`),
      );

      expect(result).toEqual(matchingEntry);
    },
  );

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "rejects a newly created reception in %s without echoing reception data",
    async (receptionStatus) => {
      const sensitiveEntry = entry({
        receptionId: "reception-created-status-sensitive",
        receptionStatus,
        patient: patient({
          patientId: "patient-requested-001",
          name: "合成 状態患者",
          kana: "ゴウセイ ジョウタイカンジャ",
          patientNumber: "STATUS-SENSITIVE-001",
        }),
      });
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, sensitiveEntry));

      await expect(
        withNodeEnv("development", () =>
          createReception("patient-requested-001", fetchImpl, `key-status-${receptionStatus}`),
        ),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          "Created reception response did not start in WAITING status",
        );
        for (const sensitiveValue of [
          sensitiveEntry.receptionId,
          sensitiveEntry.receptionStatus,
          sensitiveEntry.patient.patientId,
          sensitiveEntry.patient.name,
          sensitiveEntry.patient.kana,
          sensitiveEntry.patient.patientNumber,
        ]) {
          expect((error as Error).message).not.toContain(sensitiveValue);
        }
        return true;
      });
    },
  );

  it.each(["WAITING", "COMPLETED"] as const)(
    "rejects unsupported HTTP 202 with a %s body before reception success handling",
    async (receptionStatus) => {
      const sensitiveEntry = entry({
        receptionId: "reception-unsupported-status-sensitive",
        receptionStatus,
        patient: patient({
          patientId: "patient-requested-001",
          name: "合成 応答患者",
          kana: "ゴウセイ オウトウカンジャ",
          patientNumber: "HTTP-STATUS-SENSITIVE-001",
        }),
      });

      await expect(
        withNodeEnv("development", () =>
          createReception(
            "patient-requested-001",
            vi.fn().mockResolvedValue(jsonResponse(202, sensitiveEntry)),
            `key-http-202-${receptionStatus}`,
          ),
        ),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          "Reception response used an unsupported success status",
        );
        for (const sensitiveValue of [
          sensitiveEntry.receptionId,
          sensitiveEntry.receptionStatus,
          sensitiveEntry.patient.patientId,
          sensitiveEntry.patient.name,
          sensitiveEntry.patient.kana,
          sensitiveEntry.patient.patientNumber,
        ]) {
          expect((error as Error).message).not.toContain(sensitiveValue);
        }
        return true;
      });
    },
  );

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "accepts an existing HTTP 200 reception in %s",
    async (receptionStatus) => {
      const existing = entry({
        receptionStatus,
        patient: patient({ patientId: "patient-requested-001" }),
      });
      const result = await withNodeEnv("development", () =>
        createReception(
          "patient-requested-001",
          vi.fn().mockResolvedValue(jsonResponse(200, existing)),
          `key-existing-${receptionStatus}`,
        ),
      );
      expect(result).toEqual(existing);
    },
  );

  it.each([200, 201])(
    "rejects a mismatched reception response for HTTP %s without echoing patient data",
    async (status) => {
      const requestedPatientId = "patient-requested-sensitive";
      const returnedPatientId = "patient-returned-sensitive";
      const returnedName = "合成 別患者";
      const returnedKana = "ゴウセイ ベツカンジャ";
      const returnedPatientNumber = "SENSITIVE-999";
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(
          status,
          entry({
            receptionId: "reception-returned-sensitive",
            patient: patient({
              patientId: returnedPatientId,
              name: returnedName,
              kana: returnedKana,
              patientNumber: returnedPatientNumber,
            }),
          }),
        ),
      );

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          createReception(requestedPatientId, fetchImpl, `key-mismatch-${status}`),
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        "Reception response patient identity mismatch",
      );
      for (const sensitiveValue of [
        requestedPatientId,
        returnedPatientId,
        returnedName,
        returnedKana,
        returnedPatientNumber,
        "reception-returned-sensitive",
      ]) {
        expect((caught as Error).message).not.toContain(sensitiveValue);
      }
    },
  );

  it("does not display unregistered error codes verbatim", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { errorCode: "SYSTEM-9999" }));

    await expect(
      withNodeEnv("development", () =>
        createReception("p1", fetchImpl, "key-2"),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expect((error as ReceptionError).errorCode).toBeUndefined();
      return true;
    });
  });

});
