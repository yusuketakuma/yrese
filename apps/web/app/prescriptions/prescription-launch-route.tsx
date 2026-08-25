"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { useOptionalPatientContext } from "../components/patient-context";
import { InlineNotice, StatusPill } from "../components/operator-ui";
import {
  RECEPTION_STATUS_LABELS,
  ReceptionError,
  fetchReceptionQueue,
} from "../reception-dashboard";
import {
  type PrescriptionLaunchContext,
  validateReceptionLaunchEntry,
} from "./prescription-launch-context";
import { PrescriptionWorkspace } from "./prescription-workspace";

type ReceptionContextLoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly entry: ReceptionQueueEntry }
  | { readonly status: "error"; readonly notice: ErrorNoticeProps };

const GENERIC_RECEPTION_CONTEXT_ERROR = Object.freeze({
  message: "受付コンテキストを確認できませんでした。",
  nextAction:
    "受付画面へ戻って対象患者と受付を再確認してください。解消しない場合は同期状態を確認してください。",
} satisfies ErrorNoticeProps);

function noticeFromError(error: unknown): ErrorNoticeProps {
  return error instanceof ReceptionError
    ? error.toNotice()
    : GENERIC_RECEPTION_CONTEXT_ERROR;
}

export function PrescriptionLaunchRoute({
  launch,
}: {
  readonly launch: PrescriptionLaunchContext;
}) {
  const patientContext = useOptionalPatientContext();
  const selectedPatient = patientContext?.patient ?? null;
  const [state, setState] = useState<ReceptionContextLoadState>({
    status: "loading",
  });

  const selectedPatientId = selectedPatient?.patientId;

  useEffect(() => {
    if (selectedPatientId === undefined) {
      setState({ status: "loading" });
      return;
    }

    const controller = new AbortController();
    let current = true;
    setState({ status: "loading" });

    fetchReceptionQueue(launch.businessDate, fetch, controller.signal)
      .then((queue) => {
        if (!current) return;
        const validation = validateReceptionLaunchEntry(
          queue.entries,
          launch,
          selectedPatientId,
        );
        if (validation.status === "not-found") {
          setState({
            status: "error",
            notice: {
              message: "指定された受付を現在の薬局・業務日で確認できませんでした。",
              nextAction:
                "受付画面へ戻り、対象の受付を再選択してください。URLの受付IDを手入力しないでください。",
            },
          });
          return;
        }
        if (validation.status === "patient-mismatch") {
          setState({
            status: "error",
            notice: {
              message: "受付と患者の組み合わせを確認できませんでした。",
              nextAction:
                "処方入力を中止し、受付画面で患者・カナ・生年月日を再確認してください。",
            },
          });
          return;
        }
        setState({ status: "ready", entry: validation.entry });
      })
      .catch((error: unknown) => {
        if (!current || controller.signal.aborted) return;
        setState({ status: "error", notice: noticeFromError(error) });
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [launch, selectedPatientId]);

  if (selectedPatient === null) {
    return (
      <section aria-label="処方入力開始条件">
        <ErrorNotice
          severity="WARNING"
          message="受付に対応する患者が選択されていません。"
          nextAction="患者検索で対象患者を選択し、カナ・生年月日を確認してから同じ受付を開いてください。"
        />
        <p>
          <Link href="/patients">患者検索を開く</Link>
        </p>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        aria-label="受付コンテキスト確認中"
        aria-busy="true"
        role="status"
      >
        <p className="loading-state">受付・患者・業務日の対応を確認しています…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="受付コンテキスト確認エラー">
        <ErrorNotice severity="ERROR" {...state.notice} />
        <p>
          <Link href="/">受付画面へ戻る</Link>
        </p>
      </section>
    );
  }

  return (
    <div
      data-prescription-launch="verified"
      data-reception-id={state.entry.receptionId}
      data-patient-id={state.entry.patient.patientId}
    >
      <InlineNotice title="受付コンテキストを確認しました" tone="info" announce="polite">
        <p>
          受付ID: {state.entry.receptionId} / 業務日: {launch.businessDate} / 受付状態:{" "}
          <StatusPill tone="info">
            {RECEPTION_STATUS_LABELS[state.entry.receptionStatus]}
          </StatusPill>
        </p>
        <p>
          この確認は、認証済みtenant・薬局の受付キューに受付が存在し、選択患者と一致することだけを示します。処方内容の妥当性、安全性、保存完了は示しません。
        </p>
      </InlineNotice>
      <PrescriptionWorkspace />
    </div>
  );
}
