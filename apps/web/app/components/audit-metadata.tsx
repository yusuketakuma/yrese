/**
 * 監査・版・権限・閲覧専用の表示群。
 *
 * 根拠: 医療情報システム安全管理GL(監査ログ who/when/what)、電子保存三基準(真正性・版管理)、
 * permissions.ts(最小権限・deny-by-default)、UIX-001 P-14(権限状態の明示)。
 *
 * 注記: 監査ログ・版履歴の取得は監査ログ API(R-AUDIT)の契約に従う(表示投影)。
 * who(実施者)は表示に必要な最小限とし、PHI・不要な個人情報をログ・計測へ渡さない。
 */

/** 監査メタデータ(who/when/what)を1行で明示する。 */
export interface AuditMetadataProps {
  /** 実施者(表示名・職員ID 等の最小識別)。 */
  readonly actor: string;
  /** 実施日時(ISO文字列)。 */
  readonly at: string;
  /** 実施内容(操作の説明)。 */
  readonly action: string;
}

export function AuditMetadata(props: AuditMetadataProps) {
  return (
    <span className="audit-metadata" data-actor={props.actor}>
      <span className="audit-metadata-actor">{props.actor}</span>
      <span className="audit-metadata-action">{props.action}</span>
      <span className="audit-metadata-at">{props.at}</span>
    </span>
  );
}

/** 版履歴インジケータ。現在版と総版数を示し、過去版の存在を可視化する(真正性・訂正履歴)。 */
export interface VersionHistoryIndicatorProps {
  readonly currentVersion: number;
  readonly totalVersions: number;
}

export function VersionHistoryIndicator(props: VersionHistoryIndicatorProps) {
  const hasHistory = props.totalVersions > 1;
  return (
    <span
      className="version-history"
      data-current={props.currentVersion}
      data-total={props.totalVersions}
      data-has-history={hasHistory ? "true" : "false"}
    >
      第{props.currentVersion}版 / 全{props.totalVersions}版
      {hasHistory && <span className="version-history-note">(訂正履歴あり)</span>}
    </span>
  );
}

/**
 * 権限状態インジケータ(deny-by-default の可視化)。
 * 許可されていない操作は理由とともに明示する(権限外操作の抑止)。
 */
export interface PermissionStateProps {
  readonly allowed: boolean;
  /** 対象操作の説明ラベル。 */
  readonly actionLabel: string;
  /** 不許可の理由(allowed=false のとき)。 */
  readonly reason?: string;
}

export function PermissionState(props: PermissionStateProps) {
  return (
    <span
      className="permission-state"
      data-allowed={props.allowed ? "true" : "false"}
      role="status"
    >
      <span className="permission-state-shape" aria-hidden="true">
        {props.allowed ? "●" : "✕"}
      </span>
      <span className="permission-state-label">
        {props.actionLabel}: {props.allowed ? "実行可" : "権限がありません"}
      </span>
      {!props.allowed && props.reason && (
        <span className="permission-state-reason">({props.reason})</span>
      )}
    </span>
  );
}

/** 閲覧専用インジケータ。なぜ編集できないかを明示する(混乱・無駄な操作の抑止)。 */
export interface ReadOnlyIndicatorProps {
  /** 閲覧専用の理由(権限・状態・モード等)。 */
  readonly reason: string;
}

export function ReadOnlyIndicator(props: ReadOnlyIndicatorProps) {
  return (
    <span className="read-only-indicator" role="status" data-read-only="true">
      <span aria-hidden="true">△</span> 閲覧のみ({props.reason})
    </span>
  );
}
