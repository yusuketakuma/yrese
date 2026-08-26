import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CloudHealthCard,
  cloudHealthMetric,
  resolveCloudHealthState,
  type CloudHealthState,
} from "./cloud-health-card";

(globalThis as { React?: typeof React }).React = React;

const HEALTH = {
  status: "ok",
  service: "api",
  version: "0.1.0",
  timestamp: "2026-08-26T00:00:00.000Z",
} as const;

const CHECKED_AT = "2026-08-26T09:30:00.000Z";
/** 確認時刻は運用者のローカル時刻で示すため、期待値も同じ基準で導出する。 */
const CHECKED_AT_LOCAL_HHMM = `${String(new Date(CHECKED_AT).getHours()).padStart(2, "0")}:${String(new Date(CHECKED_AT).getMinutes()).padStart(2, "0")}`;

/** resolveWebApiUrl は開発proxy以外では設定不足で throw するため、テストでも同じ前提を与える。 */
function withDevApiBase<T>(run: () => T): T {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
  try {
    return run();
  } finally {
    vi.unstubAllEnvs();
  }
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("sync-status cloud health card (WP-5101 real wiring)", () => {
  it("projects a reachable health response into a truthful 稼働確認 metric", () => {
    const state: CloudHealthState = { kind: "ready", health: HEALTH, checkedAt: CHECKED_AT };
    const metric = cloudHealthMetric(state);
    expect(metric.value).toBe("応答あり");
    expect(metric.detail).toContain("api v0.1.0");
    expect(metric.detail).toContain("同期状態ではありません");
    expect(metric.tone).toBe("info");
  });

  it("keeps failure truthful without guessing an outage cause", () => {
    const metric = cloudHealthMetric({ kind: "error", checkedAt: CHECKED_AT });
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

  it("stamps the confirmation time so a stale reading cannot read as current (review #12)", () => {
    const metric = cloudHealthMetric({ kind: "ready", health: HEALTH, checkedAt: CHECKED_AT });
    expect(metric.detail).toContain(CHECKED_AT_LOCAL_HHMM);
    expect(metric.detail).toContain("時点");
    const failed = cloudHealthMetric({ kind: "error", checkedAt: CHECKED_AT });
    expect(failed.detail).toContain(CHECKED_AT_LOCAL_HHMM);
  });

  it("resolves a successful probe into a ready state carrying the check time (review #9)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(HEALTH)) as unknown as typeof fetch;
    const state = await withDevApiBase(() =>
      resolveCloudHealthState(fetchImpl, undefined, () => new Date(CHECKED_AT)),
    );
    expect(state).toEqual({ kind: "ready", health: HEALTH, checkedAt: CHECKED_AT });
  });

  it("resolves a failed probe into an error state rather than a success state (review #9)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const state = await withDevApiBase(() =>
      resolveCloudHealthState(fetchImpl, undefined, () => new Date(CHECKED_AT)),
    );
    expect(state).toEqual({ kind: "error", checkedAt: CHECKED_AT });
  });

  it("reports an aborted probe as no state change so a superseded probe cannot overwrite (review #9)", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      throw new Error("aborted");
    }) as unknown as typeof fetch;
    const state = await withDevApiBase(() =>
      resolveCloudHealthState(fetchImpl, controller.signal, () => new Date(CHECKED_AT)),
    );
    expect(state).toBeNull();
  });

  it("does not treat a malformed health body as a successful probe", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ service: 1 })) as unknown as typeof fetch;
    const state = await withDevApiBase(() =>
      resolveCloudHealthState(fetchImpl, undefined, () => new Date(CHECKED_AT)),
    );
    expect(state).toEqual({ kind: "error", checkedAt: CHECKED_AT });
  });
});
