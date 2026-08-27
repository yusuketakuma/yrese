import { AdminDashboard } from "./admin-dashboard";

/**
 * SCR-029 管理設定ダッシュボード。
 *
 * データは既存の /whoami・/health と、schema_migrations の実測を返す
 * /operations/migration-state から取得し、tenant/user admin scope を満たさない
 * セッションには管理情報を表示しない。利用者ディレクトリや権限変更commandは、
 * 承認済み契約が存在するまで明示的な unavailable state とする。
 */
export default function Page() {
  return <AdminDashboard />;
}
