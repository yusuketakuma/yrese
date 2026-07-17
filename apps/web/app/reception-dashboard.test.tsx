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
  ReceptionRegistrationForm,
  ReceptionQueueTable,
  ReceptionQueueView,
  createReception,
  createReceptionDashboardLifecycle,
  createReceptionQueueRunner,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  fetchReceptionQueue,
  formatAcceptedTime,
  parseDateParam,
  registrationPatientChangeNotice,
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
  it("binds registration to the selected patient and shows identifying details", () => {
    const html = renderToStaticMarkup(
      <ReceptionRegistrationForm
        patient={{
          patientId: "patient-test-001",
          name: "合成 太郎",
          kana: "ゴウセイ タロウ",
          birthDate: "1990-01-01",
          sex: "male",
          eligibilityStatus: "VERIFIED",
        }}
        submitting={false}
        onSubmit={() => undefined}
      />,
    );

    expect(html).toContain("受付対象");
    expect(html).toContain("ゴウセイ タロウ");
    expect(html).toContain("合成 太郎");
    expect(html).toContain("1990-01-01");
    expect(html).toContain("この患者を受付登録");
    expect(html).not.toContain("patient-test-001");
    expect(html).not.toContain("患者ID");
  });

  it("blocks registration until a patient is selected and links to patient search", () => {
    const html = renderToStaticMarkup(
      <ReceptionRegistrationForm
        patient={null}
        submitting={false}
        onSubmit={() => undefined}
      />,
    );

    expect(html).toContain("受付対象の患者を選択してください");
    expect(html).toContain('href="/patients"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>この患者を受付登録<\/button>/);
  });

  it("does not report a patient change when the submitted patient remains selected", () => {
    expect(
      registrationPatientChangeNotice(
        "patient-test-001",
        "patient-test-001",
        "success",
      ),
    ).toBeNull();
    expect(
      registrationPatientChangeNotice(
        "patient-test-001",
        "patient-test-001",
        "failure",
      ),
    ).toBeNull();
  });

  it("separates a prior-patient success from the newly selected patient", () => {
    expect(
      registrationPatientChangeNotice(
        "patient-test-002",
        "patient-test-001",
        "success",
      ),
    ).toEqual({
      severity: "WARNING",
      message: "受付処理中に選択患者が変更されました。",
      nextAction:
        "登録結果に表示された患者と受付一覧を確認してから、次の操作へ進んでください。",
    });
  });

  it("prevents a prior-patient failure from being attributed to the newly selected patient", () => {
    const notice = registrationPatientChangeNotice(
      undefined,
      "patient-test-001",
      "failure",
    );

    expect(notice).toEqual({
      severity: "WARNING",
      message: "選択患者の変更前に開始した受付処理が完了しませんでした。",
      nextAction:
        "変更前の患者が受付済みか受付一覧で確認し、不明な場合は再登録せずシステム管理者へ連絡してください。",
    });
    expect(JSON.stringify(notice)).not.toContain("patient-test-001");
  });

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

  it("forwards an optional abort signal only to the reception queue GET", async () => {
    const controller = new AbortController();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, queueResponse("2026-07-01")));

    await withNodeEnv("development", () =>
      fetchReceptionQueue("2026-07-01", fetchImpl, controller.signal),
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/_yrese-api/reception/queue?date=2026-07-01",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it.each([201, 202, 204, 206])(
    "rejects unsupported queue HTTP %s before reading a PHI-rich body",
    async (status) => {
      const sensitiveEntry = entry({
        receptionId: "reception-status-sensitive",
        acceptedAt: "2026-07-09T01:23:45.000Z",
        patient: patient({
          patientId: "patient-status-sensitive",
          name: "合成 HTTP状態",
          kana: "ゴウセイ エイチティーティーピージョウタイ",
          patientNumber: "HTTP-QUEUE-SECRET",
        }),
      });
      const json = vi.fn().mockResolvedValue(
        queueResponse("2099-12-31", [sensitiveEntry, { ...sensitiveEntry }]),
      );
      const fetchImpl = vi
        .fn()
        .mockResolvedValue({ ok: true, status, json } as unknown as Response);

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          fetchReceptionQueue("2026-07-09", fetchImpl),
        );
      } catch (error) {
        caught = error;
      }

      expect(json).not.toHaveBeenCalled();
      expect(caught).toBeInstanceOf(ReceptionError);
      expect((caught as ReceptionError).toNotice()).toEqual({
        message: `受付一覧の取得に失敗しました(HTTP ${status})。`,
        nextAction:
          "再試行してください。解消しない場合は同期状態画面で外部接続状態を確認してください。",
      });
      const serialized = JSON.stringify((caught as ReceptionError).toNotice());
      for (const sensitiveValue of [
        "2099-12-31",
        sensitiveEntry.receptionId,
        sensitiveEntry.acceptedAt,
        sensitiveEntry.receptionStatus,
        sensitiveEntry.patient.patientId,
        sensitiveEntry.patient.name,
        sensitiveEntry.patient.kana,
        sensitiveEntry.patient.patientNumber,
      ]) {
        expect(serialized).not.toContain(sensitiveValue);
      }
    },
  );

  it("binds an exact-200 queue body to the requested date before duplicate validation", async () => {
    const duplicate = entry({ receptionId: "wrong-date-duplicate-sensitive" });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, queueResponse("2099-12-31", [duplicate, { ...duplicate }])),
    );

    let caught: unknown;
    try {
      await withNodeEnv("development", () =>
        fetchReceptionQueue("2026-07-09", fetchImpl),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ReceptionError);
    expect((caught as ReceptionError).toNotice()).toEqual({
      message: "受付一覧の応答日付が要求日付と一致しません。",
      nextAction:
        "表示日付を確認して再表示してください。解消しない場合はシステム管理者へ連絡してください。",
    });
    expect(JSON.stringify((caught as ReceptionError).toNotice())).not.toContain(
      "2099-12-31",
    );
    expect((caught as Error).message).not.toContain(duplicate.receptionId);
  });

  it("accepts queue entries at both boundaries of the requested JST business date", async () => {
    const midnight = entry({
      receptionId: "jst-midnight",
      acceptedAt: "2026-07-09T15:00:00.000Z",
    });
    const endOfDay = entry({
      receptionId: "jst-end-of-day",
      acceptedAt: "2026-07-10T14:59:59.999999999Z",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, queueResponse("2026-07-10", [endOfDay, midnight])),
      );

    const response = await withNodeEnv("development", () =>
      fetchReceptionQueue("2026-07-10", fetchImpl),
    );

    expect(response.entries.map((queueEntry) => queueEntry.receptionId)).toEqual([
      "jst-midnight",
      "jst-end-of-day",
    ]);
  });

  it.each([
    ["previous", "2026-07-09T14:59:59.999Z"],
    ["next", "2026-07-10T15:00:00.000Z"],
  ] as const)(
    "rejects a %s-JST-day queue entry without echoing PHI-rich response fields",
    async (_boundary, acceptedAt) => {
      const sensitive = entry({
        receptionId: "reception-wrong-business-date-sensitive",
        acceptedAt,
        patient: patient({
          patientId: "patient-wrong-business-date-sensitive",
          name: "合成 業務日外",
          kana: "ゴウセイ ギョウムビガイ",
          patientNumber: "WRONG-DATE-SECRET",
        }),
      });
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, queueResponse("2026-07-10", [sensitive])),
        );

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          fetchReceptionQueue("2026-07-10", fetchImpl),
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        "Reception queue response contains entries outside the requested business date",
      );
      const serialized = JSON.stringify(caught, Object.getOwnPropertyNames(caught));
      for (const sensitiveValue of [
        sensitive.receptionId,
        sensitive.acceptedAt,
        sensitive.receptionStatus,
        sensitive.patient.patientId,
        sensitive.patient.name,
        sensitive.patient.kana,
        sensitive.patient.patientNumber,
      ]) {
        expect(serialized).not.toContain(sensitiveValue);
      }
    },
  );

  it("checks duplicate queue identities before business-date membership", async () => {
    const duplicate = entry({
      receptionId: "duplicate-before-business-date",
      acceptedAt: "2026-07-10T15:00:00.000Z",
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, queueResponse("2026-07-10", [duplicate, { ...duplicate }])),
    );

    await expect(
      withNodeEnv("development", () =>
        fetchReceptionQueue("2026-07-10", fetchImpl),
      ),
    ).rejects.toThrow("Reception queue response contains duplicate reception identities");
  });

  it("keeps initial and refresh state fail-closed across unsupported queue statuses and retry", async () => {
    const retained = queueResponse("2026-07-09", [entry({ receptionId: "retained" })]);
    const replacement = queueResponse("2026-07-10", [
      entry({
        receptionId: "replacement",
        acceptedAt: "2026-07-10T00:15:00.000Z",
      }),
    ]);
    const unsupportedJson = vi.fn().mockResolvedValue(replacement);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        { ok: true, status: 202, json: unsupportedJson } as unknown as Response,
      )
      .mockResolvedValueOnce(jsonResponse(200, retained))
      .mockResolvedValueOnce(
        { ok: true, status: 206, json: unsupportedJson } as unknown as Response,
      )
      .mockResolvedValueOnce(jsonResponse(200, replacement));
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(
      (targetDate) => fetchReceptionQueue(targetDate, fetchImpl),
      (update) => states.push(update(states.at(-1)!)),
    );

    await withNodeEnv("development", () => run("2026-07-09"));
    expect(states.at(-1)).toMatchObject({
      kind: "error",
      notice: { message: "受付一覧の取得に失敗しました(HTTP 202)。" },
    });
    expect(JSON.stringify(states.at(-1))).not.toContain("replacement");

    await withNodeEnv("development", () => run("2026-07-09"));
    const loaded = states.at(-1)!;
    expect(loaded).toMatchObject({ kind: "loaded", response: retained });
    if (loaded.kind !== "loaded") throw new Error("expected loaded queue state");
    const loadedAt = loaded.loadedAt;

    await withNodeEnv("development", () => run("2026-07-10"));
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: retained,
      loadedAt,
      refreshState: {
        kind: "error",
        requestTarget: "2026-07-10",
        notice: { message: "受付一覧の取得に失敗しました(HTTP 206)。" },
      },
    });
    expect(JSON.stringify(states.at(-1))).not.toContain("replacement");

    await withNodeEnv("development", () => run("2026-07-10"));
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: replacement,
      refreshState: { kind: "idle" },
    });
    expect(unsupportedJson).not.toHaveBeenCalled();
  });

  it("suppresses a stale unsupported queue response after a newer exact-200 result", async () => {
    const staleResponse = deferredValue<Response>();
    const staleJson = vi.fn().mockResolvedValue(
      queueResponse("2026-07-09", [entry({ receptionId: "stale-sensitive" })]),
    );
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => staleResponse.promise)
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          queueResponse("2026-07-10", [
            entry({
              receptionId: "current",
              acceptedAt: "2026-07-10T00:15:00.000Z",
            }),
          ]),
        ),
      );
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(
      (targetDate) => fetchReceptionQueue(targetDate, fetchImpl),
      (update) => states.push(update(states.at(-1)!)),
    );

    const stale = withNodeEnv("development", () => run("2026-07-09"));
    await withNodeEnv("development", () => run("2026-07-10"));
    const countAfterCurrent = states.length;
    staleResponse.resolve(
      { ok: true, status: 202, json: staleJson } as unknown as Response,
    );
    await stale;

    expect(staleJson).not.toHaveBeenCalled();
    expect(states).toHaveLength(countAfterCurrent);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-10", entries: [{ receptionId: "current" }] },
      refreshState: { kind: "idle" },
    });
    expect(JSON.stringify(states.at(-1))).not.toContain("stale-sensitive");
  });

  it.each([
    ["identical", false],
    ["conflicting", true],
  ] as const)(
    "rejects a %s duplicate reception identity from the queue transport",
    async (_label, conflicting) => {
      const first = entry({
        receptionId: "reception-duplicate-sensitive",
        patient: patient({
          patientId: "patient-duplicate-a",
          name: "合成 重複受付A",
          kana: "ゴウセイ ジュウフクウケツケエー",
          patientNumber: "DUPLICATE-001",
        }),
      });
      const second = conflicting
        ? entry({
            receptionId: first.receptionId,
            acceptedAt: "2026-07-09T01:15:00.000Z",
            receptionStatus: "IN_PROGRESS",
            patient: patient({
              patientId: "patient-duplicate-b",
              name: "合成 矛盾受付B",
              kana: "ゴウセイ ムジュンウケツケビー",
              patientNumber: "DUPLICATE-999",
            }),
          })
        : { ...first, patient: { ...first.patient } };
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, queueResponse("2026-07-09", [first, second])));

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          fetchReceptionQueue("2026-07-09", fetchImpl),
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        "Reception queue response contains duplicate reception identities",
      );
      for (const queueEntry of [first, second]) {
        for (const sensitiveValue of [
          queueEntry.receptionId,
          queueEntry.acceptedAt,
          queueEntry.receptionStatus,
          queueEntry.patient.patientId,
          queueEntry.patient.name,
          queueEntry.patient.kana,
          queueEntry.patient.patientNumber,
        ]) {
          expect((caught as Error).message).not.toContain(sensitiveValue);
        }
      }
    },
  );

  it("sorts a copied queue by exact acceptedAt then ReceptionId without mutating the source", async () => {
    const late = entry({
      receptionId: "rc-late",
      acceptedAt: "2026-07-09T01:00:00Z",
      patient: patient({ patientId: "patient-late", patientNumber: "QUEUE-LATE" }),
    });
    const tieB = entry({
      receptionId: "rc-tie-b",
      acceptedAt: "2026-07-09T00:00:00.0000010Z",
    });
    const early = entry({
      receptionId: "rc-early",
      acceptedAt: "2026-07-09T00:00:00.0000009Z",
      patient: patient({ patientId: "patient-early", patientNumber: "QUEUE-EARLY" }),
    });
    const tieA = entry({
      receptionId: "rc-tie-a",
      acceptedAt: "2026-07-09T00:00:00.000001Z",
    });
    const source = queueResponse("2026-07-09", [late, tieB, early, tieA]);
    const sourceOrder = source.entries.map((queueEntry) => queueEntry.receptionId);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, source));

    const response = await withNodeEnv("development", () =>
      fetchReceptionQueue("2026-07-09", fetchImpl),
    );

    expect(response.entries.map((queueEntry) => queueEntry.receptionId)).toEqual([
      "rc-early",
      "rc-tie-a",
      "rc-tie-b",
      "rc-late",
    ]);
    expect(response.entries).toEqual([early, tieA, tieB, late]);
    expect(source.entries.map((queueEntry) => queueEntry.receptionId)).toEqual(sourceOrder);
    expect(response.entries).not.toBe(source.entries);

    const html = renderToStaticMarkup(<ReceptionQueueTable entries={response.entries} />);
    expect(html.indexOf(early.patient.patientNumber)).toBeLessThan(
      html.indexOf(late.patient.patientNumber),
    );
  });

  it.each([
    ["empty", []],
    ["single", [entry({ receptionId: "rc-single" })]],
    [
      "already canonical",
      [
        entry({ receptionId: "rc-a", acceptedAt: "2026-07-09T00:00:00Z" }),
        entry({ receptionId: "rc-b", acceptedAt: "2026-07-09T00:00:00Z" }),
      ],
    ],
  ] as const)("keeps a %s queue value-equivalent after canonical sorting", async (_label, entries) => {
    const body = queueResponse("2026-07-09", entries);
    const response = await withNodeEnv("development", () =>
      fetchReceptionQueue("2026-07-09", vi.fn().mockResolvedValue(jsonResponse(200, body))),
    );
    expect(response).toEqual(body);
  });

  it("retains the last verified queue when a refresh contains duplicate reception identities", async () => {
    const retained = queueResponse("2026-07-09", [entry({ receptionId: "retained" })]);
    const duplicate = entry({ receptionId: "duplicate-untrusted" });
    const replacement = queueResponse("2026-07-09", [
      entry({ receptionId: "replacement" }),
    ]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, retained))
      .mockResolvedValueOnce(
        jsonResponse(200, queueResponse("2026-07-09", [duplicate, { ...duplicate }])),
      )
      .mockResolvedValueOnce(jsonResponse(200, replacement));
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(
      (targetDate) => fetchReceptionQueue(targetDate, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    await withNodeEnv("development", async () => {
      await run("2026-07-09");
      await run("2026-07-09");
    });

    const failed = states[states.length - 1]!;
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") throw new Error("expected retained queue state");
    expect(failed.response).toEqual(retained);
    expect(failed.refreshState.kind).toBe("error");
    expect(JSON.stringify(failed)).not.toContain("duplicate-untrusted");

    await withNodeEnv("development", () => run("2026-07-09"));
    const retried = states[states.length - 1]!;
    expect(retried.kind).toBe("loaded");
    if (retried.kind === "loaded") {
      expect(retried.response).toEqual(replacement);
      expect(retried.refreshState).toEqual({ kind: "idle" });
    }
  });

  it("rejects a mixed-date refresh all-or-nothing, retains verified data, and allows retry", async () => {
    const retained = queueResponse("2026-07-10", [
      entry({ receptionId: "retained", acceptedAt: "2026-07-10T00:15:00.000Z" }),
    ]);
    const wrongDate = entry({
      receptionId: "wrong-date-sensitive",
      acceptedAt: "2026-07-10T15:00:00.000Z",
      patient: patient({
        patientId: "wrong-date-patient-sensitive",
        name: "合成 別日",
        kana: "ゴウセイ ベツビ",
        patientNumber: "WRONG-DATE-PHI",
      }),
    });
    const replacement = queueResponse("2026-07-10", [
      entry({ receptionId: "replacement", acceptedAt: "2026-07-10T01:15:00.000Z" }),
    ]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, retained))
      .mockResolvedValueOnce(
        jsonResponse(200, queueResponse("2026-07-10", [retained.entries[0]!, wrongDate])),
      )
      .mockResolvedValueOnce(jsonResponse(200, replacement));
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(
      (targetDate) => fetchReceptionQueue(targetDate, fetchImpl),
      (update) => states.push(update(states.at(-1)!)),
    );

    await withNodeEnv("development", () => run("2026-07-10"));
    const verified = states.at(-1)!;
    expect(verified.kind).toBe("loaded");
    if (verified.kind !== "loaded") throw new Error("expected verified queue state");
    const loadedAt = verified.loadedAt;

    await withNodeEnv("development", () => run("2026-07-10"));
    const failed = states.at(-1)!;
    expect(failed).toMatchObject({
      kind: "loaded",
      response: retained,
      loadedAt,
      refreshState: {
        kind: "error",
        notice: { message: "受付一覧の処理に失敗しました。" },
      },
    });
    expect(JSON.stringify(failed)).not.toContain("wrong-date");
    expect(JSON.stringify(failed)).not.toContain("WRONG-DATE-PHI");

    await withNodeEnv("development", () => run("2026-07-10"));
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: replacement,
      refreshState: { kind: "idle" },
    });
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
      expect(fetcher.mock.calls.map(([target]) => target)).toEqual([
        "2026-07-11",
        "2026-07-11",
      ]);
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

  it("uses the frozen creation snapshot after a trusted error is mutated", async () => {
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
    let state: QueueState = { kind: "loading" };
    const run = createReceptionQueueRunner(fetcher, (update) => {
      state = update(state);
    });

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
