import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AuditLogResponse } from "@yrese/contracts";

import {
  AuditLogTable,
  AuditLogLoadedState,
  AuditLogView,
  ChainVerificationNotice,
  createAuditLogRunner,
  fetchAuditLog,
  type AuditLogState,
} from "./audit-log-view";

(globalThis as { React?: typeof React }).React = React;

const SAMPLE: AuditLogResponse = {
  entries: [
    {
      eventId: "evt-002",
      wallClock: "2026-07-11T02:00:00.000Z",
      actorId: "user-001",
      auditEventType: "audit.viewed",
      targetRef: { kind: "audit_log", id: "view:1" },
      outcome: "success",
    },
    {
      eventId: "evt-001",
      wallClock: "2026-07-11T01:00:00.000Z",
      actorId: "user-002",
      auditEventType: "reception.created",
      targetRef: { kind: "reception", id: "reception-001" },
      outcome: "denied",
      reasonCode: "AUTH-0003",
    },
  ],
  chainVerification: { ok: true, checkedCount: 2 },
  totalCount: 2,
};

describe("ChainVerificationNotice (改ざん検知の可視化)", () => {
  it("announces a verified chain as status", () => {
    const html = renderToStaticMarkup(
      <ChainVerificationNotice verification={{ ok: true, checkedCount: 5 }} />,
    );
    expect(html).toContain("改ざん検知: 正常");
    expect(html).toContain("5件検証済み");
    expect(html).toContain('role="status"');
  });

  it("reports a broken chain as CRITICAL alert with preservation guidance", () => {
    const html = renderToStaticMarkup(
      <ChainVerificationNotice
        verification={{ ok: false, checkedCount: 5, breakIndex: 2, reason: "prev_hash_mismatch" }}
      />,
    );
    expect(html).toContain("hash chain が破断");
    expect(html).toContain("prev_hash_mismatch");
    expect(html).toContain("セキュリティ管理者へ連絡");
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-severity="CRITICAL"');
  });
});

describe("AuditLogTable (who/when/what)", () => {
  it("shows actor, timestamp, event type, target and outcome as text", () => {
    const html = renderToStaticMarkup(<AuditLogTable entries={SAMPLE.entries} />);
    expect(html).toContain("user-001");
    expect(html).toContain("2026-07-11T02:00:00.000Z");
    expect(html).toContain("audit.viewed");
    expect(html).toContain("reception: reception-001");
    expect(html).toContain("成功");
    expect(html).toContain("拒否(AUTH-0003)");
    expect(html).toContain('data-outcome="denied"');
  });

  it("renders an explicit empty state instead of a blank table", () => {
    const html = renderToStaticMarkup(<AuditLogTable entries={[]} />);
    expect(html).toContain("監査イベントはまだ記録されていません");
  });
});

describe("AuditLogView", () => {
  it("shows total vs displayed counts (limit の切り捨てを隠さない)", () => {
    const html = renderToStaticMarkup(
      <AuditLogView data={{ ...SAMPLE, totalCount: 120 }} />,
    );
    expect(html).toContain("全120件");
    expect(html).toContain("最新2件を表示");
  });

  it("keeps a broken-chain CRITICAL notice visible beside a sanitized refresh error and retry", () => {
    const broken: AuditLogResponse = {
      ...SAMPLE,
      chainVerification: {
        ok: false,
        checkedCount: 2,
        breakIndex: 1,
        reason: "entry_hash_mismatch",
      },
    };
    const html = renderToStaticMarkup(
      <AuditLogLoadedState
        data={broken}
        refreshState={{
          kind: "error",
          notice: {
            message: "監査ログの処理に失敗しました。",
            nextAction: "再試行してください。",
          },
        }}
        onRefresh={() => undefined}
      />,
    );

    expect(html).toContain('data-severity="CRITICAL"');
    expect(html).toContain("hash chain が破断");
    expect(html).toContain(
      "最新情報を取得できなかったため、直前に取得・検証した内容を表示しています。",
    );
    expect(html.indexOf("最新情報を取得できなかったため")).toBeLessThan(
      html.indexOf("hash chain が破断"),
    );
    expect(html).toContain("監査イベント: 全2件");
    expect(html).toContain("audit.viewed");
    expect(html).toContain("監査ログの処理に失敗しました。");
    expect(html).toContain("最新情報の取得を再試行");
    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).toMatch(
      /監査ログの処理に失敗しました。[\s\S]*<\/div><button[^>]*>最新情報の取得を再試行<\/button>/,
    );
  });

  it("keeps loaded data visible and disables only the refresh button while updating", () => {
    const html = renderToStaticMarkup(
      <AuditLogLoadedState
        data={SAMPLE}
        refreshState={{ kind: "loading" }}
        onRefresh={() => undefined}
      />,
    );

    expect(html).toContain("改ざん検知: 正常");
    expect(html).toContain("audit.viewed");
    expect(html).toContain(
      "最新情報を取得中です。直前に取得・検証した内容を表示しています。",
    );
    expect(html.indexOf("最新情報を取得中です")).toBeLessThan(
      html.indexOf("改ざん検知"),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>更新中…<\/button>/);

    const idleHtml = renderToStaticMarkup(
      <AuditLogLoadedState
        data={SAMPLE}
        refreshState={{ kind: "idle" }}
        onRefresh={() => undefined}
      />,
    );
    expect(idleHtml).not.toContain("直前に取得・検証した内容を表示しています");
    expect(idleHtml).toContain("最新に更新");
  });
});

describe("createAuditLogRunner (latest-only / lifecycle invalidation)", () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  const broken: AuditLogResponse = {
    ...SAMPLE,
    chainVerification: {
      ok: false,
      checkedCount: 2,
      breakIndex: 1,
      reason: "entry_hash_mismatch",
    },
  };

  function createStateRecorder(initial: AuditLogState = { kind: "loading" }) {
    let current = initial;
    const states: AuditLogState[] = [];
    return {
      states,
      emit(update: (prev: AuditLogState) => AuditLogState) {
        current = update(current);
        states.push(current);
      },
      current() {
        return current;
      },
    };
  }

  it("does not let an older healthy response replace a newer broken chain", async () => {
    const oldHealthy = deferred<AuditLogResponse>();
    const recorder = createStateRecorder();
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldHealthy.promise)
      .mockResolvedValueOnce(broken);
    const runner = createAuditLogRunner(fetcher, recorder.emit);

    const first = runner.run();
    await runner.run();
    oldHealthy.resolve(SAMPLE);
    await first;

    expect(fetcher).toHaveBeenCalledTimes(2);
    const last = recorder.current();
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.data.chainVerification.ok).toBe(false);
    }
  });

  it("does not let an older failure replace a newer success", async () => {
    const oldFailure = deferred<AuditLogResponse>();
    const recorder = createStateRecorder();
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldFailure.promise)
      .mockResolvedValueOnce(SAMPLE);
    const runner = createAuditLogRunner(fetcher, recorder.emit);

    const first = runner.run();
    await runner.run();
    oldFailure.reject(new Error("old failure"));
    await first;

    expect(recorder.current().kind).toBe("loaded");
  });

  it("does not let an older success replace a newer error", async () => {
    const oldSuccess = deferred<AuditLogResponse>();
    const recorder = createStateRecorder();
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldSuccess.promise)
      .mockRejectedValueOnce(new Error("new failure"));
    const runner = createAuditLogRunner(fetcher, recorder.emit);

    const first = runner.run();
    await runner.run();
    oldSuccess.resolve(SAMPLE);
    await first;

    expect(recorder.current().kind).toBe("error");
  });

  it("suppresses all completion callbacks after lifecycle invalidation", async () => {
    const pending = deferred<AuditLogResponse>();
    const recorder = createStateRecorder();
    const runner = createAuditLogRunner(() => pending.promise, recorder.emit);

    const run = runner.run();
    runner.invalidate();
    pending.resolve(SAMPLE);
    await run;

    expect(recorder.states).toEqual([{ kind: "loading" }]);
  });

  it("retains verified data during refresh failure, does not echo raw errors, and replaces it on retry", async () => {
    const pendingFailure = deferred<AuditLogResponse>();
    const replacement: AuditLogResponse = {
      ...SAMPLE,
      entries: [SAMPLE.entries[0]!],
      totalCount: 1,
      chainVerification: { ok: true, checkedCount: 1 },
    };
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => pendingFailure.promise)
      .mockResolvedValueOnce(replacement);
    const recorder = createStateRecorder({
      kind: "loaded",
      data: SAMPLE,
      refreshState: { kind: "idle" },
    });
    const runner = createAuditLogRunner(fetcher, recorder.emit);

    const failedRefresh = runner.run();
    expect(recorder.current()).toEqual({
      kind: "loaded",
      data: SAMPLE,
      refreshState: { kind: "loading" },
    });
    pendingFailure.reject(new Error("raw audit storage failure must not appear"));
    await failedRefresh;

    const failed = recorder.current();
    expect(failed.kind).toBe("loaded");
    if (failed.kind !== "loaded") throw new Error("expected retained audit data");
    expect(failed.data).toBe(SAMPLE);
    expect(failed.refreshState).toMatchObject({
      kind: "error",
      notice: { message: "監査ログの処理に失敗しました。" },
    });
    expect(JSON.stringify(failed)).not.toContain("raw audit storage failure");

    await runner.run();
    expect(recorder.current()).toEqual({
      kind: "loaded",
      data: replacement,
      refreshState: { kind: "idle" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retains broken-chain data during refresh loading and failure", async () => {
    const pending = deferred<AuditLogResponse>();
    const recorder = createStateRecorder({
      kind: "loaded",
      data: broken,
      refreshState: { kind: "idle" },
    });
    const runner = createAuditLogRunner(() => pending.promise, recorder.emit);

    const run = runner.run();
    expect(recorder.current()).toEqual({
      kind: "loaded",
      data: broken,
      refreshState: { kind: "loading" },
    });
    pending.reject(new Error("synthetic broken refresh failure"));
    await run;

    const failed = recorder.current();
    expect(failed.kind).toBe("loaded");
    if (failed.kind === "loaded") {
      expect(failed.data).toBe(broken);
      expect(failed.data.chainVerification.ok).toBe(false);
      expect(failed.refreshState.kind).toBe("error");
    }
  });

  it("keeps initial failure top-level and retries with initial loading semantics", async () => {
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockRejectedValueOnce(new Error("synthetic initial failure"))
      .mockResolvedValueOnce(SAMPLE);
    const recorder = createStateRecorder();
    const runner = createAuditLogRunner(fetcher, recorder.emit);

    await runner.run();
    expect(recorder.current().kind).toBe("error");

    const retry = runner.run();
    expect(recorder.current()).toEqual({ kind: "loading" });
    await retry;
    expect(recorder.current()).toEqual({
      kind: "loaded",
      data: SAMPLE,
      refreshState: { kind: "idle" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("fetchAuditLog transport contract", () => {
  it("uses the audit endpoint, least-privilege scope, and no-store", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      await fetchAuditLog(fetchImpl);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/_yrese-api/audit/events?limit=50");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({ "x-dev-scopes": "audit-log:read" }),
    });
  });

  it("maps 403 to fixed guidance without echoing an unregistered error code", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errorCode: "SYSTEM-9999", message: "internal" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      await expect(fetchAuditLog(fetchImpl)).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        const notice = (error as Error & { notice: { message: string; errorCode?: string } }).notice;
        expect(notice.message).toBe("権限がありません。");
        expect(notice.errorCode).toBeUndefined();
        expect(JSON.stringify(notice)).not.toContain("SYSTEM-9999");
        expect(JSON.stringify(notice)).not.toContain("internal");
        return true;
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
