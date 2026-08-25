import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import {
  PAST_PRESCRIPTIONS,
  PrescriptionWorkspace,
  SelectedPatientWorkspaceView,
  buildDraftRowsFromPastPrescription,
  filterPastPrescriptions,
  summarizePrescriptionReplacement,
} from "./prescription-workspace";

(globalThis as { React?: typeof React }).React = React;

const SELECTED_PATIENT = {
  patientId: "patient-1",
  name: "山田 花子",
  kana: "ヤマダ ハナコ",
  birthDate: "1950-01-02",
  sex: "female",
  eligibilityStatus: "VERIFIED",
} as const;

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
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain('data-patient-selected="true"');
    expect(html).toContain("過去処方一覧（直近6か月）");
    expect(html).toContain("処方入力ワークスペース");
    expect(html).toContain("患者コンテキスト &amp; 安全");
    expect(html).toContain("差分を確認");
    expect(html).not.toContain("この構成を入力欄へ反映");
  });

  it("projects the selected patient into the safety rail without adding an identifier attribute", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );

    expect(html).toContain("山田 花子");
    expect(html).toContain("ヤマダ ハナコ");
    expect(html).toContain("生年月日 1950-01-02");
    expect(html).not.toContain("data-patient-id");
    expect(html).toContain("資格確認済み");
  });

  it("filters the synthetic history by date, duration, and drug name", () => {
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "2026/07")).toHaveLength(1);
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "14日")).toHaveLength(1);
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "ロサルタン")).toHaveLength(4);
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "一致しない")).toHaveLength(0);
  });

  it("summarizes replacement differences before applying a past prescription", () => {
    const summary = summarizePrescriptionReplacement(
      [
        { id: 1, drug: "アムロジピンOD錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
        { id: 2, drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
        { id: 3, drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
      ],
      PAST_PRESCRIPTIONS[1]!,
    );

    expect(summary).toEqual({
      added: 1,
      removed: 1,
      changed: 0,
      unchanged: 2,
    });
  });

  it("copies stored past rows exactly instead of inferring usage or quantity", () => {
    const source = PAST_PRESCRIPTIONS[3]!;
    expect(buildDraftRowsFromPastPrescription(source)).toEqual([
      { id: 1, ...source.rows[0]! },
      { id: 2, ...source.rows[1]! },
    ]);
  });

  it("detects a same-drug usage or quantity change instead of calling it unchanged", () => {
    const summary = summarizePrescriptionReplacement(
      [
        { id: 1, drug: "アムロジピンOD錠5mg", usage: "1日1回 夕食後", days: "7", quantity: "7錠" },
        { id: 2, drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
        { id: 3, drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
      ],
      PAST_PRESCRIPTIONS[0]!,
    );

    expect(summary).toEqual({
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 2,
    });
  });

  it("compares duplicate same-drug RP rows as a multiset instead of collapsing them", () => {
    const summary = summarizePrescriptionReplacement(
      [
        { id: 1, drug: "合成薬A", usage: "1日1回 朝", days: "7", quantity: "7錠" },
        { id: 2, drug: "合成薬A", usage: "1日1回 夕", days: "7", quantity: "7錠" },
      ],
      {
        date: "2026/08/24",
        rows: [
          { drug: "合成薬A", usage: "1日1回 朝", days: "7", quantity: "7錠" },
          { drug: "合成薬A", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
          { drug: "合成薬A", usage: "頓用", days: "1", quantity: "3錠" },
        ],
      },
    );

    expect(summary).toEqual({
      added: 1,
      removed: 0,
      changed: 1,
      unchanged: 1,
    });
  });

  it("does not present missing clinical checks or calculation as completed", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です");
    expect(html).toContain("安全確認済みを意味しません");
    expect(html).toContain("合成処方データ");
    expect(html).toContain("保存API未接続");
    expect(html).not.toContain("安全確認済みです");
  });
});
