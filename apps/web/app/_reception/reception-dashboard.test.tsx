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

  it.each([
    ["0001-01-01T00:00:00.000Z", "09:00"],
    ["0099-12-31T14:59:59.999Z", "23:59"],
    ["0099-12-31T15:00:00.000Z", "00:00"],
    ["9999-12-31T14:59:59.999Z", "23:59"],
  ] as const)("formats historical instant %s with fixed JST as %s", (instant, expected) => {
    expect(formatAcceptedTime(instant)).toBe(expected);
  });

  it.each([
    ["0000-01-01T00:00:00.000Z"],
    ["9999-12-31T15:00:00.000Z"],
    ["not-an-instant"],
  ] as const)("rejects unsupported accepted time %s without echo", (instant) => {
    expect(() => formatAcceptedTime(instant)).toThrow(
      "Reception accepted time could not be formatted",
    );
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
    expect(error).toContain('role="status"');
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
    ["0001-01-01", "0001-01-01T00:00:00.000Z"],
    ["0099-12-31", "0099-12-31T14:59:59.999Z"],
    ["0100-01-01", "0099-12-31T15:00:00.000Z"],
    ["9999-12-31", "9999-12-31T14:59:59.999Z"],
  ] as const)(
    "accepts a queue entry on canonical JST business date %s",
    async (date, acceptedAt) => {
      const boundary = entry({
        receptionId: `reception-calendar-${date}`,
        acceptedAt,
      });
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, queueResponse(date, [boundary])));

      const response = await withNodeEnv("development", () =>
        fetchReceptionQueue(date, fetchImpl),
      );

      expect(response).toEqual(queueResponse(date, [boundary]));
    },
  );

  it.each([
    ["local BCE", "0001-01-01", "0000-01-01T00:00:00.000Z"],
    ["JST year 10000", "9999-12-31", "9999-12-31T15:00:00.000Z"],
  ] as const)(
    "rejects %s queue evidence without echoing its fields",
    async (_label, date, acceptedAt) => {
      const sensitive = entry({
        receptionId: "reception-calendar-sensitive-4232",
        acceptedAt,
        patient: patient({
          patientId: "patient-calendar-sensitive-4232",
          name: "合成 暦日機密患者",
          kana: "ゴウセイ レキジツキミツカンジャ",
          patientNumber: "CALENDAR-SECRET-4232",
        }),
      });
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, queueResponse(date, [sensitive])));

      let caught: unknown;
      try {
        await withNodeEnv("development", () =>
          fetchReceptionQueue(date, fetchImpl),
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
        date,
        acceptedAt,
        sensitive.receptionId,
        sensitive.patient.patientId,
        sensitive.patient.name,
        sensitive.patient.kana,
        sensitive.patient.patientNumber,
      ]) {
        expect(serialized).not.toContain(sensitiveValue);
      }
    },
  );

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

  it("ignores stale mismatches and trusted 403 failures after current C wins", async () => {
    const staleSuccess = deferredValue<ReceptionQueueResponse>();
    const stalePermissionDenied = deferredValue<Response>();
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
      .mockImplementationOnce((target) =>
        withNodeEnv("development", () =>
          fetchReceptionQueue(
            target,
            vi.fn(() => stalePermissionDenied.promise),
          ),
        ),
      )
      .mockResolvedValueOnce(queueResponse("2026-07-12"));
    const clearSensitiveState = vi.fn();
    const run = createReceptionQueueRunner(
      fetcher,
      (update) => {
        states.push(update(states[states.length - 1]!));
      },
      clearSensitiveState,
    );

    const a = run("2026-07-10");
    const b = run("2026-07-11");
    await run("2026-07-12");
    const countAfterC = states.length;
    staleSuccess.resolve(queueResponse("2099-12-31"));
    stalePermissionDenied.resolve(jsonResponse(403, { errorCode: "AUTH-0003" }));
    await Promise.all([a, b]);

    expect(states).toHaveLength(countAfterC);
    expect(states.at(-1)).toMatchObject({
      kind: "loaded",
      response: { date: "2026-07-12" },
      refreshState: { kind: "idle" },
    });
    expect(clearSensitiveState).not.toHaveBeenCalled();
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
    expect(roleCount(loadingHtml, "status")).toBe(3); // qualifier + row status badge + eligibility badge
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
    expect(roleCount(errorHtml, "status")).toBe(2); // qualifier + nonblocking error
    expect(roleCount(errorHtml, "alert")).toBe(0);

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
    expect(roleCount(errorNonemptyHtml, "status")).toBe(4); // qualifier + row status badge + eligibility badge + nonblocking error
    expect(roleCount(errorNonemptyHtml, "alert")).toBe(0);
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
    expect(roleCount(idleHtml, "status")).toBe(3); // count + row status badge + eligibility badge
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

  it("marks the selected patient's row with a boolean marker and visible text, leaking no identifier (WP-5212-3)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[
          entry({ receptionId: "rc-1", patient: patient({ patientId: "p1", patientNumber: "T-0001" }) }),
          entry({ receptionId: "rc-2", patient: patient({ patientId: "p2", patientNumber: "T-0002" }) }),
        ]}
        selectedPatientId="p2"
      />,
    );

    expect(html).toContain("選択中");
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("data-patient-id");
    expect(html).not.toContain("p2\"");
    expect(html).not.toContain(">p2<");
  });

  it("does not mark any row when no patient is selected (WP-5212-3)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable entries={[entry({ receptionId: "rc-1" })]} />,
    );

    expect(html).not.toContain("選択中");
    expect(html).not.toContain("data-selected");
  });

  it("gives the queue table a visible title caption and drops the legacy reception-queue class (WP-5212-4)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[entry({ receptionId: "rc-1" })]}
        businessDate="2026-08-27"
      />,
    );

    expect(html).toContain("<caption");
    expect(html).toContain("operator-table-caption");
    expect(html).toContain("2026-08-27");
    expect(html).not.toContain('class="reception-queue"');
    expect(html).toMatch(/<table class="operator-table/);
  });

  it("keeps the scroll-region label distinct from the table caption title (WP-5212-4)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[entry({ receptionId: "rc-1" })]}
        businessDate="2026-08-27"
      />,
    );

    expect(html).toContain("受付キュー表。横方向にスクロールできます");
    expect(html).toContain("2026-08-27 の受付キュー");
  });
});


