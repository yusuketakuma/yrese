import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CLINICAL_ALERT_ACK_STATUSES,
  CLINICAL_ALERT_TYPES,
  ELIGIBILITY_STATUSES,
  ERROR_SEVERITIES,
  PRESCRIPTION_CHANGE_TYPES,
  PROVISIONAL_STATUSES,
  RECEPTION_STATUSES,
  RECORD_LIFECYCLE_STATUSES,
  SESSION_STATUSES,
  SYNC_STATUSES,
  SYSTEM_MODES,
} from "@yrese/shared-kernel";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { ELIGIBILITY_LABELS } from "../components/patient-header";
import { RECEPTION_STATUS_LABELS } from "../reception-dashboard";
import { MODE_LABELS } from "../system-mode-badge";
import {
  CLINICAL_ALERT_ACK_PRESENTATION,
  CLINICAL_ALERT_TYPE_IDENTITY,
  ELIGIBILITY_PRESENTATION,
  PRESCRIPTION_CHANGE_PRESENTATION,
  PROVISIONAL_PRESENTATION,
  RECEPTION_PRESENTATION,
  RECORD_LIFECYCLE_PRESENTATION,
  resolveStatus,
  SESSION_PRESENTATION,
  SEVERITY_ORDER,
  SEVERITY_PRESENTATION,
  SYNC_PRESENTATION,
  SYSTEM_MODE_PRESENTATION,
  type StatusPresentation,
} from "./visual-status-registry";

(globalThis as { React?: typeof React }).React = React;

describe("Visual Status Registry (UIX-001 / 08-target-design-direction)", () => {
  it("covers every shared-kernel enum value exhaustively (未定義状態を残さない)", () => {
    for (const key of ERROR_SEVERITIES) {
      expect(SEVERITY_PRESENTATION[key]).toBeDefined();
    }
    for (const key of SYSTEM_MODES) {
      expect(SYSTEM_MODE_PRESENTATION[key]).toBeDefined();
    }
    for (const key of ELIGIBILITY_STATUSES) {
      expect(ELIGIBILITY_PRESENTATION[key]).toBeDefined();
    }
    for (const key of RECEPTION_STATUSES) {
      expect(RECEPTION_PRESENTATION[key]).toBeDefined();
    }
    for (const key of PROVISIONAL_STATUSES) {
      expect(PROVISIONAL_PRESENTATION[key]).toBeDefined();
    }
  });

  it("never encodes meaning by color/shape alone: every entry has a non-empty label (UIX-001 P-20 / §11.4)", () => {
    const all: StatusPresentation[] = [
      ...Object.values(SEVERITY_PRESENTATION),
      ...Object.values(SYSTEM_MODE_PRESENTATION),
      ...Object.values(ELIGIBILITY_PRESENTATION),
      ...Object.values(RECEPTION_PRESENTATION),
      ...Object.values(PROVISIONAL_PRESENTATION),
    ];
    for (const p of all) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.shape.length).toBeGreaterThan(0);
    }
  });

  it("keeps orthogonal domains independent: same key string can differ per domain (§11.3)", () => {
    // eligibility.PENDING_REVERIFY と provisional.PENDING_REVERIFY はラベルが異なる
    expect(resolveStatus({ domain: "eligibility", key: "PENDING_REVERIFY" }).label).not.toBe(
      resolveStatus({ domain: "provisional", key: "PENDING_REVERIFY" }).label,
    );
  });

  it("is the single source for existing label maps (de-dup — 監査 A-02)", () => {
    // 既存コンポーネントの公開ラベルマップは Registry から導出されている
    for (const key of SYSTEM_MODES) {
      expect(MODE_LABELS[key]).toBe(SYSTEM_MODE_PRESENTATION[key].label);
    }
    for (const key of ELIGIBILITY_STATUSES) {
      expect(ELIGIBILITY_LABELS[key]).toBe(ELIGIBILITY_PRESENTATION[key].label);
    }
    for (const key of RECEPTION_STATUSES) {
      expect(RECEPTION_STATUS_LABELS[key]).toBe(RECEPTION_PRESENTATION[key].label);
    }
  });

  it("orders severity by descending importance (UIX-001 §5)", () => {
    expect(SEVERITY_ORDER).toEqual(["BLOCKER", "CRITICAL", "ERROR", "WARNING", "INFO"]);
  });

  it("escalates aria-live/role only for the highest severities (§11.4-18)", () => {
    expect(SEVERITY_PRESENTATION.CRITICAL.ariaRole).toBe("alert");
    expect(SEVERITY_PRESENTATION.CRITICAL.ariaLive).toBe("assertive");
    expect(SEVERITY_PRESENTATION.BLOCKER.ariaLive).toBe("assertive");
    // 技術例外(ERROR)以下は assertive にしない(警告過多防止)
    expect(SEVERITY_PRESENTATION.WARNING.ariaLive).toBe("polite");
    expect(SEVERITY_PRESENTATION.INFO.ariaRole).toBe("status");
  });
});

describe("Visual Status Registry — new axes (R-RECLIFE/R-OFFLINE/R-CLINALERT/R-AUTH/処方差分)", () => {
  it("covers every new-axis enum value exhaustively (未定義状態を残さない)", () => {
    for (const key of RECORD_LIFECYCLE_STATUSES) {
      expect(RECORD_LIFECYCLE_PRESENTATION[key]).toBeDefined();
    }
    for (const key of SYNC_STATUSES) {
      expect(SYNC_PRESENTATION[key]).toBeDefined();
    }
    for (const key of PRESCRIPTION_CHANGE_TYPES) {
      expect(PRESCRIPTION_CHANGE_PRESENTATION[key]).toBeDefined();
    }
    for (const key of SESSION_STATUSES) {
      expect(SESSION_PRESENTATION[key]).toBeDefined();
    }
    for (const key of CLINICAL_ALERT_ACK_STATUSES) {
      expect(CLINICAL_ALERT_ACK_PRESENTATION[key]).toBeDefined();
    }
    for (const key of CLINICAL_ALERT_TYPES) {
      expect(CLINICAL_ALERT_TYPE_IDENTITY[key]).toBeDefined();
    }
  });

  it("never encodes meaning by color/shape alone across all new axes (label 必須)", () => {
    const presentations: StatusPresentation[] = [
      ...Object.values(RECORD_LIFECYCLE_PRESENTATION),
      ...Object.values(SYNC_PRESENTATION),
      ...Object.values(PRESCRIPTION_CHANGE_PRESENTATION),
      ...Object.values(SESSION_PRESENTATION),
      ...Object.values(CLINICAL_ALERT_ACK_PRESENTATION),
    ];
    for (const p of presentations) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.shape.length).toBeGreaterThan(0);
    }
    for (const key of CLINICAL_ALERT_TYPES) {
      expect(CLINICAL_ALERT_TYPE_IDENTITY[key].label.length).toBeGreaterThan(0);
      expect(CLINICAL_ALERT_TYPE_IDENTITY[key].shape.length).toBeGreaterThan(0);
    }
  });

  it("does not present local-only saves as durable server saves (H-03)", () => {
    // ローカル自動保存(記録)と同期待ち(sync)は、確定/同期済みと別トーン・別ラベル
    expect(resolveStatus({ domain: "record-lifecycle", key: "AUTO_SAVED_LOCALLY" }).tone).not.toBe(
      resolveStatus({ domain: "record-lifecycle", key: "FINALIZED" }).tone,
    );
    expect(resolveStatus({ domain: "sync", key: "QUEUED" }).label).not.toBe(
      resolveStatus({ domain: "sync", key: "SYNCED" }).label,
    );
  });

  it("notifies AT for sync failure/conflict and session expiry/lock (alert role)", () => {
    expect(resolveStatus({ domain: "sync", key: "CONFLICT" }).ariaRole).toBe("alert");
    expect(resolveStatus({ domain: "sync", key: "SYNC_FAILED" }).ariaRole).toBe("alert");
    expect(resolveStatus({ domain: "session", key: "EXPIRED" }).ariaRole).toBe("alert");
    expect(resolveStatus({ domain: "session", key: "LOCKED" }).ariaRole).toBe("alert");
  });

  it("distinguishes dose increase/decrease by shape (色非依存 H-06/H-07)", () => {
    expect(resolveStatus({ domain: "prescription-change", key: "DOSE_INCREASED" }).shape).toBe("↑");
    expect(resolveStatus({ domain: "prescription-change", key: "DOSE_DECREASED" }).shape).toBe("↓");
  });
});

describe("DomainStatusBadge", () => {
  it("renders the registry label with redundant aria-hidden shape and machine-readable key", () => {
    const html = renderToStaticMarkup(
      <DomainStatusBadge query={{ domain: "eligibility", key: "LOCAL_ONLY_UNVERIFIED" }} />,
    );
    expect(html).toContain("ローカル参照のみ(オンライン未確認)");
    expect(html).toContain('data-domain="eligibility"');
    expect(html).toContain('data-status="LOCAL_ONLY_UNVERIFIED"');
    expect(html).toContain('data-tone="blocked"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("uses assertive alert semantics for CRITICAL severity", () => {
    const html = renderToStaticMarkup(
      <DomainStatusBadge query={{ domain: "severity", key: "CRITICAL" }} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("重大");
  });
});
