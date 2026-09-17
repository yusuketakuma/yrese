import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

import {
  RECEPTION_BUSINESS_REASON_CODE_PATTERN,
  type ReceptionQueueEntry,
} from "@yrese/contracts";

import {
  ReceptionTransitionActions,
  RECEPTION_CANCEL_REASON_OPTIONS,
} from "./reception-transition-action";
import { ReceptionError, transitionReception } from "./reception-dashboard";

function entry(over: Partial<ReceptionQueueEntry>): ReceptionQueueEntry {
  return {
    receptionId: "reception-transition-001",
    patient: {
      patientId: "patient-transition-001",
      name: "合成 花子",
      kana: "ゴウセイ ハナコ",
      birthDate: "1985-05-05",
      sex: "female",
      patientNumber: "T-0042",
      eligibilityStatus: "VERIFIED",
    },
    prescriptionIntakeType: "paper",
    receptionStatus: "WAITING",
    acceptedAt: "2026-09-17T01:00:00.000Z",
    version: 3,
    ...over,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function withApiBase<T>(run: () => Promise<T>): Promise<T> {
  vi.stubEnv("NEXT_PUBLIC_API_BASE", "https://api.example.test");
  try {
    return await run();
  } finally {
    vi.unstubAllEnvs();
  }
}

describe("ReceptionTransitionActions (WP-7201)", () => {
  it("renders 対応開始 and 取消 for WAITING entries", () => {
    const html = renderToStaticMarkup(
      <ReceptionTransitionActions
        entry={entry({ receptionStatus: "WAITING" })}
        onChanged={() => {}}
      />,
    );
    expect(html).toContain("対応開始");
    expect(html).toContain("取消");
    expect(html).not.toContain("完了");
  });

  it("renders 完了 and 取消 for IN_PROGRESS entries", () => {
    const html = renderToStaticMarkup(
      <ReceptionTransitionActions
        entry={entry({ receptionStatus: "IN_PROGRESS" })}
        onChanged={() => {}}
      />,
    );
    expect(html).toContain("完了");
    expect(html).toContain("取消");
    expect(html).not.toContain("対応開始");
  });

  it.each(["COMPLETED", "CANCELLED"] as const)(
    "renders no actions for terminal status %s",
    (status) => {
      const html = renderToStaticMarkup(
        <ReceptionTransitionActions
          entry={entry({ receptionStatus: status })}
          onChanged={() => {}}
        />,
      );
      expect(html).toBe("");
    },
  );

  it("keeps cancel reason codes inside the wire pattern (MOD-008)", () => {
    for (const option of RECEPTION_CANCEL_REASON_OPTIONS) {
      expect(RECEPTION_BUSINESS_REASON_CODE_PATTERN.test(option.code)).toBe(
        true,
      );
    }
  });
});

describe("transitionReception transport", () => {
  it("sends If-Match and expectedVersion from the loaded entry version", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        receptionId: "reception-transition-001",
        receptionStatus: "IN_PROGRESS",
        version: 4,
        statusChangedAt: "2026-09-17T02:00:00.000Z",
      }),
    );
    const result = await withApiBase(() =>
      transitionReception(entry({}), "IN_PROGRESS", undefined, fetchImpl),
    );
    expect(result.receptionStatus).toBe("IN_PROGRESS");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/reception/reception-transition-001/transitions");
    expect((init.headers as Record<string, string>)["if-match"]).toBe('"3"');
    expect(JSON.parse(String(init.body))).toEqual({
      to: "IN_PROGRESS",
      expectedVersion: 3,
    });
  });

  it("sends businessReason only for CANCELLED", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        receptionId: "reception-transition-001",
        receptionStatus: "CANCELLED",
        version: 4,
        statusChangedAt: "2026-09-17T02:00:00.000Z",
      }),
    );
    await withApiBase(() =>
      transitionReception(entry({}), "CANCELLED", "PATIENT_REQUEST", fetchImpl),
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      to: "CANCELLED",
      expectedVersion: 3,
      businessReason: "PATIENT_REQUEST",
    });
  });

  it("maps 409 RCV-0005 to a version-conflict ReceptionError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, { errorCode: "RCV-0005", message: "conflict" }),
    );
    const error = await withApiBase(() =>
      transitionReception(entry({}), "IN_PROGRESS", undefined, fetchImpl),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReceptionError);
    expect((error as ReceptionError).errorCode).toBe("RCV-0005");
    expect((error as ReceptionError).message).toContain("他の操作で更新");
  });

  it("maps 409 RCV-0004 to an invalid-transition ReceptionError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, { errorCode: "RCV-0004", message: "not allowed" }),
    );
    const error = await withApiBase(() =>
      transitionReception(
        entry({ receptionStatus: "IN_PROGRESS" }),
        "IN_PROGRESS",
        undefined,
        fetchImpl,
      ),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReceptionError);
    expect((error as ReceptionError).errorCode).toBe("RCV-0004");
  });

  it("maps 404 RCV-0006 to a not-found ReceptionError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(404, { errorCode: "RCV-0006", message: "not found" }),
    );
    const error = await withApiBase(() =>
      transitionReception(entry({}), "IN_PROGRESS", undefined, fetchImpl),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReceptionError);
    expect((error as ReceptionError).errorCode).toBe("RCV-0006");
  });

  it("rejects a transition response whose identity does not match the entry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        receptionId: "reception-transition-OTHER",
        receptionStatus: "IN_PROGRESS",
        version: 4,
        statusChangedAt: "2026-09-17T02:00:00.000Z",
      }),
    );
    await expect(
      withApiBase(() =>
        transitionReception(entry({}), "IN_PROGRESS", undefined, fetchImpl),
      ),
    ).rejects.toThrow("identity mismatch");
  });
});
