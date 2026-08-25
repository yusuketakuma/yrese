import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminPage from "./admin/page";
import MastersPage from "./masters/page";
import MonthlyClosingPage from "./monthly-closing/page";
import PatientsPage from "./patients/page";
import ReceptionPage from "./page";

(globalThis as { React?: typeof React }).React = React;

describe("operator prototype operational truthfulness", () => {
  it("does not render fabricated monthly amounts, progress, or return counts", () => {
    const html = renderToStaticMarkup(<MonthlyClosingPage />);

    expect(html).toContain('data-operational-data="unavailable"');
    expect(html).toContain("0件・0円を意味しません");
    for (const fabricatedValue of ["65%", "¥3,215,480", "B2608001", "返戻7件"]) {
      expect(html).not.toContain(fabricatedValue);
    }
  });

  it("does not render fabricated or stale master versions", () => {
    const html = renderToStaticMarkup(<MastersPage />);

    expect(html).toContain("版情報未取得");
    expect(html).toContain("更新パイプライン未接続");
    expect(html).not.toContain("UI-SAMPLE-2024");
    expect(html).not.toContain("適用日 2024");
  });

  it("does not render fabricated users or security alarm counts while admin data loads", () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("認証・tenant境界・API状態を検証しています");
    expect(html).not.toContain("合成ユーザーA");
    expect(html).not.toContain("弱いパスワード候補：合成例");
    expect(html).not.toContain("多要素認証未設定：合成例");
  });

  it("does not style unknown queue totals as success or danger", () => {
    const reception = renderToStaticMarkup(<ReceptionPage />);
    const patients = renderToStaticMarkup(<PatientsPage />);

    expect(reception).toContain("既存受付API配線・稼働未確認");
    expect(patients).toContain("既存患者検索API配線・稼働未確認");
    expect(reception).toMatch(
      /<article class="metric-card" data-tone="neutral" role="listitem">[\s\S]*?<p class="metric-label">完了<\/p>/,
    );
    expect(patients).toMatch(
      /<article class="metric-card" data-tone="neutral" role="listitem">[\s\S]*?<p class="metric-label">要フォロー<\/p>/,
    );
  });
});
