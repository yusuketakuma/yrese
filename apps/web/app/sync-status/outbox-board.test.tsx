import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OutboxSummaryResponse } from "@yrese/contracts";
import { AUTH_PERMISSION_DENIED_ERROR_CODE } from "@yrese/shared-kernel";

import {
  OutboxBoardView,
  formatQueueDwell,
  legacyOrphanDisplay,
  loadOutboxSummaryResult,
  mergeOutboxLoad,
  outboxAsOfLine,
  outboxCountDisplay,
  outboxDwellDisplay,
  type OutboxBoardState,
} from "./outbox-board";

(globalThis as { React?: typeof React }).React = React;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const LOADED_AT = "2026-08-26T09:30:00.000Z";
/** checkedAtLabel は運用者のローカル時刻で出すため、期待値も同じ基準で導出する。 */
const LOADED_AT_LOCAL = `${String(new Date(LOADED_AT).getHours()).padStart(2, "0")}:${String(new Date(LOADED_AT).getMinutes()).padStart(2, "0")}時点`;

/** legacyOrphanCount を **持たない** 応答(in-memory 構成で実際に返る形)。 */
const SUMMARY: OutboxSummaryResponse = {
  pendingCount: 2,
  deliveredCount: 1,
  oldestPendingCreatedAt: "2026-08-26T08:15:00.000Z",
  byEventType: [
    { eventType: "reception.created", pendingCount: 2, deliveredCount: 1 },
  ],
};

const READY: OutboxBoardState = {
  kind: "ready",
  summary: SUMMARY,
  loadedAt: LOADED_AT,
};

function readyWith(summary: OutboxSummaryResponse): OutboxBoardState {
  return { kind: "ready", summary, loadedAt: LOADED_AT };
}

/** `oldestPendingCreatedAt` を **キーごと省略** した応答(未配送ゼロ / 時刻導出不能の形)。 */
function withoutOldestPending(pendingCount: number): OutboxSummaryResponse {
  return {
    pendingCount,
    deliveredCount: SUMMARY.deliveredCount,
    byEventType: SUMMARY.byEventType,
  };
}

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

function withDevApiBase(): void {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
}

describe("loadOutboxSummaryResult (GET /operations/outbox-summary 実配線)", () => {
  it("returns the parsed summary with the time it was taken", async () => {
    withDevApiBase();

    const result = await loadOutboxSummaryResult(
      { fetchImpl: jsonFetch(SUMMARY) },
      () => new Date(LOADED_AT),
    );

    expect(result).toEqual({ ok: true, summary: SUMMARY, loadedAt: LOADED_AT });
  });

  it("keeps a permission failure distinct from an unreachable API, with fixed Japanese copy", async () => {
    withDevApiBase();

    const denied = await loadOutboxSummaryResult({
      fetchImpl: jsonFetch({ message: "denied by server" }, 403),
    });
    const unreachable = await loadOutboxSummaryResult({
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });

    expect(denied.ok).toBe(false);
    expect(unreachable.ok).toBe(false);
    if (denied.ok || unreachable.ok) return;
    expect(denied.notice.errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
    expect(denied.notice.nextAction).not.toBe("");
    // サーバ由来の文字列を画面文言へ素通ししない。
    expect(denied.notice.message).not.toContain("denied by server");
    expect(unreachable.notice.errorCode).toBeUndefined();
    expect(unreachable.notice.message).toContain("障害とは断定せず未確認として扱います");
  });

  it("refuses a response that does not match the contract instead of displaying it", async () => {
    withDevApiBase();

    const result = await loadOutboxSummaryResult({
      fetchImpl: jsonFetch({ pendingCount: -1, deliveredCount: 0, byEventType: [] }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.notice.message).toContain("契約と一致しません");
  });
});

describe("mergeOutboxLoad (再取得失敗時に前回値を捨てない)", () => {
  const failure = {
    ok: false as const,
    notice: { message: "取得できません。", nextAction: "再取得してください。" },
  };

  it("degrades a previous reading to stale rather than wiping it", () => {
    const next = mergeOutboxLoad(READY, failure);

    expect(next.kind).toBe("stale");
    if (next.kind !== "stale") return;
    expect(next.summary).toEqual(SUMMARY);
    expect(next.loadedAt).toBe(LOADED_AT);
    expect(next.notice).toEqual(failure.notice);
  });

  it("falls back to a value-less error state when nothing was ever loaded", () => {
    expect(mergeOutboxLoad({ kind: "loading" }, failure)).toEqual({
      kind: "error",
      notice: failure.notice,
    });
  });

  it("replaces a stale reading once a fresh one succeeds", () => {
    const stale = mergeOutboxLoad(READY, failure);
    const fresh = mergeOutboxLoad(stale, {
      ok: true,
      summary: { ...SUMMARY, pendingCount: 0 },
      loadedAt: "2026-08-26T10:00:00.000Z",
    });

    expect(fresh.kind).toBe("ready");
    if (fresh.kind !== "ready") return;
    expect(fresh.summary.pendingCount).toBe(0);
  });
});

describe("outboxAsOfLine (いつ時点の値かを必ず言う)", () => {
  it("names the reading time for a fresh reading", () => {
    expect(outboxAsOfLine(READY)).toContain(LOADED_AT_LOCAL);
  });

  it("says a stale reading is not the current value", () => {
    const stale = mergeOutboxLoad(READY, {
      ok: false,
      notice: { message: "m", nextAction: "n" },
    });
    const line = outboxAsOfLine(stale);
    expect(line).toContain(LOADED_AT_LOCAL);
    expect(line).toContain("現在値ではありません");
  });

  it("does not let a failed reading read as zero", () => {
    expect(outboxAsOfLine({ kind: "error", notice: { message: "m", nextAction: "n" } })).toContain(
      "0件ではありません",
    );
  });
});

describe("outboxCountDisplay (未取得を 0 と描画しない)", () => {
  it("shows … while loading and — when unavailable, never 0", () => {
    const loading = outboxCountDisplay({ kind: "loading" }, (s) => s.pendingCount);
    const failed = outboxCountDisplay(
      { kind: "error", notice: { message: "m", nextAction: "n" } },
      (s) => s.pendingCount,
    );

    expect(loading.value).toBe("…");
    expect(failed.value).toBe("—");
    expect(failed.tone).toBe("warning");
  });

  it("renders a measured zero as 0 (実測0件は捏造ではない)", () => {
    expect(outboxCountDisplay(readyWith(withoutOldestPending(0)), (s) => s.pendingCount).value).toBe(
      "0",
    );
  });
});

describe("formatQueueDwell / outboxDwellDisplay (実際のキュー滞留時間)", () => {
  it("derives the dwell from the oldest pending event", () => {
    expect(formatQueueDwell("2026-08-26T08:15:00.000Z", new Date(LOADED_AT))).toBe("1時間15分");
    expect(formatQueueDwell("2026-08-24T08:15:00.000Z", new Date(LOADED_AT))).toBe("2日1時間15分");
    expect(formatQueueDwell("2026-08-26T09:29:40.000Z", new Date(LOADED_AT))).toBe("1分未満");
  });

  it("clamps a future timestamp to zero instead of reading as no backlog", () => {
    expect(formatQueueDwell("2026-08-26T10:00:00.000Z", new Date(LOADED_AT))).toBe("1分未満");
    expect(formatQueueDwell("not-a-timestamp", new Date(LOADED_AT))).toBe("—");
  });

  it("only claims 未配送なし when the pending count is a measured zero", () => {
    const none = outboxDwellDisplay(readyWith(withoutOldestPending(0)));
    expect(none.value).toBe("未配送なし");
    expect(none.detail).toContain("実測0件");
  });

  it("refuses 未配送なし when events are pending but the oldest time is missing", () => {
    const unknown = outboxDwellDisplay(readyWith(withoutOldestPending(3)));
    expect(unknown.value).toBe("—");
    expect(unknown.value).not.toContain("未配送なし");
    expect(unknown.detail).toContain("滞留なしを意味しません");
  });

  it("does not claim a dwell time when nothing was loaded", () => {
    const failed = outboxDwellDisplay({
      kind: "error",
      notice: { message: "m", nextAction: "n" },
    });
    expect(failed.value).toBe("—");
    expect(failed.detail).toContain("滞留なしを意味しません");
  });
});

describe("legacyOrphanDisplay (省略されたフィールドを 0 と描画しない)", () => {
  it("reports an omitted legacyOrphanCount as not derivable, never as zero", () => {
    const omitted = legacyOrphanDisplay(READY);

    expect(SUMMARY.legacyOrphanCount).toBeUndefined();
    expect(omitted.value).toBe("—（この構成では導出できません）");
    expect(omitted.value).not.toContain("0");
    expect(omitted.note).toContain("0件ではありません");
  });

  it("reports a derived count, including a measured zero", () => {
    expect(legacyOrphanDisplay(readyWith({ ...SUMMARY, legacyOrphanCount: 0 })).value).toBe("0件");
    expect(legacyOrphanDisplay(readyWith({ ...SUMMARY, legacyOrphanCount: 4 })).value).toBe("4件");
  });

  it("reports an unknown count when the summary could not be loaded", () => {
    const failed = legacyOrphanDisplay({
      kind: "error",
      notice: { message: "m", nextAction: "n" },
    });
    expect(failed.value).toBe("—");
    expect(failed.note).toContain("0件ではありません");
  });
});

describe("OutboxBoardView markup", () => {
  it("marks the panel as a live surface and never as unavailable operational data", () => {
    const html = renderToStaticMarkup(<OutboxBoardView state={READY} />);

    expect(html).toContain("live-surface-panel");
    // 実データ区画なので未接続マーカーを付けない(truthfulness テスト群の対象外)。
    expect(html).not.toContain('data-operational-data="unavailable"');
    expect(html).toContain("GET /operations/outbox-summary");
    expect(html).toContain("外部サービスへ到達したことは意味しません");
  });

  it("renders the per-event-type table inside a reachable scroll container", () => {
    const html = renderToStaticMarkup(<OutboxBoardView state={READY} />);

    expect(html).toContain(
      '<div class="table-scroll" role="region" tabindex="0" aria-label="イベント種別ごとの配送状況。横方向にスクロールできます">',
    );
    expect(html).toContain("reception.created");
  });

  it("announces the busy state while loading without showing any count", () => {
    const html = renderToStaticMarkup(<OutboxBoardView state={{ kind: "loading" }} />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("outbox の配送状況を取得しています…");
    expect(html).not.toContain('<p class="metric-value">0');
  });

  it("keeps the previous reading visible next to the failure when a reload fails", () => {
    const stale = mergeOutboxLoad(READY, {
      ok: false,
      notice: { message: "集計APIへ到達できませんでした。", nextAction: "再取得してください。" },
    });
    const html = renderToStaticMarkup(<OutboxBoardView state={stale} />);

    expect(html).toContain("error-notice");
    expect(html).toContain("再取得してください。");
    expect(html).toContain("reception.created");
    expect(html).toContain(LOADED_AT_LOCAL);
    expect(html).toContain("現在値ではありません");
  });

  it("distinguishes a measured empty outbox from an unavailable one", () => {
    const empty = renderToStaticMarkup(
      <OutboxBoardView
        state={readyWith({ pendingCount: 0, deliveredCount: 0, byEventType: [] })}
      />,
    );
    const failed = renderToStaticMarkup(
      <OutboxBoardView state={{ kind: "error", notice: { message: "m", nextAction: "n" } }} />,
    );

    expect(empty).toContain("実測0件");
    expect(failed).not.toContain("実測0件");
    expect(failed).toContain("—");
  });

  it("does not claim external sync success anywhere on the board", () => {
    const states: readonly OutboxBoardState[] = [READY, { kind: "loading" }];
    for (const state of states) {
      const html = renderToStaticMarkup(<OutboxBoardView state={state} />);
      expect(html).not.toContain("すべて正常に稼働中");
      expect(html).not.toContain("UIプロトタイプ");
    }
  });
});
