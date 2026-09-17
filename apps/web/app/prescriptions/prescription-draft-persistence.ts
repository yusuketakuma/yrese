import {
  prescriptionDraftEffectiveRpGroups,
  prescriptionDraftFlagSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftFlag,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type PrescriptionDraftType,
  type PrescriptionRpGroup,
  type PrescriptionRpItem,
  type PrescriptionRpMedicationRef,
  type PrescriptionRpUsageRef,
} from "@yrese/contracts";
import { permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import {
  type PrescriptionDraftSnapshot,
  type PrescriptionOption,
} from "./prescription-draft";
import { isDraftRowEmpty, type DraftRow } from "./prescription-replacement";

const READ_SCOPES = [
  permissionScope("prescription", "read"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const;

const WRITE_SCOPES = [
  permissionScope("prescription", "write"),
  permissionScope("reception", "read"),
  permissionScope("patient", "read"),
] as const;

const TYPE_TO_WIRE: Record<string, PrescriptionDraftType> = {
  "": "UNSPECIFIED",
  外来: "OUTPATIENT",
  在宅: "HOME",
};

const TYPE_FROM_WIRE: Record<PrescriptionDraftType, string> = {
  UNSPECIFIED: "",
  OUTPATIENT: "外来",
  HOME: "在宅",
};

const FLAG_TO_WIRE: Record<PrescriptionOption, PrescriptionDraftFlag> = {
  一包化: "PACKAGING",
  在宅: "HOME_CARE",
  麻薬: "NARCOTIC",
  向精神薬: "PSYCHOTROPIC",
  残薬調整: "LEFTOVER_ADJUSTMENT",
};

export const FLAG_FROM_WIRE: Record<
  PrescriptionDraftFlag,
  PrescriptionOption
> = {
  PACKAGING: "一包化",
  HOME_CARE: "在宅",
  NARCOTIC: "麻薬",
  PSYCHOTROPIC: "向精神薬",
  LEFTOVER_ADJUSTMENT: "残薬調整",
};

export type PrescriptionDraftApiErrorKind =
  | "INVALID_REQUEST"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_RESPONSE"
  | "UNAVAILABLE";

export class PrescriptionDraftApiError extends Error {
  constructor(
    readonly kind: PrescriptionDraftApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PrescriptionDraftApiError";
  }
}

export interface PrescriptionDraftContext {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

/** 受付登録と同じ既存のブラウザ通信上限。SLO確定前の性能最適化値ではない。 */
export const PRESCRIPTION_DRAFT_TIMEOUT_MS = 30_000;

function draftRequestSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal === undefined
    ? timeoutSignal
    : AbortSignal.any([callerSignal, timeoutSignal]);
}

function draftTimeoutError(): PrescriptionDraftApiError {
  return new PrescriptionDraftApiError(
    "UNAVAILABLE",
    "処方下書きAPIへの応答が時間内にありませんでした。",
  );
}

function parseOptionalInteger(value: string, label: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (!/^[0-9]+$/u.test(normalized)) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      `${label}は1〜999の整数で入力してください。`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 999) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      `${label}は1〜999の整数で入力してください。`,
    );
  }
  return parsed;
}

function parseOptionalCount(value: string, label: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (!/^[0-9]+$/u.test(normalized)) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      `${label}は0〜999の整数で入力してください。`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 999) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      `${label}は0〜999の整数で入力してください。`,
    );
  }
  return parsed;
}

const SOURCE_METADATA_FIELDS = [
  "institutionCode",
  "institutionName",
  "prescriberName",
  "issueDate",
  "validUntil",
  "refillTotal",
  "refillRemaining",
  "splitDispensing",
] as const;

function hasAnySourceMetadataInput(
  snapshot: PrescriptionDraftSnapshot,
): boolean {
  return SOURCE_METADATA_FIELDS.some(
    (field) => snapshot[field].trim().length > 0,
  );
}

/**
 * DOM-002 §4.2a: 原本 metadata は全項目手入力。一項目でも入力があれば
 * issueDate/validUntil を必須とし、有効期限の前後関係とリフィル残数の
 * 不変条件は contract schema に委譲する(二重実装しない)。
 */
function toSourceMetadata(
  snapshot: PrescriptionDraftSnapshot,
): PrescriptionDraftContent["sourceMetadata"] {
  if (!hasAnySourceMetadataInput(snapshot)) return null;
  if (snapshot.issueDate.trim().length === 0) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方箋の発行日を入力してください。",
    );
  }
  if (snapshot.validUntil.trim().length === 0) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方箋の有効期限を入力してください。",
    );
  }
  const refillTotal = parseOptionalCount(snapshot.refillTotal, "リフィル総回数");
  const refillRemaining = parseOptionalCount(
    snapshot.refillRemaining,
    "リフィル残回数",
  );
  return {
    medicalInstitution: {
      code:
        snapshot.institutionCode.trim().length === 0
          ? null
          : snapshot.institutionCode,
      name: snapshot.institutionName,
    },
    prescriberName: snapshot.prescriberName,
    issueDate: snapshot.issueDate.trim(),
    validUntil: snapshot.validUntil.trim(),
    refill:
      refillTotal === null && refillRemaining === null
        ? null
        : { total: refillTotal ?? 0, remaining: refillRemaining ?? 0 },
    splitDispensing:
      snapshot.splitDispensing.trim().length === 0
        ? null
        : snapshot.splitDispensing,
  };
}

const DOSAGE_FORM_TO_WIRE: Record<string, PrescriptionRpGroup["dosageForm"]> = {
  "": "UNSPECIFIED",
  内服: "ORAL",
  外用: "TOPICAL",
  注射: "INJECTION",
  頓服: "AS_NEEDED",
  その他: "OTHER",
};

const DOSAGE_FORM_FROM_WIRE: Record<
  PrescriptionRpGroup["dosageForm"],
  string
> = {
  UNSPECIFIED: "",
  ORAL: "内服",
  TOPICAL: "外用",
  INJECTION: "注射",
  AS_NEEDED: "頓服",
  OTHER: "その他",
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : value;
}

function rowToRpItem(
  row: DraftRow,
  sequence: number,
  groupSequence: number,
): PrescriptionRpItem {
  let medication: PrescriptionRpMedicationRef;
  if (row.medicationMode === "master") {
    if (
      row.masterVersionId.trim().length === 0 ||
      row.medicationItemId.trim().length === 0
    ) {
      throw new PrescriptionDraftApiError(
        "INVALID_REQUEST",
        `RP${groupSequence} 薬剤をマスターから選択するか、自由記載に切り替えてください。`,
      );
    }
    medication = {
      kind: "resolved",
      masterVersionId: row.masterVersionId,
      medicationItemId: row.medicationItemId,
    };
  } else {
    medication = { kind: "unresolved", text: row.drug };
  }
  const substitution =
    row.genericSubstitution === "permitted"
      ? true
      : row.genericSubstitution === "forbidden"
        ? false
        : null;
  return {
    rpItemId: row.rpItemId,
    sequence,
    medication,
    doseOnce: optionalText(row.doseOnce),
    dosePerDay: optionalText(row.dosePerDay),
    doseTotal: optionalText(row.quantity),
    unit: optionalText(row.unit),
    genericNamePrescription: row.genericNamePrescription,
    genericSubstitutionPermitted: substitution,
  };
}

/**
 * WP-7302: UI 行(1行=1品目)を wire rpGroups へ組み立てる。
 * 同一 rpGroupId を共有する行は読み込み時に同じ group へ展開された
 * 品目であり、保存時は同じ group の items として再結合する。
 * 空行(未入力の addRow/removeDraftRow 残余)は Rp へ含めない —
 * 空の UNRESOLVED_TEXT 品目を永続化すると unresolved 件数が架空に
 * 計上され、WP-7402 の確認 guard を実質ロックする。
 */
function rowsToRpGroups(snapshot: PrescriptionDraftSnapshot): PrescriptionRpGroup[] {
  const materialRows = snapshot.rows.filter((row) => !isDraftRowEmpty(row));
  const grouped = new Map<string, DraftRow[]>();
  for (const row of materialRows) {
    const bucket = grouped.get(row.rpGroupId);
    if (bucket === undefined) {
      grouped.set(row.rpGroupId, [row]);
    } else {
      bucket.push(row);
    }
  }
  const groups: PrescriptionRpGroup[] = [];
  let groupSequence = 0;
  for (const rows of grouped.values()) {
    groupSequence += 1;
    const head = rows[0] as DraftRow;
    const dosageForm = DOSAGE_FORM_TO_WIRE[head.dosageForm];
    if (dosageForm === undefined) {
      throw new PrescriptionDraftApiError(
        "INVALID_REQUEST",
        `RP${groupSequence} 剤形区分を確認してください。`,
      );
    }
    let usage: PrescriptionRpUsageRef;
    if (head.usageMode === "code") {
      if (head.usageItemId.trim().length === 0) {
        throw new PrescriptionDraftApiError(
          "INVALID_REQUEST",
          `RP${groupSequence} 用法コードを選択するか、自由記載に切り替えてください。`,
        );
      }
      usage = { kind: "resolved", usageItemId: head.usageItemId };
    } else {
      usage = { kind: "unresolved", text: head.usage };
    }
    groups.push({
      rpGroupId: head.rpGroupId,
      sequence: groupSequence,
      dosageForm,
      usage,
      daysOrCount: parseOptionalInteger(
        head.days,
        `RP${groupSequence} 日数・回数`,
      ),
      items: rows.map((row, index) =>
        rowToRpItem(row, index + 1, groupSequence),
      ),
    });
  }
  return groups;
}

export function rpItemToDraftRow(
  group: PrescriptionRpGroup,
  item: PrescriptionRpItem,
  id: number,
): DraftRow {
  const medication = item.medication;
  const usage = group.usage;
  return {
    id,
    rpGroupId: group.rpGroupId,
    rpItemId: item.rpItemId,
    dosageForm: DOSAGE_FORM_FROM_WIRE[group.dosageForm],
    usageMode: usage.kind === "resolved" ? "code" : "text",
    usageItemId: usage.kind === "resolved" ? usage.usageItemId : "",
    usageItemLabel: "",
    usage: usage.kind === "unresolved" ? usage.text : "",
    medicationMode: medication.kind === "resolved" ? "master" : "text",
    masterVersionId:
      medication.kind === "resolved" ? medication.masterVersionId : "",
    medicationItemId:
      medication.kind === "resolved" ? medication.medicationItemId : "",
    medicationItemLabel: "",
    drug: medication.kind === "unresolved" ? medication.text : "",
    doseOnce: item.doseOnce ?? "",
    dosePerDay: item.dosePerDay ?? "",
    days: group.daysOrCount === null ? "" : String(group.daysOrCount),
    quantity: item.doseTotal ?? "",
    unit: item.unit ?? "",
    genericNamePrescription: item.genericNamePrescription,
    genericSubstitution:
      item.genericSubstitutionPermitted === true
        ? "permitted"
        : item.genericSubstitutionPermitted === false
          ? "forbidden"
          : "",
  };
}

function validationIssueLabel(path: readonly PropertyKey[]): string {
  if (path[0] === "rows") {
    if (typeof path[1] !== "number") return "RP行数";
    const prefix = `RP${path[1] + 1}`;
    if (path[2] === "drugText") return `${prefix} 薬剤名`;
    if (path[2] === "usageText") return `${prefix} 用法用量`;
    if (path[2] === "days") return `${prefix} 日数`;
    if (path[2] === "quantityText") return `${prefix} 数量`;
    return `${prefix} 入力`;
  }
  if (path[0] === "rpGroups") {
    if (typeof path[1] !== "number") return "RP構造";
    const prefix = `RP${path[1] + 1}`;
    if (path[2] === "usage") return `${prefix} 用法`;
    if (path[2] === "daysOrCount") return `${prefix} 日数・回数`;
    if (path[2] === "items" && typeof path[3] === "number") {
      const itemPrefix = `${prefix} 品目${path[3] + 1}`;
      if (path[4] === "medication") return `${itemPrefix} 薬剤`;
      if (path[4] === "doseOnce") return `${itemPrefix} 1回量`;
      if (path[4] === "dosePerDay") return `${itemPrefix} 1日量`;
      if (path[4] === "doseTotal") return `${itemPrefix} 総量`;
      if (path[4] === "unit") return `${itemPrefix} 単位`;
      return `${itemPrefix} 入力`;
    }
    return `${prefix} 入力`;
  }
  if (path[0] === "prescriptionType") return "処方区分";
  if (path[0] === "prescriptionDate") return "処方日";
  if (path[0] === "defaultDays") return "交付日数";
  if (path[0] === "flags") return "全体指示";
  if (path[0] === "note") return "メモ";
  if (path[0] === "sourceMetadata") {
    if (path[1] === "issueDate") return "発行日";
    if (path[1] === "validUntil") return "有効期限";
    if (path[1] === "prescriberName") return "医師名";
    if (path[1] === "medicalInstitution") return "医療機関";
    if (path[1] === "refill") return "リフィル回数";
    if (path[1] === "splitDispensing") return "分割調剤指示";
    return "原本情報";
  }
  return "入力内容";
}

export function toPrescriptionDraftContent(
  snapshot: PrescriptionDraftSnapshot,
): PrescriptionDraftContent {
  const prescriptionType = TYPE_TO_WIRE[snapshot.prescriptionType];
  if (prescriptionType === undefined) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方区分を確認してください。",
    );
  }

  // sourceMetadata の入力検証(発行日・有効期限の必須)を RP 構築より先に
  // 行い、metadata-only の不備が行エラーに隠れないようにする。
  const sourceMetadata = toSourceMetadata(snapshot);
  const candidate = {
    prescriptionType,
    prescriptionDate:
      snapshot.prescriptionDate.trim().length === 0
        ? null
        : snapshot.prescriptionDate.trim(),
    defaultDays: parseOptionalInteger(snapshot.defaultDays, "交付日数"),
    flags: snapshot.options.map((option) => FLAG_TO_WIRE[option]),
    note: snapshot.note,
    rows: [],
    rpGroups: rowsToRpGroups(snapshot),
    sourceMetadata,
  };

  const parsed = prescriptionDraftSaveRequestSchema.shape.draft.safeParse(candidate);
  if (parsed.success) return parsed.data;
  // rows=[] && rpGroups=[] の superRefine issue(custom, path ["rpGroups"])
  // は全空 draft の拒否 — field 別エラーより後置して専用メッセージを返す。
  // 同 signature の itemCount 超過 issue と混同しないよう、
  // materialize 結果が実際に空であることも確認する。
  if (
    candidate.rpGroups.length === 0 &&
    parsed.error.issues[0]?.code === "custom" &&
    parsed.error.issues[0].path.length === 1 &&
    parsed.error.issues[0].path[0] === "rpGroups"
  ) {
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "少なくとも1行のRP内容を入力してください。",
    );
  }
  throw new PrescriptionDraftApiError(
    "INVALID_REQUEST",
    `${validationIssueLabel(parsed.error.issues[0]?.path ?? [])}を確認してください。`,
  );
}

export function fromPrescriptionDraftResponse(
  response: PrescriptionDraftResponse,
): PrescriptionDraftSnapshot {
  return {
    prescriptionType: TYPE_FROM_WIRE[response.draft.prescriptionType],
    prescriptionDate: response.draft.prescriptionDate ?? "",
    defaultDays:
      response.draft.defaultDays === null
        ? ""
        : String(response.draft.defaultDays),
    options: response.draft.flags.map((flag) => FLAG_FROM_WIRE[flag]),
    note: response.draft.note,
    institutionCode: response.draft.sourceMetadata?.medicalInstitution.code ?? "",
    institutionName:
      response.draft.sourceMetadata?.medicalInstitution.name ?? "",
    prescriberName: response.draft.sourceMetadata?.prescriberName ?? "",
    issueDate: response.draft.sourceMetadata?.issueDate ?? "",
    validUntil: response.draft.sourceMetadata?.validUntil ?? "",
    refillTotal:
      response.draft.sourceMetadata?.refill === null ||
      response.draft.sourceMetadata?.refill === undefined
        ? ""
        : String(response.draft.sourceMetadata.refill.total),
    refillRemaining:
      response.draft.sourceMetadata?.refill === null ||
      response.draft.sourceMetadata?.refill === undefined
        ? ""
        : String(response.draft.sourceMetadata.refill.remaining),
    splitDispensing: response.draft.sourceMetadata?.splitDispensing ?? "",
    rows: prescriptionDraftEffectiveRpGroups(response.draft).flatMap(
      (group) =>
        group.items.map((item, index) =>
          rpItemToDraftRow(group, item, (group.sequence - 1) * 1000 + index + 1),
        ),
    ),
  };
}

/**
 * snapshot が保持する resolved 参照の itemId 集合。
 * master 表示名の hydrate に使う。
 */
export function collectResolvedMasterIds(
  snapshot: PrescriptionDraftSnapshot,
): {
  readonly medicationRefs: readonly {
    readonly masterVersionId: string;
    readonly medicationItemId: string;
  }[];
  readonly usageItemIds: readonly string[];
} {
  const medicationRefs = new Map<string, string>();
  const usageItemIds = new Set<string>();
  for (const row of snapshot.rows) {
    if (
      row.medicationMode === "master" &&
      row.medicationItemId.length > 0 &&
      row.masterVersionId.length > 0
    ) {
      medicationRefs.set(row.medicationItemId, row.masterVersionId);
    }
    if (row.usageMode === "code" && row.usageItemId.length > 0) {
      usageItemIds.add(row.usageItemId);
    }
  }
  return {
    medicationRefs: [...medicationRefs].map(
      ([medicationItemId, masterVersionId]) => ({
        medicationItemId,
        masterVersionId,
      }),
    ),
    usageItemIds: [...usageItemIds],
  };
}

/**
 * resolved 参照へ master の表示名を付与する。版内で append-only のため
 * itemId → 名称は不変。解決不能な ID は表示を変えない。
 */
export function applyMasterLabels(
  snapshot: PrescriptionDraftSnapshot,
  labels: {
    readonly medications: ReadonlyMap<string, string>;
    readonly medicationVersionId: string | null;
    readonly usages: ReadonlyMap<string, string>;
  },
): PrescriptionDraftSnapshot {
  return {
    ...snapshot,
    rows: snapshot.rows.map((row) => ({
      ...row,
      // ラベルは解決した版の行にのみ適用する(同一 itemId が別版の行に
      // 紛れ込んだ場合に版違いの表示名を貼らない)。
      medicationItemLabel:
        row.medicationItemLabel.length > 0
          ? row.medicationItemLabel
          : row.masterVersionId === labels.medicationVersionId &&
              labels.medicationVersionId !== null
            ? (labels.medications.get(row.medicationItemId) ?? "")
            : "",
      usageItemLabel:
        row.usageItemLabel.length > 0
          ? row.usageItemLabel
          : (labels.usages.get(row.usageItemId) ?? ""),
    })),
  };
}

/**
 * サーバーと同じ canonical 順(contracts の enum 定義順)で flag を整列する。
 * toggle 順差を phantom dirty にしないため、比較時は常にこの順へ揃える。
 */
const FLAG_CANONICAL_ORDER: ReadonlyMap<string, number> = new Map(
  prescriptionDraftFlagSchema.options.map((flag, index) => [flag, index]),
);
export function sortDraftFlagsCanonically(
  flags: readonly PrescriptionDraftFlag[],
): PrescriptionDraftFlag[] {
  return [...flags].sort(
    (left, right) =>
      (FLAG_CANONICAL_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (FLAG_CANONICAL_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * 比較用に wire content から行の同一性 ID を落とす。
 * UI 行の rpGroupId/rpItemId は新規行で毎回採番されるため、
 * 「内容が同じ」かの判定に identity を混ぜると空行同士も不一致になる。
 */
function stripRpIdentity(
  content: PrescriptionDraftContent,
): PrescriptionDraftContent {
  return {
    ...content,
    flags: sortDraftFlagsCanonically(content.flags),
    rpGroups: content.rpGroups.map((group) => ({
      ...group,
      rpGroupId: "",
      items: group.items.map((item) => ({ ...item, rpItemId: "" })),
    })),
  };
}

/**
 * snapshot が永続化対象を持たない(= 全行空かつ header 未入力)か。
 * toPrescriptionDraftContent は全空 draft を拒否するため、
 * 空同士の比較は materialize を通さずここで判定する。
 */
function isDraftSnapshotEmpty(snapshot: PrescriptionDraftSnapshot): boolean {
  return (
    snapshot.rows.every(isDraftRowEmpty) &&
    snapshot.prescriptionType.trim().length === 0 &&
    snapshot.prescriptionDate.trim().length === 0 &&
    snapshot.defaultDays.trim().length === 0 &&
    snapshot.options.length === 0 &&
    snapshot.note.trim().length === 0 &&
    snapshot.institutionCode.trim().length === 0 &&
    snapshot.institutionName.trim().length === 0 &&
    snapshot.prescriberName.trim().length === 0 &&
    snapshot.issueDate.trim().length === 0 &&
    snapshot.validUntil.trim().length === 0 &&
    snapshot.refillTotal.trim().length === 0 &&
    snapshot.refillRemaining.trim().length === 0 &&
    snapshot.splitDispensing.trim().length === 0
  );
}

export function prescriptionDraftSnapshotsEqual(
  left: PrescriptionDraftSnapshot,
  right: PrescriptionDraftSnapshot,
): boolean {
  try {
    return (
      JSON.stringify(stripRpIdentity(toPrescriptionDraftContent(left))) ===
      JSON.stringify(stripRpIdentity(toPrescriptionDraftContent(right)))
    );
  } catch {
    // 両方とも永続化不可の全空 draft なら等価とみなす
    // (blank baseline と blank draft の比較)。
    return isDraftSnapshotEmpty(left) && isDraftSnapshotEmpty(right);
  }
}

function endpoint(context: PrescriptionDraftContext): string {
  return resolveWebApiUrl(
    `/prescription-drafts/by-reception/${encodeURIComponent(context.receptionId)}`,
  );
}

/**
 * 応答の echo identity を要求文脈と照合する。スキーマ上は valid でも別
 * 受付・患者・業務日の下書きが返った場合、このタブへ取り込むと患者
 * 取り違えになるため INVALID_RESPONSE として失敗させる。
 */
function assertDraftResponseContext(
  response: PrescriptionDraftResponse,
  context: PrescriptionDraftContext,
): void {
  if (
    response.receptionId !== context.receptionId ||
    response.patientId !== context.patientId ||
    response.businessDate !== context.businessDate
  ) {
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答が要求した受付・患者・業務日と一致しませんでした。",
    );
  }
}

function classifyFailure(status: number): PrescriptionDraftApiError {
  if (status === 400) {
    return new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方下書きの入力内容を検証できませんでした。",
      status,
    );
  }
  if (status === 403) {
    return new PrescriptionDraftApiError(
      "PERMISSION_DENIED",
      "処方下書きを操作する権限がありません。",
      status,
    );
  }
  if (status === 404) {
    return new PrescriptionDraftApiError(
      "NOT_FOUND",
      "受付・患者・業務日の組み合わせを確認できませんでした。",
      status,
    );
  }
  if (status === 409) {
    return new PrescriptionDraftApiError(
      "CONFLICT",
      "別の端末または画面で下書きが更新されています。",
      status,
    );
  }
  return new PrescriptionDraftApiError(
    "UNAVAILABLE",
    "処方下書きAPIを利用できません。",
    status,
  );
}

export async function loadPrescriptionDraft(
  context: PrescriptionDraftContext,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs: number = PRESCRIPTION_DRAFT_TIMEOUT_MS,
): Promise<PrescriptionDraftResponse | null> {
  const query = new URLSearchParams({
    date: context.businessDate,
  });
  const requestSignal = draftRequestSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${endpoint(context)}?${query.toString()}`, {
      headers: devTenantHeaders(READ_SCOPES),
      cache: "no-store",
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (response.status === 204) return null;
  if (!response.ok) throw classifyFailure(response.status);

  let parsed: PrescriptionDraftResponse;
  try {
    parsed = prescriptionDraftResponseSchema.parse(await response.json());
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
  assertDraftResponseContext(parsed, context);
  return parsed;
}

export async function savePrescriptionDraft(
  context: PrescriptionDraftContext,
  input: {
    readonly expectedVersion: number;
    readonly snapshot: PrescriptionDraftSnapshot;
  },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs: number = PRESCRIPTION_DRAFT_TIMEOUT_MS,
): Promise<PrescriptionDraftSaveResponse> {
  let body: unknown;
  try {
    body = prescriptionDraftSaveRequestSchema.parse({
      patientId: context.patientId,
      businessDate: context.businessDate,
      expectedVersion: input.expectedVersion,
      draft: toPrescriptionDraftContent(input.snapshot),
    });
  } catch (error) {
    if (error instanceof PrescriptionDraftApiError) throw error;
    throw new PrescriptionDraftApiError(
      "INVALID_REQUEST",
      "処方下書きの入力内容を検証できませんでした。",
    );
  }

  const requestSignal = draftRequestSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(endpoint(context), {
      method: "PUT",
      headers: {
        ...devTenantHeaders(WRITE_SCOPES),
        "content-type": "application/json",
        ...(input.expectedVersion === 0
          ? {}
          : { "if-match": `"${input.expectedVersion}"` }),
      },
      cache: "no-store",
      body: JSON.stringify(body),
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "UNAVAILABLE",
      "処方下書きAPIへ接続できませんでした。",
    );
  }

  if (!response.ok) throw classifyFailure(response.status);

  let parsed: PrescriptionDraftSaveResponse;
  try {
    parsed = prescriptionDraftSaveResponseSchema.parse(await response.json());
  } catch (error) {
    if (signal?.aborted === true) throw error;
    if (requestSignal.aborted) throw draftTimeoutError();
    throw new PrescriptionDraftApiError(
      "INVALID_RESPONSE",
      "処方下書きAPIの応答形式を検証できませんでした。",
    );
  }
  assertDraftResponseContext(parsed, context);
  return parsed;
}
