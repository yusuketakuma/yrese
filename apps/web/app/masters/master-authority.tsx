"use client";

import { useEffect, useState } from "react";

import {
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import {
  fetchSessionScopes,
  scopeAbsenceIsMeasurable,
  sessionHasScopes,
  toSessionNotice,
  type SessionRequestOptions,
  type SessionScopes,
} from "../api/session-client";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import { KeyValueList, Panel, StatusPill } from "../components/operator-ui";

/**
 * SCR-023 のうち、実際に取得できる唯一の事実を表示する区画。
 *
 * ここで表示するのは「現在のセッションに API が返した scope と運用識別子」であり、
 * マスターの版・件数・適用日・差分・ハッシュではない(それらは MST-001 の blocker で
 * 取得経路自体が存在しない)。権限の有無は実行可否ではないため、その区別を同じ
 * カード内に常時可視で併記する。
 */

/** 本番適用権限の候補。MOD-007 §3 は apply の割当を未確定のまま残している。 */
export const MASTER_ADMIN_SCOPES = [
  permissionScope("master", "admin"),
] as const satisfies readonly PermissionScope[];

const DEV_STUB_CAVEAT =
  "開発用テナントスタブが有効な環境では、APIが返す scope はこの画面が宣言した scope の投影です。本番認証での実際の付与状況とは限りません。";

const AUTHORITY_VS_EXECUTION =
  "master:admin が付与されていても、取込・検証・適用・Edge配布は MST-001 の blocker により実行されません。権限の有無と実行可否は別です。";

export type MasterAuthorityState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly session: SessionScopes }
  | { readonly kind: "error"; readonly notice: ErrorNoticeProps };

/** 取得失敗を空表示や「権限なし」へ潰さず、状態として区別したまま返す。 */
export async function loadMasterAuthorityState(
  options?: SessionRequestOptions,
): Promise<MasterAuthorityState> {
  try {
    return { kind: "ready", session: await fetchSessionScopes(options) };
  } catch (error) {
    return { kind: "error", notice: toSessionNotice(error) };
  }
}

function SessionFacts({ session }: { readonly session: SessionScopes }) {
  const granted = sessionHasScopes(session, MASTER_ADMIN_SCOPES);
  // 欠落が測定結果でない場合(dev stubが宣言済みscopeしか返さない)は断定しない。
  const measured = granted || scopeAbsenceIsMeasurable(MASTER_ADMIN_SCOPES);
  return (
    <>
      <p>
        <StatusPill tone={granted ? "info" : "neutral"}>
          {granted
            ? "master:admin 付与あり"
            : measured
              ? "master:admin 付与なし"
              : "master:admin 未確認"}
        </StatusPill>{" "}
        {granted
          ? "このセッションにはマスター管理 scope が付与されています。"
          : measured
            ? "このセッションにはマスター管理 scope が付与されていません。"
            : "このセッションでは master:admin の付与有無を確認できていません。付与なしとは断定しません。"}
      </p>
      <KeyValueList
        items={[
          { label: "テナントID", value: session.tenantId },
          { label: "薬局ID", value: session.pharmacyId },
          { label: "操作者ID", value: session.actorId },
          { label: "付与scope数", value: `${session.scopes.length}件` },
        ]}
      />
      {session.scopes.length === 0 ? (
        <EmptyState message="APIは scope を1件も返しませんでした。付与状況を管理者に確認してください。" />
      ) : (
        <div className="check-chip-row">
          {session.scopes.map((scope) => (
            <StatusPill key={scope}>{scope}</StatusPill>
          ))}
        </div>
      )}
      <p className="operator-empty-copy">{DEV_STUB_CAVEAT}</p>
    </>
  );
}

export function MasterAuthorityView({
  state,
}: {
  readonly state: MasterAuthorityState;
}) {
  return (
    <Panel
      className="live-surface-panel"
      title="セッション権限（/whoami 実データ）"
      description="APIが現在のセッションについて返した scope と運用識別子だけを表示します。マスターの版・件数・適用日ではありません。"
    >
      <section
        aria-label="セッション権限"
        {...(state.kind === "loading" ? { "aria-busy": "true" } : {})}
      >
        {state.kind === "loading" ? (
          <LoadingState label="セッションの権限情報を取得しています…" />
        ) : null}
        {state.kind === "ready" ? <SessionFacts session={state.session} /> : null}
        {state.kind === "error" ? <ErrorNotice {...state.notice} /> : null}
      </section>
      <p className="operator-empty-copy">{AUTHORITY_VS_EXECUTION}</p>
    </Panel>
  );
}

export function MasterAuthorityCard() {
  const [state, setState] = useState<MasterAuthorityState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadMasterAuthorityState({ signal: controller.signal }).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return <MasterAuthorityView state={state} />;
}
