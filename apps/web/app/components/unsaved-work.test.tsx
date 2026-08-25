import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  UnsavedWorkStatusView,
  createUnsavedWorkStore,
  patientContextChangeNeedsConfirmation,
  shouldBlockBeforeUnload,
} from "./unsaved-work";

(globalThis as { React?: typeof React }).React = React;

const RECORD = {
  id: "prescription-draft:patient-1",
  kind: "prescription-draft",
  label: "処方下書き",
  href: "/prescriptions",
  patientId: "patient-1",
  snapshot: { rows: 1 },
} as const;

describe("unsaved work memory boundary", () => {
  it("keeps records only in the explicit in-memory store", () => {
    const store = createUnsavedWorkStore();
    expect(store.count()).toBe(0);

    store.upsert(RECORD);
    expect(store.count()).toBe(1);
    expect(store.get<{ rows: number }>(RECORD.id)?.snapshot).toEqual({
      rows: 1,
    });
    expect(store.hasForPatient("patient-1")).toBe(true);

    store.removeForPatient("patient-1");
    expect(store.count()).toBe(0);
  });

  it("requires confirmation only when leaving a patient that owns unsaved work", () => {
    expect(
      patientContextChangeNeedsConfirmation([RECORD], "patient-1", "patient-2"),
    ).toBe(true);
    expect(
      patientContextChangeNeedsConfirmation([RECORD], "patient-1", null),
    ).toBe(true);
    expect(
      patientContextChangeNeedsConfirmation([RECORD], "patient-1", "patient-1"),
    ).toBe(false);
    expect(
      patientContextChangeNeedsConfirmation([RECORD], "patient-2", "patient-1"),
    ).toBe(false);
  });

  it("blocks document unload only while unsaved work exists", () => {
    expect(shouldBlockBeforeUnload(0)).toBe(false);
    expect(shouldBlockBeforeUnload(1)).toBe(true);
  });

  it("shows a PHI-free tab-memory warning without adding a patient identifier", () => {
    const html = renderToStaticMarkup(<UnsavedWorkStatusView count={1} />);
    expect(html).toContain("未保存下書き 1件");
    expect(html).toContain("このタブ内のみ・再読込で消失");
    expect(html).toContain('href="/prescriptions"');
    expect(html).not.toContain("patient-1");
    expect(html).not.toContain("患者名");
  });
});
