import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionDraftResponse } from "@yrese/contracts";

import {
  PrescriptionDraftApiError,
  fromPrescriptionDraftResponse,
  loadPrescriptionDraft,
  prescriptionDraftSnapshotsEqual,
  savePrescriptionDraft,
  toPrescriptionDraftContent,
} from "./prescription-draft-persistence";
import { createBlankPrescriptionDraft } from "./prescription-draft";

const context = {
  receptionId: "reception-test-001",
  patientId: "patient-test-001",
  businessDate: "2026-08-25",
} as const;

const serverDraft: PrescriptionDraftResponse = {
  prescriptionId: "prescription-test-001",
  receptionId: context.receptionId,
  patientId: context.patientId,
  businessDate: context.businessDate,
  version: 2,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-08-25",
    defaultDays: 7,
    flags: ["PACKAGING"],
    note: "確認メモ",
    rows: [
      {
        sequence: 1,
        drugText: "合成薬剤 5mg",
        usageText: "1日1回 朝食後",
        days: 7,
        quantityText: "7錠",
      },
    ],
  },
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T01:00:00.000Z",
  createdBy: "actor-test-001",
  updatedBy: "actor-test-002",
};

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("prescription draft web persistence", () => {
  it("maps the editor snapshot to the bounded wire contract and back", () => {
    const snapshot = fromPrescriptionDraftResponse(serverDraft);
    expect(toPrescriptionDraftContent(snapshot)).toEqual(serverDraft.draft);
    expect(
      prescriptionDraftSnapshotsEqual(
        snapshot,
        fromPrescriptionDraftResponse(serverDraft),
      ),
    ).toBe(true);
  });

  it("rejects non-integer days before sending clinical content", () => {
    const invalid = {
      ...createBlankPrescriptionDraft(),
      defaultDays: "7.5",
    };
    expect(() => toPrescriptionDraftContent(invalid)).toThrow(
      PrescriptionDraftApiError,
    );
  });

  it("loads through the existing API transport without putting patient ID in the URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const calls: Array<{
      readonly input: RequestInfo | URL;
      readonly init: RequestInit | undefined;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return response(serverDraft);
    };

    await expect(loadPrescriptionDraft(context, fetchImpl)).resolves.toEqual(
      serverDraft,
    );
    expect(String(calls[0]?.input)).toBe(
      "/_yrese-api/prescription-drafts/by-reception/reception-test-001?date=2026-08-25",
    );
    expect(calls[0]?.init?.cache).toBe("no-store");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("x-dev-scopes")?.split(",")).toEqual(
      expect.arrayContaining([
        "prescription:read",
        "reception:read",
        "patient:read",
      ]),
    );
  });

  it("treats a verified reception with no server draft as an empty state", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl: typeof fetch = async () => response(null, 204);
    await expect(loadPrescriptionDraft(context, fetchImpl)).resolves.toBeNull();
  });

  it("rejects a missing reception context instead of opening an empty draft", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl: typeof fetch = async () => response({}, 404);

    await expect(loadPrescriptionDraft(context, fetchImpl)).rejects.toMatchObject({
      kind: "NOT_FOUND",
      status: 404,
    });
  });

  it("preserves intentional request cancellation", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const controller = new AbortController();
    const aborted = new DOMException("Aborted", "AbortError");
    controller.abort();
    const fetchImpl: typeof fetch = async () => {
      throw aborted;
    };

    await expect(
      loadPrescriptionDraft(context, fetchImpl, controller.signal),
    ).rejects.toBe(aborted);
    await expect(
      savePrescriptionDraft(
        context,
        {
          expectedVersion: 2,
          snapshot: fromPrescriptionDraftResponse(serverDraft),
        },
        fetchImpl,
        controller.signal,
      ),
    ).rejects.toBe(aborted);
  });

  it("sends the update precondition and maps a stale writer to a fixed conflict", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const calls: Array<{
      readonly input: RequestInfo | URL;
      readonly init: RequestInit | undefined;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return response({}, 409);
    };

    await expect(
      savePrescriptionDraft(
        context,
        {
          expectedVersion: 2,
          snapshot: fromPrescriptionDraftResponse(serverDraft),
        },
        fetchImpl,
      ),
    ).rejects.toMatchObject({
      kind: "CONFLICT",
      status: 409,
    });
    expect(calls[0]?.init?.method).toBe("PUT");
    expect(new Headers(calls[0]?.init?.headers).get("if-match")).toBe('"2"');
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      patientId: context.patientId,
      businessDate: context.businessDate,
      expectedVersion: 2,
    });
  });

  it("does not trust an invalid success payload", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl: typeof fetch = async () => response({ version: 99 });

    await expect(loadPrescriptionDraft(context, fetchImpl)).rejects.toMatchObject({
      kind: "INVALID_RESPONSE",
    });
  });
});
