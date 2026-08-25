"use client";

import Link from "next/link";
import { type ChangeEvent, useState } from "react";

import { EmptyState } from "../components/empty-state";
import { useOptionalPatientContext } from "../components/patient-context";
import {
  InlineNotice,
  Panel,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { SeverityList } from "../components/severity-list";

interface DraftRow {
  readonly id: number;
  readonly drug: string;
  readonly usage: string;
  readonly days: string;
  readonly quantity: string;
}

const INITIAL_ROWS: readonly DraftRow[] = [
  { id: 1, drug: "アムロジピンOD錠5mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
  { id: 2, drug: "ロサルタンK錠50mg", usage: "1日1回 朝食後", days: "7", quantity: "7錠" },
  { id: 3, drug: "トラゾドン錠25mg", usage: "1日1回 就寝前", days: "7", quantity: "7錠" },
];

const PAST_PRESCRIPTIONS = [
  { date: "2025/08/24", days: "7日分", drugs: ["アムロジピンOD錠5mg", "ロサルタンK錠50mg", "トラゾドン錠25mg"] },
  { date: "2025/07/27", days: "7日分", drugs: ["アムロジピン錠5mg", "ロサルタンK錠50mg", "トラゾドン錠25mg"] },
  { date: "2025/06/28", days: "7日分", drugs: ["アムロジピン錠5mg", "ロサルタンK錠50mg", "トラゾドン錠25mg"] },
  { date: "2025/05/27", days: "14日分", drugs: ["アムロジピン錠5mg", "ロサルタンK錠50mg"] },
] as const;

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

  return <SelectedPatientWorkspaceView />;
}

export function SelectedPatientWorkspaceView() {
  const [rows, setRows] = useState<DraftRow[]>([...INITIAL_ROWS]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  function updateRow(id: number, field: keyof Omit<DraftRow, "id">, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: Math.max(0, ...current.map((row) => row.id)) + 1, drug: "", usage: "", days: "", quantity: "" },
    ]);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
    setPreviewVisible(false);
    setSavedNotice(null);
  }

  function applyPastPrescription(item: (typeof PAST_PRESCRIPTIONS)[number]) {
    setRows(
      item.drugs.map((drug, index) => ({
        id: index + 1,
        drug,
        usage: drug.includes("トラゾドン") ? "1日1回 就寝前" : "1日1回 朝食後",
        days: item.days.replace("日分", ""),
        quantity: `${item.days.replace("日分", "")}錠`,
      })),
    );
    setPreviewVisible(false);
    setSavedNotice("過去処方の合成例を入力欄へ反映しました。永続保存はしていません。");
  }

  return (
    <section aria-label="処方入力" data-patient-selected="true">
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
            placeholder="薬剤名で検索"
          />
          <div className="prescription-history-list">
            {PAST_PRESCRIPTIONS.map((item) => (
              <article className="prescription-history-card" key={item.date}>
                <header>
                  <strong>{item.date}</strong>
                  <span>{item.days}</span>
                </header>
                <StatusPill tone="neutral">合成例</StatusPill>
                <ol>
                  {item.drugs.map((drug) => (
                    <li key={drug}>{drug}</li>
                  ))}
                </ol>
                <button type="button" onClick={() => applyPastPrescription(item)}>
                  この構成を入力欄へ反映
                </button>
              </article>
            ))}
          </div>
          <button className="operator-text-action" type="button" disabled title="過去処方API未接続">
            もっと見る（未接続）
          </button>
        </Panel>

        <Panel
          title="処方入力"
          description="入力はブラウザ内の一時状態だけに反映されます。"
          className="prescription-editor-panel"
          actions={
            <div className="operator-inline-actions">
              <button type="button" onClick={() => { setRows([...INITIAL_ROWS]); setPreviewVisible(false); setSavedNotice(null); }}>初期化</button>
              <button type="button" onClick={addRow}>RP行を追加</button>
            </div>
          }
        >
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
              <input type="date" defaultValue="2025-08-24" />
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
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(row.id, "drug", event.target.value)}
                        placeholder="薬剤名を検索"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 用法用量`}
                        value={row.usage}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(row.id, "usage", event.target.value)}
                        placeholder="用法・用量"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 日数`}
                        value={row.days}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(row.id, "days", event.target.value)}
                        inputMode="numeric"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 数量`}
                        value={row.quantity}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(row.id, "quantity", event.target.value)}
                      />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeRow(row.id)} aria-label={`RP${index + 1}を削除`}>
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
            <button type="button" className="operator-button" data-kind="secondary" onClick={() => setSavedNotice("ブラウザ内の一時状態を更新しました。サーバーには保存していません。")}>
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
