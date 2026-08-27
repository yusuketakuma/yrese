"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import { DomainStatusBadge } from "./components/domain-status-badge";
import { ErrorNotice, type ErrorNoticeProps } from "./components/error-notice";
import { useOptionalPatientContext } from "./components/patient-context";
import { TableScroll } from "./components/operator-ui";
import {
  ReceptionError,
  fetchReceptionQueue,
  todayAsIsoDate,
} from "./reception-dashboard";
import { ReceptionPrescriptionHandoffAction } from "./reception-prescription-handoff";

type LaunchSearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly entries: readonly ReceptionQueueEntry[] }
  | { readonly status: "error"; readonly notice: ErrorNoticeProps };

const GENERIC_LAUNCH_SEARCH_ERROR = Object.freeze({
  message: "処方入力へ引き継ぐ受付を確認できませんでした。",
  nextAction:
    "日付と選択患者を確認して再試行してください。解消しない場合は同期状態を確認してください。",
} satisfies ErrorNoticeProps);

function noticeFromError(error: unknown): ErrorNoticeProps {
  return error instanceof ReceptionError
    ? error.toNotice()
    : GENERIC_LAUNCH_SEARCH_ERROR;
}

export function ReceptionPrescriptionLaunch() {
  const patientContext = useOptionalPatientContext();
  const selectedPatient = patientContext?.patient ?? null;
  const [businessDate, setBusinessDate] = useState(todayAsIsoDate);
  const [state, setState] = useState<LaunchSearchState>({ status: "idle" });
  const requestRef = useRef<AbortController | null>(null);
  const selectedPatientId = selectedPatient?.patientId;

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState({ status: "idle" });
  }, [selectedPatientId]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedPatient === null || businessDate === "") return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "loading" });

    try {
      const queue = await fetchReceptionQueue(
        businessDate,
        fetch,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setState({
        status: "ready",
        entries: queue.entries.filter(
          (entry) => entry.patient.patientId === selectedPatient.patientId,
        ),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({ status: "error", notice: noticeFromError(error) });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  if (selectedPatient === null) {
    return (
      <section aria-label="処方入力への受付引き継ぎ">
        <p className="operator-empty-copy">
          対象患者を選択すると、その患者の受付を確認して処方入力へ引き継げます。
        </p>
        <Link className="operator-text-action" href="/patients">
          患者検索を開く
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="処方入力への受付引き継ぎ">
      <form className="filter-grid" onSubmit={submit}>
        <label htmlFor="prescription-launch-business-date">
          受付の業務日
          <input
            id="prescription-launch-business-date"
            className="operator-input"
            type="date"
            required
            value={businessDate}
            onChange={(event) => {
              requestRef.current?.abort();
              requestRef.current = null;
              setBusinessDate(event.target.value);
              setState({ status: "idle" });
            }}
          />
        </label>
        <div className="operator-inline-actions">
          <button
            type="submit"
            className="operator-button"
            data-kind="secondary"
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? "確認中…" : "対象受付を確認"}
          </button>
        </div>
      </form>

      <p className="operator-empty-copy">
        選択患者: {selectedPatient.name}。受付IDは手入力せず、認証済み受付キューから選択します。
      </p>

      {state.status === "error" ? (
        <ErrorNotice severity="ERROR" {...state.notice} />
      ) : null}

      {state.status === "ready" && state.entries.length === 0 ? (
        <p className="empty-state" role="status">
          指定日の認証済み受付キューに、この患者の受付はありません。受付が未登録、別日、または取得不能の可能性を確認してください。
        </p>
      ) : null}

      {state.status === "ready" && state.entries.length > 0 ? (
        <TableScroll label="選択患者の該当受付。横方向にスクロールできます">
          <table className="operator-table operator-table-dense">
            <caption className="operator-table-caption">
              {businessDate} の受付キューのうち、選択患者に一致した受付
            </caption>
            <thead>
              <tr>
                <th scope="col">受付ID</th>
                <th scope="col">受付状態</th>
                <th scope="col">次の操作</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((entry) => (
                <tr key={entry.receptionId}>
                  <td>{entry.receptionId}</td>
                  <td>
                    <DomainStatusBadge
                      query={{ domain: "reception", key: entry.receptionStatus }}
                    />
                  </td>
                  <td>
                    <ReceptionPrescriptionHandoffAction
                      entry={entry}
                      businessDate={businessDate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : null}
    </section>
  );
}
