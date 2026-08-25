"use client";

import Link from "next/link";
import { type ChangeEvent, useMemo, useState } from "react";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import {
  type PatientContextData,
  useOptionalPatientContext,
} from "../components/patient-context";
import {
  InlineNotice,
  Panel,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { SeverityList } from "../components/severity-list";

export interface DraftRow {
  readonly id: number;
  readonly drug: string;
  readonly usage: string;
  readonly days: string;
  readonly quantity: string;
}

export interface PastPrescriptionRow {
  readonly drug: string;
  readonly usage: string;
  readonly days: string;
  readonly quantity: string;
}

export interface PastPrescription {
  readonly date: string;
  readonly rows: readonly PastPrescriptionRow[];
}

export interface PrescriptionReplacementSummary {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly unchanged: number;
}

const INITIAL_ROWS: readonly DraftRow[] = [
  { id: 1, drug: "アムロジピンOD錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
  { id: 2, drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
  { id: 3, drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
];

export const PAST_PRESCRIPTIONS: readonly PastPrescription[] = [
  {
    date: "2026/08/24",
    rows: [
      { drug: "アムロジピンOD錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
    ],
  },
  {
    date: "2026/07/27",
    rows: [
      { drug: "アムロジピン錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
    ],
  },
  {
    date: "2026/06/28",
    rows: [
      { drug: "アムロジピン錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
      { drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
    ],
  },
  {
    date: "2026/05/27",
    rows: [
      { drug: "アムロジピン錠5mg", usage: "1日1回 朝食後", days: "14", quantity: "14錠" },
      { drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "14", quantity: "14錠" },
    ],
  },
] as const;

function normalizedText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function rowSignature(row: Pick<DraftRow, "usage" | "days" | "quantity">): string {
  return [row.usage, row.days, row.quantity].map(normalizedText).join("|");
}

export function pastPrescriptionDurationLabel(item: PastPrescription): string {
  const durations = new Set(item.rows.map((row) => row.days.trim()).filter(Boolean));
  if (durations.size === 0) return "日数不明";
  if (durations.size > 1) return "日数混在";
  const duration = durations.values().next().value;
  return duration === undefined ? "日数不明" : `${duration}日分`;
}

export function buildDraftRowsFromPastPrescription(
  item: PastPrescription,
): DraftRow[] {
  return item.rows.map((row, index) => ({
    id: index + 1,
    ...row,
  }));
}

export function filterPastPrescriptions(
  items: readonly PastPrescription[],
  query: string,
): PastPrescription[] {
  const normalizedQuery = normalizedText(query);
  if (!normalizedQuery) return [...items];

  return items.filter((item) =>
    normalizedText(
      [
        item.date,
        ...item.rows.flatMap((row) => [
          row.drug,
          row.usage,
          `${row.days}日`,
          row.quantity,
        ]),
      ].join(" "),
    ).includes(normalizedQuery),
  );
}

export function summarizePrescriptionReplacement(
  currentRows: readonly DraftRow[],
  pastPrescription: PastPrescription,
): PrescriptionReplacementSummary {
  const currentByDrug = new Map(
    currentRows
      .filter((row) => normalizedText(row.drug).length > 0)
      .map((row) => [normalizedText(row.drug), row] as const),
  );
  const pastByDrug = new Map(
    pastPrescription.rows.map((row) => [normalizedText(row.drug), row] as const),
  );
  const sharedDrugs = [...pastByDrug.keys()].filter((drug) => currentByDrug.has(drug));
  const changed = sharedDrugs.filter(
    (drug) => rowSignature(currentByDrug.get(drug)!) !== rowSignature(pastByDrug.get(drug)!),
  ).length;

  return {
    added: [...pastByDrug.keys()].filter((drug) => !currentByDrug.has(drug)).length,
    removed: [...currentByDrug.keys()].filter((drug) => !pastByDrug.has(drug)).length,
    changed,
    unchanged: sharedDrugs.length - changed,
  };
}

export function PrescriptionWorkspace() {
  const context = useOptionalPatientContext();
  const patient = context?.patient ?? null;

  if (patient === null) {
    return (
      <section aria-label="処方入力(患者未選択)">
        <EmptyState message="業務対象の患者が選択されていません" />
        <p>
          <Link href="/patients">患者検索</Link>
          で患者を選択すると、処方入力を開始できます（患者取り違え防止のため、患者未選択での入力開始はできません）。
        </p>
        <p className="placeholder-note">
          処方データ・臨床判定・算定APIは未接続です。表示される入力例は合成データで保存されません。
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
  const [rows, setRows] = useState<DraftRow[]>([...INITIAL_ROWS]);
  const [pastSearch, setPastSearch] = useState("");
  const [pendingPastPrescription, setPendingPastPrescription] =
    useState<PastPrescription | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const visiblePastPrescriptions = useMemo(
    () => filterPastPrescriptions(PAST_PRESCRIPTIONS, pastSearch),
    [pastSearch],
  );
  const replacementSummary = useMemo(
    () =>
      pendingPastPrescription === null
        ? null
        : summarizePrescriptionReplacement(rows, pendingPastPrescription),
    [pendingPastPrescription, rows],
  );

  function invalidateDerivedPreview() {
    setPendingPastPrescription(null);
    setPreviewVisible(false);
    setSavedNotice(null);
  }

  function updateRow(id: number, field: keyof Omit<DraftRow, "id">, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    invalidateDerivedPreview();
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: Math.max(0, ...current.map((row) => row.id)) + 1,
        drug: "",
        usage: "",
        days: "",
        quantity: "",
      },
    ]);
    invalidateDerivedPreview();
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
    invalidateDerivedPreview();
  }

  function resetDraft() {
    setRows([...INITIAL_ROWS]);
    invalidateDerivedPreview();
  }

  function updatePastSearch(value: string) {
    setPastSearch(value);
    setPendingPastPrescription(null);
  }

  function requestPastPrescription(item: PastPrescription) {
    setPendingPastPrescription(item);
    setPreviewVisible(false);
    setSavedNotice(null);
  }

  function confirmPastPrescription() {
    if (pendingPastPrescription === null) return;
    const item = pendingPastPrescription;
    setRows(buildDraftRowsFromPastPrescription(item));
    setPendingPastPrescription(null);
    setPreviewVisible(false);
    setSavedNotice(
      `${item.date}の過去処方（合成例）を確認後に入力欄へ反映しました。永続保存はしていません。`,
    );
  }

  return (
    <section
      aria-label="処方入力"
      data-patient-selected="true"
      data-patient-id={patient.patientId}
    >
      <ScreenHeader
        title="処方入力ワークスペース"
        description="過去処方を左側に固定し、現在の入力と安全情報を同時に比較できる構成です。"
        meta={<StatusPill tone="warning">保存API未接続</StatusPill>}
      />
      <PrototypeBanner>
        合成処方データによる入力UIです。保存・疑義照会・臨床判定・算定・印刷は実行されません。
      </PrototypeBanner>

      <div className="prescription-workbench-grid">
        <Panel title="過去処方一覧（直近6か月）" className="prescription-history-panel">
          <label className="visually-hidden" htmlFor="past-prescription-search">
            過去処方を検索
          </label>
          <input
            id="past-prescription-search"
            className="operator-input"
            type="search"
            value={pastSearch}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updatePastSearch(event.target.value)}
            placeholder="日付・薬剤名・日数で検索"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="queue-last-updated" aria-live="polite">
            表示 {visiblePastPrescriptions.length}件 / 合成例 {PAST_PRESCRIPTIONS.length}件
          </p>
          <div className="prescription-history-list">
            {visiblePastPrescriptions.length > 0 ? (
              visiblePastPrescriptions.map((item) => {
                const selected = pendingPastPrescription?.date === item.date;
                return (
                  <article
                    className="prescription-history-card"
                    data-selected={selected ? "true" : "false"}
                    key={item.date}
                  >
                    <header>
                      <strong>{item.date}</strong>
                      <span>{pastPrescriptionDurationLabel(item)}</span>
                    </header>
                    <StatusPill tone="neutral">合成例</StatusPill>
                    <ol>
                      {item.rows.map((row, index) => (
                        <li key={`${row.drug}-${index}`}>
                          <strong>{row.drug}</strong>
                          <span>{row.usage}・{row.days}日・{row.quantity}</span>
                        </li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => requestPastPrescription(item)}
                    >
                      {selected ? "差分を確認中" : "差分を確認"}
                    </button>
                  </article>
                );
              })
            ) : (
              <p className="prescription-history-empty">
                条件に一致する過去処方はありません。検索語を短くしてください。
              </p>
            )}
          </div>
          <button
            className="operator-text-action"
            type="button"
            disabled
            title="過去処方API未接続"
          >
            もっと見る（未接続）
          </button>
        </Panel>

        <Panel
          title="処方入力"
          description="入力はブラウザ内の一時状態だけに反映されます。"
          className="prescription-editor-panel"
          actions={
            <div className="operator-inline-actions">
              <button type="button" onClick={resetDraft}>
                初期化
              </button>
              <button type="button" onClick={addRow}>
                RP行を追加
              </button>
            </div>
          }
        >
          {pendingPastPrescription !== null && replacementSummary !== null ? (
            <section
              className="prescription-replacement-review"
              aria-labelledby="prescription-replacement-title"
              aria-live="polite"
            >
              <h4 id="prescription-replacement-title">過去処方の反映確認</h4>
              <p>
                患者: {patient.name}。{pendingPastPrescription.date}（
                {pastPrescriptionDurationLabel(pendingPastPrescription)}）の構成で、現在の
                {rows.length}行を置き換えます。薬剤名・用法・日数・数量を比較し、まだ入力欄には反映していません。
              </p>
              <dl className="prescription-replacement-summary">
                <div><dt>追加</dt><dd>{replacementSummary.added}剤</dd></div>
                <div><dt>削除</dt><dd>{replacementSummary.removed}剤</dd></div>
                <div><dt>内容変更</dt><dd>{replacementSummary.changed}剤</dd></div>
                <div><dt>同一</dt><dd>{replacementSummary.unchanged}剤</dd></div>
              </dl>
              <div className="prescription-replacement-actions">
                <button type="button" onClick={() => setPendingPastPrescription(null)}>
                  キャンセル
                </button>
                <button type="button" data-kind="primary" onClick={confirmPastPrescription}>
                  確認して反映
                </button>
              </div>
            </section>
          ) : null}

          <div className="prescription-meta-grid">
            <label>
              処方区分
              <select defaultValue="外来">
                <option>外来</option>
                <option>在宅</option>
              </select>
            </label>
            <label>
              処方日
              <input type="date" defaultValue="2026-08-24" />
            </label>
            <label>
              交付日数
              <input type="number" min="1" defaultValue="7" />
            </label>
          </div>

          <div className="table-scroll">
            <table className="operator-table prescription-draft-table">
              <caption className="visually-hidden">処方入力行</caption>
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
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 薬剤名`}
                        value={row.drug}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "drug", event.target.value)
                        }
                        placeholder="薬剤名を検索"
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
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label={`RP${index + 1}を削除`}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="prescription-options">
            <legend>全体指示・コメント</legend>
            <label><input type="checkbox" /> 一包化</label>
            <label><input type="checkbox" /> 在宅</label>
            <label><input type="checkbox" /> 麻薬</label>
            <label><input type="checkbox" /> 向精神薬</label>
            <label><input type="checkbox" /> 残薬調整</label>
          </fieldset>
          <label className="prescription-note-label">
            メモ（薬剤師メモ・特記事項）
            <textarea rows={4} placeholder="保存されないUI入力例です" />
          </label>

          {savedNotice !== null ? (
            <InlineNotice title="一時状態" tone="info">
              <p>{savedNotice}</p>
            </InlineNotice>
          ) : null}

          {previewVisible ? (
            <InlineNotice title="算定プレビュー" tone="warning">
              <p>
                算定エンジンは未接続です。入力行は {rows.length} 行ですが、点数・患者負担額・請求可否は計算していません。
              </p>
            </InlineNotice>
          ) : null}

          <div className="prescription-actions">
            <button
              type="button"
              className="operator-button"
              data-kind="secondary"
              onClick={() =>
                setSavedNotice(
                  "ブラウザ内の一時状態を更新しました。サーバーには保存していません。",
                )
              }
            >
              一時保存（ブラウザ内）
            </button>
            <button
              type="button"
              className="operator-button"
              data-kind="primary"
              onClick={() => setPreviewVisible(true)}
            >
              算定プレビュー
            </button>
          </div>
        </Panel>

        <aside className="prescription-safety-rail" aria-label="患者コンテキストと安全情報">
          <RailCard title="患者コンテキスト & 安全" tone="danger">
            <div className="patient-safety-summary">
              <strong>{patient.name}</strong>
              <span>{patient.kana}</span>
              <span>
                生年月日 {patient.birthDate}
              </span>
              <DomainStatusBadge
                query={{ domain: "eligibility", key: patient.eligibilityStatus }}
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
          <RailCard title="検査値（直近3件）" tone="warning">
            <StatusPill tone="warning">未接続</StatusPill>
            <p className="rail-muted">検査値が表示されないことは正常を意味しません。</p>
          </RailCard>
          <RailCard title="タスク">
            <ul className="rail-action-list">
              <li>疑義照会：未送信 1件（合成例）</li>
              <li>薬歴確認：未接続</li>
              <li>次回フォロー：未接続</li>
            </ul>
          </RailCard>
          <RailCard title="エビデンス">
            <p className="rail-muted">
              ガイドライン・相互作用根拠・算定根拠は evidence_id 接続後に表示します。
            </p>
          </RailCard>
        </aside>
      </div>
    </section>
  );
}
