import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import {
  PrescriptionWorkspace,
  SelectedPatientWorkspaceView,
  buildDraftRowsFromPastPrescription,
  createBlankDraftRows,
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

const PAST_PRESCRIPTIONS = [
  {
    date: "2026/08/24",
    rows: [
      {
        drug: "アムロジピンOD錠5mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "ロサルタンK錠50mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "トラゾドン錠25mg",
        usage: "1日1回 就寝前",
        days: "7",
        quantity: "7錠",
      },
    ],
  },
  {
    date: "2026/07/27",
    rows: [
      {
        drug: "アムロジピン錠5mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "ロサルタンK錠50mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "トラゾドン錠25mg",
        usage: "1日1回 就寝前",
        days: "7",
        quantity: "7錠",
      },
    ],
  },
  {
    date: "2026/06/28",
    rows: [
      {
        drug: "アムロジピン錠5mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "ロサルタンK錠50mg",
        usage: "1日1回 朝食後",
        days: "7",
        quantity: "7錠",
      },
      {
        drug: "トラゾドン錠25mg",
        usage: "1日1回 就寝前",
        days: "7",
        quantity: "7錠",
      },
    ],
  },
  {
    date: "2026/05/27",
    rows: [
      {
        drug: "アムロジピン錠5mg",
        usage: "1日1回 朝食後",
        days: "14",
        quantity: "14錠",
      },
      {
        drug: "ロサルタンK錠50mg",
        usage: "1日1回 朝食後",
        days: "14",
        quantity: "14錠",
      },
    ],
  },
] as const;

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

  it("never binds fixed synthetic drugs or dates to a selected patient", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );

    expect(html).toContain('data-prototype-clinical-data="excluded"');
    expect(html).toContain("患者固有API未接続");
    expect(html).toContain("この患者の過去処方は未取得です");
    expect(html).toContain("山田 花子");
    expect(html).not.toContain("data-patient-id");
    expect(html).not.toContain("アムロジピン");
    expect(html).not.toContain("ロサルタン");
    expect(html).not.toContain("トラゾドン");
    expect(html).not.toContain("2026/08/24");
  });

  it("starts blank and documents the PHI-minimizing recovery boundary", () => {
    expect(createBlankDraftRows()).toEqual([
      { id: 1, drug: "", usage: "", days: "", quantity: "" },
    ]);
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("未選択");
    expect(html).toContain("未入力・保存API未接続");
    expect(html).toContain("このタブのメモリだけに保持");
    expect(html).toContain("患者切替では確認後に破棄");
    expect(html).toContain("再読込・タブ終了では警告後に消失");
    expect(html).not.toContain('value="外来" selected');
  });

  it("filters isolated synthetic fixtures without projecting them into production UI", () => {
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "2026/07")).toHaveLength(
      1,
    );
    expect(filterPastPrescriptions(PAST_PRESCRIPTIONS, "14日")).toHaveLength(1);
    expect(
      filterPastPrescriptions(PAST_PRESCRIPTIONS, "ロサルタン"),
    ).toHaveLength(4);
    expect(
      filterPastPrescriptions(PAST_PRESCRIPTIONS, "一致しない"),
    ).toHaveLength(0);
  });

  it("summarizes ordinary replacement differences", () => {
    const summary = summarizePrescriptionReplacement(
      [
        {
          id: 1,
          drug: "アムロジピンOD錠5mg",
          usage: "1日1回 朝食後",
          days: "7",
          quantity: "7錠",
        },
        {
          id: 2,
          drug: "ロサルタンK錠50mg",
          usage: "1日1回 朝食後",
          days: "7",
          quantity: "7錠",
        },
        {
          id: 3,
          drug: "トラゾドン錠25mg",
          usage: "1日1回 就寝前",
          days: "7",
          quantity: "7錠",
        },
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

  it("preserves duplicate same-drug RP rows as a multiset", () => {
    const summary = summarizePrescriptionReplacement(
      [
        {
          id: 1,
          drug: "同一薬10mg",
          usage: "朝",
          days: "7",
          quantity: "7錠",
        },
        {
          id: 2,
          drug: "同一薬10mg",
          usage: "夕",
          days: "7",
          quantity: "7錠",
        },
        {
          id: 3,
          drug: "同一薬10mg",
          usage: "就寝前",
          days: "7",
          quantity: "7錠",
        },
      ],
      {
        date: "2026/08/01",
        rows: [
          {
            drug: "同一薬10mg",
            usage: "朝",
            days: "7",
            quantity: "7錠",
          },
          {
            drug: "同一薬10mg",
            usage: "夕",
            days: "14",
            quantity: "14錠",
          },
        ],
      },
    );

    expect(summary).toEqual({
      added: 0,
      removed: 1,
      changed: 1,
      unchanged: 1,
    });
  });

  it("copies stored fixture rows exactly instead of inferring usage or quantity", () => {
    const source = PAST_PRESCRIPTIONS[3]!;
    expect(buildDraftRowsFromPastPrescription(source)).toEqual([
      { id: 1, ...source.rows[0] },
      { id: 2, ...source.rows[1] },
    ]);
  });

  it("keeps destructive clearing behind an explicit confirmation step", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("入力を消去");
    expect(html).toContain("削除確認");
    expect(html).toContain("空の最終行は削除できません");
    expect(html).toContain("disabled");
    expect(html).not.toContain("確認して消去");
    expect(html).not.toContain("確認して削除");
  });

  it("does not present missing clinical checks or calculation as completed", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain(
      "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です",
    );
    expect(html).toContain("安全確認済みを意味しません");
    expect(html).toContain("処方保存API・監査証跡が未接続です");
    expect(html).not.toContain("安全確認済みです");
  });

  it("keeps the scrollable safety rail keyboard reachable", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toMatch(
      /<aside class="prescription-safety-rail" aria-label="患者コンテキストと安全情報" tabindex="0">/,
    );
  });
});
