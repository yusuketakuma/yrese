import { AdminDashboard } from "./admin-dashboard";

/**
 * SCR-029 管理者・権限管理。
 *
 * データは既存の /whoami と /health から取得し、tenant/user admin scopeを満たさない
 * セッションには管理情報を表示しない。利用者ディレクトリや権限変更commandは、
 * 承認済み契約が存在するまで明示的な unavailable state とする。
 */
export default function Page() {
  return (
    <div data-admin-dashboard="true">
      <AdminDashboard />
    </div>
  );
}
