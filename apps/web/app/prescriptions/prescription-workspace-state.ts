import {
  PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH,
  PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH,
  prescriptionDraftUnresolvedCounts,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionLifecycleView,
  type PrescriptionStatusWire,
} from "@yrese/contracts";

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
  transitionPrescriptionLifecycle,
  type PrescriptionLifecycleTransition,
} from "./prescription-draft-persistence";
import {
  type PrescriptionDraftSnapshot,
  type PrescriptionOption,
  createBlankPrescriptionDraft,
} from "./prescription-draft";
import {
  type DraftRow,
  createBlankDraftRow,
  isDraftRowEmpty,
  removeDraftRow,
} from "./prescription-replacement";
import { resolveMasterItemLabels } from "../masters/master-lookup";

export type DraftLoadState =
  | { readonly kind: "unlinked" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly error: PrescriptionDraftApiError };

export type DraftSaveDisposition = PrescriptionDraftSaveResponse["saveDisposition"];

export type DraftSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | {
      readonly kind: "saved";
      readonly disposition: DraftSaveDisposition;
    }
  | { readonly kind: "conflict" }
  | { readonly kind: "error"; readonly error: PrescriptionDraftApiError };

export type PrescriptionDraftChangeKind =
  | "server-changed-while-away"
  | "save-conflict";

/** WP-7402: サーバー応答から復元するライフサイクル表示状態。 */
export interface LifecycleDisplayState {
  readonly prescriptionId: string | null;
  readonly status: PrescriptionStatusWire | null;
  readonly confirmedBy: string | null;
  readonly confirmedAt: string | null;
  readonly finalizedBy: string | null;
  readonly finalizedAt: string | null;
  readonly prescriptionVersion: number | null;
}

export const EMPTY_LIFECYCLE: LifecycleDisplayState = {
  prescriptionId: null,
  status: null,
  confirmedBy: null,
  confirmedAt: null,
  finalizedBy: null,
  finalizedAt: null,
  prescriptionVersion: null,
};

export function lifecycleFromDraftResponse(
  response: PrescriptionDraftResponse,
): LifecycleDisplayState {
  return {
    prescriptionId: response.prescriptionId,
    status: response.status,
    confirmedBy: response.confirmedBy,
    confirmedAt: response.confirmedAt,
    finalizedBy: response.finalizedBy,
    finalizedAt: response.finalizedAt,
    prescriptionVersion: response.prescriptionVersion,
  };
}

export function lifecycleFromView(
  view: PrescriptionLifecycleView,
): LifecycleDisplayState {
  return {
    prescriptionId: view.prescriptionId,
    status: view.status,
    confirmedBy: view.confirmedBy,
    confirmedAt: view.confirmedAt,
    finalizedBy: view.finalizedBy,
    finalizedAt: view.finalizedAt,
    prescriptionVersion: view.prescriptionVersion,
  };
}

export type LifecycleActionState =
  | { readonly kind: "idle" }
  | { readonly kind: "review"; readonly target: PrescriptionLifecycleTransition }
  | {
      readonly kind: "submitting";
      readonly target: PrescriptionLifecycleTransition;
    }
  | {
      readonly kind: "error";
      readonly target: PrescriptionLifecycleTransition;
      readonly error: PrescriptionDraftApiError;
    };

/**
 * DOM-002 §4.2a の確認 guard と同じ必須項目。表示用の事前確認であり、
 * 正本 guard は常に API 側(失敗しても安全側へ倒れる)。
 */
export function isSourceMetadataInputComplete(
  snapshot: PrescriptionDraftSnapshot,
): boolean {
  return (
    snapshot.prescriptionType.trim().length > 0 &&
    snapshot.prescriptionDate.trim().length > 0 &&
    snapshot.defaultDays.trim().length > 0 &&
    snapshot.institutionName.trim().length > 0 &&
    snapshot.prescriberName.trim().length > 0 &&
    snapshot.issueDate.trim().length > 0 &&
    snapshot.validUntil.trim().length > 0
  );
}

export function lifecycleStatusLabel(
  status: PrescriptionStatusWire | null,
): string {
  if (status === "PHARMACIST_CONFIRMED") return "薬剤師確認済み";
  if (status === "PRESCRIPTION_FINALIZED") return "処方確定済み";
  return "下書き(未確認)";
}

export function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function normalizedDraftForComparison(
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

export function saveDispositionLabel(
  disposition: DraftSaveDisposition,
): string {
  if (disposition === "created") return "新規下書きを保存しました";
  if (disposition === "updated") return "下書きを更新しました";
  return "サーバー上の下書きは変更ありません";
}

export function loadErrorNextAction(error: PrescriptionDraftApiError): string {
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

export function saveErrorNextAction(error: PrescriptionDraftApiError): string {
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

/**
 * 薬剤師確認・処方確定の二段階確認ダイアログ(UIX-001 P-11)。
 * 対象患者の再提示と実行 actor の明示を必須とし、操作は監査証跡に残り
 * 取り消せないことを確認文に含める。
 */

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
export async function hydrateDraftMasterLabels(
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

