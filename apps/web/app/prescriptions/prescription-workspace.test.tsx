import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import {
  PrescriptionWorkspace,
  SelectedPatientWorkspaceView,
} from "./prescription-workspace";

(globalThis as { React?: typeof React }).React = React;

describe("PrescriptionWorkspace (operator-first UI / patient safety)", () => {
  it("blocks starting work without a selected patient and routes to search", () => {
    const html = renderToStaticMarkup(
      <PatientContextProvider>
        <PrescriptionWorkspace />
      </PatientContextProvider>,
    );
    expect(html).toContain("業務対象の患者が選択されていません");
    expect(html).toContain('href="/patients"');
    expect(html).toContain("患者取り違え防止");
    expect(html).not.toContain('data-patient-selected="true"');
  });

  it("keeps the past-prescription rail visible beside the entry surface", () => {
    const html = renderToStaticMarkup(<SelectedPatientWorkspaceView />);
    expect(html).toContain('data-patient-selected="true"');
    expect(html).toContain("過去処方一覧（直近6か月）");
    expect(html).toContain("処方入力ワークスペース");
    expect(html).toContain("患者コンテキスト &amp; 安全");
  });

  it("does not present missing clinical checks or calculation as completed", () => {
    const html = renderToStaticMarkup(<SelectedPatientWorkspaceView />);
    expect(html).toContain("臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です");
    expect(html).toContain("安全確認済みを意味しません");
    expect(html).toContain("合成処方データ");
    expect(html).toContain("保存API未接続");
    expect(html).not.toContain("安全確認済みです");
  });
});
