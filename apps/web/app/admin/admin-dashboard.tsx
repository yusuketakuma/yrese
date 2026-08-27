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

import { EmptyState } from "../components/empty-state";
import { ErrorNotice } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
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
} from "../components/operator-ui";
import {
  AdminDataError,
  type AdminDashboardSnapshot,
  countAdminScopes,
  hasRequiredAdminScopes,
  loadAdminDashboardSnapshot,
} from "./admin-data";

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

type AdminTab =
  | "overview"
  | "permissions"
  | "notifications"
  | "audit-policy"
  | "accessibility"
  | "commands"
  | "integrations";

/** 凍結: browser gate が accessible name の完全一致で待機する。 */
const ADMIN_SCREEN_TITLE = "yrese 管理設定ダッシュボード";

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

/**
 * schema_migrations の照合結果表示。
 * これは登録済みドメイン状態(visual-status-registry)ではないため DomainStatusBadge を
 * 使わず、StatusPill + 常時可視の日本語ラベルで表す。tone は presentation であり
 * severity ではない。「一致」以外を success にしない。
 */
const MIGRATION_RESULT_PRESENTATION: Record<
  MigrationStateResult,
  { readonly label: string; readonly tone: OperatorTone }
> = {
  up_to_date: { label: "定義と一致(適用済み)", tone: "success" },
  db_ahead: { label: "DBが定義より先行", tone: "warning" },
  version_mismatch: { label: "version不一致", tone: "danger" },
  checksum_mismatch: { label: "checksum不一致", tone: "danger" },
  name_mismatch: { label: "名称不一致", tone: "danger" },
  unapplied_required: { label: "未適用のmigrationあり", tone: "warning" },
};

/** 未提供領域の共通ゲート説明。何が・どのゲートで止まっているかを名指しする。 */
const AUTHORITY_GATE_NOTE =
  "利用者ディレクトリと権限変更操作は提供できません。SCR-029-U（user:admin）と SCR-029-T（tenant:admin）は UIX-001 §12.3 で authority status が candidate / API未登録 であり、canonical API/OpenAPI operation registry への登録と contract test による固定が未了です。";

function formatInstant(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "取得不能";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(parsed);
}

/** 承認済み契約がない領域。0件や未設定ではなく「未提供」として描く。 */
function UnavailablePanel({
  title,
  message,
  detail,
}: {
  readonly title: string;
  readonly message: string;
  readonly detail?: string;
}) {
  return (
    <Panel
      title={title}
      tone="warning"
      actions={<StatusPill tone="warning">未提供</StatusPill>}
    >
      <EmptyState message={message} />
      {detail !== undefined ? (
        <p className="operator-empty-copy">{detail}</p>
      ) : null}
    </Panel>
  );
}

function AccessOverview({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  if (snapshot.identity.status !== "ready") return null;
  const identity = snapshot.identity.data;
  return (
    <div className="operator-stack">
      <Panel
        className="live-surface-panel"
        title="現在の認証・テナント文脈"
        description="認証済みコンテキスト"
        actions={<StatusPill tone="success">サーバー検証済み</StatusPill>}
      >
        <KeyValueList
          items={[
            { label: "操作者ID", value: identity.actorId },
            { label: "テナントID", value: identity.tenantId },
            { label: "薬局ID", value: identity.pharmacyId },
            { label: "管理画面の必要scope", value: "user:admin + tenant:admin" },
          ]}
        />
      </Panel>

      <Panel
        className="live-surface-panel"
        title="現在の利用者セッション"
        description="現在のセッションのみ"
        actions={<StatusPill tone="accent">1セッション</StatusPill>}
      >
        <TableScroll label="現在の利用者セッション表">
          <table className="operator-table operator-table-dense">
            <caption className="operator-table-caption">
              利用者ディレクトリAPIは存在しないため、認証済みの現在セッションだけを表示します。表示が1件であることは、テナント内の利用者が1名であることを意味しません。
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
                  <StatusPill tone="success">許可</StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <UnavailablePanel
        title="利用者ディレクトリ"
        message="利用者一覧、氏名、メール、最終ログイン、MFA状態を返す承認済みAPIとdomain modelがないため、架空の利用者を表示しません。"
        detail={AUTHORITY_GATE_NOTE}
      />
    </div>
  );
}

function PermissionMatrix({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  if (snapshot.identity.status !== "ready") return null;
  const granted = new Set<PermissionScope>(snapshot.identity.data.scopes);
  return (
    <div className="operator-stack">
      <Panel
        className="live-surface-panel"
        title="現在の操作者に付与された権限"
        description="有効な scope"
        actions={<StatusPill tone="accent">{granted.size} scope</StatusPill>}
      >
        <p className="operator-empty-copy">
          表示は <code>/whoami</code> の検証済み応答から導出します。ロール名や既定割当は推測しません。
        </p>
        <TableScroll label="権限scopeマトリクス">
          <table className="operator-table operator-table-dense">
            <caption className="operator-table-caption">
              「なし」は現在のセッションに付与されていないことだけを示し、権限設計上の禁止を意味しません。
            </caption>
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
                        <StatusPill tone={allowed ? "success" : "neutral"}>
                          {allowed ? "付与" : "なし"}
                        </StatusPill>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <Panel
        title="権限変更"
        tone="warning"
        actions={<StatusPill tone="warning">未提供</StatusPill>}
      >
        <p className="operator-empty-copy">{AUTHORITY_GATE_NOTE}</p>
        <PrototypeAction reason="権限変更API、監査付き更新command、ロール既定割当が未承認です">
          権限を変更
        </PrototypeAction>
      </Panel>
    </div>
  );
}

function NotificationSettings() {
  return (
    <UnavailablePanel
      title="通知設定"
      message="通知チャネル、購読状態、配信履歴の承認済み契約がありません。通知件数や設定状態を捏造せず、未登録状態として表示します。"
      detail="通知が表示されないことは、配信すべき通知が無いことを意味しません。"
    />
  );
}

function AuditPolicy() {
  return (
    <div className="operator-stack">
      <Panel
        title="監査証跡は維持、一般業務Webでのイベント閲覧は提供しません"
        actions={<StatusPill tone="neutral">画面台帳 UIX-007</StatusPill>}
      >
        <p className="operator-empty-copy">
          監査イベント生成、権限制御API、append-only保全、hash-chain検証は既存境界で維持します。画面台帳UIX-007に従い、この管理画面には閲覧UIを再実装しません。
        </p>
      </Panel>
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
    <Panel
      title="現在の端末から検出した表示設定"
      description="この端末のブラウザ設定"
      actions={<StatusPill tone="accent">端末ローカル</StatusPill>}
    >
      <KeyValueList
        items={[
          {
            label: "モーション抑制",
            value: label(preferences.reducedMotion, "有効", "無効"),
          },
          {
            label: "強制カラーモード",
            value: label(preferences.forcedColors, "有効", "無効"),
          },
          {
            label: "配色設定",
            value: label(preferences.darkScheme, "ダーク優先", "ライト優先"),
          },
        ]}
      />
      <p className="operator-empty-copy">
        組織共通のアクセシビリティ設定を保存するAPIはないため、この画面から永続設定は変更しません。「取得不能」は設定が無効であることを意味しません。
      </p>
    </Panel>
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

/**
 * `pendingVersions` は照合が途中停止した結果(version/checksum/name 不一致)では
 * API がフィールドごと省略する。省略を「なし（0件）」と描画すると、未適用が
 * 存在しないという未検証の主張になるため、省略時は導出不能として示す
 * (`legacyOrphanDisplay` と同じ規則)。
 */
export function pendingVersionsDisplay(
  pendingVersions: readonly string[] | undefined,
): string {
  if (pendingVersions === undefined) {
    return "—（この照合結果からは導出できません。0件ではありません）";
  }
  return pendingVersions.length === 0
    ? "なし（0件）"
    : pendingVersions.join(", ");
}

function MigrationStatePanel({
  section,
}: {
  readonly section: AdminDashboardSnapshot["migrationState"];
}) {
  if (section.status === "error") {
    return (
      <Panel
        title="DBスキーマ適用状態"
        actions={<StatusPill tone="warning">取得不能</StatusPill>}
      >
        <ErrorNotice severity="WARNING" {...section.notice} />
      </Panel>
    );
  }

  const state = section.data;
  if (!state.available) {
    return (
      <Panel
        title="DBスキーマ適用状態"
        tone="warning"
        actions={<StatusPill tone="warning">未取得</StatusPill>}
      >
        <EmptyState message="永続ストアが構成されていないため、スキーマ適用状態を取得していません。" />
        <p className="operator-empty-copy">
          未取得であることは、スキーマが最新であること・不整合が無いことのいずれも意味しません。
        </p>
      </Panel>
    );
  }

  const presentation = MIGRATION_RESULT_PRESENTATION[state.result];
  return (
    <Panel
      className="live-surface-panel"
      title="DBスキーマ適用状態"
      description="ヘルスエンドポイント実測と同じく、サーバー側の実測値です"
      actions={<StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>}
    >
      <KeyValueList
        items={[
          { label: "照合結果", value: presentation.label },
          { label: "適用済みmigration", value: `${state.appliedCount} 件` },
          { label: "定義済みmigration", value: `${state.availableCount} 件` },
          {
            label: "未適用version",
            value: pendingVersionsDisplay(state.pendingVersions),
          },
          {
            label: "最新適用version",
            value: state.latestAppliedVersion ?? "—",
          },
          {
            label: "最新適用名",
            value: state.latestAppliedName ?? "—",
          },
        ]}
      />
      <p className="operator-empty-copy">
        checksumの値そのものと接続情報はAPIが返さないため表示しません。
      </p>
    </Panel>
  );
}

function IntegrationPanel({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
  const health = snapshot.health;
  return (
    <div className="operator-stack">
      <Panel
        className="live-surface-panel"
        title="API接続状態"
        description="ヘルスエンドポイント実測"
        actions={
          health.status === "ready" ? (
            <StatusPill tone="success">応答あり</StatusPill>
          ) : (
            <StatusPill tone="warning">取得不能</StatusPill>
          )
        }
      >
        {health.status === "ready" ? (
          <KeyValueList
            items={[
              { label: "サービス", value: health.data.service },
              { label: "バージョン", value: health.data.version },
              { label: "状態", value: health.data.status },
              { label: "サーバー時刻", value: formatInstant(health.data.timestamp) },
            ]}
          />
        ) : (
          <ErrorNotice
            severity="WARNING"
            message={health.error.message}
            nextAction="再取得してください。継続する場合は同期状態画面で影響範囲を確認してください。"
          />
        )}
      </Panel>

      <MigrationStatePanel section={snapshot.migrationState} />

      <Panel title="関連画面">
        <Link className="operator-button" data-kind="primary" href="/sync-status">
          同期状態・外部連携画面を開く
        </Link>
      </Panel>
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
