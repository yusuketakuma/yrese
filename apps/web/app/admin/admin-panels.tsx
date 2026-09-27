"use client";

import Link from "next/link";

import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { EmptyState } from "../components/empty-state";
import { ErrorNotice } from "../components/error-notice";
import {
  KeyValueList,
  Panel,
  PrototypeAction,
  StatusPill,
  TableScroll,
} from "../components/operator-ui";
import { type AdminDashboardSnapshot } from "./admin-data";
import {
  ACTION_LABELS,
  AUTHORITY_GATE_NOTE,
  MIGRATION_RESULT_PRESENTATION,
  RESOURCE_LABELS,
  formatInstant,
  type BrowserPreferenceSnapshot,
} from "./admin-meta";

export function UnavailablePanel({
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

export function AccessOverview({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
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

export function PermissionMatrix({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
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

export function NotificationSettings() {
  return (
    <UnavailablePanel
      title="通知設定"
      message="通知チャネル、購読状態、配信履歴の承認済み契約がありません。通知件数や設定状態を捏造せず、未登録状態として表示します。"
      detail="通知が表示されないことは、配信すべき通知が無いことを意味しません。"
    />
  );
}

export function AuditPolicy() {
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

export function AccessibilityPanel({
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

export function CommandSettings() {
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

export function MigrationStatePanel({
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

export function IntegrationPanel({ snapshot }: { readonly snapshot: AdminDashboardSnapshot }) {
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
