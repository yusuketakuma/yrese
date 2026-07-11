import { allowsClaimFinalization } from "@yrese/shared-kernel";

import { PermissionState, ReadOnlyIndicator } from "../components/audit-metadata";

/**
 * 月次締め画面(SCR-021 基盤)。
 * 実装済み: モードゲートの可視化 — 締め・請求データロックは NORMAL モードでのみ許可
 * (正本は shared-kernel allowsClaimFinalization。UI 側で独自判定しない)。
 * 締め処理・請求データロック本体は算定エンジン/締め API の実配線後に実装。
 * モードは検知バックエンド未実装のため NORMAL 固定(同期状態画面と同一の暫定供給)。
 */
export default function Page() {
  const currentMode = "NORMAL" as const;
  const gateAllowed = allowsClaimFinalization(currentMode);
  return (
    <>
      <h2>月次締め</h2>
      <section aria-label="実行可否">
        <PermissionState
          allowed={gateAllowed}
          actionLabel="月次締め・請求データロック(モードゲート)"
          reason="NORMAL モードでのみ実行できます"
        />
        {!gateAllowed && <ReadOnlyIndicator reason="現在のシステムモードでは締めを実行できません" />}
      </section>
      <p className="placeholder-note">
        締め処理・請求データロック本体は未実装です(算定エンジン/締め API の実配線後に実装)。
        上記の可否はモードゲートのみであり、権限・データ状態の確認を代替しません。
      </p>
    </>
  );
}
