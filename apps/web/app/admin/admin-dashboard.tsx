"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  permissionScope,
  type PermissionAction,
  type PermissionResource,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { ErrorNotice } from "../components/error-notice";
import {
  type AdminDashboardSnapshot,
  countAdminScopes,
  hasRequiredAdminScopes,
  loadAdminDashboardSnapshot,
} from "./admin-data";
import styles from "./admin-dashboard.module.css";

type AdminTab =
  | "overview"
  | "permissions"
  | "notifications"
  | "audit-policy"
  | "accessibility"
  | "commands"
  | "integrations";

interface BrowserPreferenceSnapshot {
  readonly reducedMotion: boolean | null;
  readonly forcedColors: boolean | null;
  readonly darkScheme: boolean | null;
}

const UNKNOWN_BROWSER_PREFERENCES: BrowserPreferenceSnapshot = {
  reducedMotion: null,
  forcedColors: null,
  darkScheme: null,
};

const TAB_ITEMS: readonly {
  readonly id: AdminTab;
  readonly label: string;
  readonly symbol: string;
}[] = [
  { id: "overview", label: "アクセス概要", symbol: "人" },
  { id: "permissions", label: "権限", symbol: "鍵" },
  { id: "notifications", label: "通知", symbol: "知" },
  { id: "audit-policy", label: "監査ポリシー", symbol: "監" },
  { id: "accessibility", label: "アクセシビリティ", symbol: "A" },
  { id: "commands", label: "自然言語コマンド", symbol: "語" },
  { id: "integrations", label: "連携", symbol: "連" },
] as const;

const RESOURCE_LABELS: Record<PermissionResource, string> = {
  patient: "患者",
  reception: "受付",
  insurance: "保険",
  "public-expense": "公費",
  prescription: "処方",
  dispensing: "調剤",
  calculation: "算定",
  claim: "請求",
  report: "帳票",
  master: "マスター",
  "audit-log": "監査ログ",
  tenant: "テナント",
  user: "利用者",
  device: "端末",
  sync: "同期",
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  read: "参照",
  write: "作成・更新",
  confirm: "専門職確認",
  finalize: "確定",
  admin: "管理",
};

function formatInstant(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "取得不能";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(parsed);
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <span className={styles.statusChip} data-tone={tone}>
      {children}
    </span>
  );
}

function MetricCard({
  symbol,
  label,
  value,
  detail,
  tone,
}: {
  readonly symbol: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly detail: string;
  readonly tone: "accent" | "info" | "warning" | "success";
}) {
  return (
    <article className={styles.metricCard} data-tone={tone} role="listitem">
      <span className={styles.metricSymbol} aria-hidden="true">
        {symbol}
      </span>
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
        <p className={styles.metricDetail}>{detail}</p>
      </div>
    </article>
  );
}

function DisabledAction({
  label,
  reason,
}: {
  readonly label: string;
  readonly reason: string;
}) {
  return (
    <div className={styles.disabledAction}>
      <button type="button" disabled title={reason}>
        {label}
      </button>
      <small>利用不可: {reason}</small>
    </div>
  );
}

function UnavailablePanel({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <section className={styles.unavailablePanel} aria-labelledby={`${title}-heading`}>
      <div className={styles.unavailableSymbol} aria-hidden="true">
        —
      </div>
      <div>
        <h3 id={`${title}-heading`}>{title}</h3>
        <p>{message}</p>
      </div>
    </section>
  );
}

function AccessOverview({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  if (snapshot.identity.status !== "ready") return null;
  const identity = snapshot.identity.data;
  return (
    <div className={styles.sectionStack}>
      <section className={styles.panel} aria-labelledby="current-context-heading">
        <header className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>AUTHENTICATED CONTEXT</p>
            <h3 id="current-context-heading">現在の認証・テナント文脈</h3>
          </div>
          <StatusChip tone="success">サーバー検証済み</StatusChip>
        </header>
        <div className={styles.contextGrid}>
          <div>
            <span>操作者ID</span>
            <strong>{identity.actorId}</strong>
          </div>
          <div>
            <span>テナントID</span>
            <strong>{identity.tenantId}</strong>
          </div>
          <div>
            <span>薬局ID</span>
            <strong>{identity.pharmacyId}</strong>
          </div>
          <div>
            <span>管理画面の必要scope</span>
            <strong>user:admin + tenant:admin</strong>
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="current-session-heading">
        <header className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>CURRENT SESSION ONLY</p>
            <h3 id="current-session-heading">現在の利用者セッション</h3>
          </div>
          <StatusChip tone="accent">1セッション</StatusChip>
        </header>
        <div className={styles.tableScroll} tabIndex={0} aria-label="現在の利用者セッション表">
          <table className={styles.dataTable}>
            <caption className={styles.tableCaption}>
              利用者ディレクトリAPIは存在しないため、認証済みの現在セッションだけを表示します。
            </caption>
            <thead>
              <tr>
                <th scope="col">操作者ID</th>
                <th scope="col">テナント</th>
                <th scope="col">薬局</th>
                <th scope="col">付与scope数</th>
                <th scope="col">管理画面アクセス</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{identity.actorId}</td>
                <td>{identity.tenantId}</td>
                <td>{identity.pharmacyId}</td>
                <td>{identity.scopes.length}</td>
                <td>
                  <StatusChip tone="success">許可</StatusChip>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <UnavailablePanel
        title="利用者ディレクトリ"
        message="利用者一覧、氏名、メール、最終ログイン、MFA状態を返す承認済みAPIとdomain modelがないため、架空の利用者を表示しません。"
      />
    </div>
  );
}

function PermissionMatrix({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  if (snapshot.identity.status !== "ready") return null;
  const granted = new Set<PermissionScope>(snapshot.identity.data.scopes);
  return (
    <section className={styles.panel} aria-labelledby="permission-matrix-heading">
      <header className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>EFFECTIVE SCOPES</p>
          <h3 id="permission-matrix-heading">現在の操作者に付与された権限</h3>
        </div>
        <StatusChip tone="accent">{granted.size} scope</StatusChip>
      </header>
      <p className={styles.panelLead}>
        表示は <code>/whoami</code> の検証済み応答から導出します。ロール名や既定割当は推測しません。
      </p>
      <div className={styles.tableScroll} tabIndex={0} aria-label="権限scopeマトリクス">
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">リソース</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th scope="col" key={action}>{ACTION_LABELS[action]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_RESOURCES.map((resource) => (
              <tr key={resource}>
                <th scope="row">{RESOURCE_LABELS[resource]}</th>
                {PERMISSION_ACTIONS.map((action) => {
                  const allowed = granted.has(permissionScope(resource, action));
                  return (
                    <td key={action}>
                      <StatusChip tone={allowed ? "success" : "neutral"}>
                        {allowed ? "付与" : "なし"}
                      </StatusChip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.panelFooter}>
        <DisabledAction
          label="権限を変更"
          reason="権限変更API、監査付き更新command、ロール既定割当が未承認です"
        />
      </div>
    </section>
  );
}

function NotificationSettings() {
  return (
    <UnavailablePanel
      title="通知設定"
      message="通知チャネル、購読状態、配信履歴の承認済み契約がありません。通知件数や設定状態を捏造せず、未登録状態として表示します。"
    />
  );
}

function AuditPolicy() {
  return (
    <div className={styles.sectionStack}>
      <section className={styles.policyPanel} aria-labelledby="audit-policy-heading">
        <span className={styles.policySymbol} aria-hidden="true">監</span>
        <div>
          <h3 id="audit-policy-heading">監査証跡は維持、一般業務Webでのイベント閲覧は提供しません</h3>
          <p>
            監査イベント生成、権限制御API、append-only保全、hash-chain検証は既存境界で維持します。画面台帳UIX-007に従い、この管理画面にはイベント一覧を再実装しません。
          </p>
        </div>
      </section>
      <UnavailablePanel
        title="監査ログのエクスポート"
        message="承認済みのexport契約、目的制限、保存期間、再識別防止、監査付き実行commandがないため利用できません。"
      />
    </div>
  );
}

function AccessibilityPanel({
  preferences,
}: {
  readonly preferences: BrowserPreferenceSnapshot;
}) {
  const label = (value: boolean | null, enabled: string, disabled: string) =>
    value === null ? "取得不能" : value ? enabled : disabled;
  return (
    <section className={styles.panel} aria-labelledby="accessibility-heading">
      <header className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>BROWSER PREFERENCES</p>
          <h3 id="accessibility-heading">現在の端末から検出した表示設定</h3>
        </div>
        <StatusChip tone="accent">端末ローカル</StatusChip>
      </header>
      <div className={styles.settingList}>
        <div>
          <span>モーション抑制</span>
          <strong>{label(preferences.reducedMotion, "有効", "無効")}</strong>
        </div>
        <div>
          <span>強制カラーモード</span>
          <strong>{label(preferences.forcedColors, "有効", "無効")}</strong>
        </div>
        <div>
          <span>配色設定</span>
          <strong>{label(preferences.darkScheme, "ダーク優先", "ライト優先")}</strong>
        </div>
      </div>
      <p className={styles.panelLead}>
        組織共通のアクセシビリティ設定を保存するAPIはないため、この画面から永続設定は変更しません。
      </p>
    </section>
  );
}

function CommandSettings() {
  return (
    <UnavailablePanel
      title="自然言語・音声コマンド設定"
      message="承認済みのAI/音声処理境界、保持条件、リージョン、PHI取扱い、実行commandが接続されるまでfail-closedで利用できません。"
    />
  );
}

function IntegrationPanel({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  return (
    <div className={styles.sectionStack}>
      <section className={styles.panel} aria-labelledby="integration-health-heading">
        <header className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>LIVE HEALTH ENDPOINT</p>
            <h3 id="integration-health-heading">API接続状態</h3>
          </div>
          {snapshot.health.status === "ready" ? (
            <StatusChip tone="success">応答あり</StatusChip>
          ) : (
            <StatusChip tone="warning">取得不能</StatusChip>
          )}
        </header>
        {snapshot.health.status === "ready" ? (
          <div className={styles.contextGrid}>
            <div><span>サービス</span><strong>{snapshot.health.data.service}</strong></div>
            <div><span>バージョン</span><strong>{snapshot.health.data.version}</strong></div>
            <div><span>状態</span><strong>{snapshot.health.data.status}</strong></div>
            <div><span>サーバー時刻</span><strong>{formatInstant(snapshot.health.data.timestamp)}</strong></div>
          </div>
        ) : (
          <ErrorNotice
            severity="WARNING"
            message={snapshot.health.error.message}
            nextAction="再取得してください。継続する場合は同期状態画面で影響範囲を確認してください。"
          />
        )}
      </section>
      <Link className={styles.primaryLink} href="/sync-status">
        同期状態・外部連携画面を開く
      </Link>
    </div>
  );
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
    const denied = snapshot.identity.error.kind === "PERMISSION_DENIED";
    const unauthenticated = snapshot.identity.error.kind === "UNAUTHENTICATED";
    return (
      <section className={styles.dashboard} aria-labelledby="admin-title">
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>SCR-029</p>
            <h2 id="admin-title">yrese 管理設定</h2>
            <p>認証・tenant境界・権限を確認してから管理情報を表示します。</p>
          </div>
        </header>
        <ErrorNotice
          severity="ERROR"
          message={snapshot.identity.error.message}
          nextAction={
            unauthenticated
              ? "認証セッションを確立してから再度開いてください。"
              : denied
                ? "管理者に user:admin と tenant:admin の付与状況を確認してください。"
                : "再取得してください。継続する場合はシステム管理者へ連絡してください。"
          }
        />
        <button type="button" className={styles.refreshButton} onClick={onRefresh}>
          再取得
        </button>
      </section>
    );
  }

  const identity = snapshot.identity.data;
  if (!hasRequiredAdminScopes(identity)) {
    return (
      <section className={styles.dashboard} aria-labelledby="admin-title">
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>SCR-029</p>
            <h2 id="admin-title">yrese 管理設定</h2>
            <p>この画面は user:admin と tenant:admin の両方を要求します。</p>
          </div>
          <StatusChip tone="danger">アクセス拒否</StatusChip>
        </header>
        <ErrorNotice
          severity="ERROR"
          message="管理画面に必要な権限scopeが不足しています。"
          nextAction="管理者に user:admin と tenant:admin の両方の付与状況を確認してください。"
        />
      </section>
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

  return (
    <section className={styles.dashboard} aria-labelledby="admin-title">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>SCR-029 · CONNECTED ADMINISTRATION</p>
          <h2 id="admin-title">yrese 管理設定ダッシュボード</h2>
          <p>現在の認証コンテキストと実APIから、権限・環境・接続状態を確認します。</p>
        </div>
        <div className={styles.headerActions}>
          <StatusChip tone="success">管理scope確認済み</StatusChip>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "更新中…" : "最新状態に更新"}
          </button>
        </div>
      </header>

      <div className={styles.metricGrid} role="list" aria-label="管理画面の主要指標">
        <MetricCard
          symbol="人"
          label="現在の操作者"
          value={identity.actorId}
          detail="/whoami の認証済みactor"
          tone="accent"
        />
        <MetricCard
          symbol="鍵"
          label="付与scope"
          value={`${identity.scopes.length} 件`}
          detail="現在の認証コンテキスト"
          tone="info"
        />
        <MetricCard
          symbol="管"
          label="管理scope"
          value={`${countAdminScopes(identity)} 件`}
          detail="末尾 :admin のscope"
          tone="warning"
        />
        <MetricCard
          symbol="接"
          label="API状態"
          value={healthReady ? "稼働中" : "取得不能"}
          detail={healthReady ? `v${snapshot.health.data.version}` : "partial failure"}
          tone={healthReady ? "success" : "warning"}
        />
      </div>

      <div className={styles.workspace}>
        <div className={styles.primaryColumn}>
          <div className={styles.tabs} role="tablist" aria-label="管理設定カテゴリ">
            {TAB_ITEMS.map((tab, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={
                  activeTab === tab.id ? `admin-tabpanel-${tab.id}` : undefined
                }
                id={`admin-tab-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
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
                <span aria-hidden="true">{tab.symbol}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div
            className={styles.tabPanel}
            role="tabpanel"
            id={`admin-tabpanel-${activeTab}`}
            aria-labelledby={`admin-tab-${activeTab}`}
          >
            {renderTab()}
          </div>
        </div>

        <aside className={styles.secondaryColumn} aria-label="環境・管理補助情報">
          <section className={styles.sidePanel} aria-labelledby="environment-heading">
            <header>
              <h3 id="environment-heading">環境・組織情報</h3>
              <StatusChip tone="success">実API</StatusChip>
            </header>
            <dl className={styles.keyValueList}>
              <div><dt>テナントID</dt><dd>{identity.tenantId}</dd></div>
              <div><dt>薬局ID</dt><dd>{identity.pharmacyId}</dd></div>
              <div><dt>操作者ID</dt><dd>{identity.actorId}</dd></div>
              <div><dt>APIバージョン</dt><dd>{healthReady ? snapshot.health.data.version : "取得不能"}</dd></div>
              <div><dt>最終取得</dt><dd>{formatInstant(snapshot.loadedAt)}</dd></div>
            </dl>
          </section>

          <section className={styles.sidePanel} aria-labelledby="quick-actions-heading">
            <header><h3 id="quick-actions-heading">管理者クイックアクション</h3></header>
            <div className={styles.quickActions}>
              <button type="button" onClick={onRefresh} disabled={refreshing}>
                認証・状態を再取得
              </button>
              <Link href="/sync-status">同期状態を確認</Link>
              <DisabledAction label="利用者を追加" reason="利用者管理APIが未実装です" />
              <DisabledAction label="セッション管理" reason="認証セッション管理APIが未実装です" />
              <DisabledAction label="APIキー管理" reason="承認済みの鍵管理契約がありません" />
              <DisabledAction label="データエクスポート" reason="目的制限・監査付きexport契約がありません" />
            </div>
          </section>

          <section className={styles.sidePanel} aria-labelledby="scope-boundary-heading">
            <header><h3 id="scope-boundary-heading">実装境界</h3></header>
            <ul className={styles.boundaryList}>
              <li>利用者一覧・MFA・最終ログインは未提供</li>
              <li>権限変更はAPI側command未実装のため不可</li>
              <li>監査イベント閲覧画面はUIX-007により提供しない</li>
              <li>自然言語・音声設定は承認済み境界待ち</li>
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [reloadKey, setReloadKey] = useState(0);
  const [preferences, setPreferences] = useState<BrowserPreferenceSnapshot>(
    UNKNOWN_BROWSER_PREFERENCES,
  );
  const [state, setState] = useState<
    | { readonly kind: "loading" }
    | { readonly kind: "loaded"; readonly snapshot: AdminDashboardSnapshot }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    if (state.kind === "loaded") {
      setState({ kind: "loading" });
    }
    loadAdminDashboardSnapshot(fetch, controller.signal).then((snapshot) => {
      if (current) setState({ kind: "loaded", snapshot });
    });
    return () => {
      current = false;
      controller.abort();
    };
    // state is intentionally excluded: reloadKey is the only reload trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const refreshing = state.kind === "loading" && reloadKey > 0;
  const loadingMarkup = useMemo(
    () => (
      <section className={styles.dashboard} aria-labelledby="admin-loading-title" aria-busy="true">
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>SCR-029</p>
            <h2 id="admin-loading-title">yrese 管理設定ダッシュボード</h2>
            <p>認証・tenant境界・API状態を検証しています。</p>
          </div>
        </header>
        <div className={styles.loadingGrid} role="status" aria-live="polite">
          <span>管理情報を読み込み中…</span>
        </div>
      </section>
    ),
    [],
  );

  if (state.kind === "loading") return loadingMarkup;
  return (
    <AdminDashboardView
      snapshot={state.snapshot}
      preferences={preferences}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => setReloadKey((current) => current + 1)}
      refreshing={refreshing}
    />
  );
}
