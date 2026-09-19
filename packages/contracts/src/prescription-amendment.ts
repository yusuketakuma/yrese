import { z } from "zod";

import {
  actorIdWireSchema,
  prescriptionIdWireSchema,
  prescriptionInquiryIdWireSchema,
} from "./wire-id.js";
import {
  normalizedRpText,
  PRESCRIPTION_DRAFT_MAX_VERSION,
  prescriptionDraftContentSchema,
} from "./prescription-draft.js";
import { prescriptionLifecycleHeadersSchema } from "./prescription-lifecycle.js";

/**
 * 処方訂正(新版)と疑義照会記録の wire shape(WP-7403、DOM-002 §4/§5、
 * DOM-004 §1、packet docs/research/wp7403_pre_review_packet_20260919.md)。
 *
 * - inquiry は OPEN(answer 未記録)/ RESOLVED(answer + result 記録済み)の
 *   導出状態。回答は write-once で、再回答は新 inquiry を起票する。
 * - amend は `status = PRESCRIPTION_FINALIZED` のみ許可し、根拠となる
 *   RESOLVED かつ result=CHANGED の inquiry を必須とする。
 *   `prescription_drafts` は触らず、`prescription_versions` の
 *   MAX(version) が確定後の現行 content の権威となる。
 */

export const PRESCRIPTION_INQUIRY_DIRECTED_TO_MAX_LENGTH = 500;
export const PRESCRIPTION_INQUIRY_CONTENT_MAX_LENGTH = 2_000;
export const PRESCRIPTION_INQUIRY_ANSWER_MAX_LENGTH = 2_000;

export const prescriptionInquiryResultSchema = z.enum([
  "UNCHANGED",
  "CHANGED",
]);
export type PrescriptionInquiryResult = z.infer<
  typeof prescriptionInquiryResultSchema
>;

export const prescriptionInquiryStatusSchema = z.enum(["OPEN", "RESOLVED"]);
export type PrescriptionInquiryStatus = z.infer<
  typeof prescriptionInquiryStatusSchema
>;

const requiredText = (maximum: number) =>
  normalizedRpText(maximum).refine((value) => value.length > 0, {
    message: "text must not be empty",
  });

export const prescriptionInquiryParamsSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
});
export type PrescriptionInquiryParams = z.infer<
  typeof prescriptionInquiryParamsSchema
>;

export const prescriptionInquiryAnswerParamsSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
  inquiryId: prescriptionInquiryIdWireSchema,
});
export type PrescriptionInquiryAnswerParams = z.infer<
  typeof prescriptionInquiryAnswerParamsSchema
>;

export const prescriptionVersionParamsSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
  version: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION),
});
export type PrescriptionVersionParams = z.infer<
  typeof prescriptionVersionParamsSchema
>;

/** amend/inquiry command は冪等 command のため Idempotency-Key 必須。 */
export const prescriptionAmendmentHeadersSchema =
  prescriptionLifecycleHeadersSchema;
export type PrescriptionAmendmentHeaders = z.infer<
  typeof prescriptionAmendmentHeadersSchema
>;

export const prescriptionInquiryCreateRequestSchema = z.object({
  directedTo: requiredText(PRESCRIPTION_INQUIRY_DIRECTED_TO_MAX_LENGTH),
  content: requiredText(PRESCRIPTION_INQUIRY_CONTENT_MAX_LENGTH),
});
export type PrescriptionInquiryCreateRequest = z.infer<
  typeof prescriptionInquiryCreateRequestSchema
>;

export const prescriptionInquiryAnswerRequestSchema = z.object({
  answer: requiredText(PRESCRIPTION_INQUIRY_ANSWER_MAX_LENGTH),
  result: prescriptionInquiryResultSchema,
});
export type PrescriptionInquiryAnswerRequest = z.infer<
  typeof prescriptionInquiryAnswerRequestSchema
>;

export const prescriptionAmendRequestSchema = z.object({
  inquiryId: prescriptionInquiryIdWireSchema,
  content: prescriptionDraftContentSchema,
});
export type PrescriptionAmendRequest = z.infer<
  typeof prescriptionAmendRequestSchema
>;

export const prescriptionInquiryViewSchema = z
  .object({
    inquiryId: prescriptionInquiryIdWireSchema,
    prescriptionId: prescriptionIdWireSchema,
    directedTo: z.string(),
    content: z.string(),
    status: prescriptionInquiryStatusSchema,
    answer: z.string().nullable(),
    answeredBy: actorIdWireSchema.nullable(),
    answeredAt: z.iso.datetime().nullable(),
    result: prescriptionInquiryResultSchema.nullable(),
    createdBy: actorIdWireSchema,
    createdAt: z.iso.datetime(),
  })
  .superRefine((view, context) => {
    const answered =
      view.answer !== null ||
      view.answeredBy !== null ||
      view.answeredAt !== null ||
      view.result !== null;
    if (view.status === "RESOLVED") {
      if (
        view.answer === null ||
        view.answeredBy === null ||
        view.answeredAt === null ||
        view.result === null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "resolved inquiry requires answer, answeredBy, answeredAt, and result",
        });
      }
      return;
    }
    if (answered) {
      context.addIssue({
        code: "custom",
        message: "answer fields must be null while inquiry is OPEN",
      });
    }
  });
export type PrescriptionInquiryView = z.infer<
  typeof prescriptionInquiryViewSchema
>;

export const prescriptionInquiryListResponseSchema = z.object({
  inquiries: z.array(prescriptionInquiryViewSchema),
});
export type PrescriptionInquiryListResponse = z.infer<
  typeof prescriptionInquiryListResponseSchema
>;

export const prescriptionVersionViewSchema = z
  .object({
    prescriptionId: prescriptionIdWireSchema,
    version: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_VERSION),
    content: prescriptionDraftContentSchema,
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    supersedesVersion: z.number().int().min(1).nullable(),
    inquiryId: prescriptionInquiryIdWireSchema.nullable(),
    amendedBy: actorIdWireSchema.nullable(),
    amendedAt: z.iso.datetime().nullable(),
    confirmedBy: actorIdWireSchema,
    confirmedAt: z.iso.datetime(),
    finalizedBy: actorIdWireSchema,
    finalizedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .superRefine((view, context) => {
    const amended =
      view.supersedesVersion !== null ||
      view.inquiryId !== null ||
      view.amendedBy !== null ||
      view.amendedAt !== null;
    if (view.version > 1) {
      if (
        view.supersedesVersion === null ||
        view.inquiryId === null ||
        view.amendedBy === null ||
        view.amendedAt === null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "amended version requires supersedesVersion, inquiryId, amendedBy, and amendedAt",
        });
      } else if (view.supersedesVersion !== view.version - 1) {
        context.addIssue({
          code: "custom",
          message: "supersedesVersion must equal version - 1",
        });
      }
      return;
    }
    if (amended) {
      context.addIssue({
        code: "custom",
        message: "amendment fields must be null on version 1",
      });
    }
  });
export type PrescriptionVersionView = z.infer<
  typeof prescriptionVersionViewSchema
>;

export const prescriptionVersionListResponseSchema = z.object({
  versions: z.array(prescriptionVersionViewSchema),
});
export type PrescriptionVersionListResponse = z.infer<
  typeof prescriptionVersionListResponseSchema
>;

/** amend 成功応答は作成された新版の version view。 */
export const prescriptionAmendResponseSchema = prescriptionVersionViewSchema;
export type PrescriptionAmendResponse = z.infer<
  typeof prescriptionAmendResponseSchema
>;
