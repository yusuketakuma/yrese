import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PrescriptionDraftResponse,
  PrescriptionDraftSaveResponse,
} from "@yrese/contracts";

import { createBlankPrescriptionDraft } from "./prescription-draft";
import {
  PrescriptionDraftClientError,
  createPersistedPrescriptionWorkSnapshot,
  isPersistedPrescriptionWorkSnapshot,
  loadPrescriptionDraft,
  persistentPrescriptionDraftWorkId,
  prescriptionDraftResponseToSnapshot,
  prescriptionDraftSnapshotToContent,
  prescriptionDraftSnapshotsEqual,
  savePrescriptionDraft,
} from "./prescription-draft-client";

const SCOPE = {
  receptionId: "reception-web-draft",
  patientId: "patient-web-draft",
  businessDate: "2026-08-25",
} as const;

const RESPONSE: PrescriptionDraftResponse = {
  prescriptionId: "prescription-web-draft",
  receptionId: SCOPE.receptionId,
  patientId: SCOPE.patientId,
  businessDate: SCOPE.businessDate,
  version: 2,
  lifecycleStatus: "SERVER_SAVED",
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-08-25",
    defaultDays: 7,
    flags: ["PACKAGING"],
    note: "テスト下書き",
    rows: [
      {
        sequence: 1,
        drugText: "テスト薬10mg",
        usageText: "1日1回 朝",
        days: 7,
        quantityText: "7錠",
      },
    ],
  },
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:01:00.000Z",
  createdBy: "actor-web-draft",
  updatedBy: "actor-web-draft",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("prescription draft web client", () => {
  it("loads a validated tenant-scoped draft with no-store and exact query identity", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchMock = vi.fn(async () => jsonResponse(RESPONSE));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await expect(loadPrescriptionDraft(SCOPE, fetchImpl)).resolves.toEqual(RESPONSE);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "/_yrese-api/prescription-drafts/by-reception/reception-web-draft?patientId=patient-web-draft&date=2026-08-25",
    );
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-dev-scopes")?.split(",")).toEqual(
      expect.arrayContaining([
        "prescription:read",
        "reception:read",
        "patient:read",
      ]),
    );
  });

  it("treats a verified-context 404 as no existing draft and rejects invalid responses", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const notFound = vi.fn(async () => jsonResponse({}, 404)) as unknown as typeof fetch;
    await expect(loadPrescriptionDraft(SCOPE, notFound)).resolves.toBeNull();

    const invalid = vi.fn(async () => jsonResponse({ version: 2 })) as unknown as typeof fetch;
    await expect(loadPrescriptionDraft(SCOPE, invalid)).rejects.toMatchObject({
      kind: "INVALID_RESPONSE",
    });
  });

  it("sends expectedVersion and maps a server conflict without exposing response text", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const conflictMock = vi.fn(async () =>
      jsonResponse({ message: "sensitive server detail" }, 409),
    );
    const conflict = conflictMock as unknown as typeof fetch;

    await expect(
      savePrescriptionDraft(SCOPE, 2, RESPONSE.draft, conflict),
    ).rejects.toEqual(
      expect.objectContaining({
        kind: "CONFLICT",
        status: 409,
        message: "別の端末またはタブで処方下書きが更新されました。",
      } satisfies Partial<PrescriptionDraftClientError>),
    );

    const [, init] = conflictMock.mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(init?.cache).toBe("no-store");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      patientId: SCOPE.patientId,
      businessDate: SCOPE.businessDate,
      expectedVersion: 2,
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("x-dev-scopes")?.split(",")).toEqual(
      expect.arrayContaining([
        "prescription:write",
        "reception:read",
        "patient:read",
      ]),
    );
  });

  it("parses a successful save response and preserves the server version", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const saved: PrescriptionDraftSaveResponse = {
      ...RESPONSE,
      version: 3,
      saveDisposition: "updated",
    };
    const fetchImpl = vi.fn(async () => jsonResponse(saved)) as unknown as typeof fetch;

    await expect(
      savePrescriptionDraft(SCOPE, 2, RESPONSE.draft, fetchImpl),
    ).resolves.toEqual(saved);
  });
});

describe("prescription draft UI mapping", () => {
  it("round-trips structured content without inventing medication fields", () => {
    const snapshot = prescriptionDraftResponseToSnapshot(RESPONSE);
    expect(snapshot).toEqual({
      rows: [
        {
          id: 1,
          drug: "テスト薬10mg",
          usage: "1日1回 朝",
          days: "7",
          quantity: "7錠",
        },
      ],
      prescriptionType: "外来",
      prescriptionDate: "2026-08-25",
      defaultDays: "7",
      options: ["一包化"],
      note: "テスト下書き",
    });
    const converted = prescriptionDraftSnapshotToContent(snapshot);
    expect(converted).toEqual({ ok: true, value: RESPONSE.draft });
  });

  it("rejects non-integer day values before calling the API", () => {
    const draft = {
      ...createBlankPrescriptionDraft(),
      defaultDays: "7.5",
    };
    expect(prescriptionDraftSnapshotToContent(draft)).toEqual({
      ok: false,
      message: "交付日数は1以上の整数で入力してください。",
    });
  });

  it("tracks a reception-specific baseline and rejects malformed tab snapshots", () => {
    const baseline = createBlankPrescriptionDraft();
    const draft = {
      ...baseline,
      note: "未保存変更",
    };
    const work = createPersistedPrescriptionWorkSnapshot(
      SCOPE,
      2,
      baseline,
      draft,
    );

    expect(isPersistedPrescriptionWorkSnapshot(work)).toBe(true);
    expect(isPersistedPrescriptionWorkSnapshot({ ...work, baseVersion: -1 })).toBe(
      false,
    );
    expect(persistentPrescriptionDraftWorkId(SCOPE.patientId, SCOPE.receptionId)).toBe(
      "prescription-draft:patient-web-draft:reception-web-draft",
    );
    expect(prescriptionDraftSnapshotsEqual(baseline, draft)).toBe(false);
    expect(
      prescriptionDraftSnapshotsEqual(
        { ...baseline, note: "  " },
        createBlankPrescriptionDraft(),
      ),
    ).toBe(true);
  });
});
