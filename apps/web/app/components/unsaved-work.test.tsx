import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  UnsavedWorkStatusView,
  createUnsavedWorkStore,
  patientContextChangeNeedsConfirmation,
  resolveUnsavedWorkHref,
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

  it("derives an exact reception recovery route only from a matching bounded snapshot", () => {
    const persisted = {
      ...RECORD,
      patientId: "patient-1",
      snapshot: {
        kind: "persisted-prescription-work-v1",
        receptionId: "reception-1",
        patientId: "patient-1",
        businessDate: "2026-08-25",
      },
    } as const;
    expect(resolveUnsavedWorkHref(persisted)).toBe(
      "/prescriptions/reception-1?patientId=patient-1&date=2026-08-25",
    );
    expect(
      resolveUnsavedWorkHref({
        ...persisted,
        snapshot: { ...persisted.snapshot, patientId: "patient-other" },
      }),
    ).toBe("/prescriptions");
    expect(
      resolveUnsavedWorkHref({
        ...persisted,
        snapshot: { ...persisted.snapshot, receptionId: "../admin" },
      }),
    ).toBe("/prescriptions");
  });

  it("normalizes a persisted record to the exact recovery route when stored", () => {
    const store = createUnsavedWorkStore();
    store.upsert({
      ...RECORD,
      snapshot: {
        receptionId: "reception-1",
        patientId: "patient-1",
        businessDate: "2026-08-25",
      },
    });
    expect(store.get(RECORD.id)?.href).toBe(
      "/prescriptions/reception-1?patientId=patient-1&date=2026-08-25",
    );
  });

  it("shows a PHI-free tab-memory warning with the supplied recovery target", () => {
    const html = renderToStaticMarkup(
      <UnsavedWorkStatusView
        count={1}
        href="/prescriptions/reception-1?patientId=patient-1&amp;date=2026-08-25"
      />,
    );
    expect(html).toContain("未保存下書き 1件");
    expect(html).toContain("このタブ内のみ・再読込で消失");
    expect(html).toContain("/prescriptions/reception-1");
    expect(html).not.toContain("患者名");
  });
});
