import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

(globalThis as { React?: typeof React }).React = React;

import type { ReceptionSummaryResponse } from "@yrese/contracts";

import {
  ReceptionIntegrityBoard,
  ReceptionIntegrityView,
  nextReceptionIntegrityRequest,
  retainedSnapshot,
  type ReceptionIntegrityState,
} from "./reception-integrity-board";

const SUMMARY: ReceptionSummaryResponse = {
  date: "2026-07-09",
  totalCount: 3,
  byReceptionStatus: [
    { status: "WAITING", count: 2 },
    { status: "IN_PROGRESS", count: 1 },
    { status: "COMPLETED", count: 0 },
    { status: "CANCELLED", count: 0 },
  ],
  byEligibilityStatus: [
    { status: "VERIFIED", count: 1 },
    { status: "PENDING_REVERIFY", count: 1 },
    { status: "LOCAL_ONLY_UNVERIFIED", count: 1 },
    { status: "NOT_CHECKED", count: 0 },
  ],
};

const EMPTY_SUMMARY: ReceptionSummaryResponse = {
  ...SUMMARY,
  totalCount: 0,
  byReceptionStatus: SUMMARY.byReceptionStatus.map((row) => ({ ...row, count: 0 })),
  byEligibilityStatus: SUMMARY.byEligibilityStatus.map((row) => ({ ...row, count: 0 })),
};

const NOTICE = {
  message: "集計APIへ到達できませんでした。障害とは断定せず未確認として扱います。",
  nextAction: "時間をおいて再取得するか、管理画面でAPI疎通を確認してください。",
} as const;

function loaded(summary = SUMMARY): ReceptionIntegrityState {
  return { kind: "loaded", summary, loadedAt: "09:30" };
}

describe("retainedSnapshot", () => {
  it("derives the snapshot from a loaded state", () => {
    expect(retainedSnapshot(loaded())).toEqual({ summary: SUMMARY, loadedAt: "09:30" });
  });

  it("keeps the previous snapshot while reloading and after a failure", () => {
    const previous = { summary: SUMMARY, loadedAt: "09:30" };

    expect(retainedSnapshot({ kind: "loading", date: "2026-07-10", previous })).toBe(previous);
    expect(
      retainedSnapshot({
        kind: "error",
        date: "2026-07-10",
        notice: NOTICE,
        previous,
      }),
    ).toBe(previous);
  });

  it("returns null when nothing has been loaded yet", () => {
    expect(
      retainedSnapshot({ kind: "loading", date: "2026-07-09", previous: null }),
    ).toBeNull();
  });
});

describe("nextReceptionIntegrityRequest", () => {
  it("produces a new request identity for the same business date", () => {
    const first = { date: "2026-07-09", attempt: 0 } as const;
    const retry = nextReceptionIntegrityRequest(first, "2026-07-09");

    // 業務日だけを state に持つと React が更新を bail out し、失敗表示から同じ
    // 業務日で再取得できなくなる。attempt が進むことで effect が再実行される。
    expect(retry).not.toEqual(first);
    expect(retry).toEqual({ date: "2026-07-09", attempt: 1 });
  });

  it("carries the newly chosen business date", () => {
    expect(
      nextReceptionIntegrityRequest({ date: "2026-07-09", attempt: 2 }, "2026-07-10"),
    ).toEqual({ date: "2026-07-10", attempt: 3 });
  });
});

describe("ReceptionIntegrityView", () => {
  it("announces the first load as busy without inventing counts", () => {
    const html = renderToStaticMarkup(
      <ReceptionIntegrityView state={{ kind: "loading", date: "2026-07-09", previous: null }} />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("2026-07-09 の受付集計を取得しています…");
    expect(html).not.toContain("0件");
  });

  it("renders every reception and eligibility status with its measured count", () => {
    const html = renderToStaticMarkup(<ReceptionIntegrityView state={loaded()} />);

    expect(html).toContain("業務日 2026-07-09 の保存済み受付は 3 件です(最終取得 09:30(JST))。");
    // 全 enum メンバーを列挙する(0 件も実測値として出す)。
    for (const label of [
      "待機中",
      "対応中",
      "完了",
      "取消済み",
      "資格確認済み",
      "資格再確認待ち(請求前に再確認必須)",
      "ローカル参照のみ(オンライン未確認)",
      "資格未確認",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("0件は実測値であり、未取得ではありません。");
    expect(html).toContain('data-domain="eligibility"');
    expect(html).toContain('data-domain="reception"');
  });

  it("never renders patient identity in this batch-scoped aggregate", () => {
    const html = renderToStaticMarkup(<ReceptionIntegrityView state={loaded()} />);

    // 集計APIは患者識別子を返さない。この画面に患者文脈を持ち込まないことを固定する。
    expect(html).not.toContain("患者");
    expect(html).not.toContain("カナ");
    expect(html).not.toContain("生年月日");
  });

  it("distinguishes a measured zero from an unavailable aggregate", () => {
    const html = renderToStaticMarkup(<ReceptionIntegrityView state={loaded(EMPTY_SUMMARY)} />);

    expect(html).toContain("実測0件");
    expect(html).toContain("集計が未接続なのではなく、この業務日の受付が0件です。");
    expect(html).not.toContain("—");
  });

  it("keeps the previous result visible on a failed refresh and states what is shown", () => {
    const html = renderToStaticMarkup(
      <ReceptionIntegrityView
        state={{
          kind: "error",
          date: "2026-07-10",
          notice: NOTICE,
          previous: { summary: SUMMARY, loadedAt: "09:30" },
        }}
      />,
    );

    expect(html).toContain(
      "表示中の内容は業務日 2026-07-09 を 09:30(JST)に取得した結果です。業務日 2026-07-10 の取得は完了していません。",
    );
    expect(html).toContain("待機中");
    expect(html).toContain(NOTICE.message);
    expect(html).toContain(NOTICE.nextAction);
  });

  it("marks the whole panel busy and offers a business-date form before any data arrives", () => {
    const html = renderToStaticMarkup(<ReceptionIntegrityBoard />);

    expect(html).toContain('<section aria-label="受付・資格確認の保存済み実件数"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="date"');
    expect(html).toContain("業務日(JST)");
    expect(html).toContain("表示");
    // 他画面の業務日フィルタと同じ filter-grid を使う。患者検索用の legacy 指定は
    // 同じ要素の operator-input / operator-button を詳細度で上書きしてしまう。
    expect(html).toContain('class="filter-grid"');
    expect(html).not.toContain("patient-search-form");
    expect(html).not.toContain("patient-search-row");
    // 取得前に件数を描画しない(0 も点検結果も出さない)。
    expect(html).not.toContain("件です");
  });

  it("shows only the error notice when no earlier result exists", () => {
    const html = renderToStaticMarkup(
      <ReceptionIntegrityView
        state={{ kind: "error", date: "2026-07-09", notice: NOTICE, previous: null }}
      />,
    );

    expect(html).toContain(NOTICE.message);
    expect(html).not.toContain("待機中");
    expect(html).not.toContain("保存済み受付は");
  });
});
