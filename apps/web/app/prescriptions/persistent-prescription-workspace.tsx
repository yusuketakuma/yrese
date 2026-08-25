"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { ErrorNotice } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import type { PatientContextData } from "../components/patient-context";
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
} from "./prescription-draft";
import {
  PrescriptionDraftClientError,
  type PrescriptionDraftScope,
  createPersistedPrescriptionWorkSnapshot,
  isPersistedPrescriptionWorkSnapshot,
  loadPrescriptionDraft,
  persistentPrescriptionDraftWorkId,
  prescriptionDraftResponseToSnapshot,
  prescriptionDraftSnapshotToContent,
  prescriptionDraftSnapshotsEqual,
  savePrescriptionDraft,
} from "./prescription-draft-client";
import {
  type DraftRow,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";

type WorkspacePhase =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | {
      readonly kind: "conflict";
      readonly latestVersion: number;
      readonly serverDraft: PrescriptionDraftSnapshot;
    }
  | { readonly kind: "error"; readonly error: PrescriptionDraftClientError };

type SaveMessage =
  | { readonly tone: "success" | "warning" | "danger"; readonly text: string }
  | null;

function loadErrorNextAction(error: PrescriptionDraftClientError): string {
  if (error.kind === "PERMISSION_DENIED") {
    return "管理者に prescription:read / reception:read / patient:read の付与状況を確認してください。";
  }
  if (error.kind === "INVALID_REQUEST") {
    return "受付画面へ戻り、対象受付から処方入力を開き直してください。";
  }
  if (error.kind === "INVALID_RESPONSE") {
    return "再取得してください。継続する場合はAPI契約と同期状態を確認してください。";
  }
  return "再取得してください。解消しない場合は同期状態画面でAPI稼働状態を確認してください。";
}

function saveDispositionLabel(disposition: string): string {
  if (disposition === "created") return "新規保存";
  if (disposition === "updated") return "更新保存";
  if (disposition === "unchanged") return "変更なし";
  if (disposition === "replayed") return "再送収束";
  return "保存";
}

export function PersistentPrescriptionWorkspace({
  patient,
  scope,
}: {
  readonly patient: PatientContextData;
  readonly scope: PrescriptionDraftScope;
}) {
  const unsavedWork = useOptionalUnsavedWork();
  const getWorkSnapshot = unsavedWork?.getWorkSnapshot;
  const upsertWork = unsavedWork?.upsertWork;
  const removeWork = unsavedWork?.removeWork;
  const workId = persistentPrescriptionDraftWorkId(
    patient.patientId,
    scope.receptionId,
  );

  const [initial] = useState(() => {
    const candidate = getWorkSnapshot?.<unknown>(workId);
    const restored = isPersistedPrescriptionWorkSnapshot(candidate)
      ? candidate
      : undefined;
    return {
      restored,
      draft:
        restored === undefined
          ? createBlankPrescriptionDraft()
          : clonePrescriptionDraft(restored.draft),
      baseline:
        restored === undefined
          ? createBlankPrescriptionDraft()
          : clonePrescriptionDraft(restored.baseline),
      version: restored?.baseVersion ?? 0,
    };
  });

  const [draft, setDraft] = useState<PrescriptionDraftSnapshot>(initial.draft);
  const [baseline, setBaseline] =
    useState<PrescriptionDraftSnapshot>(initial.baseline);
  const [serverVersion, setServerVersion] = useState(initial.version);
  const [phase, setPhase] = useState<WorkspacePhase>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage>(null);
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(
    initial.restored !== undefined,
  );
  const [resetRequested, setResetRequested] = useState(false);
  const [pendingRemovalRowId, setPendingRemovalRowId] = useState<number | null>(
    null,
  );
  const [discardServerRequested, setDiscardServerRequested] = useState(false);
  const restoredResolvedRef = useRef(false);

  const scopeMatchesPatient = scope.patientId === patient.patientId;
  const dirty = useMemo(
    () => !prescriptionDraftSnapshotsEqual(draft, baseline),
    [baseline, draft],
  );

  useEffect(() => {
    if (!scopeMatchesPatient) {
      setPhase({
        kind: "error",
        error: new PrescriptionDraftClientError(
          "NOT_FOUND",
          "選択患者と処方下書きの患者文脈が一致しません。",
        ),
      });
      return;
    }

    const controller = new AbortController();
    let current = true;
    setPhase({ kind: "loading" });
    setSaveMessage(null);

    void loadPrescriptionDraft(scope, fetch, controller.signal).then(
      (response) => {
        if (!current) return;
        const serverDraft =
          response === null
            ? createBlankPrescriptionDraft()
            : prescriptionDraftResponseToSnapshot(response);
        const latestVersion = response?.version ?? 0;
        const restored = initial.restored;

        if (
          restored !== undefined &&
          !restoredResolvedRef.current &&
          restored.receptionId === scope.receptionId &&
          restored.patientId === scope.patientId &&
          restored.businessDate === scope.businessDate
        ) {
          restoredResolvedRef.current = true;
          if (
            restored.baseVersion === latestVersion &&
            prescriptionDraftSnapshotsEqual(restored.baseline, serverDraft)
          ) {
            setBaseline(serverDraft);
            setServerVersion(latestVersion);
            setPhase({ kind: "ready" });
            return;
          }
          if (
            prescriptionDraftSnapshotsEqual(restored.draft, restored.baseline)
          ) {
            setDraft(serverDraft);
            setBaseline(serverDraft);
            setServerVersion(latestVersion);
            setPhase({ kind: "ready" });
            removeWork?.(workId);
            return;
          }
          setPhase({
            kind: "conflict",
            latestVersion,
            serverDraft,
          });
          return;
        }

        restoredResolvedRef.current = true;
        setDraft(serverDraft);
        setBaseline(serverDraft);
        setServerVersion(latestVersion);
        setPhase({ kind: "ready" });
        removeWork?.(workId);
      },
      (error: unknown) => {
        if (!current || controller.signal.aborted) return;
        setPhase({
          kind: "error",
          error:
            error instanceof PrescriptionDraftClientError
              ? error
              : new PrescriptionDraftClientError(
                  "UNAVAILABLE",
                  "処方下書きを取得できませんでした。",
                ),
        });
      },
    );

    return () => {
      current = false;
      controller.abort();
    };
  }, [
    initial.restored,
    reloadKey,
    removeWork,
    scope,
    scopeMatchesPatient,
    workId,
  ]);

  useEffect(() => {
    if (upsertWork === undefined || removeWork === undefined) return;
    if (phase.kind === "loading" || phase.kind === "error") return;
    if (!dirty) {
      removeWork(workId);
      return;
    }
    upsertWork({
      id: workId,
      kind: "prescription-draft",
      label: "処方下書き（サーバー未保存）",
      href: "/prescriptions",
      patientId: patient.patientId,
      snapshot: createPersistedPrescriptionWorkSnapshot(
        scope,
        serverVersion,
        baseline,
        draft,
      ),
    });
  }, [
    baseline,
    dirty,
    draft,
    patient.patientId,
    phase.kind,
    removeWork,
    scope,
    serverVersion,
    upsertWork,
    workId,
  ]);

  function updateDraft(
    update: (current: PrescriptionDraftSnapshot) => PrescriptionDraftSnapshot,
  ) {
    setDraft((current) => update(current));
    setResetRequested(false);
    setPendingRemovalRowId(null);
    setDiscardServerRequested(false);
    setSaveMessage(null);
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

  function confirmRowRemoval() {
    if (pendingRemovalRowId === null) return;
    updateDraft((current) => ({
      ...current,
      rows: removeDraftRow(current.rows, pendingRemovalRowId),
    }));
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
    setResetRequested(false);
    setPendingRemovalRowId(null);
    setRestoredNoticeVisible(false);
    setSaveMessage(null);
  }

  async function reloadLatestAfterConflict() {
    const response = await loadPrescriptionDraft(scope);
    return {
      version: response?.version ?? 0,
      draft:
        response === null
          ? createBlankPrescriptionDraft()
          : prescriptionDraftResponseToSnapshot(response),
    };
  }

  async function handleSave() {
    if (phase.kind !== "ready" || !dirty || saving) return;
    const converted = prescriptionDraftSnapshotToContent(draft);
    if (!converted.ok) {
      setSaveMessage({ tone: "danger", text: converted.message });
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await savePrescriptionDraft(
        scope,
        serverVersion,
        converted.value,
      );
      const savedDraft = prescriptionDraftResponseToSnapshot(response);
      setDraft(savedDraft);
      setBaseline(savedDraft);
      setServerVersion(response.version);
      setPhase({ kind: "ready" });
      setRestoredNoticeVisible(false);
      removeWork?.(workId);
      setSaveMessage({
        tone: "success",
        text: `${saveDispositionLabel(response.saveDisposition)}が完了しました（サーバー版 v${response.version}）。`,
      });
    } catch (error) {
      if (
        error instanceof PrescriptionDraftClientError &&
        error.kind === "CONFLICT"
      ) {
        try {
          const latest = await reloadLatestAfterConflict();
          setPhase({
            kind: "conflict",
            latestVersion: latest.version,
            serverDraft: latest.draft,
          });
          setSaveMessage({
            tone: "warning",
            text: "別の端末またはタブの更新を検出したため、保存を停止しました。",
          });
        } catch {
          setSaveMessage({
            tone: "danger",
            text: "競合後の最新版を取得できませんでした。再取得してください。",
          });
        }
      } else {
        setSaveMessage({
          tone: "danger",
          text:
            error instanceof PrescriptionDraftClientError
              ? error.message
              : "処方下書きを保存できませんでした。",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  if (phase.kind === "loading") {
    return (
      <section aria-label="処方下書きを読込中" aria-busy="true">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="受付・患者・業務日に紐づくサーバー下書きを確認しています。"
          meta={<StatusPill tone="info">下書きを読込中</StatusPill>}
        />
        <LoadingState label="処方下書きを取得中…" />
      </section>
    );
  }

  if (phase.kind === "error") {
    return (
      <section aria-label="処方下書き読込エラー">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="下書きの取得と権限確認が完了するまで入力を開始しません。"
          meta={<StatusPill tone="danger">読込失敗・編集不可</StatusPill>}
        />
        <ErrorNotice
          severity="ERROR"
          message={phase.error.message}
          nextAction={loadErrorNextAction(phase.error)}
        />
        <div className="operator-inline-actions">
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            再取得
          </button>
          <Link className="operator-button" href="/">
            受付画面へ戻る
          </Link>
        </div>
      </section>
    );
  }

  const nonEmptyRows = draft.rows.filter((row) => !isDraftRowEmpty(row)).length;
  const pendingRemovalIndex = draft.rows.findIndex(
    (row) => row.id === pendingRemovalRowId,
  );
  const pendingRemovalRow =
    pendingRemovalIndex >= 0 ? draft.rows[pendingRemovalIndex] : undefined;
  const conflict = phase.kind === "conflict" ? phase : null;
  const statusTone = conflict !== null ? "danger" : dirty ? "warning" : "success";
  const statusText =
    conflict !== null
      ? "競合検出・保存停止"
      : dirty
        ? `未保存変更・基準版 v${serverVersion}`
        : serverVersion === 0
          ? "新規下書き・未保存"
          : `サーバー保存済み v${serverVersion}`;

  return (
    <section
      aria-label="接続済み処方入力"
      data-patient-selected="true"
      data-persistence-connected="true"
      data-server-draft-version={serverVersion}
      data-unsaved-draft={dirty ? "true" : "false"}
    >
      <ScreenHeader
        title="処方入力ワークスペース"
        description="受付・患者・業務日を固定し、version付きサーバー下書きとして保存します。"
        meta={<StatusPill tone={statusTone}>{statusText}</StatusPill>}
      />
      <PrototypeBanner tone="warning">
        処方下書きの読込・保存と監査証跡は接続済みです。臨床アラート、算定、調剤、薬剤師確認、確定処方への昇格は未接続であり、保存済み下書きは安全確認済み・確定済みを意味しません。
      </PrototypeBanner>

      {restoredNoticeVisible ? (
        <InlineNotice title="タブ内の未保存変更を復元しました" tone="info" announce="polite">
          <p>
            復元した変更は、取得したサーバー版とのversion・内容一致を確認してから保存可能にしています。
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

      {conflict !== null ? (
        <InlineNotice title="下書きの競合を検出しました" tone="warning" announce="assertive">
          <p>
            現在の入力は基準版 v{serverVersion}、サーバー最新版は v
            {conflict.latestVersion} です。自動上書きや自動マージは行いません。
          </p>
          <div className="operator-inline-actions">
            <button
              type="button"
              onClick={() => {
                setBaseline(conflict.serverDraft);
                setServerVersion(conflict.latestVersion);
                setPhase({ kind: "ready" });
                setSaveMessage({
                  tone: "warning",
                  text: "ローカル入力を保持しました。最新版との差分を再確認してから保存してください。",
                });
              }}
            >
              ローカル入力を保持して再確認
            </button>
            <button
              type="button"
              data-kind="danger"
              onClick={() => setDiscardServerRequested(true)}
            >
              サーバー版を採用
            </button>
          </div>
          {discardServerRequested ? (
            <section
              className="prescription-reset-review"
              role="region"
              aria-live="assertive"
              aria-label="ローカル変更破棄の確認"
            >
              <p>
                患者: {patient.name}。現在の未保存変更を破棄してサーバー版 v
                {conflict.latestVersion} を表示します。この操作は元に戻せません。
              </p>
              <div className="prescription-reset-actions">
                <button
                  type="button"
                  onClick={() => setDiscardServerRequested(false)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  data-kind="danger"
                  onClick={() => {
                    setDraft(conflict.serverDraft);
                    setBaseline(conflict.serverDraft);
                    setServerVersion(conflict.latestVersion);
                    setPhase({ kind: "ready" });
                    setDiscardServerRequested(false);
                    setSaveMessage(null);
                    removeWork?.(workId);
                  }}
                >
                  確認してサーバー版を採用
                </button>
              </div>
            </section>
          ) : null}
        </InlineNotice>
      ) : null}

      {saveMessage !== null ? (
        <InlineNotice
          title={
            saveMessage.tone === "success"
              ? "下書き保存結果"
              : saveMessage.tone === "warning"
                ? "確認が必要です"
                : "保存できませんでした"
          }
          tone={saveMessage.tone === "danger" ? "danger" : saveMessage.tone}
          announce={saveMessage.tone === "danger" ? "assertive" : "polite"}
        >
          <p>{saveMessage.text}</p>
        </InlineNotice>
      ) : null}

      <div className="prescription-workbench-grid prescription-workbench-grid-safe">
        <Panel title="過去処方一覧" className="prescription-history-panel">
          <StatusPill tone="warning">患者固有API未接続</StatusPill>
          <p className="prescription-history-empty">
            この患者の過去処方は未取得です。履歴なし、安全、変更なしを意味しません。従来の薬歴確認手順を継続してください。
          </p>
        </Panel>

        <Panel
          title="処方下書き"
          description={`受付 ${scope.receptionId} / 業務日 ${scope.businessDate} / optimistic version ${serverVersion}`}
          className="prescription-editor-panel"
          actions={
            <div className="operator-inline-actions">
              <button
                type="button"
                onClick={() => {
                  setPendingRemovalRowId(null);
                  setResetRequested(true);
                }}
                disabled={!dirty || saving}
              >
                入力を消去
              </button>
              <button type="button" onClick={addRow} disabled={saving}>
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
              aria-label="処方下書き初期化の確認"
            >
              <p>
                患者: {patient.name}。入力済み {nonEmptyRows}行、選択項目
                {" "}{draft.options.length}件、メモを空欄へ戻します。次回保存まではサーバー版を変更しません。
              </p>
              <div className="prescription-reset-actions">
                <button type="button" onClick={() => setResetRequested(false)}>
                  キャンセル
                </button>
                <button type="button" data-kind="danger" onClick={confirmReset}>
                  確認して初期化
                </button>
              </div>
            </section>
          ) : null}

          {pendingRemovalRow !== undefined ? (
            <section
              className="prescription-row-removal-review"
              role="region"
              aria-live="assertive"
              aria-label="RP行削除の確認"
            >
              <p>
                患者: {patient.name}。RP{pendingRemovalIndex + 1}（
                {pendingRemovalRow.drug.trim() || "薬剤名未入力"}）を削除します。次回保存まではサーバー版を変更しません。
              </p>
              <div className="prescription-reset-actions">
                <button
                  type="button"
                  onClick={() => setPendingRemovalRowId(null)}
                >
                  キャンセル
                </button>
                <button type="button" data-kind="danger" onClick={confirmRowRemoval}>
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
                disabled={saving}
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
                disabled={saving}
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
                max="999"
                value={draft.defaultDays}
                disabled={saving}
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
            aria-label="処方下書き入力表。横方向にスクロールできます"
          >
            <table className="operator-table prescription-draft-table">
              <caption className="visually-hidden">
                選択患者のversion付き処方下書き入力行
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
                        disabled={saving}
                        maxLength={256}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "drug", event.target.value)
                        }
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 用法用量`}
                        value={row.usage}
                        disabled={saving}
                        maxLength={256}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "usage", event.target.value)
                        }
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 日数`}
                        value={row.days}
                        disabled={saving}
                        inputMode="numeric"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "days", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 数量`}
                        value={row.quantity}
                        disabled={saving}
                        maxLength={64}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, "quantity", event.target.value)
                        }
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={
                          saving ||
                          (draft.rows.length === 1 && isDraftRowEmpty(row))
                        }
                        onClick={() => setPendingRemovalRowId(row.id)}
                      >
                        削除確認
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="prescription-options" disabled={saving}>
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
              maxLength={2000}
              value={draft.note}
              disabled={saving}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </label>

          <div className="prescription-actions" aria-label="処方下書き操作">
            <button
              type="button"
              className="operator-button"
              data-kind="primary"
              onClick={() => void handleSave()}
              disabled={!dirty || saving || conflict !== null}
              title={
                conflict !== null
                  ? "競合解消後に保存できます"
                  : dirty
                    ? "version確認付きでサーバーへ保存"
                    : "保存する変更はありません"
              }
            >
              {saving ? "保存中…" : "下書きを保存"}
            </button>
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
          tabIndex={0}
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
                    "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です。下書き保存成功は安全確認済みを意味しません。従来手順で確認してください。",
                },
              ]}
            />
          </RailCard>
          <RailCard title="保存境界" tone="info">
            <p className="rail-muted">
              受付 {scope.receptionId} / 業務日 {scope.businessDate} / 基準version {serverVersion}。tenant・薬局・患者・受付はサーバー側で再検証されます。
            </p>
          </RailCard>
          <RailCard title="検査値" tone="warning">
            <StatusPill tone="warning">未接続</StatusPill>
            <p className="rail-muted">
              検査値が表示されないことは正常を意味しません。
            </p>
          </RailCard>
          <RailCard title="エビデンス">
            <p className="rail-muted">
              ガイドライン、相互作用、算定根拠はevidence接続後に表示します。
            </p>
          </RailCard>
        </aside>
      </div>
    </section>
  );
}
