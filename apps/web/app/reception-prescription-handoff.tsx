"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import {
  toPatientContextData,
  useOptionalPatientContext,
} from "./components/patient-context";
import { PrototypeAction } from "./components/operator-ui";
import { useOptionalUnsavedWork } from "./components/unsaved-work";
import {
  PRESCRIPTION_ORIGIN_CHANGE_MESSAGE,
  conflictingPrescriptionDrafts,
  createPrescriptionReceptionOrigin,
  useOptionalPrescriptionOrigin,
} from "./prescriptions/prescription-origin-context";
import { isReceptionOpenForPrescriptionEntry } from "./prescriptions/prescription-reception";

export const canOpenPrescriptionFromReception =
  isReceptionOpenForPrescriptionEntry;

function unavailableReason(entry: ReceptionQueueEntry): string {
  if (entry.receptionStatus === "CANCELLED") {
    return "取消済み受付から処方入力は開始できません";
  }
  if (entry.receptionStatus === "COMPLETED") {
    return "完了済み受付から新しい処方入力は開始できません";
  }
  return "アプリケーションの患者・受付コンテキストが未接続です";
}

export function ReceptionPrescriptionHandoffAction({
  entry,
  businessDate,
}: {
  readonly entry: ReceptionQueueEntry;
  readonly businessDate: string;
}) {
  const patientContext = useOptionalPatientContext();
  const unsavedWork = useOptionalUnsavedWork();
  const originContext = useOptionalPrescriptionOrigin();
  const available =
    patientContext !== null &&
    originContext !== null &&
    canOpenPrescriptionFromReception(entry);
  const actionLabel = `この受付を処方入力へ引き継ぐ: ${entry.patient.name}（患者番号 ${entry.patient.patientNumber}、受付ID ${entry.receptionId}）`;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!available || patientContext === null || originContext === null) {
      event.preventDefault();
      return;
    }

    const nextOrigin = createPrescriptionReceptionOrigin(entry, businessDate);
    const currentPatientId = patientContext.patient?.patientId ?? null;
    const patientChangeAllowed =
      unsavedWork?.confirmPatientContextChange(
        currentPatientId,
        nextOrigin.patientId,
      ) ?? true;
    if (!patientChangeAllowed) {
      event.preventDefault();
      return;
    }

    const conflicts = conflictingPrescriptionDrafts(
      unsavedWork?.records ?? [],
      originContext.origin,
      nextOrigin,
    );
    if (conflicts.length > 0) {
      if (
        typeof window === "undefined" ||
        !window.confirm(PRESCRIPTION_ORIGIN_CHANGE_MESSAGE)
      ) {
        event.preventDefault();
        return;
      }
      for (const conflict of conflicts) {
        unsavedWork?.removeWork(conflict.id);
      }
    }

    patientContext.selectPatient(toPatientContextData(entry.patient));
    originContext.selectOrigin(nextOrigin);
  }

  if (!available) {
    const reason = unavailableReason(entry);
    return (
      <PrototypeAction actionLabel={actionLabel} reason={reason}>
        処方入力へ
      </PrototypeAction>
    );
  }

  return (
    <Link
      className="operator-button"
      href="/prescriptions"
      onClick={handleClick}
      aria-label={actionLabel}
    >
      処方入力へ
    </Link>
  );
}
