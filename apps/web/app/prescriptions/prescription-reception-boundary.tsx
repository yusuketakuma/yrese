"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { ErrorNotice } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import {
  InlineNotice,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { useOptionalPatientContext } from "../components/patient-context";
import { useOptionalUnsavedWork } from "../components/unsaved-work";
import { formatAcceptedTime } from "../reception-dashboard";
import { PersistentPrescriptionWorkspace } from "./persistent-prescription-workspace";
import {
  type PrescriptionReceptionOrigin,
  useOptionalPrescriptionOrigin,
} from "./prescription-origin-context";
import {
  PrescriptionReceptionError,
  loadPrescriptionReceptionOrigin,
} from "./prescription-reception";

type VerificationState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly key: string }
  | {
      readonly kind: "ready";
      readonly key: string;
      readonly entry: ReceptionQueueEntry;
    }
  | {
      readonly kind: "error";
      readonly key: string;
      readonly error: PrescriptionReceptionError;
    };

function originKey(origin: PrescriptionReceptionOrigin): string {
  return `${origin.businessDate}:${origin.receptionId}:${origin.patientId}`;
}

function errorNextAction(error: PrescriptionReceptionError): string {
  if (error.kind === "NOT_FOUND") {
    return "受付画面へ戻り、対象受付が取消・完了・日付変更されていないか確認してください。";
  }
  if (error.kind === "PATIENT_MISMATCH") {
    return "処方入力を中止し、受付画面で患者のカナ・生年月日・患者番号を再確認してください。";
  }
  if (error.kind === "TERMINAL_STATUS") {
    return "受付画面へ戻り、完了・取消後の訂正手順または新しい受付の要否を確認してください。";
  }
  return "受付画面を更新して再度引き継いでください。解消しない場合は同期状態を確認してください。";
}

export function PrescriptionReceptionBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const patientContext = useOptionalPatientContext();
  const originContext = useOptionalPrescriptionOrigin();
  const unsavedWork = useOptionalUnsavedWork();
  const origin = originContext?.origin ?? null;
  const selectedPatient = patientContext?.patient ?? null;
  const selectedPatientId = selectedPatient?.patientId ?? null;
  const [verification, setVerification] = useState<VerificationState>({
    kind: "idle",
  });

  useEffect(() => {
    if (origin === null || selectedPatientId !== origin.patientId) {
      setVerification({ kind: "idle" });
      return;
    }

    const key = originKey(origin);
    const controller = new AbortController();
    setVerification({ kind: "loading", key });
    void loadPrescriptionReceptionOrigin(origin, fetch, controller.signal).then(
      (entry) => setVerification({ kind: "ready", key, entry }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setVerification({
          kind: "error",
          key,
          error:
            error instanceof PrescriptionReceptionError
              ? error
              : new PrescriptionReceptionError(
                  "UNAVAILABLE",
                  "受付情報を再取得できませんでした。",
                ),
        });
      },
    );
    return () => controller.abort();
  }, [origin, selectedPatientId]);

  const hasPatientDraft = useMemo(
    () =>
      origin !== null &&
      (unsavedWork?.records.some(
        (record) =>
          record.kind === "prescription-draft" &&
          record.patientId === origin.patientId,
      ) ?? false),
    [origin, unsavedWork?.records],
  );

  if (origin === null) return children;

  if (selectedPatient === null || selectedPatientId !== origin.patientId) {
    return (
      <section aria-label="受付連携の患者不一致">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="受付患者と選択患者の一致を確認できるまで入力を開始しません。"
          meta={<StatusPill tone="danger">患者不一致・開始不可</StatusPill>}
        />
        <ErrorNotice
          severity="ERROR"
          message="受付から引き継いだ患者と現在選択中の患者が一致しません。"
          nextAction="受付画面へ戻り、患者のカナ・生年月日・患者番号を確認してから再度引き継いでください。"
        />
        <Link className="operator-button" href="/">
          受付画面へ戻る
        </Link>
      </section>
    );
  }

  const key = originKey(origin);
  if (
    verification.kind === "idle" ||
    verification.key !== key ||
    verification.kind === "loading"
  ) {
    return (
      <section aria-label="受付情報を検証中">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="受付APIから患者との関連を再確認しています。"
          meta={<StatusPill tone="info">受付情報を検証中</StatusPill>}
        />
        <LoadingState label="受付情報を再取得して患者との関連を確認中…" />
      </section>
    );
  }

  if (verification.kind === "error") {
    return (
      <section aria-label="受付情報の検証失敗">
        <ScreenHeader
          title="処方入力ワークスペース"
          description="受付との関連を確認できるまで入力を開始しません。"
          meta={<StatusPill tone="danger">受付検証失敗・開始不可</StatusPill>}
        />
        <ErrorNotice
          severity="ERROR"
          message={verification.error.message}
          nextAction={errorNextAction(verification.error)}
        />
        <Link className="operator-button" href="/">
          受付画面へ戻る
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="受付連携済み処方入力"
      data-reception-linked="true"
      data-reception-status={verification.entry.receptionStatus}
    >
      <InlineNotice title="受付との関連を確認しました" tone="success" announce="polite">
        <p>
          受付日 {origin.businessDate}・受付時刻 {formatAcceptedTime(verification.entry.acceptedAt)}・
          処方箋区分 紙。受付状態は
          <DomainStatusBadge
            query={{
              domain: "reception",
              key: verification.entry.receptionStatus,
            }}
          />
          です。処方下書きはversion確認付きで保存できますが、臨床判定・算定・薬剤師確認・確定処理には未接続です。
        </p>
        <button
          type="button"
          className="operator-text-action"
          disabled={hasPatientDraft}
          title={
            hasPatientDraft
              ? "未保存下書きがあるため受付連携を解除できません"
              : "受付連携を解除"
          }
          onClick={() => originContext?.clearOrigin()}
        >
          受付連携を解除
        </button>
      </InlineNotice>
      <PersistentPrescriptionWorkspace
        key={key}
        patient={selectedPatient}
        scope={origin}
      />
    </section>
  );
}
