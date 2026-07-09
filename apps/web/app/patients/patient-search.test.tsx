import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PatientSearchResult } from "@yrese/contracts";

import { ELIGIBILITY_LABELS } from "../components/patient-header";
import {
  createSearchRunner,
  devTenantHeaders,
  duplicateKanaSet,
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

  it("sends dev tenant headers only in development (WP-4038)", () => {
    expect(devTenantHeaders("development")).toMatchObject({
      "x-dev-tenant": "t-dev",
      "x-dev-pharmacy": "ph-dev",
    });
    expect(devTenantHeaders("production")).toEqual({});
    expect(devTenantHeaders("test")).toEqual({});
    expect(devTenantHeaders(undefined)).toEqual({});
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
  });
});
