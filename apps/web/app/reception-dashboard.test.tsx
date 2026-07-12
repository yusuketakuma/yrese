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
  ReceptionError,
  ReceptionQueueTable,
  ReceptionQueueView,
  clearRegistrationInputIfUnchanged,
  createReception,
  createReceptionQueueRunner,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  fetchReceptionQueue,
  formatAcceptedTime,
  parseDateParam,
  type QueueState,
  todayAsIsoDate,
} from "./reception-dashboard";

function patient(over: Partial<PatientSearchResult>): PatientSearchResult {
  return {
    patientId: "patient-test-001",
    name: "合成 太郎",
    kana: "ゴウセイ タロウ",
    birthDate: "1990-01-01",
    sex: "male",
    patientNumber: "T-0001",
    eligibilityStatus: "VERIFIED",
    ...over,
  };
}

function entry(over: Partial<ReceptionQueueEntry>): ReceptionQueueEntry {
  return {
    receptionId: "rc-test-001",
    patient: patient({}),
    acceptedAt: "2026-07-09T00:15:00.000Z",
    receptionStatus: "WAITING",
    prescriptionIntakeType: "paper",
    ...over,
  };
}

function queueResponse(
  date: string,
  entries: readonly ReceptionQueueEntry[] = [],
): ReceptionQueueResponse {
  return { date, entries: [...entries] };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function deferredValue<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function withNodeEnv<T>(
  nodeEnv: string,
  run: () => Promise<T>,
): Promise<T> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
  try {
    return await run();
  } finally {
    vi.unstubAllEnvs();
  }
}

describe("reception dashboard (WP-3009-UI / SCR-001)", () => {
  it("fails before reception fetches when the production API base is missing (WP-4067)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const queueFetch = vi.fn();
    const createFetch = vi.fn();
    const sensitivePatientId = "patient-secret-001";

    let queueError: unknown;
    let createError: unknown;
    try {
      await fetchReceptionQueue("2026-07-10", queueFetch);
    } catch (error) {
      queueError = error;
    }
    try {
      await createReception(sensitivePatientId, createFetch, "key-transport");
    } catch (error) {
      createError = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(queueFetch).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(queueError).toBeInstanceOf(Error);
    expect(createError).toBeInstanceOf(Error);
    expect((createError as Error).message).not.toContain(sensitivePatientId);
  });

  it("fails before reception fetches when production API base uses plaintext HTTP (WP-4080)", async () => {
    const sensitiveBase = "http://patient-data.internal.example.test/private";
    const sensitivePatientId = "patient-secret-001";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", sensitiveBase);
    const queueFetch = vi.fn();
    const createFetch = vi.fn();

    let queueError: unknown;
    let createError: unknown;
    try {
      await fetchReceptionQueue("2026-07-10", queueFetch);
    } catch (error) {
      queueError = error;
    }
    try {
      await createReception(sensitivePatientId, createFetch, "key-transport-http");
    } catch (error) {
      createError = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(queueFetch).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(queueError).toBeInstanceOf(Error);
    expect(createError).toBeInstanceOf(Error);
    expect((queueError as Error).message).not.toContain(sensitiveBase);
    expect((createError as Error).message).not.toContain(sensitiveBase);
    expect((createError as Error).message).not.toContain(sensitivePatientId);
  });

  it("renders queue rows with text status labels and patient juxtaposition", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[
          entry({ receptionId: "rc-1", receptionStatus: "WAITING" }),
          entry({
            receptionId: "rc-2",
            receptionStatus: "CANCELLED",
            patient: patient({ patientId: "p2", patientNumber: "T-0002" }),
          }),
        ]}
      />,
    );

    // 状態はテキストラベル(色非依存)
    expect(html).toContain("待機中");
    expect(html).toContain("取消済み");
    expect(html).toContain('data-status="WAITING"');
    // 取り違え防止: カナ・氏名・生年月日・患者番号の並置
    expect(html).toContain("ゴウセイ タロウ");
    expect(html).toContain("合成 太郎");
    expect(html).toContain("1990-01-01");
    expect(html).toContain("T-0002");
    // 処方箋区分ラベル
    expect(html).toContain("紙");
    // 受付時刻は formatAcceptedTime と同一表記
    expect(html).toContain(formatAcceptedTime("2026-07-09T00:15:00.000Z"));
  });

  it("formats acceptedAt as a JST clock time", () => {
    // 2026-07-09T20:15:00Z = JST 2026-07-10 05:15
    expect(formatAcceptedTime("2026-07-09T20:15:00.000Z")).toBe("05:15");
  });

  it("shows EmptyState for an empty queue and ErrorNotice for errors", () => {
    const empty = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: { date: "2026-07-09", entries: [] },
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(empty).toContain("2026-07-09 の受付はまだありません");
    expect(empty).toContain('role="status"');

    const error = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "error",
          notice: { message: "権限がありません。", nextAction: "管理者に確認してください。" },
        }}
      />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain("次のアクション:");
  });

  it("sends the explicit date to the API (no implicit today on the server)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { date: "2026-07-01", entries: [] }),
    );

    const response = await withNodeEnv("development", () =>
      fetchReceptionQueue("2026-07-01", fetchImpl),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0]![0]);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(url).toBe("/_yrese-api/reception/queue?date=2026-07-01");
    expect(init.headers).toMatchObject({
      "x-dev-scopes": "reception:read,patient:read",
    });
    expect(response.entries).toEqual([]);
  });

  it("discards stale queue responses so the last displayed date wins", async () => {
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-08"),
        refreshState: { kind: "idle" },
      },
    ];
    const emit = (update: (prev: QueueState) => QueueState) => {
      states.push(update(states[states.length - 1]!));
    };
    let resolveFirst!: (response: ReceptionQueueResponse) => void;
    const fetcher = vi
      .fn<(targetDate: string) => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(
        () =>
          new Promise<ReceptionQueueResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(queueResponse("2026-07-10", [entry({ receptionId: "rc-new" })])),
      );

    const run = createReceptionQueueRunner(fetcher, emit);
    const first = run("2026-07-09");
    const second = run("2026-07-10");
    await second;
    resolveFirst(queueResponse("2026-07-09", [entry({ receptionId: "rc-old" })]));
    await first;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.response.date).toBe("2026-07-10");
      expect(last.response.entries.map((queueEntry) => queueEntry.receptionId)).toEqual([
        "rc-new",
      ]);
    }
  });

  it("discards stale queue failures so an older error does not mask newer results", async () => {
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-08"),
        refreshState: { kind: "idle" },
      },
    ];
    const emit = (update: (prev: QueueState) => QueueState) => {
      states.push(update(states[states.length - 1]!));
    };
    let rejectFirst!: (reason: Error) => void;
    const fetcher = vi
      .fn<(targetDate: string) => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(
        () =>
          new Promise<ReceptionQueueResponse>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(queueResponse("2026-07-10", [entry({ receptionId: "rc-new" })])),
      );

    const run = createReceptionQueueRunner(fetcher, emit);
    const first = run("2026-07-09");
    const second = run("2026-07-10");
    await second;
    rejectFirst(new Error("stale queue failure"));
    await first;

    expect(states[states.length - 1]!.kind).toBe("loaded");
  });

  it("uses initial loading/error semantics and accepts only a matching response date", async () => {
    const states: QueueState[] = [{ kind: "loading" }];
    const emit = (update: (prev: QueueState) => QueueState) => {
      states.push(update(states[states.length - 1]!));
    };
    const fetcher = vi
      .fn<(target: string) => Promise<ReceptionQueueResponse>>()
      .mockResolvedValueOnce(queueResponse("2026-07-10"))
      .mockRejectedValueOnce(new Error("raw initial queue failure"));
    const run = createReceptionQueueRunner(fetcher, emit);

    await run("2026-07-10");
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10" },
      refreshState: { kind: "idle" },
    });

    states.splice(0, states.length, { kind: "loading" });
    await run("2026-07-11");
    expect(states.at(-1)).toMatchObject({
      kind: "error",
      notice: { message: "受付一覧の処理に失敗しました。" },
    });
    expect(JSON.stringify(states.at(-1))).not.toContain("raw initial queue failure");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retains exact nonempty data and timestamp through B loading/failure, then replaces them on retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T03:34:00.000Z"));
    try {
      const retainedResponse = queueResponse("2026-07-10", [
        entry({ receptionId: "retained" }),
      ]);
      const replacementResponse = queueResponse("2026-07-11", [
        entry({ receptionId: "replacement" }),
      ]);
      const pendingFailure = deferredValue<ReceptionQueueResponse>();
      const states: QueueState[] = [
        {
          kind: "loaded",
          response: retainedResponse,
          loadedAt: "08:15",
          refreshState: { kind: "idle" },
        },
      ];
      const fetcher = vi
        .fn<(target: string) => Promise<ReceptionQueueResponse>>()
        .mockImplementationOnce(() => pendingFailure.promise)
        .mockResolvedValueOnce(replacementResponse);
      const run = createReceptionQueueRunner(fetcher, (update) => {
        states.push(update(states[states.length - 1]!));
      });

      const failedRun = run("2026-07-11");
      const loading = states.at(-1)!;
      expect(loading.kind).toBe("loaded");
      if (loading.kind !== "loaded") throw new Error("expected retained loading state");
      expect(loading.response).toBe(retainedResponse);
      expect(loading.loadedAt).toBe("08:15");
      expect(loading.refreshState).toEqual({
        kind: "loading",
        requestTarget: "2026-07-11",
      });

      pendingFailure.reject(new Error("raw retained failure must not appear"));
      await failedRun;
      const failed = states.at(-1)!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained error state");
      expect(failed.response).toBe(retainedResponse);
      expect(failed.loadedAt).toBe("08:15");
      expect(failed.refreshState).toMatchObject({
        kind: "error",
        requestTarget: "2026-07-11",
        notice: { message: "受付一覧の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("raw retained failure");

      await run("2026-07-11");
      const retried = states.at(-1)!;
      expect(retried.kind).toBe("loaded");
      if (retried.kind === "loaded") {
        expect(retried.response).toBe(replacementResponse);
        expect(retried.loadedAt).toBe("12:34");
        expect(retried.refreshState).toEqual({ kind: "idle" });
      }
      expect(fetcher.mock.calls).toEqual([["2026-07-11"], ["2026-07-11"]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retains an empty A response and its timestamp through B loading and failure", async () => {
    const retainedResponse = queueResponse("2026-07-10");
    const pending = deferredValue<ReceptionQueueResponse>();
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: retainedResponse,
        loadedAt: "09:05",
        refreshState: { kind: "idle" },
      },
    ];
    const run = createReceptionQueueRunner(() => pending.promise, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const request = run("2026-07-11");
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10", entries: [] },
      loadedAt: "09:05",
      refreshState: { kind: "loading", requestTarget: "2026-07-11" },
    });
    pending.reject(new Error("synthetic empty refresh failure"));
    await request;
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10", entries: [] },
      loadedAt: "09:05",
      refreshState: { kind: "error", requestTarget: "2026-07-11" },
    });
  });

  it("rejects current mismatched response dates without echoing the actual date", async () => {
    const retainedResponse = queueResponse("2026-07-10", [entry({ receptionId: "a" })]);
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: retainedResponse,
        loadedAt: "07:40",
        refreshState: { kind: "idle" },
      },
    ];
    const run = createReceptionQueueRunner(
      () => Promise.resolve(queueResponse("2099-12-31")),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    await run("2026-07-11");
    const retained = states.at(-1)!;
    expect(retained.kind).toBe("loaded");
    if (retained.kind === "loaded") {
      expect(retained.response).toBe(retainedResponse);
      expect(retained.loadedAt).toBe("07:40");
      expect(retained.refreshState).toMatchObject({
        kind: "error",
        requestTarget: "2026-07-11",
        notice: { message: "受付一覧の応答日付が要求日付と一致しません。" },
      });
    }
    expect(JSON.stringify(retained)).not.toContain("2099-12-31");

    const initialStates: QueueState[] = [{ kind: "loading" }];
    const initialRun = createReceptionQueueRunner(
      () => Promise.resolve(queueResponse("2099-12-31")),
      (update) => initialStates.push(update(initialStates[initialStates.length - 1]!)),
    );
    await initialRun("2026-07-11");
    expect(initialStates.at(-1)).toMatchObject({
      kind: "error",
      notice: { message: "受付一覧の応答日付が要求日付と一致しません。" },
    });
    expect(JSON.stringify(initialStates.at(-1))).not.toContain("2099-12-31");
  });

  it("emits nothing for stale A/B success, failure, or mismatch after current C wins", async () => {
    const staleSuccess = deferredValue<ReceptionQueueResponse>();
    const staleFailure = deferredValue<ReceptionQueueResponse>();
    const states: QueueState[] = [
      {
        kind: "loaded",
        response: queueResponse("2026-07-09"),
        refreshState: { kind: "idle" },
      },
    ];
    const fetcher = vi
      .fn<(target: string) => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(() => staleSuccess.promise)
      .mockImplementationOnce(() => staleFailure.promise)
      .mockResolvedValueOnce(queueResponse("2026-07-12"));
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const a = run("2026-07-10");
    const b = run("2026-07-11");
    await run("2026-07-12");
    const countAfterC = states.length;
    staleSuccess.resolve(queueResponse("2099-12-31"));
    staleFailure.reject(new Error("stale B failure"));
    await Promise.all([a, b]);

    expect(states).toHaveLength(countAfterC);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-12" },
      refreshState: { kind: "idle" },
    });
  });

  it("renders refresh source qualifiers before retained nonempty and empty content while idle stays unchanged", () => {
    const roleCount = (html: string, role: "status" | "alert") =>
      html.match(new RegExp(`role="${role}"`, "g"))?.length ?? 0;
    const loadingHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "a" })]),
          loadedAt: "08:15",
          refreshState: { kind: "loading", requestTarget: "2026-07-11" },
        }}
      />,
    );
    expect(loadingHtml).toContain(
      "2026-07-11 の受付一覧を取得中です。2026-07-10 (最終取得: 08:15(JST)) の内容を表示しています。",
    );
    expect(loadingHtml.indexOf("取得中です")).toBeLessThan(
      loadingHtml.indexOf("2026-07-10 の受付: 1件"),
    );
    expect(roleCount(loadingHtml, "status")).toBe(2); // qualifier + row status badge
    expect(roleCount(loadingHtml, "alert")).toBe(0);

    const loadingEmptyHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10"),
          loadedAt: "08:20",
          refreshState: { kind: "loading", requestTarget: "2026-07-11" },
        }}
      />,
    );
    expect(roleCount(loadingEmptyHtml, "status")).toBe(1);
    expect(roleCount(loadingEmptyHtml, "alert")).toBe(0);
    expect(loadingEmptyHtml.indexOf("取得中です")).toBeLessThan(
      loadingEmptyHtml.indexOf("2026-07-10 の受付はまだありません"),
    );

    const errorHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10"),
          loadedAt: "09:05",
          refreshState: {
            kind: "error",
            requestTarget: "2026-07-11",
            notice: {
              message: "受付一覧の処理に失敗しました。",
              nextAction: "再表示してください。",
            },
          },
        }}
      />,
    );
    expect(errorHtml).toContain(
      "2026-07-11 の受付一覧を取得できなかったため、2026-07-10 (最終取得: 09:05(JST)) の内容を表示しています。",
    );
    expect(errorHtml.indexOf("取得できなかったため")).toBeLessThan(
      errorHtml.indexOf("2026-07-10 の受付はまだありません"),
    );
    expect(roleCount(errorHtml, "status")).toBe(1);
    expect(roleCount(errorHtml, "alert")).toBe(1);

    const errorNonemptyHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "a" })]),
          loadedAt: "09:10",
          refreshState: {
            kind: "error",
            requestTarget: "2026-07-11",
            notice: {
              message: "受付一覧の処理に失敗しました。",
              nextAction: "再表示してください。",
            },
          },
        }}
      />,
    );
    expect(roleCount(errorNonemptyHtml, "status")).toBe(2); // qualifier + row status badge
    expect(roleCount(errorNonemptyHtml, "alert")).toBe(1);
    expect(errorNonemptyHtml.indexOf("取得できなかったため")).toBeLessThan(
      errorNonemptyHtml.indexOf("2026-07-10 の受付: 1件"),
    );

    const idleHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "a" })]),
          loadedAt: "08:15",
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(idleHtml).not.toContain("の内容を表示しています");
    expect(idleHtml).toContain("2026-07-10 の受付: 1件");
    expect(idleHtml).toContain("最終取得: 08:15(JST)");
    expect(roleCount(idleHtml, "status")).toBe(2); // count + row status badge
    expect(roleCount(idleHtml, "alert")).toBe(0);

    const idleEmptyHtml = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10"),
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(roleCount(idleEmptyHtml, "status")).toBe(1);
    expect(roleCount(idleEmptyHtml, "alert")).toBe(0);
  });

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

  it("cleans ownership and rejects after a synchronous loading emit failure", async () => {
    const emitFailure = new Error("synthetic emit failure");
    const fetcher = vi.fn().mockResolvedValue(queueResponse("2026-07-10"));
    let failEmit = true;
    let state: QueueState = { kind: "loading" };
    const run = createReceptionQueueRunner(fetcher, (update) => {
      if (failEmit) {
        failEmit = false;
        throw emitFailure;
      }
      state = update(state);
    });

    await expect(run("2026-07-10")).rejects.toBe(emitFailure);
    await run("2026-07-10");

    expect(fetcher).toHaveBeenCalledOnce();
    expect(state.kind).toBe("loaded");
  });

  it("handles a synchronous fetch throw, cleans ownership, and admits retry", async () => {
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(() => {
        throw new Error("synthetic synchronous fetch failure");
      })
      .mockResolvedValueOnce(queueResponse("2026-07-10"));
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("2026-07-10");
    expect(states.at(-1)?.kind).toBe("error");
    await run("2026-07-10");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.kind).toBe("loaded");
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

  it("shows the last-updated time so a stale queue is not read as current (S-02)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "rc-1" })]),
          loadedAt: "05:15",
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(html).toContain("最終取得: 05:15");
  });

  it("omits last-updated when the loaded state has no timestamp", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "rc-1" })]),
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(html).not.toContain("最終取得:");
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

    expect(queueFetch.mock.calls).toEqual([["2026-07-11"], ["2026-07-11"]]);
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

describe("clearRegistrationInputIfUnchanged (next-patient input preservation)", () => {
  it("clears the unchanged raw input after a successful registration", () => {
    expect(clearRegistrationInputIfUnchanged("patient-A", "patient-A")).toBe("");
  });

  it("clears an unchanged whitespace-padded raw input", () => {
    expect(clearRegistrationInputIfUnchanged("  patient-A  ", "  patient-A  ")).toBe("");
  });

  it("preserves a next-patient input typed while the prior registration is pending", () => {
    expect(clearRegistrationInputIfUnchanged("patient-B", "patient-A")).toBe("patient-B");
  });

  it("uses exact raw equality rather than trimmed equivalence", () => {
    expect(clearRegistrationInputIfUnchanged("patient-A", " patient-A ")).toBe("patient-A");
  });
});

describe("business date is JST (WP-4053)", () => {
  it("todayAsIsoDate returns the JST calendar date, not the UTC date", () => {
    // 2026-07-09T20:00:00Z = JST 2026-07-10 05:00(UTC 日付のままだと前日になる時間帯)
    expect(todayAsIsoDate(new Date("2026-07-09T20:00:00Z"))).toBe("2026-07-10");
    // 2026-07-09T02:00:00Z = JST 2026-07-09 11:00(同日)
    expect(todayAsIsoDate(new Date("2026-07-09T02:00:00Z"))).toBe("2026-07-09");
  });
});

describe("parseDateParam (URL 状態は非PHIの業務日付のみ — S-03)", () => {
  it("accepts a valid YYYY-MM-DD date param", () => {
    expect(parseDateParam("?date=2026-07-10")).toBe("2026-07-10");
    expect(parseDateParam("?foo=1&date=2026-01-01")).toBe("2026-01-01");
  });

  it("rejects missing / malformed / impossible dates (fail-closed)", () => {
    expect(parseDateParam("")).toBeUndefined();
    expect(parseDateParam("?date=2026/07/10")).toBeUndefined();
    expect(parseDateParam("?date=07-10-2026")).toBeUndefined();
    expect(parseDateParam("?date=2026-02-31")).toBeUndefined();
    // 患者名などの PHI らしき値は日付形式でないため復元されない(URLにPHIを載せない前提)
    expect(parseDateParam("?date=ヤマダタロウ")).toBeUndefined();
  });
});
