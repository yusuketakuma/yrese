import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_SEARCH_DEFAULT_LIMIT,
  type PatientSearchResult,
} from "@yrese/contracts";

import {
  ELIGIBILITY_LABELS,
  PatientHeader,
  computeAgeYears,
} from '../components/patient/patient-header';
import { PATIENT_SEARCH_DEV_SCOPES, devTenantHeaders } from '../dev-tenant';
import { SEX_LABELS } from '../status/visual-status-registry';
import { patientId } from "@yrese/shared-kernel";
import {
  createSearchRunner,
  duplicateKanaSet,
  fetchSearch,
  patientSearchResultMetric,
  PatientSearch,
  PatientSearchResults,
  ProceedToPrescriptionLink,
  toPatientContextData,
  type SearchPage,
  type SearchState,
} from './patient-search';

(globalThis as { React?: typeof React }).React = React;


import {
  patient,
  captureSearchFailure,
} from './patient-search-test-support';


describe("patient search append/pagination hardening", () => {
  it.each([
    ["identical", false],
    ["conflicting", true],
  ] as const)(
    "rejects a cross-page %s PatientId overlap and preserves the verified page for retry",
    async (_label, conflicting) => {
      const states: SearchState[] = [{ kind: "idle" }];
      const retained = patient({
        patientId: "patient-overlap-sensitive",
        name: "合成 保持患者",
        kana: "ゴウセイ ホジカンジャ",
        patientNumber: "RETAINED-001",
      });
      const conflictingResult = conflicting
        ? patient({
            patientId: retained.patientId,
            name: "合成 矛盾患者",
            kana: "ゴウセイ ムジュンカンジャ",
            birthDate: "1985-12-31",
            patientNumber: "CONFLICTING-999",
          })
        : { ...retained };
      const replacement = patient({ patientId: "patient-retry-safe" });
      const fetcher = vi
        .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
        .mockResolvedValueOnce({ results: [retained], nextCursor: "cursor-overlap" })
        .mockResolvedValueOnce({
          results: [conflictingResult],
          nextCursor: "cursor-untrusted",
        })
        .mockResolvedValueOnce({ results: [replacement] });
      const run = createSearchRunner(fetcher, (update) => {
        states.push(update(states[states.length - 1]!));
      });

      await run("合成");
      await run("合成", "cursor-overlap", true);

      const failed = states[states.length - 1]!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
      expect(failed.results).toEqual([retained]);
      expect(failed.nextCursor).toBe("cursor-overlap");
      expect(failed.appendState).toMatchObject({
        kind: "error",
        notice: { message: "検索結果の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("cursor-untrusted");
      if (conflicting) {
        expect(JSON.stringify(failed)).not.toContain("CONFLICTING-999");
        expect(JSON.stringify(failed)).not.toContain("合成 矛盾患者");
      }

      await run(failed.query, failed.nextCursor, true);
      const retried = states[states.length - 1]!;
      expect(retried.kind).toBe("loaded");
      if (retried.kind !== "loaded") throw new Error("expected retried loaded state");
      expect(retried.results).toEqual([retained, replacement]);
      expect(retried.nextCursor).toBeUndefined();
      expect(retried.appendState).toEqual({ kind: "idle" });
    },
  );

  it.each([
    ["a distinct result", [patient({ patientId: "patient-self-loop-sensitive" })]],
    ["an empty result", []],
  ] as const)(
    "rejects an append cursor self-loop with %s and retries without a partial commit",
    async (_label, selfLoopResults) => {
      const states: SearchState[] = [{ kind: "idle" }];
      const retained = patient({ patientId: "patient-retained-safe" });
      const replacement = patient({ patientId: "patient-retry-safe" });
      const fetcher = vi
        .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
        .mockResolvedValueOnce({ results: [retained], nextCursor: "cursor-loop" })
        .mockResolvedValueOnce({
          results: [...selfLoopResults],
          nextCursor: "cursor-loop",
        })
        .mockResolvedValueOnce({ results: [replacement] });
      const run = createSearchRunner(fetcher, (update) => {
        states.push(update(states[states.length - 1]!));
      });

      await run("合成");
      await run("合成", "cursor-loop", true);

      const failed = states[states.length - 1]!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
      expect(failed.results).toEqual([retained]);
      expect(failed.query).toBe("合成");
      expect(failed.nextCursor).toBe("cursor-loop");
      expect(failed.appendState).toMatchObject({
        kind: "error",
        notice: { message: "検索結果の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("patient-self-loop-sensitive");

      await run(failed.query, failed.nextCursor, true);
      const retried = states[states.length - 1]!;
      expect(retried.kind).toBe("loaded");
      if (retried.kind !== "loaded") throw new Error("expected retried loaded state");
      expect(retried.results).toEqual([retained, replacement]);
      expect(retried.nextCursor).toBeUndefined();
      expect(retried.appendState).toEqual({ kind: "idle" });
      expect(fetcher.mock.calls.map(([query, cursor]) => [query, cursor])).toEqual([
        ["合成", undefined],
        ["合成", "cursor-loop"],
        ["合成", "cursor-loop"],
      ]);
    },
  );

  it("rejects duplicate PatientIds inside an append page before merging any row", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const retained = patient({ patientId: "patient-retained" });
    const duplicate = patient({ patientId: "patient-new-duplicate" });
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({ results: [retained], nextCursor: "cursor-1" })
      .mockResolvedValueOnce({ results: [duplicate, { ...duplicate }] });
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("合成");
    await run("合成", "cursor-1", true);

    const failed = states[states.length - 1]!;
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
    expect(failed.results).toEqual([retained]);
    expect(failed.nextCursor).toBe("cursor-1");
    expect(failed.appendState.kind).toBe("error");
    expect(JSON.stringify(failed)).not.toContain("patient-new-duplicate");
  });

  it("coalesces synchronous trim-equivalent append requests and merges the owner result once", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let resolveAppend!: (page: SearchPage) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({
        results: [patient({ patientId: "p1" })],
        nextCursor: "cursor-1",
      })
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((resolve) => {
            resolveAppend = resolve;
          }),
      );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("合成");
    const owner = run(" 合成 ", "cursor-1", true);
    const duplicate = run("合成", "cursor-1", true);

    await duplicate;
    expect(fetcher).toHaveBeenCalledTimes(2);
    resolveAppend({ results: [patient({ patientId: "p2" })] });
    await owner;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind !== "loaded") throw new Error("expected loaded state");
    expect(last.results.map((result) => result.patientId)).toEqual(["p1", "p2"]);
  });

  it("does not abort the owner of an exact active append duplicate", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let resolveAppend!: (page: SearchPage) => void;
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(
      (_query: string, cursor: string | undefined, signal: AbortSignal) => {
        signals.push(signal);
        return cursor === undefined
          ? Promise.resolve({
              results: [patient({ patientId: "p1" })],
              nextCursor: "cursor-1",
            })
          : new Promise<SearchPage>((resolve) => {
              resolveAppend = resolve;
            });
      },
    );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("合成");
    const owner = run(" 合成 ", "cursor-1", true);
    await run("合成", "cursor-1", true);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals[1]?.aborted).toBe(false);
    resolveAppend({ results: [patient({ patientId: "p2" })] });
    await owner;
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      results: [{ patientId: "p1" }, { patientId: "p2" }],
    });
  });

  it("admits the same append tuple again after a rejected self-loop owner cleans up", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({
        results: [patient({ patientId: "p1" })],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        results: [patient({ patientId: "p2" })],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({ results: [patient({ patientId: "p3" })] });
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("合成");
    await run("合成", "cursor-1", true);
    await run("合成", "cursor-1", true);

    expect(fetcher.mock.calls.map(([query, cursor]) => [query, cursor])).toEqual([
      ["合成", undefined],
      ["合成", "cursor-1"],
      ["合成", "cursor-1"],
    ]);
    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.results.map((result) => result.patientId)).toEqual(["p1", "p3"]);
      expect(last.nextCursor).toBeUndefined();
      expect(last.appendState).toEqual({ kind: "idle" });
    }
  });

  it("keeps a full search authoritative over a late append failure", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let rejectAppend!: (reason: Error) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({
        results: [patient({ patientId: "a1" })],
        nextCursor: "cursor-a",
      })
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((_resolve, reject) => {
            rejectAppend = reject;
          }),
      )
      .mockResolvedValueOnce({ results: [patient({ patientId: "b1" })] });
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("検索A");
    const append = run("検索A", "cursor-a", true);
    await run("検索B");
    rejectAppend(new Error("late synthetic append failure"));
    await append;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.query).toBe("検索B");
      expect(last.results.map((result) => result.patientId)).toEqual(["b1"]);
    }
  });

  it("admits a replacement append after an authoritative full search and protects its owner from stale cleanup", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let resolveOldAppend!: (page: SearchPage) => void;
    let resolveReplacementAppend!: (page: SearchPage) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({
        results: [patient({ patientId: "initial" })],
        nextCursor: "cursor-a",
      })
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((resolve) => {
            resolveOldAppend = resolve;
          }),
      )
      .mockResolvedValueOnce({
        results: [patient({ patientId: "refreshed" })],
        nextCursor: "cursor-a",
      })
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((resolve) => {
            resolveReplacementAppend = resolve;
          }),
      );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("検索A");
    const oldAppend = run("検索A", "cursor-a", true);
    await run("検索A");
    const replacementAppend = run("検索A", "cursor-a", true);

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "検索A",
      nextCursor: "cursor-a",
      appendState: { kind: "loading" },
    });

    resolveOldAppend({ results: [patient({ patientId: "stale-old" })] });
    await oldAppend;
    await run(" 検索A ", "cursor-a", true);
    expect(fetcher).toHaveBeenCalledTimes(4);

    resolveReplacementAppend({ results: [patient({ patientId: "replacement" })] });
    await replacementAppend;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.results.map((result) => result.patientId)).toEqual([
        "refreshed",
        "replacement",
      ]);
      expect(last.appendState).toEqual({ kind: "idle" });
    }
    expect(fetcher.mock.calls.map(([query, cursor]) => [query, cursor])).toEqual([
      ["検索A", undefined],
      ["検索A", "cursor-a"],
      ["検索A", undefined],
      ["検索A", "cursor-a"],
    ]);
  });

  it("admits structurally different append tuples even when delimiter concatenation would collide", async () => {
    const fetcher = vi.fn<(q: string, cursor?: string) => Promise<SearchPage>>(
      () => new Promise<SearchPage>(() => undefined),
    );
    const run = createSearchRunner(fetcher, () => undefined);

    void run("a", "b\u0000c", true);
    void run("a\u0000b", "c", true);
    void run("a", undefined, true);

    expect(fetcher.mock.calls.map(([query, cursor]) => [query, cursor])).toEqual([
      ["a", "b\u0000c"],
      ["a\u0000b", "c"],
      ["a", undefined],
    ]);
  });

  it("lets a blank query invalidate an active append without acquiring an append lock", async () => {
    const states: SearchState[] = [
      {
        kind: "loaded",
        results: [patient({ patientId: "p1" })],
        query: "合成",
        nextCursor: "cursor-1",
        appendState: { kind: "idle" },
      },
    ];
    let resolveAppend!: (page: SearchPage) => void;
    const fetcher = vi.fn<(q: string, cursor?: string) => Promise<SearchPage>>(
      () =>
        new Promise<SearchPage>((resolve) => {
          resolveAppend = resolve;
        }),
    );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const append = run("合成", "cursor-1", true);
    await run("   ", "cursor-1", true);
    resolveAppend({ results: [patient({ patientId: "stale-p2" })] });
    await append;

    expect(fetcher).toHaveBeenCalledOnce();
    expect(states[states.length - 1]).toMatchObject({
      kind: "error",
      notice: { severity: "WARNING", message: "検索語が入力されていません。" },
    });
  });

  it("cleans the append owner when emit throws synchronously so a retry is admitted", async () => {
    const emitError = new Error("synthetic emit failure");
    const fetcher = vi.fn<(q: string, cursor?: string) => Promise<SearchPage>>().mockResolvedValue({ results: [] });
    let throwOnEmit = true;
    const run = createSearchRunner(fetcher, () => {
      if (throwOnEmit) {
        throwOnEmit = false;
        throw emitError;
      }
    });

    await expect(run("合成", "cursor-1", true)).rejects.toBe(emitError);
    await run("合成", "cursor-1", true);

    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("cleans the append owner after a synchronous fetch throw so a retry is admitted", async () => {
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockImplementationOnce(() => {
        throw new Error("synthetic synchronous fetch failure");
      })
      .mockResolvedValueOnce({ results: [] });
    const run = createSearchRunner(fetcher, () => undefined);

    await run("合成", "cursor-1", true);
    await run("合成", "cursor-1", true);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels active work on cleanup without emitting and remains reusable", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const signals: AbortSignal[] = [];
    let resolveIgnoredAbort!: (page: SearchPage) => void;
    const fetcher = vi
      .fn((_query: string, _cursor: string | undefined, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<SearchPage>((resolve) => {
          resolveIgnoredAbort = resolve;
        });
      })
      .mockImplementationOnce((_query, _cursor, signal) => {
        signals.push(signal);
        return new Promise<SearchPage>((resolve) => {
          resolveIgnoredAbort = resolve;
        });
      })
      .mockImplementationOnce((_query, _cursor, signal) => {
        signals.push(signal);
        return Promise.resolve({ results: [patient({ patientId: "after-cleanup" })] });
      });
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const active = run("before cleanup");
    const stateCountBeforeCleanup = states.length;
    run.cancelActive();
    run.cancelActive();
    resolveIgnoredAbort({ results: [patient({ patientId: "stale-after-cleanup" })] });
    await active;

    expect(signals[0]?.aborted).toBe(true);
    expect(states).toHaveLength(stateCountBeforeCleanup);
    await run("after cleanup");
    expect(signals[1]?.aborted).toBe(false);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      results: [{ patientId: "after-cleanup" }],
    });
  });

  it("drops abort-listener re-entry during cleanup and remains reusable afterward", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let run!: ReturnType<typeof createSearchRunner>;
    let reentrantDuringCancel: Promise<void> | undefined;
    const fetcher = vi.fn(
      (query: string, _cursor: string | undefined, signal: AbortSignal) => {
        if (query === "active-before-cleanup") {
          return new Promise<SearchPage>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reentrantDuringCancel = run("reentrant-during-cancel");
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve({ results: [patient({ patientId: `patient-${query}` })] });
      },
    );
    run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const active = run("active-before-cleanup");
    const stateCountBeforeCleanup = states.length;
    run.cancelActive();
    await active;
    await reentrantDuringCancel;

    expect(fetcher.mock.calls.map(([query]) => query)).toEqual(["active-before-cleanup"]);
    expect(states).toHaveLength(stateCountBeforeCleanup);

    await run("fresh-after-cleanup");
    expect(fetcher.mock.calls.map(([query]) => query)).toEqual([
      "active-before-cleanup",
      "fresh-after-cleanup",
    ]);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "fresh-after-cleanup",
    });
  });

  it("renders retained rows, append error, incomplete warning, and explicit retry together", () => {
    const html = renderToStaticMarkup(
      <PatientSearchResults
        results={[patient({ patientId: "p1" })]}
        query="合成"
        nextCursor="cursor-1"
        appendState={{
          kind: "error",
          notice: {
            message: "検索結果の処理に失敗しました。",
            nextAction: "再試行してください。",
          },
        }}
        onLoadMore={() => undefined}
      />,
    );

    expect(html).toContain("T-0001");
    expect(html).toContain("未読込の続きがあります");
    expect(html).toContain('role="status"');
    expect(html).toContain("続きの読み込みを再試行");
  });

  it("keeps rows visible and disables only the continuation control while appending", () => {
    const html = renderToStaticMarkup(
      <PatientSearchResults
        results={[patient({ patientId: "p1" })]}
        query="合成"
        nextCursor="cursor-1"
        appendState={{ kind: "loading" }}
        onLoadMore={() => undefined}
      />,
    );

    expect(html).toContain("T-0001");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>続きを読み込み中…<\/button>/);
  });

  it("sends dev tenant headers only in development (WP-4038)", () => {
    expect(devTenantHeaders(PATIENT_SEARCH_DEV_SCOPES, "development")).toMatchObject({
      "x-dev-tenant": "t-dev",
      "x-dev-pharmacy": "ph-dev",
      "x-dev-scopes": "patient:read",
    });
    expect(devTenantHeaders(undefined, "development")).toMatchObject({
      "x-dev-scopes": "patient:read",
    });
    expect(devTenantHeaders(PATIENT_SEARCH_DEV_SCOPES, "production")).toEqual({});
    expect(devTenantHeaders(PATIENT_SEARCH_DEV_SCOPES, "test")).toEqual({});
    expect(devTenantHeaders(PATIENT_SEARCH_DEV_SCOPES, undefined)).toEqual({});
  });

  it("renders eligibility labels from the PatientHeader single source (WP-4041)", () => {
    const html = renderToStaticMarkup(
      <PatientSearchResults
        results={[
          patient({ patientId: "p1", eligibilityStatus: "PENDING_REVERIFY" }),
          patient({
            patientId: "p2",
            kana: "ベツ ヒト",
            eligibilityStatus: "LOCAL_ONLY_UNVERIFIED",
          }),
        ]}
        query="テスト"
      />,
    );

    // PatientHeader と同一の(安全含意を弱めない)文言であること
    expect(html).toContain(ELIGIBILITY_LABELS.PENDING_REVERIFY);
    expect(html).toContain("資格再確認待ち(請求前に再確認必須)");
    expect(html).toContain(ELIGIBILITY_LABELS.LOCAL_ONLY_UNVERIFIED);
    expect(html).toContain("ローカル参照のみ(オンライン未確認)");
    // 色非依存の冗長エンコード: 形状記号を aria-hidden で併記(監査 A-03)
    expect(html).toContain("patient-eligibility-shape");
    expect(html).toContain('aria-hidden="true"');
    // 狭幅で薬剤名・患者識別を切らないため横スクロールコンテナで包む(監査 L-02)
    expect(html).toContain('class="table-scroll"');
  });

  it("shows a select action only when onSelect is provided (患者文脈確定 — R-PATCTX)", () => {
    const withSelect = renderToStaticMarkup(
      <PatientSearchResults
        results={[patient({ patientId: "p1" })]}
        query="テスト"
        onSelect={() => undefined}
      />,
    );
    const withoutSelect = renderToStaticMarkup(
      <PatientSearchResults results={[patient({ patientId: "p1" })]} query="テスト" />,
    );

    expect(withSelect).toContain("この患者を選択");
    expect(withSelect).toContain("操作");
    expect(withSelect.match(/patient-search-action-column/g)).toHaveLength(2);
    expect(withoutSelect).not.toContain("この患者を選択");
    expect(withoutSelect).not.toContain("操作");
    expect(withoutSelect).not.toContain("patient-search-action-column");
  });
});
