import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import {
  PrescriptionWorkspace,
  SelectedPatientWorkspaceView,
} from "./prescription-workspace";

(globalThis as { React?: typeof React }).React = React;

describe("PrescriptionWorkspace (SCR-006 基盤 / R-PATCTX 配線)", () => {
  it("blocks starting work without a selected patient and routes to search (H-01/H-02)", () => {
    const html = renderToStaticMarkup(
      <PatientContextProvider>
        <PrescriptionWorkspace />
      </PatientContextProvider>,
    );
    expect(html).toContain("業務対象の患者が選択されていません");
    expect(html).toContain('href="/patients"');
    expect(html).toContain("患者取り違え防止");
    // 患者未選択では臨床アラート領域も処方入力も出さない
    expect(html).not.toContain('data-patient-selected="true"');
  });

  it("does not present missing clinical checks as safety when standalone (H-08)", () => {
    // Provider なし(スタンドアロン)でも患者未選択として安全側に倒れる
    const html = renderToStaticMarkup(<PrescriptionWorkspace />);
    expect(html).toContain("業務対象の患者が選択されていません");
    expect(html).not.toContain("アラートなし");
  });

  it("warns explicitly that clinical checks are not connected once a patient is selected (H-08)", () => {
    const html = renderToStaticMarkup(<SelectedPatientWorkspaceView />);
    expect(html).toContain('data-patient-selected="true"');
    expect(html).toContain("臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です");
    expect(html).toContain("安全確認済みを意味しません");
    expect(html).toContain("[警告(WARNING)]");
    expect(html).toContain("処方データは未接続です");
  });
});
