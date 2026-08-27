/**
 * 処方下書きRP行の純関数(SCR-004)。
 *
 * 過去処方の複写・差分要約は、患者固有の過去処方APIが未接続である以上
 * 実データを持てないため保持しない(合成データ前提の実装を残さない)。
 */
export interface DraftRow {
  readonly id: number;
  readonly drug: string;
  readonly usage: string;
  readonly days: string;
  readonly quantity: string;
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isDraftRowEmpty(
  row: Pick<DraftRow, "drug" | "usage" | "days" | "quantity">,
): boolean {
  return [row.drug, row.usage, row.days, row.quantity].every(
    (value) => normalizedText(value).length === 0,
  );
}

export function createBlankDraftRows(): DraftRow[] {
  return [{ id: 1, drug: "", usage: "", days: "", quantity: "" }];
}

export function removeDraftRow(rows: readonly DraftRow[], id: number): DraftRow[] {
  const remaining = rows.filter((row) => row.id !== id);
  return remaining.length > 0 ? [...remaining] : createBlankDraftRows();
}
