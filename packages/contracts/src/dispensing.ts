import { z } from "zod";

import {
  actorIdWireSchema,
  dispensingIdWireSchema,
  prescriptionIdWireSchema,
} from "./wire-id.js";
import {
  normalizedRpText,
  PRESCRIPTION_DRAFT_MAX_VERSION,
} from "./prescription-draft.js";
import { prescriptionLifecycleHeadersSchema } from "./prescription-lifecycle.js";

/**
 * 調剤記録(DispensingRecord)の wire shape(WP-7404、DOM-002 §5、
 * DOM-004 §1、API-021 dispensing_record_contract、
 * packet docs/research/wp7404_pre_review_packet_20260919.md)。
 *
 * - 対象は確定処方「版」(prescription_versions)。1 版 1 記録。
 * - create は dispensing:write、confirm は dispensing:confirm +
 *   SEC-010 ACTIVE 資格。確認で DISPENSING_RECORDED へ単方向遷移。
 * - 後発品変更(処方品目と異なる調剤品目)は
 *   genericSubstitutionPermitted=true + genericNameCode 一致を要求。
 */

export const DISPENSING_ITEM_NOTE_MAX_LENGTH = 500;
export const DISPENSING_ITEM_QUANTITY_MAX_LENGTH = 64;
export const DISPENSING_STOCK_ADJUSTMENT_MAX_LENGTH = 500;
export const DISPENSING_MAX_ITEMS = 200;

export const dispensingStatusSchema = z.enum(["DISPENSING_RECORDED"]);
export type DispensingStatus = z.infer<typeof dispensingStatusSchema>;

const requiredText = (maximum: number) =>
  normalizedRpText(maximum).refine((value) => value.length > 0, {
    message: "text must not be empty",
  });

/**
 * 実調剤品目: resolved master item id または free text の排他どちらか必須
 * (fail-open な省略は許さない)。
 */
export const dispensingItemInputSchema = z
  .object({
    rpItemId: z.uuid(),
    dispensedMedicationItemId: z.uuid().nullable(),
    // trim 後の空文字は「指定なし」とみなして null 正規化する
    // (id 併記で永続化されると DB の XOR CHECK を破る)。
    dispensedText: normalizedRpText(500)
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    /** 数量は記録値(数値化しない — DOM-002 §4.2b 規則)。 */
    quantity: requiredText(DISPENSING_ITEM_QUANTITY_MAX_LENGTH),
    /** 残薬調整の記録(任意)。 */
    remainingStockAdjustment: normalizedRpText(
      DISPENSING_STOCK_ADJUSTMENT_MAX_LENGTH,
    ).nullable(),
    note: normalizedRpText(DISPENSING_ITEM_NOTE_MAX_LENGTH).nullable(),
  })
  .strict()
  .superRefine((item, context) => {
    const hasItem = item.dispensedMedicationItemId !== null;
    const hasText =
      item.dispensedText !== null && item.dispensedText.length > 0;
    if (hasItem === hasText) {
      context.addIssue({
        code: "custom",
        message:
          "exactly one of dispensedMedicationItemId or dispensedText is required",
      });
    }
  });
export type DispensingItemInput = z.infer<typeof dispensingItemInputSchema>;

export const dispensingRecordCreateRequestSchema = z
  .object({
    prescriptionId: prescriptionIdWireSchema,
    prescriptionVersion: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_VERSION),
    dispensingDate: z.iso.date(),
    items: z
      .array(dispensingItemInputSchema)
      .min(1)
      .max(DISPENSING_MAX_ITEMS),
  })
  .strict();
export type DispensingRecordCreateRequest = z.infer<
  typeof dispensingRecordCreateRequestSchema
>;

/** confirm は body なし(冪等 key は header)。 */
export const dispensingConfirmRequestSchema = z.object({}).strict();
export type DispensingConfirmRequest = z.infer<
  typeof dispensingConfirmRequestSchema
>;

export const dispensingConfirmParamsSchema = z.object({
  dispensingId: dispensingIdWireSchema,
});
export type DispensingConfirmParams = z.infer<
  typeof dispensingConfirmParamsSchema
>;

export const dispensingHeadersSchema = prescriptionLifecycleHeadersSchema;
export type DispensingHeaders = z.infer<typeof dispensingHeadersSchema>;

/** 永続化済みの調剤実施行。 */
export const dispensingItemSchema = z.object({
  rpItemId: z.uuid(),
  /** source 処方 item の resolved 品目(unresolved 行は null)。 */
  prescribedMedicationItemId: z.uuid().nullable(),
  dispensedMedicationItemId: z.uuid().nullable(),
  dispensedText: normalizedRpText(500).nullable(),
  quantity: requiredText(DISPENSING_ITEM_QUANTITY_MAX_LENGTH),
  remainingStockAdjustment: normalizedRpText(
    DISPENSING_STOCK_ADJUSTMENT_MAX_LENGTH,
  ).nullable(),
  note: normalizedRpText(DISPENSING_ITEM_NOTE_MAX_LENGTH).nullable(),
  /** 調剤者(MVP は操作者=調剤者)。 */
  dispensedBy: actorIdWireSchema,
});
export type DispensingItem = z.infer<typeof dispensingItemSchema>;

export const dispensingRecordViewSchema = z.object({
  dispensingId: dispensingIdWireSchema,
  prescriptionId: prescriptionIdWireSchema,
  prescriptionVersion: z.number().int().min(1),
  dispensingDate: z.iso.date(),
  items: z.array(dispensingItemSchema).min(1).max(DISPENSING_MAX_ITEMS),
  status: dispensingStatusSchema.nullable(),
  confirmedBy: actorIdWireSchema.nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  createdBy: actorIdWireSchema,
  createdAt: z.iso.datetime(),
});
export type DispensingRecordView = z.infer<typeof dispensingRecordViewSchema>;

export const dispensingRecordCreateResponseSchema =
  dispensingRecordViewSchema.extend({
    replayed: z.boolean(),
  });
export type DispensingRecordCreateResponse = z.infer<
  typeof dispensingRecordCreateResponseSchema
>;

export const dispensingConfirmResponseSchema =
  dispensingRecordViewSchema.extend({
    replayed: z.boolean(),
  });
export type DispensingConfirmResponse = z.infer<
  typeof dispensingConfirmResponseSchema
>;
