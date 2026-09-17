/**
 * 処方下書きRP行の純関数(SCR-004 / WP-7302 構造化)。
 *
 * 過去処方の複写・差分要約は、患者固有の過去処方APIが未接続である以上
 * 実データを持てないため保持しない(合成データ前提の実装を残さない)。
 *
 * WP-7302(DOM-002 §4.2b): 各 UI 行は 1 rpGroup + 1 rpItem に対応する。
 * サーバー上の multi-item group は同一 rpGroupId を共有する複数行へ展開し、
 * 保存時に同 ID の行を 1 つの group へ再結合する(構造を壊さない)。
 */
export type DraftUsageMode = "code" | "text";
export type DraftMedicationMode = "master" | "text";
export type DraftGenericSubstitution = "" | "permitted" | "forbidden";

export interface DraftRow {
  /** UI ローカル識別子(React key・削除操作用)。wire には出さない。 */
  readonly id: number;
  /** wire rpGroupId。同じ group に属する行は同じ値を共有する。 */
  readonly rpGroupId: string;
  /** wire rpItemId(行ごとに一意)。 */
  readonly rpItemId: string;
  /** wire dosageForm enum 値。空文字は未指定(UNSPECIFIED)。 */
  readonly dosageForm: string;
  readonly usageMode: DraftUsageMode;
  /** usageMode=code の選択値。 */
  readonly usageItemId: string;
  /** 選択済みコードの表示名(画面表示のみ・wire 非含有)。 */
  readonly usageItemLabel: string;
  /** usageMode=text の自由記載。 */
  readonly usage: string;
  readonly medicationMode: DraftMedicationMode;
  /** medicationMode=master の選択値。 */
  readonly masterVersionId: string;
  readonly medicationItemId: string;
  /** 選択済み薬剤の表示名(画面表示のみ・wire 非含有)。 */
  readonly medicationItemLabel: string;
  /** medicationMode=text の自由記載。 */
  readonly drug: string;
  readonly doseOnce: string;
  readonly dosePerDay: string;
  /** wire daysOrCount。 */
  readonly days: string;
  /** wire doseTotal。 */
  readonly quantity: string;
  readonly unit: string;
  readonly genericNamePrescription: boolean;
  readonly genericSubstitution: DraftGenericSubstitution;
}

export function createDraftRowId(): string {
  return crypto.randomUUID();
}

export function createBlankDraftRow(id: number): DraftRow {
  return {
    id,
    rpGroupId: createDraftRowId(),
    rpItemId: createDraftRowId(),
    dosageForm: "",
    usageMode: "text",
    usageItemId: "",
    usageItemLabel: "",
    usage: "",
    medicationMode: "text",
    masterVersionId: "",
    medicationItemId: "",
    medicationItemLabel: "",
    drug: "",
    doseOnce: "",
    dosePerDay: "",
    days: "",
    quantity: "",
    unit: "",
    genericNamePrescription: false,
    genericSubstitution: "",
  };
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isDraftRowEmpty(row: DraftRow): boolean {
  return (
    [
      row.usage,
      row.drug,
      row.doseOnce,
      row.dosePerDay,
      row.days,
      row.quantity,
      row.unit,
    ].every((value) => normalizedText(value).length === 0) &&
    // モードと不整合な参照(text モードに残った id)は orphan であり
    // 実体のない内容として数えない — 行削除やモード切替の残余を
    // phantom unresolved item へ変換しないため。
    (row.usageMode !== "code" || row.usageItemId.length === 0) &&
    (row.medicationMode !== "master" ||
      row.medicationItemId.length === 0) &&
    // 非既定モードの選択は不完全な入力として残し、空行フィルタで
    // 落とさず保存時の具体的な未選択エラーへ流す。
    row.usageMode === "text" &&
    row.medicationMode === "text" &&
    row.dosageForm.length === 0 &&
    !row.genericNamePrescription &&
    row.genericSubstitution.length === 0
  );
}

export function createBlankDraftRows(): DraftRow[] {
  return [createBlankDraftRow(1)];
}

export function removeDraftRow(rows: readonly DraftRow[], id: number): DraftRow[] {
  const remaining = rows.filter((row) => row.id !== id);
  return remaining.length > 0 ? [...remaining] : createBlankDraftRows();
}
