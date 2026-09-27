import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

import type {
  PatientSearchResult,
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import {
  ReceptionDashboard,
  ReceptionError,
  ReceptionRegistrationForm,
  ReceptionQueueTable,
  ReceptionQueueView,
  createReception,
  createReceptionDashboardLifecycle,
  createReceptionQueueRunner,
  createReceptionIdempotencyKeyStore,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  fetchReceptionQueue,
  formatAcceptedTime,
  isSettledReceptionCreateFailure,
  parseDateParam,
  RECEPTION_STATUS_LABELS,
  receptionDashboardDisplayButtonLabel,
  receptionQueueMetrics,
  ReceptionQueueMetricsView,
  registrationPatientChangeNotice,
  subscribeReceptionQueueRefreshOnVisible,
  submitReceptionRegistration,
  type QueueState,
  todayAsIsoDate,
} from './reception-dashboard';
import ReceptionPage from '../page';


export const unverifiedEligibility = {
  state: "UNVERIFIED" as const,
  snapshotId: null,
  allowsProvisionalCalculation: false,
  allowsFinalCalculation: false,
};

export function patient(over: Partial<PatientSearchResult>): PatientSearchResult {
  return {
    patientId: "patient-test-001",
    name: "合成 太郎",
    kana: "ゴウセイ タロウ",
    birthDate: "1990-01-01",
    sex: "male",
    patientNumber: "T-0001",
    eligibilityStatus: "VERIFIED",
    ...over,
  };
}

export function entry(over: Partial<ReceptionQueueEntry>): ReceptionQueueEntry {
  return {
    receptionId: "rc-test-001",
    patient: patient({}),
    acceptedAt: "2026-07-09T00:15:00.000Z",
    receptionStatus: "WAITING",
    prescriptionIntakeType: "paper",
    eligibility: unverifiedEligibility,
    version: 1,
    ...over,
  };
}

export function queueResponse(
  date: string,
  entries: readonly ReceptionQueueEntry[] = [],
): ReceptionQueueResponse {
  return { date, entries: [...entries] };
}

export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

export function deferredValue<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export async function withNodeEnv<T>(
  nodeEnv: string,
  run: () => Promise<T>,
): Promise<T> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
  try {
    return await run();
  } finally {
    vi.unstubAllEnvs();
  }
}

