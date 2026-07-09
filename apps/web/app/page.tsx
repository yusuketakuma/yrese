import { ReceptionDashboard } from "./reception-dashboard";

/**
 * 受付ダッシュボード(SCR-001、API-006 v0.2.0)。
 * 受付キューの表示と受付登録。外部連携状態は SCR-024/025 の実装WPで接続する。
 */
export default function ReceptionPage() {
  return (
    <>
      <h2>受付ダッシュボード</h2>
      <ReceptionDashboard />
    </>
  );
}
