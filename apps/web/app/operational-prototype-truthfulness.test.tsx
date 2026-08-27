import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminPage from "./admin/page";
import CheckoutPage from "./checkout/page";
import ClaimCheckPage from "./claim-check/page";
import MastersPage from "./masters/page";
import MonthlyClosingPage from "./monthly-closing/page";
import PatientsPage from "./patients/page";
import ReceptionPage from "./page";

(globalThis as { React?: typeof React }).React = React;

describe("operator prototype operational truthfulness", () => {
  it("keeps one full gate boundary above every connected surface", () => {
    const pages = [
      {
        html: renderToStaticMarkup(<CheckoutPage />),
        gateIds: ["UIX-001 §12.3", "SCR-016", "RB-008", "MST-001", "SCR-018"],
        safetyCopy: "「—」は0円",
        fullDetail: "令和8年度調剤報酬点数表の版確認",
        orderedLiveTitles: [],
      },
      {
        html: renderToStaticMarkup(<ClaimCheckPage />),
        gateIds: ["UIX-001 §12.3", "SCR-019", "RB-001", "RB-008", "RB-009"],
        safetyCopy: "「—」は0件",
        fullDetail: "版確認と evidence_id 発行",
        orderedLiveTitles: [],
      },
      {
        html: renderToStaticMarkup(<MastersPage />),
        gateIds: ["MST-001", "RB-009", "RB-008", "UIX-001 §12.3", "MOD-007 §3"],
        safetyCopy: "「—」は0件・最新・正常",
        fullDetail: "配布形式・署名/ハッシュ提供の有無",
        orderedLiveTitles: [],
      },
      {
        html: renderToStaticMarkup(<MonthlyClosingPage />),
        gateIds: [
          "UIX-001 §12.3",
          "RB-001",
          "RB-004",
          "ARC-007",
          "UIX-001 §12.4",
          "DOM-004",
          "RB-003",
          "API-013",
          "MOD-008",
          "MOD-009",
          "AGENTS.md",
        ],
        safetyCopy: "「—」は0件・提出済み・対応完了",
        fullDetail: "公式接続方式・電子証明書・接続試験・運用規約",
        orderedLiveTitles: ["実行権限とゲート", "指定業務日の受付件数"],
      },
    ] as const;

    for (const page of pages) {
      const boundary =
        page.html.match(
          /<div class="prototype-banner"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span><\/div>/,
        )?.[1] ?? "";

      for (const gateId of page.gateIds) expect(boundary).toContain(gateId);
      expect(page.html).toContain(
        "境界の詳細は上部の「機能境界」を参照してください。",
      );
      expect(page.html).toContain(page.safetyCopy);
      expect(page.html.split(page.fullDetail)).toHaveLength(2);
      expect(page.html).toMatch(
        /<div class="prototype-banner"[^>]*>[\s\S]*?<\/span><\/div><section class="operator-panel live-surface-panel"[^>]*>/,
      );
      expect(page.html.lastIndexOf("live-surface-panel")).toBeLessThan(
        page.html.indexOf("metric-grid"),
      );

      let previousIndex = -1;
      for (const title of page.orderedLiveTitles) {
        const titleIndex = page.html.indexOf(title);
        expect(titleIndex).toBeGreaterThan(previousIndex);
        previousIndex = titleIndex;
      }
    }
  });

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

  it("does not render fabricated patients or check results before the claim API exists", () => {
    const html = renderToStaticMarkup(<ClaimCheckPage />);

    expect(html).toContain('data-operational-data="unavailable"');
    expect(html).not.toContain('data-synthetic="true"');
    expect(html).not.toContain("合成患者");
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
