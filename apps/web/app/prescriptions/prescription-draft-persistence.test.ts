import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionDraftResponse } from "@yrese/contracts";

import {
  PrescriptionDraftApiError,
  PRESCRIPTION_DRAFT_TIMEOUT_MS,
  fromPrescriptionDraftResponse,
  loadPrescriptionDraft,
  prescriptionDraftSnapshotsEqual,
  savePrescriptionDraft,
  toPrescriptionDraftContent,
} from "./prescription-draft-persistence";
import { createBlankPrescriptionDraft } from "./prescription-draft";

/** 自由記載の実入力行を1件持つ draft(全空 draft は保存対象外)。 */
function draftWithTextRow() {
  const base = createBlankPrescriptionDraft();
  return {
    ...base,
    rows: [
      {
        ...base.rows[0]!,
        drug: "合成薬剤 5mg",
        usage: "1日1回 朝食後",
      },
    ],
  };
}

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
    sourceMetadata: null,
    prescriptionDate: "2026-08-25",
    defaultDays: 7,
    flags: ["PACKAGING"],
    note: "確認メモ",
    rows: [],
    rpGroups: [
      {
        rpGroupId: "00000000-0000-4000-8000-000000000011",
        sequence: 1,
        dosageForm: "ORAL",
        usage: { kind: "unresolved" as const, text: "1日1回 朝食後" },
        daysOrCount: 7,
        items: [
          {
            rpItemId: "00000000-0000-4000-a000-000000000011",
            sequence: 1,
            medication: {
              kind: "unresolved" as const,
              text: "合成薬剤 5mg",
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

  it("rejects an all-empty draft with a dedicated message (R3 fix)", () => {
    expect(() =>
      toPrescriptionDraftContent(createBlankPrescriptionDraft()),
    ).toThrow("少なくとも1行のRP内容を入力してください。");
  });

  it("compares drafts flag-order-insensitively (canonical order)", () => {
    const base = {
      ...draftWithTextRow(),
      options: ["麻薬", "一包化"] as const,
    };
    const reordered = {
      ...draftWithTextRow(),
      options: ["一包化", "麻薬"] as const,
    };
    expect(prescriptionDraftSnapshotsEqual(base, reordered)).toBe(true);
    // 全空 draft 同士も等価(永続化不可同士の比較)。
    expect(
      prescriptionDraftSnapshotsEqual(
        createBlankPrescriptionDraft(),
        createBlankPrescriptionDraft(),
      ),
    ).toBe(true);
  });

  it("emits structured rpGroups and never legacy rows on save (WP-7302)", () => {
    const snapshot = fromPrescriptionDraftResponse(serverDraft);
    const content = toPrescriptionDraftContent(snapshot);
    expect(content.rows).toEqual([]);
    expect(content.rpGroups).toHaveLength(1);
    expect(content.rpGroups[0]).toMatchObject({
      rpGroupId: "00000000-0000-4000-8000-000000000011",
      usage: { kind: "unresolved" },
      items: [{ medication: { kind: "unresolved" } }],
    });
  });

  it("recombines same-rpGroupId rows into one group on save", () => {
    const snapshot = fromPrescriptionDraftResponse(serverDraft);
    const secondItem = {
      ...snapshot.rows[0]!,
      id: 2,
      rpItemId: "00000000-0000-4000-a000-000000000012",
      drug: "別の合成薬剤 10mg",
    };
    const content = toPrescriptionDraftContent({
      ...snapshot,
      rows: [snapshot.rows[0]!, secondItem],
    });
    expect(content.rpGroups).toHaveLength(1);
    expect(content.rpGroups[0]?.items).toHaveLength(2);
    expect(content.rpGroups[0]?.items[1]?.rpItemId).toBe(
      "00000000-0000-4000-a000-000000000012",
    );
  });

  it("round-trips source metadata and defaults it to null when untouched", () => {
    // 未入力なら additive の null を送る(既存 draft との互換)。
    expect(
      toPrescriptionDraftContent(draftWithTextRow()).sourceMetadata,
    ).toBeNull();

    const withMetadata = {
      ...draftWithTextRow(),
      institutionCode: "1312345",
      institutionName: "合成クリニック",
      prescriberName: "合成 医師",
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      refillTotal: "3",
      refillRemaining: "2",
      splitDispensing: "分割指示あり",
    };
    const content = toPrescriptionDraftContent(withMetadata);
    expect(content.sourceMetadata).toEqual({
      medicalInstitution: { code: "1312345", name: "合成クリニック" },
      prescriberName: "合成 医師",
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      refill: { total: 3, remaining: 2 },
      splitDispensing: "分割指示あり",
    });

    const roundTripped = fromPrescriptionDraftResponse({
      ...serverDraft,
      draft: { ...serverDraft.draft, sourceMetadata: content.sourceMetadata },
    });
    expect(roundTripped).toMatchObject({
      institutionCode: "1312345",
      issueDate: "2026-08-20",
      refillTotal: "3",
      refillRemaining: "2",
    });
  });

  it("requires issue/validity dates once any metadata is entered and delegates ordering to the contract", () => {
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        prescriberName: "合成 医師",
      }),
    ).toThrow("処方箋の発行日を入力してください。");
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        issueDate: "2026-08-20",
        prescriberName: "合成 医師",
      }),
    ).toThrow("処方箋の有効期限を入力してください。");
    // validUntil < issueDate は contract schema が拒否し、ラベルは有効期限。
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        issueDate: "2026-08-20",
        validUntil: "2026-08-19",
      }),
    ).toThrow("有効期限を確認してください。");
    // refill 残数超過も contract が拒否。
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        issueDate: "2026-08-20",
        validUntil: "2026-08-24",
        refillTotal: "2",
        refillRemaining: "3",
      }),
    ).toThrow("リフィル回数を確認してください。");
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

  it("identifies the invalid draft field or RP row without echoing its value", () => {
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        defaultDays: "7.5",
      }),
    ).toThrow("交付日数は1〜999の整数で入力してください。");

    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        rows: [
          {
            ...createBlankPrescriptionDraft().rows[0]!,
            days: "7.5",
          },
        ],
      }),
    ).toThrow("RP1 日数・回数は1〜999の整数で入力してください。");

    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        rows: [
          {
            ...createBlankPrescriptionDraft().rows[0]!,
            drug: "x".repeat(501),
          },
        ],
      }),
    ).toThrow("RP1 品目1 薬剤を確認してください。");

    // コード選択モードで未選択は送信前に fail-closed。
    expect(() =>
      toPrescriptionDraftContent({
        ...createBlankPrescriptionDraft(),
        rows: [
          {
            ...createBlankPrescriptionDraft().rows[0]!,
            medicationMode: "master" as const,
          },
        ],
      }),
    ).toThrow("RP1 薬剤をマスターから選択するか、自由記載に切り替えてください。");
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

  it("bounds load and save attempts and reports a timeout as unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });

    await expect(loadPrescriptionDraft(context, fetchImpl, undefined, 5)).rejects.toMatchObject({
      kind: "UNAVAILABLE",
      message: "処方下書きAPIへの応答が時間内にありませんでした。",
    });
    await expect(
      savePrescriptionDraft(
        context,
        { expectedVersion: 2, snapshot: fromPrescriptionDraftResponse(serverDraft) },
        fetchImpl,
        undefined,
        5,
      ),
    ).rejects.toMatchObject({
      kind: "UNAVAILABLE",
      message: "処方下書きAPIへの応答が時間内にありませんでした。",
    });
    expect(PRESCRIPTION_DRAFT_TIMEOUT_MS).toBe(30_000);
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

  it("rejects a schema-valid load response whose identity differs from the request context", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    for (const override of [
      { receptionId: "reception-test-other" },
      { patientId: "patient-test-other" },
      { businessDate: "2026-08-26" },
    ] as const) {
      const foreignDraft = { ...serverDraft, ...override };
      const fetchImpl: typeof fetch = async () => response(foreignDraft);
      await expect(
        loadPrescriptionDraft(context, fetchImpl),
      ).rejects.toMatchObject({
        kind: "INVALID_RESPONSE",
        message:
          "処方下書きAPIの応答が要求した受付・患者・業務日と一致しませんでした。",
      });
    }
  });

  it("rejects a schema-valid save response whose identity differs from the request context", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const foreignDraft = {
      ...serverDraft,
      patientId: "patient-test-other",
      saveDisposition: "updated" as const,
    };
    const fetchImpl: typeof fetch = async () => response(foreignDraft);

    await expect(
      savePrescriptionDraft(
        context,
        {
          expectedVersion: 2,
          snapshot: fromPrescriptionDraftResponse(serverDraft),
        },
        fetchImpl,
      ),
    ).rejects.toMatchObject({ kind: "INVALID_RESPONSE" });
  });
});
