import { ModeCapabilityView } from "../components/mode-capability-view";
import { SystemHealthBanner } from "../components/sync-indicator";
import { ModeOverviewTable } from "./mode-overview";

/**
 * 同期状態画面(SCR-027 基盤)。
 *
 * 実装済み: システム稼働状態(SystemHealthBanner)・現在モードの操作可否
 * (ModeCapabilityView — 正本は shared-kernel ガード関数)・全モード可否早見表(P-19)。
 *
 * モードは検知バックエンド未実装のため NORMAL 固定(ヘッダの SystemModeBadge と同一の
 * 暫定供給。モード取得 API は契約承認後に接続)。レコード単位の同期キュー・要再検証一覧は
 * オフライン永続層(R-OFFLINE)未実装のため未接続 — 未接続を「同期済み」に見せない。
 */
export default function Page() {
  const currentMode = "NORMAL" as const;
  return (
    <>
      <h2>同期状態</h2>
      <SystemHealthBanner
        mode={currentMode}
        reason="モード検知バックエンド未接続のため NORMAL 固定表示(暫定)"
      />
      <section aria-label="現在モードの操作可否">
        <h3>現在モードの操作可否</h3>
        <ModeCapabilityView mode={currentMode} />
      </section>
      <section aria-label="モード別可否早見表">
        <h3>モード別可否早見表(非常時リファレンス)</h3>
        <ModeOverviewTable currentMode={currentMode} />
      </section>
      <p className="placeholder-note">
        レコード単位の同期キュー・保留一覧・要再検証一覧は、オフライン永続層(R-OFFLINE)
        未実装のため未接続です。未接続であることは「同期済み」を意味しません。
      </p>
    </>
  );
}
