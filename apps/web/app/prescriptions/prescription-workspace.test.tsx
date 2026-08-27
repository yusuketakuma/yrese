import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import type { PrescriptionDraftResponse } from "@yrese/contracts";

import {
  canSavePrescriptionDraft,
  PrescriptionWorkspace,
  resolveDraftLoadOutcome,
  resolveSaveFailureState,
  SelectedPatientWorkspaceView,
} from "./prescription-workspace";
import { createBlankDraftRows } from "./prescription-replacement";
import { createBlankPrescriptionDraft } from "./prescription-draft";
import {
  fromPrescriptionDraftResponse,
  PrescriptionDraftApiError,
  prescriptionDraftSnapshotsEqual,
} from "./prescription-draft-persistence";

(globalThis as { React?: typeof React }).React = React;

const SELECTED_PATIENT = {
  patientId: "patient-1",
  name: "山田 花子",
  kana: "ヤマダ ハナコ",
  birthDate: "1950-01-02",
  sex: "female",
  eligibilityStatus: "VERIFIED",
} as const;

describe("PrescriptionWorkspace (connected draft UI / patient safety)", () => {
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

  it("starts blank and fails closed without a verified reception origin", () => {
    expect(createBlankDraftRows()).toEqual([
      { id: 1, drug: "", usage: "", days: "", quantity: "" },
    ]);
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("未選択");
    expect(html).toContain("受付未連携・保存不可");
    expect(html).toContain("受付との連携がありません");
    expect(html).toContain("サーバーへ保存できません");
    expect(html).toContain("処方下書きを保存");
    expect(html).toContain("受付画面から対象受付を引き継いでください");
    expect(html).not.toContain('value="外来" selected');
  });

  it("names the blocking gate for every capability it refuses to provide", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("RB-007 BLOCKED_PMDA_SAMD_REVIEW");
    expect(html).toContain("SaMD該当性判定と人間レビューが未了");
    expect(html).toContain("RB-008 BLOCKED_REGULATORY_REVIEW");
    expect(html).toContain("診療報酬・薬価ロジックの法令レビュー未了");
    expect(html).toContain("薬剤師確認 (SCR-014, dispensing:confirm)");
    expect(html).toContain("API operation");
    expect(html).toContain(
      "保存済みの内容は「薬剤師確認前」であり、調剤・交付の根拠になりません",
    );
  });

  it("declares that no clinical judgement ran, rather than reporting a judgement result", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("判定そのものが行われていない");
    expect(html).toContain(
      "アレルギー歴・既往歴は未接続です。表示されないことは該当なしを意味しません。",
    );
    expect(html).toContain("検査値が表示されないことは正常を意味しません");
    expect(html).not.toContain("すべて正常");
    expect(html).not.toContain("該当なし。");
  });

  it("shows past prescriptions as not-retrieved instead of as an interactive dead control", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("この患者の過去処方は未取得です");
    expect(html).toContain("0件ではなく、取得していません");
    expect(html).not.toContain("過去処方API接続後に検索できます");
    expect(html).not.toContain('id="past-prescription-search"');
  });

  it("reports the unsaved-draft and pharmacist-confirmation state without claiming completion", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("サーバー下書き版");
    expect(html).toContain("未作成");
    expect(html).toContain("薬剤師確認");
    expect(html).toContain("未実施（実行不可）");
    expect(html).not.toContain("サーバー保存済み");
  });

  it("keeps destructive changes behind an explicit confirmation step", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("変更を戻す");
    expect(html).toContain("削除確認");
    expect(html).toContain("空の最終行は削除できません");
    expect(html).toContain("disabled");
    expect(html).not.toContain("確認して変更を破棄");
    expect(html).not.toContain("確認して削除");
  });

  it("does not present missing clinical checks, finalization, or calculation as completed", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain(
      "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です",
    );
    expect(html).toContain("安全確認済みを意味しません");
    expect(html).toContain("下書き保存は薬剤師確認・処方確定を意味しません");
    expect(html).toContain("算定エンジンと根拠トレースが未接続です");
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

const SERVER_DRAFT_RESPONSE: PrescriptionDraftResponse = {
  prescriptionId: "prescription-test-001",
  receptionId: "reception-test-001",
  patientId: "patient-1",
  businessDate: "2026-08-26",
  version: 2,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-08-26",
    defaultDays: 7,
    flags: [],
    note: "サーバー保存版のメモ",
    rows: [
      {
        sequence: 1,
        drugText: "合成薬剤 5mg",
        usageText: "1日1回 朝食後",
        days: 7,
        quantityText: "7錠",
      },
    ],
  },
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T02:00:00.000Z",
  createdBy: "actor-test-001",
  updatedBy: "actor-test-002",
};

describe("connected draft state machine (WP-5101 review HIGH-1/HIGH-2)", () => {
  const serverSnapshot = () => fromPrescriptionDraftResponse(SERVER_DRAFT_RESPONSE);
  const divergedSnapshot = () => ({
    ...fromPrescriptionDraftResponse(SERVER_DRAFT_RESPONSE),
    note: "タブ内で復元した未保存メモ",
  });

  it("adopts the server draft when nothing was restored in this tab", () => {
    const outcome = resolveDraftLoadOutcome(SERVER_DRAFT_RESPONSE, null);
    expect(outcome.serverVersion).toBe(2);
    expect(outcome.serverUpdatedAt).toBe("2026-08-26T02:00:00.000Z");
    expect(outcome.serverChangedWhileAway).toBe(false);
    expect(outcome.adoptServerDraft).toBe(true);
  });

  it("keeps a restored draft that already matches the server without flagging divergence", () => {
    const outcome = resolveDraftLoadOutcome(SERVER_DRAFT_RESPONSE, serverSnapshot());
    expect(outcome.serverChangedWhileAway).toBe(false);
    expect(outcome.adoptServerDraft).toBe(false);
  });

  it("flags divergence when the restored draft differs from the server draft", () => {
    const outcome = resolveDraftLoadOutcome(SERVER_DRAFT_RESPONSE, divergedSnapshot());
    expect(outcome.serverChangedWhileAway).toBe(true);
    expect(outcome.adoptServerDraft).toBe(false);
    expect(outcome.serverVersion).toBe(2);
  });

  it("treats an absent server draft as version 0 with a blank baseline", () => {
    const outcome = resolveDraftLoadOutcome(null, null);
    expect(outcome.serverVersion).toBe(0);
    expect(outcome.serverUpdatedAt).toBeNull();
    expect(outcome.adoptServerDraft).toBe(true);
    expect(prescriptionDraftSnapshotsEqual(outcome.baseline, createBlankPrescriptionDraft())).toBe(
      true,
    );
  });

  it("blocks saving while a restored draft diverges from the server version (HIGH-1)", () => {
    expect(
      canSavePrescriptionDraft({
        linked: true,
        loadKind: "ready",
        dirty: true,
        saveKind: "idle",
        serverChangedWhileAway: true,
      }),
    ).toBe(false);
  });

  it("allows saving once the operator explicitly resolves the divergence", () => {
    expect(
      canSavePrescriptionDraft({
        linked: true,
        loadKind: "ready",
        dirty: true,
        saveKind: "idle",
        serverChangedWhileAway: false,
      }),
    ).toBe(true);
  });

  it("keeps a save conflict distinct from a generic failure so it is never blind-retried", () => {
    expect(
      resolveSaveFailureState(
        new PrescriptionDraftApiError("CONFLICT", "別の更新を検出しました。"),
      ),
    ).toEqual({ kind: "conflict" });
  });

  it("normalizes an unknown save failure into a reportable error state", () => {
    const state = resolveSaveFailureState(new TypeError("network down"));
    expect(state.kind).toBe("error");
    if (state.kind !== "error") throw new Error("expected an error state");
    expect(state.error).toBeInstanceOf(PrescriptionDraftApiError);
    expect(state.error.kind).toBe("UNAVAILABLE");
  });

  it("blocks saving on conflict, while saving, when unlinked, unloaded, or clean", () => {
    const base = {
      linked: true,
      loadKind: "ready" as const,
      dirty: true,
      saveKind: "idle" as const,
      serverChangedWhileAway: false,
    };
    expect(canSavePrescriptionDraft({ ...base, saveKind: "conflict" })).toBe(false);
    expect(canSavePrescriptionDraft({ ...base, saveKind: "saving" })).toBe(false);
    expect(canSavePrescriptionDraft({ ...base, linked: false })).toBe(false);
    expect(canSavePrescriptionDraft({ ...base, loadKind: "loading" })).toBe(false);
    expect(canSavePrescriptionDraft({ ...base, dirty: false })).toBe(false);
  });
});
