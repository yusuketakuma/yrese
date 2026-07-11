import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  EmergencyModeBanner,
  OfflineBanner,
  SyncIndicator,
  SystemHealthBanner,
} from "./sync-indicator";

(globalThis as { React?: typeof React }).React = React;

describe("SyncIndicator (R-OFFLINE / H-03)", () => {
  it("shows queued (local) distinctly from synced (server)", () => {
    const queued = renderToStaticMarkup(<SyncIndicator status="QUEUED" />);
    const synced = renderToStaticMarkup(<SyncIndicator status="SYNCED" lastSyncedAt="10:00" />);
    expect(queued).toContain("同期待ち(ローカル保存)");
    expect(synced).toContain("同期済み");
    expect(synced).toContain("最終同期: 10:00");
  });

  it("flags conflict/failure as needing human attention with alert role", () => {
    const conflict = renderToStaticMarkup(<SyncIndicator status="CONFLICT" />);
    expect(conflict).toContain('data-attention="true"');
    expect(conflict).toContain('role="alert"');
    expect(conflict).toContain("競合(要解決)");
  });
});

describe("OfflineBanner", () => {
  it("renders nothing in NORMAL mode", () => {
    expect(renderToStaticMarkup(<OfflineBanner mode="NORMAL" />)).toBe("");
  });

  it("states external confirmation is unavailable in LOCAL_ONLY", () => {
    const html = renderToStaticMarkup(<OfflineBanner mode="LOCAL_ONLY" />);
    expect(html).toContain("ローカル単独稼働");
    expect(html).toContain("外部確認");
    expect(html).toContain("サーバ未反映");
  });
});

describe("SystemHealthBanner (G2 リスクコミュニケーション)", () => {
  it("marks degraded modes and shows reason/affected", () => {
    const html = renderToStaticMarkup(
      <SystemHealthBanner mode="CLOUD_DEGRADED" reason="クラウド接続が不安定です" affected="オンライン請求" />,
    );
    expect(html).toContain('data-degraded="true"');
    expect(html).toContain("クラウド接続が不安定です");
    expect(html).toContain("影響: オンライン請求");
  });

  it("marks NORMAL as not degraded", () => {
    const html = renderToStaticMarkup(<SystemHealthBanner mode="NORMAL" />);
    expect(html).toContain('data-degraded="false"');
  });
});

describe("EmergencyModeBanner (UIX-001 P-19 非常時の見読性)", () => {
  it("lists available and unavailable functions with alert role and recovery", () => {
    const html = renderToStaticMarkup(
      <EmergencyModeBanner
        mode="LOCAL_ONLY"
        available={["患者情報の閲覧", "仮の会計"]}
        unavailable={["資格確認", "オンライン請求"]}
        recoverySteps="回線復旧後に同期を実行してください"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("非常時運用");
    expect(html).toContain("使用可能");
    expect(html).toContain("患者情報の閲覧");
    expect(html).toContain("使用不可");
    expect(html).toContain("資格確認");
    expect(html).toContain("回線復旧後に同期を実行してください");
  });
});
