"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type UnsavedWorkKind = "prescription-draft";

export interface UnsavedWorkRecord<TSnapshot = unknown> {
  readonly id: string;
  readonly kind: UnsavedWorkKind;
  readonly label: string;
  readonly href: string;
  readonly patientId?: string;
  readonly snapshot: TSnapshot;
}

export interface UnsavedWorkStore {
  readonly upsert: (record: UnsavedWorkRecord) => void;
  readonly remove: (id: string) => void;
  readonly removeForPatient: (patientId: string) => void;
  readonly get: <TSnapshot>(id: string) => UnsavedWorkRecord<TSnapshot> | undefined;
  readonly list: () => readonly UnsavedWorkRecord[];
  readonly count: () => number;
  readonly hasForPatient: (patientId: string) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validRecoveryIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[/?#\\]/u.test(value)
  );
}

/**
 * Recover a persisted draft through its exact reception/patient/business-date route.
 * Malformed or legacy snapshots fall back to the caller-provided safe route.
 */
export function resolveUnsavedWorkHref(record: UnsavedWorkRecord): string {
  if (record.kind !== "prescription-draft" || !isRecord(record.snapshot)) {
    return record.href;
  }
  const { receptionId, patientId, businessDate } = record.snapshot;
  if (
    !validRecoveryIdentifier(receptionId) ||
    !validRecoveryIdentifier(patientId) ||
    patientId !== record.patientId ||
    typeof businessDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(businessDate)
  ) {
    return record.href;
  }
  const query = new URLSearchParams({ patientId, date: businessDate });
  return `/prescriptions/${encodeURIComponent(receptionId)}?${query}`;
}

export function createUnsavedWorkStore(
  initialRecords: readonly UnsavedWorkRecord[] = [],
): UnsavedWorkStore {
  const records = new Map(initialRecords.map((record) => [record.id, record] as const));

  return {
    upsert(record) {
      records.set(record.id, { ...record, href: resolveUnsavedWorkHref(record) });
    },
    remove(id) {
      records.delete(id);
    },
    removeForPatient(patientId) {
      for (const [id, record] of records) {
        if (record.patientId === patientId) records.delete(id);
      }
    },
    get<TSnapshot>(id: string) {
      return records.get(id) as UnsavedWorkRecord<TSnapshot> | undefined;
    },
    list() {
      return [...records.values()];
    },
    count() {
      return records.size;
    },
    hasForPatient(patientId) {
      return [...records.values()].some((record) => record.patientId === patientId);
    },
  };
}

export function shouldBlockBeforeUnload(unsavedCount: number): boolean {
  return unsavedCount > 0;
}

export function patientContextChangeNeedsConfirmation(
  records: readonly UnsavedWorkRecord[],
  currentPatientId: string | null,
  nextPatientId: string | null,
): boolean {
  if (currentPatientId === null || currentPatientId === nextPatientId) return false;
  return records.some((record) => record.patientId === currentPatientId);
}

export const UNSAVED_PATIENT_CHANGE_MESSAGE =
  "未保存の処方下書きがあります。患者を切り替えると、このタブ内の下書きは破棄されます。続行しますか？";

interface UnsavedWorkContextValue {
  readonly records: readonly UnsavedWorkRecord[];
  readonly upsertWork: (record: UnsavedWorkRecord) => void;
  readonly removeWork: (id: string) => void;
  readonly getWorkSnapshot: <TSnapshot>(id: string) => TSnapshot | undefined;
  readonly discardPatientWork: (patientId: string) => void;
  readonly confirmPatientContextChange: (
    currentPatientId: string | null,
    nextPatientId: string | null,
  ) => boolean;
}

const UnsavedWorkContext = createContext<UnsavedWorkContextValue | null>(null);

export function UnsavedWorkProvider({ children }: { readonly children: ReactNode }) {
  const storeRef = useRef<UnsavedWorkStore | null>(null);
  if (storeRef.current === null) storeRef.current = createUnsavedWorkStore();
  const store = storeRef.current;
  const [revision, setRevision] = useState(0);

  const publish = useCallback(() => setRevision((current) => current + 1), []);

  const upsertWork = useCallback(
    (record: UnsavedWorkRecord) => {
      store.upsert(record);
      publish();
    },
    [publish, store],
  );

  const removeWork = useCallback(
    (id: string) => {
      const existed = store.get(id) !== undefined;
      store.remove(id);
      if (existed) publish();
    },
    [publish, store],
  );

  const getWorkSnapshot = useCallback(
    <TSnapshot,>(id: string): TSnapshot | undefined =>
      store.get<TSnapshot>(id)?.snapshot,
    [store],
  );

  const discardPatientWork = useCallback(
    (patientId: string) => {
      const existed = store.hasForPatient(patientId);
      store.removeForPatient(patientId);
      if (existed) publish();
    },
    [publish, store],
  );

  const confirmPatientContextChange = useCallback(
    (currentPatientId: string | null, nextPatientId: string | null) => {
      const records = store.list();
      if (
        !patientContextChangeNeedsConfirmation(
          records,
          currentPatientId,
          nextPatientId,
        )
      ) {
        return true;
      }
      if (typeof window === "undefined") return false;
      const accepted = window.confirm(UNSAVED_PATIENT_CHANGE_MESSAGE);
      if (accepted && currentPatientId !== null) {
        store.removeForPatient(currentPatientId);
        publish();
      }
      return accepted;
    },
    [publish, store],
  );

  const records = useMemo(() => store.list(), [revision, store]);

  useEffect(() => {
    if (!shouldBlockBeforeUnload(records.length)) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [records.length]);

  const value = useMemo<UnsavedWorkContextValue>(
    () => ({
      records,
      upsertWork,
      removeWork,
      getWorkSnapshot,
      discardPatientWork,
      confirmPatientContextChange,
    }),
    [
      records,
      upsertWork,
      removeWork,
      getWorkSnapshot,
      discardPatientWork,
      confirmPatientContextChange,
    ],
  );

  return (
    <UnsavedWorkContext.Provider value={value}>
      {children}
    </UnsavedWorkContext.Provider>
  );
}

export function useUnsavedWork(): UnsavedWorkContextValue {
  const context = useContext(UnsavedWorkContext);
  if (context === null) {
    throw new Error("useUnsavedWork must be used within UnsavedWorkProvider");
  }
  return context;
}

export function useOptionalUnsavedWork(): UnsavedWorkContextValue | null {
  return useContext(UnsavedWorkContext);
}

export function UnsavedWorkStatusView({
  count,
  href = "/prescriptions",
}: {
  readonly count: number;
  readonly href?: string;
}) {
  if (count <= 0) return null;
  return (
    <div className="unsaved-work-status" role="status">
      <span>
        <strong>未保存下書き {count}件</strong>
        <small>このタブ内のみ・再読込で消失</small>
      </span>
      <Link href={href}>処方下書きへ戻る</Link>
    </div>
  );
}

export function UnsavedWorkStatus() {
  const context = useOptionalUnsavedWork();
  const records = context?.records ?? [];
  return (
    <UnsavedWorkStatusView
      count={records.length}
      href={records.length === 1 ? records[0]!.href : "/prescriptions"}
    />
  );
}
