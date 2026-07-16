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
  errorResponseSchema,
  patientSearchResultSchema,
  type EligibilityStatus,
  type PatientSearchResult,
} from "@yrese/contracts";
import {
  PATIENT_NOT_FOUND_ERROR_CODE,
  patientId,
  permissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";
import { DomainStatusBadge } from "./domain-status-badge";
import { PatientHeader, computeAgeYears } from "./patient-header";

const invalidPatientNotFoundResponseErrorMessage =
  "Patient refresh not-found response invalid";

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

interface PatientRefreshAuthorityClaim {
  readonly authority: number;
  readonly patientId: string;
}

interface InternalPatientContextValue extends PatientContextValue {
  readonly selectionAuthority: number;
  readonly refreshRunner: ReturnType<typeof createPatientRefreshRunner>;
  readonly captureRefreshAuthority: (
    patientId: string,
  ) => PatientRefreshAuthorityClaim | null;
  readonly commitRefreshedPatient: (
    authorityClaim: PatientRefreshAuthorityClaim,
    patient: PatientContextData,
  ) => boolean;
  readonly commitRefreshedRemoval: (
    authorityClaim: PatientRefreshAuthorityClaim,
  ) => boolean;
  readonly isRefreshAuthorityCurrent: (
    authorityClaim: PatientRefreshAuthorityClaim,
  ) => boolean;
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
  signal?: AbortSignal,
): Promise<PatientContextData | null> {
  const res = await fetchImpl(resolveWebApiUrl(`/patients/${encodeURIComponent(id)}`), {
    headers: devTenantHeaders([permissionScope("patient", "read")]),
    cache: "no-store",
    ...(signal !== undefined ? { signal } : {}),
  });
  if (res.status === 404) {
    let parsedError: ReturnType<typeof errorResponseSchema.safeParse>;
    try {
      const body: unknown = await res.json();
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new Error(invalidPatientNotFoundResponseErrorMessage);
      }
      const errorCodeDescriptor = Object.getOwnPropertyDescriptor(body, "errorCode");
      const messageDescriptor = Object.getOwnPropertyDescriptor(body, "message");
      if (
        errorCodeDescriptor === undefined ||
        !("value" in errorCodeDescriptor) ||
        !errorCodeDescriptor.enumerable ||
        messageDescriptor === undefined ||
        !("value" in messageDescriptor) ||
        !messageDescriptor.enumerable
      ) {
        throw new Error(invalidPatientNotFoundResponseErrorMessage);
      }
      parsedError = errorResponseSchema.safeParse({
        errorCode: errorCodeDescriptor.value,
        message: messageDescriptor.value,
      });
    } catch {
      throw new Error(invalidPatientNotFoundResponseErrorMessage);
    }
    if (
      !parsedError.success ||
      parsedError.data.errorCode !== PATIENT_NOT_FOUND_ERROR_CODE
    ) {
      throw new Error(invalidPatientNotFoundResponseErrorMessage);
    }
    return null;
  }
  if (res.status !== 200) {
    throw new Error(`patient refresh failed (HTTP ${res.status})`);
  }
  const parsed = patientSearchResultSchema.parse(await res.json());
  if (parsed.patientId !== id) {
    throw new Error("Patient refresh response identity mismatch");
  }
  return toPatientContextData(parsed);
}

const PatientContext = createContext<InternalPatientContextValue | null>(null);

export function PatientContextProvider({ children }: { children: ReactNode }) {
  const refreshRunnerRef = useRef<ReturnType<typeof createPatientRefreshRunner> | null>(null);
  if (refreshRunnerRef.current === null) {
    refreshRunnerRef.current = createPatientRefreshRunner();
  }
  const refreshRunner = refreshRunnerRef.current;
  const authorityControllerRef = useRef<
    ReturnType<typeof createPatientContextAuthorityController> | null
  >(null);
  if (authorityControllerRef.current === null) {
    authorityControllerRef.current = createPatientContextAuthorityController(refreshRunner);
  }
  const authorityController = authorityControllerRef.current;
  const [selection, setSelection] = useState<{
    readonly patient: PatientContextData | null;
    readonly authority: number;
  }>({ patient: null, authority: authorityController.currentAuthority() });

  // Public selection changes synchronously revoke the previous refresh authority before
  // React schedules the visible state update. This also covers same-ID reselection.
  const selectPatient = useCallback(
    (patient: PatientContextData) => {
      const authority = authorityController.select(patient.patientId);
      setSelection({ patient, authority });
    },
    [authorityController],
  );
  const clearPatient = useCallback(() => {
    const authority = authorityController.clear();
    setSelection({ patient: null, authority });
  }, [authorityController]);
  const captureRefreshAuthority = useCallback(
    (patientId: string) => authorityController.capture(patientId),
    [authorityController],
  );
  const commitRefreshedPatient = useCallback(
    (authorityClaim: PatientRefreshAuthorityClaim, patient: PatientContextData) => {
      if (!authorityController.acceptFresh(authorityClaim, patient.patientId)) {
        return false;
      }
      setSelection((previous) =>
        previous.authority === authorityClaim.authority &&
        previous.patient?.patientId === authorityClaim.patientId
          ? { patient, authority: authorityClaim.authority }
          : previous,
      );
      return true;
    },
    [authorityController],
  );
  const commitRefreshedRemoval = useCallback(
    (authorityClaim: PatientRefreshAuthorityClaim) => {
      const authority = authorityController.acceptRemoval(authorityClaim);
      if (authority === null) {
        return false;
      }
      setSelection({ patient: null, authority });
      return true;
    },
    [authorityController],
  );
  const isRefreshAuthorityCurrent = useCallback(
    (authorityClaim: PatientRefreshAuthorityClaim) =>
      authorityController.isCurrent(authorityClaim),
    [authorityController],
  );
  const value = useMemo<InternalPatientContextValue>(
    () => ({
      patient: selection.patient,
      selectPatient,
      clearPatient,
      selectionAuthority: selection.authority,
      refreshRunner,
      captureRefreshAuthority,
      commitRefreshedPatient,
      commitRefreshedRemoval,
      isRefreshAuthorityCurrent,
    }),
    [
      selection,
      selectPatient,
      clearPatient,
      refreshRunner,
      captureRefreshAuthority,
      commitRefreshedPatient,
      commitRefreshedRemoval,
      isRefreshAuthorityCurrent,
    ],
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
  const ctx = useContext(PatientContext);
  if (ctx === null) {
    return null;
  }
  // usePathname 等の Next ランタイム依存フックは Provider 配下でのみマウントされる
  // 内部コンポーネント側に置く(スタンドアロン描画・テストで例外にしない)。
  return <PatientContextBarWithRefresh ctx={ctx} />;
}

function PatientContextBarWithRefresh({ ctx }: { readonly ctx: InternalPatientContextValue }) {
  const pathname = usePathname();
  const [staleAuthority, setStaleAuthority] = useState<PatientRefreshAuthorityClaim | null>(
    null,
  );
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);

  const patientIdKey = ctx.patient?.patientId ?? null;
  const clearPatient = ctx.clearPatient;
  const handleClear = clearPatient;

  useEffect(() => {
    const refreshRunner = ctx.refreshRunner;
    if (patientIdKey === null) {
      refreshRunner.invalidate();
      return;
    }
    const refreshAuthority = ctx.captureRefreshAuthority(patientIdKey);
    if (refreshAuthority === null) {
      return;
    }
    setRemovedNotice(null);
    refreshRunner.refresh(patientIdKey, {
      onFresh: (fresh) => {
        if (!ctx.commitRefreshedPatient(refreshAuthority, fresh)) {
          return;
        }
        setRemovedNotice(null);
        setStaleAuthority(null);
      },
      onRemoved: () => {
        if (!ctx.commitRefreshedRemoval(refreshAuthority)) {
          return;
        }
        setRemovedNotice(
          "選択中だった患者の情報が取得できなくなったため、選択を解除しました。患者検索から選択し直してください。",
        );
        setStaleAuthority(null);
      },
      onFailure: () => {
        if (ctx.isRefreshAuthorityCurrent(refreshAuthority)) {
          setStaleAuthority(refreshAuthority);
        }
      },
    });
    // patientIdKey / pathname が変わるたびに再取得(同一患者でも遷移ごとに最新化)
    return () => refreshRunner.invalidate();
    // selectionAuthority is intentionally not a dependency: same-ID direct selection revokes
    // the old claim synchronously but does not add an extra refresh beyond pathname/ID changes.
  }, [
    patientIdKey,
    pathname,
    ctx.refreshRunner,
    ctx.captureRefreshAuthority,
    ctx.commitRefreshedPatient,
    ctx.commitRefreshedRemoval,
    ctx.isRefreshAuthorityCurrent,
  ]);

  if (ctx.patient === null) {
    return removedNotice !== null ? (
      <p className="patient-context-removed" role="alert">
        {removedNotice}
      </p>
    ) : null;
  }
  const stale =
    staleAuthority !== null &&
    staleAuthority.authority === ctx.selectionAuthority &&
    staleAuthority.patientId === ctx.patient.patientId;
  return <PatientContextBarView patient={ctx.patient} onClear={handleClear} stale={stale} />;
}

interface PatientRefreshCallbacks {
  readonly onFresh: (patient: PatientContextData) => void;
  readonly onRemoved: () => void;
  readonly onFailure: () => void;
}

interface PatientRefreshInvalidator {
  readonly invalidate: () => void;
}

/** Synchronous authority boundary shared by direct selection and refresh callbacks. */
export function createPatientContextAuthorityController(
  refreshInvalidator: PatientRefreshInvalidator,
) {
  let authority = 0;
  let currentPatientId: string | null = null;

  const isCurrent = (authorityClaim: PatientRefreshAuthorityClaim) =>
    authorityClaim.authority === authority &&
    authorityClaim.patientId === currentPatientId;

  return {
    currentAuthority: () => authority,
    select(patientId: string) {
      refreshInvalidator.invalidate();
      authority += 1;
      currentPatientId = patientId;
      return authority;
    },
    clear() {
      refreshInvalidator.invalidate();
      authority += 1;
      currentPatientId = null;
      return authority;
    },
    capture(patientId: string): PatientRefreshAuthorityClaim | null {
      return currentPatientId === patientId ? { authority, patientId } : null;
    },
    isCurrent,
    acceptFresh(
      authorityClaim: PatientRefreshAuthorityClaim,
      freshPatientId: string,
    ) {
      return freshPatientId === authorityClaim.patientId && isCurrent(authorityClaim);
    },
    acceptRemoval(authorityClaim: PatientRefreshAuthorityClaim): number | null {
      if (!isCurrent(authorityClaim)) {
        return null;
      }
      authority += 1;
      currentPatientId = null;
      return authority;
    },
  };
}

/** Keeps only the latest patient refresh authoritative across clear, switch, and unmount. */
export function createPatientRefreshRunner(
  fetcher: (id: string, signal: AbortSignal) => Promise<PatientContextData | null> = (
    id,
    signal,
  ) => fetchPatientById(id, fetch, signal),
) {
  let generation = 0;
  let activeOwner:
    | {
        readonly controller: AbortController;
      }
    | undefined;
  let isInvalidating = false;
  return {
    invalidate() {
      if (isInvalidating) return;
      isInvalidating = true;
      try {
        generation += 1;
        const previousOwner = activeOwner;
        activeOwner = undefined;
        previousOwner?.controller.abort();
      } finally {
        isInvalidating = false;
      }
    },
    async refresh(id: string, callbacks: PatientRefreshCallbacks) {
      if (isInvalidating) return;
      const currentGeneration = ++generation;
      const previousOwner = activeOwner;
      const currentOwner = { controller: new AbortController() };
      activeOwner = currentOwner;
      previousOwner?.controller.abort();
      if (currentGeneration !== generation) {
        if (activeOwner === currentOwner) {
          activeOwner = undefined;
        }
        currentOwner.controller.abort();
        return;
      }
      let outcome:
        | { readonly kind: "success"; readonly value: PatientContextData | null }
        | { readonly kind: "failure" };
      try {
        outcome = {
          kind: "success",
          value: await fetcher(id, currentOwner.controller.signal),
        };
      } catch {
        outcome = { kind: "failure" };
      } finally {
        if (activeOwner === currentOwner) {
          activeOwner = undefined;
        }
      }
      if (currentGeneration !== generation) {
        return;
      }
      if (outcome.kind === "failure") {
        callbacks.onFailure();
        return;
      }
      const fresh = outcome.value;
      if (fresh === null) {
        callbacks.onRemoved();
        return;
      }
      callbacks.onFresh(fresh);
    },
  };
}
