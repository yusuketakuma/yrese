import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AuditMetadata,
  PermissionState,
  ReadOnlyIndicator,
  VersionHistoryIndicator,
} from "./audit-metadata";

(globalThis as { React?: typeof React }).React = React;

describe("AuditMetadata (who/when/what)", () => {
  it("renders actor, action and timestamp", () => {
    const html = renderToStaticMarkup(
      <AuditMetadata actor="u-1001" action="薬歴を確定" at="2026-07-11T10:00:00+09:00" />,
    );
    expect(html).toContain("u-1001");
    expect(html).toContain("薬歴を確定");
    expect(html).toContain("2026-07-11T10:00:00+09:00");
  });
});

describe("VersionHistoryIndicator (真正性・訂正履歴)", () => {
  it("flags amended history when more than one version exists", () => {
    const html = renderToStaticMarkup(
      <VersionHistoryIndicator currentVersion={3} totalVersions={3} />,
    );
    expect(html).toContain("第3版 / 全3版");
    expect(html).toContain('data-has-history="true"');
    expect(html).toContain("訂正履歴あり");
  });

  it("does not claim history for a single version", () => {
    const html = renderToStaticMarkup(
      <VersionHistoryIndicator currentVersion={1} totalVersions={1} />,
    );
    expect(html).toContain('data-has-history="false"');
    expect(html).not.toContain("訂正履歴あり");
  });
});

describe("PermissionState (deny-by-default 可視化 P-14)", () => {
  it("shows denied with reason", () => {
    const html = renderToStaticMarkup(
      <PermissionState allowed={false} actionLabel="レセプト確定" reason="権限 claim:finalize が未付与" />,
    );
    expect(html).toContain('data-allowed="false"');
    expect(html).toContain("権限がありません");
    expect(html).toContain("claim:finalize");
  });

  it("shows allowed action", () => {
    const html = renderToStaticMarkup(
      <PermissionState allowed actionLabel="患者検索" />,
    );
    expect(html).toContain('data-allowed="true"');
    expect(html).toContain("実行可");
  });
});

describe("ReadOnlyIndicator", () => {
  it("explains why editing is unavailable", () => {
    const html = renderToStaticMarkup(<ReadOnlyIndicator reason="確定済みの記録" />);
    expect(html).toContain('data-read-only="true"');
    expect(html).toContain("閲覧のみ(確定済みの記録)");
  });
});
