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
} from "../components/patient-header";
import { PATIENT_SEARCH_DEV_SCOPES, devTenantHeaders } from "../dev-tenant";
import { patientId } from "@yrese/shared-kernel";
import {
  createSearchRunner,
  duplicateKanaSet,
  fetchSearch,
  PatientSearch,
  PatientSearchResults,
  type SearchPage,
  type SearchState,
} from "./patient-search";

(globalThis as { React?: typeof React }).React = React;

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

describe("patient search hardening (WP-3008 / SCR-002)", () => {
  it("does not serialize a patient search query when hydration is unavailable", () => {
    const html = renderToStaticMarkup(<PatientSearch />);
    const formTag = html.match(/<form\b[^>]*class="patient-search-form"[^>]*>/)?.[0];
    const inputTag = html.match(/<input\b[^>]*id="patient-search-q"[^>]*>/)?.[0];

    expect(formTag).toBeDefined();
    expect(formTag).toContain('action="/patients"');
    expect(formTag).toContain('method="post"');
    expect(inputTag).toBeDefined();
    expect(inputTag).not.toMatch(/\sname=/);
  });

  it("uses the same-origin development proxy for patient searches (WP-4067)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    } as unknown as Response);

    try {
      await fetchSearch("合成", undefined, fetchImpl);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "/_yrese-api/patients/search?q=%E5%90%88%E6%88%90&limit=20",
    );
  });

  it("forwards an optional abort signal only to the fetch transport", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    } as unknown as Response);
    const controller = new AbortController();

    try {
      await fetchSearch("合成", undefined, fetchImpl, controller.signal);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      "/_yrese-api/patients/search?q=%E5%90%88%E6%88%90&limit=20",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("accepts a page at the requested default limit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const results = Array.from({ length: PATIENT_SEARCH_DEFAULT_LIMIT }, (_, index) =>
      patient({ patientId: `patient-exact-limit-${index}` }),
    );
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    try {
      await expect(fetchSearch("合成", undefined, fetchImpl)).resolves.toEqual({ results });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects an over-limit page with a fixed non-echo error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const sensitiveResult = patient({
      patientId: "patient-over-limit-sensitive",
      name: "秘密 患者",
      kana: "ヒミツ カンジャ",
      birthDate: "1970-12-31",
      patientNumber: "SECRET-OVER-LIMIT-001",
      eligibilityStatus: "PENDING_REVERIFY",
    });
    const results = Array.from(
      { length: PATIENT_SEARCH_DEFAULT_LIMIT + 1 },
      (_, index) =>
        index === PATIENT_SEARCH_DEFAULT_LIMIT
          ? sensitiveResult
          : patient({ patientId: `patient-over-limit-${index}` }),
    );
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results, nextCursor: "cursor-over-limit-sensitive" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    let thrown: unknown;
    try {
      await fetchSearch("秘密検索語", undefined, fetchImpl);
    } catch (error) {
      thrown = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Patient search response exceeded the requested page limit",
    );
    const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
    expect(serialized).not.toContain("秘密検索語");
    expect(serialized).not.toContain("patient-over-limit-sensitive");
    expect(serialized).not.toContain("秘密 患者");
    expect(serialized).not.toContain("ヒミツ カンジャ");
    expect(serialized).not.toContain("1970-12-31");
    expect(serialized).not.toContain("SECRET-OVER-LIMIT-001");
    expect(serialized).not.toContain("PENDING_REVERIFY");
    expect(serialized).not.toContain("cursor-over-limit-sensitive");
  });

  it("accepts an empty terminal page without a continuation cursor", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    try {
      await expect(fetchSearch("合成", undefined, fetchImpl)).resolves.toEqual({
        results: [],
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects an empty continuation page with a fixed non-echo error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const sensitiveCursor = "cursor-empty-continuation-sensitive";
    const sensitiveQuery = "秘密検索語";
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [], nextCursor: sensitiveCursor }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    let thrown: unknown;
    try {
      await fetchSearch(sensitiveQuery, undefined, fetchImpl);
    } catch (error) {
      thrown = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Patient search response returned an empty continuation page",
    );
    const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
    expect(serialized).not.toContain(sensitiveQuery);
    expect(serialized).not.toContain(sensitiveCursor);
  });

  it.each([201, 202, 204, 206])(
    "rejects unsupported patient-search success status %i before reading the body",
    async (status) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
      const json = vi.fn(async () => ({
        results: [
          patient({
            patientId: "patient-sensitive-unsupported",
            name: "秘密 患者",
            patientNumber: "SECRET-SEARCH-001",
          }),
        ],
        nextCursor: "cursor-sensitive-unsupported",
      }));
      const fetchImpl: typeof fetch = async () =>
        ({ ok: true, status, json }) as unknown as Response;

      let thrown: unknown;
      try {
        await fetchSearch("秘密検索語", undefined, fetchImpl);
      } catch (error) {
        thrown = error;
      } finally {
        vi.unstubAllEnvs();
      }

      expect(json).not.toHaveBeenCalled();
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(`検索に失敗しました(HTTP ${status})。`);
      const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
      expect(serialized).not.toContain("秘密検索語");
      expect(serialized).not.toContain("patient-sensitive-unsupported");
      expect(serialized).not.toContain("秘密 患者");
      expect(serialized).not.toContain("SECRET-SEARCH-001");
      expect(serialized).not.toContain("cursor-sensitive-unsupported");
    },
  );

  it("fails before fetch when the production API base is missing (WP-4067)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl = vi.fn();
    const sensitiveQuery = "合成患者-秘密";

    let thrown: unknown;
    try {
      await fetchSearch(sensitiveQuery, undefined, fetchImpl);
    } catch (error) {
      thrown = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(sensitiveQuery);
  });

  it("fails before fetch when production API base uses plaintext HTTP (WP-4080)", async () => {
    const sensitiveBase = "http://patient-data.internal.example.test/private";
    const sensitiveQuery = "合成患者-秘密";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", sensitiveBase);
    const fetchImpl = vi.fn();

    let thrown: unknown;
    try {
      await fetchSearch(sensitiveQuery, undefined, fetchImpl);
    } catch (error) {
      thrown = error;
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(sensitiveBase);
    expect((thrown as Error).message).not.toContain(sensitiveQuery);
  });

  it("warns on duplicate kana and flags each duplicate row (P-09)", () => {
    const results = [
      patient({ patientId: "p1", patientNumber: "T-0001", kana: "ヤマダ タロウ" }),
      patient({ patientId: "p2", patientNumber: "T-0002", kana: "ヤマダ タロウ", birthDate: "1985-05-05" }),
      patient({ patientId: "p3", patientNumber: "T-0003", kana: "スズキ ハナコ" }),
    ];
    const html = renderToStaticMarkup(
      <PatientSearchResults results={results} query="ヤマダ" />,
    );

    expect(html).toContain(
      "同姓同名の患者が複数います。生年月日・患者番号で必ず確認してください。",
    );
    expect(html).toContain("[警告(WARNING)]");
    expect(html.match(/data-duplicate-kana="true"/g)).toHaveLength(2);
    expect(html.match(/【同姓同名注意】/g)).toHaveLength(2);
  });

  it("shows no duplicate warning when all kana are unique", () => {
    const html = renderToStaticMarkup(
      <PatientSearchResults
        results={[
          patient({ patientId: "p1", kana: "ヤマダ タロウ" }),
          patient({ patientId: "p2", kana: "スズキ ハナコ" }),
        ]}
        query="テスト"
      />,
    );

    expect(html).not.toContain("同姓同名");
    expect(html).not.toContain("data-duplicate-kana");
  });

  it("notes that unloaded pages may contain duplicate kana when a next cursor exists (opus F1)", () => {
    const withCursor = renderToStaticMarkup(
      <PatientSearchResults
        results={[patient({ patientId: "p1", kana: "ヤマダ タロウ" })]}
        query="テスト"
        nextCursor="cursor-1"
      />,
    );
    expect(withCursor).toContain("未読込の続きがあります");
    expect(withCursor).toContain("[情報(INFO)]");

    const withoutCursor = renderToStaticMarkup(
      <PatientSearchResults
        results={[patient({ patientId: "p1", kana: "ヤマダ タロウ" })]}
        query="テスト"
      />,
    );
    expect(withoutCursor).not.toContain("未読込の続きがあります");
  });

  it("duplicateKanaSet detects only exact kana matches", () => {
    const set = duplicateKanaSet([
      patient({ patientId: "p1", kana: "ヤマダ タロウ" }),
      patient({ patientId: "p2", kana: "ヤマダ タロウ" }),
      patient({ patientId: "p3", kana: "ヤマダ タロー" }),
    ]);

    expect(set.has("ヤマダ タロウ")).toBe(true);
    expect(set.has("ヤマダ タロー")).toBe(false);
  });

  it("discards stale responses so the last search wins (WP-4037)", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    let resolveFirst!: (page: SearchPage) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: [patient({ patientId: "p-new", kana: "アタラシイ ケッカ" })],
        }),
      );

    const run = createSearchRunner(fetcher, emit);
    const first = run("古い検索");
    const second = run("新しい検索");
    await second;
    // 古い検索の応答が後から到着しても破棄される
    resolveFirst({
      results: [patient({ patientId: "p-old", kana: "フルイ ケッカ" })],
    });
    await first;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.query).toBe("新しい検索");
      expect(last.results.map((p) => p.patientId)).toEqual(["p-new"]);
    }
  });

  it("aborts a superseded full search before committing the newer result", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(
      (query: string, _cursor: string | undefined, signal: AbortSignal) => {
        signals.push(signal);
        if (query === "古い検索") {
          return new Promise<SearchPage>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          });
        }
        return Promise.resolve({ results: [patient({ patientId: "patient-new" })] });
      },
    );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const oldSearch = run("古い検索");
    await run("新しい検索");
    await oldSearch;

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "新しい検索",
      results: [{ patientId: "patient-new" }],
    });
    expect(states.some((state) => state.kind === "error")).toBe(false);
  });

  it("does not start obsolete transport after an abort listener admits a newer search", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let run!: ReturnType<typeof createSearchRunner>;
    let reentrantSearch: Promise<void> | undefined;
    const fetcher = vi.fn(
      (query: string, _cursor: string | undefined, signal: AbortSignal) => {
        if (query === "active-old") {
          return new Promise<SearchPage>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reentrantSearch = run("reentrant-new");
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

    const old = run("active-old");
    await run("obsolete-outer");
    await old;
    await reentrantSearch;

    expect(fetcher.mock.calls.map(([query]) => query)).toEqual([
      "active-old",
      "reentrant-new",
    ]);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "reentrant-new",
    });
  });

  it("does not fetch after loading emission synchronously admits a newer search", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let run!: ReturnType<typeof createSearchRunner>;
    let reentrantSearch: Promise<void> | undefined;
    let reenter = true;
    const fetcher = vi.fn((query: string) =>
      Promise.resolve({ results: [patient({ patientId: `patient-${query}` })] }),
    );
    run = createSearchRunner(fetcher, (update) => {
      if (reenter) {
        reenter = false;
        reentrantSearch = run("newer-from-emit");
      }
      states.push(update(states[states.length - 1]!));
    });

    await run("obsolete-before-fetch");
    await reentrantSearch;

    expect(fetcher.mock.calls.map(([query]) => query)).toEqual(["newer-from-emit"]);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "newer-from-emit",
    });
  });

  it("discards stale failures so a late error does not mask newer results (WP-4037)", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    let rejectFirst!: (reason: Error) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ results: [patient({ patientId: "p-new" })] }),
      );

    const run = createSearchRunner(fetcher, emit);
    const first = run("古い検索");
    const second = run("新しい検索");
    await second;
    rejectFirst(new Error("stale failure"));
    await first;

    expect(states[states.length - 1]!.kind).toBe("loaded");
  });

  it("rejects a current unsupported search page without committing selectable results", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [patient({ patientId: "patient-untrusted" })] }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
    } finally {
      vi.unstubAllEnvs();
    }

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("error");
    expect(JSON.stringify(last)).not.toContain("patient-untrusted");
  });

  it("rejects a current over-limit page without committing selectable results", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const results = Array.from(
      { length: PATIENT_SEARCH_DEFAULT_LIMIT + 1 },
      (_, index) => patient({ patientId: `patient-untrusted-over-limit-${index}` }),
    );
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
    } finally {
      vi.unstubAllEnvs();
    }

    const last = states[states.length - 1]!;
    expect(last).toMatchObject({
      kind: "error",
      notice: { message: "検索結果の処理に失敗しました。" },
    });
    expect(JSON.stringify(last)).not.toContain("patient-untrusted-over-limit");
  });

  it("rejects an initial empty continuation page and permits retry", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const responses = [
      new Response(
        JSON.stringify({ results: [], nextCursor: "cursor-untrusted-empty-initial" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(
        JSON.stringify({ results: [patient({ patientId: "patient-initial-retry" })] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      const failed = states[states.length - 1]!;
      expect(failed).toMatchObject({
        kind: "error",
        notice: { message: "検索結果の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("cursor-untrusted-empty-initial");

      await run("合成");
    } finally {
      vi.unstubAllEnvs();
    }

    const retried = states[states.length - 1]!;
    expect(retried).toMatchObject({
      kind: "loaded",
      query: "合成",
      results: [expect.objectContaining({ patientId: "patient-initial-retry" })],
      appendState: { kind: "idle" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("suppresses a stale unsupported search page after a newer exact-200 result", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    let resolveOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve;
    });
    const fetchImpl: typeof fetch = async (input) =>
      String(input).includes(encodeURIComponent("古い検索"))
        ? oldResponse
        : new Response(JSON.stringify({ results: [patient({ patientId: "patient-new" })] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      const old = run("古い検索");
      await run("新しい検索");
      resolveOld(
        new Response(JSON.stringify({ results: [patient({ patientId: "patient-old-untrusted" })] }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
      );
      await old;
    } finally {
      vi.unstubAllEnvs();
    }

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.query).toBe("新しい検索");
      expect(last.results.map((result) => result.patientId)).toEqual(["patient-new"]);
    }
    expect(JSON.stringify(states)).not.toContain("patient-old-untrusted");
  });

  it("keeps a blank-query warning authoritative over a late success", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    let resolveFirst!: (page: SearchPage) => void;
    const fetcher = vi.fn<(q: string) => Promise<SearchPage>>(
      () =>
        new Promise<SearchPage>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const run = createSearchRunner(fetcher, emit);

    const first = run("合成");
    await run("   ");
    resolveFirst({ results: [patient({ patientId: "stale-patient" })] });
    await first;

    expect(fetcher).toHaveBeenCalledOnce();
    expect(states[states.length - 1]).toEqual({
      kind: "error",
      notice: {
        severity: "WARNING",
        message: "検索語が入力されていません。",
        nextAction: "氏名・カナ・患者番号のいずれかを入力してください。",
      },
    });
  });

  it("keeps a blank-query warning authoritative over a late failure", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    let rejectFirst!: (reason: Error) => void;
    const fetcher = vi.fn<(q: string) => Promise<SearchPage>>(
      () =>
        new Promise<SearchPage>((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    const run = createSearchRunner(fetcher, emit);

    const first = run("合成");
    await run("\t");
    rejectFirst(new Error("late failure"));
    await first;

    expect(fetcher).toHaveBeenCalledOnce();
    const last = states[states.length - 1]!;
    expect(last.kind).toBe("error");
    if (last.kind === "error") {
      expect(last.notice.severity).toBe("WARNING");
      expect(last.notice.message).toBe("検索語が入力されていません。");
    }
  });

  it("does not call the fetcher for a blank query", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const fetcher = vi.fn<(q: string) => Promise<SearchPage>>();
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("   ");

    expect(fetcher).not.toHaveBeenCalled();
    expect(states[states.length - 1]?.kind).toBe("error");
  });

  it("aborts an active request before making a blank warning authoritative", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let activeSignal: AbortSignal | undefined;
    const fetcher = vi.fn(
      (_query: string, _cursor: string | undefined, signal: AbortSignal) => {
        activeSignal = signal;
        return new Promise<SearchPage>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      },
    );
    const run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const active = run("合成");
    await run("   ");
    await active;

    expect(activeSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(states[states.length - 1]).toMatchObject({
      kind: "error",
      notice: { severity: "WARNING", message: "検索語が入力されていません。" },
    });
  });

  it("does not emit a blank warning when abort re-entry admits a newer search", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    let run!: ReturnType<typeof createSearchRunner>;
    let reentrantSearch: Promise<void> | undefined;
    const fetcher = vi.fn(
      (query: string, _cursor: string | undefined, signal: AbortSignal) => {
        if (query === "active-old") {
          return new Promise<SearchPage>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reentrantSearch = run("newer-from-abort");
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve({ results: [patient({ patientId: "newer-result" })] });
      },
    );
    run = createSearchRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    const old = run("active-old");
    await run("   ");
    await old;
    await reentrantSearch;

    expect(fetcher.mock.calls.map(([query]) => query)).toEqual([
      "active-old",
      "newer-from-abort",
    ]);
    expect(states.some((state) => state.kind === "error")).toBe(false);
    expect(states[states.length - 1]).toMatchObject({
      kind: "loaded",
      query: "newer-from-abort",
    });
  });

  it("discards a stale append so another query's continuation never mixes in (WP-4037 / opus F3)", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    let resolveAppend!: (page: SearchPage) => void;
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      // 1回目: query A の初回ページ(即時)
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: [patient({ patientId: "a1", kana: "エー イチ" })],
          nextCursor: "cursor-a",
        }),
      )
      // 2回目: query A の append(遅延 — 後で解決)
      .mockImplementationOnce(
        () =>
          new Promise<SearchPage>((resolve) => {
            resolveAppend = resolve;
          }),
      )
      // 3回目: query B の初回ページ(即時)
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: [patient({ patientId: "b1", kana: "ビー イチ" })],
        }),
      );

    const run = createSearchRunner(fetcher, emit);
    await run("検索A");
    const appendA = run("検索A", "cursor-a", true); // A の続きが in-flight のまま
    const searchB = run("検索B");
    await searchB;
    // A の append が遅れて到着しても、B の結果へ混ざらず破棄される
    resolveAppend({
      results: [patient({ patientId: "a2", kana: "エー ニ" })],
    });
    await appendA;

    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.query).toBe("検索B");
      expect(last.results.map((p) => p.patientId)).toEqual(["b1"]);
    }
  });

  it("preserves loaded results and cursor when append fails, then retries the same page", async () => {
    const states: SearchState[] = [{ kind: "idle" }];
    const emit = (update: (prev: SearchState) => SearchState) => {
      states.push(update(states[states.length - 1]!));
    };
    const fetcher = vi
      .fn<(q: string, cursor?: string) => Promise<SearchPage>>()
      .mockResolvedValueOnce({
        results: [patient({ patientId: "p1", kana: "ドウイツ カナ" })],
        nextCursor: "cursor-1",
      })
      .mockRejectedValueOnce(new Error("raw append failure must not appear"))
      .mockResolvedValueOnce({
        results: [patient({ patientId: "p2", kana: "ドウイツ カナ" })],
      });
    const run = createSearchRunner(fetcher, emit);

    await run("合成");
    await run("合成", "cursor-1", true);
    const failed = states[states.length - 1]!;
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
    expect(failed.results.map((result) => result.patientId)).toEqual(["p1"]);
    expect(failed.query).toBe("合成");
    expect(failed.nextCursor).toBe("cursor-1");
    expect(failed.appendState).toMatchObject({
      kind: "error",
      notice: { message: "検索結果の処理に失敗しました。" },
    });
    expect(JSON.stringify(failed)).not.toContain("raw append failure");

    await run(failed.query, failed.nextCursor, true);
    const retried = states[states.length - 1]!;
    expect(retried.kind).toBe("loaded");
    if (retried.kind !== "loaded") throw new Error("expected retried loaded state");
    expect(retried.results.map((result) => result.patientId)).toEqual(["p1", "p2"]);
    expect(retried.nextCursor).toBeUndefined();
    expect(retried.appendState).toEqual({ kind: "idle" });
    expect(fetcher.mock.calls.map(([query, cursor]) => [query, cursor])).toEqual([
      ["合成", undefined],
      ["合成", "cursor-1"],
      ["合成", "cursor-1"],
    ]);
    expect(duplicateKanaSet(retried.results).has("ドウイツ カナ")).toBe(true);
  });

  it("retains the verified page when an append returns unsupported 202 and permits retry", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const responses = [
      new Response(
        JSON.stringify({
          results: [patient({ patientId: "patient-retained" })],
          nextCursor: "cursor-retry",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(
        JSON.stringify({
          results: [patient({ patientId: "patient-untrusted-append" })],
          nextCursor: "cursor-untrusted",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ results: [patient({ patientId: "patient-retried" })] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      await run("合成", "cursor-retry", true);
      const failed = states[states.length - 1]!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
      expect(failed.results.map((result) => result.patientId)).toEqual(["patient-retained"]);
      expect(failed.nextCursor).toBe("cursor-retry");
      expect(failed.appendState.kind).toBe("error");
      expect(JSON.stringify(failed)).not.toContain("patient-untrusted-append");
      expect(JSON.stringify(failed)).not.toContain("cursor-untrusted");

      await run(failed.query, failed.nextCursor, true);
    } finally {
      vi.unstubAllEnvs();
    }

    const retried = states[states.length - 1]!;
    expect(retried.kind).toBe("loaded");
    if (retried.kind === "loaded") {
      expect(retried.results.map((result) => result.patientId)).toEqual([
        "patient-retained",
        "patient-retried",
      ]);
      expect(retried.nextCursor).toBeUndefined();
      expect(retried.appendState).toEqual({ kind: "idle" });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retains the verified page when an append exceeds its limit and permits retry", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const retained = patient({ patientId: "patient-retained-over-limit" });
    const untrustedResults = Array.from(
      { length: PATIENT_SEARCH_DEFAULT_LIMIT + 1 },
      (_, index) =>
        patient({
          patientId: `patient-untrusted-append-${index}`,
          name: index === PATIENT_SEARCH_DEFAULT_LIMIT ? "秘密 追加患者" : "合成 患者",
        }),
    );
    const replacement = patient({ patientId: "patient-retry-after-over-limit" });
    const responses = [
      new Response(
        JSON.stringify({ results: [retained], nextCursor: "cursor-retained-over-limit" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(
        JSON.stringify({
          results: untrustedResults,
          nextCursor: "cursor-untrusted-over-limit",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ results: [replacement] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      await run("合成", "cursor-retained-over-limit", true);
      const failed = states[states.length - 1]!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
      expect(failed.results).toEqual([retained]);
      expect(failed.nextCursor).toBe("cursor-retained-over-limit");
      expect(failed.appendState).toMatchObject({
        kind: "error",
        notice: { message: "検索結果の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("patient-untrusted-append");
      expect(JSON.stringify(failed)).not.toContain("秘密 追加患者");
      expect(JSON.stringify(failed)).not.toContain("cursor-untrusted-over-limit");

      await run(failed.query, failed.nextCursor, true);
    } finally {
      vi.unstubAllEnvs();
    }

    const retried = states[states.length - 1]!;
    expect(retried.kind).toBe("loaded");
    if (retried.kind === "loaded") {
      expect(retried.results).toEqual([retained, replacement]);
      expect(retried.nextCursor).toBeUndefined();
      expect(retried.appendState).toEqual({ kind: "idle" });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toEqual([
      "/_yrese-api/patients/search?q=%E5%90%88%E6%88%90&limit=20",
      "/_yrese-api/patients/search?q=%E5%90%88%E6%88%90&limit=20&cursor=cursor-retained-over-limit",
      "/_yrese-api/patients/search?q=%E5%90%88%E6%88%90&limit=20&cursor=cursor-retained-over-limit",
    ]);
  });

  it("retains the verified page when an append returns an empty continuation", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const retained = patient({ patientId: "patient-retained-empty-continuation" });
    const replacement = patient({ patientId: "patient-retry-empty-continuation" });
    const responses = [
      new Response(
        JSON.stringify({ results: [retained], nextCursor: "cursor-retained-empty" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(
        JSON.stringify({ results: [], nextCursor: "cursor-untrusted-empty" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ results: [replacement] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      await run("合成", "cursor-retained-empty", true);
      const failed = states[states.length - 1]!;
      expect(failed.kind).toBe("loaded");
      if (failed.kind !== "loaded") throw new Error("expected retained loaded state");
      expect(failed.results).toEqual([retained]);
      expect(failed.query).toBe("合成");
      expect(failed.nextCursor).toBe("cursor-retained-empty");
      expect(failed.appendState).toMatchObject({
        kind: "error",
        notice: { message: "検索結果の処理に失敗しました。" },
      });
      expect(JSON.stringify(failed)).not.toContain("cursor-untrusted-empty");

      await run(failed.query, failed.nextCursor, true);
    } finally {
      vi.unstubAllEnvs();
    }

    const retried = states[states.length - 1]!;
    expect(retried.kind).toBe("loaded");
    if (retried.kind === "loaded") {
      expect(retried.results).toEqual([retained, replacement]);
      expect(retried.nextCursor).toBeUndefined();
      expect(retried.appendState).toEqual({ kind: "idle" });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("accepts an empty terminal append and clears the consumed cursor", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const retained = patient({ patientId: "patient-retained-empty-terminal" });
    const responses = [
      new Response(
        JSON.stringify({ results: [retained], nextCursor: "cursor-empty-terminal" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      await run("合成", "cursor-empty-terminal", true);
    } finally {
      vi.unstubAllEnvs();
    }

    const loaded = states[states.length - 1]!;
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind !== "loaded") throw new Error("expected loaded terminal state");
    expect(loaded.results).toEqual([retained]);
    expect(loaded.nextCursor).toBeUndefined();
    expect(loaded.appendState).toEqual({ kind: "idle" });
  });

  it("allows cumulative results to exceed the per-page limit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const states: SearchState[] = [{ kind: "idle" }];
    const firstPage = Array.from({ length: PATIENT_SEARCH_DEFAULT_LIMIT }, (_, index) =>
      patient({ patientId: `patient-cumulative-${index}` }),
    );
    const secondPage = Array.from({ length: PATIENT_SEARCH_DEFAULT_LIMIT }, (_, index) =>
      patient({ patientId: `patient-cumulative-${PATIENT_SEARCH_DEFAULT_LIMIT + index}` }),
    );
    const responses = [
      new Response(
        JSON.stringify({ results: firstPage, nextCursor: "cursor-cumulative" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ results: secondPage }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("unexpected search request");
      return response;
    });
    const run = createSearchRunner(
      (query, cursor) => fetchSearch(query, cursor, fetchImpl),
      (update) => states.push(update(states[states.length - 1]!)),
    );

    try {
      await run("合成");
      await run("合成", "cursor-cumulative", true);
    } finally {
      vi.unstubAllEnvs();
    }

    const loaded = states[states.length - 1]!;
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind !== "loaded") throw new Error("expected cumulative loaded state");
    expect(loaded.results).toEqual([...firstPage, ...secondPage]);
    expect(loaded.results).toHaveLength(PATIENT_SEARCH_DEFAULT_LIMIT * 2);
    expect(loaded.nextCursor).toBeUndefined();
    expect(loaded.appendState).toEqual({ kind: "idle" });
  });

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
    expect(html).toContain('role="alert"');
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

describe("computeAgeYears (患者年齢 — R-PATCTX)", () => {
  it("counts a birthday already passed this year", () => {
    expect(computeAgeYears("1990-06-15", new Date("2026-07-11T00:00:00+09:00"))).toBe(36);
  });

  it("does not count a birthday not yet reached this year", () => {
    expect(computeAgeYears("1990-08-01", new Date("2026-07-11T00:00:00+09:00"))).toBe(35);
  });

  it("counts the birthday on the exact day", () => {
    expect(computeAgeYears("1990-07-11", new Date("2026-07-11T00:00:00+09:00"))).toBe(36);
  });
});

describe("PatientHeader with a selected patient (患者取り違え防止表示 — R-PATCTX)", () => {
  it("fixes the identity + computed age + eligibility of the selected patient", () => {
    const p = patient({
      patientId: "p-selected",
      name: "選択 花子",
      kana: "センタク ハナコ",
      birthDate: "1988-03-20",
      sex: "female",
      eligibilityStatus: "PENDING_REVERIFY",
    });
    const html = renderToStaticMarkup(
      <PatientHeader
        patientId={patientId(p.patientId)}
        name={p.name}
        kana={p.kana}
        birthDate={p.birthDate}
        age={computeAgeYears(p.birthDate, new Date("2026-07-11T00:00:00+09:00"))}
        sex={p.sex}
        eligibility={p.eligibilityStatus}
      />,
    );

    expect(html).toContain("センタク ハナコ");
    expect(html).toContain("選択 花子");
    expect(html).toContain("1988-03-20");
    expect(html).toContain("38歳");
    expect(html).toContain(ELIGIBILITY_LABELS.PENDING_REVERIFY);
    expect(html).toContain('data-patient-id="p-selected"');
  });
});
