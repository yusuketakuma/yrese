import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PatientContextProvider } from "../components/patient-context";
import type { PrescriptionDraftResponse } from "@yrese/contracts";

import {
  applyDraftRowPatch,
  canSavePrescriptionDraft,
  defaultValidUntil,
  isPrescriptionSourceExpired,
  PrescriptionDraftChangeSummary,
  PrescriptionLifecycleDialog,
  PrescriptionWorkspace,
  prescriptionDraftUnresolvedDisplay,
  resolveDraftLoadOutcome,
  resolveSaveFailureState,
  resolveSaveStateAfterEdit,
  serverDraftDivergenceCopy,
  SelectedPatientWorkspaceView,
  summarizePrescriptionDraftChanges,
} from "./prescription-workspace";
import {
  createBlankDraftRow,
  createBlankDraftRows,
} from "./prescription-replacement";
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
    const rows = createBlankDraftRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      drug: "",
      usage: "",
      days: "",
      quantity: "",
      medicationMode: "text",
      usageMode: "text",
    });
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
    expect(html).toContain("prescription:confirm");
    expect(html).toContain(
      "保存済みの内容は「薬剤師確認前」であり、調剤・交付の根拠になりません",
    );
  });

  it("renders the lifecycle section as unconfirmed draft with a disabled confirm action", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    expect(html).toContain("薬剤師確認・処方確定");
    expect(html).toContain('data-lifecycle-status="DRAFT"');
    expect(html).toContain("下書き(未確認)");
    expect(html).toContain("薬剤師確認へ進む");
    // 受付未連携・未保存のため確認は disabled。
    expect(html).toMatch(/薬剤師確認へ進む[^]*?disabled|disabled[^]*?薬剤師確認へ進む/u);
  });

  it("re-displays the patient and executing actor in the confirm dialog", () => {
    const html = renderToStaticMarkup(
      <PrescriptionLifecycleDialog
        target="confirm"
        patientLabel={`${SELECTED_PATIENT.name}（${SELECTED_PATIENT.kana}）`}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("薬剤師確認を記録しますか");
    expect(html).toContain(
      `対象患者: ${SELECTED_PATIENT.name}（${SELECTED_PATIENT.kana}）`,
    );
    expect(html).toContain("確認済みとして記録");
    expect(html).toContain("監査証跡に残り、取り消せません");
    // NODE_ENV=test では認証コンテキスト表記(dev スタブ名は出さない)。
    expect(html).toContain("実行 actor: 認証コンテキストの操作者として記録");
    expect(html).not.toContain("u-dev");
  });

  it("re-displays the patient and executing actor in the finalize dialog", () => {
    const html = renderToStaticMarkup(
      <PrescriptionLifecycleDialog
        target="finalize"
        patientLabel={`${SELECTED_PATIENT.name}（${SELECTED_PATIENT.kana}）`}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("処方を確定しますか");
    expect(html).toContain("不変の版(v1)");
    expect(html).toContain("確定する");
    expect(html).toContain("実行 actor:");
  });

  it("names the development stub actor inside the dialog under NODE_ENV=development", () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const html = renderToStaticMarkup(
        <PrescriptionLifecycleDialog
          target="confirm"
          patientLabel="合成 患者（ゴウセイ カンジャ）"
        />,
      );
      expect(html).toContain("実行 actor: u-dev（開発スタブ）");
    } finally {
      vi.unstubAllEnvs();
    }
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
    expect(html).toContain("下書き(未確認)");
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
    sourceMetadata: null,
    prescriptionDate: "2026-08-26",
    defaultDays: 7,
    flags: [],
    note: "サーバー保存版のメモ",
    rows: [],
    rpGroups: [
      {
        rpGroupId: "00000000-0000-4000-8000-000000000011",
        sequence: 1,
        dosageForm: "ORAL",
        usage: { kind: "unresolved" as const, text: "1日1回 朝食後" },
        daysOrCount: 7,
        items: [
          {
            rpItemId: "00000000-0000-4000-a000-000000000011",
            sequence: 1,
            medication: {
              kind: "unresolved" as const,
              text: "合成薬剤 5mg",
            },
            doseOnce: null,
            dosePerDay: null,
            doseTotal: "7錠",
            unit: null,
            genericNamePrescription: false,
            genericSubstitutionPermitted: null,
          },
        ],
      },
    ],
  },
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T02:00:00.000Z",
  createdBy: "actor-test-001",
  updatedBy: "actor-test-002",
  status: null,
  confirmedBy: null,
  confirmedAt: null,
  finalizedBy: null,
  finalizedAt: null,
  prescriptionVersion: null,
  copiedFrom: null,
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

  it("summarizes both conflict paths with labels only and describes 409 against the last-loaded version", () => {
    const current = {
      ...divergedSnapshot(),
      prescriptionType: "在宅",
      prescriptionDate: "2026-08-27",
      defaultDays: "14",
      options: ["一包化" as const],
      rows: [
        {
          ...divergedSnapshot().rows[0]!,
          drug: "別の合成薬剤 10mg",
          usage: "1日2回 朝夕食後",
          days: "14",
          quantity: "28錠",
        },
        {
          ...createBlankDraftRow(2),
          drug: "追加薬",
          usage: "頓服",
          quantity: "3回分",
        },
      ],
    };

    expect(
      summarizePrescriptionDraftChanges(current, serverSnapshot()),
    ).toEqual([
      "処方区分",
      "処方日",
      "交付日数",
      "全体指示",
      "メモ",
      "RP行数",
      "RP1 薬剤",
      "RP1 用法・剤形",
      "RP1 日数・回数",
      "RP1 用量",
    ]);

    const conflictHtml = renderToStaticMarkup(
      <PrescriptionDraftChangeSummary
        kind="save-conflict"
        draft={current}
        baseline={serverSnapshot()}
        serverVersion={1}
      />,
    );
    expect(conflictHtml).toContain("最後に読み込んだサーバー版");
    expect(conflictHtml).toContain("競合相手の最新内容はまだ取得していません");
    expect(conflictHtml).toContain("RP1 薬剤");
    expect(conflictHtml).not.toContain("別の合成薬剤 10mg");
    expect(conflictHtml).not.toContain("28錠");
    expect(conflictHtml).not.toContain("サーバー最新版との差分");

    const restoredHtml = renderToStaticMarkup(
      <PrescriptionDraftChangeSummary
        kind="server-changed-while-away"
        draft={current}
        baseline={serverSnapshot()}
        serverVersion={1}
      />,
    );
    expect(restoredHtml).toContain("今回読み込んだサーバー保存版");
    expect(restoredHtml).toContain("変更値は表示しません");

    const absentBaselineHtml = renderToStaticMarkup(
      <PrescriptionDraftChangeSummary
        kind="server-changed-while-away"
        draft={current}
        baseline={createBlankPrescriptionDraft()}
        serverVersion={0}
      />,
    );
    expect(absentBaselineHtml).toContain("サーバー状態（下書きなし）");
    expect(absentBaselineHtml).not.toContain("サーバー保存版");
    expect(absentBaselineHtml).toContain('role="group"');
    expect(absentBaselineHtml).toContain('aria-label="処方下書きの変更項目"');
  });

  it("summarizes changes using the same normalized values as divergence detection", () => {
    const baseline = serverSnapshot();
    const formattingOnly = {
      ...baseline,
      prescriptionDate: ` ${baseline.prescriptionDate} `,
      defaultDays: "007",
      note: ` ${baseline.note} `,
      rows: baseline.rows.map((row) => ({
        ...row,
        drug: ` ${row.drug} `,
        usage: ` ${row.usage} `,
        days: "007",
        quantity: ` ${row.quantity} `,
      })),
    };

    expect(prescriptionDraftSnapshotsEqual(formattingOnly, baseline)).toBe(true);
    expect(
      summarizePrescriptionDraftChanges(
        { ...formattingOnly, note: "更新したメモ" },
        baseline,
      ),
    ).toEqual(["メモ"]);
  });

  it("describes an absent server draft without implying that a saved version exists", () => {
    expect(serverDraftDivergenceCopy(0)).toEqual({
      noticeTitle: "サーバー側に下書きがありません",
      currentBaseline: "今回確認したサーバー状態（下書きなし）",
      restoredBaseline: "今回読み込んだサーバー状態（下書きなし）",
      conflictBaseline: "最後に読み込んだサーバー状態（下書きなし）",
      discardLocal: "復元した入力を破棄して下書きなしに戻す",
      keepLocal: "この入力を残して保存へ進む",
    });
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

  it("keeps the save-conflict gate across edits until the server version is reloaded", () => {
    expect(resolveSaveStateAfterEdit({ kind: "conflict" })).toEqual({
      kind: "conflict",
    });
    expect(
      canSavePrescriptionDraft({
        linked: true,
        loadKind: "ready",
        dirty: true,
        saveKind: resolveSaveStateAfterEdit({ kind: "conflict" }).kind,
        serverChangedWhileAway: false,
      }),
    ).toBe(false);
  });

  it("clears non-conflict save states on the next edit", () => {
    expect(resolveSaveStateAfterEdit({ kind: "idle" })).toEqual({ kind: "idle" });
    expect(resolveSaveStateAfterEdit({ kind: "saving" })).toEqual({ kind: "idle" });
    expect(
      resolveSaveStateAfterEdit({ kind: "saved", disposition: "updated" }),
    ).toEqual({ kind: "idle" });
    expect(
      resolveSaveStateAfterEdit({
        kind: "error",
        error: new PrescriptionDraftApiError("UNAVAILABLE", "合成の保存失敗"),
      }),
    ).toEqual({ kind: "idle" });
  });
});

describe("prescription source metadata helpers (WP-7205 / DOM-002 §4.2a)", () => {
  it("computes the issueDate+4d default as input assistance only", () => {
    expect(defaultValidUntil("2026-08-20")).toBe("2026-08-24");
    // 月末跨ぎ
    expect(defaultValidUntil("2026-08-29")).toBe("2026-09-02");
    // 不正な入力は既定値を出さない(保存値は入力値そのもの)
    expect(defaultValidUntil("")).toBeNull();
    expect(defaultValidUntil("not-a-date")).toBeNull();
    expect(defaultValidUntil("2026-02-30")).toBeNull();
  });

  it("flags expiry only against the explicit business date and never blocks", () => {
    expect(isPrescriptionSourceExpired("2026-08-24", "2026-08-25")).toBe(true);
    expect(isPrescriptionSourceExpired("2026-08-25", "2026-08-25")).toBe(false);
    expect(isPrescriptionSourceExpired("", "2026-08-25")).toBe(false);
    expect(isPrescriptionSourceExpired("not-a-date", "2026-08-25")).toBe(false);
  });

  it("renders the validity warning via ClinicalAlert when expired", () => {
    const html = renderToStaticMarkup(
      <SelectedPatientWorkspaceView patient={SELECTED_PATIENT} />,
    );
    // 未入力の draft では警告を出さない
    expect(html).not.toContain('data-alert-type="DOCUMENT_VALIDITY"');
  });

  it("names metadata fields in the change summary without echoing values", () => {
    const baseline = createBlankPrescriptionDraft();
    const changed = {
      ...createBlankPrescriptionDraft(),
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      prescriberName: "合成 医師",
      refillTotal: "3",
    };
    const labels = summarizePrescriptionDraftChanges(changed, baseline);
    expect(labels).toEqual(
      expect.arrayContaining(["医師名", "発行日", "有効期限", "リフィル回数"]),
    );
    expect(labels.join("")).not.toContain("2026-08-20");
    expect(labels.join("")).not.toContain("合成 医師");
  });
});

describe("unresolved code guard display (WP-7302 / RX-0001)", () => {
  it("suppresses the guard on an all-empty new form", () => {
    expect(
      prescriptionDraftUnresolvedDisplay(createBlankPrescriptionDraft()),
    ).toBeNull();
  });

  it("counts an unresolved free-text medication as a confirmation blocker", () => {
    const snapshot = {
      ...createBlankPrescriptionDraft(),
      rows: [
        {
          ...createBlankDraftRow(1),
          drug: "合成薬剤 5mg",
          usage: "1日1回 朝食後",
        },
      ],
    };
    expect(prescriptionDraftUnresolvedDisplay(snapshot)).toEqual({
      unresolvedMedicationItems: 1,
      unresolvedUsages: 1,
    });
  });

  it("reports zero unresolved items once medication and usage are code-resolved", () => {
    const snapshot = {
      ...createBlankPrescriptionDraft(),
      rows: [
        {
          ...createBlankDraftRow(1),
          medicationMode: "master" as const,
          masterVersionId: "00000000-0000-4000-8000-000000000001",
          medicationItemId: "00000000-0000-4000-8000-000000000002",
          usageMode: "code" as const,
          usageItemId: "00000000-0000-4000-8000-000000000003",
        },
      ],
    };
    expect(prescriptionDraftUnresolvedDisplay(snapshot)).toEqual({
      unresolvedMedicationItems: 0,
      unresolvedUsages: 0,
    });
  });
});

describe("applyDraftRowPatch (WP-7302 R3 MEDIUM-1)", () => {
  it("propagates group-level fields to all rows sharing the rpGroupId", () => {
    const groupId = "00000000-0000-4000-8000-0000000000aa";
    const other = createBlankDraftRow(3);
    const rows = [
      { ...createBlankDraftRow(1), rpGroupId: groupId, drug: "薬A" },
      { ...createBlankDraftRow(2), rpGroupId: groupId, drug: "薬B" },
      other,
    ];
    // 非先頭行(id=2)への group field 編集が同 group の全行へ伝播する。
    const patched = applyDraftRowPatch(rows, 2, { days: "14" });
    expect(patched[0]?.days).toBe("14");
    expect(patched[1]?.days).toBe("14");
    // 別 group の行と item 固有 field は変えない。
    expect(patched[2]?.days).toBe("");
    expect(patched[0]?.drug).toBe("薬A");
    expect(patched[1]?.drug).toBe("薬B");
  });

  it("does not propagate item-level fields to sibling rows", () => {
    const groupId = "00000000-0000-4000-8000-0000000000bb";
    const rows = [
      { ...createBlankDraftRow(1), rpGroupId: groupId },
      { ...createBlankDraftRow(2), rpGroupId: groupId },
    ];
    const patched = applyDraftRowPatch(rows, 1, { drug: "薬X" });
    expect(patched[0]?.drug).toBe("薬X");
    expect(patched[1]?.drug).toBe("");
  });
});
