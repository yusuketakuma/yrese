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
import { SEX_LABELS } from "../status/visual-status-registry";
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
} from "./patient-search";

(globalThis as { React?: typeof React }).React = React;


import {
  patient,
  captureSearchFailure,
} from './patient-search-test-support';

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

  it("does not construct Intl.DateTimeFormat per call (WP-5262 hoisted formatter)", () => {
    const constructorSpy = vi.spyOn(Intl, "DateTimeFormat");
    try {
      const asOf = new Date("2026-07-11T00:00:00+09:00");
      expect(computeAgeYears("1990-06-15", asOf)).toBe(36);
      expect(computeAgeYears("1990-08-01", asOf)).toBe(35);
      expect(computeAgeYears("1990-07-11", asOf)).toBe(36);
      expect(constructorSpy).not.toHaveBeenCalled();
    } finally {
      constructorSpy.mockRestore();
    }
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
    expect(html).not.toContain('data-patient-id="p-selected"');
  });

  it("renders the sex label from the shared visual status registry (WP-4041)", () => {
    // 患者ヘッダーが独自の性別文言を持つと、registry を直しても患者スコープの
    // 全画面上部に出るこのバナーだけ旧文言のまま残る。
    for (const sex of ["male", "female", "unknown"] as const) {
      const html = renderToStaticMarkup(
        <PatientHeader
          patientId={patientId("p-selected")}
          name="選択 花子"
          kana="センタク ハナコ"
          birthDate="1988-03-20"
          age={38}
          sex={sex}
          eligibility="VERIFIED"
        />,
      );

      expect(html).toContain(`歳・${SEX_LABELS[sex]})`);
    }
  });
});

describe("patient search metrics reflect real search state (WP-5101)", () => {
  it("projects the loaded result count into the 検索結果 metric", () => {
    const state: SearchState = {
      kind: "loaded",
      results: [patient({}), patient({ patientId: "patient-test-002" })],
      query: "ヤマダ",
      appendState: { kind: "idle" },
    };
    expect(patientSearchResultMetric(state)).toEqual({
      value: "2",
      detail: "「ヤマダ」の該当件数",
    });
  });

  it("keeps the 検索結果 metric truthful before any search", () => {
    expect(patientSearchResultMetric({ kind: "idle" })).toEqual({
      value: "—",
      detail: "検索実行後に一覧表示",
    });
  });

  it("marks a partially loaded page as 続きあり", () => {
    const state: SearchState = {
      kind: "loaded",
      results: [patient({})],
      nextCursor: "cursor-1",
      query: "ヤ",
      appendState: { kind: "idle" },
    };
    const metric = patientSearchResultMetric(state);
    expect(metric.value).toBe("1");
    // 総件数は契約に存在しないため、切り詰めた頁を「該当件数」と呼ばない。
    expect(metric.detail).not.toContain("該当件数");
    expect(metric.detail).toContain("表示中件数");
    expect(metric.detail).toContain("総数不明");
  });

  it("renders the metric grid with truthful initial values from PatientSearch", () => {
    const html = renderToStaticMarkup(<PatientSearch />);
    expect(html).toContain("検索結果");
    expect(html).toContain("選択中の患者");
    expect(html).toContain("検索実行後に一覧表示");
    expect(html).toContain("患者一覧");
  });
});

describe("patient search shell and unavailable-metric truthfulness (SCR-002 refresh)", () => {
  it("nests the 患者一覧 panel inside the 患者検索 section landmark", () => {
    const html = renderToStaticMarkup(<PatientSearch />);
    const sectionAt = html.indexOf('<section aria-label="患者検索">');
    const panelAt = html.indexOf('class="operator-panel live-surface-panel"');

    expect(sectionAt).toBeGreaterThanOrEqual(0);
    expect(panelAt).toBeGreaterThan(sectionAt);
  });

  it("makes the result table scroll container reachable and named", () => {
    const html = renderToStaticMarkup(
      <PatientSearchResults results={[patient({})]} query="テスト" />,
    );
    const wrapper = html.match(/<div class="table-scroll"[^>]*>/)?.[0];

    expect(wrapper).toContain('tabindex="0"');
    expect(wrapper).toContain('aria-label="患者検索結果表。横方向にスクロールできます"');
  });

  it("distinguishes a measured 0件 from an unavailable derivation", () => {
    const empty = renderToStaticMarkup(
      <PatientSearchResults results={[]} query="該当なし" />,
    );

    expect(empty).toContain("の検索結果");
    expect(empty).toContain("0件でした");
    expect(empty).toContain("未接続を意味しません");
  });

  it("names the blocking reason of every metric that cannot be derived", () => {
    const html = renderToStaticMarkup(<PatientSearch />);

    // 未接続の集計を 0 として描かない。理由と「0件ではない」ことを併記する。
    expect(html).toContain("患者横断の集計APIが未登録のため導出できません(0件を意味しません)");
    expect(html).toContain(
      "フォロー対象の判定基準がAPPROVED SSOTに未登録のため導出できません(0件を意味しません)",
    );
    expect(html).not.toContain("集計API未接続<");
  });

  it("explains that no-JS cannot search because the query is never sent to the server", () => {
    const html = renderToStaticMarkup(<PatientSearch />);
    const inputTag = html.match(/<input\b[^>]*id="patient-search-q"[^>]*>/)?.[0];

    expect(inputTag).not.toMatch(/\sname=/);
    expect(html).toContain("JavaScriptが無効の場合");
    expect(html).toContain("URL・送信本文へ載せない設計");
  });

  it("keeps the idle screen from implying an empty patient list", () => {
    const html = renderToStaticMarkup(<PatientSearch />);

    expect(html).toContain("まだ検索を実行していません");
    expect(html).not.toContain("の検索結果");
    expect(html).not.toContain("patient-search-results");
  });

  it("uses a search input with a search-labeled enter key for a faster mobile keyboard (WP-5212-6)", () => {
    const html = renderToStaticMarkup(<PatientSearch />);
    const inputTag = html.match(/<input\b[^>]*id="patient-search-q"[^>]*>/)?.[0];

    expect(inputTag).toContain('type="search"');
    expect(inputTag).toContain('enterKeyHint="search"');
  });
});

