import { AuditLogPanel } from "./audit-log-view";

/**
 * 管理画面。
 * 監査ログ閲覧(SCR-028)は実装済み。テナント・薬局・ユーザー・権限管理は
 * permission_scope_registry SSOT 承認後に実装(未実装の機能を実装済みに見せない)。
 */
export default function Page() {
  return (
    <>
      <h2>管理</h2>
      <section aria-label="監査ログ(SCR-028)">
        <h3>監査ログ</h3>
        <AuditLogPanel />
      </section>
      <p className="placeholder-note">
        テナント・薬局・ユーザー・権限管理は未実装のプレースホルダーです(permission_scope_registry
        SSOT 承認後に実装)。
      </p>
    </>
  );
}
