"use client";

import { usePathname } from "next/navigation";
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

import {
  patientSearchResultSchema,
  type EligibilityStatus,
  type PatientSearchResult,
} from "@yrese/contracts";
import { patientId, permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import { DomainStatusBadge } from "./domain-status-badge";
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

/** 検索結果/get-by-id 応答(PatientSummary)を横断患者文脈(表示投影)へ変換する(R-PATCTX)。 */
export function toPatientContextData(p: PatientSearchResult): PatientContextData {
  return {
    patientId: p.patientId,
    name: p.name,
    kana: p.kana,
    birthDate: p.birthDate,
    sex: p.sex,
    eligibilityStatus: p.eligibilityStatus,
    ...(p.eligibilityCheckedAt !== undefined
      ? { eligibilityCheckedAt: p.eligibilityCheckedAt }
      : {}),
  };
}

/**
 * 患者 get-by-id(API-001 / GET /patients/:patientId)。
 * 契約の正本は @yrese/contracts。404(対象患者が参照不能)は null を返し、
 * その他の失敗は throw する(呼び出し側が stale 扱いを判断)。
 */
export async function fetchPatientById(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PatientContextData | null> {
  const res = await fetchImpl(resolveWebApiUrl(`/patients/${encodeURIComponent(id)}`), {
    headers: devTenantHeaders([permissionScope("patient", "read")]),
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`patient refresh failed (HTTP ${res.status})`);
  }
  return toPatientContextData(patientSearchResultSchema.parse(await res.json()));
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientContextProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientContextData | null>(null);
  // selectPatient/clearPatient は安定参照(useState setter ベース)。
  // 再取得 effect の依存に入っても再実行ループを起こさない。
  const clearPatient = useCallback(() => setPatient(null), []);
  const value = useMemo<PatientContextValue>(
    () => ({
      patient,
      selectPatient: setPatient,
      clearPatient,
    }),
    [patient, clearPatient],
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
  /**
   * 直近の再取得が失敗し、表示が古い可能性があるか(H-03 隣接)。
   * true のとき「情報が古い可能性」を明示する(古い情報を最新に見せない)。
   */
  readonly stale?: boolean;
}

export function PatientContextBarView(props: PatientContextBarViewProps) {
  const p = props.patient;
  return (
    <div
      className="patient-context-bar"
      data-has-patient="true"
      data-stale={props.stale ? "true" : "false"}
    >
      <p className="patient-context-bar-title" role="status">
        選択中の患者(全画面共通の業務対象)
        {props.stale && (
          <span className="patient-context-bar-stale">
            <DomainStatusBadge query={{ domain: "sync", key: "STALE" }} />
          </span>
        )}
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
 *
 * 鮮度(R-PATCTX): 画面遷移(pathname 変化)のたびに get-by-id で選択中患者を再取得し、
 * 資格確認状態等を最新化する。再取得が 404(参照不能)なら取り違え防止のため選択を解除し
 * role=alert で通知する。ネットワーク失敗時は選択を維持しつつ「情報が古い可能性」を明示する
 * (古い表示を最新に見せない)。
 */
export function PatientContextBar() {
  const ctx = useOptionalPatientContext();
  if (ctx === null) {
    return null;
  }
  // usePathname 等の Next ランタイム依存フックは Provider 配下でのみマウントされる
  // 内部コンポーネント側に置く(スタンドアロン描画・テストで例外にしない)。
  return <PatientContextBarWithRefresh ctx={ctx} />;
}

function PatientContextBarWithRefresh({ ctx }: { readonly ctx: PatientContextValue }) {
  const pathname = usePathname();
  const [stale, setStale] = useState(false);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);
  const generationRef = useRef(0);

  const patientIdKey = ctx.patient?.patientId ?? null;
  const selectPatient = ctx.selectPatient;
  const clearPatient = ctx.clearPatient;

  useEffect(() => {
    if (patientIdKey === null) {
      return;
    }
    const generation = ++generationRef.current;
    fetchPatientById(patientIdKey).then(
      (fresh) => {
        if (generation !== generationRef.current) {
          return; // 古い応答は破棄(患者切替・連続遷移対策)
        }
        if (fresh === null) {
          clearPatient();
          setRemovedNotice(
            "選択中だった患者の情報が取得できなくなったため、選択を解除しました。患者検索から選択し直してください。",
          );
          setStale(false);
          return;
        }
        setRemovedNotice(null);
        setStale(false);
        // effect 依存は ID とコールバック(安定参照)のみのため、この更新で再実行されない
        selectPatient(fresh);
      },
      () => {
        if (generation !== generationRef.current) {
          return;
        }
        setStale(true); // 失敗時は選択を維持しつつ鮮度低下を明示
      },
    );
    // patientIdKey / pathname が変わるたびに再取得(同一患者でも遷移ごとに最新化)
  }, [patientIdKey, pathname, selectPatient, clearPatient]);

  if (ctx.patient === null) {
    return removedNotice !== null ? (
      <p className="patient-context-removed" role="alert">
        {removedNotice}
      </p>
    ) : null;
  }
  return <PatientContextBarView patient={ctx.patient} onClear={ctx.clearPatient} stale={stale} />;
}
