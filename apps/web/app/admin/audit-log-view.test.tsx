import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AuditLogResponse } from "@yrese/contracts";

import {
  AuditLogTable,
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

  it("does not let an older healthy response replace a newer broken chain", async () => {
    const oldHealthy = deferred<AuditLogResponse>();
    const states: AuditLogState[] = [];
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldHealthy.promise)
      .mockResolvedValueOnce(broken);
    const runner = createAuditLogRunner(fetcher, (state) => states.push(state));

    const first = runner.run();
    await runner.run();
    oldHealthy.resolve(SAMPLE);
    await first;

    expect(fetcher).toHaveBeenCalledTimes(2);
    const last = states[states.length - 1]!;
    expect(last.kind).toBe("loaded");
    if (last.kind === "loaded") {
      expect(last.data.chainVerification.ok).toBe(false);
    }
  });

  it("does not let an older failure replace a newer success", async () => {
    const oldFailure = deferred<AuditLogResponse>();
    const states: AuditLogState[] = [];
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldFailure.promise)
      .mockResolvedValueOnce(SAMPLE);
    const runner = createAuditLogRunner(fetcher, (state) => states.push(state));

    const first = runner.run();
    await runner.run();
    oldFailure.reject(new Error("old failure"));
    await first;

    expect(states[states.length - 1]?.kind).toBe("loaded");
  });

  it("does not let an older success replace a newer error", async () => {
    const oldSuccess = deferred<AuditLogResponse>();
    const states: AuditLogState[] = [];
    const fetcher = vi
      .fn<() => Promise<AuditLogResponse>>()
      .mockImplementationOnce(() => oldSuccess.promise)
      .mockRejectedValueOnce(new Error("new failure"));
    const runner = createAuditLogRunner(fetcher, (state) => states.push(state));

    const first = runner.run();
    await runner.run();
    oldSuccess.resolve(SAMPLE);
    await first;

    expect(states[states.length - 1]?.kind).toBe("error");
  });

  it("suppresses all completion callbacks after lifecycle invalidation", async () => {
    const pending = deferred<AuditLogResponse>();
    const states: AuditLogState[] = [];
    const runner = createAuditLogRunner(() => pending.promise, (state) => states.push(state));

    const run = runner.run();
    runner.invalidate();
    pending.resolve(SAMPLE);
    await run;

    expect(states).toEqual([{ kind: "loading" }]);
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
