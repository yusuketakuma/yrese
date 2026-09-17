"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ClinicalAlert } from "../components/clinical-alert";
import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import {
  type PatientContextData,
  useOptionalPatientContext,
} from "../components/patient-context";
import {
  InlineNotice,
  KeyValueList,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
  TableScroll,
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
  FLAG_FROM_WIRE,
  PrescriptionDraftApiError,
  applyMasterLabels,
  collectResolvedMasterIds,
  fromPrescriptionDraftResponse,
  loadPrescriptionDraft,
  prescriptionDraftSnapshotsEqual,
  rpItemToDraftRow,
  savePrescriptionDraft,
  sortDraftFlagsCanonically,
  toPrescriptionDraftContent,
} from "./prescription-draft-persistence";
import {
  PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH,
  PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH,
  prescriptionDraftUnresolvedCounts,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
} from "@yrese/contracts";
import {
  MasterCodePicker,
  type MasterCodeSelection,
} from "../masters/master-code-picker";
import { resolveMasterItemLabels } from "../masters/master-lookup";
import { useOptionalPrescriptionOrigin } from "./prescription-origin-context";
import {
  type DraftRow,
  createBlankDraftRow,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";

type DraftLoadState =
  | { readonly kind: "unlinked" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly error: PrescriptionDraftApiError };

type DraftSaveDisposition = PrescriptionDraftSaveResponse["saveDisposition"];

type DraftSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | {
      readonly kind: "saved";
      readonly disposition: DraftSaveDisposition;
    }
  | { readonly kind: "conflict" }
  | { readonly kind: "error"; readonly error: PrescriptionDraftApiError };

type PrescriptionDraftChangeKind =
  | "server-changed-while-away"
  | "save-conflict";

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function normalizedDraftForComparison(
  snapshot: PrescriptionDraftSnapshot,
): PrescriptionDraftSnapshot {
  const content = toPrescriptionDraftContent(snapshot);
  const sourceMetadata = content.sourceMetadata;
  return {
    // 保存 materialize と同じ正規化を比較にも使い、trim/重複差で
    // dirty が誤発火しないようにする。
    prescriptionType: content.prescriptionType,
    prescriptionDate: content.prescriptionDate ?? "",
    defaultDays:
      content.defaultDays === null ? "" : String(content.defaultDays),
    options: sortDraftFlagsCanonically(content.flags).map(
      (flag) => FLAG_FROM_WIRE[flag],
    ),
    note: content.note,
    institutionCode: sourceMetadata?.medicalInstitution.code ?? "",
    institutionName: sourceMetadata?.medicalInstitution.name ?? "",
    prescriberName: sourceMetadata?.prescriberName ?? "",
    issueDate: sourceMetadata?.issueDate ?? "",
    validUntil: sourceMetadata?.validUntil ?? "",
    refillTotal:
      sourceMetadata?.refill === null || sourceMetadata?.refill === undefined
        ? ""
        : String(sourceMetadata.refill.total),
    refillRemaining:
      sourceMetadata?.refill === null || sourceMetadata?.refill === undefined
        ? ""
        : String(sourceMetadata.refill.remaining),
    splitDispensing: sourceMetadata?.splitDispensing ?? "",
    rows: content.rpGroups.flatMap((group) =>
      group.items.map((item, index) =>
        rpItemToDraftRow(group, item, (group.sequence - 1) * 1000 + index + 1),
      ),
    ),
  };
}

/** DOM-002 §4.2a: 発行日+4日の既定は UI 側の入力補助。保存値は入力値そのもの。 */
export function defaultValidUntil(issueDate: string): string | null {
  const trimmed = issueDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return null;
  const instant = new Date(`${trimmed}T00:00:00.000Z`);
  // 実在暦日のみ(2026-02-30 のような rollover を拒否する — contract の calendarDate と同規則)。
  if (
    !Number.isFinite(instant.getTime()) ||
    instant.toISOString().slice(0, 10) !== trimmed
  ) {
    return null;
  }
  instant.setUTCDate(instant.getUTCDate() + 4);
  return instant.toISOString().slice(0, 10);
}

/** DOM-002 §4.2a: 有効期限超過(asOf > validUntil)は警告のみ。 */
export function isPrescriptionSourceExpired(
  validUntil: string,
  businessDate: string,
): boolean {
  const until = validUntil.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(until)) return false;
  return businessDate > until;
}

export function serverDraftDivergenceCopy(serverVersion: number) {
  if (serverVersion === 0) {
    return {
      noticeTitle: "サーバー側に下書きがありません",
      currentBaseline: "今回確認したサーバー状態（下書きなし）",
      restoredBaseline: "今回読み込んだサーバー状態（下書きなし）",
      conflictBaseline: "最後に読み込んだサーバー状態（下書きなし）",
      discardLocal: "復元した入力を破棄して下書きなしに戻す",
      keepLocal: "この入力を残して保存へ進む",
    };
  }
  return {
    noticeTitle: "サーバー保存版との差分があります",
    currentBaseline: `現在のサーバー保存版（v${serverVersion}）`,
    restoredBaseline: "今回読み込んだサーバー保存版",
    conflictBaseline: "最後に読み込んだサーバー版",
    discardLocal: "復元した入力を破棄してサーバー保存版を使う",
    keepLocal: "サーバー保存版を破棄してこの入力で上書きする",
  };
}

export function summarizePrescriptionDraftChanges(
  draft: PrescriptionDraftSnapshot,
  baseline: PrescriptionDraftSnapshot,
): readonly string[] {
  let comparedDraft = draft;
  let comparedBaseline = baseline;
  try {
    const normalizedDraft = normalizedDraftForComparison(draft);
    const normalizedBaseline = normalizedDraftForComparison(baseline);
    comparedDraft = normalizedDraft;
    comparedBaseline = normalizedBaseline;
  } catch {
    // Invalid restored input still needs a non-throwing field summary.
  }

  const labels: string[] = [];
  if (comparedDraft.prescriptionType !== comparedBaseline.prescriptionType) {
    labels.push("処方区分");
  }
  if (comparedDraft.prescriptionDate !== comparedBaseline.prescriptionDate) {
    labels.push("処方日");
  }
  if (comparedDraft.defaultDays !== comparedBaseline.defaultDays) {
    labels.push("交付日数");
  }
  if (!arraysEqual(comparedDraft.options, comparedBaseline.options)) {
    labels.push("全体指示");
  }
  if (comparedDraft.note !== comparedBaseline.note) labels.push("メモ");
  if (
    comparedDraft.institutionCode !== comparedBaseline.institutionCode ||
    comparedDraft.institutionName !== comparedBaseline.institutionName
  ) {
    labels.push("医療機関");
  }
  if (comparedDraft.prescriberName !== comparedBaseline.prescriberName) {
    labels.push("医師名");
  }
  if (comparedDraft.issueDate !== comparedBaseline.issueDate) {
    labels.push("発行日");
  }
  if (comparedDraft.validUntil !== comparedBaseline.validUntil) {
    labels.push("有効期限");
  }
  if (
    comparedDraft.refillTotal !== comparedBaseline.refillTotal ||
    comparedDraft.refillRemaining !== comparedBaseline.refillRemaining
  ) {
    labels.push("リフィル回数");
  }
  if (comparedDraft.splitDispensing !== comparedBaseline.splitDispensing) {
    labels.push("分割調剤指示");
  }
  if (comparedDraft.rows.length !== comparedBaseline.rows.length) labels.push("RP行数");

  const sharedRowCount = Math.min(
    comparedDraft.rows.length,
    comparedBaseline.rows.length,
  );
  for (let index = 0; index < sharedRowCount; index += 1) {
    const current = comparedDraft.rows[index]!;
    const saved = comparedBaseline.rows[index]!;
    const prefix = `RP${index + 1}`;
    if (
      current.drug !== saved.drug ||
      current.medicationMode !== saved.medicationMode ||
      current.medicationItemId !== saved.medicationItemId
    ) {
      labels.push(`${prefix} 薬剤`);
    }
    if (
      current.usage !== saved.usage ||
      current.usageMode !== saved.usageMode ||
      current.usageItemId !== saved.usageItemId ||
      current.dosageForm !== saved.dosageForm
    ) {
      labels.push(`${prefix} 用法・剤形`);
    }
    if (current.days !== saved.days) labels.push(`${prefix} 日数・回数`);
    if (
      current.doseOnce !== saved.doseOnce ||
      current.dosePerDay !== saved.dosePerDay ||
      current.quantity !== saved.quantity ||
      current.unit !== saved.unit
    ) {
      labels.push(`${prefix} 用量`);
    }
    if (
      current.genericNamePrescription !== saved.genericNamePrescription ||
      current.genericSubstitution !== saved.genericSubstitution
    ) {
      labels.push(`${prefix} 後発品`);
    }
  }

  return labels;
}

export function PrescriptionDraftChangeSummary({
  kind,
  draft,
  baseline,
  serverVersion,
}: {
  readonly kind: PrescriptionDraftChangeKind;
  readonly draft: PrescriptionDraftSnapshot;
  readonly baseline: PrescriptionDraftSnapshot;
  readonly serverVersion: number;
}) {
  const labels = summarizePrescriptionDraftChanges(draft, baseline);
  const copy = serverDraftDivergenceCopy(serverVersion);
  return (
    <div role="group" aria-label="処方下書きの変更項目">
      <p>
        {kind === "save-conflict"
          ? `このタブの未保存入力と、${copy.conflictBaseline}の間で変更された項目です。競合相手の最新内容はまだ取得していません。`
          : `復元したタブ内入力と、${copy.restoredBaseline}の間で変更された項目です。`}
        変更値は表示しません。
      </p>
      <ul>
        {labels.length === 0 ? (
          <li>変更項目を特定できません</li>
        ) : (
          labels.map((label) => <li key={label}>{label}</li>)
        )}
      </ul>
    </div>
  );
}

function saveDispositionLabel(
  disposition: DraftSaveDisposition,
): string {
  if (disposition === "created") return "新規下書きを保存しました";
  if (disposition === "updated") return "下書きを更新しました";
  return "サーバー上の下書きは変更ありません";
}

function loadErrorNextAction(error: PrescriptionDraftApiError): string {
  if (error.kind === "PERMISSION_DENIED") {
    return "管理者に prescription:read・reception:read・patient:read の付与状況を確認してください。";
  }
  if (error.kind === "NOT_FOUND") {
    return "受付画面へ戻り、対象患者・受付・業務日を再確認してください。";
  }
  if (error.kind === "INVALID_RESPONSE") {
    return "同期状態を確認し、継続する場合はシステム管理者へ連絡してください。";
  }
  return "再取得してください。解消しない場合は同期状態を確認してください。";
}

function saveErrorNextAction(error: PrescriptionDraftApiError): string {
  if (error.kind === "PERMISSION_DENIED") {
    return "管理者に prescription:write・reception:read・patient:read の付与状況を確認してください。";
  }
  if (error.kind === "INVALID_REQUEST") {
    return "日付、日数、文字数、RP行数を確認してから再度保存してください。";
  }
  if (error.kind === "NOT_FOUND") {
    return "受付と患者の関連が変わった可能性があります。受付画面から再度開始してください。";
  }
  return "入力内容はこのタブに保持されています。同期状態を確認してから再度保存してください。";
}

export function PrescriptionWorkspace() {
  const context = useOptionalPatientContext();
  const origin = useOptionalPrescriptionOrigin()?.origin ?? null;
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
      </section>
    );
  }

  const workspaceKey = [
    patient.patientId,
    origin?.receptionId ?? "unlinked",
    origin?.businessDate ?? "unlinked",
  ].join(":");
  return (
    <SelectedPatientWorkspaceView
      key={workspaceKey}
      patient={patient}
    />
  );
}

/**
 * 行の更新。rpGroups の group 共通 field(剤形・用法・日数)は
 * 同一 rpGroupId を共有する全行へ伝播させる — サーバー上の
 * multi-item group は行へ展開されているため、非先頭行への
 * 共通 field 編集が保存時に捨てられないようにする。
 */
export function applyDraftRowPatch(
  rows: readonly DraftRow[],
  id: number,
  patch: Partial<DraftRow>,
): DraftRow[] {
  const groupKeys = [
    "dosageForm",
    "usageMode",
    "usageItemId",
    "usageItemLabel",
    "usage",
    "days",
  ] as const;
  const groupPatch: Partial<DraftRow> = {};
  for (const key of groupKeys) {
    if (key in patch) {
      Object.assign(groupPatch, { [key]: patch[key] });
    }
  }
  const touchesGroupFields = Object.keys(groupPatch).length > 0;
  const target = rows.find((row) => row.id === id);
  const propagate =
    touchesGroupFields && target !== undefined ? target.rpGroupId : null;
  return rows.map((row) => {
    if (row.id === id) return { ...row, ...patch };
    if (propagate !== null && row.rpGroupId === propagate) {
      return { ...row, ...groupPatch };
    }
    return row;
  });
}

/**
 * WP-7302 / RX-0001: 未解決(UNRESOLVED_TEXT)品目を残す draft は
 * 薬剤師確認へ進めない。未解決用法は制度上許容されるが警告対象。
 * 全行空の新規フォームと schema 不適合な入力途中は null を返す。
 */
export function prescriptionDraftUnresolvedDisplay(
  snapshot: PrescriptionDraftSnapshot,
): {
  readonly unresolvedMedicationItems: number;
  readonly unresolvedUsages: number;
} | null {
  if (snapshot.rows.every((row) => isDraftRowEmpty(row))) return null;
  try {
    return prescriptionDraftUnresolvedCounts(
      toPrescriptionDraftContent(snapshot),
    );
  } catch {
    return null;
  }
}

/**
 * resolved 参照の表示名を master API で補完する(WP-7302)。
 * 契約は ID のみ保持するため、表示名は読み込み時に解決する。
 * 解決不能(master API 障害等)でも draft 読込自体は妨げない。
 */
async function hydrateDraftMasterLabels(
  snapshot: PrescriptionDraftSnapshot,
  asOf: string,
  signal?: AbortSignal,
): Promise<PrescriptionDraftSnapshot> {
  const ids = collectResolvedMasterIds(snapshot);
  if (ids.medicationRefs.length === 0 && ids.usageItemIds.length === 0) {
    return snapshot;
  }
  try {
    const labels = await resolveMasterItemLabels(
      {
        asOf,
        medicationRefs: ids.medicationRefs,
        usageItemIds: ids.usageItemIds,
      },
      fetch,
      signal,
    );
    return applyMasterLabels(snapshot, labels);
  } catch {
    return snapshot;
  }
}

/**
 * サーバー下書き読込1回分を状態へ写像する(WP-5101 review HIGH-1/HIGH-2)。
 *
 * タブ内に復元した未保存入力があるときは、サーバー保存版で入力を置き換えない。
 * 差分がある場合は serverChangedWhileAway を立て、どちらを残すか運用者が明示的に
 * 決めるまで保存させない(サーバー側の新しい内容をワンクリックで失わせない)。
 */
export function resolveDraftLoadOutcome(
  response: PrescriptionDraftResponse | null,
  restoredDraft: PrescriptionDraftSnapshot | null,
): {
  readonly baseline: PrescriptionDraftSnapshot;
  readonly serverVersion: number;
  readonly serverUpdatedAt: string | null;
  readonly adoptServerDraft: boolean;
  readonly serverChangedWhileAway: boolean;
} {
  const baseline =
    response === null
      ? createBlankPrescriptionDraft()
      : fromPrescriptionDraftResponse(response);
  return {
    baseline,
    serverVersion: response?.version ?? 0,
    serverUpdatedAt: response?.updatedAt ?? null,
    adoptServerDraft: restoredDraft === null,
    serverChangedWhileAway:
      restoredDraft !== null &&
      !prescriptionDraftSnapshotsEqual(restoredDraft, baseline),
  };
}

/**
 * 保存可否(WP-5101 review HIGH-1)。
 *
 * 競合検出後と同じく、復元入力とサーバー保存版が食い違っている間は保存を許さない。
 * 楽観的並行制御は「読み込んだ版に対する編集」でのみ成立し、復元入力は
 * 読み込んだ版に対する編集ではないため、そのままでは上書き検出が働かない。
 */
export function canSavePrescriptionDraft(input: {
  readonly linked: boolean;
  readonly loadKind: DraftLoadState["kind"];
  readonly dirty: boolean;
  readonly saveKind: DraftSaveState["kind"];
  readonly serverChangedWhileAway: boolean;
}): boolean {
  return (
    input.linked &&
    input.loadKind === "ready" &&
    input.dirty &&
    input.saveKind !== "saving" &&
    input.saveKind !== "conflict" &&
    !input.serverChangedWhileAway
  );
}

/**
 * 保存失敗の状態写像(WP-5101 review HIGH-2)。
 *
 * CONFLICT を一般的なエラーに丸めない。競合は再試行で解決してはならず、
 * サーバー版の確認を経る必要があるため、専用状態として区別する。
 */
export function resolveSaveFailureState(error: unknown): DraftSaveState {
  const normalized =
    error instanceof PrescriptionDraftApiError
      ? error
      : new PrescriptionDraftApiError(
          "UNAVAILABLE",
          "処方下書きAPIを利用できません。",
        );
  return normalized.kind === "CONFLICT"
    ? { kind: "conflict" }
    : { kind: "error", error: normalized };
}

/**
 * 編集時の保存状態遷移。競合はサーバー版の確認(再読込)を経るまで解除しない。
 * 編集でidleへ戻すと stale expectedVersion のまま再保存でき、確認強制が
 * 形骸化する。
 */
export function resolveSaveStateAfterEdit(
  current: DraftSaveState,
): DraftSaveState {
  return current.kind === "conflict" ? current : { kind: "idle" };
}

export function SelectedPatientWorkspaceView({
  patient,
}: {
  readonly patient: PatientContextData;
}) {
  const origin = useOptionalPrescriptionOrigin()?.origin ?? null;
  const linkedOrigin =
    origin !== null && origin.patientId === patient.patientId ? origin : null;
  const unsavedWork = useOptionalUnsavedWork();
  const getWorkSnapshot = unsavedWork?.getWorkSnapshot;
  const upsertWork = unsavedWork?.upsertWork;
  const removeWork = unsavedWork?.removeWork;
  const workId = prescriptionDraftWorkId(
    patient.patientId,
    linkedOrigin?.receptionId,
    linkedOrigin?.businessDate,
  );
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
  const [baseline, setBaseline] = useState<PrescriptionDraftSnapshot>(
    createBlankPrescriptionDraft,
  );
  const [serverVersion, setServerVersion] = useState(0);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<DraftLoadState>(
    linkedOrigin === null ? { kind: "unlinked" } : { kind: "loading" },
  );
  const [saveState, setSaveState] = useState<DraftSaveState>({ kind: "idle" });
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(
    initialDraft.restored,
  );
  const [serverChangedWhileAway, setServerChangedWhileAway] = useState(false);
  const [divergenceChoiceRequested, setDivergenceChoiceRequested] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [reloadRequested, setReloadRequested] = useState(false);
  const [pendingRemovalRowId, setPendingRemovalRowId] = useState<number | null>(
    null,
  );
  const draftRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      draftRequestRef.current?.abort();
    };
  }, []);

  const dirty = useMemo(
    () =>
      linkedOrigin === null
        ? isPrescriptionDraftDirty(draft)
        : !prescriptionDraftSnapshotsEqual(draft, baseline),
    [baseline, draft, linkedOrigin],
  );

  const unresolvedCounts = useMemo(
    () => prescriptionDraftUnresolvedDisplay(draft),
    [draft],
  );

  useEffect(() => {
    if (linkedOrigin === null) {
      setLoadState({ kind: "unlinked" });
      setBaseline(createBlankPrescriptionDraft());
      setServerVersion(0);
      setServerUpdatedAt(null);
      return;
    }

    const controller = new AbortController();
    draftRequestRef.current?.abort();
    draftRequestRef.current = controller;
    let current = true;
    setLoadState({ kind: "loading" });
    setSaveState({ kind: "idle" });

    void loadPrescriptionDraft(
      {
        receptionId: linkedOrigin.receptionId,
        patientId: linkedOrigin.patientId,
        businessDate: linkedOrigin.businessDate,
      },
      fetch,
      controller.signal,
    ).then(
      async (response) => {
        if (!current) return;
        const outcome = resolveDraftLoadOutcome(
          response,
          initialDraft.restored ? initialDraft.draft : null,
        );
        const hydrated = await hydrateDraftMasterLabels(
          outcome.baseline,
          linkedOrigin.businessDate,
          controller.signal,
        );
        if (!current) return;
        setBaseline(hydrated);
        setServerVersion(outcome.serverVersion);
        setServerUpdatedAt(outcome.serverUpdatedAt);
        setServerChangedWhileAway(outcome.serverChangedWhileAway);
        setDivergenceChoiceRequested(false);
        if (outcome.adoptServerDraft) {
          setDraft(hydrated);
        }
        setLoadState({ kind: "ready" });
      },
      (error: unknown) => {
        if (!current || controller.signal.aborted) return;
        setLoadState({
          kind: "error",
          error:
            error instanceof PrescriptionDraftApiError
              ? error
              : new PrescriptionDraftApiError(
                  "UNAVAILABLE",
                  "処方下書きAPIを利用できません。",
                ),
        });
      },
    );

    return () => {
      current = false;
      controller.abort();
      if (draftRequestRef.current === controller) draftRequestRef.current = null;
    };
  }, [initialDraft, linkedOrigin]);

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
    setReloadRequested(false);
    setPendingRemovalRowId(null);
    setSaveState((current) => resolveSaveStateAfterEdit(current));
  }

  function updateRow(id: number, patch: Partial<DraftRow>) {
    updateDraft((current) => ({
      ...current,
      rows: applyDraftRowPatch(current.rows, id, patch),
    }));
  }

  /**
   * master 選択の写像。解除時は表示名も消す。選択は常に resolved
   * 参照へ変換される(契約は kind 別 union)。
   */
  function applyMasterSelection(
    rowId: number,
    target: "medication" | "usage",
    selection: MasterCodeSelection | null,
  ) {
    if (target === "medication") {
      updateRow(rowId, {
        medicationItemId: selection?.itemId ?? "",
        masterVersionId: selection?.masterVersionId ?? "",
        medicationItemLabel: selection?.label ?? "",
      });
      return;
    }
    updateRow(rowId, {
      usageItemId: selection?.itemId ?? "",
      usageItemLabel: selection?.label ?? "",
    });
  }

  function addRow() {
    updateDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        createBlankDraftRow(
          Math.max(0, ...current.rows.map((row) => row.id)) + 1,
        ),
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
    setDraft(clonePrescriptionDraft(baseline));
    setRestoredNoticeVisible(false);
    setServerChangedWhileAway(false);
    setDivergenceChoiceRequested(false);
    setResetRequested(false);
    setPendingRemovalRowId(null);
    setSaveState({ kind: "idle" });
    removeWork?.(workId);
  }

  async function saveDraft() {
    if (linkedOrigin === null || loadState.kind !== "ready" || !dirty) return;
    const submitted = clonePrescriptionDraft(draft);
    const controller = new AbortController();
    draftRequestRef.current?.abort();
    draftRequestRef.current = controller;
    setSaveState({ kind: "saving" });
    try {
      const response = await savePrescriptionDraft(
        {
          receptionId: linkedOrigin.receptionId,
          patientId: linkedOrigin.patientId,
          businessDate: linkedOrigin.businessDate,
        },
        { expectedVersion: serverVersion, snapshot: submitted },
        fetch,
        controller.signal,
      );
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      const savedDraft = await hydrateDraftMasterLabels(
        fromPrescriptionDraftResponse(response),
        linkedOrigin.businessDate,
        controller.signal,
      );
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      setDraft(savedDraft);
      setBaseline(savedDraft);
      setServerVersion(response.version);
      setServerUpdatedAt(response.updatedAt);
      setServerChangedWhileAway(false);
      setDivergenceChoiceRequested(false);
      setRestoredNoticeVisible(false);
      setSaveState({ kind: "saved", disposition: response.saveDisposition });
      removeWork?.(workId);
    } catch (error) {
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      setSaveState(resolveSaveFailureState(error));
    } finally {
      if (draftRequestRef.current === controller) draftRequestRef.current = null;
    }
  }

  async function reloadLatestServerDraft(discardLocal = false) {
    if (linkedOrigin === null) return;
    setReloadRequested(false);
    const controller = new AbortController();
    draftRequestRef.current?.abort();
    draftRequestRef.current = controller;
    setLoadState({ kind: "loading" });
    try {
      const response = await loadPrescriptionDraft(
        {
          receptionId: linkedOrigin.receptionId,
          patientId: linkedOrigin.patientId,
          businessDate: linkedOrigin.businessDate,
        },
        fetch,
        controller.signal,
      );
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      const outcome = resolveDraftLoadOutcome(
        response,
        discardLocal || !dirty ? null : draft,
      );
      const hydrated = await hydrateDraftMasterLabels(
        outcome.baseline,
        linkedOrigin.businessDate,
        controller.signal,
      );
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      setBaseline(hydrated);
      setServerVersion(outcome.serverVersion);
      setServerUpdatedAt(outcome.serverUpdatedAt);
      setServerChangedWhileAway(outcome.serverChangedWhileAway);
      setDivergenceChoiceRequested(false);
      if (outcome.adoptServerDraft) setDraft(hydrated);
      if (discardLocal) setRestoredNoticeVisible(false);
      setSaveState({ kind: "idle" });
      setLoadState({ kind: "ready" });
      if (discardLocal) removeWork?.(workId);
    } catch (error) {
      if (controller.signal.aborted || draftRequestRef.current !== controller) return;
      setLoadState({
        kind: "error",
        error:
          error instanceof PrescriptionDraftApiError
            ? error
            : new PrescriptionDraftApiError(
                "UNAVAILABLE",
                "処方下書きAPIを利用できません。",
              ),
      });
    } finally {
      if (draftRequestRef.current === controller) draftRequestRef.current = null;
    }
  }

  const nonEmptyRows = draft.rows.filter((row) => !isDraftRowEmpty(row)).length;
  const pendingRemovalIndex = draft.rows.findIndex(
    (row) => row.id === pendingRemovalRowId,
  );
  const pendingRemovalRow =
    pendingRemovalIndex >= 0 ? draft.rows[pendingRemovalIndex] : undefined;
  const editorLocked =
    loadState.kind === "loading" || saveState.kind === "saving";

  if (linkedOrigin !== null && loadState.kind === "loading") {
    return (
      <section aria-label="処方下書きを読み込み中" aria-busy="true">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="受付に紐づくサーバー下書きを確認しています。"
          meta={<StatusPill tone="info">下書きを読込中</StatusPill>}
        />
        <LoadingState label="処方下書きを再取得しています…" />
      </section>
    );
  }

  if (linkedOrigin !== null && loadState.kind === "error") {
    return (
      <section aria-label="処方下書きの読込エラー">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="サーバー上の版を確認できるまで編集を開始しません。"
          meta={<StatusPill tone="danger">読込失敗・編集不可</StatusPill>}
        />
        <ErrorNotice
          severity="ERROR"
          message={loadState.error.message}
          nextAction={loadErrorNextAction(loadState.error)}
          blocking
        />
        <div className="operator-inline-actions">
          <button
            type="button"
            className="operator-button"
            onClick={() => void reloadLatestServerDraft()}
          >
            再取得
          </button>
          <Link href="/">受付画面へ戻る</Link>
        </div>
      </section>
    );
  }

  const headerTone =
    saveState.kind === "conflict" || saveState.kind === "error"
      ? "danger"
      : dirty
        ? "warning"
        : serverVersion > 0
          ? "success"
          : "neutral";
  const headerLabel =
    saveState.kind === "saving"
      ? "保存中"
      : saveState.kind === "conflict"
        ? "競合・再読込が必要"
        : linkedOrigin === null
          ? dirty
            ? "受付未連携・タブ内未保存"
            : "受付未連携・保存不可"
          : dirty
            ? `サーバー版 v${serverVersion} から未保存変更`
            : serverVersion > 0
              ? `サーバー保存済み v${serverVersion}`
              : "新規下書き・未保存";
  const divergenceCopy = serverDraftDivergenceCopy(serverVersion);

  return (
    <section
      aria-label="処方入力"
      data-patient-selected="true"
      data-prototype-clinical-data="excluded"
      data-unsaved-draft={dirty ? "true" : "false"}
      data-server-draft-version={serverVersion}
    >
      <ScreenHeader
        title="処方入力ワークスペース"
        description="受付・患者文脈を固定し、サーバー保存版と未保存変更を分離して表示します。"
        meta={<StatusPill tone={headerTone}>{headerLabel}</StatusPill>}
      />
      <PrototypeBanner tone="warning">
        処方下書きの読込・保存・版競合検知は実APIへ接続しています。過去処方と薬剤マスター照合は患者固有APIが未接続、相互作用・禁忌・重複・用量判定は RB-007 BLOCKED_PMDA_SAMD_REVIEW、算定・点数・薬価は RB-008 BLOCKED_REGULATORY_REVIEW、薬剤師確認と処方確定は SCR-014 の API operation 未登録により、いずれも停止しています。未接続を成功・正常として表示しません。
      </PrototypeBanner>

      {linkedOrigin === null ? (
        <InlineNotice title="受付との連携がありません" tone="warning" announce="polite">
          <p>
            この画面の入力は同じタブ内だけに保持され、サーバーへ保存できません。実運用では受付画面から対象受付を選び、患者を再確認して開始してください。
          </p>
          <Link className="operator-button" href="/">
            受付画面を開く
          </Link>
        </InlineNotice>
      ) : null}

      {restoredNoticeVisible ? (
        <InlineNotice title="タブ内の未保存入力を復元しました" tone="info" announce="polite">
          <p>
            同じタブ内の画面移動から戻ったため未保存入力を復元しました。サーバー側の保存状態を確認した後に保存してください。
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

      {serverChangedWhileAway ? (
        <InlineNotice title={divergenceCopy.noticeTitle} tone="danger" announce="assertive">
          <p>
            復元したタブ内入力と、{divergenceCopy.currentBaseline}
            が一致しません。残す状態を選ぶまで保存できません。
          </p>
          <PrescriptionDraftChangeSummary
            kind="server-changed-while-away"
            draft={draft}
            baseline={baseline}
            serverVersion={serverVersion}
          />
          {!divergenceChoiceRequested ? (
            <button type="button" onClick={() => setDivergenceChoiceRequested(true)}>
              残す内容を選ぶ
            </button>
          ) : (
            <div className="prescription-reset-actions">
              <button
                type="button"
                onClick={() => setDivergenceChoiceRequested(false)}
                data-kind="secondary"
              >
                まだ決めない
              </button>
              <button
                type="button"
                data-kind="danger"
                onClick={() => void reloadLatestServerDraft(true)}
              >
                {divergenceCopy.discardLocal}
              </button>
              <button
                type="button"
                data-kind="danger"
                onClick={() => {
                  setServerChangedWhileAway(false);
                  setDivergenceChoiceRequested(false);
                }}
              >
                {divergenceCopy.keepLocal}
              </button>
            </div>
          )}
        </InlineNotice>
      ) : null}

      {saveState.kind === "saved" ? (
        <InlineNotice title="サーバー保存が完了しました" tone="success" announce="polite">
          <p>
            {saveDispositionLabel(saveState.disposition)}。現在の版は v{serverVersion}
            {serverUpdatedAt === null ? "" : `、更新日時 ${serverUpdatedAt}`} です。
          </p>
        </InlineNotice>
      ) : null}

      {saveState.kind === "error" ? (
        <ErrorNotice
          severity="ERROR"
          message={saveState.error.message}
          nextAction={saveErrorNextAction(saveState.error)}
        />
      ) : null}

      {saveState.kind === "conflict" ? (
        <InlineNotice title="別の更新を検出しました" tone="danger" announce="assertive">
          <p>
            現在の入力はこのタブに保持されています。サーバー版を確認せずに再保存することはできません。
          </p>
          <PrescriptionDraftChangeSummary
            kind="save-conflict"
            draft={draft}
            baseline={baseline}
            serverVersion={serverVersion}
          />
          {!reloadRequested ? (
            <button type="button" onClick={() => setReloadRequested(true)}>
              サーバー最新版の再読込を確認
            </button>
          ) : (
            <div className="prescription-reset-actions">
              <button type="button" onClick={() => setReloadRequested(false)}>
                入力を保持
              </button>
              <button
                type="button"
                data-kind="danger"
                onClick={() => void reloadLatestServerDraft(true)}
              >
                未保存入力を破棄して再読込
              </button>
            </div>
          )}
        </InlineNotice>
      ) : null}

      <div className="prescription-workbench-grid prescription-workbench-grid-safe">
        <Panel title="過去処方一覧" className="prescription-history-panel">
          <StatusPill tone="warning">患者固有API未接続</StatusPill>
          <EmptyState message="この患者の過去処方は未取得です" />
          <p className="prescription-history-empty">
            患者固有の過去処方取得APIが未接続のため、一覧・検索・前回処方の複写は提供しません。0件ではなく、取得していません。
          </p>
          <p className="prescription-history-empty">
            表示が空であることは、履歴がない、変更がない、安全である、のいずれも意味しません。従来の薬歴確認手順を継続してください。
          </p>
        </Panel>

        <Panel
          title="処方入力"
          description="サーバー保存後も薬剤師確認・処方確定ではありません。未保存変更はタブ内に保持され、患者切替・離脱時に警告します。"
          className="prescription-editor-panel live-surface-panel"
          actions={
            <div className="operator-inline-actions">
              <button
                type="button"
                onClick={() => {
                  setPendingRemovalRowId(null);
                  setResetRequested(true);
                }}
                disabled={!dirty || editorLocked}
                title={
                  dirty
                    ? "最後に確認したサーバー版まで戻します"
                    : "戻す変更はありません"
                }
              >
                変更を戻す
              </button>
              <button type="button" onClick={addRow} disabled={editorLocked}>
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
              <h4 id="prescription-reset-title">未保存の変更を破棄しますか</h4>
              <p id="prescription-reset-description">
                患者: {patient.name}。入力済み {nonEmptyRows}行、選択項目 {draft.options.length}
                件、メモを最後に確認したサーバー版へ戻します。
              </p>
              <div className="prescription-reset-actions">
                <button type="button" onClick={() => setResetRequested(false)}>
                  キャンセル
                </button>
                <button type="button" data-kind="danger" onClick={confirmReset}>
                  確認して変更を破棄
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
                ）を削除します。保存前の内容は元に戻せません。
              </p>
              <div className="prescription-reset-actions">
                <button type="button" onClick={() => setPendingRemovalRowId(null)}>
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
                disabled={editorLocked}
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
                disabled={editorLocked}
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
                disabled={editorLocked}
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

          <fieldset
            className="prescription-source-metadata"
            disabled={editorLocked}
          >
            <legend>処方箋原本情報（手入力。発行日・有効期限は原本の記載どおり入力）</legend>
            <div className="prescription-meta-grid">
              <label>
                医療機関コード
                <input
                  value={draft.institutionCode}
                  maxLength={64}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      institutionCode: event.target.value,
                    }))
                  }
                  placeholder="未コード化可"
                  autoComplete="off"
                />
              </label>
              <label>
                医療機関名称
                <input
                  value={draft.institutionName}
                  maxLength={128}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      institutionName: event.target.value,
                    }))
                  }
                  autoComplete="off"
                />
              </label>
              <label>
                医師名
                <input
                  value={draft.prescriberName}
                  maxLength={128}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      prescriberName: event.target.value,
                    }))
                  }
                  autoComplete="off"
                />
              </label>
              <label>
                発行日
                <input
                  type="date"
                  value={draft.issueDate}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      issueDate: event.target.value,
                      // DOM-002 §4.2a: 発行日+4日は入力補助の既定値。保存値は入力値。
                      validUntil:
                        current.validUntil.trim().length === 0
                          ? defaultValidUntil(event.target.value) ??
                            current.validUntil
                          : current.validUntil,
                    }))
                  }
                />
              </label>
              <label>
                有効期限
                <input
                  type="date"
                  value={draft.validUntil}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      validUntil: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                リフィル総回数
                <input
                  value={draft.refillTotal}
                  inputMode="numeric"
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      refillTotal: event.target.value,
                    }))
                  }
                  placeholder="なし"
                />
              </label>
              <label>
                リフィル残回数
                <input
                  value={draft.refillRemaining}
                  inputMode="numeric"
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      refillRemaining: event.target.value,
                    }))
                  }
                  placeholder="なし"
                />
              </label>
              <label>
                分割調剤指示
                <input
                  value={draft.splitDispensing}
                  maxLength={256}
                  disabled={editorLocked}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft((current) => ({
                      ...current,
                      splitDispensing: event.target.value,
                    }))
                  }
                  autoComplete="off"
                />
              </label>
            </div>
          </fieldset>

          {linkedOrigin !== null &&
          isPrescriptionSourceExpired(
            draft.validUntil,
            linkedOrigin.businessDate,
          ) ? (
            <ClinicalAlert
              alertType="DOCUMENT_VALIDITY"
              severity="WARNING"
              drugName="処方箋原本"
              detail={`有効期限(${draft.validUntil})を過ぎています。原本を確認してください。`}
              source="手入力の原本情報"
              evaluatedAt={linkedOrigin.businessDate}
              recommendedAction="薬剤師の判断で継続可否を確認してください。保存はブロックされません。"
              blocking={false}
            />
          ) : null}

          <TableScroll label="処方入力表。横方向にスクロールできます">
            <table className="operator-table prescription-draft-table">
              <caption className="visually-hidden">選択患者の処方下書き入力行</caption>
              <thead>
                <tr>
                  <th scope="col">RP</th>
                  <th scope="col">剤形</th>
                  <th scope="col">薬剤</th>
                  <th scope="col">用法</th>
                  <th scope="col">日数・回数</th>
                  <th scope="col">用量</th>
                  <th scope="col">一般名・後発品</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    <td>
                      <select
                        aria-label={`RP${index + 1} 剤形区分`}
                        value={row.dosageForm}
                        disabled={editorLocked}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          updateRow(row.id, {
                            dosageForm: event.target.value,
                          })
                        }
                      >
                        <option value="">未指定</option>
                        <option value="内服">内服</option>
                        <option value="外用">外用</option>
                        <option value="注射">注射</option>
                        <option value="頓服">頓服</option>
                        <option value="その他">その他</option>
                      </select>
                    </td>
                    <td>
                      <label className="prescription-mode-toggle">
                        <input
                          type="checkbox"
                          aria-label={`RP${index + 1} 薬剤をマスターから選択`}
                          checked={row.medicationMode === "master"}
                          disabled={editorLocked}
                          onChange={() =>
                            updateRow(row.id, {
                              medicationMode:
                                row.medicationMode === "master"
                                  ? "text"
                                  : "master",
                              // text へ戻すときは resolved 参照を残さない
                              // (orphan id が空行判定をすり抜けて phantom
                              // unresolved item を永続化するのを防ぐ)。
                              ...(row.medicationMode === "master"
                                ? {
                                    masterVersionId: "",
                                    medicationItemId: "",
                                    medicationItemLabel: "",
                                  }
                                : {}),
                            })
                          }
                        />
                        コード
                      </label>
                      {row.medicationMode === "master" ? (
                        <MasterCodePicker
                          kind="medication"
                          asOf={linkedOrigin?.businessDate ?? ""}
                          disabled={editorLocked}
                          selectedLabel={
                            row.medicationItemLabel.length > 0
                              ? row.medicationItemLabel
                              : row.medicationItemId.length > 0
                                ? "コード選択済み(表示名未取得)"
                                : ""
                          }
                          onSelect={(selection) =>
                            applyMasterSelection(
                              row.id,
                              "medication",
                              selection,
                            )
                          }
                          onClear={() =>
                            applyMasterSelection(row.id, "medication", null)
                          }
                        />
                      ) : (
                        <input
                          aria-label={`RP${index + 1} 薬剤名(自由記載)`}
                          value={row.drug}
                          maxLength={PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, { drug: event.target.value })
                          }
                          placeholder="薬剤名・規格を入力"
                          autoComplete="off"
                        />
                      )}
                    </td>
                    <td>
                      <label className="prescription-mode-toggle">
                        <input
                          type="checkbox"
                          aria-label={`RP${index + 1} 用法をコードから選択`}
                          checked={row.usageMode === "code"}
                          disabled={editorLocked}
                          onChange={() =>
                            updateRow(row.id, {
                              usageMode:
                                row.usageMode === "code" ? "text" : "code",
                              ...(row.usageMode === "code"
                                ? {
                                    usageItemId: "",
                                    usageItemLabel: "",
                                  }
                                : {}),
                            })
                          }
                        />
                        コード
                      </label>
                      {row.usageMode === "code" ? (
                        <MasterCodePicker
                          kind="usage"
                          asOf={linkedOrigin?.businessDate ?? ""}
                          disabled={editorLocked}
                          selectedLabel={
                            row.usageItemLabel.length > 0
                              ? row.usageItemLabel
                              : row.usageItemId.length > 0
                                ? "コード選択済み(表示名未取得)"
                                : ""
                          }
                          onSelect={(selection) =>
                            applyMasterSelection(row.id, "usage", selection)
                          }
                          onClear={() =>
                            applyMasterSelection(row.id, "usage", null)
                          }
                        />
                      ) : (
                        <input
                          aria-label={`RP${index + 1} 用法(自由記載)`}
                          value={row.usage}
                          maxLength={PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, { usage: event.target.value })
                          }
                          placeholder="用法(例: 1日3回 毎食後)"
                          autoComplete="off"
                        />
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`RP${index + 1} 日数・回数`}
                        value={row.days}
                        inputMode="numeric"
                        disabled={editorLocked}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateRow(row.id, { days: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <div className="prescription-dose-fields">
                        <input
                          aria-label={`RP${index + 1} 1回量`}
                          value={row.doseOnce}
                          maxLength={PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, {
                              doseOnce: event.target.value,
                            })
                          }
                          placeholder="1回量"
                          autoComplete="off"
                        />
                        <input
                          aria-label={`RP${index + 1} 1日量`}
                          value={row.dosePerDay}
                          maxLength={PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, {
                              dosePerDay: event.target.value,
                            })
                          }
                          placeholder="1日量"
                          autoComplete="off"
                        />
                        <input
                          aria-label={`RP${index + 1} 総量`}
                          value={row.quantity}
                          maxLength={PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, {
                              quantity: event.target.value,
                            })
                          }
                          placeholder="総量"
                          autoComplete="off"
                        />
                        <input
                          aria-label={`RP${index + 1} 単位`}
                          value={row.unit}
                          maxLength={PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH}
                          disabled={editorLocked}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, { unit: event.target.value })
                          }
                          placeholder="単位"
                          autoComplete="off"
                        />
                      </div>
                    </td>
                    <td>
                      <label className="prescription-mode-toggle">
                        <input
                          type="checkbox"
                          aria-label={`RP${index + 1} 一般名処方`}
                          checked={row.genericNamePrescription}
                          disabled={editorLocked}
                          onChange={() =>
                            updateRow(row.id, {
                              genericNamePrescription:
                                !row.genericNamePrescription,
                            })
                          }
                        />
                        一般名
                      </label>
                      <select
                        aria-label={`RP${index + 1} 後発品変更可否`}
                        value={row.genericSubstitution}
                        disabled={editorLocked}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          updateRow(row.id, {
                            genericSubstitution: event.target
                              .value as DraftRow["genericSubstitution"],
                          })
                        }
                      >
                        <option value="">未指定</option>
                        <option value="permitted">変更可</option>
                        <option value="forbidden">変更不可</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => requestRowRemoval(row.id)}
                        aria-label={`RP${index + 1}の削除を確認`}
                        disabled={
                          editorLocked ||
                          (draft.rows.length === 1 && isDraftRowEmpty(row))
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
          </TableScroll>

          {unresolvedCounts !== null &&
          unresolvedCounts.unresolvedMedicationItems > 0 ? (
            <InlineNotice
              tone="warning"
              title={`未解決の薬剤が ${unresolvedCounts.unresolvedMedicationItems} 件あります`}
            >
              自由記載の薬剤はマスターコード未解決のため、この下書きは薬剤師確認へ進めません
              (RX-0001 CODE_MAPPING_REVIEW_REQUIRED)。「コード」へ切り替えて
              マスターから選択するか、自由記載のままコード対応レビューを待ってください。
            </InlineNotice>
          ) : null}
          {unresolvedCounts !== null &&
          unresolvedCounts.unresolvedUsages > 0 ? (
            <InlineNotice
              tone="warning"
              title={`自由記載の用法が ${unresolvedCounts.unresolvedUsages} 件あります`}
            >
              用法の自由記載は制度上許容されますが、コード化できる場合は用法マスターからの選択を推奨します。
            </InlineNotice>
          ) : null}

          <fieldset className="prescription-options" disabled={editorLocked}>
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
              maxLength={2000}
              disabled={editorLocked}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="サーバー下書きへ保存されます"
            />
          </label>

          <div className="prescription-actions" aria-label="処方操作">
            <button
              type="button"
              className="operator-button"
              data-kind="secondary"
              disabled={
                !canSavePrescriptionDraft({
                  linked: linkedOrigin !== null,
                  loadKind: loadState.kind,
                  dirty,
                  saveKind: saveState.kind,
                  serverChangedWhileAway,
                })
              }
              title={
                linkedOrigin === null
                  ? "受付画面から対象受付を引き継いでください"
                  : !dirty
                    ? "保存する変更はありません"
                    : saveState.kind === "conflict"
                      ? "サーバー最新版を再読込してください"
                      : serverChangedWhileAway
                        ? "復元入力とサーバー保存版の差分を解消してください"
                        : "処方下書きをサーバーへ保存"
              }
              onClick={() => void saveDraft()}
            >
              {saveState.kind === "saving" ? "保存中…" : "処方下書きを保存"}
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
                    "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です。これは判定を実行した結果ではなく、判定そのものが行われていないという宣言です。アラートが表示されないことは安全確認済みを意味しません。必要な確認は従来手順で実施してください。",
                },
                {
                  severity: "WARNING",
                  message:
                    "重複投薬・併用禁忌チェックは RB-007 BLOCKED_PMDA_SAMD_REVIEW（SaMD該当性判定と人間レビューが未了）のため提供しません。この画面は判定していません。",
                },
                {
                  severity: "INFO",
                  message:
                    "アレルギー歴・既往歴は未接続です。表示されないことは該当なしを意味しません。",
                },
              ]}
            />
          </RailCard>
          <RailCard title="保存・確認状態">
            <KeyValueList
              items={[
                {
                  label: "サーバー下書き版",
                  value: serverVersion === 0 ? "未作成" : `v${serverVersion}`,
                },
                {
                  label: "サーバー最終更新",
                  value: serverUpdatedAt ?? "—",
                },
                {
                  label: "このタブの未保存変更",
                  value: dirty ? "あり" : "なし",
                },
                {
                  label: "コード未解決品目",
                  value:
                    unresolvedCounts === null
                      ? "確認不能"
                      : unresolvedCounts.unresolvedMedicationItems === 0
                        ? "なし"
                        : `${unresolvedCounts.unresolvedMedicationItems}件（確認不可）`,
                },
                { label: "薬剤師確認", value: "未実施（実行不可）" },
              ]}
            />
            <p className="rail-muted">
              下書き保存は薬剤師確認・処方確定を意味しません。保存済みの内容は「薬剤師確認前」であり、調剤・交付の根拠になりません。
            </p>
            <p className="rail-muted">
              薬剤師確認 (SCR-014, dispensing:confirm) は API operation
              が未登録のため実行できません。
            </p>
          </RailCard>
          <RailCard title="検査値" tone="warning">
            <StatusPill tone="warning">検査値連携API未接続</StatusPill>
            <p className="rail-muted">
              検査値が表示されないことは正常を意味しません。0件でもなく、取得していません。
            </p>
          </RailCard>
          <RailCard title="患者固有タスク">
            <StatusPill tone="warning">タスクAPI未接続</StatusPill>
            <p className="rail-muted">
              疑義照会、薬歴確認、次回フォローはタスクAPI接続後に表示します。件数を推測して表示しません。表示されないことは該当なしを意味しません。
            </p>
          </RailCard>
          <RailCard title="エビデンス" tone="warning">
            <StatusPill tone="warning">evidence_id 未接続</StatusPill>
            <p className="rail-muted">
              ガイドライン・相互作用根拠・算定根拠は evidence_id 接続後に表示します。
            </p>
            <p className="rail-muted">
              点数・薬価の表示は RB-008
              BLOCKED_REGULATORY_REVIEW（診療報酬・薬価ロジックの法令レビュー未了）で停止しています。
            </p>
          </RailCard>
        </aside>
      </div>
    </section>
  );
}
