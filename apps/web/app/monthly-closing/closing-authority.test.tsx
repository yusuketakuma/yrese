import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReceptionSummaryResponse, WhoamiResponse } from "@yrese/contracts";

import {
  ClosingAuthorityView,
  ReceptionSummaryView,
  RECEPTION_SUMMARY_SCOPE_NOTE,
  finalizeScopeState,
  type ReceptionSummaryViewState,
  type SessionState,
} from "./closing-authority";

(globalThis as { React?: typeof React }).React = React;

function session(scopes: WhoamiResponse["scopes"]): WhoamiResponse {
  return {
    tenantId: "tenant-syn-a",
    pharmacyId: "pharmacy-syn-a",
    actorId: "actor-syn-a",
    scopes,
  };
}

const SUMMARY: ReceptionSummaryResponse = {
  date: "2026-08-25",
  totalCount: 2,
  byReceptionStatus: [
    { status: "WAITING", count: 1 },
    { status: "IN_PROGRESS", count: 1 },
    { status: "COMPLETED", count: 0 },
    { status: "CANCELLED", count: 0 },
  ],
  byEligibilityStatus: [
    { status: "VERIFIED", count: 2 },
    { status: "PENDING_REVERIFY", count: 0 },
    { status: "LOCAL_ONLY_UNVERIFIED", count: 0 },
    { status: "NOT_CHECKED", count: 0 },
  ],
};

describe("SCR-020 実行権限の2段判定", () => {
  it("scope の有無は実セッションから決め、未取得を付与なしへ丸めない", () => {
    expect(finalizeScopeState({ kind: "loading" })).toBe("unknown");
    expect(
      finalizeScopeState({
        kind: "error",
        notice: { message: "取得できません。", nextAction: "再試行してください。" },
      }),
    ).toBe("unknown");
    expect(
      finalizeScopeState({
        kind: "loaded",
        session: session(["tenant:read", "claim:finalize"]),
      }),
    ).toBe("granted");
    expect(
      finalizeScopeState({ kind: "loaded", session: session(["tenant:read"]) }),
    ).toBe("missing");
  });

  it("claim:finalize が付与されていても実行不可のままゲートを名指しする", () => {
    const html = renderToStaticMarkup(
      <ClosingAuthorityView
        state={{
          kind: "loaded",
          session: session(["tenant:read", "claim:finalize"]),
        }}
      />,
    );

    expect(html).toContain('data-finalize-scope="granted"');
    expect(html).toContain("claim:finalize 付与あり");
    expect(html).toContain('data-allowed="false"');
    expect(html).toContain("権限がありません");
    expect(html).not.toContain("実行可");
    for (const gate of ["UIX-001 §12.3", "RB-001", "RB-004", "ARC-007", "AGENTS.md"]) {
      expect(html).toContain(gate);
    }
  });

  it("scope を取得できない間も実行不可を維持し、次アクション付きで失敗を伝える", () => {
    const state: SessionState = {
      kind: "error",
      notice: {
        message: "セッション情報へ到達できませんでした。",
        nextAction: "時間をおいて再取得してください。",
      },
    };
    const html = renderToStaticMarkup(<ClosingAuthorityView state={state} />);

    expect(html).toContain('data-finalize-scope="unknown"');
    expect(html).toContain("付与なしとは断定しません");
    expect(html).toContain('data-allowed="false"');
    expect(html).toContain("次のアクション: 時間をおいて再取得してください。");
  });
});

describe("SCR-020 指定業務日の受付件数", () => {
  const ready: ReceptionSummaryViewState = {
    requestedDate: "2026-08-25",
    phase: "ready",
    loaded: SUMMARY,
    notice: null,
  };

  it("保存済み受付件数を締め対象件数と読み替えさせない", () => {
    const html = renderToStaticMarkup(<ReceptionSummaryView state={ready} />);

    expect(html).toContain(RECEPTION_SUMMARY_SCOPE_NOTE);
    expect(html).toContain("2 件");
    for (const status of ["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) {
      expect(html).toContain(`data-status="${status}"`);
    }
    expect(html).toContain("2026-08-25 の保存済み受付データを表示しています。");
  });

  it("取得前は件数表を描かず、読込中であることを支援技術へ伝える", () => {
    const html = renderToStaticMarkup(
      <ReceptionSummaryView
        state={{
          requestedDate: "2026-08-25",
          phase: "loading",
          loaded: null,
          notice: null,
        }}
      />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("受付件数はまだ表示していません");
    expect(html).not.toContain("<table");
  });

  it("再取得に失敗しても直前の結果を消さず、いつの内容かを明示する", () => {
    const html = renderToStaticMarkup(
      <ReceptionSummaryView
        state={{
          requestedDate: "2026-08-26",
          phase: "error",
          loaded: SUMMARY,
          notice: {
            message: "集計APIへ到達できませんでした。",
            nextAction: "時間をおいて再取得してください。",
          },
        }}
      />,
    );

    expect(html).toContain("2026-08-25 の保存済み受付データを表示しています。");
    expect(html).toContain("2026-08-26 の再取得に失敗したため、表示は更新していません");
    expect(html).toContain("次のアクション: 時間をおいて再取得してください。");
  });
});
