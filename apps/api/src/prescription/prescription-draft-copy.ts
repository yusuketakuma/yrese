import type {
  PrescriptionRpGroup,
  PrescriptionRpMedicationRef,
  PrescriptionRpUsageRef,
  PrescriptionDraftContent,
  ReceptionQueueEntry,
} from '@yrese/contracts';
import type {
  PharmacyId,
  PrescriptionId,
  TenantId,
} from '@yrese/shared-kernel';

import type {
  MasterReadRepository,
} from '../master/master-repository.js';
import type { ReceptionRepository } from '../reception/reception-repository.js';
import type { PrescriptionDraftLookupInput } from './prescription-draft-types.js';

/**
 * 確定対象の原本 metadata 必須項目(WP-7402 packet §5 + 000017 CHECK の
 * 非 NULL 分岐に対応)。処方区分・処方日・用法日数の header 項目と、
 * sourceMetadata の原本記載項目の両方を要求する。
 */
export function scopeKey(input: PrescriptionDraftLookupInput): string {
  return JSON.stringify([
    "yrese.prescription-draft.v1",
    input.tenantId,
    input.pharmacyId,
    input.receptionId,
  ]);
}

export async function receptionMatches(
  repository: ReceptionRepository,
  input: PrescriptionDraftLookupInput,
  requireEditable: boolean,
): Promise<ReceptionQueueEntry | undefined> {
  const entries = await repository.list({
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    date: input.businessDate,
  });
  return entries.find(
    (entry) =>
      entry.receptionId === input.receptionId &&
      (!requireEditable ||
        entry.receptionStatus === "WAITING" ||
        entry.receptionStatus === "IN_PROGRESS"),
  );
}

/**
 * WP-7304 / PRD-001 M4: 前回 Do の複製 content を組み立てる。
 * - rpGroups の resolved ref を asOf(複製先業務日)の現行 master 版へ
 *   localCode 一致で再解決し、版なし・品目廃止は旧表示文で
 *   UNRESOLVED_TEXT へ降格(confirm guard が RX-0001 で止める)。
 * - sourceMetadata/prescriptionDate は新原本前提で null リセット。
 * - rows は legacy 経路の読み替えに任せてそのまま引き継ぐ。
 */
export async function copiedContentFromPriorVersion(
  masters: MasterReadRepository,
  scope: { readonly tenantId: TenantId; readonly pharmacyId: PharmacyId },
  content: PrescriptionDraftContent,
  asOf: string,
): Promise<PrescriptionDraftContent> {
  const [medicationMaster, usageMaster] = await Promise.all([
    masters.list({ ...scope, kind: "medication", asOf }),
    masters.list({ ...scope, kind: "usage", asOf }),
  ]);
  const medicationItems =
    medicationMaster.kind === "listed" ? medicationMaster.items : [];
  const usageItems = usageMaster.kind === "listed" ? usageMaster.items : [];
  const medicationVersionId =
    medicationMaster.kind === "listed"
      ? medicationMaster.masterVersion.masterVersionId
      : undefined;
  const usageVersionId =
    usageMaster.kind === "listed"
      ? usageMaster.masterVersion.masterVersionId
      : undefined;

  const reresolveMedication = async (
    ref: PrescriptionRpMedicationRef,
  ): Promise<PrescriptionRpMedicationRef> => {
    if (ref.kind === "unresolved") return ref;
    const prior = await masters.findMedicationItemById(
      scope,
      ref.medicationItemId,
    );
    if (prior === undefined) {
      // MST-001 append-only 前提の breach。fail-closed。
      throw new Error("Prior medication reference could not be resolved");
    }
    const current = medicationItems.find(
      (item): item is Extract<typeof item, { medicationItemId: string }> =>
        "medicationItemId" in item && item.localCode === prior.localCode,
    );
    if (medicationVersionId === undefined || current === undefined) {
      return { kind: "unresolved", text: prior.displayText };
    }
    return {
      kind: "resolved",
      masterVersionId: medicationVersionId,
      medicationItemId: current.medicationItemId,
    };
  };

  const reresolveUsage = async (
    ref: PrescriptionRpUsageRef,
  ): Promise<PrescriptionRpUsageRef> => {
    if (ref.kind === "unresolved") return ref;
    const prior = await masters.findUsageItemById(scope, ref.usageItemId);
    if (prior === undefined) {
      throw new Error("Prior usage reference could not be resolved");
    }
    const current = usageItems.find(
      (item): item is Extract<typeof item, { usageItemId: string }> =>
        "usageItemId" in item && item.localCode === prior.localCode,
    );
    if (usageVersionId === undefined || current === undefined) {
      return { kind: "unresolved", text: prior.displayText };
    }
    return { kind: "resolved", usageItemId: current.usageItemId };
  };

  const rpGroups: PrescriptionRpGroup[] = [];
  for (const group of content.rpGroups) {
    const items: PrescriptionRpGroup["items"][number][] = [];
    for (const item of group.items) {
      items.push({
        ...item,
        medication: await reresolveMedication(item.medication),
      });
    }
    rpGroups.push({
      ...group,
      usage: await reresolveUsage(group.usage),
      items,
    });
  }
  return {
    ...content,
    prescriptionDate: null,
    sourceMetadata: null,
    rpGroups,
  };
}

