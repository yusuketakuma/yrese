import { describe, expect, it } from "vitest";

import {
  CLINICAL_ALERT_ACK_STATUSES,
  CLINICAL_ALERT_TYPES,
  PRESCRIPTION_CHANGE_TYPES,
  RECORD_LIFECYCLE_STATUSES,
  SESSION_STATUSES,
  SYNC_STATUSES,
  isAtRiskOfLoss,
  isClinicalAlertAckStatus,
  isClinicalAlertType,
  isDurablySynced,
  isFinalizedRecord,
  isPrescriptionChangeType,
  isPrescriptionChanged,
  isRecordLifecycleStatus,
  isSessionStatus,
  isSyncStatus,
  requiresHumanAttention,
  requiresReauth,
} from "./index.js";

describe("record lifecycle (R-RECLIFE / 真正性)", () => {
  it("recognizes only defined statuses", () => {
    expect(isRecordLifecycleStatus("FINALIZED")).toBe(true);
    expect(isRecordLifecycleStatus("NOPE")).toBe(false);
  });

  it("treats finalized/amended/superseded as finalized records (原本性)", () => {
    expect(isFinalizedRecord("FINALIZED")).toBe(true);
    expect(isFinalizedRecord("AMENDED")).toBe(true);
    expect(isFinalizedRecord("SUPERSEDED")).toBe(true);
    expect(isFinalizedRecord("DRAFT")).toBe(false);
  });

  it("flags unsaved/local-only as at risk of loss (H-10/H-03)", () => {
    expect(isAtRiskOfLoss("UNSAVED")).toBe(true);
    expect(isAtRiskOfLoss("AUTO_SAVED_LOCALLY")).toBe(true);
    expect(isAtRiskOfLoss("SERVER_SAVED")).toBe(false);
  });

  it("has no duplicate status keys", () => {
    expect(new Set(RECORD_LIFECYCLE_STATUSES).size).toBe(RECORD_LIFECYCLE_STATUSES.length);
  });
});

describe("sync status (R-OFFLINE / H-03)", () => {
  it("treats only SYNCED as durably server-saved", () => {
    expect(isDurablySynced("SYNCED")).toBe(true);
    expect(isDurablySynced("QUEUED")).toBe(false);
  });

  it("flags failure/conflict as needing human attention (自動補正禁止)", () => {
    expect(requiresHumanAttention("CONFLICT")).toBe(true);
    expect(requiresHumanAttention("SYNC_FAILED")).toBe(true);
    expect(requiresHumanAttention("SYNCING")).toBe(false);
  });

  it("guards membership", () => {
    expect(isSyncStatus("CONFLICT")).toBe(true);
    expect(isSyncStatus("x")).toBe(false);
    expect(new Set(SYNC_STATUSES).size).toBe(SYNC_STATUSES.length);
  });
});

describe("clinical alert (R-CLINALERT)", () => {
  it("guards alert types and ack statuses", () => {
    expect(isClinicalAlertType("CONTRAINDICATION")).toBe(true);
    expect(isClinicalAlertType("nope")).toBe(false);
    expect(isClinicalAlertAckStatus("OVERRIDDEN")).toBe(true);
    expect(isClinicalAlertAckStatus("nope")).toBe(false);
  });

  it("has no duplicate keys", () => {
    expect(new Set(CLINICAL_ALERT_TYPES).size).toBe(CLINICAL_ALERT_TYPES.length);
    expect(new Set(CLINICAL_ALERT_ACK_STATUSES).size).toBe(CLINICAL_ALERT_ACK_STATUSES.length);
  });
});

describe("prescription change (H-06/H-07)", () => {
  it("detects real changes vs unchanged", () => {
    expect(isPrescriptionChanged("DOSE_INCREASED")).toBe(true);
    expect(isPrescriptionChanged("DISCONTINUED")).toBe(true);
    expect(isPrescriptionChanged("UNCHANGED")).toBe(false);
  });

  it("guards membership", () => {
    expect(isPrescriptionChangeType("NEW")).toBe(true);
    expect(isPrescriptionChangeType("nope")).toBe(false);
    expect(new Set(PRESCRIPTION_CHANGE_TYPES).size).toBe(PRESCRIPTION_CHANGE_TYPES.length);
  });
});

describe("session status (R-AUTH / H-10)", () => {
  it("requires reauth only for expired/locked", () => {
    expect(requiresReauth("EXPIRED")).toBe(true);
    expect(requiresReauth("LOCKED")).toBe(true);
    expect(requiresReauth("EXPIRING_SOON")).toBe(false);
    expect(requiresReauth("ACTIVE")).toBe(false);
  });

  it("guards membership", () => {
    expect(isSessionStatus("ACTIVE")).toBe(true);
    expect(isSessionStatus("nope")).toBe(false);
    expect(new Set(SESSION_STATUSES).size).toBe(SESSION_STATUSES.length);
  });
});
