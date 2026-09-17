import { z } from "zod";

import {
  actorIdWireSchema,
  patientIdWireSchema,
  prescriptionIdWireSchema,
  receptionIdWireSchema,
} from "./wire-id.js";
import {
  PRESCRIPTION_DRAFT_MAX_VERSION,
  prescriptionDraftTypeSchema,
  prescriptionStatusWireSchema,
} from "./prescription-draft.js";

/**
 * 処方確認・確定 command の wire shape(WP-7402、DOM-004 §1 / SEC-010 /
 * MOD-005 §2.3)。
 *
 * confirm/finalize は副作用のある command で、request body は持たない
 * (冪等性は Idempotency-Key header、対象は path の prescriptionId)。
 * response は遷移後のライフサイクル view を返す。
 */

export const prescriptionLifecycleParamsSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
});

/** confirm/finalize は冪等 command のため Idempotency-Key 必須。 */
export const prescriptionLifecycleHeadersSchema = z.object({
  "idempotency-key": z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
});
export type PrescriptionLifecycleHeaders = z.infer<
  typeof prescriptionLifecycleHeadersSchema
>;
export type PrescriptionLifecycleParams = z.infer<
  typeof prescriptionLifecycleParamsSchema
>;

/**
 * 遷移後の処方ライフサイクル view。confirmed 系は confirm 成功後に必ず存在、
 * finalized 系と prescriptionVersion は finalize 成功後にのみ存在。
 */
export const prescriptionLifecycleViewSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
  receptionId: receptionIdWireSchema,
  patientId: patientIdWireSchema,
  prescriptionType: prescriptionDraftTypeSchema,
  status: prescriptionStatusWireSchema,
  /** draft 行の編集版(draft version)。確定 snapshot の版ではない。 */
  draftVersion: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_VERSION),
  /** prescription_versions の immutable snapshot 版。finalize 前は null。 */
  prescriptionVersion: z
    .number()
    .int()
    .min(1)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION)
    .nullable(),
  /** 確定対象 content の hash(draft content hash と一致)。 */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  confirmedBy: actorIdWireSchema,
  confirmedAt: z.iso.datetime(),
  finalizedBy: actorIdWireSchema.nullable(),
  finalizedAt: z.iso.datetime().nullable(),
}).superRefine((view, context) => {
  const finalized =
    view.prescriptionVersion !== null ||
    view.finalizedBy !== null ||
    view.finalizedAt !== null;
  if (view.status === "PRESCRIPTION_FINALIZED") {
    if (
      view.prescriptionVersion === null ||
      view.finalizedBy === null ||
      view.finalizedAt === null
    ) {
      context.addIssue({
        code: "custom",
        message:
          "finalized lifecycle view requires prescriptionVersion, finalizedBy, and finalizedAt",
      });
    }
    return;
  }
  if (finalized) {
    context.addIssue({
      code: "custom",
      message:
        "finalized fields must be null before PRESCRIPTION_FINALIZED",
    });
  }
});

export type PrescriptionLifecycleView = z.infer<
  typeof prescriptionLifecycleViewSchema
>;
