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

type ComparableRow = Pick<DraftRow, "drug" | "usage" | "days" | "quantity">;

function normalizedText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function rowSignature(row: Pick<DraftRow, "usage" | "days" | "quantity">): string {
  return [row.usage, row.days, row.quantity].map(normalizedText).join("|");
}

function groupRowsByDrug(rows: readonly ComparableRow[]): Map<string, ComparableRow[]> {
  const groups = new Map<string, ComparableRow[]>();
  for (const row of rows) {
    const drug = normalizedText(row.drug);
    if (!drug) continue;
    const group = groups.get(drug);
    if (group === undefined) groups.set(drug, [row]);
    else group.push(row);
  }
  return groups;
}

function signatureCounts(rows: readonly ComparableRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const signature = rowSignature(row);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return counts;
}

export function pastPrescriptionDurationLabel(item: PastPrescription): string {
  const durations = new Set(item.rows.map((row) => row.days.trim()).filter(Boolean));
  if (durations.size === 0) return "日数不明";
  if (durations.size > 1) return "日数混在";
  const duration = durations.values().next().value;
  return duration === undefined ? "日数不明" : `${duration}日分`;
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

export function buildDraftRowsFromPastPrescription(
  item: PastPrescription,
): DraftRow[] {
  return item.rows.map((row, index) => ({ id: index + 1, ...row }));
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

/**
 * 薬剤名ごとのmultiset比較。重複RPをMapの1行へ縮約しない。
 * 同一signatureを先に相殺し、残った同名薬を内容変更、余剰を追加・削除として数える。
 */
export function summarizePrescriptionReplacement(
  currentRows: readonly DraftRow[],
  pastPrescription: PastPrescription,
): PrescriptionReplacementSummary {
  const currentGroups = groupRowsByDrug(currentRows);
  const pastGroups = groupRowsByDrug(pastPrescription.rows);
  const drugs = new Set([...currentGroups.keys(), ...pastGroups.keys()]);

  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const drug of drugs) {
    const current = currentGroups.get(drug) ?? [];
    const past = pastGroups.get(drug) ?? [];
    const currentCounts = signatureCounts(current);
    const pastCounts = signatureCounts(past);
    const signatures = new Set([...currentCounts.keys(), ...pastCounts.keys()]);

    let exactMatches = 0;
    for (const signature of signatures) {
      exactMatches += Math.min(
        currentCounts.get(signature) ?? 0,
        pastCounts.get(signature) ?? 0,
      );
    }

    unchanged += exactMatches;
    const currentRemainder = current.length - exactMatches;
    const pastRemainder = past.length - exactMatches;
    const pairedChanges = Math.min(currentRemainder, pastRemainder);
    changed += pairedChanges;
    removed += currentRemainder - pairedChanges;
    added += pastRemainder - pairedChanges;
  }

  return { added, removed, changed, unchanged };
}
