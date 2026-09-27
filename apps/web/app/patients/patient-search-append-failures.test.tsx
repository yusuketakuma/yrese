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

describe('patient search append failure handling', () => {
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
});
