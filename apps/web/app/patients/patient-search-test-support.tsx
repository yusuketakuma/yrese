import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_SEARCH_DEFAULT_LIMIT,
  type PatientSearchResult,
} from "@yrese/contracts";

import {
  ELIGIBILITY_LABELS,
  PatientHeader,
  computeAgeYears,
} from "../components/patient-header";
import { PATIENT_SEARCH_DEV_SCOPES, devTenantHeaders } from "../dev-tenant";
import { SEX_LABELS } from "../status/visual-status-registry";
import { patientId } from "@yrese/shared-kernel";
import {
  createSearchRunner,
  duplicateKanaSet,
  fetchSearch,
  patientSearchResultMetric,
  PatientSearch,
  PatientSearchResults,
  ProceedToPrescriptionLink,
  toPatientContextData,
  type SearchPage,
  type SearchState,
} from "./patient-search";

(globalThis as { React?: typeof React }).React = React;


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

export async function captureSearchFailure(
  status: number,
  json: () => unknown,
): Promise<{ readonly error: unknown; readonly json: ReturnType<typeof vi.fn> }> {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
  const jsonMock = vi.fn(json);
  const fetchImpl: typeof fetch = async () =>
    ({ ok: false, status, json: jsonMock }) as unknown as Response;
  let error: unknown;
  try {
    await fetchSearch("秘密検索語", undefined, fetchImpl);
  } catch (caught) {
    error = caught;
  } finally {
    vi.unstubAllEnvs();
  }
  return { error, json: jsonMock };
}

