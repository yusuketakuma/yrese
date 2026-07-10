import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModeCapabilityView } from "./mode-capability-view";

(globalThis as { React?: typeof React }).React = React;

function render(mode: Parameters<typeof ModeCapabilityView>[0]["mode"]): string {
  return renderToStaticMarkup(<ModeCapabilityView mode={mode} />);
}

describe("ModeCapabilityView (SCR-026 / WP-3010a)", () => {
  it("NORMAL: mode guards do not prohibit the major operations but additional checks remain", () => {
    const html = render("NORMAL");
    expect(html).toContain("現在のモード: 通常稼働");
    expect(html).toContain("確定算定");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("できないこと");
    expect(html).toContain("実行可否は未確定");
    expect(html).toContain("追加条件をすべて確認してください");
    // 制限がないモードでは仮状態凡例を出さない
    expect(html).not.toContain("仮状態ステータス");
  });

  it("always renders a visible scope disclaimer so the partial list is not read as exhaustive (U4)", () => {
    for (const mode of ["NORMAL", "LOCAL_ONLY", "EXTERNAL_DEGRADED"] as const) {
      const html = render(mode);
      expect(html).toContain("主要操作");
      expect(html).toContain("対象外");
    }
  });

  it("LOCAL_ONLY: forbids external confirm, final calc and claim finalization with reasons (fail-closed alert)", () => {
    const html = render("LOCAL_ONLY");
    expect(html).toContain("現在のモード: ローカル単独稼働(外部確認不可)");
    expect(html).toContain('role="alert"');
    expect(html).toContain("できないこと");
    // 3 ゲートすべて不可(shared-kernel 判定に基づく)
    expect(html).toContain("新規の外部確認を成功扱いにできません");
    expect(html).toContain("仮算定のみ可能です");
    expect(html).toContain("請求関連の確定操作は通常稼働");
    // 復旧後に必要なこと
    expect(html).toContain("復旧後に必要なこと");
    // LOCAL_ONLY 必須付与の仮状態凡例(shared-kernel PROVISIONAL_STATUSES 由来)
    expect(html).toContain("必ず付与します");
    expect(html).toContain('data-status="LOCAL_ONLY_UNVERIFIED"');
    expect(html).toContain('data-status="PROVISIONAL_CALCULATION"');
  });

  it("EXTERNAL_DEGRADED: external confirm prohibited while final calc is only not prohibited", () => {
    const html = render("EXTERNAL_DEGRADED");
    // canConfirmExternal=false → 外部確認は不可(理由表示)
    expect(html).toContain("新規の外部確認を成功扱いにできません");
    // allowsFinalCalculation=true は mode guard 上の未禁止に留まり、実行許可とは表示しない
    expect(html).toContain('data-mode-guard="not-prohibited"');
    expect(html).toContain('class="mode-capability-not-prohibited-label">確定算定');
    expect(html).toContain("資格確認、evidence、マスター版、仮状態");
    expect(html).toContain("実行可否は未確定");
    expect(html).toContain("共通の仮状態候補です");
    expect(html).not.toContain("以下のいずれかを必ず付与します");
    // allowsClaimFinalization=false(NORMAL 以外)→ 請求確定は不可
    expect(html).toContain("請求関連の確定操作は通常稼働");
  });

  it("RECOVERY_SYNC: external and claim finalization prohibited, final calc only not prohibited", () => {
    const html = render("RECOVERY_SYNC");
    expect(html).toContain("現在のモード: 復旧同期中(要再検証)");
    expect(html).toContain('role="alert"');
    // canConfirmExternal(RECOVERY_SYNC)=false
    expect(html).toContain("新規の外部確認を成功扱いにできません");
    expect(html).toContain("再確認・復旧手順");
    // allowsFinalCalculation(RECOVERY_SYNC)=true means only not prohibited by this guard
    expect(html).toContain('class="mode-capability-not-prohibited-label">確定算定');
    // allowsClaimFinalization(RECOVERY_SYNC)=false
    expect(html).toContain("請求関連の確定操作は通常稼働");
  });

  it("CLOUD_DEGRADED: external confirm is not prohibited but claim finalization is prohibited", () => {
    const html = render("CLOUD_DEGRADED");
    // canConfirmExternal(CLOUD_DEGRADED)=true → 外部確認の理由文は出ない
    expect(html).not.toContain("新規の外部確認を成功扱いにできません");
    expect(html).toContain("個別システムの接続状態");
    expect(html).toContain("実行可否は未確定");
    expect(html).not.toContain("電子処方箋・オンライン請求・PMH");
    // allowsClaimFinalization=false → 請求確定は不可
    expect(html).toContain('role="alert"');
    expect(html).toContain("請求関連の確定操作は通常稼働");
  });

  it("does not fabricate provisional item counts (no data source)", () => {
    const html = render("LOCAL_ONLY");
    // 件数は data 経路未定のため出さない(捏造しない)
    expect(html).not.toContain("仮状態件数");
    expect(html).not.toContain("data-provisional-count");
  });
});
