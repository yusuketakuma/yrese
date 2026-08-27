import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  PrescriptionDraftResponse,
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

const patientContext = vi.hoisted(() => ({
  patient: null as null | {
    patientId: string;
    name: string;
    kana: string;
    birthDate: string;
    sex: "female";
    eligibilityStatus: "VERIFIED";
  },
}));

vi.mock("../components/patient-context", async () => {
  const actual = await vi.importActual<object>("../components/patient-context");
  return {
    ...actual,
    useOptionalPatientContext: () => ({ patient: patientContext.patient }),
  };
});

import {
  PrescriptionLaunchRoute,
  PrescriptionLaunchVerifiedView,
  resolveLaunchOutcome,
} from "./prescription-launch-route";
import { ReceptionError } from "../reception-dashboard";

(globalThis as { React?: typeof React }).React = React;

const LAUNCH = {
  receptionId: "reception-a",
  businessDate: "2026-08-25",
} as const;

describe("PrescriptionLaunchRoute", () => {
  it("requires explicit patient selection before loading a reception", () => {
    patientContext.patient = null;
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain("受付に対応する患者が選択されていません");
    expect(html).toContain('href="/patients"');
    expect(html).not.toContain('data-prescription-launch="verified"');
  });

  it("does not trust a selected patient before authenticated queue verification", () => {
    patientContext.patient = {
      patientId: "patient-b",
      name: "検証患者B",
      kana: "ケンショウカンジャビー",
      birthDate: "1980-01-01",
      sex: "female",
      eligibilityStatus: "VERIFIED",
    };
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain("受付・患者・業務日の対応を確認しています");
    expect(html).not.toContain('data-prescription-launch="verified"');
  });

  it("wraps every state in the shared page shell with a screen title", () => {
    patientContext.patient = null;
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain('class="screen-title"');
    expect(html).toContain("受付スコープ処方入力");
    // /prescriptions の凍結見出しと accessible name を衝突させない
    expect(html).not.toContain("処方入力ワークスペース");
    expect(html).toContain('aria-label="処方入力開始条件"');
  });

  it("marks the loading state as busy for assistive technology", () => {
    patientContext.patient = {
      patientId: "patient-b",
      name: "検証患者B",
      kana: "ケンショウカンジャビー",
      birthDate: "1980-01-01",
      sex: "female",
      eligibilityStatus: "VERIFIED",
    };
    const html = renderToStaticMarkup(<PrescriptionLaunchRoute launch={LAUNCH} />);

    expect(html).toContain('aria-label="受付コンテキスト確認中"');
    expect(html).toContain('aria-busy="true"');
  });
});

const QUEUE_ENTRY: ReceptionQueueEntry = {
  receptionId: "reception-a",
  acceptedAt: "2026-08-25T00:30:00.000Z",
  receptionStatus: "WAITING",
  prescriptionIntakeType: "paper",
  patient: {
    patientId: "patient-b",
    name: "検証患者B",
    kana: "ケンショウカンジャビー",
    birthDate: "1980-01-01",
    sex: "female",
    patientNumber: "SYN-0001",
    eligibilityStatus: "VERIFIED",
  },
};

function queueResponse(
  entries: readonly ReceptionQueueEntry[],
): PromiseSettledResult<ReceptionQueueResponse> {
  return {
    status: "fulfilled",
    value: { date: LAUNCH.businessDate, entries: [...entries] },
  };
}

const NO_DRAFT: PromiseSettledResult<PrescriptionDraftResponse | null> = {
  status: "fulfilled",
  value: null,
};

const SAVED_DRAFT: PrescriptionDraftResponse = {
  prescriptionId: "prescription-a",
  receptionId: "reception-a",
  patientId: "patient-b",
  businessDate: "2026-08-25",
  version: 3,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-08-25",
    defaultDays: 7,
    flags: [],
    note: "",
    rows: [
      {
        sequence: 1,
        drugText: "合成薬A",
        usageText: "1日3回",
        days: 7,
        quantityText: "3錠",
      },
    ],
  },
  createdAt: "2026-08-25T00:31:00.000Z",
  updatedAt: "2026-08-25T00:45:00.000Z",
  createdBy: "actor-a",
  updatedBy: "actor-a",
};

describe("resolveLaunchOutcome", () => {
  it("stops the screen on a queue failure without echoing an untrusted message", () => {
    // 登録済み notice を持たない ReceptionError は generic fallback へ落ちる
    const untrusted = resolveLaunchOutcome(
      {
        status: "rejected",
        reason: new ReceptionError("<script>leak</script>", "leak"),
      },
      NO_DRAFT,
      LAUNCH,
      "patient-b",
    );
    const unknownError = resolveLaunchOutcome(
      { status: "rejected", reason: new Error("boom") },
      NO_DRAFT,
      LAUNCH,
      "patient-b",
    );

    if (untrusted.status !== "error" || unknownError.status !== "error") {
      throw new Error("unreachable");
    }
    expect(untrusted.notice.message).not.toContain("leak");
    expect(unknownError.notice.message).toBe(
      "受付コンテキストを確認できませんでした。",
    );
    expect(unknownError.notice.nextAction.length).toBeGreaterThan(0);
  });

  it("returns the identical notice for an unknown reception and a patient mismatch", () => {
    const unknown = resolveLaunchOutcome(
      queueResponse([]),
      NO_DRAFT,
      LAUNCH,
      "patient-b",
    );
    const mismatch = resolveLaunchOutcome(
      queueResponse([QUEUE_ENTRY]),
      NO_DRAFT,
      LAUNCH,
      "patient-other",
    );

    expect(unknown.status).toBe("error");
    expect(mismatch.status).toBe("error");
    if (unknown.status !== "error" || mismatch.status !== "error") {
      throw new Error("unreachable");
    }
    // 受付の存在有無を URL の打ち替えから推測させない
    expect(mismatch.notice).toEqual(unknown.notice);
    expect(unknown.notice.nextAction).toContain(
      "URLの受付IDを手入力しないでください",
    );
  });

  it("reports an unsaved draft (204) separately from an unavailable draft", () => {
    const unsaved = resolveLaunchOutcome(
      queueResponse([QUEUE_ENTRY]),
      NO_DRAFT,
      LAUNCH,
      "patient-b",
    );
    const unavailable = resolveLaunchOutcome(
      queueResponse([QUEUE_ENTRY]),
      { status: "rejected", reason: new Error("draft api down") },
      LAUNCH,
      "patient-b",
    );

    if (unsaved.status !== "ready" || unavailable.status !== "ready") {
      throw new Error("unreachable");
    }
    expect(unsaved.draft).toEqual({ kind: "unsaved" });
    expect(unavailable.draft).toEqual({ kind: "unavailable" });
  });

  it("keeps the verified entry when the draft exists", () => {
    const outcome = resolveLaunchOutcome(
      queueResponse([QUEUE_ENTRY]),
      { status: "fulfilled", value: SAVED_DRAFT },
      LAUNCH,
      "patient-b",
    );

    if (outcome.status !== "ready") throw new Error("unreachable");
    expect(outcome.entry.receptionId).toBe("reception-a");
    expect(outcome.draft).toEqual({ kind: "saved", draft: SAVED_DRAFT });
  });
});

const VIEW_PATIENT = {
  patientId: "patient-b",
  name: "検証患者B",
  kana: "ケンショウカンジャビー",
  birthDate: "1980-01-01",
  sex: "female",
  eligibilityStatus: "VERIFIED",
} as const;

function renderVerified(
  draft: Parameters<typeof PrescriptionLaunchVerifiedView>[0]["draft"],
): string {
  return renderToStaticMarkup(
    <PrescriptionLaunchVerifiedView
      launch={LAUNCH}
      entry={QUEUE_ENTRY}
      draft={draft}
      patient={VIEW_PATIENT}
      asOf={new Date("2026-08-25T00:00:00+09:00")}
    />,
  );
}

describe("PrescriptionLaunchVerifiedView", () => {
  it("shows reception facts from the queue response only", () => {
    const html = renderVerified({ kind: "unsaved" });

    expect(html).toContain('data-prescription-launch="verified"');
    // 内側の wrapper が縦リズムを持たないと、包んだ Panel 群が 0px で密着する
    // (gap を持つのは operator-page-primary / operator-stack だけ)。
    expect(html).toContain('class="operator-stack" aria-label="照合済み受付コンテキスト"');
    expect(html).toContain('data-reception-id="reception-a"');
    expect(html).toContain("2026-08-25");
    expect(html).toContain('data-domain="reception"');
    expect(html).toContain('data-status="WAITING"');
    // /prescriptions 側の受付連携マーカーを二重に出さない
    expect(html).not.toContain('data-reception-linked="true"');
  });

  it("names the unsaved draft honestly instead of showing an empty form", () => {
    const html = renderVerified({ kind: "unsaved" });

    expect(html).toContain(
      "この受付の処方draftはまだ保存されていません。空欄は処方なしを意味しません。",
    );
    expect(html).toContain("live-surface-panel");
  });

  it("does not present an unavailable draft as unsaved", () => {
    const html = renderVerified({ kind: "unavailable" });

    expect(html).toContain("処方下書きの保存状態を取得できませんでした。");
    expect(html).not.toContain("空欄は処方なしを意味しません");
  });

  it("labels a saved draft with its server version", () => {
    const html = renderVerified({ kind: "saved", draft: SAVED_DRAFT });

    expect(html).toContain("v3");
    expect(html).toContain("保存済みは薬剤師確認・処方確定を意味しません");
  });

  it("names the blocking gates for the capabilities that stay unavailable", () => {
    const html = renderVerified({ kind: "unsaved" });

    expect(html).toContain("RB-007");
    expect(html).toContain("RB-008");
    expect(html).toContain("SCR-014");
    expect(html).toContain(
      "アラートが表示されないことは安全確認済みを意味しません",
    );
    expect(html).toContain("検査値が表示されないことは正常を意味しません");
    expect(html).toContain(
      "アレルギー歴が表示されないことは該当なしを意味しません",
    );
  });
});
