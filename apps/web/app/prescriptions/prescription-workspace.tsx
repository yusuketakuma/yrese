"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useState } from "react";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import {
  type PatientContextData,
  useOptionalPatientContext,
} from "../components/patient-context";
import {
  InlineNotice,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { SeverityList } from "../components/severity-list";
import { useOptionalUnsavedWork } from "../components/unsaved-work";

import {
  PRESCRIPTION_OPTIONS,
  type PrescriptionDraftSnapshot,
  type PrescriptionOption,
  clonePrescriptionDraft,
  createBlankPrescriptionDraft,
  isPrescriptionDraftDirty,
  prescriptionDraftWorkId,
} from "./prescription-draft";
import {
  type DraftRow,
  createBlankDraftRows,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";

export type {
  DraftRow,
  PastPrescription,
  PastPrescriptionRow,
  PrescriptionReplacementSummary,
} from "./prescription-replacement";
export {
  buildDraftRowsFromPastPrescription,
  createBlankDraftRows,
  filterPastPrescriptions,
  isDraftRowEmpty,
  pastPrescriptionDurationLabel,
  removeDraftRow,
  summarizePrescriptionReplacement,
} from "./prescription-replacement";
export {
  clonePrescriptionDraft,
  createBlankPrescriptionDraft,
  isPrescriptionDraftDirty,
  prescriptionDraftWorkId,
} from "./prescription-draft";

export function PrescriptionWorkspace() {
  const context = useOptionalPatientContext();
  const patient = context?.patient ?? null;

  if (patient === null) {
    return (
      <section aria-label="処方入力(患者未選択)">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="患者を明示的に選択してから入力を開始します。"
          meta={<StatusPill tone="warning">患者未選択・開始不可</StatusPill>}
        />
        <EmptyState message="業務対象の患者が選択されていません" />
        <p>
          <Link href="/patients">患者検索</Link>
          で患者を選択すると、処方入力を開始できます（患者取り違え防止のため、患者未選択での入力開始はできません）。
        </p>
        <p className="placeholder-note">
          処方データ・臨床判定・算定APIは未接続です。患者未選択では入力欄も表示しません。
        </p>
      </section>
    );
  }

  return <SelectedPatientWorkspaceView key={patient.patientId} patient={patient} />;
}

export function SelectedPatientWorkspaceView({
  patient,
}: {
  readonly patient: PatientContextData;
}) {
  const unsavedWork = useOptionalUnsavedWork();
  const getWorkSnapshot = unsavedWork?.getWorkSnapshot;
  const upsertWork = unsavedWork?.upsertWork;
  const removeWork = unsavedWork?.removeWork;
  const workId = prescriptionDraftWorkId(patient.patientId);
  const [initialDraft] = useState(() => {
    const restored =
      getWorkSnapshot === undefined
        ? undefined
        : getWorkSnapshot<PrescriptionDraftSnapshot>(workId);
    return {
      draft:
        restored === undefined
          ? createBlankPrescriptionDraft()
          : clonePrescriptionDraft(restored),
      restored: restored !== undefined,
    };
  });
  const [draft, setDraft] = useState<PrescriptionDraftSnapshot>(
    initialDraft.draft,
  );
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(
    initialDraft.restored,
  );
  const [resetRequested, setResetRequested] = useState(false);
  const [pendingRemovalRowId, setPendingRemovalRowId] = useState<number | null>(
    null,
  );

  const dirty = isPrescriptionDraftDirty(draft);

  useEffect(() => {
    if (upsertWork === undefined || removeWork === undefined) return;
    if (!dirty) {
      removeWork(workId);
      return;
    }
    upsertWork({
      id: workId,
      kind: "prescription-draft",
      label: "処方下書き",
      href: "/prescriptions",
      patientId: patient.patientId,
      snapshot: clonePrescriptionDraft(draft),
    });
  }, [dirty, draft, patient.patientId, removeWork, upsertWork, workId]);

  function updateDraft(
    update: (current: PrescriptionDraftSnapshot) => PrescriptionDraftSnapshot,
  ) {
    setDraft((current) => update(current));
    setResetRequested(false);
    setPendingRemovalRowId(null);
  }

  function updateRow(
    id: number,
    field: keyof Omit<DraftRow, "id">,
    value: string,
  ) {
    updateDraft((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function addRow() {
    updateDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          id: Math.max(0, ...current.rows.map((row) => row.id)) + 1,
          drug: "",
          usage: "",
          days: "",
          quantity: "",
        },
      ],
    }));
  }

  function requestRowRemoval(id: number) {
    setResetRequested(false);
    setPendingRemovalRowId(id);
  }

  function confirmRowRemoval() {
    if (pendingRemovalRowId === null) return;
    updateDraft((current) => ({
      ...current,
      rows: removeDraftRow(current.rows, pendingRemovalRowId),
    }));
    setPendingRemovalRowId(null);
  }

  function toggleOption(option: PrescriptionOption) {
    updateDraft((current) => ({
      ...current,
      options: current.options.includes(option)
        ? current.options.filter((currentOption) => currentOption !== option)
        : [...current.options, option],
    }));
  }

  function confirmReset() {
    setDraft(createBlankPrescriptionDraft());
    setRestoredNoticeVisible(false);
    setResetRequested(false);
    setPendingRemovalRowId(null);
    removeWork?.(workId);
  }

  const nonEmptyRows = draft.rows.filter((row) => !isDraftRowEmpty(row)).length;
  const pendingRemovalIndex = draft.rows.findIndex(
    (row) => row.id === pendingRemovalRowId,
  );
  const pendingRemovalRow =
    pendingRemovalIndex >= 0 ? draft.rows[pendingRemovalIndex] : undefined;

  return (
    <section
      aria-label="処方入力"
      data-patient-selected="true"
      data-prototype-clinical-data="excluded"
      data-unsaved-draft={dirty ? "true" : "false"}
    >
      <ScreenHeader
        title="処方入力ワークスペース"
        description="患者文脈を固定し、入力と安全情報を並べます。患者固有の過去処方はAPI接続後に表示します。"
        meta={
          <StatusPill tone={dirty ? "warning" : "neutral"}>
            {dirty
              ? "未保存の変更（このタブ内）"
              : "未入力・保存API未接続"}
          </StatusPill>
        }
      />
      <PrototypeBanner tone="warning">
        選択患者へ固定の合成薬剤・合成過去処方を誤帰属させないため、患者固有データは表示していません。下書きはこのタブのメモリだけに保持され、患者切替では確認後に破棄、再読込・タブ終了では警告後に消失します。
      </PrototypeBanner>

      {restoredNoticeVisible ? (
        <InlineNotice title="タブ内下書きを復元しました" tone="info" announce="polite">
          <p>
            同じタブ内の画面移動から戻ったため、未保存入力を復元しました。ブラウザ保存領域には書き込んでいません。再読込・タブ終了では失われます。
          </p>
          <button
            type="button"
            className="operator-text-action"
            onClick={() => setRestoredNoticeVisible(false)}
          >
            確認しました
          </button>
        </InlineNotice>
      ) : null}

      <div className="prescription-workbench-grid prescription-workbench-grid-safe">
        <Panel
          title="過去処方一覧"
          className="prescription-history-panel"
        >
          <StatusPill tone="warning">患者固有API未接続</StatusPill>
          <label className="visually-hidden" htmlFor="past-prescription-search">
            過去処方を検索（未接続）
          </label>
          <input
            id="past-prescription-search"
            className="operator-input"
            type="search"
            placeholder="過去処方API接続後に検索できます"
            disabled
            aria-describedby="past-prescription-unavailable"
          />
          <p
            id="past-prescription-unavailable"
            className="prescription-history-empty"
          >
            この患者の過去処方は未取得です。履歴がない、変更がない、安全である、のいずれも意味しません。従来の薬歴確認手順を継続してください。
          </p>
        </Panel>

        <Panel
          title="処方入力"
          description="未保存下書きは同じタブ内の画面移動では保持されます。患者切替・再読込・タブ終了時は警告します。"
          className="prescription-editor-panel"
          actions={
            <div className="operator-inline-actions">
              <button
                type="button"
                onClick={() => {
                  setPendingRemovalRowId(null);
                  setResetRequested(true);
                }}
                disabled={!dirty}
                title={
                  dirty
                    ? "入力内容を確認後に消去します"
                    : "消去する入力はありません"
                }
              >
                入力を消去
              </button>
              <button type="button" onClick={addRow}>
                RP行を追加
              </button>
            </div>
          }
        >
          {resetRequested ? (
            <section
              className="prescription-reset-review"
              role="region"
              aria-live="assertive"
              aria-labelledby="prescription-reset-title"
              aria-describedby="prescription-reset-description"
            >
              <h4 id="prescription-reset-title">
                未保存の入力を消去しますか
              </h4>
              <p id="prescription-reset-description">
                患者: {patient.name}。入力済み {nonEmptyRows}
                行、選択項目 {draft.options.length}
                件、メモを消去します。この操作は元に戻せません。
              </p>
              <div className="prescription-reset-actions">
                <button
                  type="button"
                  onClick={() => setResetRequested(false)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  data-kind="danger"
                  onClick={confirmReset}
                >
                  確認して消去
                </button>
              </div>
            </section>
          ) : null}

          {pendingRemovalRow !== undefined ? (
            <section
              className="prescription-row-removal-review"
              role="region"
              aria-live="assertive"
              aria-labelledby="prescription-row-removal-title"
              aria-describedby="prescription-row-removal-description"
            >
              <h4 id="prescription-row-removal-title">RP行を削除しますか</h4>
              <p id="prescription-row-removal-description">
                患者: {patient.name}。RP{pendingRemovalIndex + 1}（
                {pendingRemovalRow.drug.trim() || "薬剤名未入力"}
                ）を削除します。未保存内容は元に戻せません。
              </p>
              <div className="prescription-reset-actions">
                <button
                  type="button"
                  onClick={() => setPendingRemovalRowId(null)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  data-kind="danger"
                  onClick={confirmRowRemoval}
                >
                  確認して削除
                </button>
              </div>
            </section>
          ) : null}

          <div className="prescription-meta-grid">
            <label>
              処方区分
              <select
                value={draft.prescriptionType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateDraft((current) => ({
                    ...current,
                    prescriptionType: event.target.value,
                  }))
                }
              >
                <option value="">未選択</option>
                <option value="外来">外来</option>
                <option value="在宅">在宅</option>
              </select>
            </label>
            <label>
              処方日
              <input
                type="date"
                value={draft.prescriptionDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDraft((current) => ({
                    ...current,
                    prescriptionDate: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              交付日数
              <input
                type="number"
                min="1"
                value={draft.defaultDays}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDraft((current) => ({
                    ...current,
                    defaultDays: event.target.value,
                  }))
                }
                placeholder="未入力"
              />
            </label>
          </div>

          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="処方入力表。横方向にスクロールできます"
          >
            <table className="operator-table prescription-draft-table">
              <caption className="visually-hidden">
                選択患者の未保存処方入力行
              </caption>
              <thead>
                <tr>
                  <th scope="col">RP</th>
                  <th scope="col">薬剤名・規格</th>
                  <th scope="col">用法・用量</th>
                  <th scope="col">日数</th>
                  <th scope="col">数量</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 薬剤名`}
                        value={row.drug}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "drug", event.target.value)
                        }
                        placeholder="薬剤名を入力（未保存）"
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 用法用量`}
                        value={row.usage}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "usage", event.target.value)
                        }
                        placeholder="用法・用量"
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 日数`}
                        value={row.days}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "days", event.target.value)
                        }
                        inputMode="numeric"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 数量`}
                        value={row.quantity}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "quantity", event.target.value)
                        }
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => requestRowRemoval(row.id)}
                        aria-label={`RP${index + 1}の削除を確認`}
                        disabled={
                          draft.rows.length === 1 && isDraftRowEmpty(row)
                        }
                        title={
                          draft.rows.length === 1 && isDraftRowEmpty(row)
                            ? "空の最終行は削除できません"
                            : "患者とRP内容を確認後に削除します"
                        }
                      >
                        削除確認
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="prescription-options">
            <legend>全体指示・コメント</legend>
            {PRESCRIPTION_OPTIONS.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={draft.options.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                {option}
              </label>
            ))}
          </fieldset>

          <label className="prescription-note-label">
            メモ（薬剤師メモ・特記事項）
            <textarea
              rows={4}
              value={draft.note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="同じタブ内だけに保持されます"
            />
          </label>

          <div className="prescription-actions" aria-label="未接続の処方操作">
            <PrototypeAction reason="処方保存API・監査証跡が未接続です">
              処方を保存
            </PrototypeAction>
            <PrototypeAction
              kind="primary"
              reason="算定エンジンと根拠トレースが未接続です"
            >
              算定プレビュー
            </PrototypeAction>
          </div>
        </Panel>

        <aside
          className="prescription-safety-rail"
          aria-label="患者コンテキストと安全情報"
        >
          <RailCard title="患者コンテキスト & 安全" tone="warning">
            <div className="patient-safety-summary">
              <strong>{patient.name}</strong>
              <span>{patient.kana}</span>
              <span>生年月日 {patient.birthDate}</span>
              <DomainStatusBadge
                query={{
                  domain: "eligibility",
                  key: patient.eligibilityStatus,
                }}
              />
            </div>
            <SeverityList
              items={[
                {
                  severity: "WARNING",
                  message:
                    "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です。アラートが表示されないことは安全確認済みを意味しません。必要な確認は従来手順で実施してください。",
                },
              ]}
            />
          </RailCard>
          <RailCard title="検査値" tone="warning">
            <StatusPill tone="warning">未接続</StatusPill>
            <p className="rail-muted">
              検査値が表示されないことは正常を意味しません。
            </p>
          </RailCard>
          <RailCard title="患者固有タスク">
            <p className="rail-muted">
              疑義照会、薬歴確認、次回フォローはタスクAPI接続後に表示します。合成件数は表示しません。
            </p>
          </RailCard>
          <RailCard title="エビデンス">
            <p className="rail-muted">
              ガイドライン・相互作用根拠・算定根拠は evidence_id
              接続後に表示します。
            </p>
          </RailCard>
        </aside>
      </div>
    </section>
  );
}
