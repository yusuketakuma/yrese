"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { EligibilityStatus } from "@yrese/contracts";
import { patientId } from "@yrese/shared-kernel";

import { PatientHeader, computeAgeYears } from "./patient-header";

/**
 * 患者文脈の横断保持(R-PATCTX 全画面横断固定 / H-01・H-02 取り違え防止)。
 *
 * App Router の RootLayout は画面遷移で再マウントされないため、レイアウト直下に置いた
 * 本 Provider の状態は遷移後も維持される。これにより「業務対象として選択した患者」を
 * 全業務画面の固定バー(PatientContextBar)で常時提示できる。別患者を選ぶと前患者の
 * 文脈は破棄され残存しない(H-02)。
 *
 * 表示投影(PatientContextData)は患者検索結果(API-001)の表示フィールドと同型で、将来の
 * get-by-id API でも同じ形で供給できる。PHI をログ・計測へ渡さない。
 */
export interface PatientContextData {
  readonly patientId: string;
  readonly name: string;
  readonly kana: string;
  readonly birthDate: string;
  readonly sex: "male" | "female" | "unknown";
  readonly eligibilityStatus: EligibilityStatus;
  readonly eligibilityCheckedAt?: string;
}

export interface PatientContextValue {
  readonly patient: PatientContextData | null;
  readonly selectPatient: (patient: PatientContextData) => void;
  readonly clearPatient: () => void;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientContextProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientContextData | null>(null);
  const value = useMemo<PatientContextValue>(
    () => ({
      patient,
      selectPatient: setPatient,
      clearPatient: () => setPatient(null),
    }),
    [patient],
  );
  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

/** Provider 必須のアクセサ(存在しなければ実装ミスとして例外)。 */
export function usePatientContext(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (ctx === null) {
    throw new Error("usePatientContext must be used within PatientContextProvider");
  }
  return ctx;
}

/** Provider 任意のアクセサ(スタンドアロン利用では null を返す)。 */
export function useOptionalPatientContext(): PatientContextValue | null {
  return useContext(PatientContext);
}

/**
 * 患者文脈バーの表示部(純粋・テスト可能)。選択中患者の固定表示と解除ボタンのみを担う。
 * 年齢は JST 暦日で判定する asOf を受け取り、実行環境のタイムゾーンに依存させない。
 */
export interface PatientContextBarViewProps {
  readonly patient: PatientContextData;
  readonly onClear: () => void;
  /** 年齢計算の基準日時。既定は呼び出し時刻。 */
  readonly asOf?: Date;
}

export function PatientContextBarView(props: PatientContextBarViewProps) {
  const p = props.patient;
  return (
    <div className="patient-context-bar" data-has-patient="true">
      <p className="patient-context-bar-title" role="status">
        選択中の患者(全画面共通の業務対象)
      </p>
      <PatientHeader
        patientId={patientId(p.patientId)}
        name={p.name}
        kana={p.kana}
        birthDate={p.birthDate}
        age={computeAgeYears(p.birthDate, props.asOf ?? new Date())}
        sex={p.sex}
        eligibility={p.eligibilityStatus}
        {...(p.eligibilityCheckedAt !== undefined
          ? { eligibilityCheckedAt: p.eligibilityCheckedAt }
          : {})}
      />
      <button type="button" onClick={props.onClear}>
        選択解除
      </button>
    </div>
  );
}

/**
 * 全画面横断の患者文脈バー。選択中の患者を固定表示し、明示的な解除を提供する。
 * 患者未選択時は何も表示しない。レイアウトのシェルに配置して全業務画面で共有する。
 */
export function PatientContextBar() {
  const ctx = useOptionalPatientContext();
  if (ctx === null || ctx.patient === null) {
    return null;
  }
  return <PatientContextBarView patient={ctx.patient} onClear={ctx.clearPatient} />;
}
