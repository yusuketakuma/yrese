import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AuditLogResponse } from "@yrese/contracts";

import { AuditLogTable, AuditLogView, ChainVerificationNotice } from "./audit-log-view";

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
