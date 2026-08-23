import { z } from "zod";

import { receptionIdWireSchema } from "./wire-id.js";

/**
 * Event Catalog v0(WP-6004、SSOT: API-012 webhook_event_catalog PROPOSED)。
 *
 * partner へ配送する公開 event の wire shape。payload は識別子と版だけを運び、
 * 患者識別子・氏名・薬剤名などの本文は載せない(data minimization)。本文は
 * scope 付き read API で取得する。内部 outbox `event_type` と公開 event 名は 1:1。
 */
export const PARTNER_EVENT_TYPES = ["reception.created"] as const;
export type PartnerEventType = (typeof PARTNER_EVENT_TYPES)[number];

export const PARTNER_EVENT_SCHEMA_VERSION = 1;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

const opaqueIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !controlCharacterPattern.test(value), {
    message: "id must not contain control characters",
  });

export const partnerEventEnvelopeSchema = z.object({
  /** outbox_event_id。受信側の冪等鍵(API-013)。 */
  eventId: opaqueIdSchema,
  eventType: z.enum(PARTNER_EVENT_TYPES),
  schemaVersion: z.literal(PARTNER_EVENT_SCHEMA_VERSION),
  /** outbox 行の created_at(ISO 8601、timezone 必須)。 */
  occurredAt: z.iso.datetime({ offset: true }),
  /** 配送元の監査 event id。Provenance 突合用で、監査本文は含まない。 */
  auditEventId: opaqueIdSchema,
});

export const receptionCreatedPartnerEventSchema = partnerEventEnvelopeSchema.extend({
  eventType: z.literal("reception.created"),
  aggregate: z.object({
    type: z.literal("reception"),
    id: receptionIdWireSchema,
  }),
});

export const partnerEventSchema = z.discriminatedUnion("eventType", [
  receptionCreatedPartnerEventSchema,
]);

export type PartnerEvent = z.infer<typeof partnerEventSchema>;
export type ReceptionCreatedPartnerEvent = z.infer<typeof receptionCreatedPartnerEventSchema>;

/** 公開 event に含めてはならない key(テストと投影で機械検証する)。 */
export const PARTNER_EVENT_FORBIDDEN_KEYS = [
  "patientId",
  "name",
  "kana",
  "birthDate",
  "sex",
  "patientNumber",
  "payload",
] as const;
