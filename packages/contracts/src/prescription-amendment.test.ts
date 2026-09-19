import { describe, expect, it } from "vitest";

import { partnerEventSchema } from "./partner-event.js";
import {
  PRESCRIPTION_INQUIRY_ANSWER_MAX_LENGTH,
  PRESCRIPTION_INQUIRY_CONTENT_MAX_LENGTH,
  PRESCRIPTION_INQUIRY_DIRECTED_TO_MAX_LENGTH,
  prescriptionAmendRequestSchema,
  prescriptionInquiryAnswerRequestSchema,
  prescriptionInquiryCreateRequestSchema,
  prescriptionInquiryViewSchema,
  prescriptionVersionParamsSchema,
  prescriptionVersionViewSchema,
} from "./prescription-amendment.js";

const draftContent = {
  prescriptionType: "OUTPATIENT",
  sourceMetadata: {
    medicalInstitution: { code: "1234567", name: "合成病院" },
    prescriberName: "合成 医師",
    issueDate: "2026-08-20",
    validUntil: "2026-08-24",
    refill: null,
    splitDispensing: null,
  },
  rpGroups: [
    {
      rpGroupId: "00000000-0000-4000-8000-0000000000a1",
      sequence: 1,
      dosageForm: "ORAL",
      usage: { kind: "unresolved", text: "1日1回 朝食後" },
      daysOrCount: 7,
      items: [
        {
          rpItemId: "00000000-0000-4000-8000-0000000000b1",
          sequence: 1,
          medication: {
            kind: "resolved",
            masterVersionId: "00000000-0000-4000-8000-0000000000c1",
            medicationItemId: "00000000-0000-4000-8000-0000000000d1",
          },
          doseOnce: null,
          dosePerDay: null,
          doseTotal: "7錠",
          unit: null,
          genericNamePrescription: false,
          genericSubstitutionPermitted: null,
        },
      ],
    },
  ],
  prescriptionDate: "2026-07-09",
  defaultDays: 7,
  flags: [],
  note: "",
  rows: [],
};

const openInquiry = {
  inquiryId: "inquiry-001",
  prescriptionId: "prescription-001",
  directedTo: "合成病院 処方医",
  content: "用量が用法と整合しない疑義",
  status: "OPEN",
  answer: null,
  answeredBy: null,
  answeredAt: null,
  result: null,
  createdBy: "actor-001",
  createdAt: "2026-08-25T00:00:00.000Z",
};

const version1 = {
  prescriptionId: "prescription-001",
  version: 1,
  content: draftContent,
  contentHash: "a".repeat(64),
  supersedesVersion: null,
  inquiryId: null,
  amendedBy: null,
  amendedAt: null,
  confirmedBy: "actor-001",
  confirmedAt: "2026-08-25T00:00:00.000Z",
  finalizedBy: "actor-001",
  finalizedAt: "2026-08-25T00:05:00.000Z",
  createdAt: "2026-08-25T00:05:00.000Z",
};

const version2 = {
  ...version1,
  version: 2,
  supersedesVersion: 1,
  inquiryId: "inquiry-001",
  amendedBy: "actor-002",
  amendedAt: "2026-08-26T00:00:00.000Z",
};

describe("prescription amendment contracts (WP-7403)", () => {
  it("bounds inquiry text fields and rejects empty text", () => {
    expect(
      prescriptionInquiryCreateRequestSchema.safeParse({
        directedTo: "合成病院",
        content: "疑義内容",
      }).success,
    ).toBe(true);
    for (const body of [
      { directedTo: "", content: "疑義内容" },
      { directedTo: "合成病院", content: "" },
      {
        directedTo: "x".repeat(PRESCRIPTION_INQUIRY_DIRECTED_TO_MAX_LENGTH + 1),
        content: "疑義内容",
      },
      {
        directedTo: "合成病院",
        content: "x".repeat(PRESCRIPTION_INQUIRY_CONTENT_MAX_LENGTH + 1),
      },
    ]) {
      expect(
        prescriptionInquiryCreateRequestSchema.safeParse(body).success,
      ).toBe(false);
    }
    expect(
      prescriptionInquiryAnswerRequestSchema.safeParse({
        answer: "x".repeat(PRESCRIPTION_INQUIRY_ANSWER_MAX_LENGTH + 1),
        result: "CHANGED",
      }).success,
    ).toBe(false);
    expect(
      prescriptionInquiryAnswerRequestSchema.safeParse({
        answer: "回答",
        result: "MAYBE",
      }).success,
    ).toBe(false);
  });

  it("requires an inquiryId and draft content on amend requests", () => {
    expect(
      prescriptionAmendRequestSchema.safeParse({
        inquiryId: "inquiry-001",
        content: draftContent,
      }).success,
    ).toBe(true);
    expect(
      prescriptionAmendRequestSchema.safeParse({ inquiryId: "inquiry-001" })
        .success,
    ).toBe(false);
  });

  it("derives inquiry status: OPEN has no answer fields, RESOLVED requires all", () => {
    expect(prescriptionInquiryViewSchema.parse(openInquiry).status).toBe("OPEN");
    expect(
      prescriptionInquiryViewSchema.parse({
        ...openInquiry,
        status: "RESOLVED",
        answer: "用量を訂正",
        answeredBy: "actor-002",
        answeredAt: "2026-08-25T01:00:00.000Z",
        result: "CHANGED",
      }).status,
    ).toBe("RESOLVED");

    // RESOLVED で answer 欠落 → reject。
    expect(
      prescriptionInquiryViewSchema.safeParse({
        ...openInquiry,
        status: "RESOLVED",
      }).success,
    ).toBe(false);
    // OPEN なのに answer 付き → reject(派生状態の整合)。
    expect(
      prescriptionInquiryViewSchema.safeParse({
        ...openInquiry,
        answer: "回答済み",
      }).success,
    ).toBe(false);
  });

  it("enforces amendment lineage on version views", () => {
    expect(prescriptionVersionViewSchema.parse(version1).version).toBe(1);
    expect(prescriptionVersionViewSchema.parse(version2).version).toBe(2);

    // version 1 で訂正欄が埋まっている → reject。
    expect(
      prescriptionVersionViewSchema.safeParse({
        ...version1,
        supersedesVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      prescriptionVersionViewSchema.safeParse({
        ...version1,
        inquiryId: "inquiry-001",
      }).success,
    ).toBe(false);
    // version >=2 で lineage 欠落 → reject。
    expect(
      prescriptionVersionViewSchema.safeParse({
        ...version2,
        inquiryId: null,
      }).success,
    ).toBe(false);
    // supersedesVersion は version - 1 に一致必須。
    expect(
      prescriptionVersionViewSchema.safeParse({
        ...version2,
        supersedesVersion: 0,
      }).success,
    ).toBe(false);
  });

  it("coerces positive integer version params and rejects non-integers", () => {
    expect(
      prescriptionVersionParamsSchema.parse({
        prescriptionId: "prescription-001",
        version: "2",
      }).version,
    ).toBe(2);
    for (const version of ["0", "-1", "1.5", "abc"]) {
      expect(
        prescriptionVersionParamsSchema.safeParse({
          prescriptionId: "prescription-001",
          version,
        }).success,
      ).toBe(false);
    }
  });

  it("parses the prescription.amended partner event without inquiry or patient data", () => {
    const event = partnerEventSchema.parse({
      eventId: "00000000-0000-4000-8000-0000000000e2",
      eventType: "prescription.amended",
      schemaVersion: 1,
      occurredAt: "2026-08-26T00:00:00.000Z",
      auditEventId: "audit-evt-002",
      aggregate: { type: "prescription", id: "prescription-001" },
      version: 2,
    });
    expect(event.eventType).toBe("prescription.amended");
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("patient");
    expect(serialized).not.toContain("inquiry");
  });
});
