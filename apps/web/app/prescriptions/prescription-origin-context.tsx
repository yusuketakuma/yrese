"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import { useOptionalPatientContext } from "../components/patient-context";
import type { UnsavedWorkRecord } from "../components/unsaved-work";

/**
 * A tab-local pointer to the validated reception that initiated prescription entry.
 *
 * Deliberately excludes patient demographics and medication data. The destination re-reads the
 * existing reception API and verifies the patient relationship before rendering an editor.
 */
export interface PrescriptionReceptionOrigin {
  readonly receptionId: string;
  readonly patientId: string;
  readonly businessDate: string;
}

interface PrescriptionOriginContextValue {
  readonly origin: PrescriptionReceptionOrigin | null;
  readonly selectOrigin: (origin: PrescriptionReceptionOrigin) => void;
  readonly clearOrigin: () => void;
}

const PrescriptionOriginContext =
  createContext<PrescriptionOriginContextValue | null>(null);

export const PRESCRIPTION_ORIGIN_CHANGE_MESSAGE =
  "この患者には別の受付に関連付いた未保存の処方下書きがあります。別受付へ移動すると、その下書きはこのタブから破棄されます。続行しますか？";

export function createPrescriptionReceptionOrigin(
  entry: ReceptionQueueEntry,
  businessDate: string,
): PrescriptionReceptionOrigin {
  return {
    receptionId: entry.receptionId,
    patientId: entry.patient.patientId,
    businessDate,
  };
}

export function isSamePrescriptionReceptionOrigin(
  left: PrescriptionReceptionOrigin | null,
  right: PrescriptionReceptionOrigin,
): boolean {
  return (
    left?.receptionId === right.receptionId &&
    left.patientId === right.patientId &&
    left.businessDate === right.businessDate
  );
}

export function conflictingPrescriptionDrafts(
  records: readonly UnsavedWorkRecord[],
  currentOrigin: PrescriptionReceptionOrigin | null,
  nextOrigin: PrescriptionReceptionOrigin,
): readonly UnsavedWorkRecord[] {
  if (isSamePrescriptionReceptionOrigin(currentOrigin, nextOrigin)) return [];
  return records.filter(
    (record) =>
      record.kind === "prescription-draft" &&
      record.patientId === nextOrigin.patientId,
  );
}

export function PrescriptionOriginProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const patientContext = useOptionalPatientContext();
  const selectedPatientId = patientContext?.patient?.patientId ?? null;
  const [origin, setOrigin] = useState<PrescriptionReceptionOrigin | null>(null);

  // A reception pointer must never survive an explicit switch to another patient.
  useEffect(() => {
    setOrigin((current) =>
      current !== null && current.patientId !== selectedPatientId ? null : current,
    );
  }, [selectedPatientId]);

  const selectOrigin = useCallback(
    (next: PrescriptionReceptionOrigin) => setOrigin({ ...next }),
    [],
  );
  const clearOrigin = useCallback(() => setOrigin(null), []);

  const value = useMemo<PrescriptionOriginContextValue>(
    () => ({ origin, selectOrigin, clearOrigin }),
    [clearOrigin, origin, selectOrigin],
  );

  return (
    <PrescriptionOriginContext.Provider value={value}>
      {children}
    </PrescriptionOriginContext.Provider>
  );
}

export function useOptionalPrescriptionOrigin(): PrescriptionOriginContextValue | null {
  return useContext(PrescriptionOriginContext);
}
