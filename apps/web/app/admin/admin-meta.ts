import type { MigrationStateResult } from "@yrese/contracts";
import type {
  PermissionAction,
  PermissionResource,
} from "@yrese/shared-kernel";

import type { OperatorTone } from '../components/operator/operator-ui';

export type AdminTab =
  | "overview"
  | "permissions"
  | "notifications"
  | "audit-policy"
  | "accessibility"
  | "commands"
  | "integrations";

/** 凍結: browser gate が accessible name の完全一致で待機する。 */
export const ADMIN_SCREEN_TITLE = "yrese 管理設定ダッシュボード";

export interface BrowserPreferenceSnapshot {
  readonly reducedMotion: boolean | null;
  readonly forcedColors: boolean | null;
  readonly darkScheme: boolean | null;
}

export const UNKNOWN_BROWSER_PREFERENCES: BrowserPreferenceSnapshot = {
  reducedMotion: null,
  forcedColors: null,
  darkScheme: null,
};

export const TAB_ITEMS: readonly {
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

export const RESOURCE_LABELS: Record<PermissionResource, string> = {
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

export const ACTION_LABELS: Record<PermissionAction, string> = {
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
export const MIGRATION_RESULT_PRESENTATION: Record<
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
export const AUTHORITY_GATE_NOTE =
  "利用者ディレクトリと権限変更操作は提供できません。SCR-029-U（user:admin）と SCR-029-T（tenant:admin）は UIX-001 §12.3 で authority status が candidate / API未登録 であり、canonical API/OpenAPI operation registry への登録と contract test による固定が未了です。";

// JST日時フォーマッタは構築コストが高いためmodule階層で1回だけ構築する(WP-5262)。
export const JST_INSTANT_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Tokyo",
});

export function formatInstant(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "取得不能";
  return JST_INSTANT_FORMAT.format(parsed);
}
