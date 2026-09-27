"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { MigrationStateResult } from "@yrese/contracts";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  permissionScope,
  type PermissionAction,
  type PermissionResource,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { EmptyState } from '../components/empty-state';
import { ErrorNotice } from '../components/error-notice';
import { LoadingState } from '../components/loading-state';
import {
  InlineNotice,
  KeyValueList,
  MetricCard,
  MetricGrid,
  OperatorPage,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
  TableScroll,
  type OperatorTone,
} from '../components/operator/operator-ui';
import {
  AdminDataError,
  type AdminDashboardSnapshot,
  countAdminScopes,
  hasRequiredAdminScopes,
  loadAdminDashboardSnapshot,
} from './admin-data';
import {
  ADMIN_SCREEN_TITLE,
  TAB_ITEMS,
  UNKNOWN_BROWSER_PREFERENCES,
  formatInstant,
  type AdminTab,
  type BrowserPreferenceSnapshot,
} from './admin-meta';
import {
  AccessOverview,
  AccessibilityPanel,
  AuditPolicy,
  CommandSettings,
  IntegrationPanel,
  NotificationSettings,
  PermissionMatrix,
  UnavailablePanel,
} from './admin-panels';

/** Component boundary fallback: loader internals must never strand the screen in pending. */
export async function loadAdminDashboardSafely(
  load: () => AdminDashboardSnapshot | Promise<AdminDashboardSnapshot>,
): Promise<AdminDashboardSnapshot> {
  try {
    return await load();
  } catch {
    const error = new AdminDataError(
      "UNAVAILABLE",
      "管理情報を取得できませんでした。",
    );
    return {
      identity: { status: "error", error },
      health: { status: "error", error },
      migrationState: {
        status: "error",
        notice: {
          message: "管理情報を取得できませんでした。",
          nextAction:
            "再取得してください。解消しない場合はシステム管理者へ連絡してください。",
        },
      },
      loadedAt: new Date().toISOString(),
    };
  }
}
export interface AdminDashboardViewProps {
  readonly snapshot: AdminDashboardSnapshot;
  readonly preferences: BrowserPreferenceSnapshot;
  readonly activeTab: AdminTab;
  readonly onTabChange: (tab: AdminTab) => void;
  readonly onRefresh: () => void;
  readonly refreshing?: boolean;
}

export function AdminDashboardView({
  snapshot,
  preferences,
  activeTab,
  onTabChange,
  onRefresh,
  refreshing = false,
}: AdminDashboardViewProps) {
  if (snapshot.identity.status === "error") {
    const kind = snapshot.identity.error.kind;
    return (
      <OperatorPage>
        <ScreenHeader
          title={ADMIN_SCREEN_TITLE}
          eyebrow="SCR-029 運用・保守"
          description="認証・tenant境界・権限を確認してから管理情報を表示します。"
          meta={<StatusPill tone="warning">認証情報取得不能</StatusPill>}
          actions={
            <button type="button" className="operator-button" onClick={onRefresh}>
              再取得
            </button>
          }
        />
        <Panel title="管理情報を表示できません">
          <ErrorNotice
            severity="ERROR"
            message={snapshot.identity.error.message}
            nextAction={
              kind === "UNAUTHENTICATED"
                ? "認証セッションを確立してから再度開いてください。"
                : kind === "PERMISSION_DENIED"
                  ? "管理者に user:admin と tenant:admin の付与状況を確認してください。"
                  : "再取得してください。継続する場合はシステム管理者へ連絡してください。"
            }
            blocking
          />
        </Panel>
      </OperatorPage>
    );
  }

  const identity = snapshot.identity.data;
  if (!hasRequiredAdminScopes(identity)) {
    return (
      <OperatorPage>
        <ScreenHeader
          title={ADMIN_SCREEN_TITLE}
          eyebrow="SCR-029 運用・保守"
          description="この画面は user:admin と tenant:admin の両方を要求します。"
          meta={<StatusPill tone="danger">アクセス拒否</StatusPill>}
        />
        <Panel title="必要な管理scopeが不足しています" tone="danger">
          <ErrorNotice
            severity="ERROR"
            message="管理画面に必要な権限scopeが不足しています。"
            nextAction="管理者に user:admin と tenant:admin の両方の付与状況を確認してください。"
            blocking
          />
        </Panel>
      </OperatorPage>
    );
  }

  const healthReady = snapshot.health.status === "ready";
  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <AccessOverview snapshot={snapshot} />;
      case "permissions":
        return <PermissionMatrix snapshot={snapshot} />;
      case "notifications":
        return <NotificationSettings />;
      case "audit-policy":
        return <AuditPolicy />;
      case "accessibility":
        return <AccessibilityPanel preferences={preferences} />;
      case "commands":
        return <CommandSettings />;
      case "integrations":
        return <IntegrationPanel snapshot={snapshot} />;
    }
  };

  const rail = (
    <>
      <RailCard
        title="環境・組織情報"
        action={<StatusPill tone="success">実API</StatusPill>}
      >
        <KeyValueList
          items={[
            { label: "テナントID", value: identity.tenantId },
            { label: "薬局ID", value: identity.pharmacyId },
            { label: "操作者ID", value: identity.actorId },
            {
              label: "APIバージョン",
              value: healthReady ? snapshot.health.data.version : "—",
            },
            { label: "最終取得", value: formatInstant(snapshot.loadedAt) },
          ]}
        />
      </RailCard>

      <RailCard title="管理者クイックアクション">
        <div className="operator-stack">
          <button
            type="button"
            className="operator-button"
            onClick={onRefresh}
            disabled={refreshing}
          >
            認証・状態を再取得
          </button>
          <Link className="rail-link-button" href="/sync-status">
            同期状態を確認
          </Link>
          <PrototypeAction reason="利用者管理APIが未実装です">
            利用者を追加
          </PrototypeAction>
          <PrototypeAction reason="認証セッション管理APIが未実装です">
            セッション管理
          </PrototypeAction>
          <PrototypeAction reason="承認済みの鍵管理契約がありません">
            APIキー管理
          </PrototypeAction>
          <PrototypeAction reason="目的制限・監査付きexport契約がありません">
            データエクスポート
          </PrototypeAction>
        </div>
      </RailCard>

      <RailCard title="実装境界" tone="warning">
        <ul className="rail-action-list">
          <li>利用者一覧・MFA・最終ログインは未提供</li>
          <li>権限変更はAPI側command未実装のため不可</li>
          <li>監査イベント閲覧画面はUIX-007により提供しない</li>
          <li>自然言語・音声設定は承認済み境界待ち</li>
        </ul>
        <p className="operator-empty-copy">
          ここに列挙されていないことは、その機能が利用可能であることを意味しません。
        </p>
      </RailCard>
    </>
  );

  return (
    <OperatorPage rail={rail} railLabel="環境・管理補助情報" railSticky={false}>
      <ScreenHeader
        title={ADMIN_SCREEN_TITLE}
        eyebrow="SCR-029 運用・保守"
        description="現在の認証コンテキストと実APIから、権限・環境・接続状態を確認します。"
        meta={<StatusPill tone="success">/whoami・/health 実API接続</StatusPill>}
        actions={
          <button
            type="button"
            className="operator-button"
            data-kind="primary"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "更新中…" : "最新状態に更新"}
          </button>
        }
      />

      <PrototypeBanner>
        利用者管理・通知・自然言語コマンドは承認済み契約が未登録のため実行できません。表示されない項目を「該当なし」「正常」として読まないでください。
      </PrototypeBanner>

      {refreshing ? (
        <InlineNotice title="再取得中" tone="info" announce="polite">
          {formatInstant(snapshot.loadedAt)}
          時点に取得した内容を表示したまま、認証・API状態・スキーマ適用状態を再取得しています。画面上の値はまだ更新されていません。
        </InlineNotice>
      ) : null}

      <MetricGrid>
        <MetricCard
          icon="人"
          label="現在の操作者"
          value={identity.actorId}
          detail="/whoami の認証済みactor"
          tone="accent"
        />
        <MetricCard
          icon="鍵"
          label="付与scope"
          value={identity.scopes.length}
          unit="件"
          detail="現在の認証コンテキスト"
          tone="info"
        />
        <MetricCard
          icon="管"
          label="管理scope"
          value={countAdminScopes(identity)}
          unit="件"
          detail="末尾 :admin のscope"
          tone="neutral"
        />
        <MetricCard
          icon="接"
          label="API状態"
          value={healthReady ? "応答あり" : "—"}
          detail={
            healthReady
              ? `v${snapshot.health.data.version}`
              : "ヘルス応答を取得できていません。停止とも稼働とも判定していません。"
          }
          tone={healthReady ? "success" : "warning"}
        />
      </MetricGrid>

      <div className="check-chip-row" role="tablist" aria-label="管理設定カテゴリ">
        {TAB_ITEMS.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              type="button"
              role="tab"
              className="operator-button"
              data-kind={selected ? "primary" : "secondary"}
              aria-selected={selected}
              aria-controls={selected ? `admin-tabpanel-${tab.id}` : undefined}
              id={`admin-tab-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % TAB_ITEMS.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + TAB_ITEMS.length) % TAB_ITEMS.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? TAB_ITEMS.length - 1
                          : null;
                if (nextIndex === null) return;
                const nextTab = TAB_ITEMS[nextIndex];
                if (nextTab === undefined) return;
                event.preventDefault();
                onTabChange(nextTab.id);
                document.getElementById(`admin-tab-${nextTab.id}`)?.focus();
              }}
            >
              {/* 選択状態を色だけに依存させない(形状記号 + aria-selected + 塗り)。 */}
              <span aria-hidden="true">{selected ? "●" : "○"}</span>
              <span aria-hidden="true">{tab.symbol}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`admin-tabpanel-${activeTab}`}
        aria-labelledby={`admin-tab-${activeTab}`}
      >
        {renderTab()}
      </div>
    </OperatorPage>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [reloadKey, setReloadKey] = useState(0);
  const [preferences, setPreferences] = useState<BrowserPreferenceSnapshot>(
    UNKNOWN_BROWSER_PREFERENCES,
  );
  // 再取得中も直前の結果を保持する(UIX-001 §6: 前回結果を消してローディングへ戻さない)。
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setPending(true);
    loadAdminDashboardSafely(() =>
      loadAdminDashboardSnapshot(fetch, controller.signal),
    ).then((next) => {
      if (!current) return;
      setSnapshot(next);
      setPending(false);
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const queries = {
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)"),
      forcedColors: window.matchMedia("(forced-colors: active)"),
      darkScheme: window.matchMedia("(prefers-color-scheme: dark)"),
    };
    const update = () => {
      setPreferences({
        reducedMotion: queries.reducedMotion.matches,
        forcedColors: queries.forcedColors.matches,
        darkScheme: queries.darkScheme.matches,
      });
    };
    update();
    for (const query of Object.values(queries)) query.addEventListener("change", update);
    return () => {
      for (const query of Object.values(queries)) query.removeEventListener("change", update);
    };
  }, []);

  const loadingMarkup = useMemo(
    () => (
      <OperatorPage>
        <ScreenHeader
          title={ADMIN_SCREEN_TITLE}
          eyebrow="SCR-029 運用・保守"
          description="認証・tenant境界・API状態を検証しています。"
          meta={<StatusPill tone="neutral">検証中</StatusPill>}
        />
        <section aria-label="管理情報の読込状態" aria-busy="true">
          <LoadingState label="認証・tenant境界・API状態を検証しています。" />
        </section>
      </OperatorPage>
    ),
    [],
  );

  if (snapshot === null) return loadingMarkup;
  return (
    <AdminDashboardView
      snapshot={snapshot}
      preferences={preferences}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => setReloadKey((current) => current + 1)}
      refreshing={pending}
    />
  );
}
