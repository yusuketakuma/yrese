import { createHash } from "node:crypto";

import {
  prescriptionDraftContentSchema,
  prescriptionDraftEffectiveRpGroups,
  prescriptionDraftFlagSchema,
  prescriptionDraftUnresolvedCounts,
  type PrescriptionDraftContent,
} from "@yrese/contracts";

export function isPrescriptionSourceMetadataComplete(
  draft: PrescriptionDraftContent,
): boolean {
  const metadata = draft.sourceMetadata;
  if (metadata === null) return false;
  return (
    draft.prescriptionType !== "UNSPECIFIED" &&
    draft.prescriptionDate !== null &&
    draft.defaultDays !== null &&
    metadata.issueDate !== null &&
    metadata.validUntil !== null &&
    metadata.prescriberName !== null &&
    metadata.medicalInstitution.name !== null
  );
}

/** confirm 可否の正本 guard: UNRESOLVED_TEXT 品目の残存を数える。 */
export function countUnresolvedPrescriptionItems(
  draft: PrescriptionDraftContent,
): number {
  return prescriptionDraftUnresolvedCounts(draft).unresolvedMedicationItems;
}

export const FLAG_ORDER: ReadonlyMap<string, number> = new Map(
  prescriptionDraftFlagSchema.options.map(
    (flag, index) => [flag, index] as const,
  ),
);

export function comparePrescriptionDraftFlags(
  left: string,
  right: string,
): number {
  return (
    (FLAG_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (FLAG_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function normalizePrescriptionDraftContent(
  value: unknown,
): PrescriptionDraftContent {
  // 信頼境界のparseはここで1回だけ。以降はparse済み値の並べ替えとコピーであり、
  // 再parseは値を変えない(trimは冪等、refinementは再構築後も成立)ため行わない。
  const parsed = prescriptionDraftContentSchema.parse(value);
  return {
    ...parsed,
    flags: [...parsed.flags].sort(comparePrescriptionDraftFlags),
    rows: parsed.rows.map((row) => ({ ...row })),
    rpGroups: parsed.rpGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    })),
  };
}

/**
 * DOM-002 §4.2b: 保存時の実効構造。rpGroups が正本であり、rows のみの入力は
 * UNRESOLVED_TEXT へ決定的に読み替える(deriveRpGroupsFromLegacyRows)。
 * prescription_draft_rows 旧構造は次版 draft から書かないため、保存内容の
 * rows は常に空とする。
 */
export function materializePrescriptionDraftContent(
  normalized: PrescriptionDraftContent,
): PrescriptionDraftContent {
  return {
    ...normalized,
    rows: [],
    rpGroups: prescriptionDraftEffectiveRpGroups(normalized).map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    })),
  };
}

function hashJsonDeterministically(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function normalizePrescriptionDraftContentWithHash(value: unknown): {
  readonly normalized: PrescriptionDraftContent;
  readonly contentHash: string;
} {
  const normalized = normalizePrescriptionDraftContent(value);
  return {
    normalized,
    contentHash: hashJsonDeterministically(normalized),
  };
}

/**
 * 保存用の normalize + hash。DOM-002 §4.2b の materialize(rows→UNRESOLVED_TEXT
 * 読み替え・rows 空化)を適用した実効構造に対して hash を計算する。
 */
export function normalizePrescriptionDraftContentForStorage(value: unknown): {
  readonly normalized: PrescriptionDraftContent;
  readonly contentHash: string;
} {
  const materialized = materializePrescriptionDraftContent(
    normalizePrescriptionDraftContent(value),
  );
  return {
    normalized: materialized,
    contentHash: hashJsonDeterministically(materialized),
  };
}

export function prescriptionDraftContentHash(
  value: PrescriptionDraftContent,
): string {
  return hashJsonDeterministically(
    normalizePrescriptionDraftContent(value),
  );
}

/**
 * WP-7205 以前に保存された draft の content hash は `sourceMetadata`/`rpGroups`
 * キーを含まない JSON から計算されている。両者は schema 末尾キーなので
 * 除去後も key order が一致する。
 */
export function prescriptionDraftContentHashWithoutSourceMetadata(
  value: PrescriptionDraftContent,
): string {
  const { sourceMetadata: _sourceMetadata, rpGroups: _rpGroups, ...legacy } =
    normalizePrescriptionDraftContent(value);
  return hashJsonDeterministically(legacy);
}

/**
 * 永続行の content_hash 照合候補。schema 改版で additive に追加された末尾キー
 * (rpGroups → sourceMetadata の順に除去)を段階的に落として旧形式 hash を
 * 再現する。wp-7302 以降の行は先頭候補が一致する。
 */
export function prescriptionDraftContentHashCandidates(
  value: PrescriptionDraftContent,
): readonly string[] {
  const normalized = normalizePrescriptionDraftContent(value);
  const { rpGroups: _rpGroups, ...withoutRpGroups } = normalized;
  const { sourceMetadata: _sourceMetadata, ...legacy } = withoutRpGroups;
  return [
    hashJsonDeterministically(normalized),
    hashJsonDeterministically(withoutRpGroups),
    hashJsonDeterministically(legacy),
  ];
}

