import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CloudHealthCard, cloudHealthMetric, type CloudHealthState } from "./cloud-health-card";

(globalThis as { React?: typeof React }).React = React;

describe("sync-status cloud health card (WP-5101 real wiring)", () => {
  it("projects a reachable health response into a truthful 稼働確認 metric", () => {
    const state: CloudHealthState = {
      kind: "ready",
      health: {
        service: "yrese-api",
        version: "0.1.0",
        status: "ok",
        timestamp: "2026-08-26T00:00:00.000Z",
      },
    };
    const metric = cloudHealthMetric(state);
    expect(metric.value).toBe("応答あり");
    expect(metric.detail).toContain("yrese-api");
    expect(metric.detail).toContain("同期状態ではありません");
    expect(metric.tone).toBe("info");
  });

  it("keeps failure truthful without guessing an outage cause", () => {
    const metric = cloudHealthMetric({ kind: "error" });
    expect(metric.value).toBe("未確認");
    expect(metric.detail).toContain("ヘルスAPIに到達できません");
    expect(metric.tone).toBe("warning");
  });

  it("shows an in-progress state before the first response", () => {
    const metric = cloudHealthMetric({ kind: "loading" });
    expect(metric.value).toBe("確認中");
    expect(metric.tone).toBe("info");
  });

  it("renders the checking state on static markup without claiming success", () => {
    const html = renderToStaticMarkup(<CloudHealthCard />);
    expect(html).toContain("クラウド（yrese）");
    expect(html).toContain("確認中");
    expect(html).not.toContain("応答あり");
    expect(html).not.toContain("すべて正常に稼働中");
  });
});
