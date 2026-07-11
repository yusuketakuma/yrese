import { z } from "zod";

import { actorIdWireSchema } from "./wire-id.js";

/**
 * 監査ログ閲覧契約(SCR-028 / R-AUDIT)。
 *
 * 目的: who/when/what の証跡閲覧(医療情報システム安全管理GL 監査ログ要求)+
 * hash chain 検証結果(改ざん検知状態)の表示。
 *
 * これは @yrese/audit の AuditEvent の**表示投影**であり、hash 素材や envelope 内部
 * (sequenceNumber/payloadHash 等)は公開しない。auditEventType は前方互換のため
 * enum ではなく形式検証つき文字列で受ける(検証の正本は @yrese/audit 側)。
 * targetRef.id は識別子であり氏名等の PHI を入れてはならない。
 */

export const AUDIT_LOG_DEFAULT_LIMIT = 50;
export const AUDIT_LOG_MAX_LIMIT = 200;

/** dot 区切り snake_case セグメント(@yrese/audit parseAuditEventType と同形式)。 */
const auditEventTypePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*){1,2}$/;

export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(AUDIT_LOG_MAX_LIMIT).default(AUDIT_LOG_DEFAULT_LIMIT),
});

export const auditLogEntrySchema = z.object({
  eventId: z.string().min(1).max(128),
  /** 実施日時(ISO 8601)。 */
  wallClock: z.iso.datetime(),
  /** 実施者(ユーザID。氏名は含めない)。 */
  actorId: actorIdWireSchema,
  auditEventType: z.string().regex(auditEventTypePattern),
  targetRef: z.object({
    kind: z.string().min(1).max(64),
    id: z.string().min(1).max(128),
  }),
  outcome: z.enum(["success", "denied", "failed"]),
  reasonCode: z.string().min(1).max(64).optional(),
  businessReasonCode: z.string().min(1).max(64).optional(),
});

/**
 * hash chain 検証結果(@yrese/audit verifyAuditHashChain の表示投影)。
 * ok=false は改ざん・破損の可能性を示す重大状態であり、UI は必ず明示する。
 */
export const auditChainVerificationSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    checkedCount: z.number().int().min(0),
  }),
  z.object({
    ok: z.literal(false),
    checkedCount: z.number().int().min(0),
    breakIndex: z.number().int().min(0),
    reason: z.enum(["prev_hash_mismatch", "entry_hash_mismatch", "hash_format_invalid"]),
  }),
]);

export const auditLogResponseSchema = z.object({
  /** 新しい順(wallClock desc)。 */
  entries: z.array(auditLogEntrySchema),
  /** 全保存イベントに対する chain 検証(返却分だけの検証ではない)。 */
  chainVerification: auditChainVerificationSchema,
  /** 保存イベント総数(entries は limit で切られうる)。 */
  totalCount: z.number().int().min(0),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditChainVerification = z.infer<typeof auditChainVerificationSchema>;
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
