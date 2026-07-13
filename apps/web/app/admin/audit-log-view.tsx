"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AUDIT_LOG_DEFAULT_LIMIT,
  auditLogResponseSchema,
  type AuditLogEntry,
  type AuditLogResponse,
} from "@yrese/contracts";
import { permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import { registeredErrorCodeOrUndefined } from "../components/error-code";
import { devTenantHeaders } from "../dev-tenant";

/**
 * 監査ログビュー(SCR-028 / R-AUDIT)。
 *
 * 目的: who/when/what の証跡閲覧(安全管理GL 監査ログ要求)+ hash chain 検証結果
 * (改ざん検知状態)の明示。契約の正本は @yrese/contracts(auditLogResponseSchema)。
 *
 * 表示は識別子のみ(氏名等の PHI を含まない契約)。chain 破断は隠さず CRITICAL で
 * 明示する(改ざん・破損の可能性を「正常」に見せない — fail-closed の可視化)。
 */

const OUTCOME_LABELS: Record<AuditLogEntry["outcome"], string> = {
  success: "成功",
  denied: "拒否",
  failed: "失敗",
};

export type AuditLogState =
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | { kind: "loaded"; data: AuditLogResponse; refreshState: AuditLogRefreshState };

export type AuditLogRefreshState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps };

export const auditLogResponseInvariantErrorMessage =
  "Audit response contains inconsistent verification counts";
export const auditLogResponseOrderInvariantErrorMessage =
  "Verified audit response is not ordered newest first";
export const auditLogResponseWindowInvariantErrorMessage =
  "Audit response does not match the requested display window";

function compareUtcIsoInstants(left: string, right: string): number {
  const leftSecond = left.slice(0, 19);
  const rightSecond = right.slice(0, 19);
  if (leftSecond !== rightSecond) {
    return leftSecond < rightSecond ? -1 : 1;
  }

  const leftFraction = left.endsWith("Z") && left[19] === "." ? left.slice(20, -1) : "";
  const rightFraction = right.endsWith("Z") && right[19] === "." ? right.slice(20, -1) : "";
  const width = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeft = leftFraction.padEnd(width, "0");
  const normalizedRight = rightFraction.padEnd(width, "0");
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

function auditLogErrorNotice(error: unknown): ErrorNoticeProps {
  return typeof error === "object" && error !== null && "notice" in error
    ? (error as { notice: ErrorNoticeProps }).notice
    : {
        message: "監査ログの処理に失敗しました。",
        nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      };
}

export async function fetchAuditLog(
  fetchImpl: typeof fetch = fetch,
): Promise<AuditLogResponse> {
  const res = await fetchImpl(
    resolveWebApiUrl(`/audit/events?limit=${AUDIT_LOG_DEFAULT_LIMIT}`),
    {
      headers: devTenantHeaders([permissionScope("audit-log", "read")]),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const rawErrorCode =
      typeof body === "object" && body !== null && "errorCode" in body
        ? (body as { errorCode: unknown }).errorCode
        : undefined;
    const errorCode = registeredErrorCodeOrUndefined(rawErrorCode);
    throw Object.assign(new Error(`監査ログの取得に失敗しました(HTTP ${res.status})。`), {
      notice: {
        message:
          res.status === 403
            ? "権限がありません。"
            : `監査ログの取得に失敗しました(HTTP ${res.status})。`,
        nextAction:
          res.status === 403
            ? "管理者に権限(audit-log:read)の付与状況を確認してください。"
            : "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
        ...(errorCode !== undefined ? { errorCode } : {}),
      } satisfies ErrorNoticeProps,
    });
  }
  if (res.status !== 200) {
    throw Object.assign(new Error(`監査ログの取得に失敗しました(HTTP ${res.status})。`), {
      notice: {
        message: `監査ログの取得に失敗しました(HTTP ${res.status})。`,
        nextAction: "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
      } satisfies ErrorNoticeProps,
    });
  }
  const parsed = auditLogResponseSchema.parse(await res.json());
  if (parsed.chainVerification.ok) {
    const eventIds = new Set<string>();
    for (const entry of parsed.entries) {
      if (eventIds.has(entry.eventId)) {
        throw new Error("Verified audit response contains duplicate event identities");
      }
      eventIds.add(entry.eventId);
    }
  }
  const countsAreConsistent = parsed.chainVerification.ok
    ? parsed.chainVerification.checkedCount === parsed.totalCount
    : parsed.chainVerification.checkedCount === parsed.chainVerification.breakIndex &&
      parsed.chainVerification.breakIndex < parsed.totalCount;
  if (parsed.entries.length > parsed.totalCount || !countsAreConsistent) {
    throw new Error(auditLogResponseInvariantErrorMessage);
  }
  if (parsed.chainVerification.ok) {
    for (let index = 1; index < parsed.entries.length; index += 1) {
      if (
        compareUtcIsoInstants(
          parsed.entries[index - 1]!.wallClock,
          parsed.entries[index]!.wallClock,
        ) < 0
      ) {
        throw new Error(auditLogResponseOrderInvariantErrorMessage);
      }
    }
  }
  const exceedsRequestedWindow = parsed.entries.length > AUDIT_LOG_DEFAULT_LIMIT;
  const omitsHealthyWindowEntries =
    parsed.chainVerification.ok &&
    parsed.entries.length !== Math.min(parsed.totalCount, AUDIT_LOG_DEFAULT_LIMIT);
  if (exceedsRequestedWindow || omitsHealthyWindowEntries) {
    throw new Error(auditLogResponseWindowInvariantErrorMessage);
  }
  return parsed;
}

/** Keeps only the latest audit fetch authoritative without cancelling audited GET requests. */
export function createAuditLogRunner(
  fetcher: () => Promise<AuditLogResponse>,
  emit: (update: (prev: AuditLogState) => AuditLogState) => void,
) {
  let generation = 0;
  let activeFlight:
    | { readonly ownerToken: object; readonly sharedPromise: Promise<void> }
    | undefined;
  return {
    invalidate() {
      activeFlight = undefined;
      generation += 1;
    },
    run(): Promise<void> {
      if (activeFlight !== undefined) {
        return activeFlight.sharedPromise;
      }

      const ownerToken = {};
      let resolveShared!: () => void;
      let rejectShared!: (reason?: unknown) => void;
      const sharedPromise = new Promise<void>((resolve, reject) => {
        resolveShared = resolve;
        rejectShared = reject;
      });
      activeFlight = { ownerToken, sharedPromise };
      const currentGeneration = ++generation;
      const execute = async () => {
        emit((prev) =>
          prev.kind === "loaded"
            ? { ...prev, refreshState: { kind: "loading" } }
            : { kind: "loading" },
        );
        try {
          const data = await fetcher();
          if (currentGeneration === generation) {
            emit(() => ({ kind: "loaded", data, refreshState: { kind: "idle" } }));
          }
        } catch (error) {
          if (currentGeneration === generation) {
            const notice = auditLogErrorNotice(error);
            emit((prev) =>
              prev.kind === "loaded"
                ? { ...prev, refreshState: { kind: "error", notice } }
                : { kind: "error", notice },
            );
          }
        }
      };
      const cleanupOwner = () => {
        if (activeFlight?.ownerToken === ownerToken) {
          activeFlight = undefined;
        }
      };
      void execute().then(
        () => {
          cleanupOwner();
          resolveShared();
        },
        (error: unknown) => {
          cleanupOwner();
          rejectShared(error);
        },
      );
      return sharedPromise;
    },
  };
}

/** chain 検証結果の表示(純粋・テスト可能)。破断を「正常」に見せない。 */
export function ChainVerificationNotice({
  verification,
}: {
  readonly verification: AuditLogResponse["chainVerification"];
}) {
  if (verification.ok) {
    return (
      <p className="audit-chain-ok" role="status" data-chain-ok="true">
        改ざん検知: 正常(hash chain {verification.checkedCount}件検証済み)
      </p>
    );
  }
  return (
    <ErrorNotice
      severity="CRITICAL"
      message={`監査ログの hash chain が破断しています(位置: ${verification.breakIndex}、理由: ${verification.reason})。改ざん・破損の可能性があります。`}
      nextAction="このログを証跡として使用せず、直ちにセキュリティ管理者へ連絡し、保存層の原本を保全してください。"
    />
  );
}

/** 監査ログ表(純粋・テスト可能)。 */
export function AuditLogTable({ entries }: { readonly entries: readonly AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="監査イベントはまだ記録されていません" />;
  }
  return (
    <div className="table-scroll">
      <table className="audit-log-table">
        <thead>
          <tr>
            <th scope="col">日時</th>
            <th scope="col">実施者</th>
            <th scope="col">操作</th>
            <th scope="col">対象</th>
            <th scope="col">結果</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.eventId} data-outcome={entry.outcome}>
              <td>{entry.wallClock}</td>
              <td>{entry.actorId}</td>
              <td>
                <code className="audit-event-type">{entry.auditEventType}</code>
                {entry.businessReasonCode !== undefined && (
                  <span className="audit-business-reason">
                    (理由: {entry.businessReasonCode})
                  </span>
                )}
              </td>
              <td>
                {entry.targetRef.kind}: {entry.targetRef.id}
              </td>
              <td>
                <span className="audit-outcome" data-outcome={entry.outcome}>
                  {OUTCOME_LABELS[entry.outcome]}
                  {entry.reasonCode !== undefined && `(${entry.reasonCode})`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ロード済みデータの表示部(純粋・テスト可能)。 */
export function AuditLogView({ data }: { readonly data: AuditLogResponse }) {
  return (
    <section aria-label="監査ログ">
      <ChainVerificationNotice verification={data.chainVerification} />
      <p role="status" className="audit-log-count">
        監査イベント: 全{data.totalCount}件(最新{data.entries.length}件を表示)
      </p>
      <AuditLogTable entries={data.entries} />
    </section>
  );
}

/** ロード済み監査ログを保持したままrefresh状態と操作だけを切り替える。 */
export function AuditLogLoadedState({
  data,
  refreshState,
  onRefresh,
}: {
  readonly data: AuditLogResponse;
  readonly refreshState: AuditLogRefreshState;
  readonly onRefresh: () => void;
}) {
  return (
    <>
      {refreshState.kind === "loading" && (
        <p role="status">
          最新情報を取得中です。直前に取得・検証した内容を表示しています。
        </p>
      )}
      {refreshState.kind === "error" && (
        <p role="status">
          最新情報を取得できなかったため、直前に取得・検証した内容を表示しています。
        </p>
      )}
      <AuditLogView data={data} />
      {refreshState.kind === "error" && <ErrorNotice {...refreshState.notice} />}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshState.kind === "loading"}
      >
        {refreshState.kind === "loading"
          ? "更新中…"
          : refreshState.kind === "error"
            ? "最新情報の取得を再試行"
            : "最新に更新"}
      </button>
    </>
  );
}

/** fetch と状態管理を担う client パネル。 */
export function AuditLogPanel() {
  const [state, setState] = useState<AuditLogState>({ kind: "loading" });
  const runnerRef = useRef<ReturnType<typeof createAuditLogRunner> | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createAuditLogRunner(fetchAuditLog, setState);
  }

  const load = useCallback(() => {
    void runnerRef.current?.run();
  }, []);

  useEffect(() => {
    load();
    return () => runnerRef.current?.invalidate();
  }, [load]);

  return (
    <div className="audit-log-panel">
      {state.kind === "loading" && <LoadingState />}
      {state.kind === "error" && (
        <>
          <ErrorNotice {...state.notice} />
          <button type="button" onClick={load}>
            再試行
          </button>
        </>
      )}
      {state.kind === "loaded" && (
        <AuditLogLoadedState
          data={state.data}
          refreshState={state.refreshState}
          onRefresh={load}
        />
      )}
    </div>
  );
}
